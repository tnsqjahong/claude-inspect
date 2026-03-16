import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { browserManager } from './browser/manager.js';
import { overlayManager } from './overlay/overlay-manager.js';
import { elementInspector } from './inspector/element-inspector.js';
import { sourceMapper } from './inspector/source-mapper.js';
import { consoleMonitor } from './monitor/console-monitor.js';
import { networkMonitor } from './monitor/network-monitor.js';
import { performanceMonitor } from './monitor/performance-monitor.js';

export function registerPrompts(server: McpServer): void {
  server.prompt(
    'inspect',
    'Open a browser and start visual element inspection mode',
    { url: z.string().describe('URL to inspect (e.g. http://localhost:3000)') },
    ({ url }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Launch the browser at ${url} and start element selection mode so I can inspect components. Use browser_launch with the URL, then start_element_selection. When I click "→ Claude Code" on an element, read the component info from .claude-browser/selections/ directory.`,
          },
        },
      ],
    }),
  );
}

export function registerTools(server: McpServer): void {
  // ── Browser Lifecycle ──────────────────────────────────────────────

  server.tool(
    'browser_launch',
    'Launch a Chromium browser. Optionally navigate to a URL.',
    { url: z.string().optional(), headless: z.boolean().optional() },
    async ({ url, headless }) => {
      await browserManager.launch({ url, headless });
      const page = browserManager.getPage();

      // Attach monitors
      consoleMonitor.attach(page);
      networkMonitor.attach(page);
      await performanceMonitor.injectObservers(page);

      const msg = url ? `Browser launched and navigated to ${url}` : 'Browser launched';
      return { content: [{ type: 'text', text: msg }] };
    },
  );

  server.tool(
    'browser_navigate',
    'Navigate the browser to a URL.',
    { url: z.string() },
    async ({ url }) => {
      await browserManager.navigate(url);
      const page = browserManager.getPage();
      await performanceMonitor.injectObservers(page);
      return { content: [{ type: 'text', text: `Navigated to ${url}` }] };
    },
  );

  server.tool(
    'browser_screenshot',
    'Take a screenshot of the current page. Returns a base64-encoded PNG image.',
    { fullPage: z.boolean().optional() },
    async ({ fullPage }) => {
      const result = await browserManager.screenshot({ fullPage });
      return {
        content: [
          {
            type: 'image',
            data: result.base64,
            mimeType: 'image/png',
          },
          {
            type: 'text',
            text: `Screenshot taken (${result.width}x${result.height})`,
          },
        ],
      };
    },
  );

  server.tool(
    'browser_close',
    'Close the browser.',
    {},
    async () => {
      await browserManager.close();
      return { content: [{ type: 'text', text: 'Browser closed' }] };
    },
  );

  // ── Element Selection ──────────────────────────────────────────────

  server.tool(
    'start_element_selection',
    'Start visual element selection mode. The user can hover and click elements in the browser. Use get_selected_element to retrieve the result after the user clicks.',
    {},
    async () => {
      const page = browserManager.getPage();
      await overlayManager.start(page);
      return {
        content: [
          {
            type: 'text',
            text: 'Element selection mode started. The user can now click on elements in the browser.\nUse get_selected_element to retrieve the selected element info.\nThe user can press ESC to cancel.',
          },
        ],
      };
    },
  );

  server.tool(
    'get_selected_element',
    'Get information about the element the user selected in the browser. Waits up to 30 seconds for a selection. Returns DOM info, styles, component name, source file, and props.',
    { timeout: z.number().optional() },
    async ({ timeout }) => {
      try {
        const data = await overlayManager.waitForSelection(timeout ?? 30000);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Selection failed';
        return {
          content: [{ type: 'text', text: `Selection cancelled or timed out: ${message}` }],
        };
      }
    },
  );

  server.tool(
    'stop_element_selection',
    'Stop visual element selection mode and remove the overlay.',
    {},
    async () => {
      const page = browserManager.getPage();
      await overlayManager.stop(page);
      return { content: [{ type: 'text', text: 'Element selection mode stopped' }] };
    },
  );

  server.tool(
    'inspect_element',
    'Inspect an element by CSS selector. Returns DOM info, computed styles, and detected framework component.',
    { selector: z.string() },
    async ({ selector }) => {
      const page = browserManager.getPage();
      const result = await elementInspector.inspectElement(page, selector);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );

  // ── Monitoring ─────────────────────────────────────────────────────

  server.tool(
    'get_console_logs',
    'Get captured console logs from the browser. Filter by type (error, warn, all).',
    {
      type: z.enum(['error', 'warn', 'all']).optional(),
      limit: z.number().optional(),
    },
    async ({ type, limit }) => {
      const logs = consoleMonitor.getLogs({ type, limit });
      if (logs.length === 0) {
        return { content: [{ type: 'text', text: 'No console logs captured.' }] };
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(logs, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    'get_network_requests',
    'Get captured network requests. Optionally filter to failed requests only.',
    {
      failedOnly: z.boolean().optional(),
      limit: z.number().optional(),
    },
    async ({ failedOnly, limit }) => {
      const requests = networkMonitor.getRequests({ failedOnly, limit });
      const summary = networkMonitor.getSummary();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ summary, requests }, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    'get_performance_metrics',
    'Get Core Web Vitals and performance metrics (LCP, FCP, CLS, INP, load times, resource summary).',
    {},
    async () => {
      const page = browserManager.getPage();
      const metrics = await performanceMonitor.getMetrics(page);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(metrics, null, 2),
          },
        ],
      };
    },
  );

  // ── Component Analysis ─────────────────────────────────────────────

  server.tool(
    'get_component_tree',
    'Get the framework component tree (React/Vue) for the page or a specific element.',
    { selector: z.string().optional() },
    async ({ selector }) => {
      const page = browserManager.getPage();
      const tree = await elementInspector.getComponentTree(page, selector);
      if (tree.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No framework components detected. Make sure the page uses React or Vue in development mode.',
            },
          ],
        };
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(tree, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    'find_component_source',
    'Search for a component source file in the project by component name.',
    {
      componentName: z.string(),
      projectRoot: z.string().optional(),
    },
    async ({ componentName, projectRoot }) => {
      const root = projectRoot ?? process.cwd();
      const location = await sourceMapper.findComponentSource(componentName, root);
      if (!location) {
        return {
          content: [
            {
              type: 'text',
              text: `Component "${componentName}" source file not found in ${root}`,
            },
          ],
        };
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(location, null, 2),
          },
        ],
      };
    },
  );
}
