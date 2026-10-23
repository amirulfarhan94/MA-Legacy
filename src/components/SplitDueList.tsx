import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy } from 'lucide-react'
import { formatDate, formatMoney, today } from '../lib/calc'
import { duePayments, splitReminderBM, type DuePayment } from '../lib/split'
import { customerLabel, useStore } from '../lib/store'
import { DOC_META } from '../lib/types'
import { Button, StatusBadge } from './ui'

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // Older browsers or no permission: copy through a hidden text box.
    const t = document.createElement('textarea')
    t.value = text
    t.style.position = 'fixed'
    t.style.opacity = '0'
    document.body.appendChild(t)
    t.select()
    document.execCommand('copy')
    t.remove()
  }
}

/** Split payments due in the next 7 days and every overdue one, with a ready WhatsApp reminder. */
export default function SplitDueList({ empty = 'Nothing due in the next 7 days.' }: { empty?: string }) {
  const documents = useStore((s) => s.documents)
  const due = duePayments(documents, today())
  if (!due.length) return <p className="px-5 py-4 text-sm text-stone-500">{empty}</p>
  return (
    <ul className="divide-y divide-stone-200">
      {due.map((d) => (
        <DueRow key={`${d.invoice.id}-${d.payment.seq}`} due={d} />
      ))}
    </ul>
  )
}

function DueRow({ due: { invoice, payment } }: { due: DuePayment }) {
  const settings = useStore((s) => s.settings)
  const customer = useStore((s) => s.customers.find((c) => c.id === invoice.customerId))
  const [copied, setCopied] = useState(false)
  const overdue = payment.status === 'Overdue'
  const name = invoice.split?.customerName || customer?.name || customerLabel(customer)

  const copy = async () => {
    await copyText(
      splitReminderBM({
        name,
        seq: payment.seq,
        amount: payment.amount,
        invoiceNo: invoice.number,
        dueDate: payment.dueDate,
        overdue,
        company: settings.companyName,
        bank: settings.bankName || '—',
        accountNo: settings.bankAccountNo || '—',
      }),
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 text-sm">
      <div className="min-w-0 flex-1">
        <Link to={`/d/${DOC_META.invoice.path}/${invoice.id}`} className="font-semibold text-stone-900 hover:underline">
          {name}
        </Link>
        <div className="text-xs text-stone-500">
          Payment {payment.seq} of 3 · {invoice.number} · due {formatDate(payment.dueDate)}
          {overdue ? ` · ${payment.daysLate} day${payment.daysLate === 1 ? '' : 's'} late` : payment.daysLate === 0 ? ' · today' : ` · in ${-payment.daysLate} day${payment.daysLate === -1 ? '' : 's'}`}
        </div>
      </div>
      <span className="tabular font-semibold">{formatMoney(payment.amount, settings.currency)}</span>
      <StatusBadge status={overdue ? 'overdue' : 'pending'} />
      <Button size="sm" onClick={copy} aria-live="polite">
        {copied ? <Check size={14} className="text-[var(--good)]" /> : <Copy size={14} />}
        {copied ? 'Copied' : 'Copy WhatsApp reminder'}
      </Button>
    </li>
  )
}
