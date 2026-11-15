import { useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, MessageCircle, Printer } from 'lucide-react'
import AppointmentSlip from '../components/AppointmentSlip'
import SharePdfButton from '../components/SharePdfButton'
import SheetPreview from '../components/SheetPreview'
import { Button, buttonClass, Card, EmptyState } from '../components/ui'
import { today } from '../lib/calc'
import { waHref } from '../lib/contact'
import { longDate, nextSlipNumber, slipMessage, time12 } from '../lib/schedule'
import { customerLabel, useStore } from '../lib/store'

/** A booking's A5 appointment slip, to print or send to the customer. */
export default function AppointmentSlipPage() {
  const { id } = useParams()
  const booking = useStore((s) => s.bookings.find((b) => b.id === id))
  const customer = useStore((s) => s.customers.find((c) => c.id === booking?.customerId))
  const settings = useStore((s) => s.settings)
  const saveBooking = useStore((s) => s.saveBooking)
  const sheetBox = useRef<HTMLDivElement>(null)

  // The first time a slip is opened, the booking gets its slip number; it keeps it for good.
  useEffect(() => {
    // Read the store again: the booking above may already be out of date (React runs this twice in development).
    const all = useStore.getState().bookings
    const current = all.find((b) => b.id === booking?.id)
    if (!current || current.slipNo) return
    saveBooking({ ...current, slipNo: nextSlipNumber(settings.slipPrefix || 'AP', today(), all), updatedAt: new Date().toISOString() })
  }, [booking, saveBooking, settings.slipPrefix])

  // The browser uses the page title as the default PDF file name.
  useEffect(() => {
    if (!booking?.slipNo) return
    const prev = document.title
    document.title = `Appointment slip ${booking.slipNo.replace(/\//g, '-')}`
    return () => {
      document.title = prev
    }
  }, [booking?.slipNo])

  if (!booking) {
    return (
      <Card>
        <EmptyState title="Booking not found" action={<Link to="/schedule" className="text-sm text-gold-700 underline">Back to schedule</Link>} />
      </Card>
    )
  }

  const message = slipMessage(booking, settings.companyName, customer)
  const when = [longDate(booking.date), booking.time ? time12(booking.time) : 'any time'].join(' · ')

  return (
    <>
      {/* Paper for this page is A5 (index.css: @page slip). */}
      <div className="no-print">
        <Link to="/schedule" className="mb-3 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
          <ArrowLeft size={15} /> Schedule
        </Link>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-[23px] font-normal leading-tight tracking-[-0.02em] text-stone-900 sm:text-[26px]">
              {booking.slipNo ?? 'Appointment slip'}
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              Appointment slip · {customer ? `${customerLabel(customer)} · ` : ''}
              {when}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => window.print()}>
              <Printer size={15} /> Print / PDF
            </Button>
            <SharePdfButton
              sheetBox={sheetBox}
              text={message}
              options={{
                fileName: `Appointment slip ${(booking.slipNo ?? '').replace(/\//g, '-')}.pdf`,
                docNo: booking.slipNo ?? '',
                heading: 'APPOINTMENT SLIP',
                company: settings.companyName,
                engineering: true,
                paper: 'a5',
              }}
            />
            {customer?.phone && (
              <a href={waHref(customer.phone, message)} target="_blank" rel="noreferrer" className={buttonClass()}>
                <MessageCircle size={15} className="text-[var(--good)]" /> WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>

      <div ref={sheetBox}>
        <SheetPreview>
          <AppointmentSlip booking={booking} customer={customer} />
        </SheetPreview>
      </div>
    </>
  )
}
