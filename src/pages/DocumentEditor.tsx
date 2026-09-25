import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, UserPlus } from 'lucide-react'
import { docTotals, formatMoney, invoicePaid, invoicePaymentState } from '../lib/calc'
import { customerLabel, useStore } from '../lib/store'
import {
  DOC_META,
  PAYMENT_METHODS,
  STATUS_OPTIONS,
  docTypeFromPath,
  type Document,
  type PaymentMethod,
  type ServiceReportFields,
} from '../lib/types'
import CustomerForm from '../components/CustomerForm'
import LineItemsEditor from '../components/LineItemsEditor'
import { Button, Card, CardHeader, Field, Input, PageHeader, Select, Textarea } from '../components/ui'

export default function DocumentEditor() {
  const { typePath, id } = useParams()
  const type = docTypeFromPath(typePath)
  const existing = useStore((s) => s.documents.find((d) => d.id === id))
  if (!type) return <Navigate to="/" replace />
  if (id && !existing) return <Navigate to={`/d/${typePath}`} replace />
  // key forces a fresh form when navigating between documents
  return <Editor key={id ?? 'new'} existing={existing} type={type} />
}

function Editor({ existing, type }: { existing?: Document; type: Document['type'] }) {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const store = useStore()
  const { customers, documents, settings } = store
  const meta = DOC_META[type]

  const [doc, setDoc] = useState<Document>(() => {
    if (existing) return structuredClone(existing)
    const from = params.get('from')
    const invoice = params.get('invoice')
    if (invoice) return store.receiptForInvoice(invoice)
    if (from) return store.convertDocument(from, type)
    return store.newDocument(type, params.get('customer') ?? '')
  })
  const [addingCustomer, setAddingCustomer] = useState(false)
  const [error, setError] = useState('')

  const set = <K extends keyof Document>(k: K, v: Document[K]) => setDoc((d) => ({ ...d, [k]: v }))
  const setService = (k: keyof ServiceReportFields, v: string) =>
    setDoc((d) => ({ ...d, service: { ...(d.service as ServiceReportFields), [k]: v } }))

  const totals = docTotals(doc)
  const sortedCustomers = useMemo(
    () => [...customers].sort((a, b) => customerLabel(a).localeCompare(customerLabel(b))),
    [customers],
  )

  // Invoices this receipt can be applied to: the customer's non-draft, non-cancelled invoices
  // that still have a balance (plus the one already linked, when editing).
  const payableInvoices = useMemo(
    () =>
      documents.filter(
        (d) =>
          d.type === 'invoice' &&
          d.customerId === doc.customerId &&
          d.status !== 'cancelled' &&
          (d.id === doc.invoiceId || invoicePaymentState(d, documents.filter((x) => x.id !== doc.id)) !== 'paid'),
      ),
    [documents, doc.customerId, doc.invoiceId, doc.id],
  )

  const linkedInvoice = documents.find((d) => d.id === doc.invoiceId)
  const invoiceBalance = linkedInvoice
    ? docTotals(linkedInvoice).total - invoicePaid(linkedInvoice.id, documents.filter((x) => x.id !== doc.id))
    : 0

  const save = () => {
    if (!doc.customerId) return setError('Please choose a customer.')
    if (!doc.number.trim()) return setError('Document number is required.')
    const dup = documents.some((d) => d.type === doc.type && d.id !== doc.id && d.number.trim() === doc.number.trim())
    if (dup) return setError(`${doc.number} is already used by another ${meta.label.toLowerCase()}.`)
    if (type === 'receipt' && !(Number(doc.amountPaid) > 0)) return setError('Enter the amount received.')
    const saved = store.saveDocument({
      ...doc,
      number: doc.number.trim(),
      items: doc.items.filter((i) => i.description.trim() || i.unitPrice),
    })
    nav(`/d/${meta.path}/${saved.id}`, { replace: true })
  }

  const dueLabel = type === 'quotation' ? 'Valid until' : 'Due date'
  const hasDue = type === 'quotation' || type === 'invoice' || type === 'proforma'
  const showItems = type !== 'receipt'
  const showPricing = type !== 'receipt' && type !== 'service_report'
  const backTo = existing ? `/d/${meta.path}/${existing.id}` : `/d/${meta.path}`

  return (
    <>
      <Link to={backTo} className="mb-3 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
        <ArrowLeft size={15} /> {existing ? existing.number : meta.plural}
      </Link>
      <PageHeader
        title={existing ? `Edit ${meta.label.toLowerCase()}` : `New ${meta.label.toLowerCase()}`}
        subtitle={doc.reference ? `Ref: ${doc.reference}` : undefined}
        actions={
          <>
            <Button onClick={() => nav(backTo)}>Cancel</Button>
            <Button variant="primary" onClick={save}>
              Save {meta.label.toLowerCase()}
            </Button>
          </>
        }
      />
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card>
            <CardHeader title="Details" />
            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
              <Field label="Customer" className="sm:col-span-2">
                <div className="flex gap-2">
                  <Select
                    value={doc.customerId}
                    onChange={(e) => setDoc((d) => ({ ...d, customerId: e.target.value, invoiceId: d.type === 'receipt' ? undefined : d.invoiceId }))}
                  >
                    <option value="">— Select customer —</option>
                    {sortedCustomers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {customerLabel(c)}
                        {c.company && c.name ? ` (${c.name})` : ''}
                      </option>
                    ))}
                  </Select>
                  <Button type="button" onClick={() => setAddingCustomer(true)} title="New customer">
                    <UserPlus size={16} />
                  </Button>
                </div>
              </Field>
              <Field label={`${meta.label} no.`}>
                <Input value={doc.number} onChange={(e) => set('number', e.target.value)} />
              </Field>
              <Field label="Date">
                <Input type="date" value={doc.date} onChange={(e) => set('date', e.target.value)} />
              </Field>
              {hasDue && (
                <Field label={dueLabel}>
                  <Input type="date" value={doc.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
                </Field>
              )}
              <Field label="Reference" hint="PO number, quotation no., etc.">
                <Input value={doc.reference} onChange={(e) => set('reference', e.target.value)} />
              </Field>
              <Field label="Status">
                <Select value={doc.status} onChange={(e) => set('status', e.target.value as Document['status'])} className="capitalize">
                  {STATUS_OPTIONS[type].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
              {type === 'invoice' && (
                <p className="self-end pb-2 text-xs text-stone-500 sm:col-span-1">
                  Paid / unpaid is tracked automatically from receipts.
                </p>
              )}
            </div>
          </Card>

          {type === 'receipt' && (
            <Card>
              <CardHeader title="Payment" />
              <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
                <Field label="Apply to invoice" className="sm:col-span-2" hint={linkedInvoice ? `Balance before this receipt: ${formatMoney(invoiceBalance, settings.currency)}` : 'Optional — leave blank for a standalone receipt.'}>
                  <Select
                    value={doc.invoiceId ?? ''}
                    onChange={(e) => {
                      const inv = documents.find((d) => d.id === e.target.value)
                      setDoc((d) => ({
                        ...d,
                        invoiceId: inv?.id,
                        reference: inv ? inv.number : d.reference,
                        amountPaid: inv && !d.amountPaid
                          ? Math.max(0, docTotals(inv).total - invoicePaid(inv.id, documents.filter((x) => x.id !== d.id)))
                          : d.amountPaid,
                      }))
                    }}
                    disabled={!doc.customerId}
                  >
                    <option value="">— No invoice —</option>
                    {payableInvoices.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.number} · {formatMoney(docTotals(i).total, settings.currency)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={`Amount received (${settings.currency})`}>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={doc.amountPaid ?? 0}
                    onChange={(e) => set('amountPaid', e.target.value === '' ? 0 : Number(e.target.value))}
                  />
                </Field>
                <Field label="Payment method">
                  <Select value={doc.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value as PaymentMethod)}>
                    {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Transaction / cheque ref." className="sm:col-span-2">
                  <Input value={doc.paymentRef ?? ''} onChange={(e) => set('paymentRef', e.target.value)} />
                </Field>
              </div>
            </Card>
          )}

          {type === 'service_report' && doc.service && (
            <Card>
              <CardHeader title="Service details" />
              <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
                <Field label="Technician">
                  <Input value={doc.service.technician} onChange={(e) => setService('technician', e.target.value)} />
                </Field>
                <Field label="Site / location">
                  <Input value={doc.service.location} onChange={(e) => setService('location', e.target.value)} />
                </Field>
                <Field label="Equipment / system">
                  <Input value={doc.service.equipment} onChange={(e) => setService('equipment', e.target.value)} />
                </Field>
                <Field label="Model / serial no.">
                  <Input value={doc.service.serialNo} onChange={(e) => setService('serialNo', e.target.value)} />
                </Field>
                <Field label="Time in">
                  <Input type="time" value={doc.service.timeIn} onChange={(e) => setService('timeIn', e.target.value)} />
                </Field>
                <Field label="Time out">
                  <Input type="time" value={doc.service.timeOut} onChange={(e) => setService('timeOut', e.target.value)} />
                </Field>
                <Field label="Problem reported" className="sm:col-span-2">
                  <Textarea value={doc.service.problem} onChange={(e) => setService('problem', e.target.value)} />
                </Field>
                <Field label="Work carried out" className="sm:col-span-2">
                  <Textarea value={doc.service.workDone} onChange={(e) => setService('workDone', e.target.value)} rows={4} />
                </Field>
                <Field label="Recommendation" className="sm:col-span-2">
                  <Textarea value={doc.service.recommendation} onChange={(e) => setService('recommendation', e.target.value)} />
                </Field>
                <Field label="Acknowledged by (customer)">
                  <Input value={doc.service.acknowledgedBy} onChange={(e) => setService('acknowledgedBy', e.target.value)} />
                </Field>
              </div>
            </Card>
          )}

          {showItems && (
            <Card>
              <CardHeader title={type === 'service_report' ? 'Parts / materials used' : 'Items'} />
              <div className="p-5">
                <LineItemsEditor items={doc.items} onChange={(items) => set('items', items)} currency={settings.currency} showPrices={showPricing} />
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Notes & terms" />
            <div className="grid gap-4 p-5">
              <Field label={type === 'receipt' ? 'Being payment for' : 'Notes'}>
                <Textarea value={doc.notes} onChange={(e) => set('notes', e.target.value)} />
              </Field>
              <Field label="Terms & conditions">
                <Textarea value={doc.terms} onChange={(e) => set('terms', e.target.value)} rows={4} />
              </Field>
            </div>
          </Card>
        </div>

        {showPricing && (
          <div>
            <Card className="xl:sticky xl:top-6">
              <CardHeader title="Summary" />
              <div className="space-y-3 p-5 text-sm">
                <Row label="Subtotal" value={formatMoney(totals.subtotal, settings.currency)} />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-stone-600">Discount ({settings.currency})</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={doc.discount}
                    onChange={(e) => set('discount', e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-28 text-right"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-stone-600">{settings.taxLabel} rate (%)</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={doc.taxRate}
                    onChange={(e) => set('taxRate', e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-28 text-right"
                  />
                </div>
                <Row label={`${settings.taxLabel} amount`} value={formatMoney(totals.tax, settings.currency)} />
                <div className="flex items-center justify-between border-t border-stone-200 pt-3 text-base font-semibold">
                  <span>Total</span>
                  <span className="tabular">{formatMoney(totals.total, settings.currency)}</span>
                </div>
                <Button variant="primary" className="mt-2 w-full" onClick={save}>
                  Save {meta.label.toLowerCase()}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>

      <CustomerForm
        open={addingCustomer}
        onClose={() => setAddingCustomer(false)}
        onSaved={(c) => setDoc((d) => ({ ...d, customerId: c.id }))}
      />
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-stone-600">{label}</span>
      <span className="tabular">{value}</span>
    </div>
  )
}
