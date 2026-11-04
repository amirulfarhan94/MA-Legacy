import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import SheetPreview from '../components/SheetPreview'
import Sticker, { useQrCode } from '../components/Sticker'
import { Button, Card, Field, PageHeader, Select } from '../components/ui'
import { labelPosition, PER_SHEET, SHEET, stickerInfo } from '../lib/sticker'
import { useStore } from '../lib/store'
import { DOC_META } from '../lib/types'

const positions = Array.from({ length: PER_SHEET }, (_, i) => i + 1)

/**
 * A4 sheet of HandalServ stickers to print on 21-label sticker paper. From a document, the
 * stickers carry its date and number; from Settings they are general ones.
 */
export default function Stickers() {
  const { docId } = useParams()
  const doc = useStore((s) => s.documents.find((d) => d.id === docId))
  const info = stickerInfo(doc)
  const qr = useQrCode(info.link)
  const [count, setCount] = useState(doc ? 2 : PER_SHEET)
  // A partly used sheet: start printing at the first label still on it.
  const [start, setStart] = useState(1)
  const shown = Math.min(count, PER_SHEET - start + 1)

  return (
    <>
      <div className="no-print">
        {doc ? (
          <Link to={`/d/${DOC_META[doc.type].path}/${doc.id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
            <ArrowLeft size={15} /> {doc.number}
          </Link>
        ) : (
          <Link to="/settings" className="mb-3 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
            <ArrowLeft size={15} /> Settings
          </Link>
        )}
        <PageHeader
          title="HandalServ stickers"
          subtitle={
            doc
              ? `For ${doc.number}: leave one inside the DB box door or by the water heater, so the customer can WhatsApp you next time.`
              : 'General stickers, without a job date or number.'
          }
        />
        <Card className="mb-5 p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="How many">
              <Select value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {positions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Start at label" hint="On a sheet already partly used.">
              <Select value={start} onChange={(e) => setStart(Number(e.target.value))}>
                {positions.map((n) => (
                  <option key={n} value={n}>
                    {n} (row {Math.ceil(n / SHEET.cols)}, {['left', 'middle', 'right'][(n - 1) % SHEET.cols]})
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end">
              <Button variant="primary" onClick={() => window.print()} className="w-full justify-center">
                <Printer size={15} /> Print {shown} sticker{shown === 1 ? '' : 's'}
              </Button>
            </div>
          </div>
          <p className="mt-3 text-xs text-stone-500">
            Use A4 sticker paper with 21 labels of 63.5 × 38.1 mm (3 across, 7 down, e.g. Avery L7160 or a shop&apos;s own brand). In the print
            window choose scale 100% (Actual size) and no margins. Don&apos;t put stickers on the TNB meter or its seals, and ask the customer first.
          </p>
        </Card>
      </div>
      <SheetPreview>
        <div className="sheet sticker-sheet mx-auto shadow-lg">
          {Array.from({ length: shown }, (_, i) => {
            const { top, left } = labelPosition(start - 1 + i)
            return (
              <div key={i} className="sticker-slot" style={{ top: `${top}mm`, left: `${left}mm` }}>
                <Sticker info={info} qr={qr} />
              </div>
            )
          })}
        </div>
      </SheetPreview>
    </>
  )
}
