import { docTotals, invoiceBalance, isIssuedCredit, today } from './calc'
import type { Document, PaymentMethod, Transaction } from './types'

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const DAY = 24 * 60 * 60 * 1000
const dayNum = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / DAY
}
export const daysBetween = (from: string, to: string) => dayNum(to) - dayNum(from)

/** An invoice counts towards what customers owe once it is issued (not draft, not cancelled). */
export const isOpenInvoice = (d: Document) => d.type === 'invoice' && d.status !== 'draft' && d.status !== 'cancelled'

// ---------------------------------------------------------------- cash

export interface CashMovement {
  key: string
  date: string
  /** Positive = money in, negative = money out. */
  amount: number
  category: string
  description: string
  customerId?: string
  method: PaymentMethod
  reference: string
  /** Document behind this movement (receipt or credit note). */
  docId?: string
  /** Manual ledger entry behind this movement. */
  txn?: Transaction
}

/** Every ringgit in or out: receipts, credit-note refunds and manual income/expenses. */
export function cashMovements(docs: Document[], transactions: Transaction[]): CashMovement[] {
  const out: CashMovement[] = []
  for (const d of docs) {
    if (d.type === 'receipt' && d.status !== 'cancelled') {
      out.push({
        key: `r-${d.id}`,
        date: d.date,
        amount: Number(d.amountPaid) || 0,
        category: 'Receipt',
        description: `${d.number}${d.notes ? ` — ${d.notes}` : ''}`,
        customerId: d.customerId,
        method: d.paymentMethod ?? 'other',
        reference: d.paymentRef || d.reference,
        docId: d.id,
      })
    }
    if (isIssuedCredit(d) && (Number(d.refundAmount) || 0) > 0) {
      out.push({
        key: `cn-${d.id}`,
        date: d.refundDate || d.date,
        amount: -(Number(d.refundAmount) || 0),
        category: 'Refund',
        description: `${d.number} — refund${d.reference ? ` for ${d.reference}` : ''}`,
        customerId: d.customerId,
        method: d.paymentMethod ?? 'other',
        reference: d.paymentRef || '',
        docId: d.id,
      })
    }
  }
  for (const t of transactions) {
    out.push({
      key: `t-${t.id}`,
      date: t.date,
      amount: t.kind === 'expense' ? -(Number(t.amount) || 0) : Number(t.amount) || 0,
      category: t.category,
      description: t.description,
      customerId: t.customerId || undefined,
      method: t.method,
      reference: t.reference,
      txn: t,
    })
  }
  return out.sort((a, b) => b.date.localeCompare(a.date))
}

// ---------------------------------------------------------------- aging

export const AGING_BUCKETS = ['Current', '1–30 days', '31–60 days', '61–90 days', '90+ days'] as const

/** Bucket index by days past the due date (not yet due = Current). */
export function agingBucket(daysOverdue: number): number {
  if (daysOverdue <= 0) return 0
  if (daysOverdue <= 30) return 1
  if (daysOverdue <= 60) return 2
  if (daysOverdue <= 90) return 3
  return 4
}

export interface OpenInvoice {
  invoice: Document
  balance: number
  daysOverdue: number
  bucket: number
}

/** Issued invoices with something still owed, oldest due first. */
export function openInvoices(docs: Document[], asOf = today()): OpenInvoice[] {
  return docs
    .filter(isOpenInvoice)
    .map((invoice) => {
      const daysOverdue = daysBetween(invoice.dueDate || invoice.date, asOf)
      return { invoice, balance: invoiceBalance(invoice, docs), daysOverdue, bucket: agingBucket(daysOverdue) }
    })
    .filter((x) => x.balance > 0.005)
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
}

export interface AgingRow {
  customerId: string
  buckets: number[]
  total: number
  count: number
}

export function agingByCustomer(docs: Document[], asOf = today()): AgingRow[] {
  const rows = new Map<string, AgingRow>()
  for (const o of openInvoices(docs, asOf)) {
    const id = o.invoice.customerId
    const row = rows.get(id) ?? { customerId: id, buckets: [0, 0, 0, 0, 0], total: 0, count: 0 }
    row.buckets[o.bucket] = round2(row.buckets[o.bucket] + o.balance)
    row.total = round2(row.total + o.balance)
    row.count++
    rows.set(id, row)
  }
  return [...rows.values()].sort((a, b) => b.total - a.total)
}

// ---------------------------------------------------------------- statement

export interface StatementLine {
  date: string
  docId?: string
  number: string
  description: string
  debit: number
  credit: number
  balance: number
}

export interface Statement {
  opening: number
  lines: StatementLine[]
  closing: number
  totalDebit: number
  totalCredit: number
  /** Unpaid invoice balances by age, as at the statement end date. */
  aging: number[]
  /** Payments and credits not tied to an invoice (they lower the closing balance but not the aging). */
  unapplied: number
}

/**
 * Customer statement of account: invoices raise the balance; receipts and credit
 * notes lower it; refunds paid out raise it back. Running balance from `from`.
 */
