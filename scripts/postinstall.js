#!/usr/bin/env node

import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, '..');

// Install Playwright Chromium
try {
  execSync('npx playwright install chromium', { cwd: packageRoot, stdio: 'inherit' });
} catch {
  console.warn('⚠ Failed to install Chromium. Run "npx playwright install chromium" manually.');
}

console.log('✓ claude-inspect installed. Use /inspect to start.');
