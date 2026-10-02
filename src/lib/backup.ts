import { useSyncExternalStore } from 'react'
import { today } from './calc'
import { useStore } from './store'

const LAST_KEY = 'ma-legacy-last-backup'
const SNOOZE_KEY = 'ma-legacy-backup-snooze'
export const BACKUP_EVERY_DAYS = 7
const DAY = 24 * 60 * 60 * 1000

const read = (k: string) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* storage blocked */
  }
}

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** ISO timestamp of the last successful backup, or null if never. */
export function useLastBackup(): string | null {
  return useSyncExternalStore(subscribe, () => read(LAST_KEY))
}

export function daysSince(iso: string | null): number | null {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY)
}

/** Hide the reminder for a day. */
export function snoozeBackupReminder() {
  write(SNOOZE_KEY, new Date(Date.now() + DAY).toISOString())
  notify()
}

/** True when there is data and the last backup is missing or 7+ days old (and not snoozed). */
export function useBackupDue(): boolean {
  const last = useLastBackup()
  const snooze = useSyncExternalStore(subscribe, () => read(SNOOZE_KEY))
  const hasData = useStore((s) => s.customers.length + s.documents.length + s.transactions.length > 0)
  if (!hasData) return false
  if (snooze && new Date(snooze).getTime() > Date.now()) return false
  const days = daysSince(last)
  return days === null || days >= BACKUP_EVERY_DAYS
}

function markBackedUp() {
  write(LAST_KEY, new Date().toISOString())
  notify()
}

function download(file: File) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file)
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export type BackupResult = 'shared' | 'downloaded' | 'cancelled'

/**
 * Opens the phone's share sheet (Google Drive, WhatsApp, Files…) with the backup file,
 * or downloads it where sharing files isn't supported (most desktops).
 */
export async function backupNow(): Promise<BackupResult> {
  const json = JSON.stringify(useStore.getState().exportData(), null, 2)
  const base = `ma-legacy-backup-${today()}`
  // Chrome on Android only shares an allow-list of file types that excludes .json,
  // so fall back to .txt there; Restore accepts both.
  const candidates = [
    new File([json], `${base}.json`, { type: 'application/json' }),
    new File([json], `${base}.txt`, { type: 'text/plain' }),
  ]
  const shareable = typeof navigator.canShare === 'function' ? candidates.find((f) => navigator.canShare({ files: [f] })) : undefined
  const isTouch = window.matchMedia('(pointer: coarse)').matches

  if (shareable && isTouch) {
    try {
      await navigator.share({ files: [shareable], title: 'MA Legacy backup', text: `MA Legacy backup ${today()}` })
      markBackedUp()
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      // Share failed for another reason: fall through to a normal download.
    }
  }
  download(candidates[0])
  markBackedUp()
  return 'downloaded'
}
