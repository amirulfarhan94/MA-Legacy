import { useId, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { customerLabel } from '../lib/store'
import type { Customer } from '../lib/types'
import { Input } from './ui'

const words = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean)
const haystack = (c: Customer) => [c.company, c.name, c.phone, c.email].filter(Boolean).join(' ').toLowerCase()

/**
 * Customer or supplier field you can type into: the list narrows to names, companies or phone
 * numbers containing what is typed. Easier than a long dropdown once there are many contacts.
 */
export default function PartyPicker({
  value,
  parties,
  onChange,
  placeholder,
}: {
  value: string
  parties: Customer[]
  onChange: (id: string) => void
  placeholder: string
}) {
  const selected = parties.find((c) => c.id === value)
  const [query, setQuery] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const listId = useId()
  const open = query !== null
  const q = words(query ?? '')
  const list = open ? parties.filter((c) => q.every((w) => haystack(c).includes(w))) : []

  const pick = (c: Customer) => {
    onChange(c.id)
    setQuery(null)
  }

  return (
    <div className="relative min-w-0 flex-1">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden="true" />
      <Input
        className="w-full pl-9 pr-8"
        placeholder={placeholder}
        value={open ? query : selected ? customerLabel(selected) : ''}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && list.length > 0}
        aria-controls={listId}
        aria-activedescendant={open && list.length ? `${listId}-${active}` : undefined}
        onFocus={() => {
          setQuery('')
          setActive(Math.max(0, parties.findIndex((c) => c.id === value)))
        }}
        onBlur={() => setQuery(null)}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
        }}
        onKeyDown={(e) => {
          if (!open) return
          if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && list.length) {
            e.preventDefault()
            setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length)
          } else if (e.key === 'Enter' && list.length) {
            e.preventDefault()
            pick(list[Math.min(active, list.length - 1)])
          } else if (e.key === 'Escape') {
            setQuery(null)
            e.currentTarget.blur()
          }
        }}
      />
      <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden="true" />
      {open && (
        <ul id={listId} role="listbox" className="glass-strong absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-2xl p-1.5">
          {list.length === 0 && <li className="px-2.5 py-2 text-sm text-stone-500">No match. Use + to add a new one.</li>}
          {list.map((c, i) => (
            <li
              key={c.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={c.id === value}
              // mousedown, not click: the input would lose focus and close the list first.
              onMouseDown={(e) => {
                e.preventDefault()
                pick(c)
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer rounded-xl px-2.5 py-2 text-sm ${i === active ? 'bg-[var(--item-hover)]' : ''}`}
            >
              <span className={`block truncate ${c.id === value ? 'font-semibold text-gold-700' : 'text-stone-900'}`}>{customerLabel(c)}</span>
              {(c.company && c.name) || c.phone ? (
                <span className="block truncate text-xs text-stone-500">{[c.company && c.name, c.phone].filter(Boolean).join(' · ')}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
