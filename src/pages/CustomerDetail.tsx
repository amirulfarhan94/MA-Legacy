import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, Mail, MapPin, Pencil, Phone, Plus, Trash2 } from 'lucide-react'
import ContactActions, { Avatar } from '../components/ContactActions'
import CreateSheet from '../components/CreateSheet'
import { formatDate } from '../lib/calc'
import { contactTotals } from '../lib/finance'
import { contactKind, customerLabel, useCustomer, useStore } from '../lib/store'
import { DOC_META, DOC_TYPES, isPurchaseDoc, type DocType } from '../lib/types'
import CustomerForm from '../components/CustomerForm'
import DocumentTable from '../components/DocumentTable'
import { Button, Card, CardHeader, ChipGroup, EmptyState, MetricStrip, PageHeader } from '../components/ui'

export default function CustomerDetail() {
  const { id } = useParams()
  const customer = useCustomer(id)
  const documents = useStore((s) => s.documents)
  const transactions = useStore((s) => s.transactions)
  const deleteCustomer = useStore((s) => s.deleteCustomer)
  const currency = useStore((s) => s.settings.currency)
  const [editing, setEditing] = useState(false)
  const [tab, setTab] = useState<DocType | 'all'>('all')
  const [creating, setCreating] = useState(false)
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
  const tabs = DOC_TYPES.filter((t) => docs.some((d) => d.type === t))
  const label = customerLabel(customer)
  const newDoc = () => (creatable.length === 1 ? nav(`/d/${DOC_META[creatable[0]].path}/new?customer=${customer.id}`) : setCreating(true))

  return (
    <>
      <Link to={base} className="mb-3 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
        <ArrowLeft size={15} /> {isSupplier ? 'Suppliers' : 'Customers'}
      </Link>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Avatar name={label} size="lg" />
            <span className="min-w-0">{label}</span>
          </span>
        }
        subtitle={customer.company && customer.name ? customer.name : undefined}
        actions={
          <>
            <ContactActions phone={customer.phone} name={label} />
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
              aria-label="Delete"
              disabled={hasLinks}
              title={hasLinks ? 'Contacts with documents or transactions cannot be deleted' : undefined}
              onClick={() => {
                if (confirm(`Delete ${label}?`)) {
                  deleteCustomer(customer.id)
                  nav(base)
                }
              }}
            >
              <Trash2 size={15} /> <span className="hidden sm:inline">Delete</span>
            </Button>
          </>
        }
      />

      <div className="mb-5">
        <MetricStrip
          currency={currency}
          items={[
            { label: isSupplier ? 'Purchases' : 'Billed', value: stats.billed },
            { label: 'Paid', value: stats.paid },
            { label: isSupplier ? 'Unpaid' : 'Outstanding', value: stats.outstanding, tone: stats.outstanding > 0 ? 'warn' : undefined },
          ]}
        />
      </div>

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
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Documents"
            subtitle={stats.lastActivity ? `Last activity ${formatDate(stats.lastActivity)}` : undefined}
            action={
              <Button variant="primary" size="sm" onClick={newDoc}>
                <Plus size={14} /> {creatable.length === 1 ? `New ${DOC_META[creatable[0]].label.toLowerCase()}` : 'New document'}
              </Button>
            }
          />
          {tabs.length > 1 && (
            <div className="border-b border-stone-200 px-3 py-2.5">
              <ChipGroup
                label="Document type"
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'all' as const, label: 'All', count: docs.length },
                  ...tabs.map((t) => ({ value: t, label: DOC_META[t].plural, count: docs.filter((d) => d.type === t).length })),
                ]}
              />
            </div>
          )}
          {shown.length ? (
            <DocumentTable docs={shown} showType showCustomer={false} />
          ) : (
            <EmptyState title="No documents yet" text={`Use “${creatable.length === 1 ? `New ${DOC_META[creatable[0]].label.toLowerCase()}` : 'New document'}” to create the first one.`} />
          )}
        </Card>
      </div>

      <CustomerForm open={editing} onClose={() => setEditing(false)} customer={customer} />
      <CreateSheet open={creating} onClose={() => setCreating(false)} types={creatable} customerId={customer.id} title={`New for ${label}`} />
    </>
  )
}
