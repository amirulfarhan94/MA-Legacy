import { Fragment, type ReactNode } from 'react'
import { amountInWords, docTotals, formatDate, formatMoney, hasPricedSubs, invoiceCredited, invoicePaid, lineTotal, subAmount } from '../lib/calc'
import { brandOfLine } from '../lib/brand'
import { useStore } from '../lib/store'
import { DOC_META, PAYMENT_METHODS, isPricedDoc, type Brand, type Customer, type Document, type DocType } from '../lib/types'
import { BrandFooter, BrandLogo, BrandSignature, brandVars, usePrintBrand } from './BrandPrint'

const money = (n: number) => formatMoney(n, '').trim()
const pad2 = (n: number) => String(n).padStart(2, '0')

/** Short line under the title saying what kind of paper this is. */
export const KICKER: Record<DocType | 'statement', string> = {
  quotation: 'Sales · Offer',
  proforma: 'Sales · Advance billing',
  invoice: 'Sales · Billing',
  delivery_order: 'Logistics · Delivery',
  receipt: 'Payment · Acknowledgement',
  credit_note: 'Sales · Adjustment',
  service_report: 'Field service',
  purchase_order: 'Purchasing',
  statement: 'Accounts · Statement',
}

const PARTY_LABEL: Partial<Record<DocType, string>> = {
  receipt: 'Received from',
  service_report: 'Customer',
  delivery_order: 'Customer',
  credit_note: 'Credit to',
  purchase_order: 'Supplier',
}

/** Text for a CSS string literal. */
const cssString = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')}"`

/**
 * Engineering-style A4 sheet. On paper every page gets the document number and "PAGE n / N"
 * at the foot, and pages after the first get a running head with the company and document.
 */
export function EngSheet({ docNo, title, brand, children }: { docNo: string; title: string; brand?: Brand; children: ReactNode }) {
  const legalName = useStore((s) => s.settings.companyName)
  const company = brand ? brand.name : legalName
  const box = "font-family: 'IBM Plex Mono', monospace; font-size: 7pt; letter-spacing: .12em; color: #4e5663;"
  const css =
    `@page eng { ` +
    `@bottom-right { content: ${cssString(`${docNo} · PAGE `)} counter(page) " / " counter(pages); ${box} } ` +
    `@top-left { content: ${cssString(company.toUpperCase())}; ${box} } ` +
    `@top-right { content: ${cssString(`${title} ${docNo} · CONTINUED`)}; ${box} } } ` +
    `@page eng:first { @top-left { content: none } @top-right { content: none } }`
  return (
    <div className={`sheet eng mx-auto flex flex-col shadow-lg${brand ? ' brand' : ''}`} style={brand && brandVars(brand)}>
      <style>{css}</style>
      <i className="eng-ruler" aria-hidden="true" />
      {children}
    </div>
  )
}

export function EngHeader({ title, kicker, cells, brand }: { title: string; kicker: string; cells: [string, string][]; brand?: Brand }) {
  const settings = useStore((s) => s.settings)
  const info = [
    brand ? brandOfLine(settings) : settings.regNo && `SSM ${settings.regNo}`,
    settings.address,
    [settings.phone, settings.email].filter(Boolean).join(' · '),
    settings.website,
    settings.sstNo && `SST ${settings.sstNo}`,
  ]
    .filter(Boolean)
    .join('\n')
  const size = title.length > 14 ? 'long' : title.length > 9 ? 'mid' : ''
  return (
    <>
      <div className="eng-head">
        {brand ? (
          // Trading brand: its logo, with the legal entity it belongs to underneath.
          <div className="eng-brand">
            <BrandLogo brand={brand} />
            <div className="eng-co-info">{info}</div>
          </div>
        ) : (
          <div className="eng-co">
            <img src={settings.logoDataUrl || './logo-mark.png'} alt="" />
            <div className="min-w-0">
              <div className="eng-co-name">{settings.companyName}</div>
              {info && <div className="eng-co-info">{info}</div>}
            </div>
          </div>
        )}
        <div className="eng-title">
          <b className={size}>{title}</b>
          <span>{kicker}</span>
        </div>
      </div>
      <div className="eng-block">
        {cells.map(([label, value]) => (
          <div key={label}>
            <span className="eng-lab">{label}</span>
            <span className="eng-v">{value}</span>
          </div>
        ))}
      </div>
    </>
  )
}

