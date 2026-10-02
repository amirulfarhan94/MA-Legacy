import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Users, Warehouse } from 'lucide-react'
import { formatMoney } from '../lib/calc'
import { contactTotals } from '../lib/finance'
import { contactKind, useStore } from '../lib/store'
import type { ContactKind } from '../lib/types'
import CustomerForm from '../components/CustomerForm'
import { Button, Card, EmptyState, Input, PageHeader, tableCls } from '../components/ui'

const COPY: Record<ContactKind, { title: string; one: string; base: string; empty: string; billed: string }> = {
  customer: {
    title: 'Customers',
    one: 'customer',
    base: '/customers',
    empty: 'Add your first customer to start issuing quotations and invoices.',
    billed: 'Total billed',
  },
  supplier: {
    title: 'Suppliers',
    one: 'supplier',
    base: '/suppliers',
    empty: 'Add the suppliers you buy from to send them purchase orders.',
    billed: 'Purchases',
  },
}

export default function Customers({ kind }: { kind: ContactKind }) {
  const all = useStore((s) => s.customers)
  const documents = useStore((s) => s.documents)
  const transactions = useStore((s) => s.transactions)
  const currency = useStore((s) => s.settings.currency)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const nav = useNavigate()
  const copy = COPY[kind]

  const contacts = useMemo(() => all.filter((c) => contactKind(c) === kind), [all, kind])
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return contacts
      .filter((c) => (!needle ? true : [c.name, c.company, c.email, c.phone].some((v) => v.toLowerCase().includes(needle))))
      .map((c) => ({
        c,
        ...contactTotals(c.id, kind, documents, transactions),
        docCount: documents.filter((d) => d.customerId === c.id).length,
      }))
      .sort((a, b) => (a.c.company || a.c.name).localeCompare(b.c.company || b.c.name))
  }, [contacts, documents, transactions, q, kind])

  return (
    <>
      <PageHeader
        title={copy.title}
        subtitle={`${contacts.length} ${copy.one}${contacts.length === 1 ? '' : 's'}`}
        actions={
          <Button variant="primary" onClick={() => setOpen(true)}>
            <Plus size={16} /> New {copy.one}
          </Button>
        }
      />
      <Card>
        {contacts.length === 0 ? (
          <EmptyState
            icon={kind === 'supplier' ? <Warehouse size={22} /> : <Users size={22} />}
            title={`No ${copy.title.toLowerCase()} yet`}
            text={copy.empty}
            action={
              <Button variant="primary" onClick={() => setOpen(true)}>
                <Plus size={16} /> Add {copy.one}
              </Button>
            }
          />
        ) : (
          <>
            <div className="border-b border-stone-100 p-3">
              <div className="relative max-w-sm">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <Input placeholder="Search name, company, phone…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className={tableCls.table}>
                <thead>
                  <tr>
                    <th className={tableCls.th}>{kind === 'supplier' ? 'Supplier' : 'Customer'}</th>
                    <th className={tableCls.th}>Contact</th>
                    <th className={`${tableCls.th} text-right`}>Documents</th>
                    <th className={`${tableCls.th} text-right`}>{copy.billed}</th>
                    <th className={`${tableCls.th} text-right`}>{kind === 'supplier' ? 'Unpaid' : 'Outstanding'}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ c, billed, outstanding, docCount }) => (
                    <tr key={c.id} className={tableCls.tr} onClick={() => nav(`${copy.base}/${c.id}`)}>
                      <td className={tableCls.td}>
                        <div className="font-medium text-stone-900">{c.company || c.name}</div>
                        {c.company && c.name && <div className="text-xs text-stone-500">{c.name}</div>}
                      </td>
                      <td className={`${tableCls.td} text-stone-600`}>
                        <div>{c.phone || '—'}</div>
                        <div className="text-xs text-stone-500">{c.email}</div>
                      </td>
                      <td className={`${tableCls.td} tabular text-right`}>{docCount}</td>
                      <td className={`${tableCls.td} tabular whitespace-nowrap text-right`}>{formatMoney(billed, currency)}</td>
                      <td className={`${tableCls.td} tabular whitespace-nowrap text-right ${outstanding > 0 ? 'font-medium text-amber-700' : 'text-stone-500'}`}>
                        {formatMoney(outstanding, currency)}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-stone-500">
                        No {copy.title.toLowerCase()} match “{q}”.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
      <CustomerForm open={open} defaultKind={kind} onClose={() => setOpen(false)} onSaved={(c) => nav(`${COPY[contactKind(c)].base}/${c.id}`)} />
    </>
  )
}
