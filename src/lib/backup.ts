import { useSyncExternalStore } from 'react'
import { today } from './calc'
import { exportPhotos } from './photos'
import { useStore } from './store'
import { useSyncWanted } from './sync'

const LAST_KEY = 'ma-legacy-last-backup'
const SNOOZE_KEY = 'ma-legacy-backup-snooze'
export const BACKUP_EVERY_DAYS = 7
/** With sync on, records and photos are also in the cloud; a monthly file is extra protection. */
export const SYNCED_BACKUP_EVERY_DAYS = 30
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

/** How often to ask for a backup on this device. */
export function useBackupEveryDays(): number {
  return useSyncWanted() ? SYNCED_BACKUP_EVERY_DAYS : BACKUP_EVERY_DAYS
}

/** True when there is data and the last backup is missing or overdue (and not snoozed). */
export function useBackupDue(): boolean {
  const every = useBackupEveryDays()
  const last = useLastBackup()
  const snooze = useSyncExternalStore(subscribe, () => read(SNOOZE_KEY))
  const hasData = useStore((s) => s.customers.length + s.documents.length + s.transactions.length > 0)
  if (!hasData) return false
  if (snooze && new Date(snooze).getTime() > Date.now()) return false
  const days = daysSince(last)
  return days === null || days >= every
}

function markBackedUp() {
  write(LAST_KEY, new Date().toISOString())
  notify()
}

export function downloadFile(file: File) {
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
  const data = useStore.getState().exportData()
  const photos = await exportPhotos(data.documents, data.transactions)
  const json = JSON.stringify(Object.keys(photos).length ? { ...data, photos } : data, null, 2)
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
  downloadFile(candidates[0])
  markBackedUp()
  return 'downloaded'
}
