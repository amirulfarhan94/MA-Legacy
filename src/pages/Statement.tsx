import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, MessageCircle, Printer } from 'lucide-react'
import { addDays, formatDate, formatMoney, today } from '../lib/calc'
import { AGING_BUCKETS, customerStatement } from '../lib/finance'
import { customerLabel, useCustomer, useStore } from '../lib/store'
import { ComputerGeneratedNote, PartyBlock, PaymentBlock, SheetHeader } from '../components/DocumentSheet'
import { Button, Card, EmptyState, Field, Input } from '../components/ui'

const firstOfMonth = (iso: string, monthsBack = 0) => {
  const [y, m] = iso.split('-').map(Number)
  const d = new Date(y, m - 1 - monthsBack, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

/** Malaysian numbers: 012-345 6789 → 60123456789 for wa.me links. */
const waNumber = (phone: string) => {
  const digits = phone.replace(/\D/g, '')
  return digits.startsWith('0') ? `6${digits}` : digits
}

export default function Statement() {
  const { id } = useParams()
  const customer = useCustomer(id)
  const documents = useStore((s) => s.documents)
  const settings = useStore((s) => s.settings)
  const cur = settings.currency

  const t = today()
  const [from, setFrom] = useState(firstOfMonth(t, 2))
  const [to, setTo] = useState(t)
  const presets: [string, string, string][] = [
    ['This month', firstOfMonth(t), t],
    ['Last 3 months', firstOfMonth(t, 2), t],
    ['This year', `${t.slice(0, 4)}-01-01`, t],
    ['All time', '1900-01-01', t],
  ]

  const st = useMemo(() => customerStatement(id ?? '', documents, from, to), [id, documents, from, to])

  // The browser uses the page title as the default PDF file name.
  useEffect(() => {
    const prev = document.title
    document.title = `Statement - ${customerLabel(customer)} - ${to}`
    return () => {
      document.title = prev
    }
  }, [customer, to])

  if (!customer) {
    return (
      <Card>
        <EmptyState title="Customer not found" action={<Link to="/customers" className="text-sm text-gold-700 underline">Back to customers</Link>} />
      </Card>
    )
  }

  const agingTotal = st.aging.reduce((s, v) => s + v, 0)
  const periodLabel = from <= '1900-01-01' ? `Up to ${formatDate(to)}` : `${formatDate(from)} – ${formatDate(to)}`
  const waText = encodeURIComponent(
    `Hi ${customer.name || customerLabel(customer)}, here is your statement of account as at ${formatDate(to)}. ` +
      `Balance due: ${formatMoney(st.closing, cur)}. — ${settings.companyName}`,
  )

  return (
    <>
      <div className="no-print">
        <Link to={`/customers/${customer.id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
          <ArrowLeft size={15} /> {customerLabel(customer)}
        </Link>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Statement of account</h1>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => window.print()}>
              <Printer size={15} /> Print / PDF
            </Button>
            {customer.phone && (
              <a
                href={`https://wa.me/${waNumber(customer.phone)}?text=${waText}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-stone-300 bg-surface px-3.5 text-sm font-medium text-stone-800 hover:bg-stone-50"
              >
                <MessageCircle size={15} /> WhatsApp
              </a>
            )}
          </div>
        </div>
        <Card className="mb-5">
          <div className="flex flex-wrap items-end gap-3 p-4">
            <Field label="From">
              <Input type="date" value={from <= '1900-01-01' ? '' : from} onChange={(e) => setFrom(e.target.value || '1900-01-01')} className="w-auto" />
            </Field>
            <Field label="To">
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value || t)} className="w-auto" />
            </Field>
            <div className="flex flex-wrap gap-1.5">
              {presets.map(([label, f, tt]) => (
                <Button
                  key={label}
                  size="sm"
                  variant={from === f && to === tt ? 'primary' : 'secondary'}
                  onClick={() => {
                    setFrom(f)
                    setTo(tt)
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="overflow-x-auto pb-4 print:overflow-visible print:pb-0">
        <div className="sheet mx-auto flex flex-col shadow-lg">
          <SheetHeader
            title="STATEMENT OF ACCOUNT"
            rows={[
              ['Date', formatDate(to), true],
              ['Period', periodLabel],
            ]}
          />

          <div className="mt-5 grid grid-cols-2 gap-6">
            <PartyBlock label="Customer" party={customer} />
            <div className="ml-auto w-60 rounded-md border border-stone-200 text-[11.5px]">
              <SummaryRow label="Opening balance" value={formatMoney(st.opening, cur)} />
              <SummaryRow label="Invoiced" value={formatMoney(st.totalDebit, cur)} />
              <SummaryRow label="Payments & credits" value={`- ${formatMoney(st.totalCredit, cur)}`} />
              <div className="flex justify-between rounded-b-md bg-ink-900 px-3 py-2 text-[13px] font-bold text-gold-200">
                <span>Balance due</span>
                <span className="tabular">{formatMoney(st.closing, cur)}</span>
              </div>
            </div>
          </div>

          <table className="mt-6 w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-ink-900 text-left text-[10px] uppercase tracking-wide text-gold-200">
                <th className="w-[72px] px-2 py-2 font-semibold">Date</th>
                <th className="w-28 px-2 py-2 font-semibold">Ref. no.</th>
                <th className="px-2 py-2 font-semibold">Description</th>
                <th className="w-24 px-2 py-2 text-right font-semibold">Debit</th>
                <th className="w-24 px-2 py-2 text-right font-semibold">Credit</th>
                <th className="w-24 px-2 py-2 text-right font-semibold">Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-stone-200 bg-stone-50">
                <td className="px-2 py-1.5">{from <= '1900-01-01' ? '' : formatDate(addDays(from, -1))}</td>
                <td className="px-2 py-1.5" />
                <td className="px-2 py-1.5 font-medium">Balance brought forward</td>
                <td className="px-2 py-1.5" />
                <td className="px-2 py-1.5" />
                <td className="tabular px-2 py-1.5 text-right font-medium">{money(st.opening)}</td>
              </tr>
              {st.lines.map((l, i) => (
                <tr key={i} className="border-b border-stone-200">
                  <td className="whitespace-nowrap px-2 py-1.5">{formatDate(l.date)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">{l.number}</td>
                  <td className="px-2 py-1.5">{l.description}</td>
                  <td className="tabular px-2 py-1.5 text-right">{l.debit ? money(l.debit) : ''}</td>
                  <td className="tabular px-2 py-1.5 text-right">{l.credit ? money(l.credit) : ''}</td>
                  <td className="tabular px-2 py-1.5 text-right">{money(l.balance)}</td>
                </tr>
              ))}
              {st.lines.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2 py-4 text-center text-stone-500">
                    No transactions in this period.
                  </td>
                </tr>
              )}
              <tr className="border-t-2 border-gold-600 font-bold">
                <td colSpan={3} className="px-2 py-2">
                  Closing balance
                </td>
                <td className="tabular px-2 py-2 text-right">{money(st.totalDebit)}</td>
                <td className="tabular px-2 py-2 text-right">{money(st.totalCredit)}</td>
                <td className="tabular px-2 py-2 text-right">{money(st.closing)}</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-5">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gold-700">Unpaid invoices by age</div>
            <table className="w-full border-collapse text-center text-[11px]">
              <thead>
                <tr className="border-b border-stone-300 text-[10px] uppercase tracking-wide text-stone-500">
                  {AGING_BUCKETS.map((b) => (
                    <th key={b} className="px-2 py-1.5 font-semibold">
                      {b}
                    </th>
                  ))}
                  <th className="px-2 py-1.5 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  {st.aging.map((v, i) => (
                    <td key={i} className={`tabular px-2 py-1.5 ${i >= 3 && v > 0 ? 'font-semibold text-red-700' : ''}`}>
                      {money(v)}
                    </td>
                  ))}
                  <td className="tabular px-2 py-1.5 font-semibold">{money(agingTotal)}</td>
                </tr>
              </tbody>
            </table>
            {st.unapplied > 0 && (
              <p className="mt-1.5 text-[10.5px] text-stone-500">
                Includes {formatMoney(st.unapplied, cur)} of payments or credits not yet matched to a specific invoice.
              </p>
            )}
          </div>

          <div className="flex-1" />

          <div className="mt-8 grid grid-cols-2 gap-8 text-[11px]">
            <PaymentBlock />
            <div className="text-stone-600">
              Please check this statement and let us know of any difference within 14 days. If payment has been made recently,
              kindly ignore any amount already settled.
            </div>
          </div>
          <ComputerGeneratedNote />
        </div>
      </div>
    </>
  )
}

const money = (n: number) => formatMoney(n, '').trim()

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-stone-200 px-3 py-1.5">
      <span className="text-stone-600">{label}</span>
      <span className="tabular">{value}</span>
    </div>
  )
}
