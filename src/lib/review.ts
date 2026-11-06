import { BRAND } from './brand'
import type { Customer, Document } from './types'

/**
 * Asking a happy customer for a Google review on WhatsApp, once the job is done: a paid invoice,
 * a completed or signed service report, or a receipt. Google's rules: ask every customer the
 * same way, never offer anything in return, never ask only for five stars.
 */
export function canAskForReview(doc: Document, status: string): boolean {
  if (doc.status === 'cancelled' || doc.status === 'draft') return false
  if (doc.type === 'invoice') return status === 'paid'
  if (doc.type === 'service_report') return doc.status === 'completed' || !!doc.customerSign
  return doc.type === 'receipt'
}

export function reviewMessage(link: string, customer?: Customer): string {
  const name = customer?.name.trim()
  return [
    `${name ? `Salam ${name}, terima kasih` : 'Terima kasih'} kerana menggunakan servis ${BRAND.name} 🙏`,
    'Kalau puas hati dengan kerja kami, boleh bantu tinggalkan review ringkas di Google? Hanya ambil 1 minit:',
    link,
    'Review anda sangat membantu bisnes kecil seperti kami. Terima kasih!',
  ].join('\n')
}
