import FasterUrlBuilder from '@cityssm/faster-url-builder';
import { type puppeteer } from '@cityssm/puppeteer-launch';
import type { ReportExportType, ReportTimeZone } from './types.js';
export interface FasterReportExporterOptions {
    downloadFolderPath: string;
    timeoutMillis: number;
    showBrowserWindow: boolean;
    timeZone: ReportTimeZone;
}
export declare class FasterReportExporter {
    #private;
    readonly fasterUrlBuilder: FasterUrlBuilder;
    constructor(fasterTenantOrBaseUrl: string, fasterUserName: string, fasterPassword: string, options?: Partial<FasterReportExporterOptions>);
    setDownloadFolderPath(downloadFolderPath: string): void;
    setTimeoutMillis(timeoutMillis: number): void;
    showBrowserWindow(): void;
    setTimeZone(timezone: ReportTimeZone): void;
    _getLoggedInFasterPage(): Promise<{
        browser: puppeteer.Browser;
        page: puppeteer.Page;
    }>;
    exportPartOrderPrint(orderNumber: number, exportType?: ReportExportType): Promise<string>;
    exportInventory(exportType?: ReportExportType): Promise<string>;
    exportAssetList(exportType?: ReportExportType): Promise<string>;
    exportWorkOrderDetails(minWorkOrderNumber: number, maxWorkOrderNumber?: number, exportType?: ReportExportType): Promise<string>;
    exportWorkOrderCustomerPrint(workOrderNumber: number, exportType?: ReportExportType): Promise<string>;
    exportWorkOrderTechnicianPrint(workOrderNumber: number, exportType?: ReportExportType): Promise<string>;
}
