// eslint-disable-next-line @eslint-community/eslint-comments/disable-enable-pair
/* eslint-disable security/detect-non-literal-fs-filename */
import assert from 'node:assert';
import fs from 'node:fs';
import { after, describe, it } from 'node:test';
import { minutesToMillis } from '@cityssm/to-millis';
import Debug from 'debug';
import { DEBUG_ENABLE_NAMESPACES } from '../debug.config.js';
import { FasterReportExporter } from '../index.js';
import { fasterPassword, fasterTenant, fasterUserName, partOrderNumber, timeZone, workOrderNumber } from './config.js';
const doCleanup = true;
Debug.enable(DEBUG_ENABLE_NAMESPACES);
const debug = Debug('faster-report-exporter:test');
await describe('node-faster-report-exporter', async () => {
    const filesToPurgeOnExit = [];
    const reportExporter = new FasterReportExporter(fasterTenant, fasterUserName, fasterPassword, {
        timeoutMillis: 90_000,
        showBrowserWindow: true,
        timeZone
    });
    after(() => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (doCleanup) {
            for (const fileToPurge of filesToPurgeOnExit) {
                if (fileToPurge !== '' && fs.existsSync(fileToPurge)) {
                    debug(`Purging ${fileToPurge}`);
                    fs.unlinkSync(fileToPurge);
                }
            }
        }
    });
    await it.skip('Exports asset list', { timeout: 5 * 60 * 60 * 1000 }, // eslint-disable-line @typescript-eslint/no-magic-numbers
    async () => {
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
    await it.skip('Exports inventory', { timeout: 5 * 60 * 60 * 1000 }, // eslint-disable-line @typescript-eslint/no-magic-numbers
    async () => {
        try {
            const reportPath = await reportExporter.exportInventory('PDF');
            assert(fs.existsSync(reportPath));
            filesToPurgeOnExit.push(reportPath);
        }
        catch (error) {
            debug(error);
            assert.fail();
        }
    });
    await it.skip('Exports a part order', async () => {
        try {
            const reportPath = await reportExporter.exportPartOrderPrint(partOrderNumber, 'Word');
            assert(fs.existsSync(reportPath));
            filesToPurgeOnExit.push(reportPath);
        }
        catch {
            assert.fail();
        }
    });
    await it.skip('Exports work order details', { timeout: minutesToMillis(5) }, // eslint-disable-line @typescript-eslint/no-magic-numbers
    async () => {
        try {
            const reportPath = await reportExporter.exportWorkOrderDetails(1, 10, 'PDF');
            assert(fs.existsSync(reportPath));
            filesToPurgeOnExit.push(reportPath);
        }
        catch (error) {
            debug(error);
            assert.fail();
        }
    });
    await it.skip('Exports a work order customer print', async () => {
        try {
            const reportPath = await reportExporter.exportWorkOrderCustomerPrint(workOrderNumber, 'Excel');
            assert(fs.existsSync(reportPath));
            filesToPurgeOnExit.push(reportPath);
        }
        catch {
            assert.fail();
        }
    });
    await it.skip('Exports a work order technician print', async () => {
        try {
            const reportPath = await reportExporter.exportWorkOrderTechnicianPrint(workOrderNumber, 'PDF');
            assert(fs.existsSync(reportPath));
            filesToPurgeOnExit.push(reportPath);
        }
        catch {
            assert.fail();
        }
    });
    await it.skip('Exports the message logger', async () => {
        try {
            const reportPath = await reportExporter.exportMessageLogger(new Date(2025, 1 - 1, 1), new Date(2025, 3 - 1, 1), 'Excel');
            assert(fs.existsSync(reportPath));
            filesToPurgeOnExit.push(reportPath);
        }
        catch {
            assert.fail();
        }
    });
    await it('Exports a scheduled report', async () => {
        try {
            const reportPath = await reportExporter.exportScheduledReport('IntegrationMessageLogger', new Date(2025, 1 - 1, 1), new Date(2025, 3 - 1, 1));
            assert(fs.existsSync(reportPath));
            filesToPurgeOnExit.push(reportPath);
        }
        catch {
            assert.fail();
        }
    });
});
