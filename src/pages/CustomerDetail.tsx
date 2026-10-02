import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, Mail, MapPin, Pencil, Phone, Plus, Trash2 } from 'lucide-react'
import { formatDate, formatMoney } from '../lib/calc'
import { contactTotals } from '../lib/finance'
import { contactKind, customerLabel, useCustomer, useStore } from '../lib/store'
import { DOC_META, DOC_TYPES, isPurchaseDoc, type DocType } from '../lib/types'
import CustomerForm from '../components/CustomerForm'
import DocumentTable from '../components/DocumentTable'
import { Button, Card, CardHeader, EmptyState, PageHeader } from '../components/ui'

export default function CustomerDetail() {
  const { id } = useParams()
  const customer = useCustomer(id)
  const documents = useStore((s) => s.documents)
  const transactions = useStore((s) => s.transactions)
  const deleteCustomer = useStore((s) => s.deleteCustomer)
  const currency = useStore((s) => s.settings.currency)
  const [editing, setEditing] = useState(false)
  const [tab, setTab] = useState<DocType | 'all'>('all')
  const nav = useNavigate()

  const docs = useMemo(
    () => documents.filter((d) => d.customerId === id).sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number)),
    [documents, id],
  )

  const kind = contactKind(customer)
  const stats = useMemo(
    () => ({ ...contactTotals(id ?? '', kind, documents, transactions), lastActivity: docs[0]?.date }),
    [id, kind, documents, transactions, docs],
  )

  if (!customer) {
    return (
      <Card>
        <EmptyState title="Contact not found" action={<Link to="/customers" className="text-sm text-gold-700 underline">Back to customers</Link>} />
      </Card>
    )
  }

  const hasLinks = docs.length > 0 || transactions.some((t) => t.customerId === customer.id)
  const shown = tab === 'all' ? docs : docs.filter((d) => d.type === tab)
  const isSupplier = kind === 'supplier'
  const base = isSupplier ? '/suppliers' : '/customers'
  const creatable = DOC_TYPES.filter((t) => isPurchaseDoc(t) === isSupplier)
  const tabs = DOC_TYPES.filter((t) => creatable.includes(t) || docs.some((d) => d.type === t))

  return (
    <>
      <Link to={base} className="mb-3 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
        <ArrowLeft size={15} /> {isSupplier ? 'Suppliers' : 'Customers'}
      </Link>
      <PageHeader
        title={customerLabel(customer)}
        subtitle={customer.company && customer.name ? customer.name : undefined}
        actions={
          <>
            {!isSupplier && (
              <Button onClick={() => nav(`/customers/${customer.id}/statement`)}>
                <FileText size={15} /> Statement
              </Button>
            )}
            <Button onClick={() => setEditing(true)}>
              <Pencil size={15} /> Edit
            </Button>
            <Button
              variant="danger"
              disabled={hasLinks}
              title={hasLinks ? 'Contacts with documents or transactions cannot be deleted' : undefined}
              onClick={() => {
                if (confirm(`Delete ${customerLabel(customer)}?`)) {
                  deleteCustomer(customer.id)
                  nav(base)
                }
              }}
            >
              <Trash2 size={15} /> Delete
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title={isSupplier ? 'Supplier details' : 'Customer details'} />
          <dl className="space-y-3 px-5 py-4 text-sm">
            {customer.phone && (
              <div className="flex gap-2.5">
                <Phone size={15} className="mt-0.5 shrink-0 text-stone-400" />
                <a href={`tel:${customer.phone}`} className="hover:underline">{customer.phone}</a>
              </div>
            )}
            {customer.email && (
              <div className="flex gap-2.5">
                <Mail size={15} className="mt-0.5 shrink-0 text-stone-400" />
                <a href={`mailto:${customer.email}`} className="break-all hover:underline">{customer.email}</a>
              </div>
            )}
            {customer.address && (
              <div className="flex gap-2.5">
                <MapPin size={15} className="mt-0.5 shrink-0 text-stone-400" />
                <span className="whitespace-pre-line">{customer.address}</span>
              </div>
            )}
            {customer.regNo && (
              <div>
                <dt className="text-xs text-stone-500">Registration no.</dt>
                <dd>{customer.regNo}</dd>
              </div>
            )}
            {customer.notes && (
              <div>
                <dt className="text-xs text-stone-500">Notes</dt>
                <dd className="whitespace-pre-line">{customer.notes}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-stone-500">{isSupplier ? 'Supplier since' : 'Customer since'}</dt>
              <dd>{formatDate(customer.createdAt.slice(0, 10))}</dd>
            </div>
          </dl>
          <div className="grid grid-cols-3 border-t border-stone-100 text-center">
            {[
              [isSupplier ? 'Purchases' : 'Billed', stats.billed],
              ['Paid', stats.paid],
              [isSupplier ? 'Unpaid' : 'Outstanding', stats.outstanding],
            ].map(([label, v]) => (
              <div key={label as string} className="px-2 py-3">
                <div className="text-[11px] uppercase tracking-wide text-stone-500">{label}</div>
                <div className="mt-0.5 text-sm font-semibold">{formatMoney(v as number, currency)}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Documents"
            subtitle={stats.lastActivity ? `Last activity ${formatDate(stats.lastActivity)}` : undefined}
          />
          <div className="flex flex-wrap gap-2 border-b border-stone-100 px-5 py-3">
            {creatable.map((t) => (
              <Button key={t} size="sm" onClick={() => nav(`/d/${DOC_META[t].path}/new?customer=${customer.id}`)}>
                <Plus size={14} /> {DOC_META[t].label}
              </Button>
            ))}
          </div>
          <div className="flex gap-1 overflow-x-auto border-b border-stone-100 px-4 pt-2 text-sm">
            {(['all', ...tabs] as const).map((t) => {
              const count = t === 'all' ? docs.length : docs.filter((d) => d.type === t).length
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`whitespace-nowrap border-b-2 px-3 py-2 ${
                    tab === t ? 'border-gold-600 font-medium text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-800'
                  }`}
                >
                  {t === 'all' ? 'All' : DOC_META[t].plural} <span className="text-stone-400">{count}</span>
                </button>
              )
            })}
          </div>
          {shown.length ? (
            <DocumentTable docs={shown} showType showCustomer={false} />
          ) : (
            <EmptyState title="No documents yet" text="Create one using the buttons above." />
          )}
        </Card>
      </div>

      <CustomerForm open={editing} onClose={() => setEditing(false)} customer={customer} />
    </>
  )
}
