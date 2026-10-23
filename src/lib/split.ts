import { docTotals, formatMoney, invoiceBalance, round2 } from './calc'
import { daysBetween } from './finance'
import type { Document, SplitPayment, SplitPlan } from './types'

/**
 * Split payment (3×): an invoice paid in three interest-free payments of 40%, 30% and 30%.
 * The plan lives on its invoice (Document.split); each payment is an ordinary receipt that
 * names the payments it covers (Document.splitSeqs). Statuses are worked out here from those
 * receipts and today's date, so they never go stale. See docs/split-payment-spec.md.
 */

export const SPLIT_MIN = 300
export const SPLIT_MAX = 1500
export const SPLIT_PCTS = [40, 30, 30] as const
/** Days past the due date after which a plan counts as Overdue. */
export const SPLIT_LATE_DAYS = 7
export const SPLIT_REMINDER_DAYS = 7

export type SplitPaymentStatus = 'Pending' | 'Paid' | 'Overdue'
export type SplitPlanStatus = 'Active' | 'Completed' | 'Overdue' | 'Cancelled'

/**
 * Same day of the month, `months` later; when that day does not exist (31 Feb), the last day
 * of that month. Always counted from the anchor date, so 31 Jan → 28/29 Feb → 31 Mar.
 */
export function addMonthsClamped(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1 + months, 1))
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  const day = Math.min(d, last)
  return `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Payments 1 and 2 rounded to the nearest RM1; Payment 3 takes the rest, so they add up to the total. */
export function splitAmounts(total: number): [number, number, number] {
  const p1 = Math.round(round2((total * SPLIT_PCTS[0]) / 100))
  const p2 = Math.round(round2((total * SPLIT_PCTS[1]) / 100))
  return [p1, p2, round2(total - p1 - p2)]
}

/** The three payments: Payment 1 on its date (before work starts), then +1 and +2 months. */
export function splitSchedule(total: number, payment1Date: string): SplitPayment[] {
  const amounts = splitAmounts(total)
  return ([1, 2, 3] as const).map((seq, i) => ({
    seq,
    pct: SPLIT_PCTS[i],
    amount: amounts[i],
    dueDate: i === 0 ? payment1Date : addMonthsClamped(payment1Date, i),
  }))
}

/** Plan moved to the date Payment 1 was actually paid: Payments 2 and 3 follow from that date. */
export function rescheduleFromPayment1(plan: SplitPlan, paidDate: string): SplitPlan {
  return {
    ...plan,
    payment1Date: paidDate,
    payments: plan.payments.map((p, i) => ({ ...p, dueDate: i === 0 ? paidDate : addMonthsClamped(paidDate, i) })),
  }
}

/** Receipts (not cancelled) paying into a split invoice's schedule. */
export const splitReceipts = (invoiceId: string, docs: Document[]) =>
  docs.filter((d) => d.type === 'receipt' && d.invoiceId === invoiceId && d.status !== 'cancelled' && d.splitSeqs?.length)

export interface SplitPaymentState extends SplitPayment {
  status: SplitPaymentStatus
  receipt?: Document
  /** Days past the due date (negative: days still to go). */
  daysLate: number
}

export function splitPaymentStates(invoice: Document, docs: Document[], today: string): SplitPaymentState[] {
  const receipts = splitReceipts(invoice.id, docs)
  return (invoice.split?.payments ?? []).map((p) => {
    const receipt = receipts.find((r) => r.splitSeqs!.includes(p.seq))
    const daysLate = daysBetween(p.dueDate, today)
    return { ...p, receipt, daysLate, status: receipt ? 'Paid' : daysLate > 0 ? 'Overdue' : 'Pending' }
  })
}

/** True once a payment is recorded: the schedule is then fixed and the plan can't be switched off. */
export const splitLocked = (invoice: Document, docs: Document[]) => splitReceipts(invoice.id, docs).length > 0

export function splitPlanStatus(invoice: Document, docs: Document[], today: string): SplitPlanStatus {
  if (invoice.status === 'cancelled' || invoice.split?.cancelled) return 'Cancelled'
  const states = splitPaymentStates(invoice, docs, today)
  if (states.every((s) => s.status === 'Paid') || (docTotals(invoice).total > 0 && invoiceBalance(invoice, docs) <= 0)) return 'Completed'
  if (states.some((s) => s.status === 'Overdue' && s.daysLate > SPLIT_LATE_DAYS)) return 'Overdue'
  return 'Active'
}

/** Active and Overdue plans (drafts included) count towards the limits. */
export const isActiveSplit = (invoice: Document, docs: Document[], today: string) => {
  if (invoice.type !== 'invoice' || !invoice.split) return false
  const s = splitPlanStatus(invoice, docs, today)
  return s === 'Active' || s === 'Overdue'
}

export const activeSplitPlans = (docs: Document[], today: string) => docs.filter((d) => isActiveSplit(d, docs, today))

export interface SplitEligibility {
  ok: boolean
  reason?: string
}

/** Whether an invoice may use (or keep) split payment. The invoice itself is left out of the counts. */
export function splitEligibility(args: {
  total: number
  customerId: string
  invoiceId: string
  docs: Document[]
  maxActive: number
  today: string
  customerLabel?: string
}): SplitEligibility {
  const { total, customerId, invoiceId, docs, maxActive, today } = args
  const money = (n: number) => formatMoney(n)
  if (total < SPLIT_MIN || total > SPLIT_MAX) {
    return { ok: false, reason: `Split payment is for jobs of ${money(SPLIT_MIN)} to ${money(SPLIT_MAX)}. This invoice is ${money(total)}.` }
  }
  if (!customerId) return { ok: false, reason: 'Choose the customer first.' }
  const others = activeSplitPlans(docs, today).filter((d) => d.id !== invoiceId)
  const same = others.find((d) => d.customerId === customerId)
  if (same) {
    return { ok: false, reason: `${args.customerLabel || 'This customer'} already has an active split plan (${same.number}). Only one active plan per customer.` }
  }
  if (others.length >= maxActive) {
    return { ok: false, reason: `The limit of ${maxActive} active split plans is reached (change it in Settings).` }
  }
  return { ok: true }
}

/** Next agreement number for the year of `date`, e.g. MAL-SP-2026-004. */
export function nextAgreementNo(date: string, docs: Document[]): string {
  const head = `MAL-SP-${date.slice(0, 4)}-`
  let max = 0
  for (const d of docs) {
    const no = d.split?.agreementNo
    if (no?.startsWith(head)) max = Math.max(max, parseInt(no.slice(head.length), 10) || 0)
  }
  return `${head}${String(max + 1).padStart(3, '0')}`
}

export interface DuePayment {
  invoice: Document
  payment: SplitPaymentState
}

/** Unpaid payments due within the next `days` days, and every overdue one, earliest first. */
export function duePayments(docs: Document[], today: string, days = SPLIT_REMINDER_DAYS): DuePayment[] {
  const out: DuePayment[] = []
  for (const invoice of activeSplitPlans(docs, today)) {
    if (invoice.status === 'draft') continue
    for (const payment of splitPaymentStates(invoice, docs, today)) {
      if (payment.status !== 'Paid' && payment.daysLate >= -days) out.push({ invoice, payment })
    }
  }
  return out.sort((a, b) => a.payment.dueDate.localeCompare(b.payment.dueDate))
}

/** 31/01/2027 */
export const dmy = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '')

/** WhatsApp reminder in Bahasa Malaysia (spec section 6). Overdue payments say "telah" rather than "akan". */
export function splitReminderBM(r: {
  name: string
  seq: number
  amount: number
  invoiceNo: string
  dueDate: string
  overdue: boolean
  company: string
  bank: string
  accountNo: string
}): string {
  return [
    `Salam ${r.name}, ini peringatan mesra daripada ${r.company}.`,
    '',
    `Bayaran ke-${r.seq} sebanyak RM${formatMoney(r.amount, '').trim()} untuk invois ${r.invoiceNo} ${r.overdue ? 'telah' : 'akan'} jatuh tempo pada ${dmy(r.dueDate)}.`,
    '',
    `Akaun: ${r.company}`,
    `Bank: ${r.bank}`,
    `No. akaun: ${r.accountNo}`,
    `Rujukan: ${r.invoiceNo}`,
    '',
    'Sila hantar slip bayaran di sini selepas membuat bayaran. Terima kasih!',
  ].join('\n')
}
