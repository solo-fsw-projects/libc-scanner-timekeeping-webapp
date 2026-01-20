import type { Occurrence, RawOccurrence } from '../src/types'

let rawCounter = 0
let occurrenceCounter = 0

const defaultStart = new Date('2025-05-01T10:00:00Z')
const defaultEnd = new Date('2025-05-01T11:00:00Z')

export function makeRawOccurrence(overrides: Partial<RawOccurrence> = {}): RawOccurrence {
  rawCounter += 1
  const start = overrides.start ?? new Date(defaultStart)
  const defaultModified = overrides.lastModified ?? new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000)
  return {
    uid: overrides.uid ?? `raw-${rawCounter}`,
    summary: overrides.summary ?? '[ALPHA] Test session',
    description: overrides.description ?? null,
    location: overrides.location ?? null,
    status: overrides.status ?? null,
    organizer: overrides.organizer ?? 'alpha@libc.org',
    sequence: overrides.sequence ?? 0,
    start,
    end: overrides.end ?? new Date(defaultEnd),
    allDay: overrides.allDay ?? false,
    tzid: overrides.tzid ?? 'UTC',
    appointmentSequenceTime: overrides.appointmentSequenceTime ?? defaultModified,
    created: overrides.created ?? new Date(defaultStart),
    lastModified: defaultModified,
    dtstamp: overrides.dtstamp ?? new Date(defaultStart),
    busyStatus: overrides.busyStatus ?? null,
    recurrenceId: overrides.recurrenceId ?? null,
    sourceType: overrides.sourceType ?? 'single',
  }
}

export function makeOccurrence(overrides: Partial<Occurrence> = {}): Occurrence {
  occurrenceCounter += 1
  const start = overrides.start ?? new Date(defaultStart)
  const end = overrides.end ?? new Date(defaultEnd)
  const projectCode = overrides.projectCode === undefined ? 'ALPHA' : overrides.projectCode
  return {
    ...makeRawOccurrence({ ...overrides, start, end }),
    id: overrides.id ?? `occ-${occurrenceCounter}`,
    projectCode,
    isCancelled: overrides.isCancelled ?? false,
    classification: overrides.classification ?? 'ACTIVE',
    durationMinutes:
      overrides.durationMinutes ?? Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000)),
    billableMinutes: overrides.billableMinutes ?? Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000)),
  }
}
