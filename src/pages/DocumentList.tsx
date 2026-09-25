import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { FileText, Plus, Search } from 'lucide-react'
import { displayStatus, docAmount, formatMoney } from '../lib/calc'
import { customerLabel, useStore } from '../lib/store'
import { DOC_META, docTypeFromPath } from '../lib/types'
import DocumentTable from '../components/DocumentTable'
import { Button, Card, EmptyState, Input, PageHeader, Select } from '../components/ui'

export default function DocumentList() {
  const { typePath } = useParams()
  const type = docTypeFromPath(typePath)
  const documents = useStore((s) => s.documents)
  const customers = useStore((s) => s.customers)
  const currency = useStore((s) => s.settings.currency)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [month, setMonth] = useState('')
  const nav = useNavigate()

  const ofType = useMemo(() => documents.filter((d) => d.type === type), [documents, type])
  const statuses = useMemo(() => [...new Set(ofType.map((d) => displayStatus(d, documents)))].sort(), [ofType, documents])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return ofType
      .filter((d) => !status || displayStatus(d, documents) === status)
      .filter((d) => !month || d.date.startsWith(month))
      .filter((d) => {
        if (!needle) return true
        const c = customers.find((x) => x.id === d.customerId)
        return [d.number, d.reference, customerLabel(c), c?.name ?? ''].some((v) => v.toLowerCase().includes(needle))
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number))
  }, [ofType, status, month, q, customers, documents])

  if (!type) return <Navigate to="/" replace />
  const meta = DOC_META[type]
  const total = rows.filter((d) => d.status !== 'cancelled').reduce((s, d) => s + docAmount(d), 0)

  return (
    <>
      <PageHeader
        title={meta.plural}
        subtitle={
          type === 'service_report'
            ? `${rows.length} report${rows.length === 1 ? '' : 's'}`
            : `${rows.length} shown · ${formatMoney(total, currency)} total (excluding cancelled)`
        }
        actions={
          <Button variant="primary" onClick={() => nav(`/d/${meta.path}/new`)}>
            <Plus size={16} /> New {meta.label.toLowerCase()}
          </Button>
        }
      />
      <Card>
        {ofType.length === 0 ? (
          <EmptyState
            icon={<FileText size={22} />}
            title={`No ${meta.plural.toLowerCase()} yet`}
            action={
              <Button variant="primary" onClick={() => nav(`/d/${meta.path}/new`)}>
                <Plus size={16} /> Create {meta.label.toLowerCase()}
              </Button>
            }
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-2 border-b border-stone-100 p-3">
              <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <Input placeholder="Search number or customer…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
              </div>
              <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto capitalize">
                <option value="">All statuses</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-auto" aria-label="Filter by month" />
              {(q || status || month) && (
                <Button variant="ghost" onClick={() => { setQ(''); setStatus(''); setMonth('') }}>
                  Clear
                </Button>
              )}
            </div>
            {rows.length ? <DocumentTable docs={rows} /> : <EmptyState title="Nothing matches these filters" />}
          </>
        )}
      </Card>
    </>
  )
}
