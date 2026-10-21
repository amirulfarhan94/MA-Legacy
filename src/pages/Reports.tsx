import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BarChart3, Download, Printer } from 'lucide-react'
import { formatMoney, monthLabel, today } from '../lib/calc'
import { AGING_BUCKETS, agingByCustomer, expensesByCategory, monthlyPnL, openInvoices } from '../lib/finance'
import { customerLabel, useStore } from '../lib/store'
import { DOC_META } from '../lib/types'
import { Button, Card, CardHeader, EmptyState, PageHeader, Select, tableCls } from '../components/ui'
import AccountsExportButton from '../components/AccountsExportButton'

const monthName = (ym: string) => monthLabel(ym, false)

/** Aging colours, from not yet due (green) to long overdue (red). */
const BUCKET_COLOR = ['var(--good)', 'var(--warn)', 'var(--serious)', 'var(--critical)', '#9e1f1f']
const plain = (v: number) => formatMoney(v, '').trim()

function AgingBar({ buckets }: { buckets: number[] }) {
  return (
    <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-stone-100" aria-hidden="true">
      {buckets.map((v, i) => (v > 0 ? <span key={i} style={{ flex: v, background: BUCKET_COLOR[i] }} /> : null))}
    </div>
  )
}

function AgingLegend({ buckets }: { buckets: number[] }) {
  return (
    <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-stone-600">
      {buckets.map((v, i) =>
        v > 0 ? (
          <span key={i} className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <i className="size-2 rounded-full" style={{ background: BUCKET_COLOR[i] }} />
            {AGING_BUCKETS[i]} <b className="tabular font-semibold text-stone-900">{plain(v)}</b>
          </span>
        ) : null,
      )}
    </div>
  )
}

