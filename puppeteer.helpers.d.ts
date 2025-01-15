import type { puppeteer } from '@cityssm/puppeteer-launch';
/**
 * Populates the report filters on a Report Viewer page.
 * @param page - FASTER Web Report Viewer page
 * @param reportFilters - Filters applied to the report.
 * @param options - Options.
 * @param options.timeoutMillis - The regular pause interval.
 */
export declare function applyReportFilters(page: puppeteer.Page, reportFilters: Record<string, string>, options: {
    timeoutMillis: number;
}): Promise<void>;
