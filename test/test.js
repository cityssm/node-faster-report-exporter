import assert from 'node:assert';
import fs from 'node:fs';
import { after, describe, it } from 'node:test';
import Debug from 'debug';
import { FasterReportExporter } from '../index.js';
import { fasterPassword, fasterTenant, fasterUserName, partOrderNumber, timeZone, workOrderNumber } from './config.js';
const doCleanup = true;
const debug = Debug('faster-report-exporter:test');
await describe('node-faster-report-exporter', async () => {
    const filesToPurgeOnExit = [];
    const reportExporter = new FasterReportExporter(fasterTenant, fasterUserName, fasterPassword, {
        timeoutMillis: 90_000,
        showBrowserWindow: true,
        timeZone
    });
    after(() => {
        if (doCleanup) {
            for (const fileToPurge of filesToPurgeOnExit) {
                if (fileToPurge !== '' && fs.existsSync(fileToPurge)) {
                    debug(`Purging ${fileToPurge}`);
                    fs.unlinkSync(fileToPurge);
                }
            }
        }
    });
    await it('Exports asset list', { timeout: 5 * 60 * 60 * 1000 }, async () => {
        try {
            const reportPath = await reportExporter.exportAssetList('PDF');
            assert(fs.existsSync(reportPath));
            filesToPurgeOnExit.push(reportPath);
        }
        catch (error) {
            debug(error);
            assert.fail();
        }
    });
    await it('Exports a part order', async () => {
        try {
            const reportPath = await reportExporter.exportPartOrderPrint(partOrderNumber, 'Word');
            assert(fs.existsSync(reportPath));
            filesToPurgeOnExit.push(reportPath);
        }
        catch {
            assert.fail();
        }
    });
    await it('Exports a work order customer print', async () => {
        try {
            const reportPath = await reportExporter.exportWorkOrderCustomerPrint(workOrderNumber, 'Excel');
            assert(fs.existsSync(reportPath));
            filesToPurgeOnExit.push(reportPath);
        }
        catch {
            assert.fail();
        }
    });
    await it('Exports a work order technician print', async () => {
        try {
            const reportPath = await reportExporter.exportWorkOrderTechnicianPrint(workOrderNumber, 'PDF');
            assert(fs.existsSync(reportPath));
            filesToPurgeOnExit.push(reportPath);
        }
        catch {
            assert.fail();
        }
    });
});
