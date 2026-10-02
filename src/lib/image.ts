/**
 * Reads an image file and scales it down so its longest side is at most `max` px,
 * returned as a PNG data URL (keeps transparency and sharp QR edges). Keeps
 * browser storage small: a phone screenshot of a QR code shrinks from MBs to KBs.
 */
export function shrinkImage(file: File, max = 600): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Could not read that image.'))
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That file is not an image the browser can read.'))
    }
    img.src = url
  })
}
