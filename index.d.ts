declare const exportTypes: {
    PDF: string;
    CSV: string;
    Excel: string;
    Word: string;
};
type ReportExportType = keyof typeof exportTypes;
export declare class FasterReportExporter {
    #private;
    constructor(fasterTenant: string, fasterUserName: string, fasterPassword: string);
    setDownloadFolderPath(downloadFolderPath: string): void;
    setTimeoutMillis(timeoutMillis: number): void;
    showBrowserWindow(): void;
    exportPartOrderPrint(orderNumber: number, exportType?: ReportExportType): Promise<string>;
    exportWorkOrderCustomerPrint(workOrderNumber: number, exportType?: ReportExportType): Promise<string>;
    exportWorkOrderTechnicianPrint(workOrderNumber: number, exportType?: ReportExportType): Promise<string>;
}
export {};
