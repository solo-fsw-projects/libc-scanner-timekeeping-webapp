import { utils as XLSXUtils, writeFile as writeXlsxFile } from 'xlsx'
import type { WorkBook } from 'xlsx'

export type WorksheetSpec = { name: string; data: Array<Array<string | number>> }

export function createWorkbook(sheets: WorksheetSpec[]): WorkBook {
  const workbook = XLSXUtils.book_new()
  sheets.forEach((sheet) => {
    const worksheet = XLSXUtils.aoa_to_sheet(sheet.data)
    XLSXUtils.book_append_sheet(workbook, worksheet, sheet.name)
  })
  return workbook
}

export function downloadWorkbook(filename: string, sheets: WorksheetSpec[]): void {
  const workbook = createWorkbook(sheets)
  writeXlsxFile(workbook, filename)
}
