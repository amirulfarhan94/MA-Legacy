import { useEffect, useSyncExternalStore } from 'react'

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

/** Browser/status bar colour for each theme (matches the top bar). */
export const THEME_COLOR = { light: '#f2f4f7', dark: '#0d1117' }

/** Adds/removes the `dark` class on <html>. index.html runs the same check before first paint. */
export function applyTheme(choice: ThemeChoice) {
  const dark = choice === 'dark' || (choice === 'auto' && media().matches)
  document.documentElement.classList.toggle('dark', dark)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? THEME_COLOR.dark : THEME_COLOR.light)
}

/** True when the app is currently drawn dark (whatever the choice). */
export const isDarkNow = () => document.documentElement.classList.contains('dark')

// Every switch on screen (sidebar, phone menu, search) shares one choice.
const listeners = new Set<() => void>()
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

function setThemeChoice(c: ThemeChoice) {
  try {
    if (c === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, c)
  } catch {
    /* ignore */
  }
  applyTheme(c)
  listeners.forEach((l) => l())
}

export function useTheme(): [ThemeChoice, (c: ThemeChoice) => void] {
  const choice = useSyncExternalStore(subscribe, getThemeChoice)

  useEffect(() => {
    applyTheme(choice)
    if (choice !== 'auto') return
    // Follow the phone/computer setting live while on auto.
    const mq = media()
    const onChange = () => applyTheme('auto')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [choice])

  return [choice, setThemeChoice]
}
