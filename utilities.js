export async function delay(delayMillis) {
    await new Promise((resolve) => setTimeout(resolve, delayMillis));
}
export async function getElementOnPageBySelector(page, selector, maxRetries = 5) {
    let element;
    for (let retry = 0; retry < maxRetries; retry += 1) {
        if (retry > 0) {
            await delay(100);
        }
        element = await page.$(selector);
        if (element !== null) {
            break;
        }
    }
    return element;
}
