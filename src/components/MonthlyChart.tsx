import { useEffect, useRef, useState } from 'react'
import { formatMoney } from '../lib/calc'

export interface MonthPoint {
  key: string // YYYY-MM
  label: string // "Sep"
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
  n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${+(n / 1000).toFixed(1)}K` : String(n)

/** Single-series column chart: money collected per month. */
export default function MonthlyChart({ data, currency }: { data: MonthPoint[]; currency: string }) {
  const wrap = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hover, setHover] = useState<number | null>(null)
  const [asTable, setAsTable] = useState(false)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(260, Math.floor(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [asTable])

  const height = 220
  const pad = { top: 16, right: 8, bottom: 26, left: 44 }
  const ticks = niceTicks(Math.max(...data.map((d) => d.value)))
  const top = ticks[ticks.length - 1]
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const band = innerW / data.length
  const barW = Math.min(24, band * 0.6)
  const y = (v: number) => pad.top + innerH - (v / top) * innerH
  const maxIdx = data.reduce((m, d, i) => (d.value > data[m].value ? i : m), 0)
  const lastIdx = data.length - 1

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button onClick={() => setAsTable((t) => !t)} className="text-xs text-stone-500 underline-offset-2 hover:text-stone-800 hover:underline">
          {asTable ? 'Show chart' : 'Show as table'}
        </button>
      </div>
      {asTable ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-stone-500">
              <th className="py-1.5 font-medium">Month</th>
              <th className="py-1.5 text-right font-medium">Collected</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.key} className="border-t border-stone-100">
                <td className="py-1.5">{d.key}</td>
                <td className="tabular py-1.5 text-right">{formatMoney(d.value, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div ref={wrap} className="relative w-full min-w-0" style={{ height: 220 }} onMouseLeave={() => setHover(null)}>
          {width > 0 && <svg width={width} height={height} role="img" aria-label="Money collected per month, last 12 months" className="block">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="#e7e5e4" strokeWidth={1} />
                <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="tabular fill-stone-500 text-[10.5px]">
                  {compact(t)}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const cx = pad.left + band * i + band / 2
              const h = Math.max(0, y(0) - y(d.value))
              const r = Math.min(4, h, barW / 2)
              const x0 = cx - barW / 2
              const yTop = y(d.value)
              // Rounded data-end (top), square at the baseline.
              const path = h
                ? `M${x0},${y(0)} V${yTop + r} Q${x0},${yTop} ${x0 + r},${yTop} H${x0 + barW - r} Q${x0 + barW},${yTop} ${x0 + barW},${yTop + r} V${y(0)} Z`
                : ''
              const showLabel = d.value > 0 && (i === maxIdx || i === lastIdx)
              return (
                <g key={d.key}>
                  {hover === i && <rect x={pad.left + band * i} y={pad.top} width={band} height={innerH} fill="#f5e9cf" opacity={0.45} />}
                  {path && <path d={path} fill="#a8741a" opacity={hover === null || hover === i ? 1 : 0.55} />}
                  {showLabel && (
                    <text x={cx} y={yTop - 5} textAnchor="middle" className="tabular fill-stone-700 text-[10.5px] font-medium">
                      {compact(Math.round(d.value))}
                    </text>
                  )}
                  {(band >= 30 || (lastIdx - i) % 2 === 0) && <text x={cx} y={height - 8} textAnchor="middle" className={`text-[10.5px] ${i === lastIdx ? 'fill-stone-800 font-medium' : 'fill-stone-500'}`}>
                    {d.label}
                  </text>}
                  {/* Hit target: the whole band, bigger than the mark. */}
                  <rect
                    x={pad.left + band * i}
                    y={pad.top}
                    width={band}
                    height={innerH + pad.bottom}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onTouchStart={() => setHover(i)}
                  />
                </g>
              )
            })}
            <line x1={pad.left} x2={width - pad.right} y1={y(0)} y2={y(0)} stroke="#a8a29e" strokeWidth={1} />
          </svg>}
          {hover !== null && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs shadow-lg"
              style={{
                left: Math.min(Math.max(pad.left + band * hover + band / 2, 70), width - 70),
                top: Math.max(0, y(data[hover].value) - 58),
              }}
            >
              <div className="text-stone-500">{data[hover].key}</div>
              <div className="tabular font-semibold text-stone-900">{formatMoney(data[hover].value, currency)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
