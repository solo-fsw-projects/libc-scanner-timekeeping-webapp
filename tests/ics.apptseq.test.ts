import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseIcs } from '../src/ics'

const samplePath = path.resolve(__dirname, '../public/sample.ics')
const sampleText = fs.readFileSync(samplePath, 'utf8')

describe('ICS parsing of X-MS-OLK-APPTSEQTIME', () => {
  it('parses appointment sequence time from sample.ics', () => {
    const events = parseIcs(sampleText)
    expect(events.length).toBeGreaterThan(0)
    const withAppt = events.filter((evt) => evt.appointmentSequenceTime)
    expect(withAppt.length).toBeGreaterThan(0)
    expect(withAppt[0]?.appointmentSequenceTime).toBeInstanceOf(Date)
  })
})
