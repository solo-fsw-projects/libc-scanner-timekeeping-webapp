import IcalExpander from 'ical-expander'
import ICAL from 'ical.js'
import type { RawOccurrence } from './types'

const MAX_ITERATIONS = 10000

export function parseIcs(icsText: string): RawOccurrence[] {
  const expander = new IcalExpander({ ics: icsText, skipInvalidDates: true, maxIterations: MAX_ITERATIONS })
  const expansion = expander.all()

  const records: RawOccurrence[] = []

  expansion.events.forEach((event) => {
    records.push(mapEvent(event, event.isRecurrenceException() ? 'exception' : 'single'))
  })

  expansion.occurrences.forEach((occurrence) => {
    const baseEvent = occurrence.item
    const apptSeq = readDateLike(baseEvent.component, 'x-ms-olk-apptseqtime')
    records.push({
      uid: baseEvent.uid,
      summary: fallbackSummary(cleanString(baseEvent.summary)),
      description: readText(baseEvent.component, 'DESCRIPTION'),
      location: readText(baseEvent.component, 'LOCATION'),
      status: readText(baseEvent.component, 'STATUS'),
      organizer: readText(baseEvent.component, 'ORGANIZER'),
      sequence: typeof baseEvent.sequence === 'number' ? baseEvent.sequence : null,
      start: occurrence.startDate.toJSDate(),
      end: occurrence.endDate.toJSDate(),
      allDay: occurrence.startDate.isDate,
      tzid: getTZID(occurrence.startDate) ?? getTZID(baseEvent.startDate),
      appointmentSequenceTime: apptSeq,
      created: readTime(baseEvent.component, 'CREATED'),
      lastModified: readTime(baseEvent.component, 'last-modified'),
      dtstamp: readTime(baseEvent.component, 'dtstamp'),
      busyStatus: readText(baseEvent.component, 'X-MICROSOFT-CDO-BUSYSTATUS'),
      recurrenceId: occurrence.recurrenceId ? occurrence.recurrenceId.toJSDate().toISOString() : occurrence.startDate.toJSDate().toISOString(),
      sourceType: 'occurrence',
    })

    if (!apptSeq) {
      debugApptseqProperty(baseEvent.component, 'occurrence', baseEvent.uid)
    }
  })

  return records
}

function mapEvent(event: ICAL.Event, sourceType: 'single' | 'exception'): RawOccurrence {
  const apptSeq = readDateLike(event.component, 'x-ms-olk-apptseqtime')
  return {
    uid: event.uid,
    summary: fallbackSummary(cleanString(event.summary)),
    description: readText(event.component, 'DESCRIPTION'),
    location: readText(event.component, 'LOCATION'),
    status: readText(event.component, 'STATUS'),
    organizer: readText(event.component, 'ORGANIZER'),
    sequence: typeof event.sequence === 'number' ? event.sequence : null,
    start: event.startDate.toJSDate(),
    end: event.endDate.toJSDate(),
    allDay: event.startDate.isDate,
    tzid: getTZID(event.startDate),
    appointmentSequenceTime: apptSeq,
    created: readTime(event.component, 'CREATED'),
    lastModified: readTime(event.component, 'last-modified'),
    dtstamp: readTime(event.component, 'dtstamp'),
    busyStatus: readText(event.component, 'X-MICROSOFT-CDO-BUSYSTATUS'),
    recurrenceId: event.recurrenceId ? event.recurrenceId.toJSDate().toISOString() : null,
    sourceType,
  }
}

function debugApptseqProperty(component: ICAL.Component, source: string, uid: string): void {
  const props = component.getAllProperties()
  const names = props.map((p) => p.name)
  const apptProps = props.filter((p) => (p.name ?? '').toLowerCase() === 'x-ms-olk-apptseqtime')
  const values = apptProps.map((p) => p.getFirstValue())
  console.debug('[apptseqtime]', { source, uid, names, apptPropCount: apptProps.length, values })
}

function readTime(component: ICAL.Component, property: string): Date | null {
  const upper = property.toUpperCase()
  const lower = property.toLowerCase()
  const prop = component.getFirstProperty(upper) ?? component.getFirstProperty(lower)
  if (!prop) return null
  const value = prop.getFirstValue()
  if (!value) return null
  if (typeof (value as ICAL.Time).toJSDate === 'function') {
    return (value as ICAL.Time).toJSDate()
  }
  if (value instanceof Date) {
    return value
  }
  return null
}

function readDateLike(component: ICAL.Component, property: string): Date | null {
  const lower = property.toLowerCase()
  const upper = property.toUpperCase()
  let prop: ICAL.Property | null = component.getFirstProperty(lower) ?? component.getFirstProperty(upper)
  if (!prop) {
    prop = component.getAllProperties().find((p) => p.name?.toLowerCase() === lower) ?? null
  }
  if (!prop) {
    const fallback = extractFromRaw(component.toString(), lower)
    if (fallback) return fallback
    return null
  }
  const value = prop.getFirstValue()
  if (!value) return null
  if (typeof (value as ICAL.Time).toJSDate === 'function') {
    return (value as ICAL.Time).toJSDate()
  }
  if (value instanceof Date) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = parseDateString(value)
    if (parsed) return parsed
  }
  return null
}

function extractFromRaw(raw: string, lowerName: string): Date | null {
  try {
    const pattern = new RegExp(`${lowerName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}:([^\r\n]+)`, 'i')
    const match = raw.match(pattern)
    if (match?.[1]) {
      return parseDateString(match[1].trim())
    }
  } catch (error) {
    console.debug('extractFromRaw error', error)
  }
  return null
}

function parseDateString(value: string): Date | null {
  const basic = value.match(/^([0-9]{4})([0-9]{2})([0-9]{2})T([0-9]{2})([0-9]{2})([0-9]{2})Z?$/)
  if (basic) {
    const [, y, m, d, hh, mm, ss] = basic
    const utc = Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss))
    return new Date(utc)
  }

  const timestamp = Date.parse(value)
  if (!Number.isNaN(timestamp)) {
    return new Date(timestamp)
  }

  try {
    const time = ICAL.Time.fromDateTimeString(value)
    if (time) {
      return time.toJSDate()
    }
  } catch (error) {
    console.debug('Unable to parse date string', value, error)
  }
  return null
}

function getTZID(time?: ICAL.Time | null): string | null {
  if (!time) return null
  return time.zone ? time.zone.tzid ?? null : null
}

function fallbackSummary(summary?: string | null): string {
  if (!summary || !summary.trim()) {
    return 'Untitled Reservation'
  }
  return summary.trim()
}

function cleanString(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value == null) return null
  return String(value)
}

function readText(component: ICAL.Component, property: string): string | null {
  const upper = property.toUpperCase()
  const lower = property.toLowerCase()
  const prop = component.getFirstProperty(upper) ?? component.getFirstProperty(lower)
  if (!prop) return null
  const value = prop.getFirstValue()
  return cleanString(value)
}
