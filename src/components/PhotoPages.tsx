import type { ReactNode } from 'react'
import { pairPhotos, type PhotoPair } from '../lib/beforeAfter'
import { usePhotoUrls } from '../lib/photos'
import { useStore } from '../lib/store'
import { formatDate } from '../lib/calc'
import { DOC_META, type Customer, type DocPhoto, type Document } from '../lib/types'
import { SheetHeader } from './DocumentSheet'
import { EngHeader, EngSheet } from './EngineeringSheet'

const PER_PAGE = 4
const PAIRS_PER_PAGE = 3
const pad2 = (n: number) => String(n).padStart(2, '0')

/**
 * Work photos as A4 report pages after the document, in the chosen document style: before &
 * after pairs side by side, then the other photos four to a page. Photos that are not on this
 * device are left out.
 */
export default function PhotoPages({ doc, customer }: { doc: Document; customer?: Customer }) {
  const style = useStore((s) => s.settings.documentStyle)
  const all = doc.photos ?? []
  const urls = usePhotoUrls(all.map((p) => p.id))
  const photos = all.filter((p) => urls[p.id] !== null)
  if (!photos.length) return null

  // Before & after pairs come first, three to a page side by side; the other photos follow, four to a page.
  const { pairs, rest } = pairPhotos(photos)
  const party = customer ? customer.company || customer.name : '—'
  const pages: { title: string; label: string; range: string; body: ReactNode }[] = []
  for (let i = 0; i < pairs.length; i += PAIRS_PER_PAGE) {
    const page = pairs.slice(i, i + PAIRS_PER_PAGE)
    pages.push({ title: 'BEFORE & AFTER', label: 'Pairs', range: `${i + 1}–${i + page.length} of ${pairs.length}`, body: <PairGrid pairs={page} first={i + 1} urls={urls} /> })
  }
  for (let i = 0; i < rest.length; i += PER_PAGE) {
    const page = rest.slice(i, i + PER_PAGE)
    pages.push({
      title: doc.type === 'quotation' ? 'SITE PHOTOS' : 'WORK REPORT',
      label: 'Photos',
      range: `${i + 1}–${i + page.length} of ${rest.length}`,
      body: <PhotoGrid photos={page} first={i + 1} urls={urls} />,
    })
  }

  return pages.map(({ title, label, range, body }, i) => {
    if (style === 'engineering') {
      return (
        <EngSheet key={i} docNo={doc.number} title={DOC_META[doc.type].title} className="photo-page mt-6 print:mt-0">
          <EngHeader
            title={title}
            kicker={`${DOC_META[doc.type].label} · ${doc.number}`}
            cells={[
              ['Document no.', doc.number],
              ['Date', formatDate(doc.date)],
              ['Customer', party],
              [label, range],
            ]}
          />
          {body}
          <div className="eng-foot">
            <span>
              {label} {range}
            </span>
            <b>{doc.number}</b>
          </div>
        </EngSheet>
      )
    }
    return (
      <div key={i} className="sheet photo-page mx-auto mt-6 flex flex-col shadow-lg print:mt-0">
        <SheetHeader
          title={title}
          rows={[
            ['No.', doc.number, true],
            ['Date', formatDate(doc.date)],
            ['Customer', party],
          ]}
        />
        {body}
        <div className="mt-3 border-t border-stone-200 pt-2 text-center text-[10px] text-stone-500">
          {label} {range} · {DOC_META[doc.type].label} {doc.number}
        </div>
      </div>
    )
  })
}

function PairGrid({ pairs, first, urls }: { pairs: PhotoPair[]; first: number; urls: Record<string, string | null> }) {
  const cell = (p: DocPhoto, alt: string) => (
    <div className="ph">{urls[p.id] ? <img src={urls[p.id]!} alt={p.caption || alt} /> : <i data-photo-loading="" />}</div>
  )
  return (
    <div className="pair-grid">
      <b className="pair-head">Before</b>
      <b className="pair-head">After</b>
      {pairs.map((pair, i) => (
        <figure key={pair.before.id}>
          {cell(pair.before, `Before ${first + i}`)}
          {cell(pair.after, `After ${first + i}`)}
          <figcaption>
            <b>{pad2(first + i)}</b>
            <span>{[pair.before.caption.trim(), pair.after.caption.trim()].filter(Boolean).join(' → ')}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  )
}

function PhotoGrid({ photos, first, urls }: { photos: DocPhoto[]; first: number; urls: Record<string, string | null> }) {
  return (
    <div className="photo-grid">
      {photos.map((p, i) => (
        <figure key={p.id}>
          <div className="ph">
            {urls[p.id] ? <img src={urls[p.id]!} alt={p.caption || `Photo ${first + i}`} /> : <i data-photo-loading="" />}
          </div>
          <figcaption>
            <b>{pad2(first + i)}</b>
            <span>{p.caption}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  )
}
