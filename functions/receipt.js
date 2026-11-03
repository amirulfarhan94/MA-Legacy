import { z } from 'zod'

/**
 * How Claude reads a shop receipt for the expense form: the schema it answers in, the
 * instructions, and the checks on what comes back. Kept apart from index.js so it can be tested
 * without Firebase.
 */

export const MODEL = 'claude-haiku-5-5'

/** Images the function accepts, and the largest one (base64 characters, about 3 MB of picture). */
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_IMAGE_CHARS = 4_000_000

export const ReceiptSchema = z.object({
  total: z.number().nullable().describe('Amount paid in RM: the grand total after rounding, including SST. Null if not readable.'),
  date: z.string().nullable().describe('Date of purchase as YYYY-MM-DD. Null if not readable.'),
  vendor: z.string().nullable().describe("Shop or company name as printed at the top of the receipt. Null if not readable."),
  sst: z.number().nullable().describe('SST or service tax amount in RM, if the receipt shows one, else null.'),
  category: z.string().nullable().describe('One of the given expense categories, or null if none fits.'),
  items: z
    .array(z.object({ description: z.string(), amount: z.number().nullable() }))
    .describe('Line items as printed (short description and line amount in RM), at most 20.'),
})

export function instructions(categories) {
  return [
    'You read photos of Malaysian shop receipts, bills and invoices for the expense records of a small electrical and building maintenance business.',
    'Read only what is printed. Do not guess numbers you cannot see; use null instead.',
    'total: the amount actually paid (grand total / jumlah / nett total after rounding), not the subtotal, cash tendered or change.',
    'date: the purchase date. Malaysian receipts write the day first (12/10/2026 is 12 October 2026).',
    'vendor: the shop name only, without the company number, address or "Sdn Bhd" line breaks.',
    `category: pick the closest of: ${categories.join(', ')}. Petrol, toll and parking are Transport; electricity, water, phone and internet bills are Utilities; cables, breakers, sockets, pipes and paint are Materials; tools are Equipment.`,
    'If the photo is not a receipt or nothing can be read, return nulls and an empty item list.',
  ].join('\n')
}

const ISO = /^\d{4}-\d{2}-\d{2}$/
const money = (n) => (typeof n === 'number' && Number.isFinite(n) && n > 0 && n < 10_000_000 ? Math.round(n * 100) / 100 : undefined)

/** Keeps only values the expense form can use as they are. */
export function cleanReading(r, categories) {
  const date = r.date && ISO.test(r.date) && !Number.isNaN(Date.parse(r.date)) ? r.date : undefined
  return {
    total: money(r.total),
    date,
    vendor: r.vendor?.trim().slice(0, 60) || undefined,
    sst: money(r.sst),
    category: r.category && categories.includes(r.category) ? r.category : undefined,
    items: (r.items ?? [])
      .slice(0, 20)
      .map((i) => ({ description: String(i.description).trim().slice(0, 80), amount: money(i.amount) }))
      .filter((i) => i.description),
  }
}

/** The categories the app sent: short strings, at most 20, else none. */
export function checkCategories(value) {
  if (!Array.isArray(value) || value.length > 20) return []
  return value.filter((c) => typeof c === 'string' && c.length > 0 && c.length <= 40)
}
