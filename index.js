import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { URL } from 'node:url';
import { puppeteer } from '@cityssm/puppeteer-launch';
import { delay } from './utilities.js';
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
    constructor(fasterTenant, fasterUserName, fasterPassword) {
        this.#fasterBaseUrl = `https://${fasterTenant}.fasterwebcloud.com/FASTER`;
        this.#fasterUserName = fasterUserName;
        this.#fasterPassword = fasterPassword;
    }
    setDownloadFolderPath(downloadFolderPath) {
        this.#downloadFolderPath = downloadFolderPath;
    }
    showBrowserWindow() {
        this.#useHeadlessBrowser = false;
    }
    async #getLoggedInFasterPage() {
        let browser;
        try {
            browser = await puppeteer.launch({ headless: this.#useHeadlessBrowser });
            const page = await browser.newPage();
            await page.goto(this.#fasterBaseUrl);
            await page.waitForNetworkIdle();
            const loginFormElement = await page.$('#form_Signin');
            if (loginFormElement !== null) {
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
                await submitButtonElement.click();
                await page.waitForNetworkIdle();
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
    async #navigateToFasterReportPage(browser, page, reportKey, reportParameters) {
        try {
            const reportUrl = new URL(`${this.#fasterBaseUrl}/Domains/Reports/ReportViewer.aspx`);
            reportUrl.searchParams.set('R', reportKey);
            for (const [parameterKey, parameterValue] of Object.entries(reportParameters)) {
                reportUrl.searchParams.set(parameterKey, parameterValue);
            }
            await page.goto(reportUrl.href);
            await page.waitForNetworkIdle();
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
        return await new Promise(async (resolve) => {
            try {
                const cdpSession = await browser.target().createCDPSession();
                await cdpSession.send('Browser.setDownloadBehavior', {
                    behavior: 'allowAndName',
                    downloadPath: this.#downloadFolderPath,
                    eventsEnabled: true
                });
                cdpSession.on('Browser.downloadProgress', (event) => {
                    if (event.state === 'completed') {
                        const downloadedFilePath = path.join(this.#downloadFolderPath, event.guid);
                        const newFilePath = `${downloadedFilePath}.${exportTypes[exportType]}`;
                        fs.rename(downloadedFilePath, newFilePath, (error) => {
                            if (error === null) {
                                resolve(newFilePath);
                            }
                            else {
                                resolve(downloadedFilePath);
                            }
                        });
                    }
                    else if (event.state === 'canceled') {
                        throw new Error('Download cancelled.');
                    }
                });
                const printOptionsMenuElement = await page.$('#RvDetails_ctl05_ctl04_ctl00_ButtonLink');
                if (printOptionsMenuElement === null) {
                    throw new Error('Unable to locate print options.');
                }
                await printOptionsMenuElement.click();
                await page.waitForNetworkIdle();
                const printOptionElement = await page.$(`#RvDetails_ctl05_ctl04_ctl00_Menu a[title^='${exportType}']`);
                if (printOptionElement === null) {
                    throw new Error(`Unable to locate ${exportType} print type.`);
                }
                await printOptionElement.click();
                await page.waitForNetworkIdle();
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
            TimeZoneID: '1113',
            ReportType: 'S',
            Domain: 'Inventory'
        });
        return await this.#exportFasterReport(browser, page, exportType);
    }
    async #exportWorkOrderPrint(workOrderNumber, exportType, printButtonSelector) {
        const { browser, page } = await this.#getLoggedInFasterPage();
        try {
            await page.goto(`${this.#fasterBaseUrl}/Domains/Maintenance/WorkOrder/WorkOrderMaster.aspx?workOrderID=${workOrderNumber}`);
            await delay(500);
            await page.waitForNetworkIdle();
            const technicianPrintElement = await page.$(printButtonSelector);
            if (technicianPrintElement === null) {
                throw new Error('Unable to locate print link.');
            }
            await technicianPrintElement.click();
            await delay(500);
            await page.waitForNetworkIdle();
            const pages = await browser.pages();
            const newPage = pages.at(-1);
            if (newPage === undefined) {
                throw new Error('Unable to locate new page.');
            }
            await delay(500);
            await newPage.bringToFront();
            await delay(500);
            await newPage.waitForNetworkIdle();
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
