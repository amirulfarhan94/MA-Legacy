import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Dialog layer for search and the Create sheet: dims the app, closes on Esc or a click
 * outside, locks page scroll and gives focus back to whatever opened it.
 */
export default function Overlay({
  open,
  onClose,
  label,
  placement = 'top',
  className = '',
  children,
}: {
  open: boolean
  onClose: () => void
  label: string
  /** 'sheet' rises from the bottom on phones. */
  placement?: 'top' | 'sheet'
  className?: string
  children: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)
  // Parents pass a new onClose on every render; keep the effect tied to `open` only.
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close.current()
      }
    }
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const raf = requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus())
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      opener?.focus?.()
    }
  }, [open])

  if (!open) return null
  return (
    <div
      className={`no-print fixed inset-0 z-[60] flex justify-center bg-[var(--scrim)] px-4 backdrop-blur-[6px] ${
        placement === 'sheet'
          ? 'items-end pb-[calc(1rem+env(safe-area-inset-bottom))] sm:items-start sm:pt-[12vh]'
          : 'items-start pt-[calc(9vh+env(safe-area-inset-top))]'
      }`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={panel} role="dialog" aria-modal="true" aria-label={label} className={`glass-strong w-full rounded-[28px] ${className}`}>
        {children}
      </div>
    </div>
  )
}
