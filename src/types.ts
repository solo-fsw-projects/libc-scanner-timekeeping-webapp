export type EventClassification = 'ACTIVE' | 'CANCELLED_ON_TIME' | 'CANCELLED_LATE'

export interface RawOccurrence {
  uid: string
  summary: string
  description: string | null
  location: string | null
  status: string | null
  organizer: string | null
  sequence: number | null
  start: Date
  end: Date
  allDay: boolean
  tzid: string | null
  appointmentSequenceTime: Date | null
  created: Date | null
  lastModified: Date | null
  dtstamp: Date | null
  busyStatus: string | null
  recurrenceId: string | null
  sourceType: 'single' | 'occurrence' | 'exception'
}

export interface Occurrence extends RawOccurrence {
  id: string
  projectCode: string | null
  isCancelled: boolean
  classification: EventClassification
  durationMinutes: number
  billableMinutes: number
}

export interface ProjectSummary {
  projectCode: string
  totalMinutes: number
  totalHours: number
  totalDurationMinutes: number
  totalDurationHours: number
  activeCount: number
  cancelledOnTimeCount: number
  cancelledLateCount: number
  cancelledOnTimeMinutes: number
  cancelledLateMinutes: number
  cancelledLateBillableMinutes: number
  organizers: string[]
}

export interface DatasetStats {
  eventCount: number
  projectCount: number
  billableHours: number
  lateCancellationCount: number
  activeDurationHours: number
  cancelledOnTimeDurationHours: number
  cancelledLateDurationHours: number
  /** 
   * Percentage of late-cancelled time that was NOT billed (forgiven).
   * Formula: ((lateCancelledMinutes - lateCancelledBillableMinutes) / lateCancelledMinutes) * 100
   * 
   * Example: If 100 minutes were late-cancelled and 30 were billed, coverage = 70%
   * (70% of the late cancellation time was forgiven/covered)
   */
  lateCancellationCoveragePercentage: number
}
