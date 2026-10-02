import type { ReactNode } from 'react'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { formatMoney, lineTotal } from '../lib/calc'
import { uid } from '../lib/store'
import type { LineItem } from '../lib/types'
import { Button, Input, NumberInput, Textarea } from './ui'

const GRID = {
  plain: 'sm:grid-cols-[20px_1fr_64px_64px_104px_104px_32px]',
  adjusted: 'sm:grid-cols-[20px_1fr_56px_56px_96px_60px_60px_96px_32px]',
  noPrice: 'sm:grid-cols-[20px_1fr_72px_72px_32px]',
}

/** Field caption that only shows on phones, where there is no header row. */
function Cell({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-0.5 block text-[11px] text-stone-500 sm:hidden">{label}</span>
      {children}
    </label>
  )
}

export default function LineItemsEditor({
  items,
  onChange,
  currency,
  showPrices = true,
  itemAdjustments = false,
  defaultTaxRate = 0,
  taxLabel = 'SST',
}: {
  items: LineItem[]
  onChange: (items: LineItem[]) => void
  currency: string
  showPrices?: boolean
  /** Show per-line discount % and tax % columns. */
  itemAdjustments?: boolean
  defaultTaxRate?: number
  taxLabel?: string
}) {
  const update = (id: string, patch: Partial<LineItem>) => onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  const remove = (id: string) => onChange(items.filter((i) => i.id !== id))
  const add = () =>
    onChange([
      ...items,
      { id: uid(), description: '', qty: 1, unit: 'unit', unitPrice: 0, ...(itemAdjustments ? { discountPct: 0, taxRate: defaultTaxRate } : {}) },
    ])
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return
    const next = [...items]
    const [it] = next.splice(from, 1)
    next.splice(to, 0, it)
    onChange(next)
  }

  const adj = showPrices && itemAdjustments
  const grid = !showPrices ? GRID.noPrice : adj ? GRID.adjusted : GRID.plain

  return (
    <div>
      <div className={`hidden gap-2 px-1 pb-1.5 text-xs font-medium text-stone-500 sm:grid ${grid}`}>
        <span />
        <span>Description</span>
        <span>Qty</span>
        <span>Unit</span>
        {showPrices && <span>Unit price</span>}
        {adj && <span>Disc %</span>}
        {adj && <span>{taxLabel} %</span>}
        {showPrices && <span className="text-right">Amount</span>}
        <span />
      </div>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={item.id} className={`grid grid-cols-2 gap-2 rounded-lg border border-stone-200 p-2 sm:border-0 sm:p-0 ${grid}`}>
            <div className="hidden flex-col items-center justify-center text-stone-300 sm:flex">
              <button type="button" className="leading-none hover:text-stone-600" onClick={() => move(idx, idx - 1)} aria-label="Move up">▲</button>
              <GripVertical size={12} />
              <button type="button" className="leading-none hover:text-stone-600" onClick={() => move(idx, idx + 1)} aria-label="Move down">▼</button>
            </div>
            <Textarea
              className="col-span-2 min-h-9 py-1.5 sm:col-span-1"
              rows={1}
              placeholder="Item / service description"
              value={item.description}
              onChange={(e) => update(item.id, { description: e.target.value })}
            />
            <Cell label="Qty">
              <NumberInput value={item.qty} onValueChange={(qty) => update(item.id, { qty })} aria-label="Quantity" />
            </Cell>
            <Cell label="Unit">
              <Input value={item.unit} onChange={(e) => update(item.id, { unit: e.target.value })} aria-label="Unit" />
            </Cell>
            {showPrices && (
              <Cell label="Unit price">
                <NumberInput value={item.unitPrice} onValueChange={(unitPrice) => update(item.id, { unitPrice })} placeholder="0.00" aria-label="Unit price" />
              </Cell>
            )}
            {adj && (
              <Cell label="Disc %">
                <NumberInput value={item.discountPct ?? 0} onValueChange={(discountPct) => update(item.id, { discountPct: Math.min(100, discountPct) })} aria-label="Discount percent" />
              </Cell>
            )}
            {adj && (
              <Cell label={`${taxLabel} %`}>
                <NumberInput value={item.taxRate ?? defaultTaxRate} onValueChange={(taxRate) => update(item.id, { taxRate })} aria-label={`${taxLabel} percent`} />
              </Cell>
            )}
            {showPrices && (
              <div className="tabular flex items-end justify-end pb-2 text-sm font-medium sm:items-center sm:pb-0">
                {formatMoney(lineTotal(item, adj), currency)}
              </div>
            )}
            <button
              type="button"
              onClick={() => remove(item.id)}
              className="flex items-center justify-center rounded text-stone-400 hover:bg-red-50 hover:text-red-600 max-sm:col-span-2 max-sm:h-8"
              aria-label="Remove line"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={add}>
        <Plus size={14} /> Add line
      </Button>
    </div>
  )
}
