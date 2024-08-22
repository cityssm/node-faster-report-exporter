import type { puppeteer } from '@cityssm/puppeteer-launch';
export declare function delay(delayMillis: number): Promise<void>;
export declare function getElementOnPageBySelector(page: puppeteer.Page, selector: string, maxRetries?: number): Promise<puppeteer.ElementHandle | null>;
