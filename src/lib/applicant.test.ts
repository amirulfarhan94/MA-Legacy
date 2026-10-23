import { describe, expect, it } from 'vitest'
import { applicantProblems, formatIcNo, validIcNo, type ApplicantDraft } from './applicant'
import { newToken } from './cloud'

const ok: ApplicantDraft = {
  name: 'Hafiz bin Abdullah',
  icNo: '850312-10-5521',
  phone: '012-345 6789',
  email: '',
  address: 'No. 12, Jalan Perusahaan 3, Shah Alam',
  icFront: 'data:image/jpeg;base64,AAA',
  icBack: 'data:image/jpeg;base64,BBB',
  signature: 'data:image/png;base64,CCC',
  agree: true,
  consent: true,
}

describe('online split payment application', () => {
  it('formats and checks MyKad numbers', () => {
    expect(formatIcNo('850312105521')).toBe('850312-10-5521')
    expect(formatIcNo('850312 10 5521 99')).toBe('850312-10-5521')
    expect(formatIcNo('8503')).toBe('8503')
    expect(validIcNo('850312-10-5521')).toBe(true)
    expect(validIcNo('850312-10-552')).toBe(false)
  })

  it('accepts a complete application (email is optional)', () => {
    expect(applicantProblems(ok)).toEqual([])
  })

  it('names everything that is missing', () => {
    const p = applicantProblems({ ...ok, icNo: '8503', icBack: '', signature: '', consent: false, email: 'not-an-email' })
    expect(p).toEqual([
      'No. IC (12 digit) / IC no. (12 digits)',
      'Emel / Email',
      'Gambar IC belakang / IC photo, back',
      'Tandatangan / Signature',
      'Kebenaran data peribadi / Personal data consent',
    ])
  })

  it('makes link tokens nobody can guess', () => {
    const a = newToken()
    expect(a).toMatch(/^[0-9a-f]{32}$/)
    expect(new Set(Array.from({ length: 200 }, newToken)).size).toBe(200)
  })
})