export function EngParty({ label, party }: { label: string; party?: Customer }) {
  const info = party
    ? [party.company && party.name && `Attn: ${party.name}`, party.regNo && `(${party.regNo})`, party.address, party.phone && `Tel: ${party.phone}`, party.email]
        .filter(Boolean)
        .join('\n')
    : ''
  return (
    <div>
      <span className="eng-cap">{label}</span>
      <div className="eng-party-name">{party ? party.company || party.name : '—'}</div>
      {info && <div className="eng-party-info">{info}</div>}
    </div>
  )
}

export function EngAmountBox({ label, amount, currency, sub }: { label: string; amount: number; currency: string; sub?: string }) {
  return (
    <div className="eng-due">
      <span className="eng-lab">{label}</span>
      <div className="eng-due-amt">
        <small>{currency}</small>
        {money(amount)}
      </div>
      {sub && <div className="eng-due-sub">{sub}</div>}
    </div>
  )
}

/** Bank details and payment QR from Settings; nothing when neither is set. */
export function EngPayment({ bank = true, qr = true, reference, legalName = false }: { bank?: boolean; qr?: boolean; reference?: string; legalName?: boolean }) {
  const settings = useStore((s) => s.settings)
  const showBank = bank && !!settings.bankAccountNo
  const showQr = qr && !!settings.paymentQrDataUrl
  if (!showBank && !showQr) return null
  return (
    <div className="eng-box eng-pay">
      <div>
        <span className="eng-lab">Payment details</span>
        {showBank && (
          <dl>
            <dt>Bank</dt>
            <dd>{settings.bankName || '—'}</dd>
            <dt>Account no.</dt>
            <dd className="m">{settings.bankAccountNo}</dd>
            <dt>Account name</dt>
            <dd>{legalName ? settings.companyName : settings.bankAccountName || settings.companyName}</dd>
            {reference && (
              <>
                <dt>Reference</dt>
                <dd className="m">{reference}</dd>
              </>
            )}
          </dl>
        )}
      </div>
      {showQr && (
        <div className="eng-qr">
          <img src={settings.paymentQrDataUrl} alt="Payment QR code" />
          {settings.paymentQrLabel && <div>{settings.paymentQrLabel}</div>}
        </div>
      )}
    </div>
  )
}

export function EngTerms({ label = 'Terms & conditions', text }: { label?: string; text: string }) {
  if (!text) return null
  return (
    <div className="eng-terms">
      <span className="eng-cap">{label}</span>
      <p>{text}</p>
    </div>
  )
}

export function EngFooter({ docNo, signatureRequired = false }: { docNo: string; signatureRequired?: boolean }) {
  return (
    <div className="eng-foot">
      <span>{signatureRequired ? 'This is a computer-generated document.' : 'This is a computer-generated document. No signature is required.'}</span>
      <b>{docNo}</b>
    </div>
  )
}

