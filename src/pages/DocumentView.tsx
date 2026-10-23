import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRightLeft, BellRing, Copy, FileMinus, MessageCircle, Pencil, Printer, ReceiptText, Trash2, Wallet } from 'lucide-react'
import { displayStatus, docAmount, docTotals, formatDate, formatMoney, invoiceBalance, invoiceCredited, invoicePaid, toISODate, today } from '../lib/calc'
import { reminderMessage, shouldMarkSent } from '../lib/reminder'
import { splitPaymentStates, splitPlanStatus } from '../lib/split'
import { cloneItems, contactKind, customerLabel, useCustomer, useStore } from '../lib/store'
import { waNumber } from '../lib/contact'
import { DOC_META, STATUS_OPTIONS, docTypeFromPath, isPurchaseDoc, type Document, type DocType } from '../lib/types'
import DocumentSheet from '../components/DocumentSheet'
import EngineeringSheet from '../components/EngineeringSheet'
import SheetPreview from '../components/SheetPreview'
import SharePdfButton from '../components/SharePdfButton'
import PhotoPages from '../components/PhotoPages'
import SplitPaymentsCard from '../components/SplitPaymentsCard'
import { Button, buttonClass, Card, CardHeader, MoreMenu, Select, StatusBadge, type MenuItem } from '../components/ui'

const CONVERSIONS: Partial<Record<DocType, DocType[]>> = {
  quotation: ['proforma', 'invoice', 'delivery_order'],
  proforma: ['invoice', 'delivery_order'],
  invoice: ['delivery_order'],
  service_report: ['quotation', 'invoice'],
}


