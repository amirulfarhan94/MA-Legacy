import { BRAND } from './brand'
import { formatDate } from './calc'
import { waHref } from './contact'
import type { Document, DocType } from './types'

/** Documents whose More menu prints stickers for that job. */
export const STICKER_TYPES: DocType[] = ['service_report', 'invoice', 'delivery_order']

/**
 * HandalServ stickers to leave on the job (inside the DB box door, by the water heater): logo,
 * 24/7 line, WhatsApp number and a QR code that opens WhatsApp with a message ready to send. A
 * sticker for a job also carries its date and document number, so the message says which job.
 */

/** A4 sheet of 21 labels, 3 × 7, 63.5 × 38.1 mm (the common layout, e.g. Avery L7160). All in mm. */
export const SHEET = { cols: 3, rows: 7, width: 63.5, height: 38.1, top: 15.15, left: 7.25, colPitch: 66, rowPitch: 38.1 }
export const PER_SHEET = SHEET.cols * SHEET.rows

export interface StickerInfo {
  /** "Diservis 04 Nov 2026 · SR/26/1101", or a general line on stickers not for one job. */
  footer: string
  /** WhatsApp link the QR code opens. */
  link: string
}

export function stickerInfo(doc?: Document): StickerInfo {
  const ref = doc ? doc.number : ''
  const text = `Salam ${BRAND.name}, saya perlukan servis.${ref ? ` (Sticker ${ref})` : ''}`
  return {
    footer: doc ? `Diservis ${formatDate(doc.date)} · ${doc.number}` : `Servis Pro, Kerja Handal · ${BRAND.site}`,
    link: waHref(BRAND.whatsapp, text),
  }
}

/** Where label n (0-based) sits on the sheet, in mm from the top left. */
export function labelPosition(n: number): { top: number; left: number } {
  const row = Math.floor(n / SHEET.cols)
  const col = n % SHEET.cols
  return { top: SHEET.top + row * SHEET.rowPitch, left: SHEET.left + col * SHEET.colPitch }
}
