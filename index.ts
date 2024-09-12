import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { URL } from 'node:url'

import puppeteerLaunch, { type puppeteer } from '@cityssm/puppeteer-launch'
import Debug from 'debug'

import { delay, getElementOnPageBySelector } from './utilities.js'

const debug = Debug('faster-report-exporter:index')

interface ReportParameters extends Record<string, string> {
  ReportType: 'S'
  Domain: 'Inventory' | 'Maintenance'
}

const exportTypes = {
  PDF: 'pdf',
  CSV: 'csv',
  Excel: 'xlsx',
  Word: 'docx'
}

type ReportExportType = keyof typeof exportTypes

const shortDelayMillis = 500

export class FasterReportExporter {
  readonly #fasterBaseUrl: `https://${string}.fasterwebcloud.com/FASTER`
  readonly #fasterUserName: string
  readonly #fasterPassword: string

  #downloadFolderPath = os.tmpdir()

  #useHeadlessBrowser = true
  #timeoutMillis = 60_000

  constructor(
    fasterTenant: string,
    fasterUserName: string,
    fasterPassword: string
  ) {
    this.#fasterBaseUrl = `https://${fasterTenant}.fasterwebcloud.com/FASTER`
    this.#fasterUserName = fasterUserName
    this.#fasterPassword = fasterPassword
  }

  setDownloadFolderPath(downloadFolderPath: string): void {
    this.#downloadFolderPath = downloadFolderPath
  }

  /**
   * Changes the timeout for loading the browser and navigating between pages.
   * @param timeoutMillis - Number of milliseconds.
   */
  setTimeoutMillis(timeoutMillis: number): void {
    this.#timeoutMillis = timeoutMillis

    if (timeoutMillis < 30_000) {
      debug('Warning: Timeouts less than 30s are not recommended.')
    }
  }

  /**
   * Switches off headless mode, making the browser window visible.
   * Useful for debugging.
   */
  showBrowserWindow(): void {
    this.#useHeadlessBrowser = false
  }

