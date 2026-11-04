import { docTotals, isIssuedCredit, round2 } from './calc'
import type { Document, Transaction } from './types'

/**
 * Profit per job: an invoice is the job, and expenses recorded "for" it (Transaction.jobId) are
 * its costs. The job's value leaves out SST (collected for the government, not earned) and
 * takes off issued credit notes against the invoice.
 */
export interface JobCost {
  /** Invoice before SST, less credit notes. */
  value: number
  costs: number
  profit: number
  /** Profit as a share of the value (0.25 = 25%); null when the value is 0. */
  margin: number | null
  expenses: Transaction[]
}

const beforeTax = (d: Document) => {
  const t = docTotals(d)
  return round2(t.total - t.tax)
}

export function jobCost(invoice: Document, docs: Document[], transactions: Transaction[]): JobCost {
  const credits = docs.filter((d) => isIssuedCredit(d) && d.invoiceId === invoice.id).reduce((s, d) => s + beforeTax(d), 0)
  const value = round2(beforeTax(invoice) - credits)
  const expenses = transactions.filter((t) => t.kind === 'expense' && t.jobId === invoice.id).sort((a, b) => a.date.localeCompare(b.date))
  const costs = round2(expenses.reduce((s, t) => s + t.amount, 0))
  const profit = round2(value - costs)
  return { value, costs, profit, margin: value > 0 ? profit / value : null, expenses }
}

/** Every job in a year (by invoice date) that has costs recorded, lowest margin first. */
export function jobCostsForYear(year: string, docs: Document[], transactions: Transaction[]): { invoice: Document; cost: JobCost }[] {
  const withCosts = new Set(transactions.filter((t) => t.kind === 'expense' && t.jobId).map((t) => t.jobId))
  return docs
    .filter((d) => d.type === 'invoice' && d.status !== 'cancelled' && d.date.startsWith(year) && withCosts.has(d.id))
    .map((invoice) => ({ invoice, cost: jobCost(invoice, docs, transactions) }))
    .sort((a, b) => (a.cost.margin ?? -Infinity) - (b.cost.margin ?? -Infinity))
}
