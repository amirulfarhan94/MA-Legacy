import { useEffect, useState, type RefObject } from 'react'
import { LoaderCircle, Share2 } from 'lucide-react'
import { shareFile, sheetsToPdf, type PdfOptions } from '../lib/pdf'
import { Button } from './ui'

/**
 * Makes a PDF of the sheets inside `sheetBox` (the document and any photo pages) and opens the
 * share sheet with it, so it can go to a customer on WhatsApp as an attachment. On computers
 * the PDF is downloaded instead.
 */
export default function SharePdfButton({ sheetBox, options, text }: { sheetBox: RefObject<HTMLElement | null>; options: PdfOptions; text: string }) {
  const [busy, setBusy] = useState(false)
  // A PDF made but not yet shared, because the phone asked for another tap.
  const [ready, setReady] = useState<File | null>(null)

  // A different document or period makes a waiting PDF out of date.
  const key = `${options.fileName}|${text}`
  useEffect(() => setReady(null), [key])

  async function share() {
    if (ready) {
      if ((await shareFile(ready, text)) !== 'needs-tap') setReady(null)
      return
    }
    const box = sheetBox.current
    if (!box || busy) return
    setBusy(true)
    try {
      const file = await sheetsToPdf(box, options)
      if ((await shareFile(file, text)) === 'needs-tap') setReady(file)
    } catch (e) {
      console.error(e)
      alert('Could not make the PDF. Use Print / PDF and choose "Save as PDF" instead.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button onClick={share} disabled={busy} aria-busy={busy} className={ready ? 'ring-2 ring-[var(--color-accent)]' : undefined}>
      {busy ? <LoaderCircle size={15} className="animate-spin" /> : <Share2 size={15} className="text-[var(--good)]" />}
      {busy ? 'Making PDF…' : ready ? 'Tap to share PDF' : 'Share PDF'}
    </Button>
  )
}
