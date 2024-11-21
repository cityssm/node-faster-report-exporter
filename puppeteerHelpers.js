import { delay, longDelayMillis } from './utilities.js';
export async function applyReportFilters(page, reportFilters, options) {
    await page.waitForSelector('label');
    const labelElements = await page.$$('label');
    const labelTextToInputId = {};
    for (const labelElement of labelElements) {
        const labelText = await labelElement.evaluate((element) => {
            return element.textContent;
        }, labelElement);
        if (labelText === null) {
            continue;
        }
        labelTextToInputId[labelText] =
            (await labelElement.evaluate((element) => {
                return element.getAttribute('for');
            })) ?? '';
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
