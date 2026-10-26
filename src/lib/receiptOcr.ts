import { parseReceiptText, type ReceiptGuess } from './receiptParse'

/**
 * Reads a receipt photo on the device with Tesseract (no server, nothing sent to anyone).
 * The OCR engine and English text data (about 5 MB) download from the jsDelivr CDN the first
 * time and the browser keeps them, so later receipts read faster and offline.
 */

/** Greyscale, higher contrast and at most 2000 px long: what OCR reads best. */
async function prepare(blob: Blob): Promise<HTMLCanvasElement> {
  const img = await createImageBitmap(blob)
  const scale = Math.min(1, 2000 / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.filter = 'grayscale(1) contrast(1.35)'
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  img.close()
  return canvas
}

export type ReceiptReading = ReceiptGuess & { text: string }

export async function readReceipt(blob: Blob, onProgress?: (fraction: number) => void): Promise<ReceiptReading> {
  const [{ createWorker }, canvas] = await Promise.all([import('tesseract.js'), prepare(blob)])
  // OEM 1 (LSTM only) uses the smaller "best_int" language data.
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress)
    },
  })
  try {
    const { data } = await worker.recognize(canvas)
    return { ...parseReceiptText(data.text), text: data.text }
  } finally {
    await worker.terminate()
  }
}
