import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { formatDate, formatMoney } from '../lib/calc'
import { jobCost } from '../lib/jobCosting'
import { useStore } from '../lib/store'
import type { Document } from '../lib/types'
import { buttonClass, Card, CardHeader } from './ui'

/** An invoice's job costing: what the job is worth, the expenses recorded for it, and the profit. */
export default function JobCostCard({ invoice }: { invoice: Document }) {
  const documents = useStore((s) => s.documents)
  const transactions = useStore((s) => s.transactions)
  const currency = useStore((s) => s.settings.currency)
  const { value, costs, profit, margin, expenses } = jobCost(invoice, documents, transactions)
  const money = (n: number) => formatMoney(n, currency)

  return (
    <Card>
      <CardHeader
        title="Job profit"
        subtitle={expenses.length ? `${expenses.length} cost${expenses.length === 1 ? '' : 's'} recorded for this job` : 'Record the materials, transport and other costs for this job to see its profit.'}
        action={
          <Link to={`/transactions?job=${invoice.id}`} className={buttonClass('secondary', 'sm')}>
            <Plus size={14} /> Add cost
          </Link>
        }
      />
      <div className="space-y-2 p-5 text-sm">
        <div className="flex justify-between gap-2">
          <span className="text-stone-500">Job value (before SST)</span>
          <span className="tabular font-medium">{money(value)}</span>
        </div>
        {expenses.map((t) => (
          <div key={t.id} className="flex justify-between gap-2 pl-3 text-stone-600">
            <span className="min-w-0 truncate">
              {formatDate(t.date)} · {t.description || t.category}
            </span>
            <span className="tabular shrink-0">− {money(t.amount)}</span>
          </div>
        ))}
        <div className="flex justify-between gap-2">
          <span className="text-stone-500">Costs</span>
          <span className="tabular font-medium">{money(costs)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-2 border-t border-stone-200 pt-2">
          <span className="font-semibold text-stone-900">Profit</span>
          <span className={`tabular text-base font-bold ${profit < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
            {money(profit)}
            {margin !== null && <span className="ml-1.5 text-xs font-semibold">({Math.round(margin * 100)}%)</span>}
          </span>
        </div>
      </div>
    </Card>
  )
}