export default function DocumentView() {
  const { typePath, id } = useParams()
  const type = docTypeFromPath(typePath)
  const doc = useStore((s) => s.documents.find((d) => d.id === id))
  const documents = useStore((s) => s.documents)
  const settings = useStore((s) => s.settings)
  const transactions = useStore((s) => s.transactions)
  const saveDocument = useStore((s) => s.saveDocument)
  const deleteDocument = useStore((s) => s.deleteDocument)
  const newDocument = useStore((s) => s.newDocument)
  const customer = useCustomer(doc?.customerId)
  const nav = useNavigate()
  const sheetBox = useRef<HTMLDivElement>(null)
  // Split payment (3×): the payments being recorded, while the dialog is open.
  const [splitRecording, setSplitRecording] = useState<number[] | null>(null)

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
  const credited = doc.type === 'invoice' ? invoiceCredited(doc.id, documents) : 0
  const balance = doc.type === 'invoice' ? invoiceBalance(doc, documents) : 0
  const poPaid = doc.type === 'purchase_order' ? transactions.filter((t) => t.docId === doc.id).reduce((s, t) => s + t.amount, 0) : 0
  const party = isPurchaseDoc(doc.type) ? 'Supplier' : 'Customer'

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
      // A copy starts without the original's split plan or reminder history.
      split: undefined,
      reminders: undefined,
      items: cloneItems(doc.items),
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

  const message =
    `Hi ${customer?.name || customerLabel(customer)}, here is ${meta.label} ${doc.number}` +
    (doc.type === 'service_report' || doc.type === 'delivery_order' ? '' : ` for ${formatMoney(docAmount(doc), settings.currency)}`) +
    `. — ${settings.companyName}`
  const waText = encodeURIComponent(message)

  // Sharing or sending a draft means it has gone to the customer.
  const markSent = () => {
    const cur = useStore.getState().documents.find((d) => d.id === doc.id)
    if (cur && shouldMarkSent(cur)) saveDocument({ ...cur, status: 'sent' })
  }
  const pdfOptions = {
    fileName: `${doc.number}.pdf`,
    docNo: doc.number,
    heading: meta.title,
    company: settings.companyName,
    engineering: settings.documentStyle === 'engineering',
  }

  const canRemind = doc.type === 'invoice' && doc.status !== 'draft' && doc.status !== 'cancelled' && balance > 0
  const reminder = canRemind
    ? reminderMessage({
        name: customer?.name || customerLabel(customer),
        number: doc.number,
        date: doc.date,
        dueDate: doc.dueDate,
        balance,
        currency: settings.currency,
        company: settings.companyName,
        bank: { name: settings.bankName, accountNo: settings.bankAccountNo, accountName: settings.bankAccountName || settings.companyName },
        today: today(),
      })
    : ''
  const reminded = (result: 'shared' | 'downloaded') => {
    const cur = useStore.getState().documents.find((d) => d.id === doc.id)
    if (cur) saveDocument({ ...cur, reminders: [...(cur.reminders ?? []), new Date().toISOString()] })
    // On a computer the PDF was downloaded: open the customer's chat with the reminder to attach it.
    if (result === 'downloaded' && customer?.phone) window.open(`https://wa.me/${waNumber(customer.phone)}?text=${encodeURIComponent(reminder)}`, '_blank', 'noreferrer')
  }
  const lastReminder = doc.reminders?.at(-1)

  const canPay = doc.type === 'invoice' && doc.status !== 'cancelled' && balance > 0
  const splitOpen = doc.type === 'invoice' && !!doc.split && ['Active', 'Overdue'].includes(splitPlanStatus(doc, documents, today()))
  const canPayPo = doc.type === 'purchase_order' && doc.status !== 'cancelled' && poPaid + 0.005 < docTotals(doc).total
  const more: MenuItem[] = [
    ...(doc.type === 'invoice' && doc.status !== 'cancelled' && doc.status !== 'draft'
      ? [{ label: 'Credit note', icon: FileMinus, onSelect: () => nav(`/d/${DOC_META.credit_note.path}/new?credit=${doc.id}`) }]
      : []),
    ...(CONVERSIONS[doc.type] ?? []).map((t) => ({
      label: `Turn into ${DOC_META[t].label.toLowerCase()}`,
      icon: ArrowRightLeft,
      onSelect: () => nav(`/d/${DOC_META[t].path}/new?from=${doc.id}`),
    })),
    { label: 'Duplicate', icon: Copy, onSelect: duplicate },
    { label: 'Delete', icon: Trash2, onSelect: remove, danger: true },
  ]

  const facts: [string, string, string?][] = [
    ...(doc.type !== 'service_report' && doc.type !== 'delivery_order'
      ? [[doc.type === 'receipt' ? 'Amount received' : 'Total', formatMoney(docAmount(doc), settings.currency)] as [string, string]]
      : []),
    ...(doc.type === 'invoice'
      ? ([
          ['Paid', formatMoney(paid, settings.currency)],
          ...(credited > 0 ? [['Credit notes', formatMoney(credited, settings.currency)]] : []),
          ['Balance', formatMoney(balance, settings.currency), balance > 0 ? 'text-amber-700 font-semibold' : ''],
        ] as [string, string, string?][])
      : []),
    ...(doc.type === 'credit_note' && (doc.refundAmount ?? 0) > 0 ? [['Refunded', formatMoney(doc.refundAmount ?? 0, settings.currency)] as [string, string]] : []),
    ...(doc.type === 'purchase_order' ? [['Paid to supplier', formatMoney(poPaid, settings.currency)] as [string, string]] : []),
  ]

  return (
    <>
      <div className="no-print">
        <Link to={`/d/${meta.path}`} className="mb-3 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
          <ArrowLeft size={15} /> {meta.plural}
        </Link>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 className="font-display text-[23px] font-normal leading-tight tracking-[-0.02em] text-stone-900 sm:text-[26px]">{doc.number}</h1>
              <StatusBadge status={status} />
            </div>
            <p className="mt-1 text-sm text-stone-500">
              {meta.label} · {customerLabel(customer)} · {formatDate(doc.date)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => window.print()}>
              <Printer size={15} /> Print / PDF
            </Button>
            <SharePdfButton sheetBox={sheetBox} text={message} options={pdfOptions} onDone={markSent} />
            {canRemind && (
              <SharePdfButton
                sheetBox={sheetBox}
                text={reminder}
                options={pdfOptions}
                label="Remind"
                icon={<BellRing size={15} className="text-[var(--warn)]" />}
                onDone={reminded}
              />
            )}
            {customer?.phone && (
              <a href={`https://wa.me/${waNumber(customer.phone)}?text=${waText}`} target="_blank" rel="noreferrer" onClick={markSent} className={buttonClass()}>
                <MessageCircle size={15} className="text-[var(--good)]" /> WhatsApp
              </a>
            )}
            <Button onClick={() => nav(`/d/${meta.path}/${doc.id}/edit`)}>
              <Pencil size={15} /> Edit
            </Button>
            {canPay && (
              <Button
                onClick={() => {
                  // A split invoice is paid by its schedule: record the next payment.
                  const next = splitOpen ? splitPaymentStates(doc, documents, today()).find((p) => p.status !== 'Paid') : undefined
                  if (next) setSplitRecording([next.seq])
                  else nav(`/d/${DOC_META.receipt.path}/new?invoice=${doc.id}`)
                }}
              >
                <ReceiptText size={15} /> Record payment
              </Button>
            )}
            {canPayPo && (
              <Button onClick={() => nav(`/transactions?po=${doc.id}`)}>
                <Wallet size={15} /> Record payment
              </Button>
            )}
            <MoreMenu items={more} />
          </div>
        </div>
      </div>

      {/* Narrow: overview, sheet, linked documents. Wide: sheet on the left, both cards on the right. */}
      <div className="grid gap-5 min-[1440px]:grid-cols-[auto_280px] min-[1440px]:grid-rows-[auto_1fr] print:block">
        <div className="order-2 min-w-0 min-[1440px]:col-start-1 min-[1440px]:row-span-2 min-[1440px]:row-start-1">
          <div ref={sheetBox}>
            <SheetPreview>
              {settings.documentStyle === 'engineering' ? <EngineeringSheet doc={doc} customer={customer} /> : <DocumentSheet doc={doc} customer={customer} />}
              <PhotoPages doc={doc} customer={customer} />
            </SheetPreview>
          </div>
        </div>

        <div className="no-print order-1 space-y-5 min-[1440px]:col-start-2 min-[1440px]:row-start-1">
          <Card>
            <CardHeader title="Overview" />
            <div className="@container">
              <div className="grid gap-3 p-5 text-sm @min-[520px]:grid-cols-2 @min-[520px]:gap-x-10">
                <div className="flex justify-between gap-2">
                  <span className="text-stone-500">{party}</span>
                  {customer ? (
                    <Link to={`/${contactKind(customer) === 'supplier' ? 'suppliers' : 'customers'}/${customer.id}`} className="text-right font-semibold text-gold-700 hover:underline">
                      {customerLabel(customer)}
                    </Link>
                  ) : (
                    <span>—</span>
                  )}
                </div>
                {facts.map(([label, value, cls]) => (
                  <div key={label} className="flex justify-between gap-2">
                    <span className="text-stone-500">{label}</span>
                    <span className={`tabular ${cls || 'font-medium'}`}>{value}</span>
                  </div>
                ))}
                {lastReminder && (
                  <div className="flex justify-between gap-2">
                    <span className="text-stone-500">Reminders</span>
                    <span className="text-right">
                      {doc.reminders!.length} · last {formatDate(toISODate(new Date(lastReminder)))}
                    </span>
                  </div>
                )}
                <label className="block pt-1 @min-[520px]:col-span-2 @min-[520px]:max-w-xs">
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
            </div>
          </Card>
          {doc.type === 'invoice' && doc.split && (
            <SplitPaymentsCard invoice={doc} recording={splitRecording} onRecord={setSplitRecording} />
          )}
        </div>

        {related.length > 0 && (
          <Card className="no-print order-3 self-start min-[1440px]:col-start-2 min-[1440px]:row-start-2">
            <CardHeader title="Linked documents" />
            <ul className="divide-y divide-stone-200 text-sm">
              {related.map((r) => (
                <li key={r.id}>
                  <Link to={`/d/${DOC_META[r.type].path}/${r.id}`} className="flex items-center justify-between gap-2 px-5 py-2.5 hover:bg-[var(--item-hover)]">
                    <span>
                      <span className="font-semibold">{r.number}</span>
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
    </>
  )
}
