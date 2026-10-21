import { displayStatus, docTotals, formatDate, invoiceCredited, invoicePaid, isIssuedCredit, round2 } from './calc'
import { cashMovements, isOpenInvoice } from './finance'
import { PAYMENT_METHODS, type Customer, type Document, type Transaction } from './types'

/**
 * The accounts for a period as spreadsheet tabs, for the accountant: a summary, sales
 * invoices, credit notes, money in, expenses and (when charged) SST by month.
 */

export type ExportCell = string | number | { date: string } | null
export interface ExportSheet {
  name: string
  /** Column widths in characters. */
  widths: number[]
  header: string[]
  rows: ExportCell[][]
  /** Column indexes holding money. */
  money: number[]
  /** Last row shown in bold (a total). */
  totalRow?: boolean
}

interface Input {
  documents: Document[]
  transactions: Transaction[]
  customers: Customer[]
  companyName: string
  taxLabel: string
  from: string
  to: string
}

const inPeriod = (date: string, from: string, to: string) => date >= from && date <= to
const sum = (ns: number[]) => round2(ns.reduce((s, n) => s + n, 0))
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function accountsSheets({ documents, transactions, customers, companyName, taxLabel, from, to }: Input): ExportSheet[] {
  const name = new Map(customers.map((c) => [c.id, c.company || c.name]))
  const regNo = new Map(customers.map((c) => [c.id, c.regNo]))
  const party = (id?: string) => (id && name.get(id)) || ''
  const byDate = (a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date)

  const invoices = documents.filter((d) => isOpenInvoice(d) && inPeriod(d.date, from, to)).sort(byDate)
  const credits = documents.filter((d) => isIssuedCredit(d) && inPeriod(d.date, from, to)).sort(byDate)
  const moves = cashMovements(documents, transactions)
    .filter((m) => inPeriod(m.date, from, to))
    .sort(byDate)
  const moneyIn = moves.filter((m) => m.amount >= 0 || m.category === 'Refund')
  const expenses = moves.filter((m) => m.amount < 0 && m.category !== 'Refund')

  const sales = invoices.map((d) => {
    const t = docTotals(d)
    const paid = invoicePaid(d.id, documents)
    const credited = invoiceCredited(d.id, documents)
    return { d, t, paid, credited, balance: round2(Math.max(0, t.total - paid - credited)) }
  })
  const creditRows = credits.map((d) => ({ d, t: docTotals(d) }))

  const salesSheet: ExportSheet = {
    name: 'Sales',
    widths: [12, 16, 32, 16, 13, 11, 11, 13, 13, 12, 13, 11, 12],
    header: ['Date', 'Invoice no.', 'Customer', 'Customer reg. no.', 'Subtotal', 'Discount', taxLabel, 'Total', 'Paid to date', 'Credited', 'Balance', 'Status', 'Due date'],
    money: [4, 5, 6, 7, 8, 9, 10],
    rows: sales.map(({ d, t, paid, credited, balance }) => [
      { date: d.date },
      d.number,
      party(d.customerId),
      regNo.get(d.customerId) || '',
      t.subtotal,
      t.discount,
      t.tax,
      t.total,
      paid,
      credited,
      balance,
      capitalize(displayStatus(d, documents)),
      d.dueDate ? { date: d.dueDate } : null,
    ]),
  }
  if (sales.length) {
    salesSheet.totalRow = true
    salesSheet.rows.push([
      'Total',
      null,
      null,
      null,
      sum(sales.map((s) => s.t.subtotal)),
      sum(sales.map((s) => s.t.discount)),
      sum(sales.map((s) => s.t.tax)),
      sum(sales.map((s) => s.t.total)),
      sum(sales.map((s) => s.paid)),
      sum(sales.map((s) => s.credited)),
      sum(sales.map((s) => s.balance)),
      null,
      null,
    ])
  }

  const creditSheet: ExportSheet = {
    name: 'Credit notes',
    widths: [12, 16, 32, 16, 36, 13, 11, 13],
    header: ['Date', 'Credit note no.', 'Customer', 'Invoice', 'Reason', 'Total', taxLabel, 'Refunded'],
    money: [5, 6, 7],
    rows: creditRows.map(({ d, t }) => [{ date: d.date }, d.number, party(d.customerId), d.reference, d.notes, t.total, t.tax, Number(d.refundAmount) || 0]),
  }

  const inSheet: ExportSheet = {
    name: 'Money in',
    widths: [12, 14, 40, 30, 16, 18, 13],
    header: ['Date', 'Type', 'Details', 'Customer', 'Method', 'Reference', 'Amount'],
    money: [6],
    rows: moneyIn.map((m) => [
      { date: m.date },
      m.docId ? m.category : `Income · ${m.category}`,
      m.description,
      party(m.customerId),
      PAYMENT_METHODS[m.method] ?? m.method,
      m.reference,
      m.amount,
    ]),
  }
  if (moneyIn.length) {
    inSheet.totalRow = true
    inSheet.rows.push(['Total', null, null, null, null, null, sum(moneyIn.map((m) => m.amount))])
  }

  const outSheet: ExportSheet = {
    name: 'Expenses',
    widths: [12, 20, 40, 30, 16, 18, 13],
    header: ['Date', 'Category', 'Description', 'Supplier / payee', 'Method', 'Reference', 'Amount'],
    money: [6],
    rows: expenses.map((m) => [{ date: m.date }, m.category, m.description, party(m.customerId), PAYMENT_METHODS[m.method] ?? m.method, m.reference, -m.amount]),
  }
  if (expenses.length) {
    outSheet.totalRow = true
    outSheet.rows.push(['Total', null, null, null, null, null, sum(expenses.map((m) => -m.amount))])
  }

  const salesTotal = sum(sales.map((s) => s.t.total))
  const creditTotal = sum(creditRows.map((c) => c.t.total))
  const taxCharged = sum(sales.map((s) => s.t.tax))
  const taxCredited = sum(creditRows.map((c) => c.t.tax))
  const received = sum(moneyIn.filter((m) => m.amount >= 0).map((m) => m.amount))
  const refunds = sum(moneyIn.filter((m) => m.amount < 0).map((m) => -m.amount))
  const spent = sum(expenses.map((m) => -m.amount))

  const summary: ExportSheet = {
    name: 'Summary',
    widths: [40, 16],
    header: [`${companyName} — accounts`, ''],
    money: [1],
    rows: [
      ['Period', `${formatDate(from)} – ${formatDate(to)}`],
      [null, null],
      ['Sales invoiced', salesTotal],
      ['Less credit notes', -creditTotal],
      ['Net sales', round2(salesTotal - creditTotal)],
      [`${taxLabel} charged on invoices`, taxCharged],
      [`${taxLabel} reversed by credit notes`, -taxCredited],
      [`Net ${taxLabel}`, round2(taxCharged - taxCredited)],
      [null, null],
      ['Money received', received],
      ['Refunds paid', -refunds],
      ['Expenses paid', -spent],
      ['Net cash', round2(received - refunds - spent)],
      [null, null],
      ['Unpaid on these invoices (today)', sum(sales.map((s) => s.balance))],
    ],
  }

  const sheets = [summary, salesSheet, creditSheet, inSheet, outSheet]

  if (taxCharged || taxCredited) {
    const months = new Map<string, { base: number; tax: number; credited: number }>()
    const at = (date: string) => {
      const k = date.slice(0, 7)
      if (!months.has(k)) months.set(k, { base: 0, tax: 0, credited: 0 })
      return months.get(k)!
    }
    for (const s of sales) {
      const m = at(s.d.date)
      m.base += s.t.taxLines.reduce((a, l) => a + l.base, 0)
      m.tax += s.t.tax
    }
    for (const c of creditRows) at(c.d.date).credited += c.t.tax
    sheets.push({
      name: taxLabel,
      widths: [12, 16, taxLabel.length + 12, taxLabel.length + 14, 13],
      header: ['Month', 'Taxable sales', `${taxLabel} charged`, `${taxLabel} credited`, `Net ${taxLabel}`],
      money: [1, 2, 3, 4],
      rows: [...months.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, m]) => [month, round2(m.base), round2(m.tax), round2(m.credited), round2(m.tax - m.credited)]),
    })
  }
  return sheets
}

