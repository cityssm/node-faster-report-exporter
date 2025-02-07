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
    /**
     * Initializes the FasterReportExporter.
     * @param fasterTenantOrBaseUrl - The subdomain of the FASTER Web URL before ".fasterwebcloud.com"
     *                                or the full domain and path including "/FASTER"
     * @param fasterUserName - The user name
     * @param fasterPassword - The password
     * @param options - Options
     */
    constructor(fasterTenantOrBaseUrl: string, fasterUserName: string, fasterPassword: string, options?: Partial<FasterReportExporterOptions>);
    /**
     * Sets the folder where downloaded reports are saved.
     * @param downloadFolderPath - The folder where downloaded reports are saved.
     */
    setDownloadFolderPath(downloadFolderPath: string): void;
    /**
     * Changes the timeout for loading the browser and navigating between pages.
     * @param timeoutMillis - Number of milliseconds.
     */
    setTimeoutMillis(timeoutMillis: number): void;
    /**
     * Switches off headless mode, making the browser window visible.
     * Useful for debugging.
     */
    showBrowserWindow(): void;
    /**
     * Changes the time zone parameter used in reports.
     * @param timezone - The preferred report time zone.
     */
    setTimeZone(timezone: ReportTimeZone): void;
    /**
     * Gets a browser and page that are logged into FASTER.
     * @returns browser and page, be sure to close the browser when done.
     */
    _getLoggedInFasterPage(): Promise<{
        browser: puppeteer.Browser;
        page: puppeteer.Page;
    }>;
    /**
     * Exports a Part Order Print (W299) report for a given order number.
     * @param orderNumber - The order number.
     * @param exportType - The export type.
     * @returns The path to the exported report.
     */
    exportPartOrderPrint(orderNumber: number, exportType?: ReportExportType): Promise<string>;
    /**
     * Exports an Inventory Report (W200).
     * @param exportType - The export type.
     * @returns The path to the exported report.
     */
    exportInventory(exportType?: ReportExportType): Promise<string>;
    /**
     * Export an Asset Master List (W114) report.
     * @param exportType - The export type.
     * @returns The path to the exported report.
     */
    exportAssetList(exportType?: ReportExportType): Promise<string>;
    /**
     * Export a Work Order Details by Work Order Number (W300N) report.
     * @param minWorkOrderNumber - Minimum work order number.
     * @param maxWorkOrderNumber - Maximum work order number.
     * @param exportType - The export type.
     * @returns The path to the exported report.
     */
    exportWorkOrderDetails(minWorkOrderNumber: number, maxWorkOrderNumber?: number, exportType?: ReportExportType): Promise<string>;
    /**
     * Exports the Customer Print (W398) for a given work order.
     * @param workOrderNumber - The work order number.
     * @param exportType - The export type.
     * @returns The path to the exported report.
     */
    exportWorkOrderCustomerPrint(workOrderNumber: number, exportType?: ReportExportType): Promise<string>;
    /**
     * Exports the Technician Print (W399) for a given work order.
     * @param workOrderNumber - The work order number.
     * @param exportType - The export type.
     * @returns The path to the exported report.
     */
    exportWorkOrderTechnicianPrint(workOrderNumber: number, exportType?: ReportExportType): Promise<string>;
    /**
     * Exports the Message Logger (W603) report.
     * @param startDate - The start date
     * @param endDate - The end date
     * @param exportType - The export type
     * @returns The path to the exported report.
     */
    exportMessageLogger(startDate?: Date, endDate?: Date, exportType?: ReportExportType): Promise<string>;
    /**
     * Exports a scheduled report by name.
     * Helpful for exporting reports with complex parameters.
     * @param scheduleName - Schedule name
     * @param startDate - The start date
     * @param endDate - The end date
     * @param exportType - The export type
     * @returns The path to the exported report.
     */
    exportScheduledReport(scheduleName: string, startDate?: Date, endDate?: Date, exportType?: ReportExportType): Promise<string>;
}
