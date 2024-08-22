import assert from 'node:assert'
import { describe, it } from 'node:test'

import { FasterReportExporter } from '../index.js'

import {
  fasterPassword,
  fasterTenant,
  fasterUserName,
  partOrderNumber,
  workOrderNumber
} from './config.js'

await describe('node-faster-report-exporter', async () => {
  const reportExporter = new FasterReportExporter(
    fasterTenant,
    fasterUserName,
    fasterPassword
  )

  reportExporter.showBrowserWindow()

  await it('Exports a part order', async () => {
    const reportPath = await reportExporter.exportPartOrderPrint(
      partOrderNumber,
      'Word'
    )

    console.log(reportPath)

    assert(reportPath !== undefined)
  })

  await it('Exports a work order customer print', async () => {
    const reportPath =
      await reportExporter.exportWorkOrderCustomerPrint(workOrderNumber)

    console.log(reportPath)

    assert(reportPath !== undefined)
  })

  await it('Exports a work order technician print', async () => {
    const reportPath =
      await reportExporter.exportWorkOrderTechnicianPrint(workOrderNumber)

    console.log(reportPath)

    assert(reportPath !== undefined)
  })
})
