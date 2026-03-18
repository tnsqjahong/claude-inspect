import type { Page } from 'playwright';
interface ResourceSummary {
    total: number;
    totalSize: number;
    byType: Record<string, {
        count: number;
        size: number;
    }>;
}
interface PerformanceMetrics {
    lcp: number | null;
    fcp: number | null;
    cls: number | null;
    inp: number | null;
    domContentLoaded: number | null;
    loadTime: number | null;
    resources: ResourceSummary;
}
declare class PerformanceMonitor {
    getMetrics(page: Page): Promise<PerformanceMetrics>;
    injectObservers(page: Page): Promise<void>;
}
export declare const performanceMonitor: PerformanceMonitor;
export {};
