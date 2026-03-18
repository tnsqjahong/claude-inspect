import type { Page } from 'playwright';
import type { BrowserState, LaunchOptions, ScreenshotOptions, ScreenshotResult } from './types.js';
declare class BrowserManager {
    private static instance;
    private state;
    private constructor();
    static getInstance(): BrowserManager;
    launch(options?: LaunchOptions): Promise<void>;
    navigate(url: string): Promise<void>;
    screenshot(options?: ScreenshotOptions): Promise<ScreenshotResult>;
    close(): Promise<void>;
    getPage(): Page;
    isRunning(): boolean;
    getCurrentUrl(): string | null;
    getState(): BrowserState;
}
export declare const browserManager: BrowserManager;
export {};
