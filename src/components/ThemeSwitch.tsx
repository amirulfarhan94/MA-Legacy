import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme, type ThemeChoice } from '../lib/theme'

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'auto', label: 'Auto', icon: Monitor },
]

/** Light / Dark / Auto for the sidebar; the icon rail gets one button that cycles. */
export default function ThemeSwitch() {
  const [choice, setChoice] = useTheme()
  const i = OPTIONS.findIndex((o) => o.value === choice)
  const current = OPTIONS[i]
  const next = OPTIONS[(i + 1) % OPTIONS.length]
  return (
    <>
      <div className="full-only">
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-1 rounded-full border border-[var(--btn-line)] bg-[var(--btn)] p-1">
          {OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={choice === value}
              onClick={() => setChoice(value)}
              title={label}
              aria-label={label}
              className={`flex h-8 items-center justify-center gap-1.5 rounded-full text-xs font-semibold transition-colors ${
                choice === value ? 'bg-[var(--item-active)] text-stone-900 shadow-[var(--item-active-shadow)]' : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              <Icon size={14} />
              <span className="theme-label">{label}</span>
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="side-item rail-only"
        onClick={() => setChoice(next.value)}
        title={`Theme: ${current.label}. Tap for ${next.label}.`}
        aria-label={`Theme: ${current.label}. Switch to ${next.label}`}
      >
        <current.icon size={18} strokeWidth={1.7} />
      </button>
    </>
  )
}
