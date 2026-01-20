const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i

export function normalizeOrganizerEmail(raw?: string | null): string | null {
  if (!raw) return null
  let candidate = raw.trim()
  if (!candidate) return null

  const angleMatch = candidate.match(/<([^>]+)>/)
  if (angleMatch) {
    candidate = angleMatch[1]
  }

  if (/mailto:/i.test(candidate)) {
    const parts = candidate.split(/mailto:/i)
    candidate = parts[parts.length - 1]
  } else if (candidate.includes(':')) {
    const segments = candidate.split(':')
    candidate = segments[segments.length - 1]
  }

  const emailMatch = candidate.match(EMAIL_REGEX)
  if (emailMatch) {
    return emailMatch[0].toLowerCase()
  }

  if (candidate.includes('@')) {
    return candidate.toLowerCase()
  }

  return null
}
