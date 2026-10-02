import type { ReactNode } from 'react'
import { GripVertical, ListPlus, Plus, StickyNote, Trash2, X } from 'lucide-react'
import { formatMoney, hasPricedSubs, lineTotal, subAmount } from '../lib/calc'
import { uid } from '../lib/store'
import type { LineItem, SubItem } from '../lib/types'
import { Button, Input, NumberInput, Textarea } from './ui'

const GRID = {
  plain: 'sm:grid-cols-[20px_1fr_64px_64px_104px_104px_32px]',
  adjusted: 'sm:grid-cols-[20px_1fr_56px_56px_96px_60px_60px_96px_32px]',
  noPrice: 'sm:grid-cols-[20px_1fr_72px_72px_32px]',
}
/** Sub item rows: the same columns minus the drag handle (the row is indented by that width instead). */
const SUB_GRID = {
  plain: 'sm:grid-cols-[1fr_64px_64px_104px_104px_32px]',
  adjusted: 'sm:grid-cols-[1fr_56px_56px_96px_60px_60px_96px_32px]',
  noPrice: 'sm:grid-cols-[1fr_72px_72px_32px]',
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

/** Placeholder cell for a value that comes from the sub items. */
const FromSubs = () => (
  <div className="flex h-9 items-center justify-center rounded-lg border border-dashed border-stone-200 text-[11px] text-stone-400" title="Worked out from the priced sub items">
    sub items
  </div>
)

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

  const subs = (item: LineItem) => item.subItems ?? []
  const setSubs = (item: LineItem, subItems: SubItem[]) => update(item.id, { subItems: subItems.length ? subItems : undefined })
  const addSub = (item: LineItem, priced: boolean) =>
    setSubs(item, [...subs(item), { id: uid(), description: '', priced, qty: priced ? 1 : 0, unit: priced ? 'unit' : '', unitPrice: 0 }])
  const updateSub = (item: LineItem, subId: string, patch: Partial<SubItem>) =>
    setSubs(item, subs(item).map((s) => (s.id === subId ? { ...s, ...patch } : s)))
  const removeSub = (item: LineItem, subId: string) => setSubs(item, subs(item).filter((s) => s.id !== subId))

  const adj = showPrices && itemAdjustments
  const layout = !showPrices ? 'noPrice' : adj ? 'adjusted' : 'plain'
  const grid = GRID[layout]
  const subGrid = SUB_GRID[layout]

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
      <div className="space-y-2 sm:space-y-3">
        {items.map((item, idx) => {
          const fromSubs = showPrices && hasPricedSubs(item)
          let pricedNo = 0
          return (
            <div key={item.id} className="rounded-lg border border-stone-200 p-2 sm:border-0 sm:p-0">
              <div className={`grid grid-cols-2 gap-2 ${grid}`}>
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
                <Cell label="Qty" className={fromSubs ? 'max-sm:hidden' : ''}>
                  {fromSubs ? <FromSubs /> : <NumberInput value={item.qty} onValueChange={(qty) => update(item.id, { qty })} aria-label="Quantity" />}
                </Cell>
                <Cell label="Unit" className={fromSubs ? 'max-sm:hidden' : ''}>
                  {fromSubs ? <FromSubs /> : <Input value={item.unit} onChange={(e) => update(item.id, { unit: e.target.value })} aria-label="Unit" />}
                </Cell>
                {showPrices && (
                  <Cell label="Unit price" className={fromSubs ? 'max-sm:hidden' : ''}>
                    {fromSubs ? (
                      <FromSubs />
                    ) : (
                      <NumberInput value={item.unitPrice} onValueChange={(unitPrice) => update(item.id, { unitPrice })} placeholder="0.00" aria-label="Unit price" />
                    )}
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
                  <div className={`tabular flex items-end justify-end pb-2 text-sm font-medium sm:items-center sm:pb-0 ${fromSubs ? 'max-sm:col-span-2' : ''}`}>
                    {fromSubs && <span className="mr-auto text-xs font-normal text-stone-500 sm:hidden">Total of sub items</span>}
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

              {/* Sub items */}
              {subs(item).length > 0 && (
                <div className="mt-2 space-y-2 border-l-2 border-gold-200 pl-2 sm:ml-7 sm:mt-1.5 sm:space-y-1.5 sm:border-0 sm:pl-0">
                  {subs(item).map((s) => {
                    const priced = showPrices && s.priced
                    const marker = priced ? `${idx + 1}.${++pricedNo}` : '•'
                    return (
                      <div key={s.id} className={`grid grid-cols-2 gap-2 ${subGrid}`}>
                        <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
                          <span className={`w-8 shrink-0 text-right text-xs ${priced ? 'font-medium text-gold-700' : 'text-stone-400'}`}>{marker}</span>
                          <Input
                            value={s.description}
                            onChange={(e) => updateSub(item, s.id, { description: e.target.value })}
                            placeholder={priced ? 'Sub item' : 'Note / detail'}
                            aria-label={priced ? 'Sub item description' : 'Note'}
                          />
                          {showPrices && (
                            <button
                              type="button"
                              onClick={() => updateSub(item, s.id, { priced: !s.priced, ...(s.priced ? { unitPrice: 0 } : { qty: s.qty || 1 }) })}
                              className="whitespace-nowrap rounded border border-stone-200 px-1 py-0.5 text-[10px] text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                              title={s.priced ? 'Turn into a note without a price' : 'Give this line a price'}
                            >
                              {s.priced ? 'No price' : `+ ${currency}`}
                            </button>
                          )}
                        </div>
                        <Cell label="Qty">
                          <NumberInput value={s.qty} onValueChange={(qty) => updateSub(item, s.id, { qty })} placeholder={priced ? '0' : '—'} aria-label="Sub item quantity" />
                        </Cell>
                        <Cell label="Unit">
                          <Input value={s.unit} onChange={(e) => updateSub(item, s.id, { unit: e.target.value })} placeholder={priced ? '' : '—'} aria-label="Sub item unit" />
                        </Cell>
                        {showPrices && (
                          <Cell label="Unit price">
                            {priced ? (
                              <NumberInput value={s.unitPrice} onValueChange={(unitPrice) => updateSub(item, s.id, { unitPrice })} placeholder="0.00" aria-label="Sub item unit price" />
                            ) : (
                              <span className="hidden sm:block" />
                            )}
                          </Cell>
                        )}
                        {adj && <span className="hidden sm:block" />}
                        {adj && <span className="hidden sm:block" />}
                        {showPrices && (
                          <div className="tabular flex items-end justify-end pb-2 text-sm text-stone-600 sm:items-center sm:pb-0">
                            {priced ? formatMoney(subAmount(s), currency) : ''}
                          </div>
                        )}
                        <div className="flex items-center justify-center max-sm:col-span-2 max-sm:justify-end">
                          <button
                            type="button"
                            onClick={() => removeSub(item, s.id)}
                            className="rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600"
                            aria-label="Remove sub item"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="mt-1.5 flex flex-wrap gap-1 sm:ml-7">
                {showPrices && (
                  <button type="button" onClick={() => addSub(item, true)} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-stone-500 hover:bg-stone-100 hover:text-stone-800">
                    <ListPlus size={13} /> Sub item
                  </button>
                )}
                <button type="button" onClick={() => addSub(item, false)} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-stone-500 hover:bg-stone-100 hover:text-stone-800">
                  <StickyNote size={13} /> {showPrices ? 'Note' : 'Sub item'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={add}>
        <Plus size={14} /> Add line
      </Button>
    </div>
  )
}
