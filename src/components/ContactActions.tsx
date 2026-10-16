import { MessageCircle, Phone } from 'lucide-react'
import { initials, telHref, waHref } from '../lib/contact'

const btn =
  'relative z-10 grid size-10 shrink-0 place-items-center rounded-full border border-[var(--btn-line)] bg-[var(--btn)] transition-colors hover:border-gold-500'

/** Call and WhatsApp buttons for a contact; nothing when there is no phone number. */
export default function ContactActions({ phone, name }: { phone: string; name: string }) {
  if (!phone.replace(/\D/g, '')) return null
  return (
    <span className="flex shrink-0 gap-1.5">
      <a href={telHref(phone)} className={`${btn} text-[var(--color-accent)]`} aria-label={`Call ${name}`} title={`Call ${phone}`} onClick={(e) => e.stopPropagation()}>
        <Phone size={16} />
      </a>
      <a
        href={waHref(phone)}
        target="_blank"
        rel="noreferrer"
        className={`${btn} text-[var(--good)]`}
        aria-label={`WhatsApp ${name}`}
        title={`WhatsApp ${phone}`}
        onClick={(e) => e.stopPropagation()}
      >
        <MessageCircle size={16} />
      </a>
    </span>
  )
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full bg-gold-400/15 font-display font-medium text-gold-700 ${
        size === 'lg' ? 'size-14 text-lg' : 'size-10 text-[13px]'
      }`}
    >
      {initials(name)}
    </span>
  )
}
