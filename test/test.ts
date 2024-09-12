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

  // reportExporter.showBrowserWindow()

  await it('Exports a part order', async () => {
    try {
      const reportPath = await reportExporter.exportPartOrderPrint(
        partOrderNumber,
        'Word'
      )

      assert(reportPath)
    } catch {
      assert.fail()
    }
  })

  await it('Exports a work order customer print', async () => {
    try {
      const reportPath =
        await reportExporter.exportWorkOrderCustomerPrint(workOrderNumber)

      assert(reportPath)
    } catch {
      assert.fail()
    }
  })

  await it('Exports a work order technician print', async () => {
    try {
      const reportPath =
        await reportExporter.exportWorkOrderTechnicianPrint(workOrderNumber)

      console.log(reportPath)
    } catch {
      assert.fail()
    }
  })
})
