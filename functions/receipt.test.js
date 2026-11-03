import { describe, expect, it } from 'vitest'
import { checkCategories, cleanReading, instructions, ReceiptSchema } from './receipt.js'

const CATS = ['Purchases', 'Materials', 'Equipment', 'Transport', 'Utilities', 'Other expense']

describe('cleanReading', () => {
  it('keeps values the form can use', () => {
    const r = cleanReading(
      { total: 109.714, date: '2026-10-14', vendor: '  Kedai Hardware Seng Huat ', sst: 6.21, category: 'Materials', items: [{ description: 'Cable 2.5mm', amount: 85 }] },
      CATS,
    )
    expect(r).toEqual({
      total: 109.71,
      date: '2026-10-14',
      vendor: 'Kedai Hardware Seng Huat',
      sst: 6.21,
      category: 'Materials',
      items: [{ description: 'Cable 2.5mm', amount: 85 }],
    })
  })

  it('drops what is missing, malformed or not one of the categories', () => {
    const r = cleanReading({ total: null, date: '14/10/2026', vendor: ' ', sst: -1, category: 'Food', items: [{ description: ' ', amount: 3 }] }, CATS)
    expect(r).toEqual({ total: undefined, date: undefined, vendor: undefined, sst: undefined, category: undefined, items: [] })
  })
})

describe('checkCategories', () => {
  it('accepts a short list of strings only', () => {
    expect(checkCategories(CATS)).toEqual(CATS)
    expect(checkCategories('Materials')).toEqual([])
    expect(checkCategories(['Materials', 3, ''])).toEqual(['Materials'])
  })
})

describe('instructions', () => {
  it('lists the categories and says the day comes first', () => {
    const text = instructions(CATS)
    expect(text).toContain('Materials, Equipment')
    expect(text).toMatch(/day first/)
  })
})

describe('ReceiptSchema', () => {
  it('accepts a reading with nulls', () => {
    expect(ReceiptSchema.safeParse({ total: null, date: null, vendor: null, sst: null, category: null, items: [] }).success).toBe(true)
  })
})
