import { Link, useNavigate } from 'react-router-dom'
import { displayStatus, docAmount, formatDate, formatMoney, today } from '../lib/calc'
import { daysBetween } from '../lib/finance'
import { customerLabel, useStore } from '../lib/store'
import { DOC_META, type Document } from '../lib/types'
import { DOC_ICON } from './nav'
import { StatusBadge, tableCls } from './ui'

const overdueText = (days: number) => `${days} day${days === 1 ? '' : 's'} overdue`

/** Documents as cards when the space is narrow (phones, side columns) and as a table when it is wide. */
export default function DocumentTable({
  docs,
  showType = false,
  showCustomer = true,
}: {
  docs: Document[]
  showType?: boolean
  showCustomer?: boolean
}) {
  const nav = useNavigate()
  const customers = useStore((s) => s.customers)
  const all = useStore((s) => s.documents)
  const currency = useStore((s) => s.settings.currency)
  const asOf = today()

  const rows = docs.map((d) => {
    const status = displayStatus(d, all)
    return {
      d,
      status,
      href: `/d/${DOC_META[d.type].path}/${d.id}`,
      customer: customerLabel(customers.find((x) => x.id === d.customerId)),
      amount: d.type === 'service_report' || d.type === 'delivery_order' ? '—' : formatMoney(docAmount(d), currency),
      overdue: status === 'overdue' ? daysBetween(d.dueDate || d.date, asOf) : 0,
    }
  })

  return (
    <div className="@container">
      <ul className="divide-y divide-stone-200 @min-[560px]:hidden">
        {rows.map(({ d, status, href, customer, amount, overdue }) => {
          const Icon = DOC_ICON[d.type]
          return (
            <li key={d.id}>
              <Link to={href} className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--item-hover)] active:bg-[var(--item-hover)]">
                <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-gold-400/15 text-gold-700">
                  <Icon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-bold text-stone-900">{d.number}</span>
                    <span className="tabular shrink-0 text-sm font-bold text-stone-900">{amount}</span>
                  </span>
                  {showCustomer && <span className="mt-0.5 block truncate text-[13px] text-stone-600">{customer}</span>}
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">
                    {showType && <span>{DOC_META[d.type].label}</span>}
                    <span className="tabular">{formatDate(d.date)}</span>
                    <StatusBadge status={status} />
                    {overdue > 0 && <span className="font-semibold text-red-700">{overdueText(overdue)}</span>}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>

      <div className="hidden overflow-x-auto @min-[560px]:block">
        <table className={tableCls.table}>
          <thead>
            <tr>
              <th className={tableCls.th}>Number</th>
              {showType && <th className={tableCls.th}>Type</th>}
              {showCustomer && <th className={tableCls.th}>Customer</th>}
              <th className={tableCls.th}>Date</th>
              <th className={tableCls.th}>Status</th>
              <th className={`${tableCls.th} text-right`}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ d, status, href, customer, amount, overdue }) => (
              <tr key={d.id} className={tableCls.tr} onClick={() => nav(href)}>
                <td className={`${tableCls.td} whitespace-nowrap font-semibold text-stone-900`}>
                  <Link to={href} onClick={(e) => e.stopPropagation()} className="hover:underline">
                    {d.number}
                  </Link>
                </td>
                {showType && <td className={`${tableCls.td} text-stone-600`}>{DOC_META[d.type].label}</td>}
                {showCustomer && <td className={tableCls.td}>{customer}</td>}
                <td className={`${tableCls.td} tabular whitespace-nowrap text-stone-600`}>{formatDate(d.date)}</td>
                <td className={tableCls.td}>
                  <StatusBadge status={status} />
                  {overdue > 0 && <div className="mt-1 whitespace-nowrap text-xs font-semibold text-red-700">{overdueText(overdue)}</div>}
                </td>
                <td className={`${tableCls.td} tabular whitespace-nowrap text-right`}>{amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
