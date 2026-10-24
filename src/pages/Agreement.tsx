import { useEffect, useRef, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { formatMoney, toISODate } from '../lib/calc'
import { dmy, SPLIT_MAX } from '../lib/split'
import { SPLIT_TERMS as TERMS } from '../lib/splitTerms'
import { usePhotoUrls } from '../lib/photos'
import { useStore } from '../lib/store'
import { DOC_META } from '../lib/types'
import BrandMark from '../components/BrandMark'
import SharePdfButton from '../components/SharePdfButton'
import SheetPreview from '../components/SheetPreview'
import { Button, PageHeader } from '../components/ui'

const DUE_NOTE = ['before work starts', '1 month after Payment 1', '2 months after Payment 1']


/** Split Payment Agreement for a split invoice (spec section 5), printable and shareable as PDF. */
export default function Agreement() {
  const { id } = useParams()
  const invoice = useStore((s) => s.documents.find((d) => d.id === id))
  const settings = useStore((s) => s.settings)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!invoice?.split) return
    const prev = document.title
    document.title = `Split Payment Agreement ${invoice.split.agreementNo}`
    return () => {
      document.title = prev
    }
  }, [invoice])

  const icUrls = usePhotoUrls(invoice?.split?.icPhotoIds ?? [])

  if (!invoice?.split) return <Navigate to={invoice ? `/d/invoices/${invoice.id}` : '/d/invoices'} replace />
  const plan = invoice.split
  // IC photos from an online application get a page of their own; ones not on this device are left out.
  const icPhotos = (plan.icPhotoIds ?? []).map((id) => icUrls[id]).filter((u): u is string => !!u)
  const pages = icPhotos.length ? 3 : 2
  const signedOn = plan.signedAt ? dmy(toISODate(new Date(plan.signedAt))) : ''
  const total = plan.payments.reduce((t, p) => t + p.amount, 0)
  const rm = (n: number) => formatMoney(n, 'RM').replace(' ', '')
  const date = toISODate(new Date(plan.createdAt || invoice.createdAt || Date.now()))

  return (
    <>
      <div className="no-print">
        <Link to={`/d/${DOC_META.invoice.path}/${invoice.id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
          <ArrowLeft size={15} /> {invoice.number}
        </Link>
        <PageHeader
          title="Split Payment Agreement"
          subtitle={`${plan.agreementNo} · ${plan.customerName}`}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => window.print()}>
                <Printer size={15} /> Print / PDF
              </Button>
              <SharePdfButton
                sheetBox={box}
                text={`Split Payment Agreement ${plan.agreementNo} for invoice ${invoice.number} — ${settings.companyName}`}
                options={{ fileName: `${plan.agreementNo}.pdf`, docNo: plan.agreementNo, heading: 'SPLIT PAYMENT AGREEMENT', company: settings.companyName, engineering: false }}
              />
            </div>
          }
        />
      </div>

      <div ref={box}>
        <SheetPreview>
          {/* Page 1: parties, scope and schedule */}
          <div className="sheet agreement mx-auto flex flex-col shadow-lg">
            <Head title="Split Payment Agreement" rows={[['Agreement No.', plan.agreementNo], ['Date', dmy(date)], ['Invoice No.', invoice.number]]} logo={settings.logoDataUrl || './logo.png'} />

            <Heading n={1}>Parties</Heading>
            <div className="grid grid-cols-2 gap-6 text-[11.5px] leading-snug">
              <div>
                <Label>Service provider</Label>
                <div className="font-semibold">{settings.companyName}</div>
                {settings.regNo && <div>SSM No.: {settings.regNo}</div>}
                {settings.address && <div className="whitespace-pre-line text-stone-700">{settings.address}</div>}
                {settings.phone && <div>Tel: {settings.phone}</div>}
                {settings.email && <div>{settings.email}</div>}
              </div>
              <div>
                <Label>Customer</Label>
                <div className="font-semibold">{plan.customerName || '—'}</div>
                <div>IC No.: {plan.icNo || '—'}</div>
                {plan.premisesAddress && <div className="whitespace-pre-line text-stone-700">{plan.premisesAddress}</div>}
                {plan.phone && <div>Tel: {plan.phone}</div>}
                {plan.email && <div>{plan.email}</div>}
              </div>
            </div>

            <Heading n={2}>Scope of work</Heading>
            <table className="w-full text-[11.5px]">
              <tbody>
                <Fact label="Quotation No." value={plan.quotationNo || '—'} />
                <Fact label="Description of work" value={plan.workDescription || '—'} />
                <Fact label="Site address" value={plan.premisesAddress || '—'} />
                <Fact label="Total job value" value={`${rm(total)} (maximum ${rm(SPLIT_MAX)})`} bold />
                <Fact label="Planned work date" value={plan.plannedWorkDate ? dmy(plan.plannedWorkDate) : 'To be confirmed after Payment 1'} />
              </tbody>
            </table>
            <p className="mt-2 text-[10.5px] italic text-stone-600">
              Any work outside this scope will be quoted separately and is not covered by this split payment plan.
            </p>

            <Heading n={3}>Payment schedule</Heading>
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr className="bg-ink-900 text-left text-[10.5px] uppercase tracking-wide text-gold-200">
                  <th className="px-2 py-1.5 font-semibold">Payment</th>
                  <th className="px-2 py-1.5 font-semibold">Share</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Amount (RM)</th>
                  <th className="px-2 py-1.5 font-semibold">Due date</th>
                </tr>
              </thead>
              <tbody>
                {plan.payments.map((p, i) => (
                  <tr key={p.seq} className="border-b border-stone-200">
                    <td className="px-2 py-1.5 font-medium">{i === 0 ? 'Payment 1 (deposit)' : `Payment ${p.seq}`}</td>
                    <td className="px-2 py-1.5">{p.pct}%</td>
                    <td className="tabular px-2 py-1.5 text-right">{formatMoney(p.amount, '').trim()}</td>
                    <td className="px-2 py-1.5">
                      {dmy(p.dueDate)} <span className="text-stone-500">({DUE_NOTE[i]})</span>
                    </td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className="px-2 py-1.5" colSpan={2}>
                    Total
                  </td>
                  <td className="tabular px-2 py-1.5 text-right">{formatMoney(total, '').trim()}</td>
                  <td />
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-[10.5px] text-stone-600">
              Payments 1 and 2 are rounded to the nearest RM1.00. Payment 3 is the balance, so the three payments add up exactly to the total job value.
            </p>

            <div className="mt-4 rounded-md border border-gold-600 p-3 text-[11.5px]">
              <Label>Payment details</Label>
              <div>Account name: {settings.companyName}</div>
              <div>Bank: {settings.bankName || '—'}</div>
              <div>Account no.: {settings.bankAccountNo || '—'}</div>
              <div>Reference: {plan.agreementNo}</div>
              <div className="mt-1.5 text-stone-600">Please send the payment slip via WhatsApp. A receipt will be issued for each payment.</div>
            </div>
            <div className="flex-1" />
            <PageFoot no={plan.agreementNo} page={`1 of ${pages}`} />
          </div>

          {/* Page 2: terms, declaration and signatures */}
          <div className="sheet agreement next-page mx-auto mt-6 flex flex-col shadow-lg print:mt-0">
            <Head title="Split Payment Agreement" rows={[['Agreement No.', plan.agreementNo]]} logo={settings.logoDataUrl || './logo.png'} small />

            <Heading n={4}>Terms and conditions</Heading>
            <ol className="space-y-1.5 text-[11.2px] leading-snug">
              {TERMS.map(([title, text], i) => (
                <li key={title} className="flex gap-2">
                  <span className="w-5 shrink-0 font-semibold text-gold-700">{i + 1}.</span>
                  <span>
                    <b>{title}.</b> {text}
                  </span>
                </li>
              ))}
            </ol>

            <Heading n={5}>Declaration and signatures</Heading>
            <p className="text-[11.5px]">
              I confirm that I have read and understood the payment schedule and terms above, and I agree to pay the full job value according to this
              schedule.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-8 text-[11px]">
              <SignBlock title="Customer" lines={[['Name', plan.customerName], ['IC No.', plan.icNo], ['Date', signedOn]]} signature={plan.customerSignature} />
              <SignBlock
                title={settings.companyName}
                lines={[['Name', settings.signerName], ['Position', settings.signerPosition], ['Date', dmy(date)]]}
                signature={settings.signatureDataUrl}
                stamp={settings.stampDataUrl || true}
              />
            </div>
            <p className="mt-5 text-[10.5px] italic text-stone-600">
              A copy of the Customer&apos;s IC is attached to this agreement.
              {plan.customerSignature && ` Signed electronically by the Customer through ${settings.companyName}'s online application form on ${signedOn}.`}
            </p>
            <div className="flex-1" />
            <PageFoot no={plan.agreementNo} page={`2 of ${pages}`} />
          </div>

          {icPhotos.length > 0 && (
            <div className="sheet agreement next-page mx-auto mt-6 flex flex-col shadow-lg print:mt-0">
              <Head title="Split Payment Agreement" rows={[['Agreement No.', plan.agreementNo]]} logo={settings.logoDataUrl || './logo.png'} small />
              <Heading n={6}>Copy of the Customer&apos;s IC</Heading>
              <p className="text-[11px] text-stone-600">
                {plan.customerName} · IC No. {plan.icNo}
              </p>
              <div className="mt-4 grid gap-5">
                {icPhotos.map((src, i) => (
                  <figure key={src} className="m-0">
                    <img src={src} alt={i ? 'IC back' : 'IC front'} className="mx-auto max-h-[330px] max-w-full rounded border border-stone-200 object-contain" />
                    <figcaption className="mt-1 text-center text-[10px] text-stone-500">{i ? 'Back' : 'Front'}</figcaption>
                  </figure>
                ))}
              </div>
              <div className="flex-1" />
              <PageFoot no={plan.agreementNo} page={`3 of ${pages}`} />
            </div>
          )}
        </SheetPreview>
      </div>
    </>
  )
}

