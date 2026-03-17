import type { Page } from 'playwright';
import { execSync, exec } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { OVERLAY_STYLES } from './overlay-styles.js';
import { OVERLAY_SCRIPT } from './overlay-script.js';

export interface SelectedElementData {
  tagName: string;
  id: string;
  classes: string[];
  attributes: Record<string, string>;
  selector: string;
  styles: Record<string, string>;
  boundingRect: { x: number; y: number; width: number; height: number };
  textContent: string;
  component: {
    framework: string;
    componentName: string;
    sourceFile: string | null;
    lineNumber: number | null;
    columnNumber: number | null;
    props: Record<string, unknown>;
  } | null;
  componentHierarchy: Array<{
    componentName: string;
    framework: string;
    sourceFile: string | null;
  }>;
  formattedText?: string;
}

class OverlayManager {
  private isActive = false;
  private lastSelected: SelectedElementData | null = null;
  private pendingResolve: ((data: SelectedElementData) => void) | null = null;
  private pendingReject: ((reason: unknown) => void) | null = null;
  private exposedFunctions = new Set<string>();
  private pageLoadHandler: (() => Promise<void>) | null = null;
  private selectionCounter = 0;
  private appName = '';

  private detectTerminal(): void {
    const termProgram = process.env.TERM_PROGRAM || '';
    if (termProgram.includes('iTerm')) this.appName = 'iTerm2';
    else if (termProgram === 'Apple_Terminal') this.appName = 'Terminal';
    else if (termProgram.includes('Warp')) this.appName = 'Warp';
    else if (termProgram.includes('vscode')) this.appName = 'Visual Studio Code';
    else if (termProgram.toLowerCase().includes('ghostty')) this.appName = 'Ghostty';
    else this.appName = 'iTerm2';
  }

  private typeIntoTerminal(text: string): void {
    if (process.platform === 'darwin') {
      const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

      if (this.appName === 'iTerm2') {
        exec(`osascript -e 'tell application "iTerm2" to tell current session of current window to write text "${escaped}" newline no'`);
      } else if (this.appName === 'Ghostty') {
        execSync('pbcopy', { input: text });
        exec(`osascript -e 'tell application "Ghostty" to activate' -e 'delay 0.3' -e 'tell application "System Events" to keystroke "v" using command down'`);
      } else {
        execSync('pbcopy', { input: text });
        exec(`osascript -e 'tell application "${this.appName}" to activate' -e 'delay 0.5' -e 'tell application "System Events" to keystroke (do shell script "pbpaste")'`);
      }
    } else if (process.platform === 'linux') {
      const escaped = text.replace(/'/g, "'\\''");
      exec(`xdotool type --delay 0 '${escaped}'`);
    } else if (process.platform === 'win32') {
      const escaped = text.replace(/'/g, "''");
      exec(`powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escaped}')"`);
    }
  }

  async start(page: Page): Promise<void> {
    this.detectTerminal();

    if (!this.exposedFunctions.has('__claudeBrowser_onElementSelected')) {
      await page.exposeFunction('__claudeBrowser_onElementSelected', (dataJson: string) => {
        try {
          const data = JSON.parse(dataJson) as SelectedElementData;
          this.lastSelected = data;
          if (this.pendingResolve) {
            const resolve = this.pendingResolve;
            this.pendingResolve = null;
            this.pendingReject = null;
            resolve(data);
          }
        } catch {
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

    // Send element to Claude Code
    if (!this.exposedFunctions.has('__claudeBrowser_sendToClaudeCode')) {
      await page.exposeFunction('__claudeBrowser_sendToClaudeCode', (fullText: string, componentName: string) => {
        try {
          this.selectionCounter++;
          const dir = join(process.cwd(), '.claude-browser', 'selections');
          mkdirSync(dir, { recursive: true });
          writeFileSync(join(dir, `${this.selectionCounter}.txt`), fullText, 'utf-8');

          const shortRef = `[Component #${this.selectionCounter}: <${componentName}>]`;
          this.typeIntoTerminal(shortRef);
          return this.selectionCounter;
        } catch {
          return 0;
        }
      });
      this.exposedFunctions.add('__claudeBrowser_sendToClaudeCode');
    }

    // Capture region screenshot and send to Claude Code
    if (!this.exposedFunctions.has('__claudeBrowser_captureRegion')) {
      await page.exposeFunction('__claudeBrowser_captureRegion', async (x: number, y: number, width: number, height: number) => {
        try {
          // Hide overlay elements before capturing
          await page.evaluate(() => {
            document.querySelectorAll('[class^="__cb-"]').forEach((el) => {
              (el as HTMLElement).style.visibility = 'hidden';
            });
          });

          await new Promise(r => setTimeout(r, 50));

          const buffer = await page.screenshot({
            type: 'png',
            clip: { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) },
          });

          // Restore overlay elements
          await page.evaluate(() => {
            document.querySelectorAll('[class^="__cb-"]').forEach((el) => {
              (el as HTMLElement).style.visibility = '';
            });
          });

          this.selectionCounter++;
          const dir = join('/tmp', '.claude-browser', String(process.pid), 'screenshots');
          mkdirSync(dir, { recursive: true });
          const filePath = join(dir, `${this.selectionCounter}.png`);
          writeFileSync(filePath, buffer);

          const shortRef = `[Screenshot #${this.selectionCounter}: ${Math.round(width)}x${Math.round(height)} → ${filePath}]`;
          this.typeIntoTerminal(shortRef);
          return this.selectionCounter;
        } catch {
          return 0;
        }
      });
      this.exposedFunctions.add('__claudeBrowser_captureRegion');
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

  private async injectOverlay(page: Page): Promise<void> {
    await page.addStyleTag({ content: OVERLAY_STYLES });
    await page.evaluate(OVERLAY_SCRIPT);
  }

  getSelectedElement(): SelectedElementData | null {
    return this.lastSelected;
  }

  async waitForSelection(timeout = 30000): Promise<SelectedElementData> {
    return new Promise<SelectedElementData>((resolve, reject) => {
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

  async stop(page: Page): Promise<void> {
    if (this.pageLoadHandler) {
      page.off('load', this.pageLoadHandler);
      this.pageLoadHandler = null;
    }

    try {
      await page.evaluate(() => {
        if ((window as any).__claudeBrowser_fullCleanup) {
          (window as any).__claudeBrowser_fullCleanup();
        }
      });
    } catch {
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

  isSelectionActive(): boolean {
    return this.isActive;
  }
}

export const overlayManager = new OverlayManager();
