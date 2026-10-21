import { describe, expect, it } from 'vitest'
import { frequentItems, recentItems, suggestItems } from './catalog'
import type { CatalogItem, Document } from './types'

const doc = (over: Partial<Document>): Document => ({
  id: Math.random().toString(36).slice(2),
  type: 'invoice',
  number: '',
  customerId: 'c1',
  date: '2026-01-10',
  dueDate: '',
  reference: '',
  items: [],
  discount: 0,
  taxRate: 0,
  notes: '',
  terms: '',
  status: 'sent',
  createdAt: '',
  updatedAt: '',
  ...over,
})
const line = (description: string, unitPrice: number, unit = 'unit') => ({ id: String(Math.random()), description, qty: 1, unit, unitPrice })
const cat = (description: string, unitPrice: number): CatalogItem => ({ id: description, description, unit: 'unit', unitPrice, createdAt: '' })

const docs = [
  doc({ date: '2026-01-05', items: [line('Supply & install CCTV camera 4MP', 360), line('Cabling & installation', 1500, 'lot')] }),
  doc({ date: '2026-03-01', items: [line('Supply & install CCTV camera 4MP', 380)] }),
  doc({ date: '2026-04-01', type: 'purchase_order', items: [line('IP camera 4MP', 240)] }),
  doc({ date: '2026-05-01', status: 'cancelled', items: [line('Cancelled job', 999)] }),
  doc({ date: '2026-06-01', type: 'delivery_order', items: [line('Cabling & installation', 0, 'lot')] }),
]

describe('item suggestions', () => {
  it('remembers the latest price charged for each item, sales and purchases apart', () => {
    const sales = recentItems(docs, false)
    expect(sales.map((s) => [s.description, s.unitPrice])).toEqual([
      ['Supply & install CCTV camera 4MP', 380],
      ['Cabling & installation', 1500],
    ])
    expect(recentItems(docs, true).map((s) => s.description)).toEqual(['IP camera 4MP'])
  })

  it('matches every typed word in any order, catalog first, without repeating catalog items', () => {
    const catalog = [cat('Supply & install CCTV camera 4MP', 400), cat('CCTV maintenance visit', 250)]
    const got = suggestItems('cctv 4mp', catalog, recentItems(docs, false))
    expect(got).toEqual([{ description: 'Supply & install CCTV camera 4MP', unit: 'unit', unitPrice: 400, source: 'catalog' }])
    expect(suggestItems('cab', catalog, recentItems(docs, false)).map((s) => s.source)).toEqual(['recent'])
    expect(suggestItems('c', catalog, recentItems(docs, false))).toEqual([])
  })

  it('gives purchase orders only their own earlier items', () => {
    const got = suggestItems('camera', [cat('CCTV camera', 400)], recentItems(docs, true), { purchase: true })
    expect(got.map((s) => [s.description, s.unitPrice])).toEqual([['IP camera 4MP', 240]])
  })

  it('lists the most used items that are not in the catalog yet', () => {
    expect(frequentItems(docs, []).map((s) => [s.description, s.uses])).toEqual([
      ['Supply & install CCTV camera 4MP', 2],
      ['Cabling & installation', 1],
    ])
    expect(frequentItems(docs, [cat('supply & install cctv camera 4mp', 1)]).map((s) => s.description)).toEqual(['Cabling & installation'])
  })
})
