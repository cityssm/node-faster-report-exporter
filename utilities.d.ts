export declare const defaultDelayMillis = 500;
export declare const longDelayMillis = 1500;
/**
 * Pause execution for a given amount of time.
 * @param delayMillis - Time to wait in milliseconds
 */
export declare function delay(delayMillis?: number): Promise<void>;
