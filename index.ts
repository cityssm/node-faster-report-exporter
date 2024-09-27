import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { URL } from 'node:url'

import puppeteerLaunch, { type puppeteer } from '@cityssm/puppeteer-launch'
import Debug from 'debug'

import {
  minimumRecommendedTimeoutSeconds,
  reportExportTypes
} from './lookups.js'
import { applyReportFilters } from './puppeteerHelpers.js'
import type {
  ReportExportType,
  ReportParameters,
  ReportTimeZone
} from './types.js'
import { defaultDelayMillis, delay, longDelayMillis } from './utilities.js'

const debug = Debug('faster-report-exporter:index')

interface FasterReportExporterOptions {
  downloadFolderPath: string
  timeoutMillis: number
  showBrowserWindow: boolean
  timeZone: ReportTimeZone
}

export class FasterReportExporter {
  readonly #fasterBaseUrl: `https://${string}.fasterwebcloud.com/FASTER`
  readonly #fasterUserName: string
  readonly #fasterPassword: string

  #downloadFolderPath = os.tmpdir()

  #useHeadlessBrowser = true

  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  #timeoutMillis = Math.max(90_000, minimumRecommendedTimeoutSeconds)

  #timeZone: ReportTimeZone = 'Eastern'

  /**
   * Initializes the FasterReportExporter.
   * @param fasterTenant - The subdomain of the FASTER Web URL before ".fasterwebcloud.com"
   * @param fasterUserName - The user name
   * @param fasterPassword - The password
   * @param options - Options
   */
  constructor(
    fasterTenant: string,
    fasterUserName: string,
    fasterPassword: string,
    options: Partial<FasterReportExporterOptions> = {}
  ) {
    this.#fasterBaseUrl = `https://${fasterTenant}.fasterwebcloud.com/FASTER`
    this.#fasterUserName = fasterUserName
    this.#fasterPassword = fasterPassword

    if (options.downloadFolderPath !== undefined) {
      this.setDownloadFolderPath(options.downloadFolderPath)
    }

    if (options.timeoutMillis !== undefined) {
      this.setTimeoutMillis(options.timeoutMillis)
    }

    if (options.showBrowserWindow !== undefined && options.showBrowserWindow) {
      this.showBrowserWindow()
    }

    if (options.timeZone !== undefined) {
      this.#timeZone = options.timeZone
    }
  }

  /**
   * Sets the folder where downloaded reports are saved.
   * @param downloadFolderPath - The folder where downloaded reports are saved.
   */
  setDownloadFolderPath(downloadFolderPath: string): void {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(downloadFolderPath)) {
      throw new Error(
        `Download folder path does not exist: ${downloadFolderPath}`
      )
    }

