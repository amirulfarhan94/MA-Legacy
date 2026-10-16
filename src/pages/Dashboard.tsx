import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Moon, Plus, Sparkles, Sun, Sunrise } from 'lucide-react'
import { displayStatus, docTotals, invoiceBalance, nextDocNumber, toISODate } from '../lib/calc'
import { daypartOf, useNow } from '../lib/daypart'
import { cashMovements, isOpenInvoice, monthlyTotals, monthToDate, weeklyTotals } from '../lib/finance'
import { useStore } from '../lib/store'
import { DOC_META, type DocType } from '../lib/types'
import AreaChart, { type ChartPoint } from '../components/AreaChart'
import { DOC_ICON } from '../components/nav'
import { Button, Card } from '../components/ui'

const QUICK: DocType[] = ['quotation', 'invoice', 'receipt', 'service_report']
const PART_ICON = { morning: Sunrise, afternoon: Sun, evening: Moon }

type Range = '12m' | 'ytd' | '90d'
const RANGES: { id: Range; label: string }[] = [
  { id: '12m', label: '12 months' },
  { id: 'ytd', label: 'This year' },
  { id: '90d', label: '90 days' },
]

// Fixed three-letter names: some browsers write "Sept" for en-GB.
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthName = (key: string, withYear = false) => {
  const [y, m] = key.split('-').map(Number)
  return withYear ? `${MON[m - 1]} ${y}` : MON[m - 1]
}
const dayMonth = (iso: string) => {
  const [, m, d] = iso.split('-').map(Number)
  return `${d} ${MON[m - 1]}`
}
const money = (n: number) => n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const whole = (n: number) => n.toLocaleString('en-MY', { maximumFractionDigits: 0 })

