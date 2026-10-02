import { useNavigate } from 'react-router-dom'
import { displayStatus, docAmount, formatDate, formatMoney } from '../lib/calc'
import { customerLabel, useStore } from '../lib/store'
import { DOC_META, type Document } from '../lib/types'
import { StatusBadge, tableCls } from './ui'

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

  return (
    <div className="overflow-x-auto">
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
          {docs.map((d) => {
            const c = customers.find((x) => x.id === d.customerId)
            return (
              <tr key={d.id} className={tableCls.tr} onClick={() => nav(`/d/${DOC_META[d.type].path}/${d.id}`)}>
                <td className={`${tableCls.td} whitespace-nowrap font-medium text-stone-900`}>{d.number}</td>
                {showType && <td className={`${tableCls.td} text-stone-600`}>{DOC_META[d.type].label}</td>}
                {showCustomer && <td className={tableCls.td}>{customerLabel(c)}</td>}
                <td className={`${tableCls.td} tabular whitespace-nowrap text-stone-600`}>{formatDate(d.date)}</td>
                <td className={tableCls.td}>
                  <StatusBadge status={displayStatus(d, all)} />
                </td>
                <td className={`${tableCls.td} tabular whitespace-nowrap text-right`}>
                  {d.type === 'service_report' || d.type === 'delivery_order' ? '—' : formatMoney(docAmount(d), currency)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
