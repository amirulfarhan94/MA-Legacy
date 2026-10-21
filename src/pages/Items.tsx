import { useMemo, useState } from 'react'
import { BookMarked, Plus, Search } from 'lucide-react'
import { formatMoney } from '../lib/calc'
import { frequentItems } from '../lib/catalog'
import { uid, useStore } from '../lib/store'
import type { CatalogItem } from '../lib/types'
import { Button, Card, CardHeader, EmptyState, Field, Input, Modal, NumberInput, PageHeader } from '../components/ui'

const blank = (): CatalogItem => ({ id: uid(), description: '', unit: 'unit', unitPrice: 0, createdAt: new Date().toISOString() })

/** Products and services with their usual price, suggested when typing a line item. */
export default function Items() {
  const catalog = useStore((s) => s.catalog)
  const documents = useStore((s) => s.documents)
  const currency = useStore((s) => s.settings.currency)
  const save = useStore((s) => s.saveCatalogItem)
  const remove = useStore((s) => s.deleteCatalogItem)
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<{ item: CatalogItem; isNew: boolean } | null>(null)

  const rows = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return catalog.filter((c) => words.every((w) => c.description.toLowerCase().includes(w)))
  }, [catalog, q])
  const frequent = useMemo(() => frequentItems(documents, catalog), [documents, catalog])

  return (
    <>
      <PageHeader
        title="Items"
        subtitle="Products and services with their usual price. They are suggested as you type a line on a quotation or invoice."
        actions={
          <Button variant="primary" onClick={() => setEditing({ item: blank(), isNew: true })}>
            <Plus size={16} /> New item
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <Card>
          {catalog.length > 0 && (
            <div className="border-b border-stone-200 p-4">
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items" aria-label="Search items" className="pl-9" />
              </div>
            </div>
          )}
          {catalog.length === 0 ? (
            <EmptyState
              icon={<BookMarked size={22} />}
              title="No items yet"
              text="Add the products and services you sell often, or save a line from any quotation or invoice with “Save to catalog”."
              action={
                <Button variant="primary" onClick={() => setEditing({ item: blank(), isNew: true })}>
                  <Plus size={16} /> New item
                </Button>
              }
            />
          ) : rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-stone-500">No items match “{q}”.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {rows.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setEditing({ item: { ...c }, isNew: false })}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-[var(--item-hover)]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block whitespace-pre-line text-sm font-medium text-stone-900">{c.description}</span>
                      <span className="block text-xs text-stone-500">per {c.unit || 'unit'}</span>
                    </span>
                    <span className="tabular shrink-0 text-sm font-semibold text-stone-900">{formatMoney(c.unitPrice, currency)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {frequent.length > 0 && (
          <Card>
            <CardHeader title="Often used, not in the catalog" subtitle="From your quotations and invoices, with the last price charged." />
            <ul className="divide-y divide-stone-100">
              {frequent.map((f) => (
                <li key={f.description} className="flex items-center gap-3 px-5 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-stone-900">{f.description}</span>
                    <span className="block text-xs text-stone-500">
                      {formatMoney(f.unitPrice, currency)} per {f.unit || 'unit'} · used {f.uses}×
                    </span>
                  </span>
                  <Button
                    size="sm"
                    onClick={() => save({ id: uid(), description: f.description, unit: f.unit, unitPrice: f.unitPrice, createdAt: new Date().toISOString() })}
                  >
                    <Plus size={14} /> Add
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <ItemModal
        editing={editing}
        currency={currency}
        onClose={() => setEditing(null)}
        onSave={(item) => {
          save({ ...item, description: item.description.trim(), unit: item.unit.trim() })
          setEditing(null)
        }}
        onDelete={(id) => {
          if (!confirm('Delete this item from the catalog? Documents that use it stay as they are.')) return
          remove(id)
          setEditing(null)
        }}
      />
    </>
  )
}

function ItemModal({
  editing,
  currency,
  onClose,
  onSave,
  onDelete,
}: {
  editing: { item: CatalogItem; isNew: boolean } | null
  currency: string
  onClose: () => void
  onSave: (c: CatalogItem) => void
  onDelete: (id: string) => void
}) {
  const [form, setForm] = useState<CatalogItem | null>(editing?.item ?? null)
  const [last, setLast] = useState(editing)
  if (editing !== last) {
    setLast(editing)
    setForm(editing?.item ?? null)
  }
  if (!editing || !form) return null
  const set = <K extends keyof CatalogItem>(k: K, v: CatalogItem[K]) => setForm({ ...form, [k]: v })

  return (
    <Modal
      open
      onClose={onClose}
      title={editing.isNew ? 'New item' : 'Edit item'}
      footer={
        <>
          {!editing.isNew && (
            <Button variant="danger" onClick={() => onDelete(form.id)} className="mr-auto">
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!form.description.trim()} onClick={() => onSave(form)}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Description" className="col-span-2">
          <Input value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="e.g. Supply & install CCTV camera 4MP" autoFocus />
        </Field>
        <Field label="Unit">
          <Input value={form.unit} onChange={(e) => set('unit', e.target.value)} placeholder="unit, lot, hour…" />
        </Field>
        <Field label={`Usual price (${currency})`}>
          <NumberInput value={form.unitPrice} onValueChange={(v) => set('unitPrice', v)} placeholder="0.00" />
        </Field>
      </div>
    </Modal>
  )
}
