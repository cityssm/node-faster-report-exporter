export const defaultDelayMillis = 500;
export const longDelayMillis = 1500;
export async function delay(delayMillis) {
    await new Promise((resolve) => setTimeout(resolve, delayMillis ?? defaultDelayMillis));
}
