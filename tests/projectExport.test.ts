import { describe, expect, it } from 'vitest'
import { buildProjectWorkbookSheets } from '../src/projectExport.ts'
import { UNKNOWN_PROJECT_LABEL } from '../src/constants'
import type { ProjectSummary } from '../src/types'
import type { Occurrence } from '../src/types'
import { makeOccurrence } from './utils'

const baseFormatters = {
  formatDate: (date: Date) => date.toISOString(),
  formatHours: (minutes: number) => `${minutes}m`,
  formatCancellationDate: (event: Occurrence) => event.lastModified?.toISOString() ?? '—',
  formatCreationDate: (event: Occurrence) => event.dtstamp?.toISOString() ?? '—',
  formatOrganizerEmail: (value: string | null) => value ?? '—',
  formatOrganizerList: (emails: string[]) => (emails.length ? emails.join('|') : '—'),
  formatClassificationLabel: (classification: Occurrence['classification']) => classification,
  getEventProjectLabel: (event: Occurrence) => event.projectCode ?? 'UNKNOWN',
  isProjectBillable: (projectCode: string) => projectCode !== 'Z',
}

describe('buildProjectWorkbookSheets', () => {
  it('creates a main summary sheet followed by individual project sheets', () => {
    const alphaEvent = makeOccurrence({
      projectCode: 'ALPHA',
      summary: 'Alpha Session',
      billableMinutes: 90,
      durationMinutes: 120,
      start: new Date('2025-08-01T10:00:00Z'),
      end: new Date('2025-08-01T12:00:00Z'),
      organizer: 'alpha@libc.org',
    })
    const betaEvent = makeOccurrence({
      projectCode: 'BETA',
      summary: 'Beta Session',
      billableMinutes: 60,
      durationMinutes: 60,
      start: new Date('2025-08-02T09:00:00Z'),
      end: new Date('2025-08-02T10:00:00Z'),
      organizer: 'beta@libc.org',
    })
    const unknownEvent = makeOccurrence({
      projectCode: null,
      summary: 'Uncoded Session',
      billableMinutes: 0,
      durationMinutes: 30,
      start: new Date('2025-08-03T09:00:00Z'),
      end: new Date('2025-08-03T09:30:00Z'),
      classification: 'CANCELLED_ON_TIME',
    })

    const summaries: ProjectSummary[] = [
      {
        projectCode: 'ALPHA',
        totalMinutes: 150,
        totalHours: 2.5,
        totalDurationMinutes: 180,
        totalDurationHours: 3,
        activeCount: 1,
        cancelledOnTimeCount: 0,
        cancelledLateCount: 1,
        cancelledOnTimeMinutes: 0,
        cancelledLateMinutes: 60,
        organizers: ['alpha@libc.org'],
      },
      {
        projectCode: 'BETA',
        totalMinutes: 60,
        totalHours: 1,
        totalDurationMinutes: 60,
        totalDurationHours: 1,
        activeCount: 1,
        cancelledOnTimeCount: 0,
        cancelledLateCount: 0,
        cancelledOnTimeMinutes: 0,
        cancelledLateMinutes: 0,
        organizers: ['beta@libc.org'],
      },
      {
        projectCode: UNKNOWN_PROJECT_LABEL,
        totalMinutes: 0,
        totalHours: 0,
        totalDurationMinutes: 30,
        totalDurationHours: 0.5,
        activeCount: 0,
        cancelledOnTimeCount: 1,
        cancelledLateCount: 0,
        cancelledOnTimeMinutes: 30,
        cancelledLateMinutes: 0,
        organizers: [],
      },
    ]

    const sheets = buildProjectWorkbookSheets([alphaEvent, betaEvent, unknownEvent], summaries, baseFormatters)

    expect(sheets[0].name).toBe('Main Summary')
    expect(sheets[0].data[0]).toEqual([
      'Project',
      'Organizer(s)',
      'Total billable hours',
      'Total duration (hours)',
      'Billable percentage',
      'Active events',
      'On-time cancellations',
      'On-time cancellation percentage',
      'Late cancellations',
      'Late-cancellation percentage',
      'Billable',
    ])
    expect(sheets[0].data[1]).toEqual([
      'ALPHA',
      'alpha@libc.org',
      '2.50',
      '3.00',
      '83.33%',
      1,
      0,
      '0.00%',
      1,
      '33.33%',
      'true',
    ])
    expect(sheets[0].data[4]).toEqual([
      'TOTALS',
      '—',
      '3.50',
      '4.50',
      '77.78%',
      2,
      1,
      '11.11%',
      1,
      '22.22%',
      '—',
    ])

    expect(sheets[0].data[5]).toEqual([
      `TOTAL ALL EXCEPT ${UNKNOWN_PROJECT_LABEL}`,
      '—',
      '3.50',
      '4.00',
      '87.50%',
      2,
      0,
      '0.00%',
      1,
      '25.00%',
      '—',
    ])

    const betaSheet = sheets.find((sheet) => sheet.name === 'BETA')
    expect(betaSheet).toBeDefined()
    expect(betaSheet?.data[0]).toEqual([
      'Title',
      'Start',
      'End',
      'Cancelled',
      'Created',
      'Organizer(s)',
      'Status',
      'Duration (hours)',
      'Billable hours',
    ])
    expect(betaSheet?.data[1]).toEqual([
      'Beta Session',
      betaEvent.start.toISOString(),
      betaEvent.end.toISOString(),
      betaEvent.lastModified?.toISOString() ?? '—',
      betaEvent.dtstamp?.toISOString() ?? '—',
      'beta@libc.org',
      betaEvent.classification,
      '60m',
      '60m',
    ])
  })

  it('zeros billable hours for sheets tied to non-billable projects', () => {
    const nonBillableEvent = makeOccurrence({
      projectCode: 'Z',
      summary: 'Maintenance',
      billableMinutes: 120,
      durationMinutes: 120,
      start: new Date('2025-08-03T10:00:00Z'),
      end: new Date('2025-08-03T12:00:00Z'),
    })

    const summaries: ProjectSummary[] = [
      {
        projectCode: 'Z',
        totalMinutes: 120,
        totalHours: 2,
        totalDurationMinutes: 120,
        totalDurationHours: 2,
        activeCount: 1,
        cancelledOnTimeCount: 0,
        cancelledLateCount: 0,
        cancelledOnTimeMinutes: 0,
        cancelledLateMinutes: 0,
        organizers: [],
      },
    ]

    const sheets = buildProjectWorkbookSheets([nonBillableEvent], summaries, baseFormatters)
    const sheet = sheets[1]
    expect(sheet.name).toBe('Z')
    expect(sheet.data[1][8]).toBe('0m')
    expect(sheets[0].data[1][2]).toBe('0.00')
  })
})
