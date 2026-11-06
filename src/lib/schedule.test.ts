import { describe, expect, it } from 'vitest'
import { confirmMessage, groupBookings, masa, onTheWayMessage, tarikh, time12 } from './schedule'
import type { Booking, Customer } from './types'

const b = (over: Partial<Booking>): Booking => ({
  id: over.id ?? 'x',
  date: '2026-11-06',
  time: '',
  customerId: '',
  title: '',
  address: '',
  notes: '',
  status: 'booked',
  createdAt: '',
  updatedAt: '',
  ...over,
})

describe('Malay date and time', () => {
  it('names the day and month', () => {
    expect(tarikh('2026-11-06')).toBe('Jumaat, 6 November 2026')
    expect(tarikh('2026-03-01')).toBe('Ahad, 1 Mac 2026')
  })
  it('says pagi, tengah hari, petang or malam', () => {
    expect(masa('09:05')).toBe('9:05 pagi')
    expect(masa('12:30')).toBe('12:30 tengah hari')
    expect(masa('14:00')).toBe('2:00 petang')
    expect(masa('20:15')).toBe('8:15 malam')
    expect(masa('00:30')).toBe('12:30 pagi')
    expect(masa('')).toBe('')
    expect(time12('14:00')).toBe('2:00 PM')
  })
})

describe('groupBookings', () => {
  it('sorts open bookings into overdue, today, tomorrow and later, by time', () => {
    const list = [
      b({ id: 'late', date: '2026-11-05' }),
      b({ id: 't2', date: '2026-11-06', time: '15:00' }),
      b({ id: 't1', date: '2026-11-06', time: '09:00' }),
      b({ id: 't3', date: '2026-11-06' }),
      b({ id: 'tm', date: '2026-11-07' }),
      b({ id: 'l', date: '2026-11-20' }),
      b({ id: 'd', date: '2026-11-01', status: 'done' }),
      b({ id: 'c', date: '2026-11-03', status: 'cancelled' }),
    ]
    const g = groupBookings(list, '2026-11-06')
    const ids = (xs: Booking[]) => xs.map((x) => x.id)
    expect(ids(g.overdue)).toEqual(['late'])
    expect(ids(g.today)).toEqual(['t1', 't2', 't3'])
    expect(ids(g.tomorrow)).toEqual(['tm'])
    expect(ids(g.later)).toEqual(['l'])
    expect(ids(g.past)).toEqual(['c', 'd'])
  })
})

describe('WhatsApp messages', () => {
  const c = { name: 'Encik Hafiz' } as Customer
  it('confirms the booking with the day, time and place', () => {
    expect(confirmMessage(b({ title: 'semak DB', time: '10:30', address: 'No 12,\nJalan Klang' }), c)).toBe(
      'Salam Encik Hafiz, ini HandalServ.\nKami mengesahkan temujanji untuk semak DB pada Jumaat, 6 November 2026, 10:30 pagi.\nLokasi: No 12, Jalan Klang\nSila maklumkan kami jika ada perubahan. Terima kasih!',
    )
  })
  it('leaves out what is not filled in', () => {
    expect(confirmMessage(b({}))).toBe('Salam, ini HandalServ.\nKami mengesahkan temujanji pada Jumaat, 6 November 2026.\nSila maklumkan kami jika ada perubahan. Terima kasih!')
  })
  it('says we are on the way', () => {
    expect(onTheWayMessage(c)).toBe('Salam Encik Hafiz, ini HandalServ. Kami sedang dalam perjalanan ke lokasi anda sekarang. Jumpa sebentar lagi!')
  })
})
