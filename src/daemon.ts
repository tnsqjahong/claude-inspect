#!/usr/bin/env node

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { browserManager } from './browser/manager.js';
import { overlayManager } from './overlay/overlay-manager.js';
import { elementInspector } from './inspector/element-inspector.js';
import { sourceMapper } from './inspector/source-mapper.js';
import { consoleMonitor } from './monitor/console-monitor.js';
import { networkMonitor } from './monitor/network-monitor.js';
import { performanceMonitor } from './monitor/performance-monitor.js';

const SESSION_DIR = join(process.cwd(), '.claude-browser');
const SESSION_FILE = join(SESSION_DIR, 'session.json');

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

type RouteHandler = (body: Record<string, unknown>, res: ServerResponse) => Promise<void>;

const routes: Record<string, RouteHandler> = {
  '/launch': async (body, res) => {
    const url = body.url as string | undefined;
    const headless = body.headless as boolean | undefined;

    await browserManager.launch({ url, headless });
    const page = browserManager.getPage();

    consoleMonitor.attach(page);
    networkMonitor.attach(page);
    await performanceMonitor.injectObservers(page);

    if (!headless) {
      await page.waitForLoadState('load').catch(() => {});
      await overlayManager.start(page);
    }

    // Exit daemon when browser window is closed by user
    const browser = page.context().browser();
    if (browser) {
      browser.on('disconnected', () => {
        try { rmSync(SESSION_FILE, { force: true }); } catch {}
        setTimeout(() => process.exit(0), 100);
      });
    }

    const msg = url ? `Browser launched and navigated to ${url}` : 'Browser launched';
    json(res, 200, { message: msg, url });
  },

  '/navigate': async (body, res) => {
    const url = body.url as string;
    if (!url) { json(res, 400, { error: 'url required' }); return; }
    await browserManager.navigate(url);
    const page = browserManager.getPage();
    await performanceMonitor.injectObservers(page);
    json(res, 200, { message: `Navigated to ${url}` });
  },

  '/screenshot': async (body, res) => {
    const fullPage = body.fullPage as boolean | undefined;
    const result = await browserManager.screenshot({ fullPage });
    json(res, 200, {
      base64: result.base64,
      width: result.width,
      height: result.height,
    });
  },

  '/close': async (_body, res) => {
    await browserManager.close();
    json(res, 200, { message: 'Browser closed' });
    // Clean up session file and exit
    try { rmSync(SESSION_FILE, { force: true }); } catch {}
    setTimeout(() => process.exit(0), 100);
  },

  '/inspect': async (body, res) => {
    const selector = body.selector as string;
    if (!selector) { json(res, 400, { error: 'selector required' }); return; }
    const page = browserManager.getPage();
    const result = await elementInspector.inspectElement(page, selector);
    json(res, 200, result);
  },

  '/select/start': async (_body, res) => {
    const page = browserManager.getPage();
    await overlayManager.start(page);
    json(res, 200, { message: 'Element selection mode started' });
  },

  '/select/wait': async (body, res) => {
    const timeout = (body.timeout as number) ?? 30000;
    try {
      const data = await overlayManager.waitForSelection(timeout);
      json(res, 200, data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Selection failed';
      json(res, 408, { error: `Selection cancelled or timed out: ${message}` });
    }
  },

  '/select/stop': async (_body, res) => {
    const page = browserManager.getPage();
    await overlayManager.stop(page);
    json(res, 200, { message: 'Element selection mode stopped' });
  },

  '/logs': async (body, res) => {
    const type = body.type as 'error' | 'warn' | 'all' | undefined;
    const limit = body.limit as number | undefined;
    const logs = consoleMonitor.getLogs({ type, limit });
    json(res, 200, { count: logs.length, logs });
  },

  '/network': async (body, res) => {
    const failedOnly = body.failedOnly as boolean | undefined;
    const limit = body.limit as number | undefined;
    const requests = networkMonitor.getRequests({ failedOnly, limit });
    const summary = networkMonitor.getSummary();
    json(res, 200, { summary, requests });
  },

  '/perf': async (_body, res) => {
    const page = browserManager.getPage();
    const metrics = await performanceMonitor.getMetrics(page);
    json(res, 200, metrics);
  },

  '/components': async (body, res) => {
    const selector = body.selector as string | undefined;
    const page = browserManager.getPage();
    const tree = await elementInspector.getComponentTree(page, selector);
    if (tree.length === 0) {
      json(res, 200, { message: 'No framework components detected.', tree: [] });
      return;
    }
    json(res, 200, { tree });
  },

  '/find-component': async (body, res) => {
    const componentName = body.componentName as string;
    const projectRoot = (body.projectRoot as string) ?? process.cwd();
    if (!componentName) { json(res, 400, { error: 'componentName required' }); return; }
    const location = await sourceMapper.findComponentSource(componentName, projectRoot);
    if (!location) {
      json(res, 404, { error: `Component "${componentName}" not found in ${projectRoot}` });
      return;
    }
    json(res, 200, location);
  },
};

// ── Start server ──────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  // GET /status — health check
  if (req.method === 'GET' && req.url === '/status') {
    const running = browserManager.isRunning();
    const currentUrl = running ? browserManager.getCurrentUrl() : null;
    json(res, 200, { running, currentUrl, pid: process.pid });
    return;
  }

  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method not allowed' });
    return;
  }

  const handler = routes[req.url ?? ''];
  if (!handler) {
    json(res, 404, { error: `Unknown route: ${req.url}` });
    return;
  }

  try {
    const body = await readBody(req);
    await handler(body, res);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    json(res, 500, { error: message });
  }
});

server.listen(0, '127.0.0.1', () => {
  const addr = server.address();
  if (!addr || typeof addr === 'string') {
    process.exit(1);
  }

  const port = addr.port;

  mkdirSync(SESSION_DIR, { recursive: true });
  writeFileSync(SESSION_FILE, JSON.stringify({ port, pid: process.pid, startedAt: new Date().toISOString() }) + '\n');

  // Signal to parent process that we're ready
  process.stdout.write(JSON.stringify({ port, pid: process.pid }) + '\n');
});

// Cleanup on exit
async function cleanup(): Promise<void> {
  if (browserManager.isRunning()) {
    await browserManager.close();
  }
  try { rmSync(SESSION_FILE, { force: true }); } catch {}
}

process.on('SIGINT', async () => { await cleanup(); process.exit(0); });
process.on('SIGTERM', async () => { await cleanup(); process.exit(0); });
