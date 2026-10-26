import { describe, expect, it } from 'vitest'
import { amountsIn, guessCategory, parseReceiptText } from './receiptParse'

const hardware = `KEDAI ELEKTRIK SRI JAYA SDN BHD
(1234567-X)
No. 8, Jalan Besi 2, Kajang
Tel: 03-8733 1234
TAX INVOICE
Date: 14/10/2026  Time: 10:42
3 x 13A Socket Outlet      38.70
1 x MCB 20A                24.00
1 x Cable 2.5mm 30m       189.00
SUB TOTAL                 251.70
SST 6%                     15.10
TOTAL                     266.80
CASH                      300.00
CHANGE                     33.20
Thank you`

const petrol = `PETRONAS
Stesen Minyak Bandar Baru Bangi
26-Oct-2026 07:58
RON95  32.15 L
Amount        RM 66.00
Rounding       0.00
Card No: ****1234`

describe('amountsIn', () => {
  it('reads ringgit amounts with thousands commas and an RM prefix', () => {
    expect(amountsIn('TOTAL RM 1,234.50')).toEqual([1234.5])
    expect(amountsIn('3 x 13A Socket Outlet 38.70')).toEqual([38.7])
  })
  it('does not glue a quantity to the price', () => {
    expect(amountsIn('10 125.00')).toEqual([125])
  })
})

describe('parseReceiptText', () => {
  it('reads a hardware shop tax invoice', () => {
    expect(parseReceiptText(hardware)).toEqual({
      total: 266.8,
      date: '2026-10-14',
      vendor: 'KEDAI ELEKTRIK SRI JAYA SDN BHD',
      sst: 15.1,
      category: 'Materials',
    })
  })

  it('reads a petrol receipt with a month name and no TOTAL line', () => {
    const r = parseReceiptText(petrol)
    expect(r.total).toBe(66)
    expect(r.date).toBe('2026-10-26')
    expect(r.vendor).toBe('PETRONAS')
    expect(r.category).toBe('Transport')
  })

  it('prefers the grand total over the subtotal and ignores cash and change', () => {
    const r = parseReceiptText('SUBTOTAL 100.00\nDISCOUNT 10.00\nGRAND TOTAL 90.00\nCASH 100.00\nCHANGE 10.00')
    expect(r.total).toBe(90)
  })

  it('reads Malay labels and month names', () => {
    const r = parseReceiptText('Kedai Runcit Pak Mat\n5 Ogos 2026\nJUMLAH BESAR 12.40\nTUNAI 20.00\nBAKI 7.60')
    expect(r.total).toBe(12.4)
    expect(r.date).toBe('2026-08-05')
    expect(r.vendor).toBe('Kedai Runcit Pak Mat')
  })

  it('reads ISO and two-digit-year dates, day first', () => {
    expect(parseReceiptText('2026-09-03 14:00').date).toBe('2026-09-03')
    expect(parseReceiptText('03/09/26').date).toBe('2026-09-03')
  })

  it('falls back to the largest amount when nothing is labelled', () => {
    expect(parseReceiptText('ABC Store\nItem 4.50\nItem 12.00\n16.50').total).toBe(16.5)
  })

  it('returns nothing it cannot find', () => {
    expect(parseReceiptText('')).toEqual({ total: undefined, date: undefined, vendor: undefined, sst: undefined, category: undefined })
  })
})

describe('guessCategory', () => {
  it('spots utilities and tools', () => {
    expect(guessCategory('TENAGA NASIONAL BERHAD bil elektrik')).toBe('Utilities')
    expect(guessCategory('MAKITA cordless drill')).toBe('Equipment')
    expect(guessCategory('Restoran Nasi Kandar')).toBeUndefined()
  })
})
