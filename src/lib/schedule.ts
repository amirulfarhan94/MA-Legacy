import { BRAND } from './brand'
import { addDays } from './calc'
import type { Booking, Customer } from './types'

/**
 * The schedule: bookings grouped by day, and the WhatsApp messages sent about them. Messages to
 * customers are in Malay, like the rest of HandalServ's customer messages.
 */

const HARI = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu']
const BULAN = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember']

/** "2026-11-06" → "Jumaat, 6 November 2026" */
export function tarikh(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${HARI[new Date(y, m - 1, d).getDay()]}, ${d} ${BULAN[m - 1]} ${y}`
}

/** "14:30" → "2:30 petang"; '' → '' */
export function masa(time: string): string {
  if (!time) return ''
  const [h, min] = time.split(':').map(Number)
  const part = h < 12 ? 'pagi' : h < 14 ? 'tengah hari' : h < 19 ? 'petang' : 'malam'
  const h12 = h % 12 || 12
  return `${h12}:${String(min).padStart(2, '0')} ${part}`
}

/** "14:30" → "2:30 PM", for the owner's own screens. */
export function time12(time: string): string {
  if (!time) return ''
  const [h, min] = time.split(':').map(Number)
  return `${h % 12 || 12}:${String(min).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

const byWhen = (a: Booking, b: Booking) => a.date.localeCompare(b.date) || (a.time || '99').localeCompare(b.time || '99')

export interface ScheduleGroups {
  /** Booked for a day already gone and never marked done. */
  overdue: Booking[]
  today: Booking[]
  tomorrow: Booking[]
  later: Booking[]
  /** Done or cancelled, newest first. */
  past: Booking[]
}

export function groupBookings(bookings: Booking[], asOf: string): ScheduleGroups {
  const tomorrow = addDays(asOf, 1)
  const open = bookings.filter((b) => b.status === 'booked').sort(byWhen)
  return {
    overdue: open.filter((b) => b.date < asOf),
    today: open.filter((b) => b.date === asOf),
    tomorrow: open.filter((b) => b.date === tomorrow),
    later: open.filter((b) => b.date > tomorrow),
    past: bookings.filter((b) => b.status !== 'booked').sort((a, b) => byWhen(b, a)),
  }
}

const hello = (c?: Customer) => (c?.name.trim() ? `Salam ${c.name.trim()}` : 'Salam')

export function confirmMessage(b: Booking, c?: Customer): string {
  const when = [tarikh(b.date), masa(b.time)].filter(Boolean).join(', ')
  return [
    `${hello(c)}, ini ${BRAND.name}.`,
    `Kami mengesahkan temujanji${b.title.trim() ? ` untuk ${b.title.trim()}` : ''} pada ${when}.`,
    b.address.trim() ? `Lokasi: ${b.address.trim().replace(/,?\s*\n\s*/g, ', ')}` : '',
    'Sila maklumkan kami jika ada perubahan. Terima kasih!',
  ]
    .filter(Boolean)
    .join('\n')
}

export function onTheWayMessage(c?: Customer): string {
  return `${hello(c)}, ini ${BRAND.name}. Kami sedang dalam perjalanan ke lokasi anda sekarang. Jumpa sebentar lagi!`
}
