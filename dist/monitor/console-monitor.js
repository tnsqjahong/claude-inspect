class ConsoleMonitor {
    logs = [];
    maxEntries = 1000;
    attach(page) {
        page.on('console', (msg) => {
            const loc = msg.location();
            const entry = {
                type: msg.type(),
                text: msg.text(),
                timestamp: Date.now(),
                location: loc.url
                    ? {
                        url: loc.url,
                        lineNumber: loc.lineNumber,
                        columnNumber: loc.columnNumber,
                    }
                    : null,
            };
            this.logs.push(entry);
            if (this.logs.length > this.maxEntries) {
                this.logs.shift();
            }
        });
        page.on('pageerror', (error) => {
            const entry = {
                type: 'error',
                text: error.stack ?? error.message,
                timestamp: Date.now(),
                location: null,
            };
            this.logs.push(entry);
            if (this.logs.length > this.maxEntries) {
                this.logs.shift();
            }
        });
    }
    getLogs(options) {
        const typeFilter = options?.type;
        const limit = options?.limit ?? 50;
        let filtered = this.logs;
        if (typeFilter && typeFilter !== 'all') {
            filtered = this.logs.filter((entry) => entry.type === typeFilter);
        }
        return filtered.slice(-limit);
    }
    clear() {
        this.logs = [];
    }
}
export const consoleMonitor = new ConsoleMonitor();
//# sourceMappingURL=console-monitor.js.map