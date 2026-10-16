import { describe, expect, it } from 'vitest'
import { daypartOf } from './daypart'

const at = (h: number, m = 0) => new Date(2026, 9, 16, h, m)

describe('daypartOf', () => {
  it('follows the clock', () => {
    expect(daypartOf(at(0))).toBe('morning')
    expect(daypartOf(at(11, 59))).toBe('morning')
    expect(daypartOf(at(12))).toBe('afternoon')
    expect(daypartOf(at(17, 59))).toBe('afternoon')
    expect(daypartOf(at(18))).toBe('evening')
    expect(daypartOf(at(23, 59))).toBe('evening')
  })
})
