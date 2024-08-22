# FASTER Web Report Exporter

[![npm (scoped)](https://img.shields.io/npm/v/%40cityssm/faster-report-exporter)](https://www.npmjs.com/package/@cityssm/faster-report-exporter)
[![DeepSource](https://app.deepsource.com/gh/cityssm/node-faster-report-exporter.svg/?label=active+issues&show_trend=true&token=bslC1GSndvK7fVXDTJ9K4Lgi)](https://app.deepsource.com/gh/cityssm/node-faster-report-exporter/)
[![Maintainability](https://api.codeclimate.com/v1/badges/43c2a67bb2cb61d6220e/maintainability)](https://codeclimate.com/github/cityssm/node-faster-report-exporter/maintainability)

**On demand exports of selected reports from the
[FASTER Web Fleet Management System](https://fasterasset.com/products/fleet-management-software/)**.

This module uses a headless Puppeteer browser to log into FASTER Web,
navigate to the appropriate report, and select the preferred export format.
Once downloaded, the module returns the path to the downloaded file.

## Installation

```sh
npm install @cityssm/faster-report-exporter
```

## Usage

```javascript
import { FasterReportExporter } from '@cityssm/faster-report-exporter'

const reportExporter = new FasterReportExporter(
  fasterTenant,
  fasterUserName,
  fasterPassword
)

reportExporter.setDownloadFolderPath('C:\\Temp')

/*
 * Part Orders
 */

const partOrderReport =
  await reportExporter.exportPartOrderPrint(partOrderNumber)

console.log(partOrderReport)
// => "C:\Temp\70578b74-261c-499c-bdfe-1ca6c17967b1.pdf"

/*
 * Work Orders
 */

const technicianReport =
  await reportExporter.exportWorkOrderTechnicianPrint(workOrderNumber)

const customerReport =
  await reportExporter.exportWorkOrderCustomerPrint(workOrderNumber)
```

## More Code for FASTER Web

[FASTER Web Helper](https://github.com/cityssm/faster-web-helper)<br />
A service to support integrations with the FASTER Web fleet management system.

[FASTER Web Report Parser](https://github.com/cityssm/node-faster-report-parser)<br />
Parses select Excel and CSV reports from FASTER Web into usable data objects.

[Userscripts for FASTER Web](https://cityssm.github.io/userscripts/#userscripts-for-faster-web)<br />
Fixes some of the common irks when using FASTER Web.
Includes userscripts to enforce field validation, correct varying header heights,
and offer autocomplete.
