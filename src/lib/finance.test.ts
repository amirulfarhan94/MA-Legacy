import { describe, expect, it } from 'vitest'
import { docTotals, invoiceBalance, invoicePaymentState, displayStatus } from './calc'
import { agingBucket, agingByCustomer, cashMovements, customerStatement, monthlyPnL, monthlyTotals, monthToDate, weeklyTotals } from './finance'
import type { Document, Transaction } from './types'

const doc = (over: Partial<Document>): Document => ({
  id: Math.random().toString(36).slice(2),
  type: 'invoice',
  number: '',
  customerId: 'c1',
  date: '2026-01-10',
  dueDate: '',
  reference: '',
  items: [],
  discount: 0,
  taxRate: 0,
  notes: '',
  terms: '',
  status: 'sent',
  createdAt: '',
  updatedAt: '',
  ...over,
})
const line = (qty: number, unitPrice: number, extra = {}) => ({ id: String(Math.random()), description: 'x', qty, unit: 'u', unitPrice, ...extra })

describe('per-item discount and tax', () => {
  it('ignores line fields when adjustments are off (legacy documents)', () => {
    const t = docTotals({ items: [line(1, 100, { discountPct: 50, taxRate: 0 })], discount: 0, taxRate: 8 })
    expect(t).toMatchObject({ subtotal: 100, tax: 8, total: 108 })
  })

  it('applies line discount and per-line rates, spreading the document discount', () => {
    const t = docTotals({
      itemAdjustments: true,
      items: [line(2, 100, { discountPct: 10, taxRate: 8 }), line(1, 200, { taxRate: 0 })],
      discount: 38, // 10% of the 380 subtotal
      taxRate: 8,
    })
    // lines: 180 @8%, 200 @0%; after 10% doc discount → 162 taxable at 8%
    expect(t.subtotal).toBe(380)
    expect(t.taxable).toBe(342)
    expect(t.taxLines).toEqual([{ rate: 8, base: 162, tax: 12.96 }])
    expect(t.total).toBe(354.96)
  })
})

describe('credit notes', () => {
  const inv = doc({ id: 'inv', items: [line(1, 1000)], dueDate: '2026-01-24' })

  it('reduce the invoice balance once issued', () => {
    const draft = doc({ type: 'credit_note', invoiceId: 'inv', items: [line(1, 300)], status: 'draft' })
    const issued = { ...draft, status: 'issued' as const }
    const receipt = doc({ type: 'receipt', invoiceId: 'inv', amountPaid: 200, status: 'completed' })
    expect(invoiceBalance(inv, [inv, draft, receipt])).toBe(800)
    expect(invoiceBalance(inv, [inv, issued, receipt])).toBe(500)
    expect(invoicePaymentState(inv, [inv, issued, receipt])).toBe('partial')
  })

  it('a full credit with no payment shows as credited, not overdue', () => {
    const cn = doc({ type: 'credit_note', invoiceId: 'inv', items: [line(1, 1000)], status: 'issued' })
    expect(displayStatus(inv, [inv, cn])).toBe('credited')
  })

  it('refunds are money out', () => {
    const cn = doc({ type: 'credit_note', invoiceId: 'inv', items: [line(1, 100)], status: 'issued', refundAmount: 100, refundDate: '2026-02-01' })
    const m = cashMovements([inv, cn], [])
    expect(m).toHaveLength(1)
    expect(m[0]).toMatchObject({ amount: -100, category: 'Refund', date: '2026-02-01' })
  })
})

describe('aging', () => {
  it('buckets by days past due', () => {
    expect([0, -5, 1, 30, 31, 60, 61, 90, 91].map(agingBucket)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4])
  })

  it('groups open balances per customer', () => {
    const a = doc({ customerId: 'c1', items: [line(1, 100)], dueDate: '2026-03-01' })
    const b = doc({ customerId: 'c1', items: [line(1, 50)], dueDate: '2026-01-01' })
    const paid = doc({ customerId: 'c2', id: 'p', items: [line(1, 70)], dueDate: '2026-01-01' })
    const r = doc({ type: 'receipt', invoiceId: 'p', amountPaid: 70, status: 'completed' })
    const rows = agingByCustomer([a, b, paid, r], '2026-03-15')
    expect(rows).toEqual([{ customerId: 'c1', buckets: [0, 100, 0, 50, 0], total: 150, count: 2 }])
  })
})

