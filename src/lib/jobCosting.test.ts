import { describe, expect, it } from 'vitest'
import { jobCost, jobCostsForYear } from './jobCosting'
import type { Document, Transaction } from './types'

const doc = (over: Partial<Document>): Document => ({
  id: 'inv',
  type: 'invoice',
  number: 'INV/26/1101',
  customerId: 'c',
  date: '2026-10-01',
  dueDate: '',
  reference: '',
  items: [{ id: 'l', description: 'Rewiring', qty: 1, unit: 'job', unitPrice: 1000 }],
  discount: 0,
  taxRate: 8,
  notes: '',
  terms: '',
  status: 'sent',
  createdAt: '',
  updatedAt: '',
  ...over,
})

const cost = (amount: number, over: Partial<Transaction> = {}): Transaction => ({
  id: `t${amount}`,
  kind: 'expense',
  date: '2026-10-02',
  category: 'Materials',
  description: '',
  amount,
  method: 'cash',
  reference: '',
  jobId: 'inv',
  createdAt: '',
  ...over,
})

describe('jobCost', () => {
  it('takes the costs off the invoice before SST', () => {
    const r = jobCost(doc({}), [], [cost(300), cost(150), cost(99, { jobId: 'other' }), cost(50, { kind: 'income' })])
    expect(r.value).toBe(1000)
    expect(r.costs).toBe(450)
    expect(r.profit).toBe(550)
    expect(r.margin).toBeCloseTo(0.55)
    expect(r.expenses.map((t) => t.amount)).toEqual([300, 150])
  })

  it('takes issued credit notes off the value', () => {
    const credit = doc({ id: 'cn', type: 'credit_note', invoiceId: 'inv', status: 'issued', items: [{ id: 'l', description: 'Refund', qty: 1, unit: '', unitPrice: 200 }] })
    const draftCredit = { ...credit, id: 'cn2', status: 'draft' as const }
    expect(jobCost(doc({}), [credit, draftCredit], [cost(300)])).toMatchObject({ value: 800, profit: 500 })
  })

  it('shows a loss, and no margin on a zero-value job', () => {
    expect(jobCost(doc({}), [], [cost(1200)])).toMatchObject({ profit: -200 })
    expect(jobCost(doc({ items: [] }), [], [cost(10)]).margin).toBeNull()
  })
})

describe('jobCostsForYear', () => {
  it('lists that year’s jobs with costs, lowest margin first', () => {
    const a = doc({ id: 'a' })
    const b = doc({ id: 'b' })
    const noCosts = doc({ id: 'n' })
    const lastYear = doc({ id: 'y', date: '2025-12-30' })
    const cancelled = doc({ id: 'x', status: 'cancelled' })
    const txns = [cost(100, { jobId: 'a' }), cost(900, { id: 'b1', jobId: 'b' }), cost(5, { id: 'y1', jobId: 'y' }), cost(5, { id: 'x1', jobId: 'x' })]
    expect(jobCostsForYear('2026', [a, b, noCosts, lastYear, cancelled], txns).map((r) => r.invoice.id)).toEqual(['b', 'a'])
  })
})
