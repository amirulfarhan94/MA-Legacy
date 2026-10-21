import { hasPricedSubs } from './calc'
import { isPurchaseDoc, type CatalogItem, type Document, type DocType } from './types'

/** A line the editor can fill in: from the catalog, or as last used on an earlier document. */
export interface ItemSuggestion {
  description: string
  unit: string
  unitPrice: number
  source: 'catalog' | 'recent'
  /** Recent items: date of the document it was last used on. */
  lastUsed?: string
}

export const sameItem = (a: string, b: string) => normalize(a) === normalize(b)
const normalize = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()

/** Documents whose prices are what was charged: delivery orders and service reports have none. */
const PRICE_SOURCES: DocType[] = ['quotation', 'proforma', 'invoice']
const priceSource = (d: Document, purchase: boolean) =>
  d.status !== 'cancelled' && (purchase ? isPurchaseDoc(d.type) : PRICE_SOURCES.includes(d.type))

/**
 * Items used on earlier documents, newest first and one per description. Sales and purchases
 * are kept apart, since a purchase order's price is a cost, not a selling price.
 */
export function recentItems(documents: Document[], purchase: boolean, skip?: string): ItemSuggestion[] {
  const seen = new Set<string>()
  const out: ItemSuggestion[] = []
  const docs = documents
    .filter((d) => d.id !== skip && priceSource(d, purchase))
    .sort((a, b) => b.date.localeCompare(a.date))
  for (const d of docs) {
    for (const i of d.items) {
      const key = normalize(i.description)
      // A line priced through its sub items has no price of its own to offer.
      if (!key || seen.has(key) || hasPricedSubs(i)) continue
      seen.add(key)
      out.push({ description: i.description.trim(), unit: i.unit, unitPrice: i.unitPrice, source: 'recent', lastUsed: d.date })
    }
  }
  return out
}

/** Every word typed appears in the description, in any order. */
const matches = (description: string, words: string[]) => {
  const d = normalize(description)
  return words.every((w) => d.includes(w))
}

/**
 * Suggestions for what is being typed: catalog items first, then items from earlier
 * documents that are not in the catalog. Purchase orders only get their own earlier items.
 */
export function suggestItems(
  query: string,
  catalog: CatalogItem[],
  recent: ItemSuggestion[],
  { purchase = false, limit = 6 }: { purchase?: boolean; limit?: number } = {},
): ItemSuggestion[] {
  const words = normalize(query).split(' ').filter(Boolean)
  if (!words.length || normalize(query).length < 2) return []
  const fromCatalog: ItemSuggestion[] = purchase
    ? []
    : catalog.filter((c) => matches(c.description, words)).map((c) => ({ description: c.description, unit: c.unit, unitPrice: c.unitPrice, source: 'catalog' }))
  const inCatalog = new Set(catalog.map((c) => normalize(c.description)))
  const fromRecent = recent.filter((r) => matches(r.description, words) && (purchase || !inCatalog.has(normalize(r.description))))
  return [...fromCatalog, ...fromRecent].slice(0, limit)
}

/** Items used most often on sales documents that are not in the catalog yet. */
export function frequentItems(documents: Document[], catalog: CatalogItem[], limit = 8): (ItemSuggestion & { uses: number })[] {
  const inCatalog = new Set(catalog.map((c) => normalize(c.description)))
  const uses = new Map<string, number>()
  for (const d of documents) {
    if (!priceSource(d, false)) continue
    for (const i of d.items) {
      const key = normalize(i.description)
      if (key && !inCatalog.has(key)) uses.set(key, (uses.get(key) ?? 0) + 1)
    }
  }
  return recentItems(documents, false)
    .filter((r) => uses.has(normalize(r.description)))
    .map((r) => ({ ...r, uses: uses.get(normalize(r.description))! }))
    .sort((a, b) => b.uses - a.uses)
    .slice(0, limit)
}
