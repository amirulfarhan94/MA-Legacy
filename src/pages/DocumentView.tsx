import { useEffect, useMemo } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRightLeft, Copy, MessageCircle, Pencil, Printer, ReceiptText, Trash2 } from 'lucide-react'
import { displayStatus, docAmount, docTotals, formatDate, formatMoney, invoicePaid } from '../lib/calc'
import { customerLabel, uid, useCustomer, useStore } from '../lib/store'
import { DOC_META, STATUS_OPTIONS, docTypeFromPath, type Document, type DocType } from '../lib/types'
import DocumentSheet from '../components/DocumentSheet'
import { Button, Card, CardHeader, Select, StatusBadge } from '../components/ui'

const CONVERSIONS: Partial<Record<DocType, DocType[]>> = {
  quotation: ['proforma', 'invoice'],
  proforma: ['invoice'],
  service_report: ['quotation', 'invoice'],
}

/** Malaysian numbers: 012-345 6789 → 60123456789 for wa.me links. */
function waNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0')) return `6${digits}`
  return digits
}

export default function DocumentView() {
  const { typePath, id } = useParams()
  const type = docTypeFromPath(typePath)
  const doc = useStore((s) => s.documents.find((d) => d.id === id))
  const documents = useStore((s) => s.documents)
  const settings = useStore((s) => s.settings)
  const saveDocument = useStore((s) => s.saveDocument)
  const deleteDocument = useStore((s) => s.deleteDocument)
  const newDocument = useStore((s) => s.newDocument)
  const customer = useCustomer(doc?.customerId)
  const nav = useNavigate()

  // The browser uses the page title as the default PDF file name.
  useEffect(() => {
    if (!doc) return
    const prev = document.title
    document.title = `${doc.number} - ${customerLabel(customer)}`
    return () => {
      document.title = prev
    }
  }, [doc, customer])

  const related = useMemo(() => {
    if (!doc) return []
    return documents
      .filter((d) => d.id !== doc.id && (d.id === doc.sourceId || d.sourceId === doc.id || d.invoiceId === doc.id || d.id === doc.invoiceId))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [documents, doc])

  if (!type) return <Navigate to="/" replace />
  if (!doc) return <Navigate to={`/d/${typePath}`} replace />

  const meta = DOC_META[doc.type]
  const status = displayStatus(doc, documents)
  const paid = doc.type === 'invoice' ? invoicePaid(doc.id, documents) : 0
  const balance = doc.type === 'invoice' ? Math.max(0, docTotals(doc).total - paid) : 0

  const duplicate = () => {
    const fresh = newDocument(doc.type, doc.customerId)
    const copy: Document = {
      ...doc,
      id: fresh.id,
      number: fresh.number,
      date: fresh.date,
      dueDate: fresh.dueDate,
      status: fresh.status,
      sourceId: undefined,
      invoiceId: undefined,
      items: doc.items.map((i) => ({ ...i, id: uid() })),
      createdAt: fresh.createdAt,
    }
    const saved = saveDocument(copy)
    nav(`/d/${meta.path}/${saved.id}/edit`)
  }

  const remove = () => {
    const receipts = documents.filter((d) => d.invoiceId === doc.id)
    const msg = receipts.length
      ? `Delete ${doc.number}? ${receipts.length} receipt(s) will stay but be unlinked from it.`
      : `Delete ${doc.number}? This cannot be undone.`
    if (confirm(msg)) {
      deleteDocument(doc.id)
      nav(`/d/${meta.path}`)
    }
  }

  const waText = encodeURIComponent(
    `Hi ${customer?.name || customerLabel(customer)}, here is ${meta.label} ${doc.number}` +
      (doc.type === 'service_report' ? '' : ` for ${formatMoney(docAmount(doc), settings.currency)}`) +
      `. — ${settings.companyName}`,
  )

  return (
    <>
      <div className="no-print">
        <Link to={`/d/${meta.path}`} className="mb-3 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
          <ArrowLeft size={15} /> {meta.plural}
        </Link>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">{doc.number}</h1>
            <StatusBadge status={status} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => window.print()}>
              <Printer size={15} /> Print / PDF
            </Button>
            <Button onClick={() => nav(`/d/${meta.path}/${doc.id}/edit`)}>
              <Pencil size={15} /> Edit
            </Button>
            {doc.type === 'invoice' && doc.status !== 'cancelled' && balance > 0 && (
              <Button onClick={() => nav(`/d/${DOC_META.receipt.path}/new?invoice=${doc.id}`)}>
                <ReceiptText size={15} /> Record payment
              </Button>
            )}
            {CONVERSIONS[doc.type]?.map((t) => (
              <Button key={t} onClick={() => nav(`/d/${DOC_META[t].path}/new?from=${doc.id}`)}>
                <ArrowRightLeft size={15} /> To {DOC_META[t].label.toLowerCase()}
              </Button>
            ))}
            {customer?.phone && (
              <a
                href={`https://wa.me/${waNumber(customer.phone)}?text=${waText}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-stone-300 bg-white px-3.5 text-sm font-medium text-stone-800 hover:bg-stone-50"
              >
                <MessageCircle size={15} /> WhatsApp
              </a>
            )}
            <Button onClick={duplicate} title="Duplicate">
              <Copy size={15} />
            </Button>
            <Button variant="danger" onClick={remove} title="Delete">
              <Trash2 size={15} />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 min-[1440px]:grid-cols-[auto_280px] print:block">
        <div className="overflow-x-auto pb-4 print:overflow-visible print:pb-0">
          <DocumentSheet doc={doc} customer={customer} />
        </div>

        <div className="no-print space-y-5">
          <Card>
            <CardHeader title="Overview" />
            <div className="space-y-3 p-5 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-stone-500">Customer</span>
                {customer ? (
                  <Link to={`/customers/${customer.id}`} className="text-right font-medium text-gold-700 hover:underline">
                    {customerLabel(customer)}
                  </Link>
                ) : (
                  <span>—</span>
                )}
              </div>
              {doc.type !== 'service_report' && (
                <div className="flex justify-between">
                  <span className="text-stone-500">{doc.type === 'receipt' ? 'Amount received' : 'Total'}</span>
                  <span className="tabular font-medium">{formatMoney(docAmount(doc), settings.currency)}</span>
                </div>
              )}
              {doc.type === 'invoice' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Paid</span>
                    <span className="tabular">{formatMoney(paid, settings.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Balance</span>
                    <span className={`tabular font-medium ${balance > 0 ? 'text-amber-700' : ''}`}>{formatMoney(balance, settings.currency)}</span>
                  </div>
                </>
              )}
              <label className="block pt-1">
                <span className="mb-1 block text-xs text-stone-500">Status</span>
                <Select
                  value={doc.status}
                  onChange={(e) => saveDocument({ ...doc, status: e.target.value as Document['status'] })}
                  className="capitalize"
                >
                  {STATUS_OPTIONS[doc.type].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
          </Card>

          {related.length > 0 && (
            <Card>
              <CardHeader title="Linked documents" />
              <ul className="divide-y divide-stone-100 text-sm">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link to={`/d/${DOC_META[r.type].path}/${r.id}`} className="flex items-center justify-between gap-2 px-5 py-2.5 hover:bg-gold-50/40">
                      <span>
                        <span className="font-medium">{r.number}</span>
                        <span className="block text-xs text-stone-500">
                          {DOC_META[r.type].label} · {formatDate(r.date)}
                        </span>
                      </span>
                      <StatusBadge status={displayStatus(r, documents)} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