/** Engineering-style rendering of any document type, with the same content as the Classic sheet. */
export default function EngineeringSheet({ doc, customer }: { doc: Document; customer?: Customer }) {
  const settings = useStore((s) => s.settings)
  const documents = useStore((s) => s.documents)
  const brand = usePrintBrand(doc)
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

  const paid = doc.type === 'invoice' ? invoicePaid(doc.id, documents) : 0
  const credited = doc.type === 'invoice' ? invoiceCredited(doc.id, documents) : 0
  const balance = Math.max(0, totals.total - paid - credited)
  const refund = doc.type === 'credit_note' ? Number(doc.refundAmount) || 0 : 0
  const dueLabel = doc.type === 'quotation' ? 'Valid until' : doc.type === 'purchase_order' ? 'Delivery date' : 'Due date'

  const cells: [string, string][] = [
    ['Document no.', doc.number],
    ['Date', formatDate(doc.date)],
    ...(doc.dueDate ? [[dueLabel, formatDate(doc.dueDate)] as [string, string]] : []),
    ['Reference', doc.reference || '—'],
  ]

  // The box beside the customer: what this paper asks for or confirms.
  let summary: ReactNode = null
  if (doc.type === 'invoice') {
    summary = (
      <EngAmountBox
        label={balance > 0.005 ? 'Amount due' : 'Balance'}
        amount={balance}
        currency={cur}
        sub={balance > 0.005 ? (doc.dueDate ? `By ${formatDate(doc.dueDate)} · ref ${doc.number}` : `Ref ${doc.number}`) : 'Paid in full · thank you'}
      />
    )
  } else if (doc.type === 'proforma') {
    summary = <EngAmountBox label="Amount payable" amount={totals.total} currency={cur} sub={doc.dueDate ? `By ${formatDate(doc.dueDate)}` : undefined} />
  } else if (doc.type === 'quotation') {
    summary = <EngAmountBox label="Quoted total" amount={totals.total} currency={cur} sub={doc.dueDate ? `Valid until ${formatDate(doc.dueDate)}` : undefined} />
  } else if (doc.type === 'purchase_order') {
    summary = <EngAmountBox label="Order total" amount={totals.total} currency={cur} sub={doc.dueDate ? `Deliver by ${formatDate(doc.dueDate)}` : undefined} />
  } else if (doc.type === 'credit_note') {
    summary = (
      <EngAmountBox
        label="Credit amount"
        amount={totals.total}
        currency={cur}
        sub={invoice ? `Against ${invoice.number} · ${formatDate(invoice.date)} · ${money(docTotals(invoice).total)}` : undefined}
      />
    )
  } else if (doc.type === 'receipt') {
    summary = (
      <EngAmountBox
        label="Amount received"
        amount={doc.amountPaid ?? 0}
        currency={cur}
        sub={`${PAYMENT_METHODS[doc.paymentMethod ?? 'other']}${doc.paymentRef ? ` · ref ${doc.paymentRef}` : ''}`}
      />
    )
  } else if (doc.type === 'service_report' && doc.service) {
    const s = doc.service
    const facts: [string, string][] = [
      ['Technician', s.technician || '—'],
      ['Location', s.location || '—'],
      ['Equipment', s.equipment || '—'],
      ...(s.serialNo ? [['Model / S/N', s.serialNo] as [string, string]] : []),
      ...(s.timeIn || s.timeOut ? [['Time', `${s.timeIn || '—'} to ${s.timeOut || '—'}`] as [string, string]] : []),
      ...(s.acknowledgedBy ? [['Acknowledged by', s.acknowledgedBy] as [string, string]] : []),
    ]
    summary = (
      <div className="eng-due">
        <span className="eng-lab">Service info</span>
        <dl className="eng-facts">
          {facts.map(([k, v]) => (
            <Fragment key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </Fragment>
          ))}
        </dl>
      </div>
    )
  } else if (doc.type === 'delivery_order') {
    summary = (
      <div>
        <span className="eng-cap">Deliver to</span>
        <div className="eng-party-info mt-[7px]">{deliverTo || '—'}</div>
      </div>
    )
  }

  const words = isPriced ? amountInWords(totals.total) : ''
  const payment = (
    <EngPayment bank={showBank} qr={showQr} reference={doc.type === 'invoice' || doc.type === 'proforma' ? doc.number : undefined} legalName={!!brand} />
  )

  return (
    <EngSheet docNo={doc.number} title={meta.title} brand={brand}>
      <EngHeader title={meta.title} kicker={KICKER[doc.type]} cells={cells} brand={brand} />

      <div className="eng-parties">
        <div className="eng-stack">
          <EngParty label={PARTY_LABEL[doc.type] ?? 'Bill to'} party={customer} />
          {doc.type === 'purchase_order' && (
            <div>
              <span className="eng-cap">Deliver to</span>
              <div className="eng-party-info mt-[7px]">{deliverTo || '—'}</div>
            </div>
          )}
        </div>
        <div>{summary}</div>
      </div>

      {doc.type === 'receipt' ? (
        <dl className="eng-receipt">
          <dt>The sum of</dt>
          <dd>{amountInWords(doc.amountPaid ?? 0)}</dd>
          <dt>Being payment for</dt>
          <dd>{doc.notes || (invoice ? `Invoice ${invoice.number}` : '—')}</dd>
          <dt>Payment method</dt>
          <dd>
            {PAYMENT_METHODS[doc.paymentMethod ?? 'other']}
            {doc.paymentRef ? ` (Ref: ${doc.paymentRef})` : ''}
          </dd>
          {invoice && (
            <>
              <dt>Invoice no.</dt>
              <dd className="eng-mono">{invoice.number}</dd>
            </>
          )}
        </dl>
      ) : (
        <>
          {doc.type === 'service_report' && doc.service && (
            <>
              <EngSection title="Problem reported" text={doc.service.problem} />
              <EngSection title="Work carried out" text={doc.service.workDone} />
              {doc.service.recommendation && <EngSection title="Recommendation" text={doc.service.recommendation} />}
            </>
          )}

          {(doc.items.length > 0 || isPriced) && (
            <table className="eng-items">
              {doc.type === 'service_report' && (
                <caption>
                  <span className="eng-cap">Parts / materials used</span>
                </caption>
              )}
              <thead>
                <tr>
                  <th>#</th>
                  <th>Description</th>
                  <th className="r">Qty</th>
                  <th>Unit</th>
                  {isPriced && <th className="r">Unit price</th>}
                  {adj && <th className="r">Disc</th>}
                  {adj && <th className="r">{settings.taxLabel}</th>}
                  {isPriced && <th className="r">Amount ({cur})</th>}
                </tr>
              </thead>
              <tbody>
                {doc.items.map((it, i) => {
                  const subs = it.subItems ?? []
                  const fromSubs = isPriced && hasPricedSubs(it)
                  let n = 0
                  return (
                    <Fragment key={it.id}>
                      <tr className={subs.length ? 'has-subs' : ''}>
                        <td className="idx">{pad2(i + 1)}</td>
                        <td className="desc">{it.description}</td>
                        <td className="r">{fromSubs ? '' : it.qty}</td>
                        <td>{fromSubs ? '' : it.unit}</td>
                        {isPriced && <td className="r">{fromSubs ? '' : money(it.unitPrice)}</td>}
                        {adj && <td className="r">{it.discountPct ? `${it.discountPct}%` : '—'}</td>}
                        {adj && <td className="r">{`${it.taxRate ?? doc.taxRate}%`}</td>}
                        {isPriced && <td className="r">{money(lineTotal(it, adj))}</td>}
                      </tr>
                      {subs.map((sItem, k) => {
                        const priced = isPriced && sItem.priced
                        return (
                          <tr key={sItem.id} className={`sub${k === subs.length - 1 ? ' last' : ''}`}>
                            <td />
                            <td className="desc">
                              <span className="mk">{priced ? `${i + 1}.${++n}` : '•'}</span>
                              {sItem.description}
                            </td>
                            <td className="r">{sItem.qty ? sItem.qty : ''}</td>
                            <td>{sItem.qty ? sItem.unit : ''}</td>
                            {isPriced && <td className="r">{priced ? money(sItem.unitPrice) : ''}</td>}
                            {adj && <td />}
                            {adj && <td />}
                            {isPriced && <td className="r">{priced ? money(subAmount(sItem)) : ''}</td>}
                          </tr>
                        )
                      })}
                    </Fragment>
                  )
                })}
                {doc.items.length === 0 && (
                  <tr className="empty">
                    <td colSpan={8}>No items</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {isPriced && (
            <div className="eng-sum">
              <div className="eng-left">
                <div className="eng-box">
                  <span className="eng-lab">Amount in words</span>
                  <p>{words}</p>
                </div>
                {payment}
              </div>
              <div className="eng-totals">
                <div className="row">
                  <span>Subtotal</span>
                  <span>{money(totals.subtotal)}</span>
                </div>
                {totals.discount > 0 && (
                  <div className="row">
                    <span>Discount</span>
                    <span>− {money(totals.discount)}</span>
                  </div>
                )}
                {totals.taxLines.map((t) => (
                  <div className="row" key={t.rate}>
                    <span>{adj ? `${settings.taxLabel} ${t.rate}% on ${money(t.base)}` : `${settings.taxLabel} (${t.rate}%)`}</span>
                    <span>{money(t.tax)}</span>
                  </div>
                ))}
                <div className="row total">
                  <span>TOTAL ({cur})</span>
                  <span>{money(totals.total)}</span>
                </div>
                {doc.type === 'invoice' && paid + credited > 0 && (
                  <>
                    {paid > 0 && (
                      <div className="row">
                        <span>Paid</span>
                        <span>− {money(paid)}</span>
                      </div>
                    )}
                    {credited > 0 && (
                      <div className="row">
                        <span>Credit notes</span>
                        <span>− {money(credited)}</span>
                      </div>
                    )}
                    <div className="row bal">
                      <span>Balance due</span>
                      <span>{formatMoney(balance, cur)}</span>
                    </div>
                  </>
                )}
                {refund > 0 && (
                  <div className="row bal">
                    <span>Refunded</span>
                    <span>{formatMoney(refund, cur)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {refund > 0 && (
            <p className="eng-note">
              Refund of {formatMoney(refund, cur)} paid by {PAYMENT_METHODS[doc.paymentMethod ?? 'other']}
              {doc.refundDate ? ` on ${formatDate(doc.refundDate)}` : ''}
              {doc.paymentRef ? ` (Ref: ${doc.paymentRef})` : ''}.
            </p>
          )}

          {!isPriced && (showBank || showQr) && <div className="mt-4">{payment}</div>}

          {doc.notes && <EngSection title={doc.type === 'credit_note' ? 'Reason' : 'Notes'} text={doc.notes} plain />}
        </>
      )}

      <div className="eng-grow" />
      <EngTerms text={doc.terms} />
      {doc.type === 'delivery_order' && (
        <div className="eng-sign">
          <span className="eng-cap">Received in good order and condition by</span>
          <div className="eng-sign-grid">
            {[
              ['Name', false],
              ['IC / Staff no.', false],
              ['Date & time', false],
              ['Signature & company stamp', true],
            ].map(([label, tall]) => (
              <section key={label as string}>
                <div className={tall ? 'tall' : ''} />
                <span>{label as string}</span>
              </section>
            ))}
          </div>
        </div>
      )}
      {brand ? (
        <>
          <BrandSignature brand={brand} />
          <BrandFooter brand={brand} docNo={doc.number} />
        </>
      ) : (
        <EngFooter docNo={doc.number} signatureRequired={doc.type === 'delivery_order'} />
      )}
    </EngSheet>
  )
}

function EngSection({ title, text, plain }: { title: string; text: string; plain?: boolean }) {
  return (
    <div className="eng-section">
      <span className="eng-cap">{title}</span>
      {plain ? <p className="eng-note whitespace-pre-line">{text}</p> : <div className="eng-box"><p className="!mt-0">{text || '—'}</p></div>}
    </div>
  )
}

