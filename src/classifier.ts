import {
  CANCEL_WORDS,
  DEFAULT_UNBILLABLE_PROJECT_CODES,
  LATE_CANCELLATION_DAYS,
  PROJECT_CODE_REGEX,
  UNKNOWN_PROJECT_LABEL,
} from './constants'
import type { Occurrence, RawOccurrence } from './types'

const DAY_MS = 24 * 60 * 60 * 1000
const MINUTE_MS = 60 * 1000
const DEFAULT_UNBILLABLE_SET = new Set(DEFAULT_UNBILLABLE_PROJECT_CODES.map((code) => code.toUpperCase()))

export function classifyOccurrences(rawEvents: RawOccurrence[]): Occurrence[] {
  const occurrences = rawEvents.map((raw) => {
    const projectCode = extractProjectCode(raw.summary)
    const durationMinutes = Math.max(0, Math.round((raw.end.getTime() - raw.start.getTime()) / 60000))
    const cancellation = detectCancellation(raw)
    const cancellationTimestamp = raw.appointmentSequenceTime ?? raw.dtstamp ?? raw.lastModified

    let classification: Occurrence['classification'] = 'ACTIVE'
    if (cancellation) {
      if (!cancellationTimestamp) {
        classification = 'CANCELLED_ON_TIME'
      } else {
        const deltaDays = (raw.start.getTime() - cancellationTimestamp.getTime()) / DAY_MS
        classification = deltaDays < LATE_CANCELLATION_DAYS ? 'CANCELLED_LATE' : 'CANCELLED_ON_TIME'
      }
    }

    return {
      ...raw,
      id: buildOccurrenceId(raw.uid, raw.recurrenceId, raw.start.toISOString()),
      projectCode,
      isCancelled: cancellation,
      classification,
      durationMinutes,
      billableMinutes: 0,
    }
  })

  applyBillableMinutes(occurrences)
  return occurrences
}

export function extractProjectCode(summary: string | null | undefined): string | null {
  if (!summary) return null
  const match = summary.match(PROJECT_CODE_REGEX)
  if (!match || !match[1]) return null
  return match[1]?.toUpperCase() ?? null
}

export function normalizedProjectLabel(code: string | null): string {
  return code ?? UNKNOWN_PROJECT_LABEL
}

export function detectCancellation(raw: RawOccurrence): boolean {
  const normalizedStatus = raw.status?.trim().toUpperCase()
  if (normalizedStatus === 'CANCELLED') {
    return true
  }

  const haystack = [raw.summary, raw.description, raw.location]
    .filter(Boolean)
    .map((value) => value!.toLowerCase())
    .join(' ')

  const hasCancelKeyword = CANCEL_WORDS.some((word) => haystack.includes(word.toLowerCase()))
  if (!hasCancelKeyword) {
    return false
  }

  const busyStatus = raw.busyStatus?.trim().toUpperCase()
  return busyStatus === 'FREE'
}

function buildOccurrenceId(uid: string, recurrenceId: string | null, fallbackStart: string): string {
  return recurrenceId ? `${uid}_${recurrenceId}` : `${uid}_${fallbackStart}`
}

function applyBillableMinutes(events: Occurrence[]): void {
  if (!events.length) return

  events.forEach((event) => {
    if (event.classification === 'CANCELLED_ON_TIME') {
      event.billableMinutes = 0
    } else {
      event.billableMinutes = event.durationMinutes
    }
  })

  const billableActiveEvents = events.filter(
    (event) => event.classification === 'ACTIVE' && isDefaultBillableEvent(event),
  )
  const lateCancellationEvents = events.filter((event) => event.classification === 'CANCELLED_LATE')

  events.forEach((event) => {
    if (event.classification !== 'CANCELLED_LATE' || !event.billableMinutes) {
      return
    }

    const overlaps: Array<{ start: number; end: number }> = []
    overlaps.push(...collectOverlaps(event, billableActiveEvents))

    const laterLateCancels = lateCancellationEvents.filter((candidate) =>
      isLaterBillableCancellation(candidate, event),
    )
    overlaps.push(...collectOverlaps(event, laterLateCancels))

    if (!overlaps.length) {
      return
    }

    const merged = mergeIntervals(overlaps)
    const overlappedMinutes = merged.reduce((total, interval) => {
      return total + Math.round((interval.end - interval.start) / MINUTE_MS)
    }, 0)

    event.billableMinutes = Math.max(0, event.billableMinutes - overlappedMinutes)
  })
}

function collectOverlaps(target: Occurrence, candidates: Occurrence[]): Array<{ start: number; end: number }> {
  const start = target.start.getTime()
  const end = target.end.getTime()

  return candidates
    .map((candidate) => {
      const overlapStart = Math.max(start, candidate.start.getTime())
      const overlapEnd = Math.min(end, candidate.end.getTime())
      if (overlapEnd <= overlapStart) return null
      return { start: overlapStart, end: overlapEnd }
    })
    .filter((interval): interval is { start: number; end: number } => Boolean(interval))
}

function mergeIntervals(intervals: Array<{ start: number; end: number }>): Array<{ start: number; end: number }> {
  if (intervals.length <= 1) return intervals.slice()

  const sorted = intervals.slice().sort((a, b) => a.start - b.start)
  const merged: Array<{ start: number; end: number }> = []

  sorted.forEach((interval) => {
    const last = merged[merged.length - 1]
    if (!last || interval.start > last.end) {
      merged.push({ ...interval })
    } else {
      last.end = Math.max(last.end, interval.end)
    }
  })

  return merged
}

function isDefaultBillableEvent(event: Occurrence): boolean {
  const label = normalizedProjectLabel(event.projectCode).toUpperCase()
  return !DEFAULT_UNBILLABLE_SET.has(label)
}

function getCancellationTimestamp(event: Occurrence): number | null {
  if (!event.isCancelled) return null
  return (
    event.appointmentSequenceTime?.getTime() ??
    event.lastModified?.getTime() ??
    event.dtstamp?.getTime() ??
    null
  )
}

function isLaterBillableCancellation(candidate: Occurrence, target: Occurrence): boolean {
  if (candidate === target) return false
  if (candidate.classification !== 'CANCELLED_LATE') return false
  if (!isDefaultBillableEvent(candidate)) return false

  const candidateTs = getCancellationTimestamp(candidate)
  const targetTs = getCancellationTimestamp(target)
  if (candidateTs === null || targetTs === null) {
    return false
  }

  if (candidateTs === targetTs) {
    return candidate.id > target.id
  }

  return candidateTs > targetTs
}
