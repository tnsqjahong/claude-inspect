import type { Page } from 'playwright';
import type { InspectedElement, ComponentTreeNode } from './types.js';

class ElementInspector {
  async inspectElement(page: Page, selector: string): Promise<InspectedElement> {
    const result = await page.evaluate((sel: string) => {
      const element = document.querySelector(sel);
      if (!element) {
        throw new Error(`Element not found: ${sel}`);
      }

      const el = element as HTMLElement;

      // Build unique CSS selector
      function generateSelector(node: Element): string {
        if (node.id) {
          return `#${node.id}`;
        }
        const parts: string[] = [];
        let current: Element | null = node;
        while (current && current !== document.body) {
          let part = current.tagName.toLowerCase();
          if (current.id) {
            part = `#${current.id}`;
            parts.unshift(part);
            break;
          }
          const parentEl: Element | null = current.parentElement;
          if (parentEl) {
            const tagName = current.tagName;
            const siblings = Array.from(parentEl.children).filter(
              (c: Element) => c.tagName === tagName,
            );
            if (siblings.length > 1) {
              const index = siblings.indexOf(current) + 1;
              part += `:nth-of-type(${index})`;
            }
          }
          parts.unshift(part);
          current = parentEl;
        }
        return parts.join(' > ');
      }

      // Collect attributes (limit to 20)
      const attributeEntries: [string, string][] = [];
      for (let i = 0; i < Math.min(el.attributes.length, 20); i++) {
        const attr = el.attributes[i];
        attributeEntries.push([attr.name, attr.value]);
      }

      // Collect computed styles
      const computed = window.getComputedStyle(el);
      const styleKeys = [
        'display', 'position', 'width', 'height', 'color', 'backgroundColor',
        'fontSize', 'fontFamily', 'fontWeight', 'lineHeight', 'padding', 'margin',
        'border', 'borderRadius', 'overflow', 'zIndex', 'opacity',
      ];
      const styles: Record<string, string> = {};
      for (const key of styleKeys) {
        styles[key] = computed.getPropertyValue(
          key.replace(/([A-Z])/g, '-$1').toLowerCase(),
        );
      }

      const rect = el.getBoundingClientRect();
      const text = (el.textContent ?? '').trim().slice(0, 200);

      // Detect React component
      type FiberNode = {
        return?: FiberNode;
        type?: { name?: string; displayName?: string } | string;
        _debugSource?: { fileName: string; lineNumber: number; columnNumber: number };
        memoizedProps?: Record<string, unknown>;
      };

      function detectReactComponent(node: Element): {
        framework: string;
        componentName: string;
        sourceFile: string | null;
        lineNumber: number | null;
        columnNumber: number | null;
        props: Record<string, unknown>;
      } | null {
        const keys = Object.keys(node);
        const fiberKey = keys.find((k) => k.startsWith('__reactFiber$'));
        if (!fiberKey) return null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let fiber: FiberNode | undefined = (node as any)[fiberKey] as FiberNode;
        while (fiber) {
          const type = fiber.type;
          if (type && typeof type !== 'string') {
            const name = type.displayName ?? type.name;
            if (name && name !== 'div' && name !== 'span') {
              return {
                framework: 'react',
                componentName: name,
                sourceFile: fiber._debugSource?.fileName ?? null,
                lineNumber: fiber._debugSource?.lineNumber ?? null,
                columnNumber: fiber._debugSource?.columnNumber ?? null,
                props: (fiber.memoizedProps as Record<string, unknown>) ?? {},
              };
            }
          }
          fiber = fiber.return;
        }
        return null;
      }

      function detectVueComponent(node: Element): {
        framework: string;
        componentName: string;
        sourceFile: string | null;
        lineNumber: number | null;
        columnNumber: number | null;
        props: Record<string, unknown>;
      } | null {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const vueInstance = (node as any).__vueParentComponent;
        if (!vueInstance) return null;
        const name =
          vueInstance.type?.name ??
          vueInstance.type?.__name ??
          vueInstance.type?.displayName ??
          'UnknownVue';
        return {
          framework: 'vue',
          componentName: name,
          sourceFile: vueInstance.type?.__file ?? null,
          lineNumber: null,
          columnNumber: null,
          props: (vueInstance.props as Record<string, unknown>) ?? {},
        };
      }

      const component = detectReactComponent(el) ?? detectVueComponent(el);

      return {
        element: {
          tagName: el.tagName.toLowerCase(),
          id: el.id,
          classes: Array.from(el.classList),
          attributes: Object.fromEntries(attributeEntries),
          styles,
          boundingRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          textContent: text,
          selector: generateSelector(el),
        },
        component,
      };
    }, selector);

    return result;
  }

