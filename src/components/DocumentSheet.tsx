import { Fragment } from 'react'
import { amountInWords, docTotals, formatDate, formatMoney, hasPricedSubs, invoiceCredited, invoicePaid, lineTotal, subAmount } from '../lib/calc'
import { useStore } from '../lib/store'
import { DOC_META, PAYMENT_METHODS, isPricedDoc, type Customer, type Document } from '../lib/types'

const money = (n: number) => formatMoney(n, '').trim()

const PARTY_LABEL: Partial<Record<Document['type'], string>> = {
  receipt: 'Received from',
  service_report: 'Customer',
  delivery_order: 'Customer',
  credit_note: 'Credit to',
  purchase_order: 'Supplier',
}

/** A4 printable rendering of any document type. */
export default function DocumentSheet({ doc, customer }: { doc: Document; customer?: Customer }) {
  const settings = useStore((s) => s.settings)
  const documents = useStore((s) => s.documents)
  const cur = settings.currency
  const meta = DOC_META[doc.type]
  const totals = docTotals(doc)
  const invoice = doc.invoiceId ? documents.find((d) => d.id === doc.invoiceId) : undefined
  const isPriced = isPricedDoc(doc.type)
  const adj = isPriced && !!doc.itemAdjustments
  const showBank = (doc.type === 'invoice' || doc.type === 'proforma' || doc.type === 'quotation') && !!settings.bankAccountNo
  const showQr = (doc.type === 'invoice' || doc.type === 'proforma') && !!settings.paymentQrDataUrl
  const deliverTo =
    doc.type === 'delivery_order'
      ? doc.deliverTo || customer?.address
      : doc.type === 'purchase_order'
        ? doc.deliverTo || [settings.companyName, settings.address].filter(Boolean).join('\n')
        : undefined

  const paidSoFar = doc.type === 'invoice' ? invoicePaid(doc.id, documents) : 0
  const creditedSoFar = doc.type === 'invoice' ? invoiceCredited(doc.id, documents) : 0
  const refund = doc.type === 'credit_note' ? Number(doc.refundAmount) || 0 : 0

  return (
    <div className="sheet mx-auto flex flex-col shadow-lg">
      <SheetHeader
        title={meta.title}
        rows={[
          ['No.', doc.number, true],
          ['Date', formatDate(doc.date)],
          ...(doc.dueDate
            ? [[doc.type === 'quotation' ? 'Valid until' : doc.type === 'purchase_order' ? 'Delivery date' : 'Due date', formatDate(doc.dueDate)] as MetaEntry]
            : []),
          ...(doc.reference ? [['Ref.', doc.reference] as MetaEntry] : []),
        ]}
      />

      {/* Bill to */}
      <div className="mt-5 grid grid-cols-2 gap-6">
        <PartyBlock label={PARTY_LABEL[doc.type] ?? 'Bill to'} party={customer} />
        {deliverTo !== undefined && (
          <div className="text-[12px] leading-snug">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gold-700">Deliver to</div>
            <div className="whitespace-pre-line text-stone-700">{deliverTo || '—'}</div>
          </div>
        )}
        {doc.type === 'credit_note' && invoice && (
          <div className="text-[11px]">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gold-700">Original invoice</div>
            <table>
              <tbody>
                <MetaRow label="Invoice no." value={invoice.number} left />
                <MetaRow label="Invoice date" value={formatDate(invoice.date)} left />
                <MetaRow label="Invoice total" value={formatMoney(docTotals(invoice).total, cur)} left />
              </tbody>
            </table>
          </div>
        )}
        {doc.type === 'service_report' && doc.service && (
          <div className="text-[11px]">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gold-700">Service info</div>
            <table>
              <tbody>
                <MetaRow label="Technician" value={doc.service.technician || '—'} left />
                <MetaRow label="Location" value={doc.service.location || '—'} left />
                <MetaRow label="Equipment" value={doc.service.equipment || '—'} left />
                {doc.service.serialNo && <MetaRow label="Model / S/N" value={doc.service.serialNo} left />}
                {doc.service.acknowledgedBy && <MetaRow label="Acknowledged by" value={doc.service.acknowledgedBy} left />}
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
                  {adj && <th className="w-14 px-2 py-2 text-right font-semibold">Disc</th>}
                  {adj && <th className="w-14 px-2 py-2 text-right font-semibold">{settings.taxLabel}</th>}
                  {isPriced && <th className="w-28 px-2 py-2 text-right font-semibold">Amount ({cur})</th>}
                </tr>
              </thead>
              <tbody>
                {doc.items.map((it, i) => {
                  const subs = it.subItems ?? []
                  const fromSubs = isPriced && hasPricedSubs(it)
                  let n = 0
                  return (
                    <Fragment key={it.id}>
                      <tr className={`align-top ${subs.length ? '' : 'border-b border-stone-200'}`}>
                        <td className="px-2 pt-2 text-stone-500">{i + 1}</td>
                        <td className={`whitespace-pre-line px-2 pt-2 ${subs.length ? 'pb-1 font-medium' : 'pb-2'}`}>{it.description}</td>
                        <td className="tabular px-2 pt-2 text-right">{fromSubs ? '' : it.qty}</td>
                        <td className="px-2 pt-2">{fromSubs ? '' : it.unit}</td>
                        {isPriced && <td className="tabular px-2 pt-2 text-right">{fromSubs ? '' : money(it.unitPrice)}</td>}
                        {adj && <td className="tabular px-2 pt-2 text-right">{it.discountPct ? `${it.discountPct}%` : '—'}</td>}
                        {adj && <td className="tabular px-2 pt-2 text-right">{`${it.taxRate ?? doc.taxRate}%`}</td>}
                        {isPriced && <td className="tabular px-2 pt-2 text-right font-medium">{money(lineTotal(it, adj))}</td>}
                      </tr>
                      {subs.map((sItem, k) => {
                        const priced = isPriced && sItem.priced
                        const last = k === subs.length - 1
                        return (
                          <tr key={sItem.id} className={`align-top text-[11px] text-stone-700 ${last ? 'border-b border-stone-200' : ''}`}>
                            <td />
                            <td className={`px-2 ${last ? 'pb-2' : 'pb-0.5'}`}>
                              <div className="flex gap-2 pl-3">
                                <span className={`shrink-0 ${priced ? 'w-7 text-stone-500' : 'w-3 text-stone-400'}`}>{priced ? `${i + 1}.${++n}` : '•'}</span>
                                <span className="whitespace-pre-line">{sItem.description}</span>
                              </div>
                            </td>
                            <td className="tabular px-2 text-right">{sItem.qty ? sItem.qty : ''}</td>
                            <td className="px-2">{sItem.qty ? sItem.unit : ''}</td>
                            {isPriced && <td className="tabular px-2 text-right">{priced ? money(sItem.unitPrice) : ''}</td>}
                            {adj && <td />}
                            {adj && <td />}
                            {isPriced && <td className="tabular px-2 text-right">{priced ? money(subAmount(sItem)) : ''}</td>}
                          </tr>
                        )
                      })}
                    </Fragment>
                  )
                })}
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
                  {totals.taxLines.map((t) => (
                    <TotalRow
                      key={t.rate}
                      label={adj ? `${settings.taxLabel} ${t.rate}% on ${formatMoney(t.base, '').trim()}` : `${settings.taxLabel} (${t.rate}%)`}
                      value={formatMoney(t.tax, cur)}
                    />
                  ))}
                  <tr className="border-t-2 border-gold-600 text-[14px] font-bold">
                    <td className="py-2">Total</td>
                    <td className="tabular py-2 text-right">{formatMoney(totals.total, cur)}</td>
                  </tr>
                  {doc.type === 'invoice' && paidSoFar + creditedSoFar > 0 && (
                    <>
                      {paidSoFar > 0 && <TotalRow label="Paid" value={`- ${formatMoney(paidSoFar, cur)}`} />}
                      {creditedSoFar > 0 && <TotalRow label="Credit notes" value={`- ${formatMoney(creditedSoFar, cur)}`} />}
                      <tr className="font-semibold">
                        <td className="py-1">Balance due</td>
                        <td className="tabular py-1 text-right">{formatMoney(Math.max(0, totals.total - paidSoFar - creditedSoFar), cur)}</td>
                      </tr>
                    </>
                  )}
                  {refund > 0 && (
                    <tr className="font-semibold">
                      <td className="py-1">Refunded</td>
                      <td className="tabular py-1 text-right">{formatMoney(refund, cur)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {refund > 0 && (
            <div className="mt-3 text-[11px] text-stone-600">
              Refund of {formatMoney(refund, cur)} paid by {PAYMENT_METHODS[doc.paymentMethod ?? 'other']}
              {doc.refundDate ? ` on ${formatDate(doc.refundDate)}` : ''}
              {doc.paymentRef ? ` (Ref: ${doc.paymentRef})` : ''}.
            </div>
          )}

          {doc.notes && (
            <div className="mt-5 text-[11.5px]">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gold-700">
                {doc.type === 'credit_note' ? 'Reason' : 'Notes'}
              </div>
              <div className="whitespace-pre-line text-stone-700">{doc.notes}</div>
            </div>
          )}
        </>
      )}

      <div className="flex-1" />

      {/* Footer */}
      <div className="mt-8 grid grid-cols-2 gap-8 text-[11px]">
        {(showBank || showQr) && <PaymentBlock bank={showBank} qr={showQr} />}
        {doc.terms && (
          <div className={showBank || showQr ? '' : 'col-span-2'}>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gold-700">Terms & conditions</div>
            <div className="whitespace-pre-line text-stone-600">{doc.terms}</div>
          </div>
        )}
      </div>
      {doc.type === 'delivery_order' && <ReceivedBy />}
      {/* A delivery order is signed on receipt, so it drops the "no signature" line. */}
      <ComputerGeneratedNote signatureRequired={doc.type === 'delivery_order'} />
    </div>
  )
}

/** Acknowledgement box for the customer to sign when the goods arrive. */
function ReceivedBy() {
  return (
    <div className="mt-6 rounded-md border border-stone-300 px-4 py-3 text-[11px]">
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gold-700">Received in good order and condition by</div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-4">
        <SignLine label="Name" />
        <SignLine label="IC / Staff no." />
        <SignLine label="Date & time" />
        <SignLine label="Signature & company stamp" tall />
      </div>
    </div>
  )
}

function SignLine({ label, tall }: { label: string; tall?: boolean }) {
  return (
    <div>
      <div className={`border-b border-stone-400 ${tall ? 'h-12' : 'h-6'}`} />
      <div className="mt-1 text-[10px] text-stone-500">{label}</div>
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

export type MetaEntry = [label: string, value: string, bold?: boolean]

/** Company letterhead with the document title and its meta rows (no., date…). */
export function SheetHeader({ title, rows }: { title: string; rows: MetaEntry[] }) {
  const settings = useStore((s) => s.settings)
  const logo = settings.logoDataUrl || './logo.png'
  return (
    <div className="flex items-start justify-between gap-6 border-b-2 border-gold-600 pb-5">
      <div className="flex items-start gap-4">
        <img src={logo} alt="" className="h-20 w-auto max-w-[170px] object-contain" />
        <div className="pt-1 text-[11px] leading-snug text-stone-600">
          <div className="text-[15px] font-bold tracking-wide text-stone-900">{settings.companyName}</div>
          {settings.regNo && <div>Reg. No: {settings.regNo}</div>}
          {settings.address && <div className="whitespace-pre-line">{settings.address}</div>}
          <div>{[settings.phone && `Tel: ${settings.phone}`, settings.email].filter(Boolean).join(' · ')}</div>
          {settings.website && <div>{settings.website}</div>}
          {settings.sstNo && <div>SST No: {settings.sstNo}</div>}
        </div>
      </div>
      <div className="text-right">
        <div className={`whitespace-nowrap font-bold tracking-wider text-gold-700 ${title.length > 16 ? 'text-[18px]' : 'text-[22px]'}`}>{title}</div>
        <table className="ml-auto mt-2 text-[11px]">
          <tbody>
            {rows.map(([label, value, bold]) => (
              <MetaRow key={label} label={label} value={value} bold={bold} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Customer / supplier address block. */
export function PartyBlock({ label, party }: { label: string; party?: Customer }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gold-700">{label}</div>
      {party ? (
        <div className="text-[12px] leading-snug">
          <div className="font-semibold">{party.company || party.name}</div>
          {party.company && party.name && <div>Attn: {party.name}</div>}
          {party.regNo && <div className="text-stone-600">({party.regNo})</div>}
          {party.address && <div className="whitespace-pre-line text-stone-700">{party.address}</div>}
          {party.phone && <div className="text-stone-700">Tel: {party.phone}</div>}
          {party.email && <div className="text-stone-700">{party.email}</div>}
        </div>
      ) : (
        <div className="text-stone-400">—</div>
      )}
    </div>
  )
}

/** Bank details and payment QR, as shown on invoices. */
export function PaymentBlock({ bank = true, qr = true }: { bank?: boolean; qr?: boolean }) {
  const settings = useStore((s) => s.settings)
  const showQr = qr && !!settings.paymentQrDataUrl
  const showBank = bank && !!settings.bankAccountNo
  if (!showQr && !showBank) return null
  return (
    <div className="flex items-start gap-4">
      {showQr && (
        <div className="shrink-0 text-center">
          <img src={settings.paymentQrDataUrl} alt="Payment QR code" className="h-28 w-28 rounded border border-stone-200 object-contain p-1" />
          {settings.paymentQrLabel && <div className="mt-1 max-w-28 text-[9.5px] leading-tight text-stone-500">{settings.paymentQrLabel}</div>}
        </div>
      )}
      {showBank && (
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gold-700">Payment details</div>
          <div>Bank: {settings.bankName}</div>
          <div>Account name: {settings.bankAccountName}</div>
          <div>Account no.: {settings.bankAccountNo}</div>
        </div>
      )}
    </div>
  )
}

export function ComputerGeneratedNote({ signatureRequired = false }: { signatureRequired?: boolean }) {
  return (
    <div className="mt-6 border-t border-stone-200 pt-2 text-center text-[10px] text-stone-500">
      {signatureRequired ? 'This is a computer-generated document.' : 'This is a computer-generated document. No signature is required.'}
    </div>
  )
}