export function customerStatement(customerId: string, docs: Document[], from: string, to: string): Statement {
  type Entry = Omit<StatementLine, 'balance'> & { order: number }
  const entries: Entry[] = []
  for (const d of docs) {
    if (d.customerId !== customerId) continue
    if (isOpenInvoice(d)) {
      entries.push({ date: d.date, docId: d.id, number: d.number, description: 'Invoice', debit: docTotals(d).total, credit: 0, order: 0 })
    } else if (d.type === 'receipt' && d.status !== 'cancelled') {
      const inv = docs.find((x) => x.id === d.invoiceId)
      entries.push({
        date: d.date,
        docId: d.id,
        number: d.number,
        description: inv ? `Payment — ${inv.number}` : 'Payment received',
        debit: 0,
        credit: Number(d.amountPaid) || 0,
        order: 1,
      })
    } else if (isIssuedCredit(d)) {
      const inv = docs.find((x) => x.id === d.invoiceId)
      entries.push({
        date: d.date,
        docId: d.id,
        number: d.number,
        description: inv ? `Credit note — ${inv.number}` : 'Credit note',
        debit: 0,
        credit: docTotals(d).total,
        order: 2,
      })
      const refund = Number(d.refundAmount) || 0
      if (refund > 0) {
        entries.push({
          date: d.refundDate || d.date,
          docId: d.id,
          number: d.number,
          description: 'Refund paid',
          debit: refund,
          credit: 0,
          order: 3,
        })
      }
    }
  }
  entries.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order || a.number.localeCompare(b.number))

  let opening = 0
  let balance = 0
  const lines: StatementLine[] = []
  for (const e of entries) {
    if (e.date > to) continue
    balance = round2(balance + e.debit - e.credit)
    if (e.date < from) {
      opening = balance
      continue
    }
    const { order: _order, ...line } = e
    lines.push({ ...line, balance })
  }

  const aging = [0, 0, 0, 0, 0]
  const inRange = docs.filter((d) => d.customerId === customerId && d.date <= to)
  for (const o of openInvoices(inRange, to)) aging[o.bucket] = round2(aging[o.bucket] + o.balance)
  const agingTotal = round2(aging.reduce((s, v) => s + v, 0))

  return {
    opening,
    lines,
    closing: balance,
    totalDebit: round2(lines.reduce((s, l) => s + l.debit, 0)),
    totalCredit: round2(lines.reduce((s, l) => s + l.credit, 0)),
    aging,
    unapplied: round2(Math.max(0, agingTotal - balance)),
  }
}

// ---------------------------------------------------------------- profit & loss

export interface MonthRow {
  month: string // YYYY-MM
  /** Invoiced in the month (after credit notes), including tax. */
  sales: number
  /** Money in: receipts + other income − refunds. */
  moneyIn: number
  /** Money out: expenses. */
  moneyOut: number
  net: number
}

export function monthlyPnL(year: string, docs: Document[], transactions: Transaction[]): MonthRow[] {
  const rows: MonthRow[] = Array.from({ length: 12 }, (_, i) => ({
    month: `${year}-${String(i + 1).padStart(2, '0')}`,
    sales: 0,
    moneyIn: 0,
    moneyOut: 0,
    net: 0,
  }))
  const at = (date: string) => (date.startsWith(year) ? rows[Number(date.slice(5, 7)) - 1] : undefined)

  for (const d of docs) {
    if (isOpenInvoice(d)) {
      const r = at(d.date)
      if (r) r.sales += docTotals(d).total
    } else if (isIssuedCredit(d)) {
      const r = at(d.date)
      if (r) r.sales -= docTotals(d).total
    }
  }
  for (const m of cashMovements(docs, transactions)) {
    const r = at(m.date)
    if (!r) continue
    // Refunds reduce money in; expenses are money out.
    if (m.amount >= 0 || m.category === 'Refund') r.moneyIn += m.amount
    else r.moneyOut += -m.amount
  }
  for (const r of rows) {
    r.sales = round2(r.sales)
    r.moneyIn = round2(r.moneyIn)
    r.moneyOut = round2(r.moneyOut)
    r.net = round2(r.moneyIn - r.moneyOut)
  }
  return rows
}

/** Expenses for a year grouped by category, largest first. */
export function expensesByCategory(year: string, transactions: Transaction[]): { category: string; amount: number }[] {
  const map = new Map<string, number>()
  for (const t of transactions) {
    if (t.kind !== 'expense' || !t.date.startsWith(year)) continue
    map.set(t.category, (map.get(t.category) ?? 0) + (Number(t.amount) || 0))
  }
  return [...map.entries()].map(([category, amount]) => ({ category, amount: round2(amount) })).sort((a, b) => b.amount - a.amount)
}

// ---------------------------------------------------------------- contacts

export interface ContactTotals {
  /** Customers: issued invoices less credit notes. Suppliers: purchase orders. */
  billed: number
  /** Customers: receipts. Suppliers: payments recorded against them. */
  paid: number
  /** Customers: unpaid invoice balances. Suppliers: PO total not yet paid. */
  outstanding: number
}

export function contactTotals(contactId: string, kind: 'customer' | 'supplier', docs: Document[], transactions: Transaction[]): ContactTotals {
  if (kind === 'supplier') {
    const billed = docs
      .filter((d) => d.type === 'purchase_order' && d.customerId === contactId && d.status !== 'draft' && d.status !== 'cancelled')
      .reduce((s, d) => s + docTotals(d).total, 0)
    const paid = transactions.filter((t) => t.kind === 'expense' && t.customerId === contactId).reduce((s, t) => s + (Number(t.amount) || 0), 0)
    return { billed: round2(billed), paid: round2(paid), outstanding: round2(Math.max(0, billed - paid)) }
  }
  const mine = docs.filter((d) => d.customerId === contactId)
  const invoiced = mine.filter(isOpenInvoice).reduce((s, d) => s + docTotals(d).total, 0)
  const credited = mine.filter(isIssuedCredit).reduce((s, d) => s + docTotals(d).total, 0)
  const paid = mine.filter((d) => d.type === 'receipt' && d.status !== 'cancelled').reduce((s, d) => s + (Number(d.amountPaid) || 0), 0)
  const outstanding = mine.filter(isOpenInvoice).reduce((s, d) => s + invoiceBalance(d, docs), 0)
  return { billed: round2(invoiced - credited), paid: round2(paid), outstanding: round2(outstanding) }
}
