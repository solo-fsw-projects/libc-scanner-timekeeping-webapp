import { describe, expect, it } from 'vitest'
import { normalizeOrganizerEmail } from '../src/organizers'

describe('normalizeOrganizerEmail', () => {
  // Validates that uppercase organizer addresses are normalized.
  it('lowercases simple emails', () => {
    expect(normalizeOrganizerEmail('USER@EXAMPLE.COM')).toBe('user@example.com')
  })

  // Ensures addresses enclosed in display-name brackets are extracted.
  it('extracts from angle brackets', () => {
    expect(normalizeOrganizerEmail('Jane Doe <jane.doe@libc.org>')).toBe('jane.doe@libc.org')
  })

  // Confirms mailto-prefixed organizer strings are parsed correctly.
  it('handles mailto links', () => {
    expect(normalizeOrganizerEmail('mailto:alpha@libc.org')).toBe('alpha@libc.org')
  })

  // Verifies non-email organizer strings return null.
  it('falls back to null when no email found', () => {
    expect(normalizeOrganizerEmail('No Email Provided')).toBeNull()
  })
})
