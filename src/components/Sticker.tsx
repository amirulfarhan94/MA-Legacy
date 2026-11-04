import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { BRAND } from '../lib/brand'
import type { StickerInfo } from '../lib/sticker'

/** The QR code for a link, as an SVG data URL (sharp at any print size). */
export function useQrCode(link: string): string {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let live = true
    QRCode.toString(link, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#12355B', light: '#0000' } }).then((svg) => {
      if (live) setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
    })
    return () => {
      live = false
    }
  }, [link])
  return src
}

/** One HandalServ sticker, 63.5 × 38.1 mm: logo, 24/7 line, WhatsApp number and QR code. */
export default function Sticker({ info, qr }: { info: StickerInfo; qr: string }) {
  return (
    <div className="sticker">
      <div className="sticker-main">
        <img src={BRAND.logo} alt={BRAND.name} className="sticker-logo" />
        <div className="sticker-line">Kecemasan Elektrik 24/7</div>
        <div className="sticker-wa">
          <small>WhatsApp</small>
          {BRAND.whatsapp}
        </div>
      </div>
      <div className="sticker-qr">
        {qr && <img src={qr} alt="QR code: WhatsApp HandalServ" />}
        <small>Scan · WhatsApp</small>
      </div>
      <div className="sticker-foot">{info.footer}</div>
    </div>
  )
}
