export const defaultDelayMillis = 500
export const longDelayMillis = 1500

/**
 * Pause execution for a given amount of time.
 * @param delayMillis - Time to wait in milliseconds
 */
export async function delay(delayMillis?: number): Promise<void> {
  await new Promise((resolve) =>
    setTimeout(resolve, delayMillis ?? defaultDelayMillis)
  )
}
