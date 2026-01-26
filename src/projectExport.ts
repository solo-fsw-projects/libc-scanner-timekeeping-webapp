import { UNKNOWN_PROJECT_LABEL } from './constants'
import type { Occurrence, ProjectSummary } from './types'
import type { WorksheetSpec } from './workbook'

export interface ProjectExportFormatters {
  formatDate: (date: Date) => string
  formatHours: (minutes: number) => string
  formatCancellationDate: (event: Occurrence) => string
  formatCreationDate: (event: Occurrence) => string
  formatOrganizerEmail: (value: string | null) => string
  formatOrganizerList: (emails: string[]) => string
  formatClassificationLabel: (classification: Occurrence['classification']) => string
  getEventProjectLabel: (event: Occurrence) => string
  isProjectBillable: (projectCode: string) => boolean
}

export function buildProjectWorkbookSheets(
  events: Occurrence[],
  summaries: ProjectSummary[],
  formatters: ProjectExportFormatters,
): WorksheetSpec[] {
  const mainSummarySheet = buildMainSummarySheet(summaries, formatters)
  const projectSheets = summaries.map((summary) => buildProjectSheet(summary, events, formatters))
  return [mainSummarySheet, ...projectSheets]
}

function buildMainSummarySheet(
  summaries: ProjectSummary[],
  formatters: ProjectExportFormatters,
): WorksheetSpec {
  const header = [
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
    'Late-cancellation coverage',
    'Billable',
  ]

  const makeTotals = () => ({
    billableMinutes: 0,
    durationMinutes: 0,
    activeCount: 0,
    onTimeCount: 0,
    lateCount: 0,
    onTimeMinutes: 0,
    lateMinutes: 0,
    lateBillableMinutes: 0,
  })
  const totals = makeTotals()
  const totalsExcludingUnknown = makeTotals()

  const rows = summaries.map((summary) => {
    const billable = formatters.isProjectBillable(summary.projectCode)
    const organizerList = formatters.formatOrganizerList(summary.organizers)
    const billableMinutes = billable ? summary.totalMinutes : 0
    const billableHours = billable ? summary.totalHours : 0
    const durationMinutes = summary.totalDurationMinutes
    const isUnknownProject = summary.projectCode === UNKNOWN_PROJECT_LABEL
    const lateBillableMinutes = billable ? summary.cancelledLateBillableMinutes : 0
    totals.billableMinutes += billableMinutes
    totals.durationMinutes += durationMinutes
    totals.activeCount += summary.activeCount
    totals.onTimeCount += summary.cancelledOnTimeCount
    totals.lateCount += summary.cancelledLateCount
    totals.onTimeMinutes += summary.cancelledOnTimeMinutes
    totals.lateMinutes += summary.cancelledLateMinutes
    totals.lateBillableMinutes += lateBillableMinutes
    if (!isUnknownProject) {
      totalsExcludingUnknown.billableMinutes += summary.totalMinutes
      totalsExcludingUnknown.durationMinutes += durationMinutes
      totalsExcludingUnknown.activeCount += summary.activeCount
      totalsExcludingUnknown.onTimeCount += summary.cancelledOnTimeCount
      totalsExcludingUnknown.lateCount += summary.cancelledLateCount
      totalsExcludingUnknown.onTimeMinutes += summary.cancelledOnTimeMinutes
      totalsExcludingUnknown.lateMinutes += summary.cancelledLateMinutes
      totalsExcludingUnknown.lateBillableMinutes += lateBillableMinutes
    }
    return [
      summary.projectCode,
      organizerList,
      billableHours.toFixed(2),
      summary.totalDurationHours.toFixed(2),
      formatPercentage(billableMinutes, durationMinutes),
      summary.activeCount,
      summary.cancelledOnTimeCount,
      formatPercentage(summary.cancelledOnTimeMinutes, durationMinutes),
      summary.cancelledLateCount,
      formatPercentage(summary.cancelledLateMinutes, durationMinutes),
      formatLateCancellationCoverage(summary.cancelledLateMinutes, lateBillableMinutes),
      billable ? 'true' : 'false',
    ]
  })

  const totalsRow = [
    'TOTALS',
    '—',
    formatHoursFromMinutes(totals.billableMinutes),
    formatHoursFromMinutes(totals.durationMinutes),
    formatPercentage(totals.billableMinutes, totals.durationMinutes),
    totals.activeCount,
    totals.onTimeCount,
    formatPercentage(totals.onTimeMinutes, totals.durationMinutes),
    totals.lateCount,
    formatPercentage(totals.lateMinutes, totals.durationMinutes),
    formatLateCancellationCoverage(totals.lateMinutes, totals.lateBillableMinutes),
    '—',
  ]

  const totalsKnownProjectsRow = [
    `TOTAL ALL EXCEPT ${UNKNOWN_PROJECT_LABEL}`,
    '—',
    formatHoursFromMinutes(totalsExcludingUnknown.billableMinutes),
    formatHoursFromMinutes(totalsExcludingUnknown.durationMinutes),
    formatPercentage(totalsExcludingUnknown.billableMinutes, totalsExcludingUnknown.durationMinutes),
    totalsExcludingUnknown.activeCount,
    totalsExcludingUnknown.onTimeCount,
    formatPercentage(totalsExcludingUnknown.onTimeMinutes, totalsExcludingUnknown.durationMinutes),
    totalsExcludingUnknown.lateCount,
    formatPercentage(totalsExcludingUnknown.lateMinutes, totalsExcludingUnknown.durationMinutes),
    formatLateCancellationCoverage(totalsExcludingUnknown.lateMinutes, totalsExcludingUnknown.lateBillableMinutes),
    '—',
  ]

  return { name: 'Main Summary', data: [header, ...rows, totalsRow, totalsKnownProjectsRow] }
}

