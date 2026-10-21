import { useId, useState } from 'react'
import { BookMarked, History } from 'lucide-react'
import { formatDate, formatMoney } from '../lib/calc'
import { sameItem, type ItemSuggestion } from '../lib/catalog'
import { Textarea } from './ui'

/**
 * Line item description that suggests catalog items and items from earlier documents while
 * typing. Picking one fills in the description, unit and price.
 */
export default function ItemDescriptionInput({
  value,
  onChange,
  onPick,
  suggest,
  currency,
  showPrices,
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  onPick: (s: ItemSuggestion) => void
  suggest?: (query: string) => ItemSuggestion[]
  currency: string
  showPrices: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listId = useId()
  const list = open && suggest ? suggest(value).filter((s) => !sameItem(s.description, value)) : []
  const shown = list.length > 0

  const pick = (s: ItemSuggestion) => {
    onPick(s)
    setOpen(false)
  }

  return (
    <div className={`relative ${className}`}>
      <Textarea
        className="min-h-9 py-1.5"
        rows={1}
        placeholder="Item / service description"
        value={value}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={shown}
        aria-controls={listId}
        aria-activedescendant={shown ? `${listId}-${active}` : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onKeyDown={(e) => {
          if (!shown) return
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length)
          } else if (e.key === 'Enter') {
            e.preventDefault()
            pick(list[Math.min(active, list.length - 1)])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
      />
      {shown && (
        <ul id={listId} role="listbox" className="glass-strong absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-2xl p-1.5 sm:right-auto sm:w-[min(440px,80vw)]">
          {list.map((s, i) => (
            <li
              key={`${s.source}-${s.description}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown, not click: the textarea would lose focus and close the list first.
              onMouseDown={(e) => {
                e.preventDefault()
                pick(s)
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-start gap-2.5 rounded-xl px-2.5 py-2 text-sm ${i === active ? 'bg-[var(--item-hover)]' : ''}`}
            >
              {s.source === 'catalog' ? (
                <BookMarked size={15} className="mt-0.5 shrink-0 text-gold-700" aria-label="From the catalog" />
              ) : (
                <History size={15} className="mt-0.5 shrink-0 text-stone-400" aria-label="Used before" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-stone-900">{s.description}</span>
                <span className="block text-xs text-stone-500">
                  {s.source === 'catalog' ? 'Catalog' : `Last used ${formatDate(s.lastUsed ?? '')}`}
                  {s.unit && ` · per ${s.unit}`}
                </span>
              </span>
              {showPrices && <span className="tabular shrink-0 text-sm font-medium text-stone-900">{formatMoney(s.unitPrice, currency)}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
