import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { formatMoney, lineTotal } from '../lib/calc'
import { uid } from '../lib/store'
import type { LineItem } from '../lib/types'
import { Button, Input, Textarea } from './ui'

export default function LineItemsEditor({
  items,
  onChange,
  currency,
  showPrices = true,
}: {
  items: LineItem[]
  onChange: (items: LineItem[]) => void
  currency: string
  showPrices?: boolean
}) {
  const update = (id: string, patch: Partial<LineItem>) => onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  const remove = (id: string) => onChange(items.filter((i) => i.id !== id))
  const add = () => onChange([...items, { id: uid(), description: '', qty: 1, unit: 'unit', unitPrice: 0 }])
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return
    const next = [...items]
    const [it] = next.splice(from, 1)
    next.splice(to, 0, it)
    onChange(next)
  }

  const num = (v: string) => (v === '' ? 0 : Number(v))

  return (
    <div>
      <div className="hidden gap-2 px-1 pb-1.5 text-xs font-medium text-stone-500 sm:grid sm:grid-cols-[20px_1fr_72px_72px_110px_110px_32px]">
        <span />
        <span>Description</span>
        <span>Qty</span>
        <span>Unit</span>
        {showPrices ? <span>Unit price</span> : <span />}
        {showPrices ? <span className="text-right">Amount</span> : <span />}
        <span />
      </div>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div
            key={item.id}
            className="grid grid-cols-2 gap-2 rounded-lg border border-stone-200 p-2 sm:grid-cols-[20px_1fr_72px_72px_110px_110px_32px] sm:border-0 sm:p-0"
          >
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
            <Input type="number" min="0" step="any" value={item.qty} onChange={(e) => update(item.id, { qty: num(e.target.value) })} aria-label="Quantity" />
            <Input value={item.unit} onChange={(e) => update(item.id, { unit: e.target.value })} aria-label="Unit" />
            {showPrices ? (
              <Input
                type="number"
                min="0"
                step="0.01"
                value={item.unitPrice}
                onChange={(e) => update(item.id, { unitPrice: num(e.target.value) })}
                aria-label="Unit price"
              />
            ) : (
              <span className="hidden sm:block" />
            )}
            {showPrices ? (
              <div className="tabular flex items-center justify-end text-sm font-medium">{formatMoney(lineTotal(item), currency)}</div>
            ) : (
              <span className="hidden sm:block" />
            )}
            <button
              type="button"
              onClick={() => remove(item.id)}
              className="flex items-center justify-center rounded text-stone-400 hover:bg-red-50 hover:text-red-600"
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
