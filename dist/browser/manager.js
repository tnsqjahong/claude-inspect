import { chromium } from 'playwright';
class BrowserManager {
    static instance;
    state = {
        browser: null,
        context: null,
        page: null,
        isRunning: false,
    };
    constructor() { }
    static getInstance() {
        if (!BrowserManager.instance) {
            BrowserManager.instance = new BrowserManager();
        }
        return BrowserManager.instance;
    }
    async launch(options = {}) {
        if (this.state.isRunning) {
            await this.close();
        }
        const browser = await chromium.launch({ headless: options.headless ?? false });
        browser.on('disconnected', () => {
            this.state = {
                browser: null,
                context: null,
                page: null,
                isRunning: false,
            };
        });
        const context = await browser.newContext({
            viewport: { width: 1280, height: 720 },
        });
        const page = await context.newPage();
        if (options.url) {
            await page.goto(options.url, { waitUntil: 'domcontentloaded' });
        }
        this.state = {
            browser,
            context,
            page,
            isRunning: true,
        };
    }
    async navigate(url) {
        const page = this.getPage();
        await page.goto(url, { waitUntil: 'domcontentloaded' });
    }
    async screenshot(options = {}) {
        const page = this.getPage();
        const buffer = await page.screenshot({
            type: 'png',
            fullPage: options.fullPage ?? false,
        });
        const viewportSize = page.viewportSize();
        const width = viewportSize?.width ?? 1280;
        const height = viewportSize?.height ?? 720;
        return {
            base64: buffer.toString('base64'),
            width,
            height,
        };
    }
    async close() {
        if (this.state.browser) {
            await this.state.browser.close();
        }
        this.state = {
            browser: null,
            context: null,
            page: null,
            isRunning: false,
        };
    }
    getPage() {
        if (!this.state.page || !this.state.isRunning) {
            throw new Error('Browser not launched. Use browser_launch first.');
        }
        return this.state.page;
    }
    isRunning() {
        return this.state.isRunning;
    }
    getCurrentUrl() {
        if (!this.state.page || !this.state.isRunning)
            return null;
        return this.state.page.url();
    }
    getState() {
        return { ...this.state };
    }
}
export const browserManager = BrowserManager.getInstance();
//# sourceMappingURL=manager.js.map