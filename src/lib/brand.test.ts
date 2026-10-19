import { beforeEach, describe, expect, it } from 'vitest'
import { brandOf, defaultBrands, LEGAL_BRAND_ID, nextBrandNumber, normalizeBrands } from './brand'
import { defaultSettings, useStore } from './store'
import type { Document } from './types'

const [ma, hs] = defaultBrands
const doc = (over: Partial<Document>): Document => ({
  id: Math.random().toString(36),
  type: 'invoice',
  number: '',
  customerId: 'c1',
  date: '2026-05-01',
  dueDate: '',
  reference: '',
  items: [],
  discount: 0,
  taxRate: 0,
  notes: '',
  terms: '',
  status: 'draft',
  createdAt: '',
  updatedAt: '',
  ...over,
})

describe('nextBrandNumber', () => {
  const docs = [
    doc({ type: 'invoice', number: 'INV-2026-0003', brandId: ma.id }),
    doc({ type: 'invoice', number: 'HS-INV-2026-007', brandId: hs.id }),
    doc({ type: 'quotation', number: 'HS-QT-2026-002', brandId: hs.id }),
    doc({ type: 'invoice', number: 'HS-INV-2025-040', brandId: hs.id }),
  ]

  it('keeps the legal entity numbering unchanged', () => {
    expect(nextBrandNumber('invoice', ma, defaultSettings, '2026-05-01', docs)).toBe('INV-2026-0004')
    expect(nextBrandNumber('receipt', ma, defaultSettings, '2026-05-01', docs)).toBe('OR-2026-0001')
  })

  it('counts a trading brand per type and year with 3 digits', () => {
    expect(nextBrandNumber('invoice', hs, defaultSettings, '2026-05-01', docs)).toBe('HS-INV-2026-008')
    expect(nextBrandNumber('quotation', hs, defaultSettings, '2026-05-01', docs)).toBe('HS-QT-2026-003')
    expect(nextBrandNumber('invoice', hs, defaultSettings, '2027-01-02', docs)).toBe('HS-INV-2027-001')
    expect(nextBrandNumber('proforma', hs, defaultSettings, '2026-05-01', docs)).toBe('HS-PI-2026-001')
    expect(nextBrandNumber('receipt', hs, defaultSettings, '2026-05-01', docs)).toBe('HS-RCT-2026-001')
    expect(nextBrandNumber('service_report', hs, defaultSettings, '2026-05-01', docs)).toBe('HS-SR-2026-001')
  })
})

describe('brands', () => {
  it('treats documents without a brand as the legal entity', () => {
    expect(brandOf({}, defaultBrands).id).toBe(LEGAL_BRAND_ID)
    expect(brandOf({ brandId: 'gone' }, defaultBrands).id).toBe(LEGAL_BRAND_ID)
  })

  it('always keeps one legal entity and one default', () => {
    expect(normalizeBrands(undefined).map((b) => b.id)).toEqual([ma.id, hs.id])
    const fixed = normalizeBrands([{ ...hs, isDefault: false }])
    expect(fixed.filter((b) => b.isLegalEntity).map((b) => b.id)).toEqual([ma.id])
    expect(fixed.filter((b) => b.isDefault).map((b) => b.id)).toEqual([ma.id])
  })
})

describe('store', () => {
  beforeEach(() => useStore.getState().resetAll())

  it('keeps the brand when converting a quotation to an invoice and the invoice to a receipt', () => {
    const st = useStore.getState()
    const qt = st.saveDocument(st.newDocument('quotation', 'c1', hs.id))
    expect(qt.brandId).toBe(hs.id)
    expect(qt.number).toMatch(/^HS-QT-\d{4}-001$/)

    const inv = useStore.getState().saveDocument(useStore.getState().convertDocument(qt.id, 'invoice'))
    expect(inv.brandId).toBe(hs.id)
    expect(inv.number).toMatch(/^HS-INV-\d{4}-001$/)

    const rct = useStore.getState().receiptForInvoice(inv.id)
    expect(rct.brandId).toBe(hs.id)
    expect(rct.number).toMatch(/^HS-RCT-\d{4}-001$/)

    // The legal entity's own counter is untouched.
    expect(useStore.getState().newDocument('quotation').number).toMatch(/^QT-\d{4}-0001$/)
  })

  it('marks restored documents without a brand as the legal entity', () => {
    const data = { ...useStore.getState().exportData(), documents: [doc({ number: 'INV-2026-0001' })], brands: undefined }
    useStore.getState().importData(data)
    expect(useStore.getState().documents[0].brandId).toBe(LEGAL_BRAND_ID)
    expect(useStore.getState().brands.map((b) => b.id)).toEqual([ma.id, hs.id])
  })
})
