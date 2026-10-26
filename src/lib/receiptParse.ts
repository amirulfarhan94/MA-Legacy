/**
 * Reads the useful parts of a shop receipt from OCR text: the total, the date, the shop's name,
 * any SST and a guess at the expense category. OCR on thermal-paper receipts is noisy, so every
 * value is a suggestion the owner checks before saving.
 */

export interface ReceiptGuess {
  total?: number
  /** ISO date (YYYY-MM-DD). */
  date?: string
  vendor?: string
  sst?: number
  category?: string
}

const AMOUNT = /(?:RM\s*)?(\d{1,3}(?:,\d{3})+|\d+)[.,](\d{2})(?!\d)/gi

/** Every money amount on a line, in order (e.g. "TOTAL RM 1,234.50" → [1234.5]). */
export function amountsIn(line: string): number[] {
  const out: number[] = []
  for (const m of line.matchAll(AMOUNT)) out.push(Number(`${m[1].replace(/,/g, '')}.${m[2]}`))
  return out
}

/** Lines that hold the amount paid, best first. */
const TOTAL_WORDS: [RegExp, number][] = [
  [/GRAND\s*TOTAL|JUMLAH\s*BESAR/i, 5],
  [/(NETT?|AMOUNT)\s*(TOTAL|DUE|PAYABLE)|TOTAL\s*(AMOUNT|PAYABLE|DUE|INCL)|JUMLAH\s*(BAYARAN|PERLU)/i, 4],
  [/\bTOTAL\b|\bJUMLAH\b|\bAMOUNT\b/i, 3],
]
/** Lines with "total" in them that are not the amount paid. */
const NOT_TOTAL = /SUB\s*-?\s*TOTAL|TOTAL\s*(QTY|QUANTITY|ITEMS?|DISC|DISCOUNT|SAVINGS?|TAX|SST|GST|EXCL)|CHANGE|BAKI|CASH|TUNAI|TENDER|ROUNDING|PENGGENAPAN|CARD\s*NO|POINTS?/i
const PAYMENT_LINE = /CHANGE|BAKI|CASH|TUNAI|TENDER|PAID|DIBAYAR|ROUNDING/i

function findTotal(lines: string[]): number | undefined {
  let best: { rank: number; amount: number } | undefined
  for (const line of lines) {
    if (NOT_TOTAL.test(line)) continue
    const rank = TOTAL_WORDS.find(([re]) => re.test(line))?.[1]
    if (!rank) continue
    const amount = amountsIn(line).at(-1)
    if (amount === undefined || amount <= 0) continue
    if (!best || rank > best.rank || (rank === best.rank && amount > best.amount)) best = { rank, amount }
  }
  if (best) return best.amount
  // No labelled total: the largest amount that is not cash handed over or change.
  const all = lines.filter((l) => !PAYMENT_LINE.test(l)).flatMap(amountsIn)
  return all.length ? Math.max(...all) : undefined
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, mac: 3, apr: 4, may: 5, mei: 5, jun: 6, jul: 7, aug: 8, ogo: 8, ogos: 8,
  sep: 9, sept: 9, oct: 10, okt: 10, nov: 11, dec: 12, dis: 12,
}
const pad = (n: number) => String(n).padStart(2, '0')
function iso(y: number, m: number, d: number): string | undefined {
  if (y < 100) y += 2000
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return undefined
  return `${y}-${pad(m)}-${pad(d)}`
}

/** The first date on the receipt. Malaysian receipts put the day first (12/10/2026). */
function findDate(text: string): string | undefined {
  const patterns: [RegExp, (m: RegExpMatchArray) => string | undefined][] = [
    [/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/, (m) => iso(+m[1], +m[2], +m[3])],
    [/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|\d{2})\b/, (m) => iso(+m[3], +m[2], +m[1])],
    [/\b(\d{1,2})[\s-]*([A-Za-z]{3,4})[A-Za-z]*[\s,-]*(20\d{2}|\d{2})\b/, (m) => (MONTHS[m[2].toLowerCase()] ? iso(+m[3], MONTHS[m[2].toLowerCase()], +m[1]) : undefined)],
  ]
  for (const [re, toIso] of patterns) {
    for (const m of text.matchAll(new RegExp(re, 'g'))) {
      const d = toIso(m)
      if (d) return d
    }
  }
  return undefined
}

/** Header lines that are not the shop's name. */
const NOT_VENDOR = /TAX\s*INVOICE|INVOIS|RECEIPT|RESIT|INVOICE|WELCOME|SELAMAT|^\W*(TEL|FAX|NO\b|GST|SST|REG|ROC|CO\.?\s*NO)|@|WWW\.|HTTP/i

/** The shop's name: the first line near the top that reads like a name. */
function findVendor(lines: string[]): string | undefined {
  for (const line of lines.slice(0, 6)) {
    const letters = line.replace(/[^A-Za-z]/g, '').length
    if (letters < 3 || letters < line.replace(/\s/g, '').length * 0.6 || NOT_VENDOR.test(line)) continue
    return line.replace(/\s{2,}/g, ' ').replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9.)]+$/g, '').slice(0, 60)
  }
  return undefined
}

function findSst(lines: string[]): number | undefined {
  for (const line of lines) {
    if (!/\b(SST|SERVICE\s*TAX|SALES\s*TAX|CUKAI)\b/i.test(line) || /REG|NO\.?\s*:|ID\b/i.test(line)) continue
    const amount = amountsIn(line).at(-1)
    if (amount !== undefined && amount > 0) return amount
  }
  return undefined
}

/** Expense categories, matched to words that show up on Malaysian receipts. */
const CATEGORY_WORDS: [string, RegExp][] = [
  ['Transport', /PETRONAS|PETRON|SHELL|CALTEX|BHP|PETROL|DIESEL|RON\s*9[57]|TOLL|PLUS\b|PARKING|LETAK\s*KERETA|GRAB/i],
  ['Utilities', /TENAGA\s*NASIONAL|\bTNB\b|AIR\s*SELANGOR|SYABAS|INDAH\s*WATER|UNIFI|TELEKOM|MAXIS|CELCOM|DIGI|\bU\s*MOBILE|TIME\s*DOTCOM/i],
  ['Materials', /HARDWARE|ELECTRICAL|ELEKTRIK|CABLE|KABEL|WIRE|WAYAR|CONDUIT|SOCKET|SOKET|BREAKER|MCB|RCCB|PVC|CEMENT|SIMEN|PAINT|CAT\b|PIPE|PAIP/i],
  ['Equipment', /TOOLS?\b|ALATAN|DRILL|BOSCH|MAKITA|MULTIMETER|LADDER|TANGGA/i],
]

export function guessCategory(text: string): string | undefined {
  return CATEGORY_WORDS.find(([, re]) => re.test(text))?.[0]
}

export function parseReceiptText(text: string): ReceiptGuess {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  return {
    total: findTotal(lines),
    date: findDate(text),
    vendor: findVendor(lines),
    sst: findSst(lines),
    category: guessCategory(text),
  }
}
