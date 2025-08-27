// eslint-disable-next-line @eslint-community/eslint-comments/disable-enable-pair
/* eslint-disable max-lines */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { URL } from 'node:url'

import FasterUrlBuilder from '@cityssm/faster-url-builder'
import puppeteerLaunch, { type puppeteer } from '@cityssm/puppeteer-launch'
import { secondsToMillis } from '@cityssm/to-millis'
import { dateToString } from '@cityssm/utils-datetime'
import Debug from 'debug'

import { DEBUG_NAMESPACE } from './debug.config.js'
import {
  minimumRecommendedTimeoutSeconds,
  reportExportTypes
} from './lookups.js'
import { applyReportFilters } from './puppeteer.helpers.js'
import type {
  ReportExportType,
  ReportParameters,
  ReportTimeZone
} from './types.js'
import { defaultDelayMillis, delay, longDelayMillis } from './utilities.js'

const debug = Debug(`${DEBUG_NAMESPACE}:index`)

export interface FasterReportExporterOptions {
  downloadFolderPath: string
  timeoutMillis: number
  timeZone: ReportTimeZone

  /**
   * Show the browser window.
   * Useful for debugging.
   * @default false
   */
  showBrowserWindow: boolean
}

export class FasterReportExporter {
  readonly fasterUrlBuilder: FasterUrlBuilder

  readonly #fasterPassword: string
  readonly #fasterUserName: string

  #downloadFolderPath = os.tmpdir()

  #useHeadlessBrowser = true

