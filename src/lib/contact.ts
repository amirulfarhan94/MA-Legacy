/** Malaysian numbers: 012-345 6789 → 60123456789 for wa.me links. */
export function waNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.startsWith('0') ? `6${digits}` : digits
}

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

/** WhatsApp chat link, optionally with a message ready to send. */
export const waHref = (phone: string, text?: string) => `https://wa.me/${waNumber(phone)}${text ? `?text=${encodeURIComponent(text)}` : ''}`

/** "Aisyah Catering Enterprise" → "AC" */
export function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean)
  return words.slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?'
}
