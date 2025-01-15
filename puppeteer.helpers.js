// eslint-disable-next-line @eslint-community/eslint-comments/disable-enable-pair
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
import { delay, longDelayMillis } from './utilities.js';
/**
 * Populates the report filters on a Report Viewer page.
 * @param page - FASTER Web Report Viewer page
 * @param reportFilters - Filters applied to the report.
 * @param options - Options.
 * @param options.timeoutMillis - The regular pause interval.
 */
export async function applyReportFilters(page, reportFilters, options) {
    await page.waitForSelector('label');
    const labelElements = await page.$$('label');
    const labelTextToInputId = {};
    for (const labelElement of labelElements) {
        const labelText = await labelElement.evaluate((element) => element.textContent, labelElement);
        if (labelText === null) {
            continue;
        }
        // eslint-disable-next-line security/detect-object-injection
        labelTextToInputId[labelText] =
            (await labelElement.evaluate((element) => element.getAttribute('for'))) ?? '';
    }
    for (const [labelSearchText, inputValue] of Object.entries(reportFilters)) {
        let inputId = '';
        for (const [labelText, possibleInputId] of Object.entries(labelTextToInputId)) {
            if (labelText.includes(labelSearchText)) {
                inputId = possibleInputId;
                break;
            }
        }
        if (inputId === '') {
            throw new Error(`No filter found with label: ${labelSearchText}`);
        }
        const inputElement = (await page.waitForSelector(`#${inputId}`, {
            timeout: options.timeoutMillis
        }));
        if (inputElement === null) {
            throw new Error(`No element found with id: ${inputId}`);
        }
        await inputElement.evaluate((element) => {
            if (element.tagName === 'INPUT') {
                element.value = '';
            }
        });
        await inputElement.type(inputValue);
        await inputElement.evaluate((element) => {
            ;
            element.blur();
        });
        if (Object.keys(reportFilters).length > 1) {
            await delay(longDelayMillis);
            await page.waitForNetworkIdle({
                timeout: options.timeoutMillis
            });
        }
    }
    const submitButtonElement = await page.waitForSelector('a:has(input[type="submit"])');
    await submitButtonElement?.scrollIntoView();
    await submitButtonElement?.click();
    await delay(longDelayMillis);
    await page.waitForNetworkIdle({
        timeout: options.timeoutMillis
    });
}
