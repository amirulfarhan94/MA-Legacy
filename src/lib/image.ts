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

/**
 * Photo as a JPEG data URL of at most `maxBytes`, for sending over the network (an IC photo
 * for a split payment application). Lowers the quality first, then the size.
 */
export async function photoDataUrl(file: File, maxSide = 1400, maxBytes = 220_000): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('That file is not a photo the browser can read.'))
      i.src = url
    })
    let side = maxSide
    for (;;) {
      const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.naturalWidth * scale)
      canvas.height = Math.round(img.naturalHeight * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Could not read that photo.')
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      for (const q of [0.8, 0.7, 0.6, 0.5]) {
        const data = canvas.toDataURL('image/jpeg', q)
        // Base64 is 4/3 of the bytes it carries.
        if ((data.length - data.indexOf(',') - 1) * 0.75 <= maxBytes) return data
      }
      side = Math.round(side * 0.8)
      if (side < 500) throw new Error('That photo is too large to send.')
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}
