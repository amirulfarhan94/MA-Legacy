import { useEffect, useId, useRef, useState, type PointerEvent } from 'react'
import { formatMoney } from '../lib/calc'

export interface ChartPoint {
  /** Axis label, e.g. "Sep" or "4 Aug". */
  label: string
  /** Tooltip heading, e.g. "Sep 2026" or "4 Aug – 10 Aug". */
  full: string
  value: number
}

/** Clean axis max + ticks: 0, step, 2·step… with step in {1,2,2.5,5}×10^n. */
function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1000, 2000, 3000, 4000]
  const raw = max / count
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw)!
  const top = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v)
  return ticks
}

const compact = (n: number) =>
  n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${+(n / 1000).toFixed(1)}K` : String(Math.round(n))

/** Monotone cubic curve through the points, so it never overshoots between months. */
function smoothPath(p: { x: number; y: number }[]): string {
  const n = p.length
  if (n < 2) return ''
  const dx: number[] = []
  const m: number[] = []
  const t: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx[i] = p[i + 1].x - p[i].x
    m[i] = (p[i + 1].y - p[i].y) / dx[i]
  }
  t[0] = m[0]
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2
  t[n - 1] = m[n - 2]
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0
      t[i + 1] = 0
      continue
    }
    const a = t[i] / m[i]
    const b = t[i + 1] / m[i]
    const s = a * a + b * b
    if (s > 9) {
      const k = 3 / Math.sqrt(s)
      t[i] = k * a * m[i]
      t[i + 1] = k * b * m[i]
    }
  }
  let d = `M${p[0].x},${p[0].y}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3
    d += `C${p[i].x + h},${p[i].y + t[i] * h} ${p[i + 1].x - h},${p[i + 1].y - t[i + 1] * h} ${p[i + 1].x},${p[i + 1].y}`
  }
  return d
}

/** Single-series area chart with a glowing line; hover or tap shows the amount. */
export default function AreaChart({ points, currency, label, height = 280 }: { points: ChartPoint[]; currency: string; label: string; height?: number }) {
  const wrap = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hover, setHover] = useState<number | null>(null)
  const gradient = 'area' + useId().replace(/[^a-zA-Z0-9_-]/g, '')

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useEffect(() => setHover(null), [points])

  const W = Math.max(260, width)
  const H = width && width < 480 ? Math.min(height, 220) : height
  const pad = { t: 24, r: 14, b: 28, l: 42 }
  const n = points.length
  const ticks = niceTicks(Math.max(0, ...points.map((p) => p.value)))
  const top = ticks[ticks.length - 1]
  const iw = W - pad.l - pad.r
  const ih = H - pad.t - pad.b
  const x = (i: number) => (n === 1 ? pad.l + iw / 2 : pad.l + (iw * i) / (n - 1))
  const y = (v: number) => pad.t + ih - (Math.max(0, v) / top) * ih
  const pts = points.map((p, i) => ({ x: x(i), y: y(p.value) }))
  const line = smoothPath(pts)
  // Leave at least ~52px between axis labels; always label the latest point.
  const every = n > 1 ? Math.max(1, Math.ceil(52 / (iw / (n - 1)))) : 1

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.ownerSVGElement!.getBoundingClientRect()
    const rel = (e.clientX - r.left - pad.l) / iw
    setHover(n === 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1)))))
  }

  const last = pts[n - 1]
  const tipX = hover === null ? 0 : Math.min(Math.max(pts[hover].x, 70), W - 70)

  return (
    <div ref={wrap} className="relative">
      {width > 0 && n > 0 && (
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="block overflow-visible">
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.26" />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="stroke-stone-200" />
              <text x={pad.l - 10} y={y(t)} dy="0.32em" textAnchor="end" className="fill-stone-500 text-[11px] font-semibold">
                {compact(t)}
              </text>
            </g>
          ))}
          {line && (
            <>
              <path d={`${line}L${last.x},${y(0)}L${pts[0].x},${y(0)}Z`} fill={`url(#${gradient})`} />
              <path
                d={line}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{ filter: 'drop-shadow(0 0 6px color-mix(in srgb, var(--color-accent) 55%, transparent))' }}
              />
            </>
          )}
          {points.map(
            (p, i) =>
              (n - 1 - i) % every === 0 && (
                <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className={`text-[11px] font-semibold ${i === n - 1 ? 'fill-stone-900' : 'fill-stone-500'}`}>
                  {p.label}
                </text>
              ),
          )}
          <circle cx={last.x} cy={last.y} r={4.5} fill="var(--color-accent)" stroke="var(--color-canvas)" strokeWidth={2} />
          {hover !== null && (
            <>
              <line x1={pts[hover].x} x2={pts[hover].x} y1={pad.t} y2={y(0)} className="stroke-stone-400" />
              <circle cx={pts[hover].x} cy={pts[hover].y} r={5} fill="var(--color-accent)" stroke="var(--color-canvas)" strokeWidth={2} />
            </>
          )}
          <rect
            x={pad.l - 10}
            y={0}
            width={iw + 20}
            height={H}
            fill="transparent"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      )}
      {hover !== null && (
        <div
          className="glass-strong pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-[14px] px-3 py-2 text-xs font-semibold text-stone-500"
          style={{ left: tipX, top: Math.max(pts[hover].y - 12, 44) }}
        >
          {points[hover].full}
          <b className="block font-display text-[15px] font-medium text-stone-900">{formatMoney(points[hover].value, currency)}</b>
        </div>
      )}
      {/* Tables ignore sr-only's 1px box, so the wrapper does the hiding. */}
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <tbody>
            {points.map((p) => (
              <tr key={p.full}>
                <th scope="row">{p.full}</th>
                <td>{formatMoney(p.value, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
