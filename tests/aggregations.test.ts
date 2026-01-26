import { describe, expect, it } from 'vitest'
import { buildDatasetStats, buildProjectSummaries } from '../src/aggregations'
import type { Occurrence } from '../src/types'
import { makeOccurrence } from './utils'

describe('buildProjectSummaries', () => {
  // Ensures per-project totals, durations, and organizer lists are aggregated correctly.
  it('aggregates billable totals, durations, and organizer sets per project', () => {
    const events: Occurrence[] = [
      makeOccurrence({
        projectCode: 'ALPHA',
        classification: 'ACTIVE',
        start: new Date('2025-06-01T08:00:00Z'),
        end: new Date('2025-06-01T10:00:00Z'),
        billableMinutes: 120,
        organizer: 'alpha@libc.org',
      }),
      makeOccurrence({
        projectCode: 'ALPHA',
        classification: 'CANCELLED_LATE',
        start: new Date('2025-06-02T09:00:00Z'),
        end: new Date('2025-06-02T10:00:00Z'),
        billableMinutes: 30,
        organizer: 'alpha.ops@libc.org',
      }),
      makeOccurrence({
        projectCode: null,
        classification: 'CANCELLED_ON_TIME',
        start: new Date('2025-06-03T09:00:00Z'),
        end: new Date('2025-06-03T10:30:00Z'),
        billableMinutes: 0,
        organizer: 'unknown@libc.org',
      }),
    ]

    const summaries = buildProjectSummaries(events)
    const alpha = summaries.find((summary) => summary.projectCode === 'ALPHA')
    const unknown = summaries.find((summary) => summary.projectCode === 'UNKNOWN')

    expect(alpha).toBeDefined()
    expect(alpha?.totalMinutes).toBe(150)
    expect(alpha?.totalHours).toBeCloseTo(2.5)
    expect(alpha?.totalDurationMinutes).toBe(180)
    expect(alpha?.organizers).toEqual(['alpha.ops@libc.org', 'alpha@libc.org'].sort())

    expect(alpha?.activeCount).toBe(1)
    expect(alpha?.cancelledLateCount).toBe(1)
    expect(alpha?.cancelledLateMinutes).toBe(60)
    expect(alpha?.cancelledOnTimeMinutes).toBe(0)

    expect(unknown).toBeDefined()
    expect(unknown?.totalMinutes).toBe(0)
    expect(unknown?.cancelledOnTimeCount).toBe(1)
    expect(unknown?.cancelledOnTimeMinutes).toBe(90)
    expect(unknown?.cancelledLateMinutes).toBe(0)
  })
})

describe('buildDatasetStats', () => {
  // Validates dataset-level counters and billable-hour sums reflect the input occurrences.
  it('summarizes dataset-level billable hours and counts', () => {
    const events: Occurrence[] = [
      makeOccurrence({ classification: 'ACTIVE' }),
      makeOccurrence({ classification: 'CANCELLED_LATE' }),
      makeOccurrence({ classification: 'CANCELLED_ON_TIME' }),
    ]
    const summaries = buildProjectSummaries(events)
    const stats = buildDatasetStats(events, summaries)

    expect(stats.eventCount).toBe(3)
    expect(stats.projectCount).toBe(summaries.length)
    expect(stats.lateCancellationCount).toBe(1)
    expect(stats.billableHours).toBeGreaterThan(0)
  })

  // Validates that new duration metrics are calculated correctly per event type
  it('calculates duration metrics per event type correctly', () => {
    const events: Occurrence[] = [
      makeOccurrence({
        classification: 'ACTIVE',
        start: new Date('2025-06-01T08:00:00Z'),
        end: new Date('2025-06-01T10:00:00Z'), // 120 minutes
        durationMinutes: 120,
      }),
      makeOccurrence({
        classification: 'ACTIVE',
        start: new Date('2025-06-02T08:00:00Z'),
        end: new Date('2025-06-02T09:00:00Z'), // 60 minutes
        durationMinutes: 60,
      }),
      makeOccurrence({
        classification: 'CANCELLED_ON_TIME',
        start: new Date('2025-06-03T08:00:00Z'),
        end: new Date('2025-06-03T10:30:00Z'), // 150 minutes
        durationMinutes: 150,
      }),
      makeOccurrence({
        classification: 'CANCELLED_LATE',
        start: new Date('2025-06-04T08:00:00Z'),
        end: new Date('2025-06-04T09:30:00Z'), // 90 minutes
        durationMinutes: 90,
      }),
    ]
    const summaries = buildProjectSummaries(events)
    const stats = buildDatasetStats(events, summaries)

    // Active: 120 + 60 = 180 minutes = 3 hours
    expect(stats.activeDurationHours).toBe(3)
    
    // Cancelled on time: 150 minutes = 2.5 hours
    expect(stats.cancelledOnTimeDurationHours).toBe(2.5)
    
    // Cancelled late: 90 minutes = 1.5 hours
    expect(stats.cancelledLateDurationHours).toBe(1.5)
  })

  // Validates late cancellation coverage percentage calculation
  it('calculates late cancellation coverage percentage correctly', () => {
    const events: Occurrence[] = [
      makeOccurrence({
        classification: 'CANCELLED_LATE',
        durationMinutes: 100,
        billableMinutes: 100, // Fully billed
      }),
      makeOccurrence({
        classification: 'CANCELLED_LATE',
        durationMinutes: 100,
        billableMinutes: 50, // 50% billed, 50% forgiven
      }),
    ]
    const summaries = buildProjectSummaries(events)
    const stats = buildDatasetStats(events, summaries)

    // Total late cancellation: 200 minutes
    // Total billed: 150 minutes
    // Not billed (coverage): 50 minutes
    // Coverage percentage: 50/200 * 100 = 25%
    expect(stats.lateCancellationCoveragePercentage).toBe(25)
  })

  // Validates coverage percentage is 0 when all late cancellations are fully billed
  it('returns 0 coverage percentage when all late cancellations are fully billed', () => {
    const events: Occurrence[] = [
      makeOccurrence({
        classification: 'CANCELLED_LATE',
        durationMinutes: 100,
        billableMinutes: 100,
      }),
    ]
    const summaries = buildProjectSummaries(events)
    const stats = buildDatasetStats(events, summaries)

    expect(stats.lateCancellationCoveragePercentage).toBe(0)
  })

  // Validates coverage percentage is 0 when there are no late cancellations
  it('returns 0 coverage percentage when there are no late cancellations', () => {
    const events: Occurrence[] = [
      makeOccurrence({ classification: 'ACTIVE' }),
      makeOccurrence({ classification: 'CANCELLED_ON_TIME' }),
    ]
    const summaries = buildProjectSummaries(events)
    const stats = buildDatasetStats(events, summaries)

    expect(stats.lateCancellationCoveragePercentage).toBe(0)
    expect(stats.cancelledLateDurationHours).toBe(0)
  })

  // Validates coverage percentage is 100 when no late cancellations are billed
  it('returns 100 coverage percentage when no late cancellations are billed', () => {
    const events: Occurrence[] = [
      makeOccurrence({
        classification: 'CANCELLED_LATE',
        durationMinutes: 100,
        billableMinutes: 0,
      }),
    ]
    const summaries = buildProjectSummaries(events)
    const stats = buildDatasetStats(events, summaries)

    expect(stats.lateCancellationCoveragePercentage).toBe(100)
  })
})
