import { UNKNOWN_PROJECT_LABEL } from './constants'

const BASE_SATURATION = 62
const BASE_LIGHTNESS = 48

export function colorForProject(code: string | null): string {
  if (!code) {
    return '#6f7a92'
  }

  const normalized = code === UNKNOWN_PROJECT_LABEL ? UNKNOWN_PROJECT_LABEL : code.toUpperCase()
  const hash = fnv1a(normalized)
  const hue = hash % 360
  return `hsl(${hue} ${BASE_SATURATION}% ${BASE_LIGHTNESS}%)`
}

function fnv1a(str: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}
