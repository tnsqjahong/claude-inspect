import type { Page } from 'playwright';
interface NetworkRequestEntry {
    url: string;
    method: string;
    resourceType: string;
    status: number | null;
    statusText: string | null;
    failed: boolean;
    failureText: string | null;
    timing: {
        startTime: number;
        endTime: number | null;
        duration: number | null;
    };
    requestHeaders: Record<string, string>;
    responseHeaders: Record<string, string>;
    postData: string | null;
}
interface NetworkSummary {
    total: number;
    failed: number;
    byResourceType: Record<string, number>;
    byStatus: Record<string, number>;
}
declare class NetworkMonitor {
    private pending;
    private completed;
    private readonly maxEntries;
    attach(page: Page): void;
    getRequests(options?: {
        failedOnly?: boolean;
        limit?: number;
    }): NetworkRequestEntry[];
    getSummary(): NetworkSummary;
    clear(): void;
}
export declare const networkMonitor: NetworkMonitor;
export {};
