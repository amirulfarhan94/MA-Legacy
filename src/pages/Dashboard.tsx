import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ClipboardCheck, FileCheck2, FileText, ReceiptText, Sparkles } from 'lucide-react'
import { displayStatus, docTotals, formatDate, formatMoney, invoiceBalance, today } from '../lib/calc'
import { cashMovements, isOpenInvoice } from '../lib/finance'
import { customerLabel, useStore } from '../lib/store'
import { DOC_META } from '../lib/types'
import DocumentTable from '../components/DocumentTable'
import MonthlyChart, { type MonthPoint } from '../components/MonthlyChart'
import { Button, Card, CardHeader, EmptyState, StatusBadge } from '../components/ui'

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

export default function Dashboard() {
  const documents = useStore((s) => s.documents)
  const customers = useStore((s) => s.customers)
  const transactions = useStore((s) => s.transactions)
  const settings = useStore((s) => s.settings)
  const cur = settings.currency
  const nav = useNavigate()

  const data = useMemo(() => {
    const thisMonth = today().slice(0, 7)
    const thisYear = today().slice(0, 4)
    const moves = cashMovements(documents, transactions)
    // Money in is receipts + other income, net of refunds paid back to customers.
    const cashIn = moves.filter((m) => m.amount > 0 || m.category === 'Refund')
    const expenses = moves.filter((m) => m.amount < 0 && m.category !== 'Refund').map((m) => ({ ...m, amount: -m.amount }))
    const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0)

    const collectedMonth = sum(cashIn.filter((x) => x.date.startsWith(thisMonth)))
    const collectedYear = sum(cashIn.filter((x) => x.date.startsWith(thisYear)))
    const expenseYear = sum(expenses.filter((x) => x.date.startsWith(thisYear)))

    const openInvoices = documents
      .filter(isOpenInvoice)
      .map((d) => ({ d, balance: invoiceBalance(d, documents), status: displayStatus(d, documents) }))
      .filter((x) => x.balance > 0.005)
      .sort((a, b) => (a.d.dueDate || a.d.date).localeCompare(b.d.dueDate || b.d.date))
    const outstanding = openInvoices.reduce((s, x) => s + x.balance, 0)
    const overdue = openInvoices.filter((x) => x.status === 'overdue')

    const openQuotes = documents.filter((d) => d.type === 'quotation' && (d.status === 'sent' || d.status === 'draft'))
    const quoteValue = openQuotes.reduce((s, d) => s + docTotals(d).total, 0)

    const months: MonthPoint[] = []
    const now = new Date()
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = monthKey(d)
      months.push({ key, label: d.toLocaleDateString('en-GB', { month: 'short' }), value: sum(cashIn.filter((x) => x.date.startsWith(key))) })
    }

    const recent = [...documents].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.date.localeCompare(a.date)).slice(0, 8)

    return { collectedMonth, collectedYear, expenseYear, openInvoices, outstanding, overdue, openQuotes, quoteValue, months, recent }
  }, [documents, transactions])

  const isEmpty = documents.length === 0 && customers.length === 0

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-stone-500">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { t: 'quotation', icon: FileText },
            { t: 'invoice', icon: FileCheck2 },
            { t: 'receipt', icon: ReceiptText },
            { t: 'service_report', icon: ClipboardCheck },
          ].map(({ t, icon: Icon }) => (
            <Button key={t} variant={t === 'quotation' ? 'primary' : 'secondary'} onClick={() => nav(`/d/${DOC_META[t as keyof typeof DOC_META].path}/new`)}>
              <Icon size={15} /> {DOC_META[t as keyof typeof DOC_META].label}
            </Button>
          ))}
        </div>
      </div>

      {isEmpty && (
        <Card className="mb-5 border-gold-200 bg-gold-50/60">
          <div className="flex flex-col items-start gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
            <Sparkles className="text-gold-600" size={20} />
            <div className="flex-1 text-sm">
              <div className="font-medium">Welcome! Start by filling in your company details.</div>
              <div className="text-stone-600">Then add a customer and issue your first quotation. You can also load sample data to explore.</div>
            </div>
            <Button variant="primary" onClick={() => nav('/settings')}>
              Company settings
            </Button>
          </div>
        </Card>
      )}

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Collected this month" value={formatMoney(data.collectedMonth, cur)} />
        <Stat
          label="Outstanding invoices"
          value={formatMoney(data.outstanding, cur)}
          note={`${data.openInvoices.length} unpaid${data.overdue.length ? ` · ${data.overdue.length} overdue` : ''}`}
          warn={data.overdue.length > 0}
        />
        <Stat label="Open quotations" value={formatMoney(data.quoteValue, cur)} note={`${data.openQuotes.length} awaiting reply`} />
        <Stat label={`Net ${today().slice(0, 4)}`} value={formatMoney(data.collectedYear - data.expenseYear, cur)} note={`In ${formatMoney(data.collectedYear, cur)} · Out ${formatMoney(data.expenseYear, cur)}`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Money collected per month" subtitle="Receipts and other income, last 12 months" />
          <div className="px-5 pb-4 pt-2">
            <MonthlyChart data={data.months} currency={cur} />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Awaiting payment"
            action={
              <Link to={`/d/${DOC_META.invoice.path}`} className="text-xs text-gold-700 hover:underline">
                All invoices
              </Link>
            }
          />
          {data.openInvoices.length === 0 ? (
            <EmptyState title="Nothing outstanding" text="Unpaid invoices will appear here." />
          ) : (
            <ul className="divide-y divide-stone-100">
              {data.openInvoices.slice(0, 6).map(({ d, balance, status }) => (
                <li key={d.id}>
                  <Link to={`/d/${DOC_META.invoice.path}/${d.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-gold-50/40">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{customerLabel(customers.find((c) => c.id === d.customerId))}</div>
                      <div className="text-xs text-stone-500">
                        {d.number} · due {formatDate(d.dueDate)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="tabular text-sm font-medium">{formatMoney(balance, cur)}</div>
                      <StatusBadge status={status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader title="Recent documents" />
          {data.recent.length ? <DocumentTable docs={data.recent} showType /> : <EmptyState title="No documents yet" />}
        </Card>
      </div>
    </>
  )
}

function Stat({ label, value, note, warn }: { label: string; value: string; note?: string; warn?: boolean }) {
  return (
    <Card className="px-5 py-4">
      <div className="text-xs font-medium text-stone-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-stone-900 sm:text-xl">{value}</div>
      {note && <div className={`mt-0.5 text-xs ${warn ? 'font-medium text-red-700' : 'text-stone-500'}`}>{note}</div>}
    </Card>
  )
}
