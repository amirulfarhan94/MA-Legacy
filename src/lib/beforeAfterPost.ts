import { BRAND } from './brand'

/**
 * A before & after picture for social media (1080 × 1350, the 4:5 feed size): HandalServ logo,
 * what the job was, the two photos one above the other, and the WhatsApp number. Drawn on the
 * device; nothing is uploaded. It carries no customer details, only the photos and the caption.
 */
const W = 1080
const H = 1350
const NAVY = '#12355B'
const AMBER = '#E8A33D'
const DISPLAY = '"Unbounded Variable", "Manrope Variable", sans-serif'
const BODY = '"Manrope Variable", "Inter", sans-serif'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Could not load ${src}`))
    img.src = src
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** Fills the box with the photo, cropping the edges that don't fit (like object-fit: cover). */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight)
  const sw = w / scale
  const sh = h / scale
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h)
}

/** Splits text into at most `max` lines that fit `width`, ending with … if it had to cut. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, max: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width <= width || !line) line = next
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  if (lines.length <= max) return lines
  const kept = lines.slice(0, max)
  let last = kept[max - 1]
  while (last && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1)
  kept[max - 1] = `${last.trimEnd()}…`
  return kept
}

function photo(ctx: CanvasRenderingContext2D, img: HTMLImageElement, y: number, h: number, label: string, labelBg: string, labelInk: string) {
  const x = 64
  const w = W - 128
  ctx.save()
  roundRect(ctx, x, y, w, h, 28)
  ctx.clip()
  ctx.fillStyle = '#0B2240'
  ctx.fillRect(x, y, w, h)
  drawCover(ctx, img, x, y, w, h)
  ctx.restore()
  ctx.font = `700 26px ${BODY}`
  ctx.letterSpacing = '4px'
  const tw = ctx.measureText(label).width
  ctx.fillStyle = labelBg
  roundRect(ctx, x + 22, y + 22, tw + 48, 54, 27)
  ctx.fill()
  ctx.fillStyle = labelInk
  ctx.textBaseline = 'middle'
  ctx.fillText(label, x + 46, y + 50)
  ctx.letterSpacing = '0px'
}

export async function makeBeforeAfterPost(beforeUrl: string, afterUrl: string, caption: string): Promise<File> {
  await Promise.all([document.fonts.load(`700 44px ${DISPLAY}`), document.fonts.load(`700 26px ${BODY}`), document.fonts.load(`800 40px ${BODY}`)])
  const [before, after, logo] = await Promise.all([loadImage(beforeUrl), loadImage(afterUrl), loadImage(BRAND.logoOnDark)])

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  const bg = ctx.createLinearGradient(0, 0, W * 0.4, H)
  bg.addColorStop(0, '#174270')
  bg.addColorStop(0.55, '#0E2A48')
  bg.addColorStop(1, '#081A31')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Logo, and the slogan on the right.
  const logoH = 62
  ctx.drawImage(logo, 56, 50, (logo.naturalWidth / logo.naturalHeight) * logoH, logoH)
  ctx.font = `600 24px ${BODY}`
  ctx.fillStyle = 'rgba(234,240,247,.75)'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillText(BRAND.slogan, W - 64, 82)
  ctx.textAlign = 'left'

  // What the job was.
  ctx.font = `700 42px ${DISPLAY}`
  ctx.fillStyle = '#FFFFFF'
  ctx.textBaseline = 'alphabetic'
  const lines = wrap(ctx, caption.trim() || `Kerja siap oleh ${BRAND.name}`, W - 128, 2)
  lines.forEach((l, i) => ctx.fillText(l, 64, 196 + i * 54))

  const top = lines.length > 1 ? 286 : 248
  const gap = 18
  const footer = 1196
  const h = (footer - 28 - top - gap) / 2
  photo(ctx, before, top, h, 'SEBELUM', 'rgba(8,26,49,.82)', '#FFFFFF')
  photo(ctx, after, top + h + gap, h, 'SELEPAS', AMBER, NAVY)

  // WhatsApp bar.
  ctx.fillStyle = AMBER
  roundRect(ctx, 64, footer, W - 128, 100, 26)
  ctx.fill()
  ctx.fillStyle = NAVY
  ctx.textBaseline = 'middle'
  ctx.font = `700 22px ${BODY}`
  ctx.letterSpacing = '3px'
  ctx.fillText('WHATSAPP · 24/7', 98, footer + 34)
  ctx.letterSpacing = '0px'
  ctx.font = `800 40px ${BODY}`
  ctx.fillText(BRAND.whatsapp, 98, footer + 70)
  ctx.textAlign = 'right'
  ctx.font = `700 28px ${BODY}`
  ctx.fillText(BRAND.site, W - 98, footer + 52)
  ctx.textAlign = 'left'

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
  if (!blob) throw new Error('Could not make the picture.')
  return new File([blob], `${BRAND.name}-before-after.jpg`, { type: 'image/jpeg' })
}
