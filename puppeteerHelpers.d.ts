import type { puppeteer } from '@cityssm/puppeteer-launch';
export declare function applyReportFilters(page: puppeteer.Page, reportFilters: Record<string, string>, options: {
    timeoutMillis: number;
}): Promise<void>;
