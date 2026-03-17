export const OVERLAY_SCRIPT: string = `(function() {
  if (window.__claudeBrowser_overlayActive) return;
  window.__claudeBrowser_overlayActive = true;

  // ── DOM Setup ────────────────────────────────────────
  var highlight = document.createElement('div');
  highlight.className = '__cb-highlight';
  highlight.style.display = 'none';
  document.body.appendChild(highlight);

  var hint = document.createElement('div');
  hint.className = '__cb-hint';
  var hintText = document.createElement('span');
  hintText.textContent = 'Hover to inspect \\u00b7 Long-press to send \\u00b7 ESC to pause';
  hint.appendChild(hintText);
  var hintClose = document.createElement('button');
  hintClose.className = '__cb-hint-close';
  hintClose.textContent = '\\u00d7';
  hint.appendChild(hintClose);
  document.body.appendChild(hint);

  hintClose.addEventListener('click', function(e) {
    e.stopPropagation();
    hint.style.display = 'none';
  });

  // ── Hint drag ─────────────────────────────────────────
  var hintDragging = false;
  var hintDragOffset = { x: 0, y: 0 };

  hint.addEventListener('mousedown', function(e) {
    if (e.target === hintClose) return;
    e.preventDefault();
    hintDragging = true;
    hint.classList.add('--dragging');
    var rect = hint.getBoundingClientRect();
    hintDragOffset.x = e.clientX - rect.left;
    hintDragOffset.y = e.clientY - rect.top;
    // Switch from centered to absolute positioning on first drag
    hint.style.transform = 'none';
    hint.style.left = rect.left + 'px';
    hint.style.top = rect.top + 'px';
    hint.style.bottom = 'auto';
  });

  document.addEventListener('mousemove', function(e) {
    if (!hintDragging) return;
    var x = e.clientX - hintDragOffset.x;
    var y = e.clientY - hintDragOffset.y;
    hint.style.left = x + 'px';
    hint.style.top = y + 'px';
  });

  document.addEventListener('mouseup', function() {
    if (hintDragging) {
      hintDragging = false;
      hint.classList.remove('--dragging');
    }
  });

  var selectedHighlight = null;
  var currentElement = null;
  var isActive = true;
  var longPressTimer = null;
  var longPressStartPos = null;

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

  // ── Send element to Claude Code ──────────────────────
  function sendElement(el) {
    var info = collectElementInfo(el);
    var name = (info.component && info.component.componentName) ? info.component.componentName : info.tagName;
    window.__claudeBrowser_sendToClaudeCode(info.formattedText, name).then(function(n) {
      if (n > 0) showToast('Sent [Component #' + n + '] to Claude Code!');
      else showToast('Failed to send');
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
  }

  // ── Event Handlers ───────────────────────────────────
  function onMouseMove(e) {
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || (el.className && typeof el.className === 'string' && el.className.includes('__cb-'))) {
      return;
    }

    if (el === currentElement) return;

    currentElement = el;
    var rect = el.getBoundingClientRect();
    highlight.style.display = 'block';
    highlight.style.top = rect.top + 'px';
    highlight.style.left = rect.left + 'px';
    highlight.style.width = rect.width + 'px';
    highlight.style.height = rect.height + 'px';
  }

  function onKeyDown(e) {
    if (e.key === 'Escape' && isActive) {
      deactivate();
    } else if (e.key === 'i' && (e.metaKey || e.ctrlKey) && !isActive) {
      e.preventDefault();
      activate();
    } else if (e.key.toLowerCase() === 's' && e.metaKey && e.shiftKey) {
      e.preventDefault();
      startScreenCapture();
    }
  }

  // ── Deactivate (pause) ────────────────────────────────
  function deactivate() {
    highlight.style.display = 'none';
    if (selectedHighlight) {
      selectedHighlight.parentNode && selectedHighlight.parentNode.removeChild(selectedHighlight);
      selectedHighlight = null;
    }
    document.removeEventListener('mousemove', onMouseMove, true);
    currentElement = null;
    isActive = false;
    hintText.textContent = '\\u2318+I to inspect \\u00b7 Long-press to select';
  }

  // ── Activate (resume) ─────────────────────────────────
  function activate() {
    if (isActive) return;
    isActive = true;
    document.addEventListener('mousemove', onMouseMove, true);
    hintText.textContent = 'Hover to inspect \\u00b7 Long-press to send \\u00b7 ESC to pause';
    showToast('Element selection enabled');
  }

  // ── Full Cleanup (called by daemon stop) ──────────────
  function fullCleanup() {
    highlight.parentNode && highlight.parentNode.removeChild(highlight);
    hint.parentNode && hint.parentNode.removeChild(hint);
    if (selectedHighlight) {
      selectedHighlight.parentNode && selectedHighlight.parentNode.removeChild(selectedHighlight);
      selectedHighlight = null;
    }
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('mousedown', onLongPressStart, true);
    document.removeEventListener('mouseup', onLongPressEnd, true);
    document.removeEventListener('mousemove', onLongPressMove, true);
    document.removeEventListener('dblclick', onDblClick, true);
    window.__claudeBrowser_overlayActive = false;
  }
  window.__claudeBrowser_fullCleanup = fullCleanup;

  // ── Long-press ────────────────────────────────────────
  var longPressTriggered = false;

  function onLongPressStart(e) {
    if (e.button !== 0) return;
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || (el.className && typeof el.className === 'string' && el.className.includes('__cb-'))) return;

    e.preventDefault();
    longPressStartPos = { x: e.clientX, y: e.clientY };
    longPressTriggered = false;
    var pressedElement = el;

    longPressTimer = setTimeout(function() {
      longPressTimer = null;
      longPressTriggered = true;
      if (!isActive) {
        activate();
      } else {
        sendElement(pressedElement);
      }
    }, 800);
  }

  function onLongPressMove(e) {
    if (!longPressTimer || !longPressStartPos) return;
    var dx = e.clientX - longPressStartPos.x;
    var dy = e.clientY - longPressStartPos.y;
    if (dx * dx + dy * dy > 400) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function onLongPressEnd(e) {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    if (longPressTriggered) {
      e.preventDefault();
      e.stopPropagation();
      longPressTriggered = false;
    }
  }

  // ── Screenshot region capture ──────────────────────────
  function startScreenCapture() {
    var screenOverlay = document.createElement('div');
    screenOverlay.className = '__cb-screen-overlay';
    document.body.appendChild(screenOverlay);

    var selBox = document.createElement('div');
    selBox.className = '__cb-screen-selection';
    selBox.style.display = 'none';
    document.body.appendChild(selBox);

    var sizeLabel = document.createElement('div');
    sizeLabel.className = '__cb-screen-size';
    sizeLabel.style.display = 'none';
    document.body.appendChild(sizeLabel);

    var sx, sy, dragging = false;

    function cleanupCapture() {
      screenOverlay.parentNode && screenOverlay.parentNode.removeChild(screenOverlay);
      selBox.parentNode && selBox.parentNode.removeChild(selBox);
      sizeLabel.parentNode && sizeLabel.parentNode.removeChild(sizeLabel);
      screenOverlay.removeEventListener('mousedown', onCapDown);
      document.removeEventListener('mousemove', onCapMove, true);
      document.removeEventListener('mouseup', onCapUp, true);
      document.removeEventListener('keydown', onCapEsc, true);
    }

    function onCapDown(e) {
      sx = e.clientX;
      sy = e.clientY;
      dragging = true;
      selBox.style.display = 'block';
      selBox.style.left = sx + 'px';
      selBox.style.top = sy + 'px';
      selBox.style.width = '0px';
      selBox.style.height = '0px';
    }

    function onCapMove(e) {
      if (!dragging) return;
      var x = Math.min(sx, e.clientX);
      var y = Math.min(sy, e.clientY);
      var w = Math.abs(e.clientX - sx);
      var h = Math.abs(e.clientY - sy);
      selBox.style.left = x + 'px';
      selBox.style.top = y + 'px';
      selBox.style.width = w + 'px';
      selBox.style.height = h + 'px';
      sizeLabel.style.display = 'block';
      sizeLabel.textContent = w + ' \\u00d7 ' + h;
      sizeLabel.style.left = (x + w + 8) + 'px';
      sizeLabel.style.top = (y + h + 8) + 'px';
    }

    function onCapUp(e) {
      if (!dragging) return;
      dragging = false;
      var x = Math.min(sx, e.clientX);
      var y = Math.min(sy, e.clientY);
      var w = Math.abs(e.clientX - sx);
      var h = Math.abs(e.clientY - sy);
      cleanupCapture();
      if (w < 5 || h < 5) return;

      var scrollX = window.scrollX || window.pageXOffset || 0;
      var scrollY = window.scrollY || window.pageYOffset || 0;
      window.__claudeBrowser_captureRegion(x + scrollX, y + scrollY, w, h).then(function(n) {
        if (n > 0) showToast('Screenshot #' + n + ' sent to Claude Code!');
        else showToast('Screenshot failed');
      });
    }

    function onCapEsc(e) {
      if (e.key === 'Escape') {
        cleanupCapture();
      }
    }

    screenOverlay.addEventListener('mousedown', onCapDown);
    document.addEventListener('mousemove', onCapMove, true);
    document.addEventListener('mouseup', onCapUp, true);
    document.addEventListener('keydown', onCapEsc, true);
  }

  // ── Double-click to send ─────────────────────────────
  function onDblClick(e) {
    if (!isActive) return;
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || (el.className && typeof el.className === 'string' && el.className.includes('__cb-'))) return;
    e.preventDefault();
    e.stopPropagation();
    sendElement(el);
  }

  // ── Attach ───────────────────────────────────────────
  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('mousedown', onLongPressStart, true);
  document.addEventListener('mouseup', onLongPressEnd, true);
  document.addEventListener('mousemove', onLongPressMove, true);
  document.addEventListener('dblclick', onDblClick, true);
})();`;
