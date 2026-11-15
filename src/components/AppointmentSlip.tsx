import { formatDate, toISODate } from '../lib/calc'
import { longDate, slipTermLines, time12 } from '../lib/schedule'
import { useStore } from '../lib/store'
import type { Booking, Customer } from '../lib/types'
import BrandMark from './BrandMark'
import { ComputerGeneratedNote } from './DocumentSheet'

const Label = ({ children }: { children: string }) => <div className="mb-1 text-[9.5px] font-semibold uppercase tracking-wider text-gold-700">{children}</div>

/**
 * One-page A5 appointment slip for a booked visit, in the Classic document look: the company,
 * the customer, when and where, and the terms from Settings. No prices.
 */
export default function AppointmentSlip({ booking: b, customer }: { booking: Booking; customer?: Customer }) {
  const settings = useStore((s) => s.settings)
  const terms = slipTermLines(settings.slipTerms)
  const logo = settings.logoDataUrl || './logo.png'
  const contact = [settings.phone, settings.email].filter(Boolean).join(' · ')
  const status = b.status === 'cancelled' ? 'Cancelled' : b.status === 'done' ? 'Completed' : 'Confirmed'
  const meta: [string, string, boolean?][] = [
    ['Slip no.', b.slipNo ?? '—', true],
    ['Issued', formatDate(toISODate(new Date(b.createdAt)))],
    ['Status', status],
  ]

  return (
    <div className="sheet slip mx-auto flex flex-col shadow-lg">
      {/* Letterhead: a compact version of the A4 one. */}
      <div className="flex items-start justify-between gap-4 border-b-2 border-gold-600 pb-3.5">
        <div className="flex min-w-0 items-start gap-3">
          <img src={logo} alt="" className="h-12 w-auto max-w-[96px] object-contain" />
          <div className="min-w-0 text-[9.5px] leading-snug text-stone-600">
            <div className="text-[12.5px] font-bold tracking-wide text-stone-900">{settings.companyName}</div>
            {settings.regNo && <div>Reg. No: {settings.regNo}</div>}
            {settings.address && <div className="whitespace-pre-line">{settings.address}</div>}
            <BrandMark className="h-4" />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="whitespace-nowrap text-[15px] font-bold tracking-wider text-gold-700">APPOINTMENT SLIP</div>
          {b.status === 'cancelled' && (
            <div className="mt-1 inline-block rounded-full bg-ink-900 px-2.5 py-0.5 text-[9px] font-bold tracking-[0.14em] text-gold-200">CANCELLED</div>
          )}
          <table className="ml-auto mt-1.5 text-[10px]">
            <tbody>
              {meta.map(([label, value, bold]) => (
                <tr key={label}>
                  <td className="py-0.5 pr-3 text-right text-stone-500">{label}</td>
                  <td className={`py-0.5 text-right ${bold ? 'font-semibold text-stone-900' : ''}`}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4">
        <Label>Customer</Label>
        {customer ? (
          <div className="leading-snug">
            <div className="font-semibold">{customer.company || customer.name}</div>
            {customer.company && customer.name && <div>Attn: {customer.name}</div>}
            {customer.phone && <div className="text-stone-700">Tel: {customer.phone}</div>}
          </div>
        ) : (
          <div className="text-stone-400">—</div>
        )}
      </div>

      <div className="mt-4 rounded-md border border-stone-200">
        <div className="rounded-t-md bg-ink-900 px-3.5 py-2.5 text-gold-200">
          <div className="text-[9.5px] font-semibold uppercase tracking-wider opacity-80">Appointment</div>
          <div className="mt-0.5 text-[15px] font-bold">{longDate(b.date)}</div>
          <div className="text-[12.5px] font-semibold">{b.time ? time12(b.time) : 'Any time that day'}</div>
        </div>
        <div className="grid gap-2.5 px-3.5 py-3">
          {b.title.trim() && <SlipRow label="Job" value={b.title.trim()} />}
          {b.address.trim() && <SlipRow label="Site address" value={b.address.trim()} />}
          {b.notes.trim() && <SlipRow label="Remarks" value={b.notes.trim()} />}
        </div>
      </div>

      {terms.length > 0 && (
        <div className="mt-4 text-[9.5px]">
          <Label>Notes</Label>
          <ol className="list-decimal space-y-0.5 pl-4 text-stone-600">
            {terms.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ol>
        </div>
      )}

      <div className="flex-1" />

      {contact && (
        <div className="mt-4 text-center text-[10.5px]">
          <span className="text-stone-500">Contact us: </span>
          <b className="text-stone-900">{contact}</b>
        </div>
      )}
      <ComputerGeneratedNote />
    </div>
  )
}

function SlipRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-2">
      <span className="text-stone-500">{label}</span>
      <span className="whitespace-pre-line font-medium text-stone-900 [overflow-wrap:anywhere]">{value}</span>
    </div>
  )
}