function Head({ title, rows, logo, small }: { title: string; rows: [string, string][]; logo: string; small?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b-2 border-gold-600 pb-4">
      <div>
        <img src={logo} alt="" className={`${small ? 'h-12' : 'h-16'} w-auto max-w-[150px] object-contain`} />
        <BrandMark className="h-4" />
      </div>
      <div className="text-right">
        <div className={`whitespace-nowrap font-bold tracking-wider text-gold-700 ${small ? 'text-[16px]' : 'text-[20px]'}`}>{title.toUpperCase()}</div>
        <table className="ml-auto mt-1.5 text-[11px]">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}>
                <td className="pr-3 text-right text-stone-500">{k}</td>
                <td className="text-right font-semibold">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const Heading = ({ n, children }: { n: number; children: ReactNode }) => (
  <h2 className="mb-2 mt-5 text-[12px] font-bold uppercase tracking-wider text-stone-900">
    <span className="text-gold-700">{n}.</span> {children}
  </h2>
)
const Label = ({ children }: { children: ReactNode }) => <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gold-700">{children}</div>

function Fact({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <tr className="border-b border-stone-100 align-top">
      <td className="w-44 py-1.5 pr-3 text-stone-500">{label}</td>
      <td className={`whitespace-pre-line py-1.5 ${bold ? 'font-bold' : ''}`}>{value}</td>
    </tr>
  )
}

function SignBlock({ title, lines, signature, stamp }: { title: string; lines: [string, string][]; signature?: string; stamp?: string | boolean }) {
  return (
    <div>
      <Label>{title}</Label>
      {/* Signature image sits on the line; without one, the space is left to sign by hand. */}
      <div className="relative mt-14 border-b border-stone-500">
        {signature && <img src={signature} alt="Signature" className="absolute bottom-0 left-2 h-12 max-w-[70%] object-contain" />}
      </div>
      <div className="mt-1 text-[10px] text-stone-500">Signature</div>
      {lines.map(([k, v]) => (
        <div key={k} className="mt-3 flex items-end gap-2">
          <span className="w-16 shrink-0 text-stone-500">{k}</span>
          <span className="flex-1 border-b border-stone-300 pb-0.5 font-medium">{v || ' '}</span>
        </div>
      ))}
      {typeof stamp === 'string' ? (
        <div className="mt-4 flex h-24 items-center">
          <img src={stamp} alt="Company stamp" className="h-full max-w-[60%] object-contain" />
        </div>
      ) : (
        stamp && <div className="mt-4 grid h-20 place-items-center rounded border border-dashed border-stone-300 text-[10px] text-stone-400">Company stamp</div>
      )}
    </div>
  )
}

const PageFoot = ({ no, page }: { no: string; page: string }) => (
  <div className="mt-6 flex justify-between border-t border-stone-200 pt-2 text-[10px] text-stone-500">
    <span>{no}</span>
    <span>Page {page}</span>
  </div>
)
