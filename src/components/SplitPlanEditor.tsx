import { CalendarClock, Lock } from 'lucide-react'
import { docTotals, formatDate, formatMoney } from '../lib/calc'
import { SPLIT_MAX, SPLIT_MIN, splitSchedule, type SplitEligibility } from '../lib/split'
import type { Customer, Document, SplitPlan } from '../lib/types'
import { Card, CardHeader, Field, Input, Select, Textarea } from './ui'

const DUE_NOTE = ['before work starts', '+1 month', '+2 months']

/**
 * "Split payment (3×)" on the invoice editor: the switch, the agreement details and the
 * schedule worked out from the total and the Payment 1 date.
 */
export default function SplitPlanEditor({
  plan,
  onChange,
  total,
  currency,
  eligibility,
  locked,
  customer,
  makePlan,
  quotations,
}: {
  plan?: SplitPlan
  onChange: (plan: SplitPlan | undefined) => void
  total: number
  currency: string
  eligibility: SplitEligibility
  /** A payment is recorded: the plan can no longer be switched off or rescheduled here. */
  locked: boolean
  customer?: Customer
  makePlan: () => SplitPlan
  /** The customer's quotations, newest first, to link the plan to. */
  quotations: Document[]
}) {
  const on = !!plan
  const canTurnOn = eligibility.ok
  const set = <K extends keyof SplitPlan>(k: K, v: SplitPlan[K]) => plan && onChange({ ...plan, [k]: v })
  const schedule = plan ? (locked ? plan.payments : splitSchedule(total, plan.payment1Date)) : []

  return (
    <Card>
      <CardHeader
        title="Split payment (3×)"
        subtitle={`0% interest. ${formatMoney(SPLIT_MIN, currency)}–${formatMoney(SPLIT_MAX, currency)} jobs, paid 40% / 30% / 30% over two months.`}
        action={
          <label className={`flex items-center gap-2 text-sm font-semibold ${(!on && !canTurnOn) || locked ? 'cursor-not-allowed text-stone-400' : 'cursor-pointer text-stone-800'}`}>
            <input
              type="checkbox"
              role="switch"
              className="h-4 w-4 accent-gold-600"
              checked={on}
              disabled={locked || (!on && !canTurnOn)}
              onChange={(e) => onChange(e.target.checked ? makePlan() : undefined)}
              aria-describedby="split-why"
            />
            {on ? 'On' : 'Off'}
          </label>
        }
      />
      {!on && !canTurnOn && (
        <p id="split-why" className="px-5 py-4 text-sm text-amber-700">
          {eligibility.reason}
        </p>
      )}
      {!on && canTurnOn && (
        <p id="split-why" className="px-5 py-4 text-sm text-stone-500">
          Let {customer ? customer.name || customer.company : 'the customer'} pay this invoice in three interest-free payments.
        </p>
      )}
      {plan && (
        <div className="space-y-4 p-5">
          {locked && (
            <p className="flex items-center gap-2 rounded-xl bg-stone-100 px-3 py-2 text-xs text-stone-600">
              <Lock size={14} /> A payment is recorded, so the schedule is fixed. Record payments on the invoice page.
            </p>
          )}
          {on && !eligibility.ok && !locked && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">{eligibility.reason}</p>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Agreement no.">
              <Input value={plan.agreementNo} readOnly className="font-medium" />
            </Field>
            <Field label="Quotation no." hint={quotations.length ? undefined : "This customer has no quotations yet."}>
              <Select value={plan.quotationNo} onChange={(e) => set('quotationNo', e.target.value)}>
                <option value="">— No quotation —</option>
                {/* Keep a number picked before, even if that quotation is gone or belongs to someone else. */}
                {plan.quotationNo && !quotations.some((q) => q.number === plan.quotationNo) && <option value={plan.quotationNo}>{plan.quotationNo}</option>}
                {quotations.map((q) => (
                  <option key={q.id} value={q.number}>
                    {q.number} · {formatDate(q.date)} · {formatMoney(docTotals(q).total, currency)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Customer full name (as per IC)">
              <Input value={plan.customerName} onChange={(e) => set('customerName', e.target.value)} />
            </Field>
            <Field label="IC no.">
              <Input value={plan.icNo} onChange={(e) => set('icNo', e.target.value)} placeholder="e.g. 900101-10-1234" inputMode="numeric" />
            </Field>
            <Field label="Phone">
              <Input value={plan.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" />
            </Field>
            <Field label="Email">
              <Input value={plan.email} onChange={(e) => set('email', e.target.value)} inputMode="email" />
            </Field>
            <Field label="Premises address (site)" className="sm:col-span-2">
              <Textarea value={plan.premisesAddress} onChange={(e) => set('premisesAddress', e.target.value)} rows={2} />
            </Field>
            <Field label="Description of work" className="sm:col-span-2">
              <Textarea value={plan.workDescription} onChange={(e) => set('workDescription', e.target.value)} rows={2} />
            </Field>
            <Field label="Planned work date">
              <Input type="date" value={plan.plannedWorkDate} onChange={(e) => set('plannedWorkDate', e.target.value)} />
            </Field>
            <Field label="Payment 1 date" hint="Payments 2 and 3 fall due 1 and 2 months later.">
              <Input type="date" value={plan.payment1Date} disabled={locked} onChange={(e) => e.target.value && set('payment1Date', e.target.value)} />
            </Field>
          </div>

          <div className="overflow-hidden rounded-2xl border border-stone-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 text-left text-[11px] font-bold uppercase tracking-wider text-stone-500">
                  <th className="px-3 py-2">Payment</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Due</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((p, i) => (
                  <tr key={p.seq} className="border-t border-stone-100">
                    <td className="px-3 py-2.5">
                      <span className="font-semibold">Payment {p.seq}</span>
                      <span className="text-stone-500"> · {p.pct}%{i === 0 ? ' deposit' : ''}</span>
                    </td>
                    <td className="tabular px-3 py-2.5 text-right font-medium">{formatMoney(p.amount, currency)}</td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock size={14} className="text-stone-400" />
                        {formatDate(p.dueDate)}
                      </span>
                      <span className="block text-xs text-stone-500">{DUE_NOTE[i]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-stone-500">
            Payments 1 and 2 are rounded to the nearest {currency}1; Payment 3 is the balance. No interest, late fee or admin charge.
          </p>
        </div>
      )}
    </Card>
  )
}
