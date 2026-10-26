import { downloadFile } from './backup'

/**
 * Turns the on-screen A4 sheet into a PDF file, so a document can be shared straight to
 * WhatsApp. The sheet is drawn as an image and cut into pages between table rows and blocks;
 * continued pages repeat the table header, and every page of a long document gets a number.
 */

export interface PdfOptions {
  fileName: string
  /** Document number, e.g. INV/26/1101. */
  docNo: string
  /** Document title as printed, e.g. INVOICE. */
  heading: string
  company: string
  engineering: boolean
}

/** A4 at 96 dpi. */
const PAGE_H = 1123
/** Space kept under the content of a long document for the page number. */
const BOTTOM_ROOM = 46
/** Where content starts on continued pages, under the running header. */
const CONTINUED_TOP = 50

interface Span {
  top: number
  bottom: number
}

/**
 * Pieces of the sheet that must stay whole: each table row, and each block that holds no
 * table. A table's header and first row count as one piece so a header is never left alone.
 */
function measure(sheet: HTMLElement) {
  const box = sheet.getBoundingClientRect()
  // The preview may be scaled down; offsetWidth is the real size.
  const scale = box.width / sheet.offsetWidth
  const span = (el: Element): Span => {
    const r = el.getBoundingClientRect()
    return { top: (r.top - box.top) / scale, bottom: (r.bottom - box.top) / scale }
  }
  const pieces: Span[] = []
  const tables: (Span & { head?: Span })[] = []
  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      if (child instanceof HTMLStyleElement) continue
      if (child instanceof HTMLTableElement) {
        const head = child.tHead ?? undefined
        const rows = Array.from(child.tBodies).flatMap((b) => Array.from(b.rows))
        tables.push({ ...span(child), head: head && span(head) })
        rows.forEach((row, i) => {
          const s = span(row)
          pieces.push(i === 0 && head ? { top: span(head).top, bottom: s.bottom } : s)
        })
        if (!rows.length && head) pieces.push(span(head))
      } else if (child.querySelector('table')) {
        walk(child)
      } else {
        const s = span(child)
        if (s.bottom - s.top > 0.5) pieces.push(s)
      }
    }
  }
  walk(sheet)
  return { pieces, tables }
}

interface Page {
  from: number
  to: number
  /** Where the slice goes on the page. */
  top: number
  /** Table header to repeat above the slice. */
  head?: Span
}

function paginate(sheet: HTMLElement): Page[] {
  const total = sheet.offsetHeight
  if (total <= PAGE_H + 1) return [{ from: 0, to: total, top: 0 }]

  const { pieces, tables } = measure(sheet)
  const padBottom = parseFloat(getComputedStyle(sheet).paddingBottom) || 0
  const splits = (y: number) => pieces.some((p) => p.top < y - 0.5 && p.bottom > y + 0.5)
  const pages: Page[] = []
  let from = 0
  let top = 0
  let head: Span | undefined
  while (from < total - 1) {
    const room = PAGE_H - BOTTOM_ROOM - top
    // The sheet's own bottom padding already leaves space under the last page's content.
    if (total - from <= room + Math.min(padBottom, BOTTOM_ROOM)) {
      pages.push({ from, to: total, top, head })
      break
    }
    const limit = from + room
    let to = from
    for (const p of pieces) if (p.bottom <= limit && p.bottom > to && !splits(p.bottom)) to = p.bottom
    if (to <= from + 1) to = limit // one piece taller than a page: cut it
    pages.push({ from, to, top, head })
    from = to
    head = tables.find((t) => t.head && to > t.head.bottom + 1 && to < t.bottom - 1)?.head
    top = CONTINUED_TOP + (head ? head.bottom - head.top : 0)
  }
  return pages
}

/** Waits for work photos that are still loading, so none comes out blank. */
async function photosLoaded(box: HTMLElement) {
  for (let t = 0; t < 50 && box.querySelector('[data-photo-loading]'); t++) await new Promise((r) => setTimeout(r, 100))
  const imgs = Array.from(box.querySelectorAll('img'))
  await Promise.all(imgs.map((img) => img.decode().catch(() => {})))
}

/**
 * PDF of every sheet in `box`: the document (cut into pages when long) followed by any
 * one-page sheets after it, such as work photo pages.
 */
