import { usePhotoUrls } from '../lib/photos'
import { useStore } from '../lib/store'
import { formatDate } from '../lib/calc'
import { DOC_META, type Customer, type DocPhoto, type Document } from '../lib/types'
import { SheetHeader } from './DocumentSheet'
import { EngHeader, EngSheet } from './EngineeringSheet'

const PER_PAGE = 4
const pad2 = (n: number) => String(n).padStart(2, '0')

/**
 * Work photos as A4 report pages after the document, four to a page, in the chosen
 * document style. Photos that are not on this device are left out.
 */
export default function PhotoPages({ doc, customer }: { doc: Document; customer?: Customer }) {
  const style = useStore((s) => s.settings.documentStyle)
  const all = doc.photos ?? []
  const urls = usePhotoUrls(all.map((p) => p.id))
  const photos = all.filter((p) => urls[p.id] !== null)
  if (!photos.length) return null

  const title = doc.type === 'quotation' ? 'SITE PHOTOS' : 'WORK REPORT'
  const party = customer ? customer.company || customer.name : '—'
  const pages = Array.from({ length: Math.ceil(photos.length / PER_PAGE) }, (_, i) => photos.slice(i * PER_PAGE, (i + 1) * PER_PAGE))

  return pages.map((page, i) => {
    const first = i * PER_PAGE + 1
    const range = `${first}–${first + page.length - 1} of ${photos.length}`
    const grid = <PhotoGrid photos={page} first={first} urls={urls} />
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
              ['Photos', range],
            ]}
          />
          {grid}
          <div className="eng-foot">
            <span>Photos {range}</span>
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
        {grid}
        <div className="mt-3 border-t border-stone-200 pt-2 text-center text-[10px] text-stone-500">
          Photos {range} · {DOC_META[doc.type].label} {doc.number}
        </div>
      </div>
    )
  })
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
