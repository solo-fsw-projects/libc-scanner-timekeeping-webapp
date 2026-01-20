import { describe, expect, it } from 'vitest'
import { classifyOccurrences, detectCancellation, extractProjectCode } from '../src/classifier'
import type { RawOccurrence } from '../src/types'
import { makeRawOccurrence } from './utils'

describe('project code detection', () => {
  // Confirms bracketed codes are extracted and uppercased.
  it('extracts codes within brackets and uppercases result', () => {
    expect(extractProjectCode('[alpha] session')).toBe('ALPHA')
  })

  // Ensures no-code titles return null.
  it('returns null when no code present', () => {
    expect(extractProjectCode('No brackets here')).toBeNull()
  })
})

describe('cancellation detection', () => {
  // Verifies explicit CANCELLED status is enough to mark an event cancelled.
  it('detects explicit CANCELLED status', () => {
    const raw = makeRawOccurrence({ status: 'CANCELLED' })
    expect(detectCancellation(raw)).toBe(true)
  })

  // Ensures keyword detection is case-insensitive and matches anywhere in the title.
  it('detects cancellation keywords anywhere in the title regardless of case', () => {
    const raw = makeRawOccurrence({ summary: 'Follow-up [ALPHA] session - CaNcElAdO tonight', busyStatus: 'FREE' })
    expect(detectCancellation(raw)).toBe(true)
  })

  // Requires a FREE busy status when only keywords imply cancellation.
  it('requires FREE busy status when relying on keywords', () => {
    const base: RawOccurrence = makeRawOccurrence({ summary: 'Cancelled: [ALPHA] Demo', busyStatus: 'FREE' })
    expect(detectCancellation(base)).toBe(true)

    const busy: RawOccurrence = { ...base, busyStatus: 'BUSY' }
    expect(detectCancellation(busy)).toBe(false)
  })
})

