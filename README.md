# FASTER Web Report Exporter

[![npm (scoped)](https://img.shields.io/npm/v/%40cityssm/faster-report-exporter)](https://www.npmjs.com/package/@cityssm/faster-report-exporter)
[![DeepSource](https://app.deepsource.com/gh/cityssm/node-faster-report-exporter.svg/?label=active+issues&show_trend=true&token=bslC1GSndvK7fVXDTJ9K4Lgi)](https://app.deepsource.com/gh/cityssm/node-faster-report-exporter/)

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

/*
 * Message Logger
 */

const messageLoggerReport = await reportExporter.exportMessageLogger(
  startDate,
  endDate
)

/*
 * Scheduled Reports
 */

const scheduledReport = await reportExporter.exportScheduledReport(
  scheduleName,
  startDate,
  endDate
)
```

### Enabling Debug Output

This package uses the [debug](https://www.npmjs.com/package/debug) package
for debugging output.
For convenience, the debug namespace used by this pacakge,
and full namespace enable string are exported.

Debug output can be enabled programmatically, as shown in the example below.

```javascript
import { DEBUG_ENABLE_NAMESPACES } from '@cityssm/faster-report-exporter/debug'
import Debug from 'debug'

Debug.enable(DEBUG_ENABLE_NAMESPACES)
```

Debugging output can also be enabled using environment variables,
decribed in the debug package documentation.

## More Code for FASTER Web

[FASTER Web Report Parser](https://github.com/cityssm/node-faster-report-parser)<br />
Parses select Excel and CSV reports from FASTER Web into usable data objects.

[Even more open source projects related to FASTER Web](https://github.com/cityssm/faster-web-projects)
