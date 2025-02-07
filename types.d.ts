import type { reportExportTypes } from './lookups.js';
export interface ReportParameters extends Record<string, string> {
    ReportType: 'S';
    Domain: 'Inventory' | 'Maintenance' | 'Assets' | 'Setup';
}
export type ReportTimeZone = 'Atlantic' | 'Central' | 'Eastern' | 'Mountain' | 'Pacific';
export type ReportExportType = keyof typeof reportExportTypes;
