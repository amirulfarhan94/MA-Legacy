import { useEffect, useRef, useState } from 'react'
import { Eraser } from 'lucide-react'

/**
 * Sign with a finger, pen or mouse. Reports a trimmed PNG data URL of the ink (or '' when
 * cleared), drawn in dark blue on a transparent background so it prints like a real signature.
 */
export default function SignaturePad({ onChange, label }: { onChange: (png: string) => void; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const [empty, setEmpty] = useState(true)

  // Match the canvas to its size on screen, sharp on high-density screens.
  useEffect(() => {
    const c = canvas.current!
    const ratio = Math.max(1, window.devicePixelRatio || 1)
    const { width, height } = c.getBoundingClientRect()
    c.width = Math.round(width * ratio)
    c.height = Math.round(height * ratio)
    const ctx = c.getContext('2d')!
    ctx.scale(ratio, ratio)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1b2a6b'
    ctx.lineWidth = 2.6
  }, [])

  const point = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const finish = () => {
    if (!drawing.current) return
    drawing.current = false
    last.current = null
    onChange(trimmed(canvas.current!))
  }

  const clear = () => {
    const c = canvas.current!
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    setEmpty(true)
    onChange('')
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-stone-300 bg-white">
        <canvas
          ref={canvas}
          aria-label={label}
          className="block h-44 w-full touch-none"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            drawing.current = true
            last.current = point(e)
            const ctx = canvas.current!.getContext('2d')!
            ctx.beginPath()
            ctx.arc(last.current.x, last.current.y, 1.2, 0, Math.PI * 2)
            ctx.fillStyle = '#1b2a6b'
            ctx.fill()
            setEmpty(false)
          }}
          onPointerMove={(e) => {
            if (!drawing.current || !last.current) return
            const p = point(e)
            const ctx = canvas.current!.getContext('2d')!
            ctx.beginPath()
            ctx.moveTo(last.current.x, last.current.y)
            ctx.lineTo(p.x, p.y)
            ctx.stroke()
            last.current = p
          }}
          onPointerUp={finish}
          onPointerCancel={finish}
          onPointerLeave={finish}
        />
        {empty && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-stone-400">
            Tandatangan di sini · Sign here
          </span>
        )}
        <span className="pointer-events-none absolute bottom-7 left-6 right-6 border-b border-stone-300" />
      </div>
      <button type="button" onClick={clear} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-stone-600 hover:text-stone-900">
        <Eraser size={15} /> Padam · Clear
      </button>
    </div>
  )
}

/** The inked part of the canvas, with a little margin, as a PNG at most 600 px wide. */
function trimmed(c: HTMLCanvasElement): string {
  const ctx = c.getContext('2d')!
  const { width, height } = c
  const data = ctx.getImageData(0, 0, width, height).data
  let x0 = width
  let y0 = height
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 10) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 < 0) return ''
  const pad = 8
  x0 = Math.max(0, x0 - pad)
  y0 = Math.max(0, y0 - pad)
  x1 = Math.min(width - 1, x1 + pad)
  y1 = Math.min(height - 1, y1 + pad)
  const w = x1 - x0 + 1
  const h = y1 - y0 + 1
  const scale = Math.min(1, 600 / w)
  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.round(w * scale))
  out.height = Math.max(1, Math.round(h * scale))
  out.getContext('2d')!.drawImage(c, x0, y0, w, h, 0, 0, out.width, out.height)
  return out.toDataURL('image/png')
}
