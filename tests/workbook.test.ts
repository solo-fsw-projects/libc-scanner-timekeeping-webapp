import { describe, expect, it, vi, type Mock } from 'vitest'
import * as XLSX from 'xlsx'
import { createWorkbook, downloadWorkbook } from '../src/workbook'

vi.mock('xlsx', async () => {
  const actual = await vi.importActual<typeof import('xlsx')>('xlsx')
  return {
    ...actual,
    writeFile: vi.fn(),
  }
})

describe('createWorkbook', () => {
  // Confirms workbook creation preserves sheet order and data values.
  it('builds a workbook with every provided sheet and cell value', () => {
    const workbook = createWorkbook([
      { name: 'Events', data: [['Project', 'Hours'], ['ALPHA', 2]] },
      { name: 'Summary', data: [['Code', 'Billable'], ['ALPHA', 120]] },
    ])

    expect(workbook.SheetNames).toEqual(['Events', 'Summary'])
    const eventsSheet = XLSX.utils.sheet_to_json(workbook.Sheets['Events'], { header: 1 })
    const summarySheet = XLSX.utils.sheet_to_json(workbook.Sheets['Summary'], { header: 1 })

    expect(eventsSheet).toEqual([
      ['Project', 'Hours'],
      ['ALPHA', 2],
    ])
    expect(summarySheet).toEqual([
      ['Code', 'Billable'],
      ['ALPHA', 120],
    ])
  })
})

describe('downloadWorkbook', () => {
  // Verifies the workbook writer receives the generated workbook and filename.
  it('passes the generated workbook to the XLSX writer', () => {
    downloadWorkbook('report.xlsx', [{ name: 'Events', data: [['Project'], ['ALPHA']] }])

    const writer = XLSX.writeFile as unknown as Mock
    expect(writer).toHaveBeenCalledTimes(1)
    const [workbookArg, filenameArg] = writer.mock.calls[0]
    const eventsSheet = XLSX.utils.sheet_to_json((workbookArg as XLSX.WorkBook).Sheets['Events'], { header: 1 })

    expect(filenameArg).toBe('report.xlsx')
    expect(eventsSheet).toEqual([
      ['Project'],
      ['ALPHA'],
    ])
    vi.clearAllMocks()
  })
})