describe('statement of account', () => {
  it('carries an opening balance and a running balance', () => {
    const i1 = doc({ id: 'i1', number: 'INV-1', date: '2026-01-05', items: [line(1, 500)] })
    const r1 = doc({ type: 'receipt', number: 'OR-1', date: '2026-01-20', invoiceId: 'i1', amountPaid: 200, status: 'completed' })
    const i2 = doc({ id: 'i2', number: 'INV-2', date: '2026-02-03', items: [line(1, 300)] })
    const cn = doc({ type: 'credit_note', number: 'CN-1', date: '2026-02-10', invoiceId: 'i2', items: [line(1, 100)], status: 'issued' })
    const other = doc({ customerId: 'c2', date: '2026-02-01', items: [line(1, 999)] })
    const s = customerStatement('c1', [i1, r1, i2, cn, other], '2026-02-01', '2026-02-28')
    expect(s.opening).toBe(300)
    expect(s.lines.map((l) => [l.number, l.debit, l.credit, l.balance])).toEqual([
      ['INV-2', 300, 0, 600],
      ['CN-1', 0, 100, 500],
    ])
    expect(s.closing).toBe(500)
  })
})

describe('monthly P&L', () => {
  it('splits sales, money in and money out per month', () => {
    const inv = doc({ date: '2026-03-02', items: [line(1, 1000)] })
    const cn = doc({ type: 'credit_note', date: '2026-03-20', items: [line(1, 100)], status: 'issued', refundAmount: 100 })
    const r = doc({ type: 'receipt', date: '2026-04-01', amountPaid: 900, status: 'completed' })
    const t: Transaction = { id: 't', kind: 'expense', date: '2026-04-15', category: 'Materials', description: '', amount: 250, method: 'cash', reference: '', createdAt: '' }
    const rows = monthlyPnL('2026', [inv, cn, r], [t])
    expect(rows[2]).toMatchObject({ month: '2026-03', sales: 900, moneyIn: -100, moneyOut: 0, net: -100 })
    expect(rows[3]).toMatchObject({ month: '2026-04', sales: 0, moneyIn: 900, moneyOut: 250, net: 650 })
  })
})

describe('dashboard figures', () => {
  const e = (date: string, amount: number) => ({ date, amount })

  it('compares this month with the same days of last month', () => {
    const r = monthToDate([e('2026-10-02', 100), e('2026-10-15', 50), e('2026-09-10', 80), e('2026-09-20', 500), e('2026-08-01', 999)], '2026-10-16')
    expect(r).toEqual({ current: 150, previous: 80, previousMonth: '2026-09', upToDay: 16 })
  })

  it('caps the comparison at the length of last month', () => {
    const r = monthToDate([e('2026-02-28', 10), e('2026-03-31', 5)], '2026-03-31')
    expect(r).toMatchObject({ current: 5, previous: 10, previousMonth: '2026-02', upToDay: 28 })
  })

  it('crosses the year for January', () => {
    expect(monthToDate([e('2025-12-03', 7)], '2026-01-05')).toMatchObject({ previous: 7, previousMonth: '2025-12' })
  })

  it('totals the last 12 months', () => {
    const m = monthlyTotals([e('2026-10-01', 1), e('2025-11-30', 2), e('2025-10-31', 99)], 12, '2026-10-16')
    expect(m).toHaveLength(12)
    expect(m[0]).toEqual({ key: '2025-11', value: 2 })
    expect(m[11]).toEqual({ key: '2026-10', value: 1 })
  })

  it('totals 7-day weeks ending today', () => {
    const w = weeklyTotals([e('2026-10-16', 1), e('2026-10-10', 2), e('2026-10-09', 4), e('2026-07-17', 8), e('2026-07-16', 16), e('2026-10-17', 32)], 13, '2026-10-16')
    expect(w).toHaveLength(13)
    expect(w[12]).toEqual({ start: '2026-10-10', end: '2026-10-16', value: 3 })
    expect(w[11]).toMatchObject({ end: '2026-10-09', value: 4 })
    expect(w[0]).toMatchObject({ start: '2026-07-18', value: 0 })
  })
})
