import { describe, expect, it } from 'vitest'
import { canAskForReview, reviewMessage } from './review'
import type { Customer, Document } from './types'

const doc = (over: Partial<Document>) => ({ type: 'invoice', status: 'sent', ...over }) as Document

describe('canAskForReview', () => {
  it('asks once the job is done and paid', () => {
    expect(canAskForReview(doc({}), 'paid')).toBe(true)
    expect(canAskForReview(doc({}), 'partial')).toBe(false)
    expect(canAskForReview(doc({ status: 'cancelled' }), 'paid')).toBe(false)
    expect(canAskForReview(doc({ type: 'service_report', status: 'completed' }), 'completed')).toBe(true)
    expect(canAskForReview(doc({ type: 'service_report', status: 'draft' }), 'draft')).toBe(false)
    expect(canAskForReview(doc({ type: 'receipt', status: 'completed' }), 'completed')).toBe(true)
    expect(canAskForReview(doc({ type: 'quotation', status: 'accepted' }), 'accepted')).toBe(false)
  })
})

describe('reviewMessage', () => {
  it('greets the contact by name and carries the link', () => {
    const m = reviewMessage('https://g.page/r/x/review', { name: 'Encik Hafiz' } as Customer)
    expect(m.split('\n')[0]).toBe('Salam Encik Hafiz, terima kasih kerana menggunakan servis HandalServ 🙏')
    expect(m).toContain('\nhttps://g.page/r/x/review\n')
  })

  it('works without a contact name', () => {
    expect(reviewMessage('L', { name: ' ' } as Customer).startsWith('Terima kasih kerana')).toBe(true)
  })
})
