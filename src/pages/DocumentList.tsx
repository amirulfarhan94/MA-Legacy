import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Plus, Search, X } from 'lucide-react'
import { displayStatus, docAmount, formatMoney, monthLabel } from '../lib/calc'
import { customerLabel, useStore } from '../lib/store'
import { DOC_META, docTypeFromPath } from '../lib/types'
import DocumentTable from '../components/DocumentTable'
import { DOC_ICON } from '../components/nav'
import { Button, Card, ChipGroup, EmptyState, Input, PageHeader, Select, STATUS_DOT, STATUS_ORDER } from '../components/ui'

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

  const ofType = useMemo(
    () => documents.filter((d) => d.type === type).map((d) => ({ d, status: displayStatus(d, documents) })),
    [documents, type],
  )
  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const { status } of ofType) counts.set(status, (counts.get(status) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => STATUS_ORDER.indexOf(a[0]) - STATUS_ORDER.indexOf(b[0]))
  }, [ofType])
  const months = useMemo(() => [...new Set(ofType.map(({ d }) => d.date.slice(0, 7)))].sort().reverse(), [ofType])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return ofType
      .filter((r) => !status || r.status === status)
      .filter(({ d }) => !month || d.date.startsWith(month))
      .filter(({ d }) => {
        if (!needle) return true
        const c = customers.find((x) => x.id === d.customerId)
        return [d.number, d.reference, customerLabel(c), c?.name ?? ''].some((v) => v.toLowerCase().includes(needle))
      })
      .map(({ d }) => d)
      .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number))
  }, [ofType, status, month, q, customers])

  if (!type) return <Navigate to="/" replace />
  const meta = DOC_META[type]
  const Icon = DOC_ICON[type]
  const total = rows.filter((d) => d.status !== 'cancelled').reduce((s, d) => s + docAmount(d), 0)
  const filtered = !!(q || status || month)

  return (
    <>
      <PageHeader
        title={meta.plural}
        subtitle={
          type === 'service_report' || type === 'delivery_order'
            ? `${rows.length} ${meta.label.toLowerCase()}${rows.length === 1 ? '' : 's'}`
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
            icon={<Icon size={22} />}
            title={`No ${meta.plural.toLowerCase()} yet`}
            action={
              <Button variant="primary" onClick={() => nav(`/d/${meta.path}/new`)}>
                <Plus size={16} /> Create {meta.label.toLowerCase()}
              </Button>
            }
          />
        ) : (
          <>
            <div className="space-y-2.5 border-b border-stone-200 p-3">
              <div className="flex flex-wrap gap-2">
                <div className="relative min-w-[180px] flex-1 sm:max-w-sm">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <Input placeholder="Search number or customer…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
                </div>
                <Select value={month} onChange={(e) => setMonth(e.target.value)} className="w-auto" aria-label="Month">
                  <option value="">All months</option>
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {monthLabel(m)}
                    </option>
                  ))}
                </Select>
                {filtered && (
                  <Button variant="ghost" onClick={() => { setQ(''); setStatus(''); setMonth('') }}>
                    <X size={14} /> Clear
                  </Button>
                )}
              </div>
              {statusCounts.length > 1 && (
                <ChipGroup
                  label="Status"
                  value={status}
                  onChange={setStatus}
                  options={[
                    { value: '', label: 'All', count: ofType.length },
                    ...statusCounts.map(([s, n]) => ({ value: s, label: s, count: n, dot: STATUS_DOT[s] })),
                  ]}
                />
              )}
            </div>
            {rows.length ? <DocumentTable docs={rows} /> : <EmptyState title="Nothing matches these filters" />}
          </>
        )}
      </Card>
    </>
  )
}
