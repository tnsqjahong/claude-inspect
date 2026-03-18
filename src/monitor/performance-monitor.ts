import type { Page } from 'playwright';

interface ResourceSummary {
  total: number;
  totalSize: number;
  byType: Record<string, { count: number; size: number }>;
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

class PerformanceMonitor {
  async getMetrics(page: Page): Promise<PerformanceMetrics> {
    const metrics = await page.evaluate((): Omit<PerformanceMetrics, 'inp'> & { inp: number | null } => {
      const w = window as Window & typeof globalThis & {
        __claudeInspect_lcp?: number;
        __claudeInspect_cls?: number;
        __claudeInspect_inp?: number;
      };

      const timing = performance.timing;
      const navStart = timing.navigationStart;

      const domContentLoaded =
        timing.domContentLoadedEventEnd > 0 ? timing.domContentLoadedEventEnd - navStart : null;
      const loadTime = timing.loadEventEnd > 0 ? timing.loadEventEnd - navStart : null;

      const paintEntries = performance.getEntriesByType('paint');
      const fcpEntry = paintEntries.find((e) => e.name === 'first-contentful-paint');
      const fcp = fcpEntry ? fcpEntry.startTime : null;

      const lcp = w.__claudeInspect_lcp ?? null;
      const cls = w.__claudeInspect_cls ?? null;
      const inp = w.__claudeInspect_inp ?? null;

      const resourceEntries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const byType: Record<string, { count: number; size: number }> = {};
      let totalSize = 0;

      for (const res of resourceEntries) {
        const type = res.initiatorType || 'other';
        const size = res.transferSize ?? 0;
        totalSize += size;
        if (!byType[type]) {
          byType[type] = { count: 0, size: 0 };
        }
        byType[type].count += 1;
        byType[type].size += size;
      }

      return {
        lcp,
        fcp,
        cls,
        inp,
        domContentLoaded,
        loadTime,
        resources: {
          total: resourceEntries.length,
          totalSize,
          byType,
        },
      };
    });

    return metrics;
  }

  async injectObservers(page: Page): Promise<void> {
    await page.evaluate(() => {
      const w = window as Window & typeof globalThis & {
        __claudeInspect_lcp?: number;
        __claudeInspect_cls?: number;
        __claudeInspect_inp?: number;
      };

      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length > 0) {
            w.__claudeInspect_lcp = (entries[entries.length - 1] as PerformanceEntry & { startTime: number }).startTime;
          }
        });
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      } catch {
        // largest-contentful-paint not supported
      }

      try {
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const layoutShift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
            if (!layoutShift.hadRecentInput && layoutShift.value !== undefined) {
              clsValue += layoutShift.value;
            }
          }
          w.__claudeInspect_cls = clsValue;
        });
        clsObserver.observe({ type: 'layout-shift', buffered: true });
      } catch {
        // layout-shift not supported
      }

      try {
        const inpObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const interaction = entry as PerformanceEntry & { duration?: number };
            if (interaction.duration !== undefined) {
              const current = w.__claudeInspect_inp ?? 0;
              if (interaction.duration > current) {
                w.__claudeInspect_inp = interaction.duration;
              }
            }
          }
        });
        inpObserver.observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
      } catch {
        // event timing not supported
      }
    });
  }
}

export const performanceMonitor = new PerformanceMonitor();
