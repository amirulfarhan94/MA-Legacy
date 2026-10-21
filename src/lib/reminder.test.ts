import { describe, expect, it } from 'vitest'
import { reminderMessage, shouldMarkSent } from './reminder'
import type { Document } from './types'

const base = { name: 'Puan Aisyah', number: 'INV-2026-0006', date: '2026-08-02', balance: 1055.2, currency: 'RM', company: 'MA Legacy Solutions' }

describe('payment reminder', () => {
  it('says how late an overdue invoice is, with the balance and bank details', () => {
    const msg = reminderMessage({ ...base, dueDate: '2026-08-16', today: '2026-10-21', bank: { name: 'Maybank', accountNo: '5140 1234 5678', accountName: 'MA Legacy Solutions' } })
    expect(msg).toBe(
      [
        'Hi Puan Aisyah,',
        '',
        'This is a friendly reminder that invoice INV-2026-0006 dated 02 Aug 2026 was due on 16 Aug 2026 (66 days ago).',
        'Balance due: RM 1,055.20',
        'Payment to: Maybank · 5140 1234 5678 · MA Legacy Solutions',
        '',
        "If you've already paid, please ignore this message. Thank you!",
        '— MA Legacy Solutions',
      ].join('\n'),
    )
  })

  it('words invoices due today, soon, or without a due date', () => {
    expect(reminderMessage({ ...base, dueDate: '2026-10-21', today: '2026-10-21' })).toContain('is due today.')
    expect(reminderMessage({ ...base, dueDate: '2026-10-22', today: '2026-10-21' })).toContain('is due on 22 Oct 2026 (in 1 day).')
    expect(reminderMessage({ ...base, dueDate: '', today: '2026-10-21' })).toContain('is still unpaid.')
    expect(reminderMessage({ ...base, dueDate: '', today: '2026-10-21' })).not.toContain('Payment to')
  })
})

describe('marking documents as sent', () => {
  const d = (type: Document['type'], status: Document['status']) => ({ type, status }) as Document
  it('moves drafts that have a "sent" status, and nothing else', () => {
    expect(shouldMarkSent(d('invoice', 'draft'))).toBe(true)
    expect(shouldMarkSent(d('quotation', 'draft'))).toBe(true)
    expect(shouldMarkSent(d('purchase_order', 'draft'))).toBe(true)
    expect(shouldMarkSent(d('invoice', 'sent'))).toBe(false)
    expect(shouldMarkSent(d('quotation', 'accepted'))).toBe(false)
    expect(shouldMarkSent(d('delivery_order', 'draft'))).toBe(false)
    expect(shouldMarkSent(d('service_report', 'draft'))).toBe(false)
  })
})
