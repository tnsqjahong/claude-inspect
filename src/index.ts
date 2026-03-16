#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools, registerPrompts } from './server.js';
import { browserManager } from './browser/manager.js';

const server = new McpServer({
  name: 'claude-browser',
  version: '1.0.0',
});

registerTools(server);
registerPrompts(server);

async function cleanup(): Promise<void> {
  if (browserManager.isRunning()) {
    await browserManager.close();
  }
}

process.on('SIGINT', async () => {
  await cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await cleanup();
  process.exit(0);
});

const transport = new StdioServerTransport();
await server.connect(transport);
