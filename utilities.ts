import type { puppeteer } from '@cityssm/puppeteer-launch'

/**
 * Pause execution for a given amount of time.
 * @param delayMillis - Time to wait in milliseconds
 */
export async function delay(delayMillis: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, delayMillis))
}

/**
 * Attempts to retrieve an element from a puppeteer page, retrying a number of times if not found.
 * @param page - Puppeteer page.
 * @param selector - HTML selector.
 * @param maxRetries - Number of retries.
 * @returns - An element, if available.
 */
export async function getElementOnPageBySelector(
  page: puppeteer.Page,
  selector: string,
  maxRetries = 5
): Promise<puppeteer.ElementHandle | null> {
  // eslint-disable-next-line @typescript-eslint/init-declarations
  let element: puppeteer.ElementHandle | null | undefined

  for (let retry = 0; retry < maxRetries; retry += 1) {
    if (retry > 0) {
      await delay(100)
    }

    element = await page.$(selector)

    if (element !== null) {
      break
    }
  }

  return element as puppeteer.ElementHandle | null
}