describe('classifyOccurrences', () => {
  // Checks overlap adjustments and late/on-time classification outputs.
  it('assigns late/on-time statuses and adjusts billable minutes for overlaps', () => {
    const lateStart = new Date('2025-06-10T10:00:00Z')
    const lateEnd = new Date('2025-06-10T12:00:00Z')
    const late = makeRawOccurrence({
      summary: 'Cancelled: [ALPHA] Late drop',
      status: 'CANCELLED',
      busyStatus: 'FREE',
      start: lateStart,
      end: lateEnd,
      lastModified: new Date('2025-06-09T12:00:00Z'),
    })

    const active = makeRawOccurrence({
      summary: '[BETA] Replacement fill',
      status: 'CONFIRMED',
      busyStatus: 'BUSY',
      start: new Date('2025-06-10T11:00:00Z'),
      end: new Date('2025-06-10T13:00:00Z'),
      lastModified: new Date('2025-06-01T10:00:00Z'),
    })

    const onTime = makeRawOccurrence({
      summary: 'Cancelled: [GAMMA] Plenty notice',
      status: 'CANCELLED',
      busyStatus: 'FREE',
      start: new Date('2025-06-15T09:00:00Z'),
      end: new Date('2025-06-15T10:30:00Z'),
      lastModified: new Date('2025-05-20T09:00:00Z'),
    })

    const [lateEvt, activeEvt, onTimeEvt] = classifyOccurrences([late, active, onTime])

    expect(lateEvt.classification).toBe('CANCELLED_LATE')
    // Late cancellation loses the overlapped 60 minutes (11:00-12:00)
    expect(lateEvt.billableMinutes).toBe(60)

    expect(activeEvt.classification).toBe('ACTIVE')
    expect(activeEvt.billableMinutes).toBe(120)

    expect(onTimeEvt.classification).toBe('CANCELLED_ON_TIME')
    expect(onTimeEvt.billableMinutes).toBe(0)
  })

  // Prefers the Outlook appointment sequence time for cancellation dating.
  it('uses X-MS-OLK-APPTSEQTIME when determining late vs on-time', () => {
    const start = new Date('2025-08-10T09:00:00Z')
    const end = new Date('2025-08-10T10:00:00Z')

    const raw = makeRawOccurrence({
      summary: '[ALPHA] Cancel with appt seq',
      status: 'CANCELLED',
      busyStatus: 'FREE',
      start,
      end,
      appointmentSequenceTime: new Date('2025-08-08T12:00:00Z'),
      lastModified: new Date('2025-07-20T12:00:00Z'),
    })

    const [event] = classifyOccurrences([raw])

    expect(event.classification).toBe('CANCELLED_LATE')
  })

  // Keeps events with cancellation keywords but non-FREE busy status classified as active.
  it('retains ACTIVE classification when keywords appear but busy status is BUSY', () => {
    const busyKeyword = makeRawOccurrence({
      summary: 'Reminder: Session CANCELLED but still busy',
      busyStatus: 'BUSY',
      status: 'CONFIRMED',
    })

    const [event] = classifyOccurrences([busyKeyword])
    expect(event.classification).toBe('ACTIVE')
    expect(event.isCancelled).toBe(false)
  })

  // Ensures late cancellations are only compensated by billable replacement events.
  it('keeps full billable minutes when overlap is with a non-billable active event', () => {
    const late = makeRawOccurrence({
      summary: '[ALPHA] Late cancel',
      status: 'CANCELLED',
      busyStatus: 'FREE',
      start: new Date('2025-07-01T10:00:00Z'),
      end: new Date('2025-07-01T12:00:00Z'),
      lastModified: new Date('2025-06-30T12:00:00Z'),
    })

    const nonBillableActive = makeRawOccurrence({
      summary: '[Z] Maintenance hold',
      status: 'CONFIRMED',
      busyStatus: 'BUSY',
      start: new Date('2025-07-01T10:00:00Z'),
      end: new Date('2025-07-01T12:00:00Z'),
    })

    const occurrences = classifyOccurrences([late, nonBillableActive])
    const lateEvt = occurrences.find((event) => event.projectCode === 'ALPHA')!

    expect(lateEvt.billableMinutes).toBe(120)
  })

  // Allocates overlapping late cancellations to the one cancelled last.
  it('charges the later cancellation when two late cancellations overlap', () => {
    const first = makeRawOccurrence({
      summary: '[ALPHA] Late cancel A',
      status: 'CANCELLED',
      busyStatus: 'FREE',
      start: new Date('2025-07-05T10:00:00Z'),
      end: new Date('2025-07-05T12:00:00Z'),
      lastModified: new Date('2025-07-04T09:00:00Z'),
    })

    const second = makeRawOccurrence({
      summary: '[BETA] Late cancel B',
      status: 'CANCELLED',
      busyStatus: 'FREE',
      start: new Date('2025-07-05T11:00:00Z'),
      end: new Date('2025-07-05T13:00:00Z'),
      lastModified: new Date('2025-07-04T12:00:00Z'),
    })

    const [firstEvt, secondEvt] = classifyOccurrences([first, second])

    expect(firstEvt.billableMinutes).toBe(60)
    expect(secondEvt.billableMinutes).toBe(120)
  })

  // Does not compensate earlier cancellations when the later cancellation is non-billable.
  it('ignores non-billable late cancellations when determining overlap compensation', () => {
    const billable = makeRawOccurrence({
      summary: '[ALPHA] Late cancel billable',
      status: 'CANCELLED',
      busyStatus: 'FREE',
      start: new Date('2025-07-07T08:00:00Z'),
      end: new Date('2025-07-07T10:00:00Z'),
      lastModified: new Date('2025-07-06T08:00:00Z'),
    })

    const nonBillable = makeRawOccurrence({
      summary: '[Z] Late cancel non-billable',
      status: 'CANCELLED',
      busyStatus: 'FREE',
      start: new Date('2025-07-07T09:00:00Z'),
      end: new Date('2025-07-07T11:00:00Z'),
      lastModified: new Date('2025-07-06T12:00:00Z'),
    })

    const occurrences = classifyOccurrences([billable, nonBillable])
    const billableEvt = occurrences.find((event) => event.projectCode === 'ALPHA')!
    const nonBillableEvt = occurrences.find((event) => event.projectCode === 'Z')!

    expect(billableEvt.billableMinutes).toBe(120)
    expect(nonBillableEvt.billableMinutes).toBe(120)
  })
})
