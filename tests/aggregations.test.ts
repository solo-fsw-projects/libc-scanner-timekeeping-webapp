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
})