/** The sheets as an .xlsx file. */
export async function accountsWorkbook(sheets: ExportSheet[], fileName: string): Promise<File> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const bold = { fontWeight: 'bold' as const }
  const toCell = (sheet: ExportSheet, c: ExportCell, col: number, isTotal: boolean) => {
    const style = isTotal ? bold : {}
    if (c === null) return null
    if (typeof c === 'object') {
      const [y, m, d] = c.date.split('-').map(Number)
      return { value: new Date(Date.UTC(y, m - 1, d)), type: Date, format: 'dd/mm/yyyy', ...style }
    }
    if (typeof c === 'number') return { value: c, type: Number, format: sheet.money.includes(col) ? '#,##0.00' : '0', ...style }
    return { value: c, type: String, ...style }
  }
  const data = sheets.map((s) => ({
    sheet: s.name,
    columns: s.widths.map((width) => ({ width })),
    stickyRowsCount: 1,
    data: [
      s.header.map((h) => ({ value: h, type: String, fontWeight: 'bold' as const, backgroundColor: '#F1EDE4' })),
      ...s.rows.map((r, i) => r.map((c, col) => toCell(s, c, col, !!s.totalRow && i === s.rows.length - 1))),
    ],
  }))
  // The library's typings expect one shape per call; the data above matches its documented cells.
  const blob = await writeXlsxFile(data as never).toBlob()
  return new File([blob], fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
