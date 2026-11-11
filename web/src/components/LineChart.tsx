import { useEffect, useId, useRef, useState } from 'react'
import type { Point } from '../lib/contract'
import { formatDigits, formatRp, sepasarRange } from '../lib/format'

type Props = {
  points: Point[]
  /** Today's reference, drawn as a dotted step after the last closed sepasar. */
  current?: { sepasar: number; price: number }
  title: string
}

const PAD = { top: 16, right: 20, bottom: 34, left: 64 }

/** The chart is drawn at the width it is shown at, so its 12px labels stay 12px on a phone. */
function useWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setWidth(Math.max(280, Math.round(el.getBoundingClientRect().width)))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return { ref, width }
}

function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || max || 1
  const raw = span / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const start = Math.floor(min / step) * step
  const ticks: number[] = []
  for (let v = start; v <= max + step * 0.5; v += step) ticks.push(Math.round(v))
  return ticks
}

/** Reference price per sepasar. Sepasars nobody reported in leave a gap in time, not a fake point. */
export function LineChart(props: Props) {
  const { ref, width } = useWidth(640)
  return (
    <div ref={ref}>
      <Chart {...props} W={width} />
    </div>
  )
}

function Chart({ points, current, title, W }: Props & { W: number }) {
  const descId = useId()
  const narrow = W < 480
  const H = narrow ? 220 : 260
  const all = [...points.map((p) => ({ x: p.sepasar, y: p.median })), ...(current ? [{ x: current.sepasar, y: current.price }] : [])]
  if (all.length === 0) return null

  const xs = all.map((p) => p.x)
  const ys = all.map((p) => p.y)
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)
  const ticks = niceTicks(Math.min(...ys) * 0.97, Math.max(...ys) * 1.03)
  const yMin = ticks[0]
  const yMax = ticks[ticks.length - 1]

  const sx = (x: number) =>
    xMax === xMin ? PAD.left + (W - PAD.left - PAD.right) / 2 : PAD.left + ((x - xMin) / (xMax - xMin)) * (W - PAD.left - PAD.right)
  const sy = (y: number) => PAD.top + (1 - (y - yMin) / (yMax - yMin || 1)) * (H - PAD.top - PAD.bottom)

  const closed = points.map((p) => [sx(p.sepasar), sy(p.median)] as const)
  const line = closed.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const lastClosed = closed[closed.length - 1]
  const now = current ? ([sx(current.sepasar), sy(current.price)] as const) : undefined

  // Label at most four sepasars along the bottom (two on a phone), always the first and last.
  const labelled = narrow
    ? [...new Set([xMin, xMax])]
    : [...new Set([xMin, Math.round(xMin + (xMax - xMin) / 3), Math.round(xMin + ((xMax - xMin) * 2) / 3), xMax])]
  const anchor = (x: number) => (narrow ? (x === xMin ? 'start' : 'end') : 'middle')
  const labelX = (x: number) => (narrow ? (x === xMin ? PAD.left : W - PAD.right) : sx(x))

  const first = all[0]
  const lastPoint = all[all.length - 1]
  const summary = `${title}. ${points.length} closed sepasars${current ? ' and today' : ''}, from ${formatRp(first.y)} to ${formatRp(lastPoint.y)}. The table below lists every value.`

  return (
    <svg className="chart__svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={descId}>
      <title id={descId}>{summary}</title>
      {ticks.map((t) => (
        <g key={t}>
          <line className="chart__grid" x1={PAD.left} x2={W - PAD.right} y1={sy(t)} y2={sy(t)} />
          <text className="chart__axis" x={PAD.left - 10} y={sy(t) + 4} textAnchor="end">
            {formatDigits(t)}
          </text>
        </g>
      ))}
      {labelled.map((x) => (
        <text key={x} className="chart__axis" x={labelX(x)} y={H - 10} textAnchor={anchor(x)}>
          {x === current?.sepasar ? 'Today' : sepasarRange(x)}
        </text>
      ))}
      {closed.length > 1 && <path className="chart__line" d={line} />}
      {lastClosed && now && (
        <path className="chart__now-line" d={`M${lastClosed[0]},${lastClosed[1]} L${now[0]},${now[1]}`} />
      )}
      {closed.map(([x, y], i) => (
        <circle key={i} className="chart__dot" cx={x} cy={y} r="4" />
      ))}
      {now && <circle className="chart__dot chart__dot--now" cx={now[0]} cy={now[1]} r="6" />}
    </svg>
  )
}
