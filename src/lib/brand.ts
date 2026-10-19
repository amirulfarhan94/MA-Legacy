import { nextDocNumber } from './calc'
import type { Brand, Document, DocType, Settings } from './types'

export const LEGAL_BRAND_ID = 'ma-legacy'

export const defaultBrands: Brand[] = [
  {
    id: LEGAL_BRAND_ID,
    name: 'MA Legacy Solutions',
    logo: '',
    primaryColor: '#16140f',
    accentColor: '#a8741a',
    tagline: '',
    docPrefix: '',
    isLegalEntity: true,
    isDefault: true,
  },
  {
    id: 'handalserv',
    name: 'HandalServ',
    logo: './handalserv-logo-warna.svg',
    primaryColor: '#12355B',
    accentColor: '#E8A33D',
    tagline: 'Servis Pro, Kerja Handal',
    docPrefix: 'HS',
    isLegalEntity: false,
    isDefault: false,
  },
]

/** Type part of a trading brand's numbers: HS-QT-2026-001, HS-RCT-2026-001… */
export const BRAND_TYPE_CODES: Record<DocType, string> = {
  quotation: 'QT',
  proforma: 'PI',
  invoice: 'INV',
  delivery_order: 'DO',
  receipt: 'RCT',
  credit_note: 'CN',
  service_report: 'SR',
  purchase_order: 'PO',
}

/** Always one legal entity and one default; a missing list (data from before brands) gets the defaults. */
export function normalizeBrands(list: Brand[] | undefined): Brand[] {
  if (!Array.isArray(list) || !list.length) return defaultBrands.map((b) => ({ ...b }))
  let brands = list.map((b) => ({ ...b }))
  if (!brands.some((b) => b.isLegalEntity)) brands = [{ ...defaultBrands[0], isDefault: false }, ...brands]
  const legal = brands.findIndex((b) => b.isLegalEntity)
  brands = brands.map((b, i) => ({ ...b, isLegalEntity: i === legal }))
  const def = brands.findIndex((b) => b.isDefault)
  return brands.map((b, i) => ({ ...b, isDefault: i === (def >= 0 ? def : legal) }))
}

export const legalBrand = (brands: Brand[]) => brands.find((b) => b.isLegalEntity) ?? defaultBrands[0]
export const defaultBrand = (brands: Brand[]) => brands.find((b) => b.isDefault) ?? legalBrand(brands)

/** The brand a document belongs to; documents without one (or with a deleted one) are the legal entity's. */
export function brandOf(doc: Pick<Document, 'brandId'>, brands: Brand[]): Brand {
  return brands.find((b) => b.id === doc.brandId) ?? legalBrand(brands)
}

/** Trading brands print with their own look; the legal entity prints exactly as before brands. */
export const isTradingBrand = (b: Brand | undefined): b is Brand => !!b && !b.isLegalEntity

/** Name and logo as shown in the app. The legal entity's come from the company details in Settings. */
export function brandName(b: Brand, s: Settings): string {
  return b.isLegalEntity ? s.companyName || b.name : b.name
}
export function brandLogo(b: Brand, s: Settings): string {
  return b.isLegalEntity ? s.logoDataUrl || './logo.png' : b.logo
}

/**
 * Next number for a new document of this brand. The legal entity keeps PREFIX-YEAR-0001 from Settings;
 * a trading brand counts on its own per type and year: HS-INV-2026-001.
 */
export function nextBrandNumber(type: DocType, brand: Brand, s: Settings, date: string, docs: Document[]): string {
  if (brand.isLegalEntity || !brand.docPrefix) return nextDocNumber(type, s.prefixes[type], date, docs)
  return nextDocNumber(type, `${brand.docPrefix}-${BRAND_TYPE_CODES[type]}`, date, docs, 3)
}

/** "a brand of MA Legacy Solutions (SSM: 202601012345)" */
export function brandOfLine(s: Settings): string {
  return `a brand of ${s.companyName}${s.regNo ? ` (SSM: ${s.regNo})` : ''}`
}
