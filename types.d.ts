import type { reportExportTypes } from './lookups.js';
export interface ReportParameters extends Record<string, string> {
    Domain: 'Assets' | 'Inventory' | 'Maintenance' | 'Setup';
    ReportType: 'S';
}
export type ReportTimeZone = 'Atlantic' | 'Central' | 'Eastern' | 'Mountain' | 'Pacific';
export type ReportExportType = keyof typeof reportExportTypes;
