import { chromium } from 'playwright';
import type { Browser, BrowserContext, Page } from 'playwright';
import type { BrowserState, LaunchOptions, ScreenshotOptions, ScreenshotResult } from './types.js';

class BrowserManager {
  private static instance: BrowserManager;
  private state: BrowserState = {
    browser: null,
    context: null,
    page: null,
    isRunning: false,
  };

  private constructor() {}

  static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager();
    }
    return BrowserManager.instance;
  }

  async launch(options: LaunchOptions = {}): Promise<void> {
    if (this.state.isRunning) {
      await this.close();
    }

    const browser: Browser = await chromium.launch({ headless: options.headless ?? false });

    const context: BrowserContext = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });

    const page: Page = await context.newPage();

    if (options.url) {
      await page.goto(options.url, { waitUntil: 'domcontentloaded' });
    }

    this.state = {
      browser,
      context,
      page,
      isRunning: true,
    };

    // Clean up state when page or browser closes
    const resetState = () => {
      this.state = { browser: null, context: null, page: null, isRunning: false };
    };
    page.on('close', resetState);
    browser.on('disconnected', resetState);
  }

  async navigate(url: string): Promise<void> {
    const page = this.getPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  async screenshot(options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
    const page = this.getPage();

    const buffer = await page.screenshot({
      type: 'png',
      fullPage: options.fullPage ?? false,
    });

    const viewportSize = page.viewportSize();
    const width = viewportSize?.width ?? 1280;
    const height = viewportSize?.height ?? 720;

    return {
      base64: buffer.toString('base64'),
      width,
      height,
    };
  }

  async close(): Promise<void> {
    if (this.state.browser) {
      await this.state.browser.close();
    }
    this.state = {
      browser: null,
      context: null,
      page: null,
      isRunning: false,
    };
  }

  getPage(): Page {
    if (!this.state.page || !this.state.isRunning) {
      throw new Error('Browser not launched. Use browser_launch first.');
    }
    return this.state.page;
  }

  isRunning(): boolean {
    return this.state.isRunning;
  }

  getCurrentUrl(): string | null {
    if (!this.state.page || !this.state.isRunning) return null;
    return this.state.page.url();
  }

  getState(): BrowserState {
    return { ...this.state };
  }
}

export const browserManager = BrowserManager.getInstance();