    this.#downloadFolderPath = downloadFolderPath
  }

  /**
   * Changes the timeout for loading the browser and navigating between pages.
   * @param timeoutMillis - Number of milliseconds.
   */
  setTimeoutMillis(timeoutMillis: number): void {
    this.#timeoutMillis = timeoutMillis

    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    if (timeoutMillis < minimumRecommendedTimeoutSeconds * 1000) {
      debug(
        `Warning: Timeouts less than ${minimumRecommendedTimeoutSeconds}s are not recommended.`
      )
    }
  }

  /**
   * Switches off headless mode, making the browser window visible.
   * Useful for debugging.
   */
  showBrowserWindow(): void {
    this.#useHeadlessBrowser = false
  }

  /**
   * Changes the time zone parameter used in reports.
   * @param timezone - The preferred report time zone.
   */
  setTimeZone(timezone: ReportTimeZone): void {
    this.#timeZone = timezone
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

        await submitButtonElement.scrollIntoView()
        await submitButtonElement.click()

        await delay()

        await page.waitForNetworkIdle({
          timeout: this.#timeoutMillis
        })

        if (page.url().toLowerCase().includes('release/releasenotes.aspx')) {
          debug('Release notes page, continuing...')

          const continueButtonElement = await page.$('#OKRadButon_input')

          if (continueButtonElement !== null) {
            await continueButtonElement.scrollIntoView()
            await continueButtonElement.click()

            await delay()

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

  // eslint-disable-next-line @typescript-eslint/max-params
  async #navigateToFasterReportPage(
    browser: puppeteer.Browser,
    page: puppeteer.Page,
    reportKey: `/${string}`,
    reportParameters: ReportParameters,
    reportFilters?: Record<string, string>
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

      await delay()

      await page.waitForNetworkIdle({
        timeout: this.#timeoutMillis
      })

      if (reportFilters !== undefined) {
        await applyReportFilters(page, reportFilters, {
          timeoutMillis: this.#timeoutMillis
        })
      }

      return {
        browser,
        page
      }
    } catch (error) {
      try {
        await browser.close()
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

    await page.waitForNetworkIdle({
      timeout: this.#timeoutMillis
    })

    debug(`Report Page Title: ${await page.title()}`)

    // eslint-disable-next-line @typescript-eslint/no-misused-promises, no-async-promise-executor, sonarjs/no-misused-promises
    return await new Promise(async (resolve) => {
      let downloadStarted = false

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
            const newFilePath = `${downloadedFilePath}.${reportExportTypes[exportType]}`

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

            downloadStarted = false
          } else if (event.state === 'canceled') {
            downloadStarted = false
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

        const printOptionsMenuElement = await page.waitForSelector(
          '#RvDetails_ctl05_ctl04_ctl00_ButtonLink',
          { timeout: this.#timeoutMillis }
        )

        if (printOptionsMenuElement === null) {
          throw new Error(
            'Unable to locate print options. Consider extending the timeout millis.'
          )
        }

        await printOptionsMenuElement.click()

        await delay(longDelayMillis)

        await page.waitForNetworkIdle({
          timeout: this.#timeoutMillis
        })

        const printOptionElement = await page.waitForSelector(
          `#RvDetails_ctl05_ctl04_ctl00_Menu a[title^='${exportType}']`,
          { timeout: this.#timeoutMillis }
        )

        if (printOptionElement === null) {
          throw new Error(`Unable to locate "${exportType}" print type.`)
        }

        debug(`Print button found for "${exportType}"...`)

        await delay()

        downloadStarted = true

        await printOptionElement.scrollIntoView()
        await printOptionElement.click()

        debug('Print selected.')

        await delay(longDelayMillis)

        await page.waitForNetworkIdle({
          timeout: this.#timeoutMillis
        })

        let retries = this.#timeoutMillis / defaultDelayMillis

        // eslint-disable-next-line sonarjs/no-infinite-loop, no-unmodified-loop-condition
        while (downloadStarted && retries > 0) {
          await delay()
          retries--
        }
      } finally {
        try {
          await browser.close()
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
        ReportType: 'S',
        Domain: 'Inventory'
      },
      {
        'Time Zone': this.#timeZone
      }
    )

    return await this.#exportFasterReport(browser, page, exportType)
  }

  async exportAssetList(exportType: ReportExportType = 'PDF'): Promise<string> {
    const { browser, page } = await this.#getLoggedInFasterPage()

    await this.#navigateToFasterReportPage(
      browser,
      page,
      '/Assets/W114 - Asset Master List',
      {
        ReportType: 'S',
        Domain: 'Assets',
        Parent: 'Reports'
      },
      {
        'Time Zone': this.#timeZone,
        'Primary Grouping': 'Organization',
        'Secondary Grouping': 'Department'
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

      await delay()

      await page.waitForNetworkIdle({
        timeout: this.#timeoutMillis
      })

      const printElement = await page.waitForSelector(printButtonSelector, {
        timeout: this.#timeoutMillis
      })

      if (printElement === null) {
        throw new Error('Unable to locate print link.')
      }

      await printElement.scrollIntoView()
      await printElement.click()

      const reportViewerTarget = await browser.waitForTarget(
        (target) => {
          return target.url().toLowerCase().includes('reportviewer.aspx')
        },
        {
          timeout: this.#timeoutMillis
        }
      )

      const newPage = await reportViewerTarget.asPage()

      await delay()

      await newPage.bringToFront()

      await delay()

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
