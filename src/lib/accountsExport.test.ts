import { describe, expect, it } from 'vitest'
import { accountsSheets } from './accountsExport'
import type { Document, Transaction } from './types'

const doc = (over: Partial<Document>): Document => ({
  id: Math.random().toString(36).slice(2),
  type: 'invoice',
  number: '',
  customerId: 'c1',
  date: '2026-03-10',
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
const line = (qty: number, unitPrice: number) => ({ id: String(Math.random()), description: 'x', qty, unit: 'u', unitPrice })
const txn = (over: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36).slice(2),
  kind: 'expense',
  date: '2026-03-15',
  category: 'Supplies',
  description: '',
  amount: 0,
  method: 'cash',
  reference: '',
  createdAt: '',
  ...over,
})

const inv = doc({ id: 'inv', number: 'INV-1', items: [line(1, 1000)], taxRate: 8 }) // 1,080 with 80 SST
const documents = [
  inv,
  doc({ number: 'INV-DRAFT', status: 'draft', items: [line(1, 500)] }),
  doc({ number: 'INV-OLD', date: '2026-02-01', items: [line(1, 300)] }),
  doc({ type: 'receipt', number: 'OR-1', status: 'completed', invoiceId: 'inv', amountPaid: 540, date: '2026-03-20', paymentMethod: 'bank_transfer' }),
  doc({ type: 'credit_note', number: 'CN-1', status: 'issued', invoiceId: 'inv', items: [line(1, 100)], taxRate: 8, refundAmount: 50, refundDate: '2026-03-25' }),
]
const transactions = [txn({ amount: 200 }), txn({ kind: 'income', category: 'Other income', amount: 30 }), txn({ amount: 999, date: '2026-04-01' })]

const sheets = accountsSheets({ documents, transactions, customers: [], companyName: 'Co', taxLabel: 'SST', from: '2026-03-01', to: '2026-03-31' })
const sheet = (name: string) => sheets.find((s) => s.name === name)!
const summary = Object.fromEntries(sheet('Summary').rows.filter((r) => r[0]).map((r) => [r[0], r[1]]))

describe('accounts export', () => {
  it('lists issued invoices in the period with what was paid and credited', () => {
    const rows = sheet('Sales').rows
    expect(rows.map((r) => r[1])).toEqual(['INV-1', null])
    // subtotal, discount, SST, total, paid, credited (108 incl. SST), balance
    expect(rows[0].slice(4, 11)).toEqual([1000, 0, 80, 1080, 540, 108, 432])
    expect(rows[1][0]).toBe('Total')
  })

  it('sums the period: net sales, net SST and cash', () => {
    expect(summary['Sales invoiced']).toBe(1080)
    expect(summary['Less credit notes']).toBe(-108)
    expect(summary['Net sales']).toBe(972)
    expect(summary['Net SST']).toBe(72)
    expect(summary['Money received']).toBe(570) // receipt 540 + other income 30
    expect(summary['Refunds paid']).toBe(-50)
    expect(summary['Expenses paid']).toBe(-200)
    expect(summary['Net cash']).toBe(320)
  })

  it('adds an SST tab by month only when tax was charged', () => {
    expect(sheet('SST').rows).toEqual([['2026-03', 1000, 80, 8, 72]])
    const untaxed = accountsSheets({ documents: [doc({ items: [line(1, 10)] })], transactions: [], customers: [], companyName: 'Co', taxLabel: 'SST', from: '2026-01-01', to: '2026-12-31' })
    expect(untaxed.map((s) => s.name)).toEqual(['Summary', 'Sales', 'Credit notes', 'Money in', 'Expenses'])
  })
})
