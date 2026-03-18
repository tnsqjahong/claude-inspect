import { execSync, exec } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { OVERLAY_STYLES } from './overlay-styles.js';
import { OVERLAY_SCRIPT } from './overlay-script.js';
class OverlayManager {
    isActive = false;
    lastSelected = null;
    pendingResolve = null;
    pendingReject = null;
    exposedFunctions = new Set();
    pageLoadHandler = null;
    async start(page) {
        if (!this.exposedFunctions.has('__claudeBrowser_onElementSelected')) {
            await page.exposeFunction('__claudeBrowser_onElementSelected', (dataJson) => {
                try {
                    const data = JSON.parse(dataJson);
                    this.lastSelected = data;
                    if (this.pendingResolve) {
                        const resolve = this.pendingResolve;
                        this.pendingResolve = null;
                        this.pendingReject = null;
                        resolve(data);
                    }
                }
                catch {
                    // ignore parse errors
                }
            });
            this.exposedFunctions.add('__claudeBrowser_onElementSelected');
        }
        if (!this.exposedFunctions.has('__claudeBrowser_onSelectionCancelled')) {
            await page.exposeFunction('__claudeBrowser_onSelectionCancelled', () => {
                if (this.pendingReject) {
                    const reject = this.pendingReject;
                    this.pendingResolve = null;
                    this.pendingReject = null;
                    reject(new Error('Selection cancelled by user'));
                }
            });
            this.exposedFunctions.add('__claudeBrowser_onSelectionCancelled');
        }
        // Send to Claude Code: save full info to file, type short reference into terminal
        if (!this.exposedFunctions.has('__claudeBrowser_sendToClaudeCode')) {
            let selectionCounter = 0;
            // Detect terminal app once
            const termProgram = process.env.TERM_PROGRAM || '';
            let appName = '';
            if (termProgram.includes('iTerm'))
                appName = 'iTerm2';
            else if (termProgram === 'Apple_Terminal')
                appName = 'Terminal';
            else if (termProgram.includes('Warp'))
                appName = 'Warp';
            else if (termProgram.includes('vscode'))
                appName = 'Visual Studio Code';
            else
                appName = 'iTerm2';
            await page.exposeFunction('__claudeBrowser_sendToClaudeCode', (fullText, componentName) => {
                try {
                    selectionCounter++;
                    // Save full info to file
                    const dir = join(process.cwd(), '.claude-browser', 'selections');
                    mkdirSync(dir, { recursive: true });
                    writeFileSync(join(dir, `${selectionCounter}.txt`), fullText, 'utf-8');
                    // Type short reference into terminal
                    const shortRef = `[Component #${selectionCounter}: <${componentName}>]`;
                    if (process.platform === 'darwin') {
                        const escaped = shortRef.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                        if (appName === 'iTerm2') {
                            // iTerm2: direct write text (instant, no paste dialog)
                            exec(`osascript -e 'tell application "iTerm2" to tell current session of current window to write text "${escaped}" newline no'`);
                        }
                        else {
                            // Terminal.app / others: pbcopy + keystroke fallback
                            execSync('pbcopy', { input: shortRef });
                            exec(`osascript -e 'tell application "${appName}" to activate' -e 'delay 0.5' -e 'tell application "System Events" to keystroke (do shell script "pbpaste")'`);
                        }
                    }
                    else if (process.platform === 'linux') {
                        // Linux: xdotool type (simulates keyboard input)
                        const escaped = shortRef.replace(/'/g, "'\\''");
                        exec(`xdotool type --delay 0 '${escaped}'`);
                    }
                    else if (process.platform === 'win32') {
                        // Windows: PowerShell SendKeys
                        const escaped = shortRef.replace(/'/g, "''");
                        exec(`powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escaped}')"`);
                    }
                    return selectionCounter;
                }
                catch {
                    return 0;
                }
            });
            this.exposedFunctions.add('__claudeBrowser_sendToClaudeCode');
        }
        await this.injectOverlay(page);
        this.isActive = true;
        this.pageLoadHandler = async () => {
            if (this.isActive) {
                await this.injectOverlay(page);
            }
        };
        page.on('load', this.pageLoadHandler);
    }
    async injectOverlay(page) {
        await page.addStyleTag({ content: OVERLAY_STYLES });
        await page.evaluate(OVERLAY_SCRIPT);
    }
    getSelectedElement() {
        return this.lastSelected;
    }
    async waitForSelection(timeout = 30000) {
        return new Promise((resolve, reject) => {
            this.pendingResolve = resolve;
            this.pendingReject = reject;
            setTimeout(() => {
                if (this.pendingReject === reject) {
                    this.pendingResolve = null;
                    this.pendingReject = null;
                    reject(new Error('Selection timed out'));
                }
            }, timeout);
        });
    }
    async stop(page) {
        if (this.pageLoadHandler) {
            page.off('load', this.pageLoadHandler);
            this.pageLoadHandler = null;
        }
        try {
            await page.evaluate(() => {
                const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
                document.dispatchEvent(event);
            });
        }
        catch {
            // Page may be closed or navigating; ignore errors
        }
        this.isActive = false;
        if (this.pendingReject) {
            const reject = this.pendingReject;
            this.pendingResolve = null;
            this.pendingReject = null;
            reject(new Error('Overlay stopped'));
        }
    }
    isSelectionActive() {
        return this.isActive;
    }
}
export const overlayManager = new OverlayManager();
//# sourceMappingURL=overlay-manager.js.map