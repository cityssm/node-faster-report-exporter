import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { URL } from 'node:url';
import FasterUrlBuilder from '@cityssm/faster-url-builder';
import puppeteerLaunch from '@cityssm/puppeteer-launch';
import { secondsToMillis } from '@cityssm/to-millis';
import Debug from 'debug';
import { minimumRecommendedTimeoutSeconds, reportExportTypes } from './lookups.js';
import { applyReportFilters } from './puppeteerHelpers.js';
import { defaultDelayMillis, delay, longDelayMillis } from './utilities.js';
const debug = Debug('faster-report-exporter:index');
export class FasterReportExporter {
    fasterUrlBuilder;
    #fasterUserName;
    #fasterPassword;
    #downloadFolderPath = os.tmpdir();
    #useHeadlessBrowser = true;
    #timeoutMillis = secondsToMillis(Math.max(90, minimumRecommendedTimeoutSeconds));
    #timeZone = 'Eastern';
    constructor(fasterTenantOrBaseUrl, fasterUserName, fasterPassword, options = {}) {
        this.fasterUrlBuilder = new FasterUrlBuilder(fasterTenantOrBaseUrl);
        this.#fasterUserName = fasterUserName;
        this.#fasterPassword = fasterPassword;
        if (options.downloadFolderPath !== undefined) {
            this.setDownloadFolderPath(options.downloadFolderPath);
        }
        if (options.timeoutMillis !== undefined) {
            this.setTimeoutMillis(options.timeoutMillis);
        }
        if (options.showBrowserWindow !== undefined && options.showBrowserWindow) {
            this.showBrowserWindow();
        }
        if (options.timeZone !== undefined) {
            this.#timeZone = options.timeZone;
        }
    }
    setDownloadFolderPath(downloadFolderPath) {
        if (!fs.existsSync(downloadFolderPath)) {
            throw new Error(`Download folder path does not exist: ${downloadFolderPath}`);
        }
        this.#downloadFolderPath = downloadFolderPath;
    }
    setTimeoutMillis(timeoutMillis) {
        this.#timeoutMillis = timeoutMillis;
        if (timeoutMillis < secondsToMillis(minimumRecommendedTimeoutSeconds)) {
            debug(`Warning: Timeouts less than ${minimumRecommendedTimeoutSeconds}s are not recommended.`);
        }
    }
    showBrowserWindow() {
        this.#useHeadlessBrowser = false;
    }
    setTimeZone(timezone) {
        this.#timeZone = timezone;
    }
    async _getLoggedInFasterPage() {
        let browser;
        try {
            browser = await puppeteerLaunch({
                browser: 'chrome',
                protocol: 'cdp',
                headless: this.#useHeadlessBrowser,
                timeout: this.#timeoutMillis
            });
            debug('Logging into FASTER...');
            const page = await browser.newPage();
            await page.goto(this.fasterUrlBuilder.baseUrl, {
                timeout: this.#timeoutMillis
            });
            await page.waitForNetworkIdle({
                timeout: this.#timeoutMillis
            });
            const loginFormElement = await page.$('#form_Signin');
            if (loginFormElement !== null) {
                debug('Filling out login form...');
                const userNameElement = await loginFormElement.$('#LoginControl_UserName');
                if (userNameElement === null) {
                    throw new Error('Unable to locate user name field.');
                }
                await userNameElement.type(this.#fasterUserName);
                const passwordElement = await loginFormElement.$('#LoginControl_Password');
                if (passwordElement === null) {
                    throw new Error('Unable to locate password field.');
                }
                await passwordElement.type(this.#fasterPassword);
                const submitButtonElement = await loginFormElement.$('#LoginControl_SignInButton_input');
                if (submitButtonElement === null) {
                    throw new Error('Unable to locate Sign In button.');
                }
                await submitButtonElement.scrollIntoView();
                await submitButtonElement.click();
                await delay();
                await page.waitForNetworkIdle({
                    timeout: this.#timeoutMillis
                });
                if (page.url().toLowerCase().includes('release/releasenotes.aspx')) {
                    debug('Release notes page, continuing...');
                    const continueButtonElement = await page.$('#OKRadButon_input');
                    if (continueButtonElement !== null) {
                        await continueButtonElement.scrollIntoView();
                        await continueButtonElement.click();
                        await delay();
                        await page.waitForNetworkIdle({
                            timeout: this.#timeoutMillis
                        });
                    }
                }
            }
            debug('Finished logging in.');
            return {
                browser,
                page
            };
        }
        catch (error) {
            try {
                await browser?.close();
            }
            catch { }
            throw error;
        }
    }
    async #navigateToFasterReportPage(browser, page, reportKey, reportParameters, reportFilters) {
        try {
            const reportUrl = new URL(this.fasterUrlBuilder.reportViewerUrl);
            reportUrl.searchParams.set('R', reportKey);
            for (const [parameterKey, parameterValue] of Object.entries(reportParameters)) {
                reportUrl.searchParams.set(parameterKey, parameterValue);
            }
            await page.goto(reportUrl.href, {
                timeout: this.#timeoutMillis
            });
            await delay();
            await page.waitForNetworkIdle({
                timeout: this.#timeoutMillis
            });
            if (reportFilters !== undefined) {
                await applyReportFilters(page, reportFilters, {
                    timeoutMillis: this.#timeoutMillis
                });
            }
            return {
                browser,
                page
            };
        }
        catch (error) {
            try {
                await browser.close();
            }
            catch { }
            throw error;
        }
    }
    async #exportFasterReport(browser, page, exportType = 'PDF') {
        await page.bringToFront();
        await page.waitForNetworkIdle({
            timeout: this.#timeoutMillis
        });
        debug(`Report Page Title: ${await page.title()}`);
        const downloadPromise = new Promise(async (resolve) => {
            let downloadStarted = false;
            try {
                const cdpSession = await browser.target().createCDPSession();
                await cdpSession.send('Browser.setDownloadBehavior', {
                    behavior: 'allowAndName',
                    downloadPath: this.#downloadFolderPath,
                    eventsEnabled: true
                });
                cdpSession.on('Browser.downloadProgress', (event) => {
                    if (event.state === 'completed') {
                        debug('Download complete.');
                        const downloadedFilePath = path.join(this.#downloadFolderPath, event.guid);
                        const newFilePath = `${downloadedFilePath}.${reportExportTypes[exportType]}`;
                        fs.rename(downloadedFilePath, newFilePath, (error) => {
                            if (error === null) {
                                debug(`File: ${newFilePath}`);
                                resolve(newFilePath);
                            }
                            else {
                                debug(`File: ${downloadedFilePath}`);
                                resolve(downloadedFilePath);
                            }
                        });
                        downloadStarted = false;
                    }
                    else if (event.state === 'canceled') {
                        downloadStarted = false;
                        throw new Error('Download cancelled.');
                    }
                });
                await page.waitForNetworkIdle({
                    timeout: this.#timeoutMillis
                });
                debug(`Finding the print button for "${exportType}"...`);
                const printOptionsMenuElement = await page.waitForSelector('#RvDetails_ctl05_ctl04_ctl00_ButtonLink', { timeout: this.#timeoutMillis });
                if (printOptionsMenuElement === null) {
                    throw new Error('Unable to locate print options. Consider extending the timeout millis.');
                }
                await printOptionsMenuElement.click();
                await delay(longDelayMillis);
                await page.waitForNetworkIdle({
                    timeout: this.#timeoutMillis
                });
                const printOptionElement = await page.waitForSelector(`#RvDetails_ctl05_ctl04_ctl00_Menu a[title^='${exportType}']`, { timeout: this.#timeoutMillis });
                if (printOptionElement === null) {
                    throw new Error(`Unable to locate "${exportType}" print type.`);
                }
                debug(`Print button found for "${exportType}"...`);
                await delay();
                downloadStarted = true;
                await printOptionElement.scrollIntoView();
                await printOptionElement.click();
                debug('Print selected.');
                await delay(longDelayMillis);
                await page.waitForNetworkIdle({
                    timeout: this.#timeoutMillis
                });
                let retries = this.#timeoutMillis / defaultDelayMillis;
                while (downloadStarted && retries > 0) {
                    await delay();
                    retries--;
                }
            }
            finally {
                try {
                    await browser.close();
                }
                catch { }
            }
        });
        return await Promise.resolve(downloadPromise);
    }
    async exportPartOrderPrint(orderNumber, exportType) {
        const { browser, page } = await this._getLoggedInFasterPage();
        await this.#navigateToFasterReportPage(browser, page, '/Part Order Print/W299 - OrderPrint', {
            OrderID: orderNumber.toString(),
            ReportType: 'S',
            Domain: 'Inventory'
        }, {
            'Time Zone': this.#timeZone
        });
        return await this.#exportFasterReport(browser, page, exportType);
    }
    async exportInventory(exportType) {
        const { browser, page } = await this._getLoggedInFasterPage();
        await this.#navigateToFasterReportPage(browser, page, '/Inventory/W200 - Inventory Report', {
            ReportType: 'S',
            Domain: 'Inventory',
            Parent: 'Reports'
        }, {
            'Time Zone': this.#timeZone,
            'Grouping within Storeroom': 'Item Category'
        });
        return await this.#exportFasterReport(browser, page, exportType);
    }
    async exportAssetList(exportType) {
        const { browser, page } = await this._getLoggedInFasterPage();
        await this.#navigateToFasterReportPage(browser, page, '/Assets/W114 - Asset Master List', {
            ReportType: 'S',
            Domain: 'Assets',
            Parent: 'Reports'
        }, {
            'Time Zone': this.#timeZone,
            'Primary Grouping': 'Organization',
            'Secondary Grouping': 'Department'
        });
        return await this.#exportFasterReport(browser, page, exportType);
    }
    async exportWorkOrderDetails(minWorkOrderNumber, maxWorkOrderNumber, exportType) {
        const minWorkOrderNumberString = minWorkOrderNumber.toString();
        const maxWorkOrderNumberString = (maxWorkOrderNumber ?? minWorkOrderNumber).toString();
        const { browser, page } = await this._getLoggedInFasterPage();
        await this.#navigateToFasterReportPage(browser, page, '/Maintenance/W300n - WorkOrderDetailsByWONumber', {
            ReportType: 'S',
            Domain: 'Maintenance',
            Parent: 'Reports'
        }, {
            'Time Zone': this.#timeZone,
            'Beginning Work Order Number': minWorkOrderNumberString,
            'Ending Work Order Number': maxWorkOrderNumberString
        });
        return await this.#exportFasterReport(browser, page, exportType);
    }
    async #exportWorkOrderPrint(workOrderNumber, exportType, printButtonSelector) {
        const { browser, page } = await this._getLoggedInFasterPage();
        try {
            await page.goto(this.fasterUrlBuilder.workOrderUrl(workOrderNumber), {
                timeout: this.#timeoutMillis
            });
            await delay();
            await page.waitForNetworkIdle({
                timeout: this.#timeoutMillis
            });
            const printElement = await page.waitForSelector(printButtonSelector, {
                timeout: this.#timeoutMillis
            });
            if (printElement === null) {
                throw new Error('Unable to locate print link.');
            }
            await printElement.scrollIntoView();
            await printElement.click();
            const reportViewerTarget = await browser.waitForTarget((target) => target.url().toLowerCase().includes('reportviewer.aspx'), {
                timeout: this.#timeoutMillis
            });
            const newPage = await reportViewerTarget.asPage();
            await delay();
            await newPage.bringToFront();
            await delay();
            await newPage.waitForNetworkIdle({
                timeout: this.#timeoutMillis
            });
            return await this.#exportFasterReport(browser, newPage, exportType);
        }
        catch (error) {
            try {
                await browser.close();
            }
            catch { }
            throw error;
        }
    }
    async exportWorkOrderCustomerPrint(workOrderNumber, exportType = 'PDF') {
        return await this.#exportWorkOrderPrint(workOrderNumber, exportType, '#ctl00_ContentPlaceHolder_Content_MasterWorkOrderDetailMenu_CustomerPrintLinkButton');
    }
    async exportWorkOrderTechnicianPrint(workOrderNumber, exportType = 'PDF') {
        return await this.#exportWorkOrderPrint(workOrderNumber, exportType, '#ctl00_ContentPlaceHolder_Content_MasterWorkOrderDetailMenu_WorkOrderPrintLinkButton');
    }
}
