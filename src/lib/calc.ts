import type { Document, DocType, LineItem } from './types'

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Line amount after its own discount (the discount only counts when per-item adjustments are on). */
export function lineTotal(item: LineItem, itemAdjustments = false): number {
  const gross = (Number(item.qty) || 0) * (Number(item.unitPrice) || 0)
  const pct = itemAdjustments ? Math.min(100, Math.max(0, Number(item.discountPct) || 0)) : 0
  return round2(gross - (gross * pct) / 100)
}

export interface TaxLine {
  rate: number
  base: number
  tax: number
}

export interface Totals {
  subtotal: number
  discount: number
  taxable: number
  /** Tax grouped by rate (one entry when the whole document uses one rate). */
  taxLines: TaxLine[]
  tax: number
  total: number
}

type TotalsInput = Pick<Document, 'items' | 'discount' | 'taxRate'> & Partial<Pick<Document, 'itemAdjustments'>>

/**
 * Subtotal of line amounts, minus a document-level discount, plus tax.
 * With per-item adjustments each line can carry its own rate; the document
 * discount is spread across lines in proportion before tax is worked out.
 */
export function docTotals(doc: TotalsInput): Totals {
  const adj = !!doc.itemAdjustments
  const lines = doc.items.map((i) => ({
    net: lineTotal(i, adj),
    rate: Number(adj && i.taxRate !== undefined ? i.taxRate : doc.taxRate) || 0,
  }))
  const subtotal = round2(lines.reduce((s, l) => s + l.net, 0))
  const discount = Math.min(round2(Number(doc.discount) || 0), subtotal)
  const taxable = round2(subtotal - discount)
  const factor = subtotal ? taxable / subtotal : 0

  const byRate = new Map<number, number>()
  for (const l of lines) {
    if (!l.rate) continue
    byRate.set(l.rate, (byRate.get(l.rate) ?? 0) + l.net * factor)
  }
  const taxLines = [...byRate.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rate, base]) => ({ rate, base: round2(base), tax: round2((base * rate) / 100) }))
  const tax = round2(taxLines.reduce((s, t) => s + t.tax, 0))
  return { subtotal, discount, taxable, taxLines, tax, total: round2(taxable + tax) }
}

/** The amount a document represents: receipts carry amountPaid; DO and service reports have none. */
export function docAmount(doc: Document): number {
  if (doc.type === 'receipt') return round2(Number(doc.amountPaid) || 0)
  if (doc.type === 'delivery_order' || doc.type === 'service_report') return 0
  return docTotals(doc).total
}

/** A credit note counts once it is issued (not while draft, not when cancelled). */
export const isIssuedCredit = (d: Document) => d.type === 'credit_note' && d.status === 'issued'

/** Sum of non-cancelled receipts issued against an invoice. */
export function invoicePaid(invoiceId: string, docs: Document[]): number {
  return round2(
    docs
      .filter((d) => d.type === 'receipt' && d.invoiceId === invoiceId && d.status !== 'cancelled')
      .reduce((s, d) => s + (Number(d.amountPaid) || 0), 0),
  )
}

/** Sum of issued credit notes against an invoice. */
export function invoiceCredited(invoiceId: string, docs: Document[]): number {
  return round2(
    docs.filter((d) => isIssuedCredit(d) && d.invoiceId === invoiceId).reduce((s, d) => s + docTotals(d).total, 0),
  )
}

/** What the customer still owes on an invoice: total − payments − credit notes (never below 0). */
export function invoiceBalance(invoice: Document, docs: Document[]): number {
  return Math.max(0, round2(docTotals(invoice).total - invoicePaid(invoice.id, docs) - invoiceCredited(invoice.id, docs)))
}

export type PaymentState = 'unpaid' | 'partial' | 'paid' | 'credited'

export function invoicePaymentState(invoice: Document, docs: Document[]): PaymentState {
  const total = docTotals(invoice).total
  const paid = invoicePaid(invoice.id, docs)
  const credited = invoiceCredited(invoice.id, docs)
  if (paid + credited <= 0) return 'unpaid'
  if (paid + credited + 0.005 >= total) return paid <= 0 ? 'credited' : 'paid'
  return 'partial'
}

/** Status to display: invoices show payment state unless draft/cancelled. */
export function displayStatus(doc: Document, docs: Document[]): string {
  if (doc.type === 'invoice' && doc.status !== 'cancelled') {
    const state = invoicePaymentState(doc, docs)
    if (doc.status === 'draft' && state === 'unpaid') return 'draft'
    if ((state === 'unpaid' || state === 'partial') && doc.dueDate && doc.dueDate < today()) return 'overdue'
    return state
  }
  return doc.status
}

export function today(): string {
  const d = new Date()
  return toISODate(d)
}

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return toISODate(new Date(y, m - 1, d + days))
}

/**
 * Next running number for a doc type, e.g. INV-2026-0007.
 * Numbering restarts every year and never reuses a number already taken.
 */
export function nextDocNumber(type: DocType, prefix: string, date: string, docs: Document[]): string {
  const year = date.slice(0, 4)
  const head = `${prefix}-${year}-`
  let max = 0
  for (const d of docs) {
    if (d.type !== type || !d.number.startsWith(head)) continue
    const n = parseInt(d.number.slice(head.length), 10)
    if (!Number.isNaN(n) && n > max) max = n
  }
  return `${head}${String(max + 1).padStart(4, '0')}`
}

export function formatMoney(n: number, currency = 'RM'): string {
  const s = (Number(n) || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${currency} ${s}`
}

export function formatDate(iso: string): string {
  if (!iso) return '-'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function under1000(n: number): string {
  const parts: string[] = []
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`)
    n %= 100
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ''))
  } else if (n > 0) {
    parts.push(ONES[n])
  }
  return parts.join(' ')
}

function intToWords(n: number): string {
  if (n === 0) return 'Zero'
  const scales = ['', 'Thousand', 'Million', 'Billion']
  const parts: string[] = []
  let i = 0
  while (n > 0 && i < scales.length) {
    const chunk = n % 1000
    if (chunk) parts.unshift(`${under1000(chunk)}${scales[i] ? ' ' + scales[i] : ''}`)
    n = Math.floor(n / 1000)
    i++
  }
  return parts.join(' ')
}

/** "Ringgit Malaysia One Thousand Two Hundred And Cents Fifty Only" */
export function amountInWords(amount: number): string {
  const cents = Math.round((Number(amount) || 0) * 100)
  const ringgit = Math.floor(cents / 100)
  const sen = cents % 100
  let s = `Ringgit Malaysia ${intToWords(ringgit)}`
  if (sen) s += ` And Cents ${intToWords(sen)}`
  return `${s} Only`
}
