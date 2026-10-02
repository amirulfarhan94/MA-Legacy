import { describe, expect, it } from 'vitest'
import { docTotals, invoiceBalance, invoicePaymentState, displayStatus } from './calc'
import { agingBucket, agingByCustomer, cashMovements, customerStatement, monthlyPnL } from './finance'
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
