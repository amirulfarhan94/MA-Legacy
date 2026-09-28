import { useEffect, useState } from 'react'

export type ThemeChoice = 'light' | 'dark' | 'auto'

const KEY = 'ma-legacy-theme'
const media = () => window.matchMedia('(prefers-color-scheme: dark)')

export function getThemeChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    /* storage blocked: fall back to auto */
  }
  return 'auto'
}

/** Adds/removes the `dark` class on <html>. index.html runs the same check before first paint. */
export function applyTheme(choice: ThemeChoice) {
  const dark = choice === 'dark' || (choice === 'auto' && media().matches)
  document.documentElement.classList.toggle('dark', dark)
}

export function useTheme(): [ThemeChoice, (c: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice>(getThemeChoice)

  useEffect(() => {
    applyTheme(choice)
    if (choice !== 'auto') return
    // Follow the phone/computer setting live while on auto.
    const mq = media()
    const onChange = () => applyTheme('auto')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [choice])

  const update = (c: ThemeChoice) => {
    try {
      if (c === 'auto') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, c)
    } catch {
      /* ignore */
    }
    setChoice(c)
  }
  return [choice, update]
}
