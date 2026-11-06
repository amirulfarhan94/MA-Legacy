import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarDays, Check, ClipboardCheck, MessageCircle, Pencil, Phone, Plus, Send } from 'lucide-react'
import PartyPicker from '../components/PartyPicker'
import { Button, buttonClass, Card, EmptyState, Field, Input, Modal, PageHeader, Textarea } from '../components/ui'
import { formatDate, today } from '../lib/calc'
import { telHref, waHref } from '../lib/contact'
import { confirmMessage, groupBookings, onTheWayMessage, time12 } from '../lib/schedule'
import { contactKind, customerLabel, uid, useStore } from '../lib/store'
import { DOC_META, type Booking } from '../lib/types'

const blankBooking = (): Booking => ({
  id: uid(),
  date: today(),
  time: '',
  customerId: '',
  title: '',
  address: '',
  notes: '',
  status: 'booked',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

/** Booked visits: today first, with WhatsApp messages to confirm the booking or say we are on the way. */
export default function Schedule() {
  const bookings = useStore((s) => s.bookings)
  const [editing, setEditing] = useState<Booking | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [showPast, setShowPast] = useState(false)
  const [params, setParams] = useSearchParams()
  const asOf = today()
  const groups = useMemo(() => groupBookings(bookings, asOf), [bookings, asOf])

  // "Booking" in the Create sheet lands here with ?new=1.
  useEffect(() => {
    if (params.get('new') !== '1') return
    setEditing(blankBooking())
    setIsNew(true)
    setParams({}, { replace: true })
  }, [params, setParams])

  const open = (b: Booking) => {
    setEditing(b)
    setIsNew(false)
  }
  const sections: [string, Booking[], string?][] = [
    ['Not marked done', groups.overdue, 'text-red-700'],
    ['Today', groups.today],
    ['Tomorrow', groups.tomorrow],
    ['Later', groups.later],
  ]
  const upcoming = groups.overdue.length + groups.today.length + groups.tomorrow.length + groups.later.length

  return (
    <>
      <PageHeader
        title="Schedule"
        subtitle="Booked visits, today first. Confirm them with the customer and let them know when you are on the way."
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setEditing(blankBooking())
              setIsNew(true)
            }}
          >
            <Plus size={15} /> New booking
          </Button>
        }
      />

      {upcoming === 0 && (
        <Card>
          <EmptyState title="Nothing booked" text="Add a booking when a customer asks for a visit: the day, the time if agreed, and what the job is." />
        </Card>
      )}

      <div className="space-y-5">
        {sections.map(([title, list, cls]) =>
          list.length ? (
            <section key={title}>
              <h2 className={`mb-2 px-1 text-xs font-bold uppercase tracking-wider ${cls ?? 'text-stone-500'}`}>
                {title} · {list.length}
              </h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {list.map((b) => (
                  <BookingCard key={b.id} booking={b} showDate={title !== 'Today' && title !== 'Tomorrow'} onEdit={() => open(b)} />
                ))}
              </div>
            </section>
          ) : null,
        )}

        {groups.past.length > 0 && (
          <section>
            <button type="button" onClick={() => setShowPast((v) => !v)} className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-stone-500 hover:text-stone-800">
              Done and cancelled · {groups.past.length} {showPast ? '▴' : '▾'}
            </button>
            {showPast && (
              <div className="grid gap-3 lg:grid-cols-2">
                {groups.past.slice(0, 30).map((b) => (
                  <BookingCard key={b.id} booking={b} showDate onEdit={() => open(b)} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <BookingModal booking={editing} isNew={isNew} onClose={() => setEditing(null)} />
    </>
  )
}

function BookingCard({ booking: b, showDate, onEdit }: { booking: Booking; showDate: boolean; onEdit: () => void }) {
  const customer = useStore((s) => s.customers.find((c) => c.id === b.customerId))
  const saveBooking = useStore((s) => s.saveBooking)
  const phone = customer?.phone
  const isOpen = b.status === 'booked'

  return (
    <Card className={isOpen ? '' : 'opacity-70'}>
      <div className="flex items-start gap-3 p-4">
        <div className="w-16 shrink-0 text-center">
          <div className="text-sm font-bold text-stone-900">{b.time ? time12(b.time) : 'Any time'}</div>
          {showDate && <div className="mt-0.5 text-[11px] text-stone-500">{formatDate(b.date).slice(0, 6)}</div>}
          {!isOpen && <div className={`mt-1 text-[11px] font-semibold ${b.status === 'done' ? 'text-emerald-700' : 'text-stone-500'}`}>{b.status === 'done' ? 'Done' : 'Cancelled'}</div>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-stone-900">{b.title || 'Visit'}</div>
          {customer && <div className="truncate text-sm text-stone-600">{customerLabel(customer)}</div>}
          {b.address && <div className="mt-1 whitespace-pre-line text-sm text-stone-500">{b.address}</div>}
          {b.notes && <div className="mt-1 whitespace-pre-line text-xs text-stone-500">{b.notes}</div>}
        </div>
        <button type="button" onClick={onEdit} className="rounded-full p-1.5 text-stone-500 hover:bg-stone-100" aria-label="Edit booking">
          <Pencil size={16} />
        </button>
      </div>
      {isOpen && (
        <div className="flex flex-wrap gap-2 border-t border-stone-200 px-4 py-3">
          {phone && (
            <>
              <a href={waHref(phone, confirmMessage(b, customer))} target="_blank" rel="noreferrer" className={buttonClass('secondary', 'sm')}>
                <MessageCircle size={14} className="text-[var(--good)]" /> Confirm
              </a>
              <a href={waHref(phone, onTheWayMessage(customer))} target="_blank" rel="noreferrer" className={buttonClass('secondary', 'sm')}>
                <Send size={14} className="text-[var(--good)]" /> On the way
              </a>
              <a href={telHref(phone)} className={buttonClass('secondary', 'sm')}>
                <Phone size={14} /> Call
              </a>
            </>
          )}
          <Button size="sm" onClick={() => saveBooking({ ...b, status: 'done' })}>
            <Check size={14} /> Done
          </Button>
        </div>
      )}
      {b.status === 'done' && (
        <div className="border-t border-stone-200 px-4 py-3">
          <Link to={`/d/${DOC_META.service_report.path}/new${b.customerId ? `?customer=${b.customerId}` : ''}`} className={buttonClass('secondary', 'sm')}>
            <ClipboardCheck size={14} /> Service report
          </Link>
        </div>
      )}
    </Card>
  )
}

function BookingModal({ booking, isNew, onClose }: { booking: Booking | null; isNew: boolean; onClose: () => void }) {
  const customers = useStore((s) => s.customers)
  const saveBooking = useStore((s) => s.saveBooking)
  const deleteBooking = useStore((s) => s.deleteBooking)
  const [form, setForm] = useState<Booking | null>(booking)
  const [last, setLast] = useState(booking)
  if (booking !== last) {
    setLast(booking)
    setForm(booking)
  }
  const parties = useMemo(() => customers.filter((c) => contactKind(c) === 'customer'), [customers])
  if (!form) return null

  const set = <K extends keyof Booking>(k: K, v: Booking[K]) => setForm({ ...form, [k]: v })
  const save = (b: Booking) => {
    saveBooking(b)
    onClose()
  }

  return (
    <Modal
      open={!!booking}
      onClose={onClose}
      title={isNew ? 'New booking' : 'Edit booking'}
      footer={
        <>
          {!isNew && (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                if (confirm('Delete this booking?')) {
                  deleteBooking(form.id)
                  onClose()
                }
              }}
            >
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!form.date} onClick={() => save(form)}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="Time (optional)">
          <Input type="time" value={form.time} onChange={(e) => set('time', e.target.value)} />
        </Field>
        <div className="col-span-2">
          <span className="mb-1 block text-xs font-semibold text-stone-600">Customer</span>
          <PartyPicker
            value={form.customerId}
            parties={parties}
            placeholder="Search or select customer"
            onChange={(id) => {
              const c = customers.find((x) => x.id === id)
              // Their address fills in when none is typed yet.
              setForm({ ...form, customerId: id, address: form.address.trim() ? form.address : (c?.address ?? '') })
            }}
          />
        </div>
        <Field label="Job" className="col-span-2">
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Elektrik trip, semak DB" />
        </Field>
        <Field label="Address" className="col-span-2">
          <Textarea value={form.address} onChange={(e) => set('address', e.target.value)} rows={2} />
        </Field>
        <Field label="Notes (optional)" className="col-span-2">
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder="Gate code, parking, what to bring…" />
        </Field>
      </div>
      {!isNew && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-stone-200 pt-3">
          {form.status !== 'booked' && (
            <Button size="sm" onClick={() => save({ ...form, status: 'booked' })}>
              <CalendarDays size={14} /> Back to booked
            </Button>
          )}
          {form.status !== 'done' && (
            <Button size="sm" onClick={() => save({ ...form, status: 'done' })}>
              <Check size={14} /> Mark done
            </Button>
          )}
          {form.status !== 'cancelled' && (
            <Button size="sm" variant="ghost" onClick={() => save({ ...form, status: 'cancelled' })}>
              Cancel booking
            </Button>
          )}
        </div>
      )}
    </Modal>
  )
}
