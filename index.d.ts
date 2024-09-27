import type { ReportExportType, ReportTimeZone } from './types.js';
interface FasterReportExporterOptions {
    downloadFolderPath: string;
    timeoutMillis: number;
    showBrowserWindow: boolean;
    timeZone: ReportTimeZone;
}
export declare class FasterReportExporter {
    #private;
    constructor(fasterTenant: string, fasterUserName: string, fasterPassword: string, options?: Partial<FasterReportExporterOptions>);
    setDownloadFolderPath(downloadFolderPath: string): void;
    setTimeoutMillis(timeoutMillis: number): void;
    showBrowserWindow(): void;
    setTimeZone(timezone: ReportTimeZone): void;
    exportPartOrderPrint(orderNumber: number, exportType?: ReportExportType): Promise<string>;
    exportAssetList(exportType?: ReportExportType): Promise<string>;
    exportWorkOrderCustomerPrint(workOrderNumber: number, exportType?: ReportExportType): Promise<string>;
    exportWorkOrderTechnicianPrint(workOrderNumber: number, exportType?: ReportExportType): Promise<string>;
}
export {};
