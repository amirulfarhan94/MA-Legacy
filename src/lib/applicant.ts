import type { Applicant } from './cloud'

/** Malaysian IC (MyKad) no. as 900101-10-1234, from whatever was typed. */
export function formatIcNo(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 12)
  return [d.slice(0, 6), d.slice(6, 8), d.slice(8, 12)].filter(Boolean).join('-')
}

export const validIcNo = (ic: string) => /^\d{6}-\d{2}-\d{4}$/.test(ic)

export type ApplicantDraft = Omit<Applicant, 'consentAt'> & { agree: boolean; consent: boolean }

/** What is still missing or wrong in an application, in the words shown to the customer. */
export function applicantProblems(a: ApplicantDraft): string[] {
  const out: string[] = []
  if (!a.name.trim()) out.push('Nama penuh / Full name')
  if (!validIcNo(a.icNo)) out.push('No. IC (12 digit) / IC no. (12 digits)')
  if (a.phone.replace(/\D/g, '').length < 9) out.push('No. telefon / Phone no.')
  if (a.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email.trim())) out.push('Emel / Email')
  if (!a.address.trim()) out.push('Alamat premis / Premises address')
  if (!a.icFront) out.push('Gambar IC depan / IC photo, front')
  if (!a.icBack) out.push('Gambar IC belakang / IC photo, back')
  if (!a.signature) out.push('Tandatangan / Signature')
  if (!a.agree) out.push('Persetujuan terma / Agree to the terms')
  if (!a.consent) out.push('Kebenaran data peribadi / Personal data consent')
  return out
}
