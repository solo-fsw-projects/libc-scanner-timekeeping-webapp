// This section contains constants used in the timekeeping logic.

// Application version:
export const APP_VERSION = '0.2.0'

// Regular expression to extract project codes enclosed in square brackets:
export const PROJECT_CODE_REGEX = /\[([0-9a-zA-Z]+)\]/

// Number of days before an event is considered a late cancellation:
export const LATE_CANCELLATION_DAYS = 7

// Label used for events without a project code:
export const UNKNOWN_PROJECT_LABEL = 'UNKNOWN'

// Default project codes that should start as unbillable:
export const DEFAULT_UNBILLABLE_PROJECT_CODES = [UNKNOWN_PROJECT_LABEL.toUpperCase(), 'Z', 'R']

// Words indicating cancellation in various languages:
export const CANCEL_WORDS = [
  'canceled',
  'cancelled',
  'geannuleerd',
  'abgesagt',
  'annulé',
  'cancelado',
  'annullato',
  'avbokad',
  'peruttu',
  'avlyst',
  'aflyst',
  '已取消',
]