export default function Reports() {
  const documents = useStore((s) => s.documents)
  const transactions = useStore((s) => s.transactions)
  const customers = useStore((s) => s.customers)
  const cur = useStore((s) => s.settings.currency)
  const nav = useNavigate()
  const thisYear = today().slice(0, 4)

  const years = useMemo(() => {
    const set = new Set<string>([thisYear])
    for (const d of documents) set.add(d.date.slice(0, 4))
    for (const t of transactions) set.add(t.date.slice(0, 4))
    return [...set].sort().reverse()
  }, [documents, transactions, thisYear])
  const [year, setYear] = useState(thisYear)

  const aging = useMemo(() => agingByCustomer(documents), [documents])
  const agingTotals = aging.reduce((acc, r) => acc.map((v, i) => v + r.buckets[i]), [0, 0, 0, 0, 0])
  const agingGrand = agingTotals.reduce((s, v) => s + v, 0)
  const overdueCount = useMemo(() => openInvoices(documents).filter((o) => o.daysOverdue > 0).length, [documents])

  const pnl = useMemo(() => monthlyPnL(year, documents, transactions), [year, documents, transactions])
  const pnlTotal = pnl.reduce(
    (a, r) => ({ sales: a.sales + r.sales, moneyIn: a.moneyIn + r.moneyIn, moneyOut: a.moneyOut + r.moneyOut, net: a.net + r.net }),
    { sales: 0, moneyIn: 0, moneyOut: 0, net: 0 },
  )
  const expenses = useMemo(() => expensesByCategory(year, transactions), [year, transactions])
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0)
  // Hide months after the current one in the current year.
  const visibleMonths = pnl.filter((r) => year < thisYear || r.month <= today().slice(0, 7))

  const exportCsv = () => {
    const rows = [
      ['Month', 'Sales invoiced', 'Money in', 'Money out', 'Net'],
      ...visibleMonths.map((r) => [r.month, r.sales, r.moneyIn, r.moneyOut, r.net].map(String)),
      ['Total', pnlTotal.sales, pnlTotal.moneyIn, pnlTotal.moneyOut, pnlTotal.net].map((v) => (typeof v === 'number' ? v.toFixed(2) : v)),
    ]
    const blob = new Blob([rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `profit-and-loss-${year}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const num = 'tabular whitespace-nowrap text-right'

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Who owes you, and how the business is doing month by month."
        actions={
          <div className="flex flex-wrap gap-2">
            <AccountsExportButton />
            <Button onClick={() => window.print()} className="no-print">
              <Printer size={15} /> Print
            </Button>
          </div>
        }
      />

      <div className="space-y-5">
        <Card>
          <CardHeader
            title="Outstanding invoices by age"
            subtitle={`As at today · ${formatMoney(agingGrand, cur)} owed${overdueCount ? ` · ${overdueCount} invoice${overdueCount === 1 ? '' : 's'} overdue` : ''}`}
          />
          {aging.length === 0 ? (
            <EmptyState icon={<BarChart3 size={22} />} title="Nothing outstanding" text="Every issued invoice is fully paid or credited." />
          ) : (
            <div className="@container">
              <div className="space-y-2.5 border-b border-stone-200 px-5 py-4">
                <AgingBar buckets={agingTotals} />
                <AgingLegend buckets={agingTotals} />
              </div>
              <ul className="divide-y divide-stone-200 @min-[760px]:hidden">
                {aging.map((r) => (
                  <li key={r.customerId}>
                    <Link to={`/customers/${r.customerId}/statement`} className="block space-y-2 px-5 py-3.5 transition-colors hover:bg-[var(--item-hover)]">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-stone-900">{customerLabel(customers.find((x) => x.id === r.customerId))}</span>
                          <span className="block text-xs text-stone-500">
                            {r.count} invoice{r.count === 1 ? '' : 's'} · statement →
                          </span>
                        </span>
                        <span className="tabular shrink-0 text-sm font-bold text-stone-900">{formatMoney(r.total, cur)}</span>
                      </span>
                      <AgingBar buckets={r.buckets} />
                      <AgingLegend buckets={r.buckets} />
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto @min-[760px]:block">
                <table className={tableCls.table}>
                  <thead>
                    <tr>
                      <th className={tableCls.th}>Customer</th>
                      {AGING_BUCKETS.map((b) => (
                        <th key={b} className={`${tableCls.th} ${num}`}>
                          {b}
                        </th>
                      ))}
                      <th className={`${tableCls.th} ${num}`}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aging.map((r) => {
                      const c = customers.find((x) => x.id === r.customerId)
                      return (
                        <tr key={r.customerId} className={tableCls.tr} onClick={() => nav(`/customers/${r.customerId}/statement`)} title="Open statement">
                          <td className={tableCls.td}>
                            <div className="font-medium text-stone-900">{customerLabel(c)}</div>
                            <div className="text-xs text-stone-500">
                              {r.count} invoice{r.count === 1 ? '' : 's'}
                            </div>
                          </td>
                          {r.buckets.map((v, i) => (
                            <td key={i} className={`${tableCls.td} ${num} ${v === 0 ? 'text-stone-400' : i >= 3 ? 'font-medium text-red-700' : i >= 1 ? 'text-amber-700' : ''}`}>
                              {v === 0 ? '—' : formatMoney(v, '').trim()}
                            </td>
                          ))}
                          <td className={`${tableCls.td} ${num} font-semibold`}>{formatMoney(r.total, cur)}</td>
                        </tr>
                      )
                    })}
                    <tr className="bg-stone-50 font-semibold">
                      <td className={tableCls.td}>Total</td>
                      {agingTotals.map((v, i) => (
                        <td key={i} className={`${tableCls.td} ${num}`}>
                          {v === 0 ? '—' : formatMoney(v, '').trim()}
                        </td>
                      ))}
                      <td className={`${tableCls.td} ${num}`}>{formatMoney(agingGrand, cur)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <p className="border-t border-stone-200 px-5 py-3 text-xs text-stone-500">
            Days are counted from each invoice's due date. Tap a customer for their statement of account, or see{' '}
            <Link to={`/d/${DOC_META.invoice.path}`} className="text-gold-700 hover:underline">
              all invoices
            </Link>
            .
          </p>
        </Card>

        <Card>
          <CardHeader
            title="Profit & loss by month"
            subtitle="Money in = receipts and other income, less refunds. Money out = expenses."
            action={
              <div className="no-print flex items-center gap-2">
                <Select value={year} onChange={(e) => setYear(e.target.value)} className="w-auto" aria-label="Year">
                  {years.map((y) => (
                    <option key={y}>{y}</option>
                  ))}
                </Select>
                <Button size="sm" onClick={exportCsv} title="Export CSV">
                  <Download size={14} />
                </Button>
              </div>
            }
          />
          <div className="@container">
            <ul className="divide-y divide-stone-200 @min-[560px]:hidden">
              {visibleMonths.map((r) => {
                const empty = !r.sales && !r.moneyIn && !r.moneyOut
                return (
                  <li key={r.month} className="px-5 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-bold text-stone-900">{monthLabel(r.month)}</span>
                      <span className={`tabular text-sm font-bold ${r.net < 0 ? 'text-red-700' : r.net > 0 ? 'text-emerald-700' : 'text-stone-400'}`}>
                        {r.net ? `${r.net > 0 ? '+' : ''}${plain(r.net)}` : '—'}
                      </span>
                    </div>
                    {empty ? (
                      <div className="mt-0.5 text-xs text-stone-400">No activity</div>
                    ) : (
                      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-stone-500">
                        <span>
                          In <b className="tabular font-semibold text-stone-800">{plain(r.moneyIn)}</b>
                        </span>
                        <span>
                          Out <b className="tabular font-semibold text-stone-800">{plain(r.moneyOut)}</b>
                        </span>
                        <span>
                          Invoiced <b className="tabular font-semibold text-stone-800">{plain(r.sales)}</b>
                        </span>
                      </div>
                    )}
                  </li>
                )
              })}
              <li className="bg-stone-50 px-5 py-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-bold text-stone-900">Total {year}</span>
                  <span className={`tabular text-sm font-bold ${pnlTotal.net < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatMoney(pnlTotal.net, cur)}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-stone-500">
                  <span>
                    In <b className="tabular font-semibold text-stone-800">{plain(pnlTotal.moneyIn)}</b>
                  </span>
                  <span>
                    Out <b className="tabular font-semibold text-stone-800">{plain(pnlTotal.moneyOut)}</b>
                  </span>
                  <span>
                    Invoiced <b className="tabular font-semibold text-stone-800">{plain(pnlTotal.sales)}</b>
                  </span>
                </div>
              </li>
            </ul>
            <div className="hidden overflow-x-auto @min-[560px]:block">
              <table className={tableCls.table}>
                <thead>
                  <tr>
                    <th className={tableCls.th}>Month</th>
                    <th className={`${tableCls.th} ${num}`}>Sales invoiced</th>
                    <th className={`${tableCls.th} ${num}`}>Money in</th>
                    <th className={`${tableCls.th} ${num}`}>Money out</th>
                    <th className={`${tableCls.th} ${num}`}>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleMonths.map((r) => (
                    <tr key={r.month}>
                      <td className={`${tableCls.td} font-medium`}>{monthName(r.month)}</td>
                      <td className={`${tableCls.td} ${num} text-stone-600`}>{r.sales ? formatMoney(r.sales, '').trim() : '—'}</td>
                      <td className={`${tableCls.td} ${num}`}>{r.moneyIn ? formatMoney(r.moneyIn, '').trim() : '—'}</td>
                      <td className={`${tableCls.td} ${num}`}>{r.moneyOut ? formatMoney(r.moneyOut, '').trim() : '—'}</td>
                      <td className={`${tableCls.td} ${num} font-medium ${r.net < 0 ? 'text-red-700' : r.net > 0 ? 'text-emerald-700' : 'text-stone-400'}`}>
                        {r.net ? formatMoney(r.net, '').trim() : '—'}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-stone-50 font-semibold">
                    <td className={tableCls.td}>Total {year}</td>
                    <td className={`${tableCls.td} ${num}`}>{formatMoney(pnlTotal.sales, cur)}</td>
                    <td className={`${tableCls.td} ${num}`}>{formatMoney(pnlTotal.moneyIn, cur)}</td>
                    <td className={`${tableCls.td} ${num}`}>{formatMoney(pnlTotal.moneyOut, cur)}</td>
                    <td className={`${tableCls.td} ${num} ${pnlTotal.net < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatMoney(pnlTotal.net, cur)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title={`Expenses by category · ${year}`} subtitle={expenseTotal ? `${formatMoney(expenseTotal, cur)} in total` : undefined} />
          {expenses.length === 0 ? (
            <EmptyState title="No expenses recorded" text="Add expenses under Transactions to see where the money goes." />
          ) : (
            <ul className="divide-y divide-stone-200">
              {expenses.map((e) => (
                <li key={e.category} className="flex items-center gap-3 px-5 py-2.5 text-sm sm:gap-4">
                  <span className="w-24 shrink-0 truncate sm:w-32">{e.category}</span>
                  <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-stone-100" aria-hidden>
                    <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(e.amount / expenses[0].amount) * 100}%`, background: 'var(--chart-bar)' }} />
                  </span>
                  <span className="tabular shrink-0 text-right sm:w-28">{formatMoney(e.amount, cur)}</span>
                  <span className="tabular w-10 shrink-0 text-right text-xs text-stone-500">{Math.round((e.amount / expenseTotal) * 100)}%</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
