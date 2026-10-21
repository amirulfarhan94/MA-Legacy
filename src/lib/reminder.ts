import { formatDate, formatMoney } from './calc'
import { daysBetween } from './finance'
import { STATUS_OPTIONS, type Document } from './types'

/** A draft that has just gone to the customer (shared or sent on WhatsApp) becomes "sent". */
export const shouldMarkSent = (d: Document) => d.status === 'draft' && STATUS_OPTIONS[d.type].includes('sent')

export interface ReminderInput {
  name: string
  number: string
  date: string
  dueDate: string
  balance: number
  currency: string
  company: string
  bank?: { name: string; accountNo: string; accountName: string }
  today: string
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Polite payment reminder for an unpaid invoice, for WhatsApp. */
export function reminderMessage(r: ReminderInput): string {
  const due = r.dueDate
  const late = due ? daysBetween(due, r.today) : 0
  const when = !due
    ? 'is still unpaid'
    : late > 0
      ? `was due on ${formatDate(due)} (${plural(late, 'day')} ago)`
      : late === 0
        ? 'is due today'
        : `is due on ${formatDate(due)} (in ${plural(-late, 'day')})`
  const lines = [
    `Hi ${r.name},`,
    '',
    `This is a friendly reminder that invoice ${r.number} dated ${formatDate(r.date)} ${when}.`,
    `Balance due: ${formatMoney(r.balance, r.currency)}`,
  ]
  if (r.bank?.accountNo) lines.push(`Payment to: ${[r.bank.name, r.bank.accountNo, r.bank.accountName].filter(Boolean).join(' · ')}`)
  lines.push('', "If you've already paid, please ignore this message. Thank you!", `— ${r.company}`)
  return lines.join('\n')
}
