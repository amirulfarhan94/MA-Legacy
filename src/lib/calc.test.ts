import { describe, expect, it } from 'vitest'
import { addDays, amountDue, amountInWords, depositDue, depositLabel, displayStatus, docTotals, formatDate, formatDateTime, invoiceBalance, invoicePaid, invoicePaymentState, monthLabel, nextDocNumber } from './calc'
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
  it('increments per type and year, starting at 1101', () => {
    const docs = [
      baseDoc({ type: 'invoice', number: 'INV/26/1103' }),
      baseDoc({ type: 'invoice', number: 'INV/25/1180' }),
      baseDoc({ type: 'invoice', number: 'INV-2026-0003' }),
      baseDoc({ type: 'quotation', number: 'QT/26/1109' }),
    ]
    expect(nextDocNumber('invoice', 'INV', '2026-05-01', docs)).toBe('INV/26/1104')
    expect(nextDocNumber('invoice', 'INV', '2027-01-01', docs)).toBe('INV/27/1101')
    expect(nextDocNumber('receipt', 'OR', '2026-05-01', docs)).toBe('OR/26/1101')
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

describe('dates', () => {
  it('writes every month with three letters', () => {
    expect(formatDate('2026-09-21')).toBe('21 Sep 2026')
    expect(formatDate('2026-10-04')).toBe('04 Oct 2026')
    expect(formatDate('')).toBe('-')
    expect(monthLabel('2026-09')).toBe('Sep 2026')
    expect(monthLabel('2026-12', false)).toBe('Dec')
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

describe('formatDateTime', () => {
  it('shows the local date and a 12-hour time', () => {
    expect(formatDateTime(new Date(2026, 10, 4, 15, 7).toISOString())).toBe('04 Nov 2026, 3:07 PM')
    expect(formatDateTime('nonsense')).toBe('-')
  })
})

describe('proforma deposits', () => {
  const pi = baseDoc({ id: 'pi', type: 'proforma', items: [{ id: 'l', description: 'Rewire', qty: 1, unit: 'job', unitPrice: 3800 }] })
  const receipt = (id: string, invoiceId: string, amountPaid: number) => baseDoc({ id, type: 'receipt', invoiceId, amountPaid, status: 'completed' })

  it('asks for a percentage, an amount, or the full total', () => {
    expect(depositDue({ ...pi, deposit: { mode: 'percent', value: 50 } })).toBe(1900)
    expect(depositDue({ ...pi, deposit: { mode: 'amount', value: 500 } })).toBe(500)
    expect(depositDue({ ...pi, deposit: { mode: 'amount', value: 9999 } })).toBe(3800)
    expect(depositDue(pi)).toBe(3800)
    expect(depositLabel({ ...pi, deposit: { mode: 'percent', value: 50 } })).toBe('Deposit payable (50%)')
    expect(depositLabel(pi)).toBe('Amount payable')
  })

  it('tracks payments against the proforma', () => {
    const p = { ...pi, deposit: { mode: 'percent' as const, value: 50 } }
    expect(displayStatus(p, [p])).toBe('sent')
    expect(amountDue(p, [p, receipt('r1', 'pi', 1000)])).toBe(900)
    expect(displayStatus(p, [p, receipt('r1', 'pi', 1000)])).toBe('partial')
    expect(displayStatus(p, [p, receipt('r1', 'pi', 1900)])).toBe('paid')
  })

  it('carries the deposit into the invoice made from the proforma', () => {
    const inv = baseDoc({ id: 'inv', type: 'invoice', depositFrom: 'pi', items: pi.items })
    const docs = [pi, inv, receipt('r1', 'pi', 1900), receipt('r2', 'inv', 500)]
    expect(invoicePaid('inv', docs)).toBe(2400)
    expect(invoiceBalance(inv, docs)).toBe(1400)
    expect(invoicePaymentState(inv, docs)).toBe('partial')
    // The proforma itself still only counts its own receipts.
    expect(invoicePaid('pi', docs)).toBe(1900)
  })
})
