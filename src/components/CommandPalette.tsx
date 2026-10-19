import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutGrid, Moon, Search, ShieldCheck, Sun, Users, Warehouse, type LucideIcon } from 'lucide-react'
import { backupNow, daysSince, useLastBackup } from '../lib/backup'
import { displayStatus, docAmount, formatMoney, invoiceBalance, today } from '../lib/calc'
import { defaultBrand, nextBrandNumber } from '../lib/brand'
import { customerLabel, useStore } from '../lib/store'
import { isDarkNow, useTheme } from '../lib/theme'
import { DOC_META, DOC_TYPES, type DocType, type Document } from '../lib/types'
import { DOC_ICON, NAV, isMac, type NavLinkItem } from './nav'
import Overlay from './Overlay'

interface Result {
  key: string
  icon: LucideIcon
  title: string
  sub?: string
  run: () => void
}
interface Group {
  label: string
  items: Result[]
}

const MAIN_TYPES: DocType[] = ['quotation', 'invoice', 'receipt', 'service_report']

/** Search documents, customers and pages, or start a new document. Opens with Ctrl K / ⌘K. */
export default function CommandPalette({ open, onClose, onMoreDocuments }: { open: boolean; onClose: () => void; onMoreDocuments: () => void }) {
  return (
    <Overlay open={open} onClose={onClose} label="Search" className="max-w-[620px] overflow-hidden">
      <PaletteBody onClose={onClose} onMoreDocuments={onMoreDocuments} />
    </Overlay>
  )
}

