import { Link } from 'react-router-dom'
import { CalendarClock } from 'lucide-react'
import { formatDate, formatMoney, invoicePaid, today } from '../lib/calc'
import { activeSplitPlans, splitPaymentStates, splitPlanStatus } from '../lib/split'
import { customerLabel, useStore } from '../lib/store'
import { DOC_META } from '../lib/types'
import SplitDueList from '../components/SplitDueList'
import { Card, CardHeader, EmptyState, PageHeader, StatusBadge, tableCls } from '../components/ui'

/** Every split payment (3×) plan, with the payments coming up. */
export default function SplitPlans() {
  const documents = useStore((s) => s.documents)
  const customers = useStore((s) => s.customers)
  const settings = useStore((s) => s.settings)
  const t = today()
  const plans = documents.filter((d) => d.type === 'invoice' && d.split).sort((a, b) => b.date.localeCompare(a.date))
  const active = activeSplitPlans(documents, t).length

  return (
    <>
      <PageHeader title="Split plans" subtitle={`Split payment (3×) · ${active} of ${settings.maxActiveSplitPlans} active plans in use`} />
      <Card className="mb-5">
        <CardHeader title="Due in the next 7 days and overdue" />
        <SplitDueList />
      </Card>
      <Card>
        <CardHeader title="All plans" />
        {plans.length === 0 ? (
          <EmptyState icon={<CalendarClock size={22} />} title="No split plans yet" text="Turn on “Split payment (3×)” on an invoice of RM300–RM1,500." />
        ) : (
          <div className="overflow-x-auto">
            <table className={tableCls.table}>
              <thead>
                <tr>
                  <th className={tableCls.th}>Agreement</th>
                  <th className={tableCls.th}>Customer</th>
                  <th className={tableCls.th}>Invoice</th>
                  <th className={`${tableCls.th} text-right`}>Total</th>
                  <th className={`${tableCls.th} text-right`}>Paid</th>
                  <th className={tableCls.th}>Next payment</th>
                  <th className={tableCls.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((inv) => {
                  const plan = inv.split!
                  const status = splitPlanStatus(inv, documents, t)
                  const next = splitPaymentStates(inv, documents, t).find((p) => p.status !== 'Paid')
                  const total = plan.payments.reduce((s, p) => s + p.amount, 0)
                  return (
                    <tr key={inv.id}>
                      <td className={tableCls.td}>
                        <Link to={`/d/${DOC_META.invoice.path}/${inv.id}/agreement`} className="font-semibold text-gold-700 hover:underline">
                          {plan.agreementNo}
                        </Link>
                      </td>
                      <td className={tableCls.td}>{plan.customerName || customerLabel(customers.find((c) => c.id === inv.customerId))}</td>
                      <td className={tableCls.td}>
                        <Link to={`/d/${DOC_META.invoice.path}/${inv.id}`} className="hover:underline">
                          {inv.number}
                        </Link>
                      </td>
                      <td className={`${tableCls.td} tabular text-right`}>{formatMoney(total, settings.currency)}</td>
                      <td className={`${tableCls.td} tabular text-right`}>{formatMoney(invoicePaid(inv.id, documents), settings.currency)}</td>
                      <td className={tableCls.td}>
                        {next && (status === 'Active' || status === 'Overdue') ? `Payment ${next.seq} · ${formatDate(next.dueDate)}` : '—'}
                      </td>
                      <td className={tableCls.td}>
                        <StatusBadge status={status.toLowerCase()} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
