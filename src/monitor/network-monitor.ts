import type { Page, Request, Response } from 'playwright';

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

const ALLOWED_REQUEST_HEADERS = new Set(['content-type', 'accept', 'authorization']);
const ALLOWED_RESPONSE_HEADERS = new Set(['content-type', 'content-length']);

class NetworkMonitor {
  private pending = new Map<Request, NetworkRequestEntry>();
  private completed: NetworkRequestEntry[] = [];
  private readonly maxEntries = 1000;

  attach(page: Page): void {
    page.on('request', (req: Request) => {
      const rawHeaders = req.headers();
      const filteredHeaders: Record<string, string> = {};
      for (const key of ALLOWED_REQUEST_HEADERS) {
        if (rawHeaders[key] !== undefined) {
          filteredHeaders[key] = key === 'authorization' ? '[MASKED]' : rawHeaders[key];
        }
      }

      const rawPostData = req.postData();
      const postData = rawPostData ? rawPostData.slice(0, 500) : null;

      const entry: NetworkRequestEntry = {
        url: req.url(),
        method: req.method(),
        resourceType: req.resourceType(),
        status: null,
        statusText: null,
        failed: false,
        failureText: null,
        timing: {
          startTime: Date.now(),
          endTime: null,
          duration: null,
        },
        requestHeaders: filteredHeaders,
        responseHeaders: {},
        postData,
      };

      this.pending.set(req, entry);
    });

    page.on('response', (res: Response) => {
      const req = res.request();
      const entry = this.pending.get(req);
      if (!entry) return;

      const endTime = Date.now();
      entry.status = res.status();
      entry.statusText = res.statusText();
      entry.timing.endTime = endTime;
      entry.timing.duration = endTime - entry.timing.startTime;

      const rawHeaders = res.headers();
      const filteredHeaders: Record<string, string> = {};
      for (const key of ALLOWED_RESPONSE_HEADERS) {
        if (rawHeaders[key] !== undefined) {
          filteredHeaders[key] = rawHeaders[key];
        }
      }
      entry.responseHeaders = filteredHeaders;

      this.pending.delete(req);
      this.completed.push(entry);
      if (this.completed.length > this.maxEntries) {
        this.completed.shift();
      }
    });

    page.on('requestfailed', (req: Request) => {
      const entry = this.pending.get(req);
      if (!entry) return;

      const endTime = Date.now();
      entry.failed = true;
      entry.failureText = req.failure()?.errorText ?? null;
      entry.timing.endTime = endTime;
      entry.timing.duration = endTime - entry.timing.startTime;

      this.pending.delete(req);
      this.completed.push(entry);
      if (this.completed.length > this.maxEntries) {
        this.completed.shift();
      }
    });
  }

  getRequests(options?: { failedOnly?: boolean; limit?: number }): NetworkRequestEntry[] {
    const limit = options?.limit ?? 50;
    let results = this.completed;
    if (options?.failedOnly) {
      results = results.filter((entry) => entry.failed);
    }
    return results.slice(-limit);
  }

  getSummary(): NetworkSummary {
    const byResourceType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    for (const entry of this.completed) {
      byResourceType[entry.resourceType] = (byResourceType[entry.resourceType] ?? 0) + 1;
      if (entry.status !== null) {
        const statusKey = String(entry.status);
        byStatus[statusKey] = (byStatus[statusKey] ?? 0) + 1;
      }
    }

    return {
      total: this.completed.length,
      failed: this.completed.filter((e) => e.failed).length,
      byResourceType,
      byStatus,
    };
  }

  clear(): void {
    this.pending.clear();
    this.completed = [];
  }
}

export const networkMonitor = new NetworkMonitor();
