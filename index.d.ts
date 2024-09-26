declare const exportTypes: {
    PDF: string;
    CSV: string;
    Excel: string;
    Word: string;
};
type ReportExportType = keyof typeof exportTypes;
interface FasterReportExporterOptions {
    downloadFolderPath: string;
    timeoutMillis: number;
    showBrowserWindow: boolean;
    timeZone: number;
}
export declare class FasterReportExporter {
    #private;
    constructor(fasterTenant: string, fasterUserName: string, fasterPassword: string, options?: Partial<FasterReportExporterOptions>);
    setDownloadFolderPath(downloadFolderPath: string): void;
    setTimeoutMillis(timeoutMillis: number): void;
    showBrowserWindow(): void;
    setTimeZone(timezone: number): void;
    exportPartOrderPrint(orderNumber: number, exportType?: ReportExportType): Promise<string>;
    exportAssetMasterList(exportType?: ReportExportType): Promise<string>;
    exportWorkOrderCustomerPrint(workOrderNumber: number, exportType?: ReportExportType): Promise<string>;
    exportWorkOrderTechnicianPrint(workOrderNumber: number, exportType?: ReportExportType): Promise<string>;
}
export {};
