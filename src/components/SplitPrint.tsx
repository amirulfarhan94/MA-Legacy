import { formatMoney, today } from '../lib/calc'
import { dmy, splitPaymentStates } from '../lib/split'
import { useStore } from '../lib/store'
import type { Document, SplitPlan } from '../lib/types'

/** Printed pieces of a split payment (3×) invoice, in the Classic and Engineering styles. */

export const SPLIT_BADGE = 'SPLIT PAYMENT · 3×'
export const SPLIT_TERMS_LINE =
  '0% interest · no extra charges. Work starts after Payment 1 is received. Workmanship warranty is valid once all payments are complete.'
const DUE_NOTE = ['before work', '+1 month', '+2 months']
const money = (n: number) => formatMoney(n, '').trim()

/** The plan shown on an invoice: not on other documents, and not once the plan is cancelled. */
export const printedSplit = (doc: Document): SplitPlan | undefined =>
  doc.type === 'invoice' && doc.split && !doc.split.cancelled ? doc.split : undefined

function useRows(doc: Document) {
  const documents = useStore((s) => s.documents)
  return splitPaymentStates(doc, documents, today()).map((p, i) => ({
    label: i === 0 ? 'Payment 1 (deposit)' : `Payment ${p.seq}`,
    share: `${p.pct}%`,
    amount: money(p.amount),
    due: `${dmy(p.dueDate)}, ${DUE_NOTE[i]}`,
    status: p.receipt ? `☑ Paid ${dmy(p.receipt.date)}` : '☐ Paid',
  }))
}

export function SplitScheduleClassic({ doc }: { doc: Document }) {
  const rows = useRows(doc)
  return (
    <div className="mt-5 overflow-hidden rounded-md border border-gold-600">
      <div className="bg-ink-900 px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-gold-200">Payment schedule</div>
      <table className="w-full text-[11.5px]">
        <thead>
          <tr className="border-b border-stone-200 text-left text-[10px] uppercase tracking-wide text-stone-500">
            <th className="px-3 py-1.5 font-semibold">Payment</th>
            <th className="px-3 py-1.5 font-semibold">Share</th>
            <th className="px-3 py-1.5 text-right font-semibold">Amount (RM)</th>
            <th className="px-3 py-1.5 font-semibold">Due date</th>
            <th className="px-3 py-1.5 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-stone-100 last:border-0">
              <td className="px-3 py-1.5 font-medium">{r.label}</td>
              <td className="px-3 py-1.5">{r.share}</td>
              <td className="tabular px-3 py-1.5 text-right font-medium">{r.amount}</td>
              <td className="px-3 py-1.5">{r.due}</td>
              <td className="px-3 py-1.5">{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-stone-200 bg-gold-50 px-3 py-1.5 text-[10.5px] text-stone-700">{SPLIT_TERMS_LINE}</div>
    </div>
  )
}

export function SplitScheduleEng({ doc }: { doc: Document }) {
  const rows = useRows(doc)
  return (
    <div className="eng-section">
      <span className="eng-cap">Payment schedule</span>
      <table className="eng-items eng-split">
        <thead>
          <tr>
            <th>Payment</th>
            <th>Share</th>
            <th className="r">Amount (RM)</th>
            <th>Due date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td className="eng-mono">{r.share}</td>
              <td className="r">{r.amount}</td>
              <td className="eng-mono">{r.due}</td>
              <td>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="eng-note">{SPLIT_TERMS_LINE}</p>
    </div>
  )
}

/** Classic payment details for a split invoice: always shown, with the invoice no. as the reference. */
export function SplitPaymentDetailsClassic({ doc }: { doc: Document }) {
  const settings = useStore((s) => s.settings)
  return (
    <div className="flex items-start gap-4">
      {settings.paymentQrDataUrl && (
        <div className="shrink-0 text-center">
          <img src={settings.paymentQrDataUrl} alt="Payment QR code" className="h-28 w-28 rounded border border-stone-200 object-contain p-1" />
          {settings.paymentQrLabel && <div className="mt-1 max-w-28 text-[9.5px] leading-tight text-stone-500">{settings.paymentQrLabel}</div>}
        </div>
      )}
      <div>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gold-700">Payment details</div>
        <div>Account name: {settings.companyName}</div>
        <div>Bank: {settings.bankName || '—'}</div>
        <div>Account no.: {settings.bankAccountNo || '—'}</div>
        <div>Reference: {doc.number}</div>
      </div>
    </div>
  )
}