function PaletteBody({ onClose, onMoreDocuments }: { onClose: () => void; onMoreDocuments: () => void }) {
  const nav = useNavigate()
  const documents = useStore((s) => s.documents)
  const customers = useStore((s) => s.customers)
  const settings = useStore((s) => s.settings)
  const brands = useStore((s) => s.brands)
  const lastBackup = useLastBackup()
  const [, setTheme] = useTheme()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const list = useRef<HTMLUListElement>(null)

  const groups = useMemo<Group[]>(() => {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const searching = terms.length > 0
    const matches = (text: string) => terms.every((t) => text.includes(t))
    const byId = new Map(customers.map((c) => [c.id, c]))
    const cur = settings.currency

    const createItem = (t: DocType): Result => ({
      key: `new-${t}`,
      icon: DOC_ICON[t],
      title: `New ${DOC_META[t].label.toLowerCase()}`,
      sub: `Next number ${nextBrandNumber(t, defaultBrand(brands), settings, today(), documents)}`,
      run: () => nav(`/d/${DOC_META[t].path}/new`),
    })
    const create: Result[] = searching
      ? DOC_TYPES.filter((t) => matches(`new create ${DOC_META[t].label} ${DOC_META[t].plural}`.toLowerCase())).map(createItem)
      : [...MAIN_TYPES.map(createItem), { key: 'more', icon: LayoutGrid, title: 'More documents…', sub: 'Proforma, delivery order, credit note, purchase order', run: onMoreDocuments }]

    const docItem = (d: Document, status: string): Result => {
      const isInvoice = d.type === 'invoice'
      const balance = isInvoice ? invoiceBalance(d, documents) : 0
      const amount = docAmount(d)
      const money = isInvoice && balance > 0.005 ? `${formatMoney(balance, cur)} due` : amount ? formatMoney(amount, cur) : ''
      return {
        key: d.id,
        icon: DOC_ICON[d.type],
        title: `${d.number} · ${customerLabel(byId.get(d.customerId))}`,
        sub: [DOC_META[d.type].label, money, status].filter(Boolean).join(' · '),
        run: () => nav(`/d/${DOC_META[d.type].path}/${d.id}`),
      }
    }
    let docs: Result[]
    if (searching) {
      docs = documents
        .map((d) => ({ d, status: displayStatus(d, documents) }))
        .filter(({ d, status }) =>
          matches(`${d.number} ${DOC_META[d.type].label} ${customerLabel(byId.get(d.customerId))} ${d.reference} ${status}`.toLowerCase()),
        )
        .sort((a, b) => b.d.date.localeCompare(a.d.date) || b.d.number.localeCompare(a.d.number))
        .slice(0, 8)
        .map(({ d, status }) => docItem(d, status))
    } else {
      docs = [...documents]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 5)
        .map((d) => docItem(d, displayStatus(d, documents)))
    }

    const contacts: Result[] = searching
      ? customers
          .filter((c) => matches(`${c.name} ${c.company} ${c.phone} ${c.email} ${c.kind ?? 'customer'}`.toLowerCase()))
          .slice(0, 5)
          .map((c) => {
            const supplier = c.kind === 'supplier'
            return {
              key: c.id,
              icon: supplier ? Warehouse : Users,
              title: customerLabel(c),
              sub: [supplier ? 'Supplier' : 'Customer', c.company && c.name !== c.company ? c.name : '', c.phone].filter(Boolean).join(' · '),
              run: () => nav(`/${supplier ? 'suppliers' : 'customers'}/${c.id}`),
            }
          })
      : []

    const pages: Result[] = searching
      ? NAV.filter((n): n is NavLinkItem => 'to' in n && matches(`go ${n.label}`.toLowerCase())).map((n) => ({
          key: `page-${n.to}`,
          icon: n.icon,
          title: n.label,
          sub: 'Open page',
          run: () => nav(n.to),
        }))
      : []

    const days = daysSince(lastBackup)
    const dark = isDarkNow()
    const actions: Result[] = [
      {
        key: 'backup',
        icon: ShieldCheck,
        title: 'Back up now',
        sub: days === null ? 'Never backed up' : `Last backup ${days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`}`,
        run: () => void backupNow(),
      },
      {
        key: 'theme',
        icon: dark ? Sun : Moon,
        title: dark ? 'Switch to light mode' : 'Switch to dark mode',
        sub: 'Night mode',
        run: () => setTheme(dark ? 'light' : 'dark'),
      },
    ].filter((a) => !searching || matches(`${a.title} ${a.sub} backup save theme dark light night mode`.toLowerCase()))

    return [
      { label: 'Create', items: create },
      { label: searching ? 'Documents' : 'Recent', items: docs },
      { label: 'Contacts', items: contacts },
      { label: 'Pages', items: pages },
      { label: 'Actions', items: actions },
    ].filter((g) => g.items.length)
  }, [q, documents, customers, settings, brands, lastBackup, nav, onMoreDocuments, setTheme])

  const flat = groups.flatMap((g) => g.items)
  useEffect(() => setSel(0), [q])
  useEffect(() => {
    list.current?.querySelector(`[data-index="${sel}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  const run = (r: Result) => {
    onClose()
    r.run()
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (!flat.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSel((s) => (s + 1) % flat.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSel((s) => (s - 1 + flat.length) % flat.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      run(flat[Math.min(sel, flat.length - 1)])
    }
  }

  let index = 0
  return (
    <div className="flex max-h-[min(580px,80vh)] flex-col">
      <div className="flex items-center gap-2.5 border-b border-stone-200 px-4">
        <Search size={18} className="shrink-0 text-stone-500" />
        <input
          data-autofocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search documents, customers, or type “new”…"
          className="h-14 min-w-0 flex-1 bg-transparent text-[15px] font-medium text-stone-900 outline-none placeholder:text-stone-400"
          role="combobox"
          aria-expanded="true"
          aria-controls="search-results"
          aria-activedescendant={flat.length ? `search-${sel}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          enterKeyHint="go"
        />
        <kbd className="hidden rounded-lg border border-[var(--btn-line)] px-1.5 py-1 font-sans text-[10.5px] font-bold text-stone-400 sm:block">esc</kbd>
      </div>
      <ul id="search-results" ref={list} role="listbox" aria-label="Results" className="flex-1 overflow-y-auto overscroll-contain p-2">
        {groups.map((g) => (
          <li key={g.label} role="presentation">
            <div className="px-2.5 pb-1.5 pt-2.5 text-[10.5px] font-bold uppercase tracking-wider text-stone-500">{g.label}</div>
            <ul role="group" aria-label={g.label}>
              {g.items.map((r) => {
                const i = index++
                return (
                  <li
                    key={r.key}
                    id={`search-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={i === sel}
                    onMouseMove={() => i !== sel && setSel(i)}
                    onClick={() => run(r)}
                    className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl px-2.5 py-2 ${i === sel ? 'bg-[var(--item-active)] shadow-[var(--item-active-shadow)]' : ''}`}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gold-400/15 text-gold-700">
                      <r.icon size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-stone-900">{r.title}</span>
                      {r.sub && <span className="mt-0.5 block truncate text-xs font-medium text-stone-500">{r.sub}</span>}
                    </span>
                  </li>
                )
              })}
            </ul>
          </li>
        ))}
        {!flat.length && (
          <li className="px-4 py-10 text-center text-sm text-stone-500">
            Nothing matches “{q.trim()}”. Try a document number, a customer name or “new”.
          </li>
        )}
      </ul>
      <div className="hidden border-t border-stone-200 px-4 py-2.5 text-[11.5px] font-semibold text-stone-500 sm:block">
        ↑ ↓ to move · Enter to open · Esc to close · {isMac() ? '⌘K' : 'Ctrl K'} anywhere
      </div>
    </div>
  )
}
