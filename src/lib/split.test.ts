import { describe, expect, it } from 'vitest'
import {
  addMonthsClamped,
  duePayments,
  nextAgreementNo,
  rescheduleFromPayment1,
  splitAmounts,
  splitEligibility,
  splitPaymentStates,
  splitPlanStatus,
  splitReminderBM,
  splitSchedule,
} from './split'
import type { Document, SplitPlan } from './types'

const doc = (over: Partial<Document>): Document => ({
  id: Math.random().toString(36).slice(2),
  type: 'invoice',
  number: 'INV-1',
  customerId: 'c1',
  date: '2027-01-31',
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
const plan = (total: number, payment1Date: string, over: Partial<SplitPlan> = {}): SplitPlan => ({
  agreementNo: 'MAL-SP-2027-001',
  quotationNo: '',
  customerName: 'Ali',
  icNo: '900101-10-1234',
  phone: '',
  email: '',
  premisesAddress: '',
  workDescription: '',
  plannedWorkDate: '',
  payment1Date,
  payments: splitSchedule(total, payment1Date),
  createdAt: '',
  ...over,
})
const splitInvoice = (total: number, p1: string, over: Partial<Document> = {}) =>
  doc({ items: [{ id: 'l', description: 'Wiring', qty: 1, unit: 'job', unitPrice: total }], split: plan(total, p1), ...over })
const receipt = (inv: Document, seqs: number[], amount: number, date: string, over: Partial<Document> = {}) =>
  doc({ type: 'receipt', number: `OR-${seqs.join('')}`, invoiceId: inv.id, customerId: inv.customerId, amountPaid: amount, date, splitSeqs: seqs, status: 'completed', ...over })

describe('section 7: amounts and dates', () => {
  it('RM1,200 → 480 / 360 / 360, due +1 and +2 months', () => {
    const s = splitSchedule(1200, '2027-03-15')
    expect(s.map((p) => p.amount)).toEqual([480, 360, 360])
    expect(s.map((p) => p.pct)).toEqual([40, 30, 30])
    expect(s.map((p) => p.dueDate)).toEqual(['2027-03-15', '2027-04-15', '2027-05-15'])
  })

  it('RM1,050 → 420 / 315 / 315; RM999 → 400 / 300 / 299, always adding up to the total', () => {
    expect(splitAmounts(1050)).toEqual([420, 315, 315])
    expect(splitAmounts(999)).toEqual([400, 300, 299])
    for (const total of [300, 333.33, 999, 1000.5, 1234.56, 1500]) {
      const [a, b, c] = splitAmounts(total)
      expect(Math.round((a + b + c) * 100) / 100).toBe(total)
    }
  })

  it('Payment 1 on 31 Jan 2027 → 28 Feb 2027 and 31 Mar 2027', () => {
    expect(splitSchedule(1200, '2027-01-31').map((p) => p.dueDate)).toEqual(['2027-01-31', '2027-02-28', '2027-03-31'])
    // Leap year and year end
    expect(addMonthsClamped('2028-01-31', 1)).toBe('2028-02-29')
    expect(addMonthsClamped('2027-11-30', 2)).toBe('2028-01-30')
    expect(addMonthsClamped('2027-12-31', 2)).toBe('2028-02-29')
  })
})

describe('section 7: who can use split payment', () => {
  const base = { customerId: 'c1', invoiceId: 'new', docs: [] as Document[], maxActive: 5, today: '2027-01-31' }

  it('RM299 and RM1,501 cannot; RM300 and RM1,500 can', () => {
    expect(splitEligibility({ ...base, total: 299 }).ok).toBe(false)
    expect(splitEligibility({ ...base, total: 1501 }).ok).toBe(false)
    expect(splitEligibility({ ...base, total: 299 }).reason).toContain('RM 300.00 to RM 1,500.00')
    expect(splitEligibility({ ...base, total: 300 }).ok).toBe(true)
    expect(splitEligibility({ ...base, total: 1500 }).ok).toBe(true)
  })

  it('a customer with an active plan cannot start a second one', () => {
    const active = splitInvoice(1200, '2027-01-31', { number: 'INV-9' })
    const r = splitEligibility({ ...base, total: 800, docs: [active] })
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('INV-9')
    // The plan's own invoice may still be edited
    expect(splitEligibility({ ...base, total: 800, docs: [active], invoiceId: active.id }).ok).toBe(true)
    // Another customer is fine; a completed or cancelled plan no longer blocks
    expect(splitEligibility({ ...base, total: 800, docs: [active], customerId: 'c2' }).ok).toBe(true)
    expect(splitEligibility({ ...base, total: 800, docs: [{ ...active, status: 'cancelled' }] }).ok).toBe(true)
    const paid = [active, receipt(active, [1, 2, 3], 1200, '2027-01-31')]
    expect(splitEligibility({ ...base, total: 800, docs: paid }).ok).toBe(true)
  })

  it('stops at the maximum number of active plans', () => {
    const docs = ['a', 'b'].map((c) => splitInvoice(500, '2027-01-31', { customerId: c }))
    expect(splitEligibility({ ...base, total: 800, docs, maxActive: 2 }).ok).toBe(false)
    expect(splitEligibility({ ...base, total: 800, docs, maxActive: 3 }).ok).toBe(true)
  })
})

describe('section 7: recording payments', () => {
  it('all 3 payments → plan Completed, with 3 receipts', () => {
    const inv = splitInvoice(1200, '2027-01-31')
    const receipts = [receipt(inv, [1], 480, '2027-01-31'), receipt(inv, [2], 360, '2027-02-27'), receipt(inv, [3], 360, '2027-03-30')]
    let docs: Document[] = [inv]
    expect(splitPlanStatus(inv, docs, '2027-01-31')).toBe('Active')
    for (const r of receipts.slice(0, 2)) docs = [...docs, r]
    expect(splitPlanStatus(inv, docs, '2027-03-01')).toBe('Active')
    docs = [...docs, receipts[2]]
    expect(splitPlanStatus(inv, docs, '2027-03-30')).toBe('Completed')
    const states = splitPaymentStates(inv, docs, '2027-03-30')
    expect(states.map((s) => s.status)).toEqual(['Paid', 'Paid', 'Paid'])
    expect(new Set(states.map((s) => s.receipt!.number)).size).toBe(3)
  })

  it('early settlement pays the rest with one receipt', () => {
    const inv = splitInvoice(1200, '2027-01-31')
    const docs = [inv, receipt(inv, [1], 480, '2027-01-31'), receipt(inv, [2, 3], 720, '2027-02-10')]
    expect(splitPlanStatus(inv, docs, '2027-02-10')).toBe('Completed')
  })

  it('unpaid past the due date is Overdue; the plan is Overdue after 7 days late', () => {
    const inv = splitInvoice(1200, '2027-01-31')
    const docs = [inv, receipt(inv, [1], 480, '2027-01-31')]
    expect(splitPaymentStates(inv, docs, '2027-02-28').map((s) => s.status)).toEqual(['Paid', 'Pending', 'Pending'])
    expect(splitPaymentStates(inv, docs, '2027-03-01')[1].status).toBe('Overdue')
    expect(splitPlanStatus(inv, docs, '2027-03-07')).toBe('Active') // 7 days late
    expect(splitPlanStatus(inv, docs, '2027-03-08')).toBe('Overdue') // 8 days late
  })

  it('a cancelled receipt does not count, and a cancelled invoice cancels the plan', () => {
    const inv = splitInvoice(1200, '2027-01-31')
    expect(splitPaymentStates(inv, [inv, receipt(inv, [1], 480, '2027-01-31', { status: 'cancelled' })], '2027-01-31')[0].status).toBe('Pending')
    expect(splitPlanStatus({ ...inv, status: 'cancelled' }, [inv], '2027-01-31')).toBe('Cancelled')
  })
})

describe('addition: Payment 1 paid on another date', () => {
  it('recalculates Payments 2 and 3 from the actual paid date, keeping the amounts', () => {
    const p = plan(1050, '2027-01-15')
    const moved = rescheduleFromPayment1(p, '2027-01-31')
    expect(moved.payment1Date).toBe('2027-01-31')
    expect(moved.payments.map((x) => x.dueDate)).toEqual(['2027-01-31', '2027-02-28', '2027-03-31'])
    expect(moved.payments.map((x) => x.amount)).toEqual([420, 315, 315])
    // Paid early: dates move earlier too
    expect(rescheduleFromPayment1(p, '2027-01-10').payments.map((x) => x.dueDate)).toEqual(['2027-01-10', '2027-02-10', '2027-03-10'])
    // The original plan is left untouched
    expect(p.payments.map((x) => x.dueDate)).toEqual(['2027-01-15', '2027-02-15', '2027-03-15'])
  })
})

describe('agreement numbers, reminders and the upcoming list', () => {
  it('runs MAL-SP-YYYY-NNN per year', () => {
    expect(nextAgreementNo('2027-03-01', [])).toBe('MAL-SP-2027-001')
    const docs = [doc({ split: plan(500, '2027-01-01', { agreementNo: 'MAL-SP-2027-007' }) }), doc({ split: plan(500, '2026-01-01', { agreementNo: 'MAL-SP-2026-020' }) })]
    expect(nextAgreementNo('2027-03-01', docs)).toBe('MAL-SP-2027-008')
    expect(nextAgreementNo('2028-01-02', docs)).toBe('MAL-SP-2028-001')
  })

  it('writes the Bahasa Malaysia reminder from the template', () => {
    const msg = splitReminderBM({ name: 'Ali', seq: 2, amount: 360, invoiceNo: 'INV-2027-0004', dueDate: '2027-02-28', overdue: false, company: 'MA Legacy Solutions', bank: 'Maybank', accountNo: '5140 1234 5678' })
    expect(msg).toBe(
      [
        'Salam Ali, ini peringatan mesra daripada MA Legacy Solutions.',
        '',
        'Bayaran ke-2 sebanyak RM360.00 untuk invois INV-2027-0004 akan jatuh tempo pada 28/02/2027.',
        '',
        'Akaun: MA Legacy Solutions',
        'Bank: Maybank',
        'No. akaun: 5140 1234 5678',
        'Rujukan: INV-2027-0004',
        '',
        'Sila hantar slip bayaran di sini selepas membuat bayaran. Terima kasih!',
      ].join('\n'),
    )
    expect(splitReminderBM({ name: 'Ali', seq: 2, amount: 360, invoiceNo: 'X', dueDate: '2027-02-28', overdue: true, company: 'C', bank: 'B', accountNo: 'N' })).toContain('telah jatuh tempo pada 28/02/2027')
  })

  it('lists payments due within 7 days and every overdue one, not drafts or paid ones', () => {
    const a = splitInvoice(1200, '2027-01-31', { customerId: 'a' })
    const b = splitInvoice(600, '2027-01-05', { customerId: 'b' })
    const draft = splitInvoice(600, '2027-02-01', { customerId: 'c', status: 'draft' })
    const docs = [a, b, draft, receipt(a, [1], 480, '2027-01-31'), receipt(b, [1], 240, '2027-01-05')]
    const due = duePayments(docs, '2027-02-22')
    // a: P2 due 28 Feb (6 days) · b: P2 due 5 Feb (overdue); b's P3 (5 Mar) is 11 days away
    expect(due.map((d) => [d.invoice.customerId, d.payment.seq, d.payment.status])).toEqual([
      ['b', 2, 'Overdue'],
      ['a', 2, 'Pending'],
    ])
  })
})
