import { UNKNOWN_PROJECT_LABEL } from './constants'
import { normalizeOrganizerEmail } from './organizers'
import type { DatasetStats, Occurrence, ProjectSummary } from './types'

type SummaryAccumulator = {
  projectCode: string
  totalMinutes: number
  totalDurationMinutes: number
  activeCount: number
  cancelledOnTimeCount: number
  cancelledLateCount: number
  cancelledOnTimeMinutes: number
  cancelledLateMinutes: number
  organizerSet: Set<string>
}

export function buildProjectSummaries(events: Occurrence[]): ProjectSummary[] {
  const map = new Map<string, SummaryAccumulator>()

  events.forEach((event) => {
    const label = event.projectCode ?? UNKNOWN_PROJECT_LABEL
    if (!map.has(label)) {
      map.set(label, {
        projectCode: label,
        totalMinutes: 0,
        totalDurationMinutes: 0,
        activeCount: 0,
        cancelledOnTimeCount: 0,
        cancelledLateCount: 0,
        cancelledOnTimeMinutes: 0,
        cancelledLateMinutes: 0,
        organizerSet: new Set<string>(),
      })
    }

    const summary = map.get(label)!
    summary.totalDurationMinutes += event.durationMinutes
    const organizerEmail = normalizeOrganizerEmail(event.organizer)
    if (organizerEmail) {
      summary.organizerSet.add(organizerEmail)
    }
    switch (event.classification) {
      case 'ACTIVE':
        summary.activeCount += 1
        summary.totalMinutes += event.billableMinutes
        break
      case 'CANCELLED_LATE':
        summary.cancelledLateCount += 1
        summary.cancelledLateMinutes += event.durationMinutes
        summary.totalMinutes += event.billableMinutes
        break
      case 'CANCELLED_ON_TIME':
        summary.cancelledOnTimeCount += 1
        summary.cancelledOnTimeMinutes += event.durationMinutes
        break
    }
  })

  return Array.from(map.values())
    .map((summary) => {
      const totalHours = +(summary.totalMinutes / 60).toFixed(2)
      const totalDurationHours = +(summary.totalDurationMinutes / 60).toFixed(2)
      const organizers = Array.from(summary.organizerSet).sort((a, b) => a.localeCompare(b))
      return {
        projectCode: summary.projectCode,
        totalMinutes: summary.totalMinutes,
        totalHours,
        totalDurationMinutes: summary.totalDurationMinutes,
        totalDurationHours,
        activeCount: summary.activeCount,
        cancelledOnTimeCount: summary.cancelledOnTimeCount,
        cancelledLateCount: summary.cancelledLateCount,
        cancelledOnTimeMinutes: summary.cancelledOnTimeMinutes,
        cancelledLateMinutes: summary.cancelledLateMinutes,
        organizers,
      }
    })
    .sort((a, b) => a.projectCode.localeCompare(b.projectCode))
}

export function buildDatasetStats(events: Occurrence[], summaries: ProjectSummary[]): DatasetStats {
  const billableMinutes = summaries.reduce((acc, item) => acc + item.totalMinutes, 0)
  
  // Calculate duration metrics per event type in a single pass
  let activeMinutes = 0
  let cancelledOnTimeMinutes = 0
  let cancelledLateMinutes = 0
  let lateCancelledBillableMinutes = 0
  let lateCancellationCount = 0
  
  events.forEach((evt) => {
    switch (evt.classification) {
      case 'ACTIVE':
        activeMinutes += evt.durationMinutes
        break
      case 'CANCELLED_ON_TIME':
        cancelledOnTimeMinutes += evt.durationMinutes
        break
      case 'CANCELLED_LATE':
        cancelledLateMinutes += evt.durationMinutes
        lateCancelledBillableMinutes += evt.billableMinutes
        lateCancellationCount += 1
        break
    }
  })
  
  // Calculate late cancellation coverage percentage
  // This is the percentage of late cancellation duration that was NOT billed
  // Late cancellations are typically billed, so the "coverage" is how much was forgiven
  const lateCancellationNotBilledMinutes = cancelledLateMinutes - lateCancelledBillableMinutes
  const lateCancellationCoveragePercentage = 
    cancelledLateMinutes > 0 
      ? +(lateCancellationNotBilledMinutes / cancelledLateMinutes * 100).toFixed(2)
      : 0

  return {
    eventCount: events.length,
    projectCount: summaries.length,
    billableHours: +(billableMinutes / 60).toFixed(2),
    lateCancellationCount,
    activeDurationHours: +(activeMinutes / 60).toFixed(2),
    cancelledOnTimeDurationHours: +(cancelledOnTimeMinutes / 60).toFixed(2),
    cancelledLateDurationHours: +(cancelledLateMinutes / 60).toFixed(2),
    lateCancellationCoveragePercentage,
  }
}
