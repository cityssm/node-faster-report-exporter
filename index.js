import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { URL } from 'node:url';
import puppeteerLaunch from '@cityssm/puppeteer-launch';
import Debug from 'debug';
import { defaultDelayMillis, delay } from './utilities.js';
const debug = Debug('faster-report-exporter:index');
const exportTypes = {
    PDF: 'pdf',
    CSV: 'csv',
    Excel: 'xlsx',
    Word: 'docx'
};
export class FasterReportExporter {
    #fasterBaseUrl;
    #fasterUserName;
    #fasterPassword;
    #downloadFolderPath = os.tmpdir();
    #useHeadlessBrowser = true;
    #timeoutMillis = 90_000;
    #timeZone = 3;
    constructor(fasterTenant, fasterUserName, fasterPassword, options = {}) {
        this.#fasterBaseUrl = `https://${fasterTenant}.fasterwebcloud.com/FASTER`;
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
        if (timeoutMillis < 60_000) {
            debug('Warning: Timeouts less than 60s are not recommended.');
        }
    }
    showBrowserWindow() {
        this.#useHeadlessBrowser = false;
    }
    setTimeZone(timezone) {
        this.#timeZone = timezone;
    }
    async #getLoggedInFasterPage() {
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
            await page.goto(this.#fasterBaseUrl, {
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
            const reportUrl = new URL(`${this.#fasterBaseUrl}/Domains/Reports/ReportViewer.aspx`);
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
                await page.waitForSelector('label');
                const labelElements = await page.$$('label');
                const labelTextToInputId = {};
                for (const labelElement of labelElements) {
                    const labelText = await labelElement.evaluate((element) => {
                        return element.textContent;
                    }, labelElement);
                    if (labelText === null) {
                        continue;
                    }
                    labelTextToInputId[labelText] =
                        (await labelElement.evaluate((element) => {
                            return element.getAttribute('for');
                        })) ?? '';
                }
                for (const [labelSearchText, inputValue] of Object.entries(reportFilters ?? {})) {
                    let inputId = '';
                    for (const [labelText, possibleInputId] of Object.entries(labelTextToInputId)) {
                        if (labelText.includes(labelSearchText)) {
                            inputId = possibleInputId;
                            break;
                        }
                    }
                    if (inputId === '') {
                        throw new Error(`No filter found with label: ${labelSearchText}`);
                    }
                    const inputElement = (await page.waitForSelector(`#${inputId}`, {
                        timeout: this.#timeoutMillis
                    }));
                    if (inputElement === null) {
                        throw new Error(`No element found with id: ${inputId}`);
                    }
                    await page.type(`#${inputId}`, inputValue);
                    if (Object.keys(reportFilters).length > 1) {
                        await delay(1000);
                    }
                }
                const submitButtonElement = await page.waitForSelector('a:has(input[type="submit"])');
                await submitButtonElement?.scrollIntoView();
                await submitButtonElement?.click();
                await delay(1000);
                await page.waitForNetworkIdle({
                    timeout: this.#timeoutMillis
                });
            }
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
    async #exportFasterReport(browser, page, exportType = 'PDF') {
        await page.bringToFront();
        await page.waitForNetworkIdle({
            timeout: this.#timeoutMillis
        });
        debug(`Report Page Title: ${await page.title()}`);
        return await new Promise(async (resolve) => {
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
                        const newFilePath = `${downloadedFilePath}.${exportTypes[exportType]}`;
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
                await delay();
                await delay();
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
                await delay(1000);
                await page.waitForNetworkIdle({
                    timeout: this.#timeoutMillis
                });
                let retries = this.#timeoutMillis / defaultDelayMillis;
                while (downloadStarted && retries > 0) {
                    await delay();
                    retries -= 1;
                }
            }
            finally {
                try {
                    await browser?.close();
                }
                catch { }
            }
        });
    }
    async exportPartOrderPrint(orderNumber, exportType = 'PDF') {
        const { browser, page } = await this.#getLoggedInFasterPage();
        await this.#navigateToFasterReportPage(browser, page, '/Part Order Print/W299 - OrderPrint', {
            OrderID: orderNumber.toString(),
            TimeZoneID: this.#timeZone.toString(),
            ReportType: 'S',
            Domain: 'Inventory'
        });
        return await this.#exportFasterReport(browser, page, exportType);
    }
    async exportAssetMasterList(exportType = 'PDF') {
        const { browser, page } = await this.#getLoggedInFasterPage();
        await this.#navigateToFasterReportPage(browser, page, '/Assets/W114 - Asset Master List', {
            TimeZone: this.#timeZone.toString(),
            ReportType: 'S',
            Domain: 'Assets',
            Parent: 'Reports'
        }, {
            'Primary Grouping': 'Organization',
            'Secondary Grouping': 'Department'
        });
        return await this.#exportFasterReport(browser, page, exportType);
    }
    async #exportWorkOrderPrint(workOrderNumber, exportType, printButtonSelector) {
        const { browser, page } = await this.#getLoggedInFasterPage();
        try {
            await page.goto(`${this.#fasterBaseUrl}/Domains/Maintenance/WorkOrder/WorkOrderMaster.aspx?workOrderID=${workOrderNumber}`, {
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
            const reportViewerTarget = await browser.waitForTarget((target) => {
                return target.url().toLowerCase().includes('reportviewer.aspx');
            }, {
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
                await browser?.close();
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
