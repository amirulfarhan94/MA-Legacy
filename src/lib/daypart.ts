import { useEffect, useState } from 'react'

export type Daypart = 'morning' | 'afternoon' | 'evening'

/** Before noon is morning, noon until 6 pm is afternoon, from 6 pm it is evening (device time). */
export function daypartOf(d: Date): Daypart {
  const h = d.getHours()
  return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'
}

/** The current time, refreshed every `everyMs` so greetings and clocks stay right. */
export function useNow(everyMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), everyMs)
    // Catch up straight away when the app comes back from the background.
    const onVisible = () => document.visibilityState === 'visible' && setNow(new Date())
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [everyMs])
  return now
}
