import { useEffect, useState } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { X } from 'lucide-react'

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  const v: Record<Variant, string> = {
    primary: 'bg-gold-600 text-white hover:bg-gold-700 shadow-sm',
    secondary: 'bg-white text-stone-800 border border-stone-300 hover:bg-stone-50',
    ghost: 'text-stone-600 hover:bg-stone-100',
    danger: 'bg-white text-red-700 border border-red-200 hover:bg-red-50',
  }
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap',
        size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
        v[variant],
        className,
      )}
      {...props}
    />
  )
}

const fieldCls =
  'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-200'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(fieldCls, 'h-9 py-0', className)} {...props} />
}

const toText = (n: number) => (n ? String(n) : '')
const parseNum = (t: string) => (t === '' || t === '.' ? 0 : Number(t))

/**
 * Numeric field that can be cleared while typing. It keeps its own text so an
 * empty box stays empty (instead of snapping back to "0"), shows the decimal
 * keypad on phones, and selects its content on focus for quick overwriting.
 */
export function NumberInput({
  value,
  onValueChange,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number
  onValueChange: (n: number) => void
}) {
  const [text, setText] = useState(toText(value))
  // Follow outside changes (e.g. a receipt amount pre-filled from an invoice).
  useEffect(() => {
    setText((t) => (parseNum(t) === value ? t : toText(value)))
  }, [value])

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder="0"
      className={cx(fieldCls, 'tabular h-9 py-0', className)}
      value={text}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const t = e.target.value.replace(',', '.').replace(/\s/g, '')
        if (!/^\d*\.?\d*$/.test(t)) return
        setText(t)
        onValueChange(parseNum(t))
      }}
      onBlur={() => setText(toText(value))}
      {...props}
    />
  )
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(fieldCls, className)} rows={3} {...props} />
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(fieldCls, 'h-9 py-0 pr-8', className)} {...props} />
}

export function Field({ label, children, className, hint }: { label: string; children: ReactNode; className?: string; hint?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-xs font-medium text-stone-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('min-w-0 rounded-xl border border-stone-200 bg-white shadow-sm', className)}>{children}</div>
}

export function CardHeader({ title, action, subtitle }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-stone-100 px-5 py-3.5">
      <div>
        <h2 className="text-sm font-semibold text-stone-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-stone-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-stone-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-stone-100 text-stone-700',
  sent: 'bg-sky-50 text-sky-800',
  accepted: 'bg-emerald-50 text-emerald-800',
  rejected: 'bg-red-50 text-red-700',
  cancelled: 'bg-stone-100 text-stone-500 line-through',
  unpaid: 'bg-amber-50 text-amber-800',
  partial: 'bg-orange-50 text-orange-800',
  paid: 'bg-emerald-50 text-emerald-800',
  overdue: 'bg-red-50 text-red-700',
  completed: 'bg-emerald-50 text-emerald-800',
  income: 'bg-emerald-50 text-emerald-800',
  expense: 'bg-red-50 text-red-700',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
        STATUS_STYLE[status] ?? 'bg-stone-100 text-stone-700',
      )}
    >
      {status}
    </span>
  )
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-3 rounded-full bg-gold-50 p-3 text-gold-600">{icon}</div>}
      <p className="text-sm font-medium text-stone-900">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-stone-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center" onMouseDown={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3.5">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-stone-500 hover:bg-stone-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-stone-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

export const tableCls = {
  table: 'w-full text-sm',
  th: 'px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-stone-500 bg-stone-50 border-b border-stone-200',
  td: 'px-4 py-3 border-b border-stone-100 align-top',
  tr: 'hover:bg-gold-50/40 cursor-pointer',
}
