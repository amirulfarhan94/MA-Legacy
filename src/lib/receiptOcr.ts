import { callFunction } from './cloud'
import { parseReceiptText, type ReceiptGuess } from './receiptParse'

/**
 * Reads a receipt photo for the expense form. When the owner is signed in and online it goes to
 * the readReceipt Cloud Function (functions/index.js), where Claude reads it; that copes with
 * faded thermal paper and crumpled receipts. Otherwise, or if that fails, it is read on the
 * device with Tesseract: nothing leaves the phone, but it is much less accurate. The on-device
 * engine and English data (about 5 MB) download from the jsDelivr CDN the first time.
 */

export interface ReceiptItem {
  description: string
  amount?: number
}

export type ReceiptReading = ReceiptGuess & {
  items?: ReceiptItem[]
  /** Who read it: Claude in the cloud, or Tesseract on the device. */
  via: 'claude' | 'device'
}

function drawn(img: ImageBitmap, max: number, filter = 'none'): HTMLCanvasElement {
  const scale = Math.min(1, max / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.filter = filter
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas
}

async function readWithClaude(img: ImageBitmap, categories: string[]): Promise<ReceiptReading> {
  // 1600 px is plenty for receipt print and keeps the upload around 200-400 KB.
  const jpeg = drawn(img, 1600).toDataURL('image/jpeg', 0.85)
  const image = jpeg.slice(jpeg.indexOf(',') + 1)
  const r = await callFunction<Omit<ReceiptReading, 'via'>>('readReceipt', { image, mediaType: 'image/jpeg', categories })
  return { ...r, via: 'claude' }
}

async function readOnDevice(img: ImageBitmap, onProgress?: (fraction: number) => void): Promise<ReceiptReading> {
  // Greyscale, higher contrast and at most 2000 px long: what OCR reads best.
  const canvas = drawn(img, 2000, 'grayscale(1) contrast(1.35)')
  const { createWorker } = await import('tesseract.js')
  // OEM 1 (LSTM only) uses the smaller "best_int" language data.
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress)
    },
  })
  try {
    const { data } = await worker.recognize(canvas)
    return { ...parseReceiptText(data.text), via: 'device' }
  } finally {
    await worker.terminate()
  }
}

export async function readReceipt(blob: Blob, categories: string[], onProgress?: (fraction: number) => void): Promise<ReceiptReading> {
  const img = await createImageBitmap(blob)
  try {
    if (navigator.onLine) {
      try {
        return await readWithClaude(img, categories)
      } catch (e) {
        // Signed out, not deployed yet, or the reader failed: read it on the device instead.
        console.warn('Receipt reader in the cloud failed, reading on the device', e)
      }
    }
    return await readOnDevice(img, onProgress)
  } finally {
    img.close()
  }
}
