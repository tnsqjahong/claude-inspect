import type { Page } from 'playwright';
interface ConsoleLogEntry {
    type: string;
    text: string;
    timestamp: number;
    location: {
        url: string;
        lineNumber: number;
        columnNumber: number;
    } | null;
}
declare class ConsoleMonitor {
    private logs;
    private readonly maxEntries;
    attach(page: Page): void;
    getLogs(options?: {
        type?: 'error' | 'warn' | 'all';
        limit?: number;
    }): ConsoleLogEntry[];
    clear(): void;
}
export declare const consoleMonitor: ConsoleMonitor;
export {};