export async function sheetsToPdf(box: HTMLElement, o: PdfOptions): Promise<File> {
  const [{ toCanvas }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')])
  const [sheet, ...extras] = Array.from(box.querySelectorAll<HTMLElement>('.sheet'))
  if (!sheet) throw new Error('Nothing to make a PDF of.')
  await document.fonts.ready
  await photosLoaded(box)
  const pages = paginate(sheet)
  const total = pages.length + extras.length
  const long = total > 1
  const width = sheet.offsetWidth
  const draw = (el: HTMLElement) =>
    toCanvas(el, {
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      width: el.offsetWidth,
      height: el.offsetHeight,
      style: { margin: '0', boxShadow: 'none' },
      // On long documents the page number takes over from the document number in the footer.
      filter: (node) => !(long && node instanceof HTMLElement && node.matches('.eng-foot b')),
    })
  const canvas = await draw(sheet)
  const ratio = canvas.width / width
  const mm = 210 / width
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })

  const place = (src: HTMLCanvasElement, from: number, to: number, y: number, quality = 0.92) => {
    const sy = Math.round(from * ratio)
    const h = Math.min(Math.round(to * ratio), src.height) - sy
    if (h <= 0) return
    const slice = document.createElement('canvas')
    slice.width = src.width
    slice.height = h
    slice.getContext('2d')!.drawImage(src, 0, sy, src.width, h, 0, 0, src.width, h)
    pdf.addImage(slice.toDataURL('image/jpeg', quality), 'JPEG', 0, y * mm, 210, (h / ratio) * mm)
  }

  const pad = parseFloat(getComputedStyle(sheet).paddingLeft) || 53
  const left = pad * mm
  const right = 210 - pad * mm
  const note = (text: string, x: number, y: number, align: 'left' | 'right') => {
    if (o.engineering) {
      pdf.setFont('courier', 'normal')
      pdf.setFontSize(6.5)
      pdf.setTextColor('#7c8491')
      // jsPDF's right alignment ignores letter spacing, so measure it here.
      const caps = text.toUpperCase()
      const w = pdf.getTextWidth(caps) + 0.25 * caps.length
      pdf.text(caps, align === 'right' ? x - w : x, y * mm, { charSpace: 0.25 })
    } else {
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7.5)
      pdf.setTextColor('#78716c')
      pdf.text(text, x, y * mm, { align })
    }
  }
  const pageNumber = (i: number) => {
    if (long) note(o.engineering ? `${o.docNo} · Page ${i + 1} / ${total}` : `Page ${i + 1} of ${total}`, right, PAGE_H - 22, 'right')
  }

  pages.forEach((p, i) => {
    if (i) pdf.addPage()
    place(canvas, p.from, p.to, p.top)
    if (p.head) place(canvas, p.head.top, p.head.bottom, CONTINUED_TOP)
    pageNumber(i)
    if (i) {
      note(o.company, left, CONTINUED_TOP - 16, 'left')
      note(o.engineering ? `${o.heading} ${o.docNo} · Continued` : `${o.heading} ${o.docNo} (continued)`, right, CONTINUED_TOP - 16, 'right')
    }
  })
  for (const [i, el] of extras.entries()) {
    pdf.addPage()
    // Photo pages: slightly stronger JPEG compression keeps a long report light for WhatsApp.
    place(await draw(el), 0, el.offsetHeight, 0, 0.85)
    pageNumber(pages.length + i)
  }
  pdf.setProperties({ title: `${o.heading} ${o.docNo}`, author: o.company })
  return new File([pdf.output('blob')], o.fileName, { type: 'application/pdf' })
}

export type ShareResult = 'shared' | 'downloaded' | 'cancelled' | 'needs-tap'

/**
 * Opens the phone's share sheet with the file (WhatsApp, Gmail, Drive…), or downloads it on
 * computers. 'needs-tap' means the phone wants a fresh tap before it opens the share sheet,
 * which happens when making the PDF took a while.
 */
export async function shareFile(file: File, text: string): Promise<ShareResult> {
  const isTouch = window.matchMedia('(pointer: coarse)').matches
  if (isTouch && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text })
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      if (e instanceof DOMException && e.name === 'NotAllowedError') return 'needs-tap'
      // Any other failure: fall through to a normal download.
    }
  }
  downloadFile(file)
  return 'downloaded'
}
