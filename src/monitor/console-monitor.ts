import type { Page, ConsoleMessage } from 'playwright';

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

class ConsoleMonitor {
  private logs: ConsoleLogEntry[] = [];
  private readonly maxEntries = 1000;

  attach(page: Page): void {
    page.on('console', (msg: ConsoleMessage) => {
      const loc = msg.location();
      const entry: ConsoleLogEntry = {
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

    page.on('pageerror', (error: Error) => {
      const entry: ConsoleLogEntry = {
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

  getLogs(options?: { type?: 'error' | 'warn' | 'all'; limit?: number }): ConsoleLogEntry[] {
    const typeFilter = options?.type;
    const limit = options?.limit ?? 50;

    let filtered = this.logs;
    if (typeFilter && typeFilter !== 'all') {
      filtered = this.logs.filter((entry) => entry.type === typeFilter);
    }

    return filtered.slice(-limit);
  }

  clear(): void {
    this.logs = [];
  }
}

export const consoleMonitor = new ConsoleMonitor();