  async getComponentTree(
    page: Page,
    selector?: string,
    maxDepth = 10,
  ): Promise<ComponentTreeNode[]> {
    const tree = await page.evaluate(
      ({ sel, depth }: { sel: string | undefined; depth: number }) => {
        const root = sel
          ? (document.querySelector(sel) as Element | null) ?? document.body
          : document.body;

        type FiberNode = {
          return?: FiberNode;
          type?: { name?: string; displayName?: string } | string;
          _debugSource?: { fileName: string; lineNumber: number };
          memoizedProps?: Record<string, unknown>;
        };

        interface TreeNode {
          name: string;
          framework: string;
          sourceFile: string | null;
          props: Record<string, unknown>;
          children: TreeNode[];
          depth: number;
        }

        function getReactInfo(node: Element): {
          name: string;
          framework: string;
          sourceFile: string | null;
          props: Record<string, unknown>;
        } | null {
          const keys = Object.keys(node);
          const fiberKey = keys.find((k) => k.startsWith('__reactFiber$'));
          if (!fiberKey) return null;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let fiber: FiberNode | undefined = (node as any)[fiberKey] as FiberNode;
          while (fiber) {
            const type = fiber.type;
            if (type && typeof type !== 'string') {
              const name = type.displayName ?? type.name;
              if (name && name !== 'div' && name !== 'span') {
                return {
                  name,
                  framework: 'react',
                  sourceFile: fiber._debugSource?.fileName ?? null,
                  props: (fiber.memoizedProps as Record<string, unknown>) ?? {},
                };
              }
            }
            fiber = fiber.return;
          }
          return null;
        }

        function getVueInfo(node: Element): {
          name: string;
          framework: string;
          sourceFile: string | null;
          props: Record<string, unknown>;
        } | null {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const vue = (node as any).__vueParentComponent;
          if (!vue) return null;
          const name =
            vue.type?.name ?? vue.type?.__name ?? vue.type?.displayName ?? 'UnknownVue';
          return {
            name,
            framework: 'vue',
            sourceFile: vue.type?.__file ?? null,
            props: (vue.props as Record<string, unknown>) ?? {},
          };
        }

        function walk(node: Element, currentDepth: number): TreeNode[] {
          if (currentDepth > depth) return [];
          if (node.children.length > 100) return [];

          const results: TreeNode[] = [];
          const componentInfo = getReactInfo(node) ?? getVueInfo(node);

          if (componentInfo) {
            const children: TreeNode[] = [];
            for (const child of Array.from(node.children)) {
              children.push(...walk(child, currentDepth + 1));
            }
            results.push({
              name: componentInfo.name,
              framework: componentInfo.framework,
              sourceFile: componentInfo.sourceFile,
              props: componentInfo.props,
              children,
              depth: currentDepth,
            });
          } else {
            for (const child of Array.from(node.children)) {
              results.push(...walk(child, currentDepth + 1));
            }
          }

          return results;
        }

        return walk(root, 0);
      },
      { sel: selector, depth: maxDepth },
    );

    return tree;
  }
}

export const elementInspector = new ElementInspector();
