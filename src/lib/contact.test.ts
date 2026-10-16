import { describe, expect, it } from 'vitest'
import { initials, telHref, waHref, waNumber } from './contact'

describe('contact links', () => {
  it('turns local numbers into WhatsApp numbers', () => {
    expect(waNumber('012-345 6789')).toBe('60123456789')
    expect(waNumber('+60 13-222 1100')).toBe('60132221100')
    expect(waHref('03-7781 2233')).toBe('https://wa.me/60377812233')
    expect(waHref('012-345 6789', 'Hi & bye')).toBe('https://wa.me/60123456789?text=Hi%20%26%20bye')
    expect(telHref('012-345 6789')).toBe('tel:0123456789')
  })
  it('makes initials', () => {
    expect(initials('Aisyah Catering Enterprise')).toBe('AC')
    expect(initials('TKL Trading')).toBe('TT')
    expect(initials('Mr. Tan')).toBe('MT')
    expect(initials('')).toBe('?')
  })
})
