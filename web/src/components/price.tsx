import type { Row, Status } from '../lib/contract'
import { statusOf } from '../lib/contract'
import { formatDigits, formatPercent, percentChange } from '../lib/format'

/** A price the way a stall writes it: small "Rp", big figures, small unit. */
export function Price({ value, unit, className = '' }: { value: number; unit?: string; className?: string }) {
  if (!value) {
    return (
      <span className={`price price--none ${className}`}>
        <span aria-hidden="true">—</span>
        <span className="sr-only">No price</span>
      </span>
    )
  }
  return (
    <span className={`price ${className}`}>
      <span className="price__rp">Rp</span>
      <span>{formatDigits(value)}</span>
      {unit && <span className="price__unit">/{unit}</span>}
    </span>
  )
}

const STATUS_TEXT: Record<Status, string> = {
  confirmed: 'Confirmed',
  provisional: 'Provisional',
  stale: 'No recent data',
  empty: 'No reports yet',
}

export const STATUS_HELP: Record<Status, string> = {
  confirmed: 'Three or more people reported it in the last 14 days.',
  provisional: 'Only one or two people reported it in the last 14 days, so it moves easily.',
  stale: 'Nobody has reported it in the last 14 days.',
  empty: 'Nobody has reported this item here yet.',
}

export function StatusTag({ status }: { status: Status }) {
  return <span className={`status status--${status}`}>{STATUS_TEXT[status]}</span>
}

export const rowStatus = statusOf

/**
 * Movement against the last closed sepasar: an arrow and a figure, never colour alone.
 * Dearer is "up", cheaper is "down".
 */
export function Change({ row, long = false }: { row: Row; long?: boolean }) {
  const change = percentChange(row.price, row.previousMedian)
  if (change === undefined) {
    return <span className="change change--none">{long ? 'No earlier sepasar to compare' : '—'}</span>
  }
  const pct = formatPercent(change)
  if (Math.abs(change) < 0.005) {
    return (
      <span className="change change--flat">
        <span aria-hidden="true">=</span> {long ? 'Steady since last sepasar' : 'Steady'}
      </span>
    )
  }
  const up = change > 0
  return (
    <span className={up ? 'change change--up' : 'change change--down'}>
      <span aria-hidden="true">{up ? '▲' : '▼'}</span>
      <span className="sr-only">{up ? 'Up' : 'Down'}</span> {pct}
      {long && <span> {up ? 'dearer' : 'cheaper'} than last sepasar</span>}
    </span>
  )
}

/** A small trend line: closed sepasars, then today's reference as an orange dot. */
export function Sparkline({ row }: { row: Row }) {
  const values = row.price ? [...row.spark, row.price] : row.spark
  if (values.length < 2) return <span className="change change--none" aria-hidden="true">—</span>

  const w = 88
  const h = 28
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const step = w / (values.length - 1)
  const pts = values.map((v, i) => [i * step, h - 3 - ((v - min) / span) * (h - 6)] as const)
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1]

  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} aria-hidden="true" focusable="false">
      <path d={d} />
      {row.price ? <circle cx={last[0]} cy={last[1]} r="3.2" /> : null}
    </svg>
  )
}
