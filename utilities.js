import { promisify } from 'node:util';
const setTimeoutPromise = promisify(setTimeout);
export const defaultDelayMillis = 500;
export const longDelayMillis = 1500;
/**
 * Pause execution for a given amount of time.
 * @param delayMillis - Time to wait in milliseconds
 */
export async function delay(delayMillis) {
    await setTimeoutPromise(delayMillis ?? defaultDelayMillis);
}
