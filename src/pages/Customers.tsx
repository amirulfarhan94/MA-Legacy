import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Users } from 'lucide-react'
import { docTotals, formatMoney, invoicePaid } from '../lib/calc'
import { useStore } from '../lib/store'
import CustomerForm from '../components/CustomerForm'
import { Button, Card, EmptyState, Input, PageHeader, tableCls } from '../components/ui'

export default function Customers() {
  const customers = useStore((s) => s.customers)
  const documents = useStore((s) => s.documents)
  const currency = useStore((s) => s.settings.currency)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const nav = useNavigate()

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return customers
      .filter((c) =>
        !needle ? true : [c.name, c.company, c.email, c.phone].some((v) => v.toLowerCase().includes(needle)),
      )
      .map((c) => {
        const invoices = documents.filter((d) => d.customerId === c.id && d.type === 'invoice' && d.status !== 'cancelled' && d.status !== 'draft')
        const billed = invoices.reduce((s, d) => s + docTotals(d).total, 0)
        const paid = invoices.reduce((s, d) => s + invoicePaid(d.id, documents), 0)
        const docCount = documents.filter((d) => d.customerId === c.id).length
        return { c, billed, outstanding: Math.max(0, billed - paid), docCount }
      })
      .sort((a, b) => (a.c.company || a.c.name).localeCompare(b.c.company || b.c.name))
  }, [customers, documents, q])

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} customer${customers.length === 1 ? '' : 's'}`}
        actions={
          <Button variant="primary" onClick={() => setOpen(true)}>
            <Plus size={16} /> New customer
          </Button>
        }
      />
      <Card>
        {customers.length === 0 ? (
          <EmptyState
            icon={<Users size={22} />}
            title="No customers yet"
            text="Add your first customer to start issuing quotations and invoices."
            action={
              <Button variant="primary" onClick={() => setOpen(true)}>
                <Plus size={16} /> Add customer
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
                    <th className={tableCls.th}>Customer</th>
                    <th className={tableCls.th}>Contact</th>
                    <th className={`${tableCls.th} text-right`}>Documents</th>
                    <th className={`${tableCls.th} text-right`}>Total billed</th>
                    <th className={`${tableCls.th} text-right`}>Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ c, billed, outstanding, docCount }) => (
                    <tr key={c.id} className={tableCls.tr} onClick={() => nav(`/customers/${c.id}`)}>
                      <td className={tableCls.td}>
                        <div className="font-medium text-stone-900">{c.company || c.name}</div>
                        {c.company && c.name && <div className="text-xs text-stone-500">{c.name}</div>}
                      </td>
                      <td className={`${tableCls.td} text-stone-600`}>
                        <div>{c.phone || '—'}</div>
                        <div className="text-xs text-stone-500">{c.email}</div>
                      </td>
                      <td className={`${tableCls.td} tabular text-right`}>{docCount}</td>
                      <td className={`${tableCls.td} tabular text-right`}>{formatMoney(billed, currency)}</td>
                      <td className={`${tableCls.td} tabular text-right ${outstanding > 0 ? 'font-medium text-amber-700' : 'text-stone-500'}`}>
                        {formatMoney(outstanding, currency)}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-stone-500">
                        No customers match “{q}”.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
      <CustomerForm open={open} onClose={() => setOpen(false)} onSaved={(c) => nav(`/customers/${c.id}`)} />
    </>
  )
}
