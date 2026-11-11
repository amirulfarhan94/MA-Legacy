import { describe, expect, it } from 'vitest'
import { labelPosition, PER_SHEET, stickerInfo } from './sticker'
import type { Document } from './types'

describe('stickerInfo', () => {
  it('names the job in the footer and the WhatsApp message', () => {
    const info = stickerInfo({ number: 'SR/26/1101', date: '2026-11-04' } as Document)
    expect(info.footer).toBe('Diservis 04 Nov 2026 · SR/26/1101')
    expect(info.link).toBe(`https://wa.me/60104305436?text=${encodeURIComponent('Salam HandalServ, saya perlukan servis. (Sticker SR/26/1101)')}`)
  })

  it('has a general footer without a job', () => {
    const info = stickerInfo()
    expect(info.footer).toContain('handalserv.my')
    expect(decodeURIComponent(info.link)).toContain('saya perlukan servis.')
    expect(info.link).not.toContain('Sticker')
  })
})

describe('labelPosition', () => {
  it('lays 21 labels out 3 across and 7 down', () => {
    expect(PER_SHEET).toBe(21)
    expect(labelPosition(0)).toEqual({ top: 15.15, left: 7.25 })
    expect(labelPosition(4)).toEqual({ top: 15.15 + 38.1, left: 7.25 + 66 })
    expect(labelPosition(20).top + 38.1).toBeLessThan(297)
  })
})