export default function Dashboard() {
  const documents = useStore((s) => s.documents)
  const customers = useStore((s) => s.customers)
  const transactions = useStore((s) => s.transactions)
  const settings = useStore((s) => s.settings)
  const cur = settings.currency
  const nav = useNavigate()
  const now = useNow(30_000)
  const asOf = toISODate(now)
  const [range, setRange] = useState<Range>('12m')

  const data = useMemo(() => {
    const thisYear = asOf.slice(0, 4)
    const moves = cashMovements(documents, transactions)
    // Money in is receipts + other income, net of refunds paid back to customers.
    const cashIn = moves.filter((m) => m.amount > 0 || m.category === 'Refund')
    const expenses = moves.filter((m) => m.amount < 0 && m.category !== 'Refund')
    const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0)

    const open = documents
      .filter(isOpenInvoice)
      .map((d) => ({ balance: invoiceBalance(d, documents), status: displayStatus(d, documents) }))
      .filter((x) => x.balance > 0.005)
    const openQuotes = documents.filter((d) => d.type === 'quotation' && (d.status === 'sent' || d.status === 'draft'))

    return {
      thisYear,
      mtd: monthToDate(cashIn, asOf),
      collectedYear: sum(cashIn.filter((x) => x.date.startsWith(thisYear))),
      expenseYear: -sum(expenses.filter((x) => x.date.startsWith(thisYear))),
      unpaid: open.length,
      outstanding: open.reduce((s, x) => s + x.balance, 0),
      overdue: open.filter((x) => x.status === 'overdue').length,
      openQuotes: openQuotes.length,
      quoteValue: openQuotes.reduce((s, d) => s + docTotals(d).total, 0),
      months: monthlyTotals(cashIn, 12, asOf),
      weeks: weeklyTotals(cashIn, 13, asOf),
    }
  }, [documents, transactions, asOf])

  const points = useMemo<ChartPoint[]>(() => {
    if (range === '90d') return data.weeks.map((w) => ({ label: dayMonth(w.start), full: `${dayMonth(w.start)} – ${dayMonth(w.end)}`, value: w.value }))
    const thisMonth = asOf.slice(0, 7)
    return data.months
      .filter((m) => range === '12m' || m.key.startsWith(data.thisYear))
      .map((m) => ({ label: monthName(m.key), full: `${monthName(m.key, true)}${m.key === thisMonth ? ' · to date' : ''}`, value: m.value }))
  }, [range, data, asOf])

  const part = daypartOf(now)
  const PartIcon = PART_ICON[part]
  const name = settings.greetingName.trim()
  const isEmpty = documents.length === 0 && customers.length === 0

  const { current, previous, previousMonth, upToDay } = data.mtd
  const change = previous > 0 ? ((current - previous) / previous) * 100 : null
  const prevName = monthName(previousMonth)

  return (
    <div className="@container">
      <section>
        <div className="flex items-center gap-2 text-[13px] font-semibold text-stone-500">
          <PartIcon size={16} className="shrink-0 text-gold-700" />
          {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} ·{' '}
          {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </div>
        <h1 className="mt-2 text-balance font-display text-[28px] font-normal leading-[1.12] tracking-[-0.02em] text-stone-900 sm:text-[34px]">
          Good {part}
          {name && (
            <>
              , <span className="greet-name font-medium">{name}</span>
            </>
          )}
        </h1>
      </section>

      {isEmpty && (
        <Card className="mt-5 border-gold-400/40 bg-[linear-gradient(140deg,rgb(212_161_71/0.16),transparent_60%)]">
          <div className="flex flex-col items-start gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
            <Sparkles className="shrink-0 text-gold-700" size={20} />
            <div className="flex-1 text-sm">
              <div className="font-semibold">Welcome! Start by filling in your company details.</div>
              <div className="text-stone-600">Then add a customer and issue your first quotation. You can also load sample data to explore.</div>
            </div>
            <Button variant="primary" onClick={() => nav('/settings')}>
              Company settings
            </Button>
          </div>
        </Card>
      )}

      <SectionLabel>Quick create</SectionLabel>
      <div className="grid grid-cols-2 gap-2.5 @min-[600px]:grid-cols-4 @min-[600px]:gap-3">
        {QUICK.map((t) => {
          const Icon = DOC_ICON[t]
          return (
            <button
              key={t}
              type="button"
              onClick={() => nav(`/d/${DOC_META[t].path}/new`)}
              className="glass group relative flex min-h-[116px] min-w-0 flex-col items-start gap-3 rounded-[22px] p-3.5 text-left transition duration-300 hover:-translate-y-0.5 hover:border-gold-400/60 hover:shadow-[var(--glass-shadow),0_16px_40px_rgb(212_161_71/0.2)]"
            >
              <span className="grid size-[42px] place-items-center rounded-[14px] bg-gold-400/15 text-gold-700">
                <Icon size={20} />
              </span>
              <span className="absolute right-3.5 top-3.5 grid size-7 place-items-center rounded-full border border-[var(--btn-line)] bg-[var(--btn)] text-stone-500 transition-colors group-hover:border-transparent group-hover:bg-gold-400 group-hover:text-[var(--on-gold)]">
                <Plus size={14} strokeWidth={2.2} />
              </span>
              <span className="min-w-0 max-w-full">
                <span className="block text-[14.5px] font-bold text-stone-900">{DOC_META[t].label}</span>
                <span className="tabular mt-1 block truncate text-[11.5px] font-semibold text-stone-500">
                  Next {nextDocNumber(t, settings.prefixes[t], asOf, documents)}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <SectionLabel>Key figures</SectionLabel>
      <div className="grid grid-cols-2 gap-2.5 @min-[760px]:grid-cols-4 @min-[760px]:gap-3.5">
        <Stat
          hero
          label="Collected this month"
          currency={cur}
          value={current}
          foot={
            change === null ? (
              <span>Month to date</span>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--btn-line)] bg-[var(--btn)] px-2.5 py-1.5 font-bold text-stone-900"
                title={`Compared with 1–${upToDay} ${prevName}`}
              >
                <span className={change >= 0 ? 'text-[var(--good)]' : 'text-[var(--critical)]'}>{change >= 0 ? '▲' : '▼'}</span>
                <span>
                  {Math.abs(change).toFixed(1)}% vs <span className="@max-[150px]:hidden">1–{upToDay} </span>
                  {prevName}
                </span>
              </span>
            )
          }
        />
        <Stat
          label="Outstanding invoices"
          currency={cur}
          value={data.outstanding}
          foot={
            <>
              <span>{data.unpaid} unpaid</span>
              {data.overdue > 0 && (
                <span className="inline-flex items-center gap-1.5 text-stone-900">
                  <i className="size-2 rounded-full bg-[var(--critical)] shadow-[0_0_10px_rgb(208_59_59/0.6)]" />
                  {data.overdue} overdue
                </span>
              )}
            </>
          }
        />
        <Stat label="Open quotations" currency={cur} value={data.quoteValue} foot={<span>{data.openQuotes} awaiting reply</span>} />
        <Stat
          label={`Net profit ${data.thisYear}`}
          currency={cur}
          value={data.collectedYear - data.expenseYear}
          foot={<InOut moneyIn={data.collectedYear} moneyOut={data.expenseYear} />}
        />
      </div>

      <Card className="mt-3.5 p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-[17px] font-medium tracking-[-0.01em] text-stone-900">Money collected</h2>
            <p className="mt-1 text-[13px] text-stone-500">
              Receipts and other income · {range === '90d' ? 'per week, last 13 weeks' : `${monthName(asOf.slice(0, 7), false)} is month to date`}
            </p>
          </div>
          <div role="group" aria-label="Range" className="inline-flex gap-1 rounded-full border border-[var(--btn-line)] bg-[var(--btn)] p-1">
            {RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={range === r.id}
                onClick={() => setRange(r.id)}
                className={`h-[30px] rounded-full px-3 text-xs font-bold transition-colors ${
                  range === r.id ? 'bg-stone-900 text-[var(--color-canvas)]' : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <AreaChart points={points} currency={cur} label={`Money collected, ${RANGES.find((r) => r.id === range)!.label.toLowerCase()}`} />
      </Card>
    </div>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="mb-2.5 mt-7 px-1 text-[11.5px] font-bold uppercase tracking-[0.12em] text-stone-500">{children}</h2>
}

function Stat({ label, value, currency, foot, hero }: { label: string; value: number; currency: string; foot: ReactNode; hero?: boolean }) {
  return (
    <div
      className={`glass @container flex min-w-0 flex-col rounded-[22px] p-4 ${
        hero ? 'border-gold-400/40 bg-[linear-gradient(140deg,rgb(212_161_71/0.2),transparent_58%)]' : ''
      }`}
    >
      <div className="text-[12.5px] font-semibold text-stone-600">{label}</div>
      <div className="tabular mt-2.5 whitespace-nowrap font-display text-[length:clamp(18px,13.5cqi,34px)] font-normal leading-[1.05] tracking-[-0.025em] text-stone-900">
        <span className="mr-[0.35em] text-[0.5em] font-medium text-stone-500">{currency}</span>
        {money(value)}
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-3 text-xs font-semibold text-stone-500">{foot}</div>
    </div>
  )
}

function InOut({ moneyIn, moneyOut }: { moneyIn: number; moneyOut: number }) {
  const max = Math.max(moneyIn, moneyOut, 1)
  const rows: [string, number, string][] = [
    ['In', moneyIn, 'var(--color-accent)'],
    ['Out', moneyOut, 'var(--color-stone-400)'],
  ]
  return (
    <div className="grid w-full gap-1.5">
      {rows.map(([k, v, c]) => (
        <div key={k} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2">
          <span>{k}</span>
          <span className="h-2 overflow-hidden rounded-full bg-stone-100">
            <i className="block h-full rounded-full" style={{ width: `${(Math.max(0, v) / max) * 100}%`, background: c }} />
          </span>
          <b className="tabular font-bold text-stone-900">{whole(v)}</b>
        </div>
      ))}
    </div>
  )
}
