import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, MessageCircle, Printer } from 'lucide-react'
import { addDays, formatDate, formatMoney, today } from '../lib/calc'
import { AGING_BUCKETS, customerStatement } from '../lib/finance'
import { waNumber } from '../lib/contact'
import { customerLabel, useCustomer, useStore } from '../lib/store'
import { ComputerGeneratedNote, PartyBlock, PaymentBlock, SheetHeader } from '../components/DocumentSheet'
import { EngAmountBox, EngFooter, EngHeader, EngParty, EngPayment, EngSheet, EngTerms, KICKER } from '../components/EngineeringSheet'
import SheetPreview from '../components/SheetPreview'
import SharePdfButton from '../components/SharePdfButton'
import { Button, buttonClass, Card, ChipGroup, EmptyState, Field, Input } from '../components/ui'

const firstOfMonth = (iso: string, monthsBack = 0) => {
  const [y, m] = iso.split('-').map(Number)
  const d = new Date(y, m - 1 - monthsBack, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}


export default function Statement() {
  const { id } = useParams()
  const customer = useCustomer(id)
  const documents = useStore((s) => s.documents)
  const settings = useStore((s) => s.settings)
  const cur = settings.currency
  const sheetBox = useRef<HTMLDivElement>(null)

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
  const message =
    `Hi ${customer.name || customerLabel(customer)}, here is your statement of account as at ${formatDate(to)}. ` +
    `Balance due: ${formatMoney(st.closing, cur)}. — ${settings.companyName}`
  const waText = encodeURIComponent(message)

  return (
    <>
      <div className="no-print">
        <Link to={`/customers/${customer.id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
          <ArrowLeft size={15} /> {customerLabel(customer)}
        </Link>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-[23px] font-normal leading-tight tracking-[-0.02em] text-stone-900 sm:text-[26px]">Statement of account</h1>
            <p className="mt-1 text-sm text-stone-500">
              {periodLabel} · balance due <b className="tabular font-semibold text-stone-900">{formatMoney(st.closing, cur)}</b>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => window.print()}>
              <Printer size={15} /> Print / PDF
            </Button>
            <SharePdfButton
              sheetBox={sheetBox}
              text={message}
              options={{
                fileName: `Statement - ${customerLabel(customer).replace(/[\\/:*?"<>|]/g, '')} - ${to}.pdf`,
                docNo: `SOA ${formatDate(to)}`,
                heading: 'STATEMENT OF ACCOUNT',
                company: settings.companyName,
                engineering: settings.documentStyle === 'engineering',
              }}
            />
            {customer.phone && (
              <a
                href={`https://wa.me/${waNumber(customer.phone)}?text=${waText}`}
                target="_blank"
                rel="noreferrer"
                className={buttonClass()}
              >
                <MessageCircle size={15} className="text-[var(--good)]" /> WhatsApp
              </a>
            )}
          </div>
        </div>
        <Card className="mb-5">
          <div className="space-y-3 p-4">
            <ChipGroup
              label="Period"
              value={presets.find(([, f, tt]) => from === f && to === tt)?.[0] ?? ''}
              onChange={(label) => {
                const p = presets.find(([l]) => l === label)
                if (!p) return
                setFrom(p[1])
                setTo(p[2])
              }}
              options={presets.map(([label]) => ({ value: label, label }))}
            />
            <div className="grid grid-cols-2 gap-3 sm:flex">
              <Field label="From">
                <Input type="date" value={from <= '1900-01-01' ? '' : from} onChange={(e) => setFrom(e.target.value || '1900-01-01')} className="min-w-0 sm:w-auto" />
              </Field>
              <Field label="To">
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value || t)} className="min-w-0 sm:w-auto" />
              </Field>
            </div>
          </div>
        </Card>
      </div>

      <div ref={sheetBox}>
        <SheetPreview>
          {settings.documentStyle === 'engineering' ? (
            <EngineeringStatement
              st={st}
              customer={customer}
              from={from}
              to={to}
              currency={cur}
            />
          ) : (
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
          )}
        </SheetPreview>
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

const STATEMENT_NOTE =
  'Please check this statement and let us know of any difference within 14 days. If payment has been made recently, kindly ignore any amount already settled.'

/** Statement of account in the Engineering document style. */
function EngineeringStatement({
  st,
  customer,
  from,
  to,
  currency,
}: {
  st: ReturnType<typeof customerStatement>
  customer: NonNullable<ReturnType<typeof useCustomer>>
  from: string
  to: string
  currency: string
}) {
  const allTime = from <= '1900-01-01'
  const docNo = `SOA ${formatDate(to)}`
  const agingTotal = st.aging.reduce((s, v) => s + v, 0)
  return (
    <EngSheet docNo={docNo} title="STATEMENT OF ACCOUNT">
      <EngHeader
        title="STATEMENT OF ACCOUNT"
        kicker={KICKER.statement}
        cells={[
          ['Statement date', formatDate(to)],
          ['Period from', allTime ? 'Beginning' : formatDate(from)],
          ['Period to', formatDate(to)],
          ['Entries', String(st.lines.length)],
        ]}
      />
      <div className="eng-parties">
        <EngParty label="Customer" party={customer} />
        <EngAmountBox label="Balance due" amount={st.closing} currency={currency} sub={`As at ${formatDate(to)}`} />
      </div>

      <table className="eng-items">
        <thead>
          <tr>
            <th>Date</th>
            <th>Ref. no.</th>
            <th>Description</th>
            <th className="r">Debit</th>
            <th className="r">Credit</th>
            <th className="r">Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="eng-mono whitespace-nowrap">{allTime ? '' : formatDate(addDays(from, -1))}</td>
            <td />
            <td className="font-semibold">Balance brought forward</td>
            <td />
            <td />
            <td className="r">{money(st.opening)}</td>
          </tr>
          {st.lines.map((l, i) => (
            <tr key={i}>
              <td className="eng-mono whitespace-nowrap">{formatDate(l.date)}</td>
              <td className="eng-mono whitespace-nowrap">{l.number}</td>
              <td>{l.description}</td>
              <td className="r">{l.debit ? money(l.debit) : ''}</td>
              <td className="r">{l.credit ? money(l.credit) : ''}</td>
              <td className="r">{money(l.balance)}</td>
            </tr>
          ))}
          {st.lines.length === 0 && (
            <tr className="empty">
              <td colSpan={6}>No transactions in this period.</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="eng-sum">
        <div className="eng-left">
          <div className="eng-box">
            <span className="eng-lab">Unpaid invoices by age</span>
            <table className="mt-2 w-full border-collapse text-[9.6px]">
              <thead>
                <tr>
                  {AGING_BUCKETS.map((b) => (
                    <th key={b} className="eng-lab table-cell! pb-1.5 text-right font-medium">
                      {b}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {st.aging.map((v, i) => (
                    <td key={i} className={`eng-mono text-right ${i >= 3 && v > 0 ? 'font-semibold text-[#b42318]' : ''}`}>
                      {money(v)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            {st.unapplied > 0 && <p>Includes {formatMoney(st.unapplied, currency)} of payments or credits not yet matched to a specific invoice.</p>}
          </div>
          <EngPayment />
        </div>
        <div className="eng-totals">
          <div className="row">
            <span>Opening balance</span>
            <span>{money(st.opening)}</span>
          </div>
          <div className="row">
            <span>Invoiced</span>
            <span>{money(st.totalDebit)}</span>
          </div>
          <div className="row">
            <span>Payments &amp; credits</span>
            <span>− {money(st.totalCredit)}</span>
          </div>
          <div className="row total">
            <span>BALANCE ({currency})</span>
            <span>{money(st.closing)}</span>
          </div>
          <div className="row bal">
            <span>Unpaid by age</span>
            <span>{formatMoney(agingTotal, currency)}</span>
          </div>
        </div>
      </div>

      <div className="eng-grow" />
      <EngTerms label="Note" text={STATEMENT_NOTE} />
      <EngFooter docNo={docNo} />
    </EngSheet>
  )
}