function buildProjectSheet(
  summary: ProjectSummary,
  events: Occurrence[],
  formatters: ProjectExportFormatters,
): WorksheetSpec {
  const isBillable = formatters.isProjectBillable(summary.projectCode)
  const header = [
    'Title',
    'Start',
    'End',
    'Cancelled',
    'Created',
    'Organizer(s)',
    'Status',
    'Duration (hours)',
    'Billable hours',
  ]

  const rows = events
    .filter((event) => formatters.getEventProjectLabel(event) === summary.projectCode)
    .map((event) => {
      const organizer = formatters.formatOrganizerEmail(event.organizer)
      const duration = formatters.formatHours(event.durationMinutes)
      const billableMinutes = isBillable ? event.billableMinutes : 0
      return [
        event.summary,
        formatters.formatDate(event.start),
        formatters.formatDate(event.end),
        formatters.formatCancellationDate(event),
        formatters.formatCreationDate(event),
        organizer,
        formatters.formatClassificationLabel(event.classification),
        duration,
        formatters.formatHours(billableMinutes),
      ]
    })

  return { name: summary.projectCode, data: [header, ...rows] }
}

function formatPercentage(value: number, total: number): string {
  if (value <= 0 || total <= 0) {
    return '0.00%'
  }
  return `${((value / total) * 100).toFixed(2)}%`
}

/**
 * Formats the late cancellation coverage percentage.
 * 
 * Late cancellation coverage represents the percentage of late-cancelled time
 * that was NOT billed (i.e., forgiven). This metric helps administrators understand
 * how much of the late cancellation duration was covered/forgiven rather than charged.
 * 
 * Formula: ((lateMinutes - lateBillableMinutes) / lateMinutes) * 100
 * 
 * Examples:
 * - If 100 minutes were late-cancelled and all 100 were billed: coverage = 0%
 * - If 100 minutes were late-cancelled and 50 were billed: coverage = 50%
 * - If 100 minutes were late-cancelled and 0 were billed: coverage = 100%
 * 
 * @param lateMinutes Total duration (in minutes) of late-cancelled events
 * @param lateBillableMinutes Duration (in minutes) of late-cancelled events that were actually billed
 * @returns Formatted percentage string (e.g., "50.00%")
 */
function formatLateCancellationCoverage(lateMinutes: number, lateBillableMinutes: number): string {
  if (lateMinutes <= 0) {
    return '0.00%'
  }
  const notBilledMinutes = lateMinutes - lateBillableMinutes
  return `${((notBilledMinutes / lateMinutes) * 100).toFixed(2)}%`
}

function formatHoursFromMinutes(minutes: number): string {
  if (minutes <= 0) {
    return '0.00'
  }
  return (minutes / 60).toFixed(2)
}
