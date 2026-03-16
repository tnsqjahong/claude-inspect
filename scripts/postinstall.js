#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, '..');

// Install Playwright Chromium
try {
  execSync('npx playwright install chromium', { cwd: packageRoot, stdio: 'inherit' });
} catch {
  console.warn('⚠ Failed to install Chromium. Run "npx playwright install chromium" manually.');
}

// Find project root (where npm install was run)
const projectRoot = process.env.INIT_CWD || process.cwd();

// Don't modify .mcp.json if installing in the package itself
if (projectRoot === packageRoot) process.exit(0);

const mcpPath = join(projectRoot, '.mcp.json');
const modulePath = join(projectRoot, 'node_modules', 'claude-browser', 'dist', 'index.js');

let config = { mcpServers: {} };

if (existsSync(mcpPath)) {
  try {
    config = JSON.parse(readFileSync(mcpPath, 'utf-8'));
    if (!config.mcpServers) config.mcpServers = {};
  } catch {
    // corrupted file, start fresh
    config = { mcpServers: {} };
  }
}

// Add claude-browser if not already configured
if (!config.mcpServers['claude-browser']) {
  config.mcpServers['claude-browser'] = {
    command: 'node',
    args: [modulePath],
  };

  writeFileSync(mcpPath, JSON.stringify(config, null, 2) + '\n');
  console.log('✓ claude-browser added to .mcp.json');
  console.log('  Restart Claude Code or run /mcp to connect.');
} else {
  console.log('✓ claude-browser already configured in .mcp.json');
}
