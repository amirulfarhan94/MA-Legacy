import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme, type ThemeChoice } from '../lib/theme'

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'auto', label: 'Auto', icon: Monitor },
]

/** Light / Dark / Auto segmented control for the sidebar. */
export default function ThemeSwitch() {
  const [choice, setChoice] = useTheme()
  return (
    <div className="px-3 pb-3">
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-1 rounded-lg bg-white/5 p-1">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            role="radio"
            aria-checked={choice === value}
            onClick={() => setChoice(value)}
            className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs transition-colors ${
              choice === value ? 'bg-gold-600/20 font-medium text-gold-300' : 'text-stone-400 hover:text-white'
            }`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>
    </div>
  )
}