  #timeoutMillis = secondsToMillis(
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    Math.max(120, minimumRecommendedTimeoutSeconds)
  )

  #timeZone: ReportTimeZone = 'Eastern'

  /**
   * Initializes the FasterReportExporter.
   * @param fasterTenantOrBaseUrl - The subdomain of the FASTER Web URL before ".fasterwebcloud.com"
   *                                or the full domain and path including "/FASTER"
   * @param fasterUserName - The user name
   * @param fasterPassword - The password
   * @param options - Options
   */
  constructor(
    fasterTenantOrBaseUrl: string,
    fasterUserName: string,
    fasterPassword: string,
    options: Partial<FasterReportExporterOptions> = {}
  ) {
    this.fasterUrlBuilder = new FasterUrlBuilder(fasterTenantOrBaseUrl)

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

    if (timeoutMillis < secondsToMillis(minimumRecommendedTimeoutSeconds)) {
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

  /**
   * Gets a browser and page that are logged into FASTER.
   * @returns browser and page, be sure to close the browser when done.
   */
  async _getLoggedInFasterPage(): Promise<{
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

      await page.goto(this.fasterUrlBuilder.baseUrl, {
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

          // eslint-disable-next-line @cspell/spellchecker
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

      const reportUrl = new URL(this.fasterUrlBuilder.reportViewerUrl)

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

    // eslint-disable-next-line @typescript-eslint/no-misused-promises, no-async-promise-executor, promise/avoid-new
    return await new Promise<string>(async (resolve) => {
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

        const reportErrorTextExists = await page.evaluate(() =>
          document.body.textContent.includes(
            'You do not have permissions to access the reports.'
          )
        )

        if (reportErrorTextExists) {
          throw new Error('Report generation failed: insufficient permissions.')
        }

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

        // eslint-disable-next-line no-unmodified-loop-condition, @typescript-eslint/no-unnecessary-condition
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

  /**
   * Exports a Part Order Print (W299) report for a given order number.
   * @param orderNumber - The order number.
   * @param exportType - The export type.
   * @returns The path to the exported report.
   */
  async exportPartOrderPrint(
    orderNumber: number,
    exportType?: ReportExportType
  ): Promise<string> {
    const { browser, page } = await this._getLoggedInFasterPage()

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

  /**
   * Exports an Inventory Report (W200).
   * @param exportType - The export type.
   * @returns The path to the exported report.
   */
  async exportInventory(exportType?: ReportExportType): Promise<string> {
    const { browser, page } = await this._getLoggedInFasterPage()

    await this.#navigateToFasterReportPage(
      browser,
      page,
      '/Inventory/W200 - Inventory Report',
      {
        ReportType: 'S',
        Domain: 'Inventory',
        Parent: 'Reports'
      },
      {
        'Time Zone': this.#timeZone,
        'Grouping within Storeroom': 'Item Category'
      }
    )

    return await this.#exportFasterReport(browser, page, exportType)
  }

  /**
   * Export an Asset Master List (W114) report.
   * @param exportType - The export type.
   * @returns The path to the exported report.
   */
  async exportAssetList(exportType?: ReportExportType): Promise<string> {
    const { browser, page } = await this._getLoggedInFasterPage()

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

  /**
   * Export a Work Order Details by Work Order Number (W300N) report.
   * @param minWorkOrderNumber - Minimum work order number.
   * @param maxWorkOrderNumber - Maximum work order number.
   * @param exportType - The export type.
   * @returns The path to the exported report.
   */
  async exportWorkOrderDetails(
    minWorkOrderNumber: number,
    maxWorkOrderNumber?: number,
    exportType?: ReportExportType
  ): Promise<string> {
    const minWorkOrderNumberString = minWorkOrderNumber.toString()
    const maxWorkOrderNumberString = (
      maxWorkOrderNumber ?? minWorkOrderNumber
    ).toString()

    const { browser, page } = await this._getLoggedInFasterPage()

    await this.#navigateToFasterReportPage(
      browser,
      page,
      // eslint-disable-next-line no-secrets/no-secrets
      '/Maintenance/W300n - WorkOrderDetailsByWONumber',
      {
        ReportType: 'S',
        Domain: 'Maintenance',
        Parent: 'Reports'
      },
      {
        'Time Zone': this.#timeZone,
        'Beginning Work Order Number': minWorkOrderNumberString,
        'Ending Work Order Number': maxWorkOrderNumberString
      }
    )

    return await this.#exportFasterReport(browser, page, exportType)
  }

  async #exportWorkOrderPrint(
    workOrderNumber: number,
    exportType: ReportExportType,
    printButtonSelector: string
  ): Promise<string> {
    const { browser, page } = await this._getLoggedInFasterPage()

    try {
      await page.goto(this.fasterUrlBuilder.workOrderUrl(workOrderNumber), {
        timeout: this.#timeoutMillis
      })

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
        (target) => target.url().toLowerCase().includes('reportviewer.aspx'),
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

      throw error
    }
  }

  /**
   * Exports the Customer Print (W398) for a given work order.
   * @param workOrderNumber - The work order number.
   * @param exportType - The export type.
   * @returns The path to the exported report.
   */
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

  /**
   * Exports the Technician Print (W399) for a given work order.
   * @param workOrderNumber - The work order number.
   * @param exportType - The export type.
   * @returns The path to the exported report.
   */
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

  /**
   * Exports the Message Logger (W603) report.
   * @param startDate - The start date
   * @param endDate - The end date
   * @param exportType - The export type
   * @returns The path to the exported report.
   */
  async exportMessageLogger(
    startDate: Date = new Date(),
    endDate: Date = new Date(),
    exportType?: ReportExportType
  ): Promise<string> {
    const { browser, page } = await this._getLoggedInFasterPage()

    await this.#navigateToFasterReportPage(
      browser,
      page,
      '/Setup/W603 - Message Logger',
      {
        ReportType: 'S',
        Domain: 'Setup',
        Parent: 'Reports'
      },
      {
        'Time Zone': this.#timeZone,
        'Start Date': dateToString(startDate),
        'End Date': dateToString(endDate)
      }
    )

    return await this.#exportFasterReport(browser, page, exportType)
  }

  /**
   * Exports a scheduled report by name.
   * Helpful for exporting reports with complex parameters.
   * @param scheduleName - Schedule name
   * @param startDate - The start date
   * @param endDate - The end date
   * @param exportType - The export type
   * @returns The path to the exported report.
   */
  async exportScheduledReport(
    scheduleName: string,
    startDate: Date = new Date(),
    endDate: Date = new Date(),
    exportType?: ReportExportType
  ): Promise<string> {
    let { browser, page } = await this._getLoggedInFasterPage()

    try {
      await page.goto(this.fasterUrlBuilder.scheduledReportsUrl, {
        timeout: this.#timeoutMillis
      })

      await page.waitForNetworkIdle({
        timeout: this.#timeoutMillis
      })

      // Find the report row

      const scheduledReportsTableRowElements = await page.$$(
        // eslint-disable-next-line no-secrets/no-secrets
        '#ctl00_ContentPlaceHolder_Content_ScheduleRadDock_C_ScheduleRadGrid_ctl00 tbody tr'
      )

      for (const scheduledReportsTableRowElement of scheduledReportsTableRowElements) {
        const reportNameElement = await scheduledReportsTableRowElement.$(
          'td:nth-child(2) div span'
        )

        if (reportNameElement === null) {
          continue
        }

        const reportNameText = await reportNameElement.evaluate((cell) =>
          cell.textContent?.trim()
        )

        if (reportNameText === scheduleName) {
          debug(`Scheduled report found: ${scheduleName}`)

          const actionLinkElements =
            await scheduledReportsTableRowElement.$$('td:nth-child(1) a')

          for (const actionLinkElement of actionLinkElements) {
            const actionLinkText = await actionLinkElement.evaluate(
              (cell) => cell.textContent
            )

            if (actionLinkText === 'Parameter') {
              debug(`Opening report: ${scheduleName}`)

              await actionLinkElement.click()

              await delay()

              await page.waitForNetworkIdle({
                timeout: this.#timeoutMillis
              })

              const browserPages = await browser.pages()

              page = browserPages.at(-1) as puppeteer.Page

              await page.bringToFront()

              await delay()

              await page.waitForNetworkIdle({
                timeout: this.#timeoutMillis
              })

              await applyReportFilters(
                page,
                {
                  'Start Date': dateToString(startDate),
                  'End Date': dateToString(endDate)
                },
                {
                  timeoutMillis: this.#timeoutMillis
                }
              )

              break
            }
          }
        }
      }
    } catch (error) {
      try {
        await browser.close()
      } catch {}

      throw error
    }

    return await this.#exportFasterReport(browser, page, exportType)
  }
}
