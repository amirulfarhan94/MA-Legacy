import { describe, expect, it } from 'vitest'
import { addDays, amountInWords, docTotals, invoicePaymentState, nextDocNumber } from './calc'
import type { Document } from './types'

const baseDoc = (over: Partial<Document>): Document => ({
  id: 'x',
  type: 'invoice',
  number: '',
  customerId: 'c',
  date: '2026-01-01',
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

describe('docTotals', () => {
  it('applies discount before tax', () => {
    const t = docTotals({
      items: [
        { id: '1', description: 'a', qty: 2, unit: 'pcs', unitPrice: 150 },
        { id: '2', description: 'b', qty: 1, unit: 'job', unitPrice: 200.5 },
      ],
      discount: 50.5,
      taxRate: 8,
    })
    expect(t).toMatchObject({ subtotal: 500.5, discount: 50.5, taxable: 450, tax: 36, total: 486 })
  })

  it('caps discount at subtotal', () => {
    const t = docTotals({ items: [{ id: '1', description: '', qty: 1, unit: '', unitPrice: 10 }], discount: 99, taxRate: 0 })
    expect(t.total).toBe(0)
  })
})

describe('nextDocNumber', () => {
  it('increments per type and year', () => {
    const docs = [
      baseDoc({ type: 'invoice', number: 'INV-2026-0003' }),
      baseDoc({ type: 'invoice', number: 'INV-2025-0010' }),
      baseDoc({ type: 'quotation', number: 'QT-2026-0009' }),
    ]
    expect(nextDocNumber('invoice', 'INV', '2026-05-01', docs)).toBe('INV-2026-0004')
    expect(nextDocNumber('invoice', 'INV', '2027-01-01', docs)).toBe('INV-2027-0001')
  })
})

describe('invoicePaymentState', () => {
  it('derives unpaid / partial / paid from receipts', () => {
    const inv = baseDoc({ id: 'inv', items: [{ id: '1', description: '', qty: 1, unit: '', unitPrice: 100 }] })
    const r1 = baseDoc({ id: 'r1', type: 'receipt', invoiceId: 'inv', amountPaid: 40, status: 'completed' })
    const r2 = baseDoc({ id: 'r2', type: 'receipt', invoiceId: 'inv', amountPaid: 60, status: 'completed' })
    const void_ = baseDoc({ id: 'r3', type: 'receipt', invoiceId: 'inv', amountPaid: 60, status: 'cancelled' })
    expect(invoicePaymentState(inv, [inv])).toBe('unpaid')
    expect(invoicePaymentState(inv, [inv, r1, void_])).toBe('partial')
    expect(invoicePaymentState(inv, [inv, r1, r2])).toBe('paid')
  })
})

describe('amountInWords', () => {
  it('spells ringgit and cents', () => {
    expect(amountInWords(1250.5)).toBe('Ringgit Malaysia One Thousand Two Hundred Fifty And Cents Fifty Only')
    expect(amountInWords(21)).toBe('Ringgit Malaysia Twenty-One Only')
    expect(amountInWords(1000000)).toBe('Ringgit Malaysia One Million Only')
  })
})

describe('addDays', () => {
  it('crosses month boundaries', () => {
    expect(addDays('2026-01-25', 14)).toBe('2026-02-08')
  })
})

describe('sub items', () => {
  const sub = (priced: boolean, qty: number, unitPrice: number) => ({ id: String(Math.random()), description: 's', priced, qty, unit: 'u', unitPrice })

  it('priced sub items replace the main qty × price', () => {
    const t = docTotals({
      items: [{ id: '1', description: 'CCTV package', qty: 1, unit: 'set', unitPrice: 9999, subItems: [sub(true, 8, 380), sub(true, 1, 1250), sub(false, 50, 0)] }],
      discount: 0,
      taxRate: 0,
    })
    expect(t.total).toBe(4290)
  })

  it('notes alone leave the main price in charge', () => {
    const t = docTotals({
      items: [{ id: '1', description: 'Servicing', qty: 2, unit: 'job', unitPrice: 150, subItems: [sub(false, 0, 0)] }],
      discount: 0,
      taxRate: 0,
    })
    expect(t.total).toBe(300)
  })
})
