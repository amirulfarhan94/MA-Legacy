import { formatDate, toISODate } from '../lib/calc'
import { longDate, slipTermLines, time12 } from '../lib/schedule'
import { useStore } from '../lib/store'
import type { Booking, Customer } from '../lib/types'
import { EngFooter, EngHeader, EngParty } from './EngineeringSheet'

/**
 * One-page A5 appointment slip for a booked visit, in the engineering document style: the
 * company, the customer, when and where, and the terms from Settings. No prices.
 */
export default function AppointmentSlip({ booking: b, customer }: { booking: Booking; customer?: Customer }) {
  const settings = useStore((s) => s.settings)
  const terms = slipTermLines(settings.slipTerms)
  const issued = formatDate(toISODate(new Date(b.createdAt)))
  const contact = [settings.phone, settings.email].filter(Boolean).join(' · ')
  const status = b.status === 'cancelled' ? 'Cancelled' : b.status === 'done' ? 'Completed' : 'Confirmed'

  return (
    <div className="sheet eng slip mx-auto flex flex-col shadow-lg">
      <i className="eng-ruler" aria-hidden="true" />
      <EngHeader
        title="APPOINTMENT SLIP"
        kicker="Schedule · Site visit"
        cells={[
          ['Slip no.', b.slipNo ?? '—'],
          ['Issued', issued],
          ['Status', status],
        ]}
        badge={b.status === 'cancelled' ? 'CANCELLED' : undefined}
      />

      <div className="slip-party">
        <EngParty label="Customer" party={customer} />
      </div>

      <div className="slip-when">
        <span className="eng-cap">Appointment</span>
        <div className="slip-date">{longDate(b.date)}</div>
        <div className="slip-time">{b.time ? time12(b.time) : 'Any time that day'}</div>
        <dl className="slip-facts">
          {b.title.trim() && (
            <div>
              <dt className="eng-lab">Job</dt>
              <dd>{b.title.trim()}</dd>
            </div>
          )}
          {b.address.trim() && (
            <div>
              <dt className="eng-lab">Site address</dt>
              <dd>{b.address.trim()}</dd>
            </div>
          )}
          {b.notes.trim() && (
            <div>
              <dt className="eng-lab">Notes</dt>
              <dd>{b.notes.trim()}</dd>
            </div>
          )}
        </dl>
      </div>

      {terms.length > 0 && (
        <div className="eng-terms slip-terms">
          <span className="eng-cap">Terms</span>
          <ol>
            {terms.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-auto">
        {contact && (
          <div className="slip-contact">
            <span className="eng-lab">Contact us</span>
            <b>{contact}</b>
          </div>
        )}
        <EngFooter docNo={b.slipNo ?? ''} />
      </div>
    </div>
  )
}
