import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, FileSignature, ReceiptText } from 'lucide-react'
import { formatDate, formatMoney, today } from '../lib/calc'
import { addMonthsClamped, rescheduleFromPayment1, splitPaymentStates, splitPlanStatus, type SplitPaymentState } from '../lib/split'
import { useStore } from '../lib/store'
import { DOC_META, PAYMENT_METHODS, type Document, type PaymentMethod } from '../lib/types'
import { Button, Card, CardHeader, Field, Input, Modal, Select, StatusBadge } from './ui'

/** The split plan on an invoice page: the three payments, their status, and recording them. */
export default function SplitPaymentsCard({
  invoice,
  recording,
  onRecord,
}: {
  invoice: Document
  /** Payments being recorded (open dialog), or null. */
  recording: number[] | null
  onRecord: (seqs: number[] | null) => void
}) {
  const documents = useStore((s) => s.documents)
  const currency = useStore((s) => s.settings.currency)
  const saveDocument = useStore((s) => s.saveDocument)
  const plan = invoice.split!
  const t = today()
  const states = splitPaymentStates(invoice, documents, t)
  const status = splitPlanStatus(invoice, documents, t)
  const unpaid = states.filter((s) => s.status !== 'Paid')
  const open = status === 'Active' || status === 'Overdue'

  const cancelPlan = () => {
    if (!confirm(`Cancel split plan ${plan.agreementNo}? Payments already recorded stay on their receipts. To refund Payment 1, issue a credit note with the refund amount.`)) return
    saveDocument({ ...invoice, split: { ...plan, cancelled: true } })
  }

  return (
    <Card>
      <CardHeader
        title="Split payment (3×)"
        subtitle={plan.agreementNo}
        action={<StatusBadge status={status.toLowerCase()} />}
      />
      <ul className="divide-y divide-stone-200 text-sm">
        {states.map((p) => (
          <li key={p.seq} className="flex items-start justify-between gap-3 px-5 py-3">
            <div className="min-w-0">
              <div className="font-semibold">
                Payment {p.seq} <span className="font-normal text-stone-500">· {p.pct}%{p.seq === 1 ? ' deposit' : ''}</span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">
                <span className="inline-flex items-center gap-1">
                  <CalendarClock size={12} /> {formatDate(p.dueDate)}
                </span>
                {p.status === 'Overdue' && <span className="font-semibold text-red-700">{p.daysLate} days late</span>}
                {p.receipt && (
                  <Link to={`/d/${DOC_META.receipt.path}/${p.receipt.id}`} className="inline-flex items-center gap-1 text-gold-700 hover:underline">
                    <ReceiptText size={12} /> {p.receipt.number} · {formatDate(p.receipt.date)}
                  </Link>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className="tabular font-semibold">{formatMoney(p.amount, currency)}</span>
              {p.status === 'Paid' ? (
                <StatusBadge status="paid" />
              ) : open && p.seq === unpaid[0]?.seq ? (
                <Button size="sm" variant="primary" onClick={() => onRecord([p.seq])}>
                  Record
                </Button>
              ) : (
                <StatusBadge status={p.status.toLowerCase()} />
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2 border-t border-stone-200 px-5 py-3">
        <Link to={`/d/${DOC_META.invoice.path}/${invoice.id}/agreement`} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--btn-line)] bg-[var(--btn)] px-3 text-xs font-bold text-stone-800">
          <FileSignature size={14} /> Agreement
        </Link>
        {open && unpaid.length > 1 && (
          <Button size="sm" onClick={() => onRecord(unpaid.map((p) => p.seq))}>
            Settle remaining balance
          </Button>
        )}
        {open && (
          <Button size="sm" variant="ghost" className="ml-auto" onClick={cancelPlan}>
            Cancel plan
          </Button>
        )}
      </div>
      {status === 'Completed' && <p className="px-5 pb-4 text-xs text-stone-500">All payments received — the workmanship warranty now applies.</p>}

      <RecordSplitPayment invoice={invoice} payments={recording ? states.filter((s) => recording.includes(s.seq)) : null} onClose={() => onRecord(null)} />
    </Card>
  )
}

/** Records one payment (or the rest of the plan at once) as a receipt for the invoice. */
function RecordSplitPayment({ invoice, payments, onClose }: { invoice: Document; payments: SplitPaymentState[] | null; onClose: () => void }) {
  const currency = useStore((s) => s.settings.currency)
  const store = useStore()
  const [form, setForm] = useState({ date: today(), method: 'bank_transfer' as PaymentMethod, reference: '', reschedule: true })
  const [shownFor, setShownFor] = useState<string | null>(null)
  const key = payments?.map((p) => p.seq).join(',') ?? null
  if (key !== shownFor) {
    setShownFor(key)
    setForm({ date: today(), method: 'bank_transfer', reference: '', reschedule: true })
  }
  if (!payments?.length) return null

  const plan = invoice.split!
  const amount = Math.round(payments.reduce((t, p) => t + p.amount, 0) * 100) / 100
  const seqs = payments.map((p) => p.seq)
  const first = seqs.includes(1)
  // Payment 1 paid on another day than planned: offer to move Payments 2 and 3 with it.
  const moved = first && !!form.date && form.date !== plan.payment1Date
  const settle = seqs.length > 1
  const title = settle ? 'Settle remaining balance' : `Record Payment ${seqs[0]}`

  const save = () => {
    let inv = invoice
    if (moved && form.reschedule) {
      const split = rescheduleFromPayment1(plan, form.date)
      inv = store.saveDocument({ ...invoice, split, dueDate: split.payments[2].dueDate })
    }
    const base = store.receiptForInvoice(inv.id)
    store.saveDocument({
      ...base,
      date: form.date,
      amountPaid: amount,
      paymentMethod: form.method,
      paymentRef: form.reference.trim(),
      splitSeqs: seqs,
      notes: `${settle ? `Payments ${seqs.join(' & ')}` : `Payment ${seqs[0]}`} of 3 for ${inv.number} (split payment ${plan.agreementNo})`,
    })
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!form.date}>
            Record {formatMoney(amount, currency)}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-stone-600">
        {settle
          ? `Early settlement of ${seqs.map((s) => `Payment ${s}`).join(' and ')} — no charge. One receipt covers them all.`
          : `Payment ${seqs[0]} of 3 for ${invoice.number}, due ${formatDate(payments[0].dueDate)}.`}{' '}
        A receipt is created and the invoice balance goes down.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Paid on">
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </Field>
        <Field label="Method">
          <Select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as PaymentMethod })}>
            {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reference" className="sm:col-span-2" hint="Bank transfer reference, cheque no., etc.">
          <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
        </Field>
      </div>
      {moved && !settle && (
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-gold-600" checked={form.reschedule} onChange={(e) => setForm({ ...form, reschedule: e.target.checked })} />
          <span>
            <span className="block font-semibold text-stone-900">Move Payments 2 and 3 to follow this date</span>
            <span className="block text-stone-600">
              Planned Payment 1 was {formatDate(plan.payment1Date)}. New due dates: Payment 2 on {formatDate(addMonthsClamped(form.date, 1))}, Payment 3 on{' '}
              {formatDate(addMonthsClamped(form.date, 2))}. Untick to keep {formatDate(plan.payments[1].dueDate)} and {formatDate(plan.payments[2].dueDate)}. The
              schedule is fixed after this.
            </span>
          </span>
        </label>
      )}
    </Modal>
  )
}
