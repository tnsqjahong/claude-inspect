#!/usr/bin/env node
import { spawn, execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { request as httpRequest } from 'node:http';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PACKAGE_ROOT = join(__dirname, '..');
const SESSION_DIR = join(process.cwd(), '.claude-browser');
const SESSION_FILE = join(SESSION_DIR, 'session.json');
// ── Output directories ────────────────────────────────────────────────
const DIRS = {
    screenshots: join(SESSION_DIR, 'screenshots'),
    logs: join(SESSION_DIR, 'logs'),
    network: join(SESSION_DIR, 'network'),
    perf: join(SESSION_DIR, 'perf'),
    inspections: join(SESSION_DIR, 'inspections'),
    components: join(SESSION_DIR, 'components'),
    selections: join(SESSION_DIR, 'selections'),
};
function ensureDir(dir) {
    mkdirSync(dir, { recursive: true });
}
function readSession() {
    if (!existsSync(SESSION_FILE)) {
        console.error('No active browser session. Run "claude-browser launch <url>" first.');
        process.exit(1);
    }
    return JSON.parse(readFileSync(SESSION_FILE, 'utf-8'));
}
// ── HTTP client ───────────────────────────────────────────────────────
function post(port, path, body = {}) {
    const payload = JSON.stringify(body);
    return new Promise((resolve, reject) => {
        const req = httpRequest({
            hostname: '127.0.0.1',
            port,
            path,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        }, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
                const raw = Buffer.concat(chunks).toString();
                try {
                    resolve({ status: res.statusCode ?? 500, data: JSON.parse(raw) });
                }
                catch {
                    resolve({ status: res.statusCode ?? 500, data: { raw } });
                }
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}
function get(port, path) {
    return new Promise((resolve, reject) => {
        const req = httpRequest({ hostname: '127.0.0.1', port, path, method: 'GET' }, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
                const raw = Buffer.concat(chunks).toString();
                try {
                    resolve({ status: res.statusCode ?? 500, data: JSON.parse(raw) });
                }
                catch {
                    resolve({ status: res.statusCode ?? 500, data: { raw } });
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}
// ── Timestamp helper ──────────────────────────────────────────────────
function ts() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}
// ── Dependency check ──────────────────────────────────────────────────
function ensureDependencies() {
    const nodeModules = join(PACKAGE_ROOT, 'node_modules');
    if (!existsSync(join(nodeModules, 'playwright'))) {
        console.error('Installing dependencies...');
        execSync('npm install --ignore-scripts', { cwd: PACKAGE_ROOT, stdio: 'inherit' });
    }
}
// ── Daemon launcher ───────────────────────────────────────────────────
async function launchDaemon() {
    const daemonScript = join(__dirname, 'daemon.js');
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [daemonScript], {
            cwd: process.cwd(),
            detached: true,
            stdio: ['ignore', 'pipe', 'ignore'],
        });
        let output = '';
        const timeout = setTimeout(() => {
            child.kill();
            reject(new Error('Daemon startup timed out'));
        }, 15000);
        child.stdout.on('data', (chunk) => {
            output += chunk.toString();
            const lines = output.split('\n');
            for (const line of lines) {
                if (!line.trim())
                    continue;
                try {
                    const info = JSON.parse(line);
                    if (info.port) {
                        clearTimeout(timeout);
                        child.stdout.removeAllListeners();
                        child.stdout.destroy();
                        child.unref();
                        resolve({ port: info.port, pid: info.pid, startedAt: new Date().toISOString() });
                        return;
                    }
                }
                catch {
                    // not JSON yet, keep buffering
                }
            }
        });
        child.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
        child.on('exit', (code) => {
            clearTimeout(timeout);
            if (code !== 0)
                reject(new Error(`Daemon exited with code ${code}`));
        });
    });
}
// ── Command handlers ──────────────────────────────────────────────────
async function cmdLaunch(args) {
    const url = args.find((a) => !a.startsWith('--'));
    const headless = args.includes('--headless');
    // Kill existing session if any
    if (existsSync(SESSION_FILE)) {
        try {
            const old = JSON.parse(readFileSync(SESSION_FILE, 'utf-8'));
            process.kill(old.pid, 'SIGTERM');
        }
        catch { }
    }
    ensureDependencies();
    const session = await launchDaemon();
    const { data } = await post(session.port, '/launch', { url, headless });
    console.log(data.message || 'Browser launched');
}
async function cmdNavigate(args) {
    const url = args[0];
    if (!url) {
        console.error('Usage: claude-browser navigate <url>');
        process.exit(1);
    }
    const session = readSession();
    const { data } = await post(session.port, '/navigate', { url });
    console.log(data.message);
}
async function cmdScreenshot(args) {
    const fullPage = args.includes('--fullpage');
    const session = readSession();
    const { data } = await post(session.port, '/screenshot', { fullPage });
    const d = data;
    ensureDir(DIRS.screenshots);
    const file = join(DIRS.screenshots, `${ts()}.png`);
    writeFileSync(file, Buffer.from(d.base64, 'base64'));
    console.log(`Screenshot saved: ${file} (${d.width}x${d.height})`);
}
async function cmdClose() {
    const session = readSession();
    try {
        await post(session.port, '/close');
    }
    catch {
        // daemon may exit before responding
    }
    console.log('Browser closed');
}
async function cmdInspect(args) {
    const selector = args[0];
    if (!selector) {
        console.error('Usage: claude-browser inspect <selector>');
        process.exit(1);
    }
    const session = readSession();
    const { status, data } = await post(session.port, '/inspect', { selector });
    if (status >= 400) {
        console.error(data.error);
        process.exit(1);
    }
    ensureDir(DIRS.inspections);
    const file = join(DIRS.inspections, `${ts()}.json`);
    writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
    console.log(`Inspection saved: ${file}`);
}
async function cmdSelectStart() {
    const session = readSession();
    const { data } = await post(session.port, '/select/start');
    console.log(data.message);
}
async function cmdSelectWait(args) {
    const timeoutArg = args.find((a) => a.startsWith('--timeout='));
    const timeout = timeoutArg ? parseInt(timeoutArg.split('=')[1], 10) : 30000;
    const session = readSession();
    const { status, data } = await post(session.port, '/select/wait', { timeout });
    if (status >= 400) {
        console.error(data.error);
        process.exit(1);
    }
    ensureDir(DIRS.selections);
    const file = join(DIRS.selections, `${ts()}.json`);
    writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
    console.log(`Selection saved: ${file}`);
}
async function cmdSelectStop() {
    const session = readSession();
    const { data } = await post(session.port, '/select/stop');
    console.log(data.message);
}
async function cmdLogs(args) {
    const typeArg = args.find((a) => a.startsWith('--type='));
    const type = typeArg ? typeArg.split('=')[1] : undefined;
    const limitArg = args.find((a) => a.startsWith('--limit='));
    const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;
    const session = readSession();
    const { data } = await post(session.port, '/logs', { type, limit });
    const d = data;
    ensureDir(DIRS.logs);
    const file = join(DIRS.logs, `${ts()}.json`);
    writeFileSync(file, JSON.stringify(d.logs, null, 2) + '\n');
    console.log(`${d.count} log(s) saved: ${file}`);
}
async function cmdNetwork(args) {
    const failedOnly = args.includes('--failed');
    const limitArg = args.find((a) => a.startsWith('--limit='));
    const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;
    const session = readSession();
    const { data } = await post(session.port, '/network', { failedOnly, limit });
    ensureDir(DIRS.network);
    const file = join(DIRS.network, `${ts()}.json`);
    writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
    const d = data;
    console.log(`Network data saved: ${file} (${d.summary?.total ?? 0} requests)`);
}
async function cmdPerf() {
    const session = readSession();
    const { data } = await post(session.port, '/perf');
    ensureDir(DIRS.perf);
    const file = join(DIRS.perf, `${ts()}.json`);
    writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
    console.log(`Performance metrics saved: ${file}`);
}
async function cmdComponents(args) {
    const selectorArg = args.find((a) => a.startsWith('--selector='));
    const selector = selectorArg ? selectorArg.split('=')[1] : undefined;
    const session = readSession();
    const { data } = await post(session.port, '/components', { selector });
    ensureDir(DIRS.components);
    const file = join(DIRS.components, `${ts()}.json`);
    writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
    const d = data;
    if (d.message) {
        console.log(d.message);
    }
    else {
        console.log(`Component tree saved: ${file} (${d.tree?.length ?? 0} components)`);
    }
}
async function cmdFindComponent(args) {
    const name = args.find((a) => !a.startsWith('--'));
    if (!name) {
        console.error('Usage: claude-browser find-component <name>');
        process.exit(1);
    }
    const rootArg = args.find((a) => a.startsWith('--root='));
    const projectRoot = rootArg ? rootArg.split('=')[1] : undefined;
    const session = readSession();
    const { status, data } = await post(session.port, '/find-component', { componentName: name, projectRoot });
    if (status >= 400) {
        console.error(data.error);
        process.exit(1);
    }
    ensureDir(DIRS.components);
    const file = join(DIRS.components, `${name}-source.json`);
    writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
    console.log(`Source found: ${file}`);
}
async function cmdStatus() {
    const session = readSession();
    try {
        const { data } = await get(session.port, '/status');
        const d = data;
        console.log(`Browser: ${d.running ? 'running' : 'stopped'}`);
        if (d.currentUrl)
            console.log(`URL: ${d.currentUrl}`);
        console.log(`Daemon PID: ${d.pid}`);
    }
    catch {
        console.error('Daemon not responding. Session may be stale.');
        process.exit(1);
    }
}
// ── Main ──────────────────────────────────────────────────────────────
const [command, ...args] = process.argv.slice(2);
const commands = {
    launch: cmdLaunch,
    navigate: cmdNavigate,
    screenshot: cmdScreenshot,
    close: () => cmdClose(),
    inspect: cmdInspect,
    select: async (a) => {
        const sub = a[0];
        const rest = a.slice(1);
        if (sub === 'start')
            return cmdSelectStart();
        if (sub === 'wait')
            return cmdSelectWait(rest);
        if (sub === 'stop')
            return cmdSelectStop();
        console.error('Usage: claude-browser select <start|wait|stop>');
        process.exit(1);
    },
    logs: cmdLogs,
    network: cmdNetwork,
    perf: () => cmdPerf(),
    components: cmdComponents,
    'find-component': cmdFindComponent,
    status: () => cmdStatus(),
};
if (!command || command === '--help' || command === '-h') {
    console.log(`claude-browser - Browser automation CLI for Claude Code

Usage:
  claude-browser launch <url> [--headless]     Launch browser and navigate
  claude-browser navigate <url>                Navigate to URL
  claude-browser screenshot [--fullpage]       Take screenshot
  claude-browser close                         Close browser and daemon
  claude-browser inspect <selector>            Inspect element by CSS selector
  claude-browser select start                  Start visual element selection
  claude-browser select wait [--timeout=N]     Wait for user selection
  claude-browser select stop                   Stop element selection
  claude-browser logs [--type=error|warn|all] [--limit=N]
  claude-browser network [--failed] [--limit=N]
  claude-browser perf                          Get Core Web Vitals
  claude-browser components [--selector=<sel>] Get component tree
  claude-browser find-component <name> [--root=<path>]
  claude-browser status                        Check daemon/browser status`);
    process.exit(0);
}
const handler = commands[command];
if (!handler) {
    console.error(`Unknown command: ${command}. Run "claude-browser --help" for usage.`);
    process.exit(1);
}
handler(args).catch((err) => {
    console.error(err.message || err);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map