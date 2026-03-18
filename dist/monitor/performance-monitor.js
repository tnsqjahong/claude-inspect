class PerformanceMonitor {
    async getMetrics(page) {
        const metrics = await page.evaluate(() => {
            const w = window;
            const timing = performance.timing;
            const navStart = timing.navigationStart;
            const domContentLoaded = timing.domContentLoadedEventEnd > 0 ? timing.domContentLoadedEventEnd - navStart : null;
            const loadTime = timing.loadEventEnd > 0 ? timing.loadEventEnd - navStart : null;
            const paintEntries = performance.getEntriesByType('paint');
            const fcpEntry = paintEntries.find((e) => e.name === 'first-contentful-paint');
            const fcp = fcpEntry ? fcpEntry.startTime : null;
            const lcp = w.__claudeBrowser_lcp ?? null;
            const cls = w.__claudeBrowser_cls ?? null;
            const inp = w.__claudeBrowser_inp ?? null;
            const resourceEntries = performance.getEntriesByType('resource');
            const byType = {};
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
    async injectObservers(page) {
        await page.evaluate(() => {
            const w = window;
            try {
                const lcpObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    if (entries.length > 0) {
                        w.__claudeBrowser_lcp = entries[entries.length - 1].startTime;
                    }
                });
                lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
            }
            catch {
                // largest-contentful-paint not supported
            }
            try {
                let clsValue = 0;
                const clsObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        const layoutShift = entry;
                        if (!layoutShift.hadRecentInput && layoutShift.value !== undefined) {
                            clsValue += layoutShift.value;
                        }
                    }
                    w.__claudeBrowser_cls = clsValue;
                });
                clsObserver.observe({ type: 'layout-shift', buffered: true });
            }
            catch {
                // layout-shift not supported
            }
            try {
                const inpObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        const interaction = entry;
                        if (interaction.duration !== undefined) {
                            const current = w.__claudeBrowser_inp ?? 0;
                            if (interaction.duration > current) {
                                w.__claudeBrowser_inp = interaction.duration;
                            }
                        }
                    }
                });
                inpObserver.observe({ type: 'event', buffered: true, durationThreshold: 16 });
            }
            catch {
                // event timing not supported
            }
        });
    }
}
export const performanceMonitor = new PerformanceMonitor();
//# sourceMappingURL=performance-monitor.js.map