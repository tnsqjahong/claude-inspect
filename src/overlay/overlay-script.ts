export const OVERLAY_SCRIPT: string = `(function() {
  if (window.__claudeInspect_overlayActive) return;
  window.__claudeInspect_overlayActive = true;

  // ── DOM Setup ────────────────────────────────────────
  var highlight = document.createElement('div');
  highlight.className = '__cb-highlight';
  highlight.style.display = 'none';
  document.body.appendChild(highlight);

  var tooltip = document.createElement('div');
  tooltip.className = '__cb-tooltip';
  tooltip.style.display = 'none';
  document.body.appendChild(tooltip);

  var tail = document.createElement('div');
  tail.className = '__cb-tooltip-tail';
  tooltip.appendChild(tail);

  var bridge = document.createElement('div');
  bridge.className = '__cb-bridge';
  document.body.appendChild(bridge);

  var hint = document.createElement('div');
  hint.className = '__cb-hint';
  hint.textContent = 'Hover to inspect \\u00b7 Click "\\u2192 Claude Code" to send \\u00b7 ESC to exit';
  document.body.appendChild(hint);

  var selectedHighlight = null;
  var currentElement = null;
  var currentElementInfo = null;
  var tooltipFrozen = false;

  // ── Framework Detection ──────────────────────────────
  function detectFramework(element) {
    var fiberKey = Object.keys(element).find(function(k) {
      return k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$');
    });
    if (fiberKey) {
      var fiber = element[fiberKey];
      var componentFiber = fiber;
      while (componentFiber) {
        if (typeof componentFiber.type === 'function' || typeof componentFiber.type === 'object') {
          var name = (componentFiber.type && (componentFiber.type.displayName || componentFiber.type.name)) || null;
          if (name) {
            var source = componentFiber._debugSource || null;
            var props = {};
            if (componentFiber.memoizedProps) {
              for (var entry of Object.entries(componentFiber.memoizedProps)) {
                var k = entry[0], v = entry[1];
                if (k === 'children') continue;
                var type = typeof v;
                if (type === 'string' || type === 'number' || type === 'boolean') {
                  props[k] = v;
                } else if (type === 'function') {
                  props[k] = '[Function]';
                } else {
                  try { props[k] = JSON.stringify(v) && JSON.stringify(v).substring(0, 100); } catch(e) { props[k] = '[Object]'; }
                }
              }
            }
            return {
              framework: 'react',
              componentName: name,
              sourceFile: source ? source.fileName : null,
              lineNumber: source ? source.lineNumber : null,
              columnNumber: source ? source.columnNumber : null,
              props: props
            };
          }
        }
        componentFiber = componentFiber.return;
      }
    }

    var vueComponent = element.__vueParentComponent;
    if (vueComponent) {
      var vueName = (vueComponent.type && (vueComponent.type.name || vueComponent.type.__name)) || null;
      var sourceFile = (vueComponent.type && vueComponent.type.__file) || null;
      var vueProps = {};
      if (vueComponent.props) {
        for (var vEntry of Object.entries(vueComponent.props)) {
          var vk = vEntry[0], vv = vEntry[1];
          var vType = typeof vv;
          if (vType === 'string' || vType === 'number' || vType === 'boolean') {
            vueProps[vk] = vv;
          } else if (vType === 'function') {
            vueProps[vk] = '[Function]';
          } else {
            try { vueProps[vk] = JSON.stringify(vv) && JSON.stringify(vv).substring(0, 100); } catch(e) { vueProps[vk] = '[Object]'; }
          }
        }
      }
      if (vueName) {
        return { framework: 'vue', componentName: vueName, sourceFile: sourceFile, lineNumber: null, columnNumber: null, props: vueProps };
      }
    }

    if (element.__s !== undefined || element.__svelte_meta) {
      return { framework: 'svelte', componentName: 'SvelteComponent', sourceFile: null, lineNumber: null, columnNumber: null, props: {} };
    }

    return null;
  }

  // ── Selector Generation ──────────────────────────────
  function getUniqueSelector(element) {
    if (element.id) return '#' + CSS.escape(element.id);
    var path = [];
    var current = element;
    while (current && current !== document.body && current !== document.documentElement) {
      var selector = current.tagName.toLowerCase();
      if (current.id) {
        path.unshift('#' + CSS.escape(current.id));
        break;
      }
      if (current.className && typeof current.className === 'string') {
        var classes = current.className.trim().split(/\\s+/).filter(function(c) { return !c.startsWith('__cb-'); }).slice(0, 2);
        if (classes.length) selector += '.' + classes.map(function(c) { return CSS.escape(c); }).join('.');
      }
      var parent = current.parentElement;
      if (parent) {
        var siblings = Array.from(parent.children).filter(function(s) { return s.tagName === current.tagName; });
        if (siblings.length > 1) {
          var index = siblings.indexOf(current) + 1;
          selector += ':nth-of-type(' + index + ')';
        }
      }
      path.unshift(selector);
      current = current.parentElement;
    }
    return path.join(' > ');
  }

  // ── Format for Claude Code (single line for auto-paste) ──
  function formatForClaude(el, component, hierarchy) {
    var parts = [];

    if (component && component.componentName) {
      parts.push('<' + component.componentName + '> (' + component.framework + ')');
    } else {
      var tag = el.tagName.toLowerCase();
      var id = el.id ? '#' + el.id : '';
      var cls = el.className && typeof el.className === 'string'
        ? '.' + el.className.trim().split(/\\s+/).filter(function(c) { return c && !c.startsWith('__cb-'); }).slice(0, 3).join('.')
        : '';
      parts.push(tag + id + cls);
    }

    if (component && component.sourceFile) {
      var src = component.sourceFile;
      if (component.lineNumber) src += ':' + component.lineNumber;
      parts.push('File: ' + src);
    }

    if (component && component.props && Object.keys(component.props).length > 0) {
      var propKeys = Object.keys(component.props).slice(0, 3);
      var propStr = propKeys.map(function(k) {
        var val = typeof component.props[k] === 'string' ? '"' + component.props[k] + '"' : String(component.props[k]);
        return k + '=' + val;
      }).join(', ');
      parts.push('Props: ' + propStr);
    }

    var rect = el.getBoundingClientRect();
    parts.push('size: ' + Math.round(rect.width) + 'x' + Math.round(rect.height));

    if (hierarchy && hierarchy.length > 0) {
      var parents = hierarchy.map(function(h) { return h.componentName; }).join(' > ');
      parts.push('in: ' + parents);
    }

    parts.push('Selector: ' + getUniqueSelector(el));

    return parts.join(' | ');
  }

  // ── Collect Full Element Info ────────────────────────
  function collectElementInfo(el) {
    var rect = el.getBoundingClientRect();
    var computed = window.getComputedStyle(el);

    var attributes = {};
    var attrList = el.attributes;
    var attrCount = Math.min(attrList.length, 20);
    for (var i = 0; i < attrCount; i++) {
      attributes[attrList[i].name] = attrList[i].value;
    }

    var styles = {
      display: computed.display,
      position: computed.position,
      width: computed.width,
      height: computed.height,
      color: computed.color,
      backgroundColor: computed.backgroundColor,
      fontSize: computed.fontSize,
      fontFamily: computed.fontFamily,
      padding: computed.padding,
      margin: computed.margin,
      border: computed.border
    };

    var text = (el.textContent || '').substring(0, 200);
    var component = detectFramework(el);

    var hierarchy = [];
    var walker = el.parentElement;
    while (walker && walker !== document.body) {
      var fw = detectFramework(walker);
      if (fw && fw.componentName) {
        hierarchy.push({ componentName: fw.componentName, framework: fw.framework, sourceFile: fw.sourceFile });
      }
      walker = walker.parentElement;
    }

    var classes = el.className && typeof el.className === 'string'
      ? el.className.trim().split(/\\s+/).filter(function(c) { return c && !c.startsWith('__cb-'); })
      : [];

    return {
      tagName: el.tagName.toLowerCase(),
      id: el.id || '',
      classes: classes,
      attributes: attributes,
      selector: getUniqueSelector(el),
      styles: styles,
      boundingRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      textContent: text,
      component: component,
      componentHierarchy: hierarchy,
      formattedText: formatForClaude(el, component, hierarchy)
    };
  }

  // ── Toast ────────────────────────────────────────────
  function showToast(message) {
    var existing = document.querySelector('.__cb-toast');
    if (existing) existing.parentNode.removeChild(existing);
    var toast = document.createElement('div');
    toast.className = '__cb-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function() {
      toast.parentNode && toast.parentNode.removeChild(toast);
    }, 2000);
  }

  // ── Tooltip positioning at mouse cursor ─────────────
  function positionTooltipAtMouse(mx, my) {
    tooltip.style.display = 'block';
    var tooltipRect = tooltip.getBoundingClientRect();
    var gap = 14;
    var tooltipBelow = true;
    var top, left;

    // Try below cursor
    top = my + gap;
    if (top + tooltipRect.height > window.innerHeight - 4) {
      // Not enough space below, go above
      top = my - tooltipRect.height - gap;
      tooltipBelow = false;
    }
    if (top < 4) top = 4;

    // Center horizontally on cursor
    left = mx - tooltipRect.width / 2;
    if (left < 4) left = 4;
    if (left + tooltipRect.width > window.innerWidth - 4) {
      left = window.innerWidth - tooltipRect.width - 4;
    }

    tooltip.style.top = top + 'px';
    tooltip.style.left = left + 'px';

    // Position tail (arrow) pointing toward cursor
    var tailLeft = mx - left - 6;
    if (tailLeft < 8) tailLeft = 8;
    if (tailLeft > tooltipRect.width - 20) tailLeft = tooltipRect.width - 20;

    if (tooltipBelow) {
      tail.style.top = '-5px';
      tail.style.bottom = '';
      tail.style.left = tailLeft + 'px';
    } else {
      tail.style.top = '';
      tail.style.bottom = '-5px';
      tail.style.left = tailLeft + 'px';
    }

    // Position invisible bridge between cursor and tooltip
    bridge.style.display = 'block';
    bridge.style.left = (mx - 24) + 'px';
    bridge.style.width = '48px';
    if (tooltipBelow) {
      bridge.style.top = my + 'px';
      bridge.style.height = gap + 'px';
    } else {
      bridge.style.top = (top + tooltipRect.height) + 'px';
      bridge.style.height = gap + 'px';
    }
  }

  function buildTooltip(info, el) {
    tooltip.innerHTML = '';
    tooltip.appendChild(tail);

    // Line 1: Component name or tag + send button
    var headerLine = document.createElement('div');
    headerLine.style.display = 'flex';
    headerLine.style.alignItems = 'center';
    headerLine.style.justifyContent = 'space-between';
    headerLine.style.gap = '12px';

    var nameSpan = document.createElement('span');
    if (info.component && info.component.componentName) {
      nameSpan.className = '__cb-tooltip-component';
      nameSpan.textContent = '<' + info.component.componentName + '>';
    } else {
      nameSpan.textContent = info.tagName + (info.id ? '#' + info.id : '') + (info.classes.length > 0 ? '.' + info.classes.slice(0, 2).join('.') : '');
    }
    headerLine.appendChild(nameSpan);

    // "→ Claude Code" button
    var sendBtn = document.createElement('button');
    sendBtn.className = '__cb-send-btn';
    sendBtn.textContent = '\\u2192 Claude Code';
    sendBtn.addEventListener('mousedown', function(e) {
      e.stopPropagation();
    });
    sendBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();

      // Save full info to file + type short reference into terminal
      var name = (info.component && info.component.componentName) ? info.component.componentName : info.tagName;
      window.__claudeInspect_sendToClaudeCode(info.formattedText, name).then(function(n) {
        if (n > 0) {
          showToast('Sent [Component #' + n + '] to Claude Code!');
        } else {
          showToast('Failed to send');
        }
      });

      // Show selected highlight
      if (selectedHighlight) {
        selectedHighlight.parentNode && selectedHighlight.parentNode.removeChild(selectedHighlight);
      }
      var rect = el.getBoundingClientRect();
      selectedHighlight = document.createElement('div');
      selectedHighlight.className = '__cb-selected';
      selectedHighlight.style.top = rect.top + 'px';
      selectedHighlight.style.left = rect.left + 'px';
      selectedHighlight.style.width = rect.width + 'px';
      selectedHighlight.style.height = rect.height + 'px';
      document.body.appendChild(selectedHighlight);
    });
    headerLine.appendChild(sendBtn);
    tooltip.appendChild(headerLine);

    // Line 2: tag + dimensions (only if component detected)
    if (info.component) {
      var detailLine = document.createElement('div');
      var rect = el.getBoundingClientRect();
      var dim = Math.round(rect.width) + 'x' + Math.round(rect.height);
      var tagSpan = document.createElement('span');
      tagSpan.textContent = info.tagName + (info.id ? '#' + info.id : '') + (info.classes.length > 0 ? '.' + info.classes.slice(0, 2).join('.') : '');
      detailLine.appendChild(tagSpan);
      var dimSpan = document.createElement('span');
      dimSpan.className = '__cb-tooltip-dim';
      dimSpan.textContent = '  ' + dim;
      detailLine.appendChild(dimSpan);
      tooltip.appendChild(detailLine);
    }

    // Line 3: Source file
    if (info.component && info.component.sourceFile) {
      var srcDiv = document.createElement('div');
      srcDiv.className = '__cb-tooltip-source';
      var src = info.component.sourceFile;
      if (info.component.lineNumber) src += ':' + info.component.lineNumber;
      srcDiv.textContent = src;
      tooltip.appendChild(srcDiv);
    }

    // Line 4: Props preview
    if (info.component && info.component.props && Object.keys(info.component.props).length > 0) {
      var propsDiv = document.createElement('div');
      propsDiv.className = '__cb-tooltip-dim';
      var propKeys = Object.keys(info.component.props).slice(0, 3);
      var propStr = propKeys.map(function(k) { return k + '=' + JSON.stringify(info.component.props[k]); }).join(', ');
      if (Object.keys(info.component.props).length > 3) propStr += ', ...';
      propsDiv.textContent = propStr;
      tooltip.appendChild(propsDiv);
    }
  }

  // ── Freeze tooltip: stays open when mouse enters tooltip or bridge ──
  tooltip.addEventListener('mouseenter', function() {
    tooltipFrozen = true;
  });
  tooltip.addEventListener('mouseleave', function() {
    tooltipFrozen = false;
  });
  bridge.addEventListener('mouseenter', function() {
    tooltipFrozen = true;
  });
  bridge.addEventListener('mouseleave', function() {
    tooltipFrozen = false;
  });

  // ── Event Handlers ───────────────────────────────────
  function onMouseMove(e) {
    if (tooltipFrozen) return;

    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || (el.className && typeof el.className === 'string' && el.className.includes('__cb-'))) {
      return;
    }

    // Same element — no update
    if (el === currentElement) return;

    currentElement = el;
    var rect = el.getBoundingClientRect();
    highlight.style.display = 'block';
    highlight.style.top = rect.top + 'px';
    highlight.style.left = rect.left + 'px';
    highlight.style.width = rect.width + 'px';
    highlight.style.height = rect.height + 'px';

    var info = collectElementInfo(el);
    currentElementInfo = info;
    buildTooltip(info, el);
    positionTooltipAtMouse(e.clientX, e.clientY);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      cleanup();
      window.__claudeInspect_onSelectionCancelled();
    }
  }

  // ── Cleanup ──────────────────────────────────────────
  function cleanup() {
    highlight.parentNode && highlight.parentNode.removeChild(highlight);
    tooltip.parentNode && tooltip.parentNode.removeChild(tooltip);
    bridge.parentNode && bridge.parentNode.removeChild(bridge);
    hint.parentNode && hint.parentNode.removeChild(hint);
    if (selectedHighlight) {
      selectedHighlight.parentNode && selectedHighlight.parentNode.removeChild(selectedHighlight);
      selectedHighlight = null;
    }
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('keydown', onKeyDown, true);
    window.__claudeInspect_overlayActive = false;
  }

  // ── Attach ───────────────────────────────────────────
  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('keydown', onKeyDown, true);
})();`;
