import type { DocPhoto, DocType } from './types'

/** Documents whose photos can be tagged before & after. A quotation's site photos stay as they are. */
export const BEFORE_AFTER_TYPES: DocType[] = ['invoice', 'service_report']

export interface PhotoPair {
  before: DocPhoto
  after: DocPhoto
}

/**
 * Pairs work photos for before & after: the first "before" with the first "after", the second
 * with the second, and so on, in the order the photos are in. Everything else (during, untagged,
 * a before or after without a partner) stays in `rest`, in order.
 */
export function pairPhotos(photos: DocPhoto[]): { pairs: PhotoPair[]; rest: DocPhoto[] } {
  const befores = photos.filter((p) => p.stage === 'before')
  const afters = photos.filter((p) => p.stage === 'after')
  const n = Math.min(befores.length, afters.length)
  const pairs = Array.from({ length: n }, (_, i) => ({ before: befores[i], after: afters[i] }))
  const paired = new Set(pairs.flatMap((p) => [p.before.id, p.after.id]))
  return { pairs, rest: photos.filter((p) => !paired.has(p.id)) }
}

/** "Before 2", "After 1": where a photo sits in its pair, for labels in the editor. */
export function stageLabel(photos: DocPhoto[], photo: DocPhoto): string {
  if (!photo.stage) return ''
  const name = photo.stage[0].toUpperCase() + photo.stage.slice(1)
  if (photo.stage === 'during') return name
  const n = photos.filter((p) => p.stage === photo.stage).indexOf(photo) + 1
  return `${name} ${n}`
}

/** A pair's title: the after photo's caption, else the before photo's. */
export const pairCaption = (pair: PhotoPair) => pair.after.caption.trim() || pair.before.caption.trim()
