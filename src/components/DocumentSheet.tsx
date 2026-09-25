import { amountInWords, docTotals, formatDate, formatMoney, invoicePaid, lineTotal } from '../lib/calc'
import { useStore } from '../lib/store'
import { DOC_META, PAYMENT_METHODS, type Customer, type Document } from '../lib/types'

/** A4 printable rendering of any document type. */
export default function DocumentSheet({ doc, customer }: { doc: Document; customer?: Customer }) {
  const settings = useStore((s) => s.settings)
  const documents = useStore((s) => s.documents)
  const cur = settings.currency
  const meta = DOC_META[doc.type]
  const totals = docTotals(doc)
  const logo = settings.logoDataUrl || './logo.png'
  const invoice = doc.invoiceId ? documents.find((d) => d.id === doc.invoiceId) : undefined
  const isPriced = doc.type !== 'receipt' && doc.type !== 'service_report'
  const showBank = doc.type === 'invoice' || doc.type === 'proforma' || doc.type === 'quotation'

  const paidSoFar = doc.type === 'invoice' ? invoicePaid(doc.id, documents) : 0

  return (
    <div className="sheet mx-auto flex flex-col shadow-lg">
      {/* Header */}
      <div className="flex items-start justify-between gap-6 border-b-2 border-gold-600 pb-5">
        <div className="flex items-start gap-4">
          <img src={logo} alt="" className="h-20 w-auto max-w-[170px] object-contain" />
          <div className="pt-1 text-[11px] leading-snug text-stone-600">
            <div className="text-[15px] font-bold tracking-wide text-stone-900">{settings.companyName}</div>
            {settings.regNo && <div>Reg. No: {settings.regNo}</div>}
            {settings.address && <div className="whitespace-pre-line">{settings.address}</div>}
            <div>
              {[settings.phone && `Tel: ${settings.phone}`, settings.email].filter(Boolean).join(' · ')}
            </div>
            {settings.website && <div>{settings.website}</div>}
            {settings.sstNo && <div>SST No: {settings.sstNo}</div>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[22px] font-bold tracking-wider text-gold-700">{meta.title}</div>
          <table className="ml-auto mt-2 text-[11px]">
            <tbody>
              <MetaRow label="No." value={doc.number} bold />
              <MetaRow label="Date" value={formatDate(doc.date)} />
              {doc.dueDate && <MetaRow label={doc.type === 'quotation' ? 'Valid until' : 'Due date'} value={formatDate(doc.dueDate)} />}
              {doc.reference && <MetaRow label="Ref." value={doc.reference} />}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bill to */}
      <div className="mt-5 grid grid-cols-2 gap-6">
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gold-700">
            {doc.type === 'receipt' ? 'Received from' : doc.type === 'service_report' ? 'Customer' : 'Bill to'}
          </div>
          {customer ? (
            <div className="text-[12px] leading-snug">
              <div className="font-semibold">{customer.company || customer.name}</div>
              {customer.company && customer.name && <div>Attn: {customer.name}</div>}
              {customer.regNo && <div className="text-stone-600">({customer.regNo})</div>}
              {customer.address && <div className="whitespace-pre-line text-stone-700">{customer.address}</div>}
              {customer.phone && <div className="text-stone-700">Tel: {customer.phone}</div>}
              {customer.email && <div className="text-stone-700">{customer.email}</div>}
            </div>
          ) : (
            <div className="text-stone-400">—</div>
          )}
        </div>
        {doc.type === 'service_report' && doc.service && (
          <div className="text-[11px]">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gold-700">Service info</div>
            <table>
              <tbody>
                <MetaRow label="Technician" value={doc.service.technician || '—'} left />
                <MetaRow label="Location" value={doc.service.location || '—'} left />
                <MetaRow label="Equipment" value={doc.service.equipment || '—'} left />
                {doc.service.serialNo && <MetaRow label="Model / S/N" value={doc.service.serialNo} left />}
                {(doc.service.timeIn || doc.service.timeOut) && (
                  <MetaRow label="Time" value={`${doc.service.timeIn || '—'} to ${doc.service.timeOut || '—'}`} left />
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Body */}
      {doc.type === 'receipt' ? (
        <div className="mt-8 space-y-3 text-[12.5px]">
          <ReceiptLine label="The sum of" value={amountInWords(doc.amountPaid ?? 0)} />
          <ReceiptLine label="Being payment for" value={doc.notes || (invoice ? `Invoice ${invoice.number}` : '—')} />
          <ReceiptLine
            label="Payment method"
            value={`${PAYMENT_METHODS[doc.paymentMethod ?? 'other']}${doc.paymentRef ? ` (Ref: ${doc.paymentRef})` : ''}`}
          />
          {invoice && <ReceiptLine label="Invoice no." value={invoice.number} />}
          <div className="mt-6 inline-block rounded-md border-2 border-gold-600 px-5 py-2.5 text-[18px] font-bold">
            {formatMoney(doc.amountPaid ?? 0, cur)}
          </div>
        </div>
      ) : (
        <>
          {doc.type === 'service_report' && doc.service && (
            <div className="mt-6 space-y-4 text-[12px]">
              <Section title="Problem reported" text={doc.service.problem} />
              <Section title="Work carried out" text={doc.service.workDone} />
              {doc.service.recommendation && <Section title="Recommendation" text={doc.service.recommendation} />}
            </div>
          )}

          {(doc.items.length > 0 || isPriced) && (
            <table className="mt-6 w-full border-collapse text-[11.5px]">
              {doc.type === 'service_report' && (
                <caption className="mb-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gold-700">
                  Parts / materials used
                </caption>
              )}
              <thead>
                <tr className="bg-ink-900 text-left text-[10.5px] uppercase tracking-wide text-gold-200">
                  <th className="w-8 px-2 py-2 font-semibold">#</th>
                  <th className="px-2 py-2 font-semibold">Description</th>
                  <th className="w-16 px-2 py-2 text-right font-semibold">Qty</th>
                  <th className="w-14 px-2 py-2 font-semibold">Unit</th>
                  {isPriced && <th className="w-24 px-2 py-2 text-right font-semibold">Unit price</th>}
                  {isPriced && <th className="w-28 px-2 py-2 text-right font-semibold">Amount ({cur})</th>}
                </tr>
              </thead>
              <tbody>
                {doc.items.map((it, i) => (
                  <tr key={it.id} className="border-b border-stone-200 align-top">
                    <td className="px-2 py-2 text-stone-500">{i + 1}</td>
                    <td className="whitespace-pre-line px-2 py-2">{it.description}</td>
                    <td className="tabular px-2 py-2 text-right">{it.qty}</td>
                    <td className="px-2 py-2">{it.unit}</td>
                    {isPriced && <td className="tabular px-2 py-2 text-right">{formatMoney(it.unitPrice, '').trim()}</td>}
                    {isPriced && <td className="tabular px-2 py-2 text-right">{formatMoney(lineTotal(it), '').trim()}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {isPriced && (
            <div className="mt-3 flex justify-between gap-8">
              <div className="flex-1 pt-1 text-[11px] italic text-stone-600">{amountInWords(totals.total)}</div>
              <table className="w-64 text-[12px]">
                <tbody>
                  <TotalRow label="Subtotal" value={formatMoney(totals.subtotal, cur)} />
                  {totals.discount > 0 && <TotalRow label="Discount" value={`- ${formatMoney(totals.discount, cur)}`} />}
                  {doc.taxRate > 0 && <TotalRow label={`${settings.taxLabel} (${doc.taxRate}%)`} value={formatMoney(totals.tax, cur)} />}
                  <tr className="border-t-2 border-gold-600 text-[14px] font-bold">
                    <td className="py-2">Total</td>
                    <td className="tabular py-2 text-right">{formatMoney(totals.total, cur)}</td>
                  </tr>
                  {doc.type === 'invoice' && paidSoFar > 0 && (
                    <>
                      <TotalRow label="Paid" value={`- ${formatMoney(paidSoFar, cur)}`} />
                      <tr className="font-semibold">
                        <td className="py-1">Balance due</td>
                        <td className="tabular py-1 text-right">{formatMoney(Math.max(0, totals.total - paidSoFar), cur)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {doc.notes && (
            <div className="mt-5 text-[11.5px]">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gold-700">Notes</div>
              <div className="whitespace-pre-line text-stone-700">{doc.notes}</div>
            </div>
          )}
        </>
      )}

      <div className="flex-1" />

      {/* Footer */}
      <div className="mt-8 grid grid-cols-2 gap-8 text-[11px]">
        <div className="space-y-4">
          {showBank && settings.bankAccountNo && (
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gold-700">Payment details</div>
              <div>Bank: {settings.bankName}</div>
              <div>Account name: {settings.bankAccountName}</div>
              <div>Account no.: {settings.bankAccountNo}</div>
            </div>
          )}
          {doc.terms && (
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gold-700">Terms & conditions</div>
              <div className="whitespace-pre-line text-stone-600">{doc.terms}</div>
            </div>
          )}
        </div>
        <div className="flex items-end justify-end gap-6">
          {doc.type === 'service_report' ? (
            <>
              <Signature label="Serviced by" name={doc.service?.technician} />
              <Signature label="Customer acknowledgement" name={doc.service?.acknowledgedBy} />
            </>
          ) : doc.type === 'quotation' ? (
            <>
              <Signature label="Prepared by" name={settings.companyName} />
              <Signature label="Accepted by (customer)" />
            </>
          ) : (
            <Signature label="Authorised signature" name={settings.companyName} />
          )}
        </div>
      </div>
      <div className="mt-6 border-t border-stone-200 pt-2 text-center text-[9.5px] text-stone-400">
        {doc.type === 'receipt' || doc.type === 'invoice'
          ? 'This is a computer-generated document. No signature is required.'
          : `${settings.companyName} · Thank you for your business`}
      </div>
    </div>
  )
}

function MetaRow({ label, value, bold, left }: { label: string; value: string; bold?: boolean; left?: boolean }) {
  return (
    <tr>
      <td className={`py-0.5 pr-3 text-stone-500 ${left ? '' : 'text-right'}`}>{label}</td>
      <td className={`py-0.5 ${left ? '' : 'text-right'} ${bold ? 'font-semibold text-stone-900' : ''}`}>{value}</td>
    </tr>
  )
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="py-1 text-stone-600">{label}</td>
      <td className="tabular py-1 text-right">{value}</td>
    </tr>
  )
}

function ReceiptLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 border-b border-dotted border-stone-300 pb-1.5">
      <span className="w-36 shrink-0 text-stone-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function Section({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gold-700">{title}</div>
      <div className="min-h-[2.5em] whitespace-pre-line rounded border border-stone-200 px-3 py-2">{text || '—'}</div>
    </div>
  )
}

function Signature({ label, name }: { label: string; name?: string }) {
  return (
    <div className="w-44 text-center">
      <div className="h-12 border-b border-stone-400" />
      <div className="mt-1 font-medium">{name || ' '}</div>
      <div className="text-[10px] text-stone-500">{label}</div>
    </div>
  )
}
