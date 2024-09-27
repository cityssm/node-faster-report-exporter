import type { puppeteer } from '@cityssm/puppeteer-launch'

import { delay } from './utilities.js'

const oneSecondMillis = 1000

/**
 * Populates the report filters on a Report Viewer page.
 * @param page - FASTER Web Report Viewer page
 * @param reportFilters - Filters applied to the report.
 * @param options - Options.
 * @param options.timeoutMillis - The regular pause interval.
 */
export async function applyReportFilters(
  page: puppeteer.Page,
  reportFilters: Record<string, string>,
  options: {
    timeoutMillis: number
  }
): Promise<void> {
  await page.waitForSelector('label')

  const labelElements = await page.$$('label')

  const labelTextToInputId: Record<string, string> = {}

  for (const labelElement of labelElements) {
    const labelText = await labelElement.evaluate((element) => {
      return element.textContent
    }, labelElement)

    if (labelText === null) {
      continue
    }

    // eslint-disable-next-line security/detect-object-injection
    labelTextToInputId[labelText] =
      (await labelElement.evaluate((element) => {
        return element.getAttribute('for')
      })) ?? ''
  }

  for (const [labelSearchText, inputValue] of Object.entries(reportFilters)) {
    let inputId = ''

    for (const [labelText, possibleInputId] of Object.entries(
      labelTextToInputId
    )) {
      if (labelText.includes(labelSearchText)) {
        inputId = possibleInputId
        break
      }
    }

    if (inputId === '') {
      throw new Error(`No filter found with label: ${labelSearchText}`)
    }

    const inputElement = (await page.waitForSelector(`#${inputId}`, {
      timeout: options.timeoutMillis
    })) as puppeteer.ElementHandle<HTMLSelectElement | HTMLInputElement> | null

    if (inputElement === null) {
      throw new Error(`No element found with id: ${inputId}`)
    }

    await page.type(`#${inputId}`, inputValue)

    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    if (Object.keys(reportFilters).length > 1) {
      await delay(Math.max(options.timeoutMillis, oneSecondMillis))
    }
  }

  const submitButtonElement = await page.waitForSelector(
    'a:has(input[type="submit"])'
  )

  await submitButtonElement?.scrollIntoView()
  await submitButtonElement?.click()

  await delay(Math.max(options.timeoutMillis, oneSecondMillis))

  await page.waitForNetworkIdle({
    timeout: options.timeoutMillis
  })
}
