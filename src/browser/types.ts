import type { Browser, BrowserContext, Page } from 'playwright';

export interface BrowserState {
  browser: Browser | null;
  context: BrowserContext | null;
  page: Page | null;
  isRunning: boolean;
}

export interface LaunchOptions {
  url?: string;
  headless?: boolean;
}

export interface ScreenshotOptions {
  fullPage?: boolean;
}

export interface ScreenshotResult {
  base64: string;
  width: number;
  height: number;
}
