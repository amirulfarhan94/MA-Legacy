import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'

/**
 * Shows an A4 sheet scaled down to fit narrow screens, like a PDF preview, with a button to
 * switch to actual size (scroll sideways). Printing always uses the sheet at full size.
 */
export default function SheetPreview({ children }: { children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState({ scale: 1, height: 0 })
  const [actual, setActual] = useState(false)

  useEffect(() => {
    const o = outer.current
    const i = inner.current
    if (!o || !i) return
    const update = () => {
      // offsetWidth/Height ignore the transform, so these are the sheet's real dimensions.
      const scale = Math.min(1, o.clientWidth / i.offsetWidth)
      setFit({ scale, height: Math.ceil(i.offsetHeight * scale) })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(o)
    ro.observe(i)
    return () => ro.disconnect()
  }, [])

  const shrunk = fit.scale < 0.995
  const scaled = shrunk && !actual

  return (
    <div ref={outer} className="min-w-0">
      {shrunk && (
        <div className="no-print mb-2 flex items-center justify-between gap-3 text-xs text-stone-500">
          <span>{actual ? 'Actual size · scroll sideways' : 'Preview · fitted to screen'}</span>
          <button
            type="button"
            onClick={() => setActual((a) => !a)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--btn-line)] bg-[var(--btn)] px-3 font-bold text-stone-900"
          >
            {actual ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {actual ? 'Fit to screen' : 'Actual size'}
          </button>
        </div>
      )}
      <div className={`sheet-fit ${scaled ? 'overflow-hidden' : 'overflow-x-auto pb-4'}`} style={scaled ? { height: fit.height } : undefined}>
        <div ref={inner} className="mx-auto w-max origin-top-left" style={scaled ? { transform: `scale(${fit.scale})` } : undefined}>
          {children}
        </div>
      </div>
    </div>
  )
}
