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
    primary: 'btn-gold',
    secondary: 'border border-[var(--btn-line)] bg-[var(--btn)] text-stone-900 hover:bg-stone-100',
    ghost: 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
    danger: 'border border-red-200 bg-[var(--btn)] text-red-700 hover:bg-red-50',
  }
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap',
        size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-4 text-sm',
        v[variant],
        className,
      )}
      {...props}
    />
  )
}

/** Fields fill their container unless the caller sets its own width (w-auto, w-28…). */
const withWidth = (className?: string) => (className && /(^|\s)w-/.test(className) ? '' : 'w-full')

const fieldCls =
  'rounded-xl border border-stone-300 bg-[var(--field)] px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-400/25'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(fieldCls, withWidth(className), 'h-9 py-0', className)} {...props} />
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
      className={cx(fieldCls, withWidth(className), 'tabular h-9 py-0', className)}
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
  return <textarea className={cx(fieldCls, withWidth(className), className)} rows={3} {...props} />
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(fieldCls, withWidth(className), 'h-9 py-0 pr-8', className)} {...props} />
}

export function Field({ label, children, className, hint }: { label: string; children: ReactNode; className?: string; hint?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-xs font-semibold text-stone-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('glass min-w-0 rounded-[22px]', className)}>{children}</div>
}

export function CardHeader({ title, action, subtitle }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-stone-200 px-5 py-4">
      <div>
        <h2 className="font-display text-[14.5px] font-medium tracking-[-0.01em] text-stone-900">{title}</h2>
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
        <h1 className="font-display text-[23px] font-normal leading-tight tracking-[-0.02em] text-stone-900 sm:text-[26px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

/** Dot colour per status: green done, cyan in progress, amber/orange waiting on money, red needs action. */
export const STATUS_DOT: Record<string, string> = {
  draft: 'var(--color-stone-400)',
  sent: 'var(--color-accent)',
  issued: 'var(--color-accent)',
  accepted: 'var(--good)',
  paid: 'var(--good)',
  credited: 'var(--good)',
  completed: 'var(--good)',
  delivered: 'var(--good)',
  received: 'var(--good)',
  income: 'var(--good)',
  unpaid: 'var(--warn)',
  partial: 'var(--serious)',
  overdue: 'var(--critical)',
  rejected: 'var(--critical)',
  expense: 'var(--critical)',
  cancelled: 'var(--color-stone-400)',
}

/** Lifecycle order for status filters. */
export const STATUS_ORDER = ['draft', 'sent', 'unpaid', 'partial', 'overdue', 'paid', 'credited', 'accepted', 'rejected', 'issued', 'delivered', 'received', 'completed', 'cancelled']

export function StatusBadge({ status }: { status: string }) {
  const alert = status === 'overdue'
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold capitalize',
        alert ? 'border-red-200 bg-red-50 text-red-700' : 'border-[var(--btn-line)] bg-[var(--btn)] text-stone-700',
      )}
    >
      <i className="size-1.5 shrink-0 rounded-full" style={{ background: STATUS_DOT[status] ?? 'var(--color-stone-400)' }} />
      <span className={status === 'cancelled' ? 'line-through' : undefined}>{status}</span>
    </span>
  )
}

/** Single-choice filter as a row of chips (scrolls sideways on phones). */
export function ChipGroup<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; count?: number; dot?: string }[]
}) {
  return (
    <div role="group" aria-label={label} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors',
            value === o.value
              ? 'border-transparent bg-stone-900 text-[var(--color-canvas)]'
              : 'border-[var(--btn-line)] bg-[var(--btn)] text-stone-600 hover:text-stone-900',
          )}
        >
          {o.dot && <i className="size-1.5 rounded-full" style={{ background: o.dot }} />}
          <span className="capitalize">{o.label}</span>
          {o.count !== undefined && <span className="tabular opacity-60">{o.count}</span>}
        </button>
      ))}
    </div>
  )
}

export type Tone = 'good' | 'bad' | 'warn' | 'gold'
const TONE: Record<Tone, string> = { good: 'text-emerald-700', bad: 'text-red-700', warn: 'text-amber-700', gold: 'text-gold-700' }

/** Two to four money figures in one glass card: rows on phones, columns when there is room. */
export function MetricStrip({ items, currency }: { items: { label: string; value: number; tone?: Tone }[]; currency: string }) {
  const cols = { 2: '@min-[520px]:grid-cols-2', 3: '@min-[520px]:grid-cols-3', 4: '@min-[520px]:grid-cols-4' }[items.length] ?? '@min-[520px]:grid-cols-3'
  return (
    <div className="glass @container min-w-0 rounded-[22px]">
      <dl className={cx('grid divide-y divide-stone-200 @min-[520px]:divide-x @min-[520px]:divide-y-0', cols)}>
        {items.map((it) => (
          <div key={it.label} className="flex items-baseline justify-between gap-3 px-4 py-3 @min-[520px]:block @min-[520px]:px-5 @min-[520px]:py-4">
            <dt className="text-[12.5px] font-semibold text-stone-600">{it.label}</dt>
            <dd className={cx('tabular whitespace-nowrap font-display text-[17px] tracking-[-0.02em] @min-[520px]:mt-2 @min-[520px]:text-[24px]', it.tone ? TONE[it.tone] : 'text-stone-900')}>
              <span className="mr-[0.35em] text-[0.55em] font-medium text-stone-500">{currency}</span>
              {(Number(it.value) || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </dd>
          </div>
        ))}
      </dl>
    </div>
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-4 backdrop-blur-sm sm:items-center" onMouseDown={onClose}>
      <div className="glass-strong w-full max-w-lg rounded-[26px]" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <h2 className="font-display text-base font-medium tracking-[-0.01em]">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-stone-500 hover:bg-stone-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-stone-200 px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

export const tableCls = {
  table: 'w-full text-sm',
  th: 'px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-stone-500 bg-stone-50 border-b border-stone-200',
  td: 'px-4 py-3 border-b border-stone-100 align-top',
  tr: 'hover:bg-gold-50/40 cursor-pointer',
}
