import { SEPASAR_SECONDS } from '../config/site'

const thousands = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })

/** Rupiah the way market boards write it: "Rp 13.500". */
export const formatRp = (value: number): string => `Rp ${thousands.format(value)}`

/** Just the digits, grouped: "13.500". */
export const formatDigits = (value: number): string => thousands.format(value)

/** Accepts "13500", "13.500", "13,500" or "Rp 13.500" and returns whole rupiah. */
export function parseRupiah(input: string): number | undefined {
  const digits = input.replace(/[^\d]/g, '')
  if (digits === '' || digits.length > 10) return undefined
  return Number(digits)
}

export function percentChange(now: number, before: number): number | undefined {
  if (!now || !before) return undefined
  return (now - before) / before
}

export function formatPercent(fraction: number): string {
  const pct = Math.abs(fraction * 100)
  const text = pct < 0.05 ? '0' : pct < 10 ? pct.toFixed(1) : pct.toFixed(0)
  return `${text}%`
}

export const shortAddress = (address: string): string => `${address.slice(0, 6)}…${address.slice(-4)}`

export const sameAddress = (a?: string, b?: string): boolean => !!a && !!b && a.toLowerCase() === b.toLowerCase()

export const plural = (count: number, one: string, many = `${one}s`): string => `${count} ${count === 1 ? one : many}`

const DAY = 86_400

export function timeAgo(timestamp: number, now: number): string {
  const seconds = Math.max(0, now - timestamp)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`
  if (seconds < DAY) return `${Math.round(seconds / 3600)} h ago`
  if (seconds < DAY * 30) return `${plural(Math.round(seconds / DAY), 'day')} ago`
  return formatDate(timestamp)
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const dayMonth = (timestamp: number) =>
  new Date(timestamp * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

/** The five days of one sepasar: "6–10 Nov" or "29 Oct – 2 Nov". */
export function sepasarRange(index: number): string {
  const start = index * SEPASAR_SECONDS
  const end = start + SEPASAR_SECONDS - 1
  const a = new Date(start * 1000)
  const b = new Date(end * 1000)
  if (a.getMonth() === b.getMonth()) {
    return `${a.getDate()}–${dayMonth(end)}`
  }
  return `${dayMonth(start)} – ${dayMonth(end)}`
}

export const sepasarOf = (timestamp: number): number => Math.floor(timestamp / SEPASAR_SECONDS)

/** The UTF-8 byte length the contract limits text by. */
export const byteLength = (text: string): number => new TextEncoder().encode(text).length