  async #getLoggedInFasterPage(): Promise<{
    browser: puppeteer.Browser
    page: puppeteer.Page
  }> {
    // eslint-disable-next-line @typescript-eslint/init-declarations
    let browser: puppeteer.Browser | undefined

    try {
      browser = await puppeteerLaunch({
        browser: 'chrome',
        protocol: 'cdp',
        headless: this.#useHeadlessBrowser,
        timeout: this.#timeoutMillis
      })

      /*
       * Load Faster
       */

      debug('Logging into FASTER...')

      const page = await browser.newPage()

      await page.goto(this.#fasterBaseUrl, {
        timeout: this.#timeoutMillis
      })

      await page.waitForNetworkIdle({
        timeout: this.#timeoutMillis
      })

      /*
       * Log in if need be
       */

      const loginFormElement = await page.$('#form_Signin')

      if (loginFormElement !== null) {
        debug('Filling out login form...')

        const userNameElement = await loginFormElement.$(
          '#LoginControl_UserName'
        )

        if (userNameElement === null) {
          throw new Error('Unable to locate user name field.')
        }

        await userNameElement.type(this.#fasterUserName)

        const passwordElement = await loginFormElement.$(
          '#LoginControl_Password'
        )

        if (passwordElement === null) {
          throw new Error('Unable to locate password field.')
        }

        await passwordElement.type(this.#fasterPassword)

        const submitButtonElement = await loginFormElement.$(
          '#LoginControl_SignInButton_input'
        )

        if (submitButtonElement === null) {
          throw new Error('Unable to locate Sign In button.')
        }

        await submitButtonElement.click()

        await delay(shortDelayMillis)

        await page.waitForNetworkIdle({
          timeout: this.#timeoutMillis
        })

        if (page.url().toLowerCase().includes('release/releasenotes.aspx')) {
          debug('Release notes page, continuing...')

          const continueButtonElement = await page.$('#OKRadButon_input')

          if (continueButtonElement !== null) {
            await continueButtonElement.click()

            await delay(shortDelayMillis)

            await page.waitForNetworkIdle({
              timeout: this.#timeoutMillis
            })
          }
        }
      }

      debug('Finished logging in.')

      return {
        browser,
        page
      }
    } catch (error) {
      try {
        await browser?.close()
      } catch {}

      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw error
    }
  }

  async #navigateToFasterReportPage(
    browser: puppeteer.Browser,
    page: puppeteer.Page,
    reportKey: `/${string}`,
    reportParameters: ReportParameters
  ): Promise<{ browser: puppeteer.Browser; page: puppeteer.Page }> {
    try {
      /*
       * Navigate to report
       */

      const reportUrl = new URL(
        `${this.#fasterBaseUrl}/Domains/Reports/ReportViewer.aspx`
      )

      reportUrl.searchParams.set('R', reportKey)

      for (const [parameterKey, parameterValue] of Object.entries(
        reportParameters
      )) {
        reportUrl.searchParams.set(parameterKey, parameterValue)
      }

      await page.goto(reportUrl.href, {
        timeout: this.#timeoutMillis
      })

      await delay(shortDelayMillis)

      await page.waitForNetworkIdle({
        timeout: this.#timeoutMillis
      })

      return {
        browser,
        page
      }
    } catch (error) {
      try {
        await browser?.close()
      } catch {}

      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw error
    }
  }

  /**
   * Exports a FASTER report to a file.
   * @param browser - Puppeteer browser
   * @param page - Puppeteer page on a report page
   * @param exportType - Output file type
   * @returns - Path to the exported file.
   */
  async #exportFasterReport(
    browser: puppeteer.Browser,
    page: puppeteer.Page,
    exportType: ReportExportType = 'PDF'
  ): Promise<string> {
    await page.bringToFront()

    debug(`Report Page Title: ${await page.title()}`)

    // eslint-disable-next-line @typescript-eslint/no-misused-promises, no-async-promise-executor, sonarjs/no-misused-promises
    return await new Promise(async (resolve) => {
      try {
        /*
         * Catch the download
         */

        const cdpSession = await browser.target().createCDPSession()

        await cdpSession.send('Browser.setDownloadBehavior', {
          behavior: 'allowAndName',
          downloadPath: this.#downloadFolderPath,
          eventsEnabled: true
        })

        cdpSession.on('Browser.downloadProgress', (event) => {
          if (event.state === 'completed') {
            debug('Download complete.')

            const downloadedFilePath = path.join(
              this.#downloadFolderPath,
              event.guid
            )

            // eslint-disable-next-line security/detect-object-injection
            const newFilePath = `${downloadedFilePath}.${exportTypes[exportType]}`

            // eslint-disable-next-line security/detect-non-literal-fs-filename
            fs.rename(downloadedFilePath, newFilePath, (error) => {
              if (error === null) {
                debug(`File: ${newFilePath}`)
                resolve(newFilePath)
              } else {
                debug(`File: ${downloadedFilePath}`)
                resolve(downloadedFilePath)
              }
            })
          } else if (event.state === 'canceled') {
            throw new Error('Download cancelled.')
          }
        })

        /*
         * Print to PDF
         */

        await page.waitForNetworkIdle({
          timeout: this.#timeoutMillis
        })

        debug(`Finding the print button for "${exportType}"...`)

        const printOptionsMenuElement = await getElementOnPageBySelector(
          page,
          '#RvDetails_ctl05_ctl04_ctl00_ButtonLink',
          20
        )

        if (printOptionsMenuElement === null) {
          throw new Error('Unable to locate print options.')
        }

        await printOptionsMenuElement.click()

        await delay(shortDelayMillis * 2)

        await page.waitForNetworkIdle({
          timeout: this.#timeoutMillis
        })

        const printOptionElement = await page.$(
          `#RvDetails_ctl05_ctl04_ctl00_Menu a[title^='${exportType}']`
        )

        if (printOptionElement === null) {
          throw new Error(`Unable to locate "${exportType}" print type.`)
        }

        debug(`Print button found for "${exportType}"...`)

        await printOptionElement.click()

        debug('Print selected.')

        await delay(shortDelayMillis * 2)

        await page.waitForNetworkIdle({
          timeout: this.#timeoutMillis
        })
      } finally {
        try {
          await browser?.close()
        } catch {}
      }
    })
  }

  async exportPartOrderPrint(
    orderNumber: number,
    exportType: ReportExportType = 'PDF'
  ): Promise<string> {
    const { browser, page } = await this.#getLoggedInFasterPage()

    await this.#navigateToFasterReportPage(
      browser,
      page,
      '/Part Order Print/W299 - OrderPrint',
      {
        OrderID: orderNumber.toString(),
        TimeZoneID: '1113',
        ReportType: 'S',
        Domain: 'Inventory'
      }
    )

    return await this.#exportFasterReport(browser, page, exportType)
  }

  async #exportWorkOrderPrint(
    workOrderNumber: number,
    exportType: ReportExportType,
    printButtonSelector: string
  ): Promise<string> {
    const { browser, page } = await this.#getLoggedInFasterPage()

    try {
      await page.goto(
        `${this.#fasterBaseUrl}/Domains/Maintenance/WorkOrder/WorkOrderMaster.aspx?workOrderID=${workOrderNumber}`,
        {
          timeout: this.#timeoutMillis
        }
      )

      await delay(shortDelayMillis)

      await page.waitForNetworkIdle()

      const printElement = await getElementOnPageBySelector(
        page,
        printButtonSelector
      )

      if (printElement === null) {
        throw new Error('Unable to locate print link.')
      }

      let pages = await browser.pages()

      const beforePageCount = pages.length
      let afterPageCount = beforePageCount

      await printElement.click()

      let retries = 5

      while (beforePageCount === afterPageCount && retries > 0) {
        await delay(shortDelayMillis)

        await page.waitForNetworkIdle({
          timeout: this.#timeoutMillis
        })

        pages = await browser.pages()
        afterPageCount = pages.length

        retries -= 1
      }

      const newPage = pages.at(-1)

      if (newPage === undefined) {
        throw new Error('Unable to locate new page.')
      }

      await delay(shortDelayMillis)

      await newPage.bringToFront()

      await delay(shortDelayMillis)

      await newPage.waitForNetworkIdle({
        timeout: this.#timeoutMillis
      })

      return await this.#exportFasterReport(browser, newPage, exportType)
    } catch (error) {
      try {
        await browser.close()
      } catch {}

      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw error
    }
  }

  async exportWorkOrderCustomerPrint(
    workOrderNumber: number,
    exportType: ReportExportType = 'PDF'
  ): Promise<string> {
    return await this.#exportWorkOrderPrint(
      workOrderNumber,
      exportType,
      // eslint-disable-next-line no-secrets/no-secrets
      '#ctl00_ContentPlaceHolder_Content_MasterWorkOrderDetailMenu_CustomerPrintLinkButton'
    )
  }

  async exportWorkOrderTechnicianPrint(
    workOrderNumber: number,
    exportType: ReportExportType = 'PDF'
  ): Promise<string> {
    return await this.#exportWorkOrderPrint(
      workOrderNumber,
      exportType,
      // eslint-disable-next-line no-secrets/no-secrets
      '#ctl00_ContentPlaceHolder_Content_MasterWorkOrderDetailMenu_WorkOrderPrintLinkButton'
    )
  }
}
