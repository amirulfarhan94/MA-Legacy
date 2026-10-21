import { useEffect, useState, useSyncExternalStore } from 'react'
import { createJSONStorage, type StateStorage } from 'zustand/middleware'

/**
 * Where the app keeps its data: IndexedDB, which holds far more than localStorage's ~5 MB.
 * Data saved by earlier versions in localStorage moves over the first time anything is saved.
 * If a save fails (storage full or blocked), useSaveError() reports it so the app can warn.
 */

const DB_NAME = 'ma-legacy'
const STORE = 'kv'

let dbPromise: Promise<IDBDatabase> | undefined

function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

async function run<T>(mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const tx = (await db()).transaction(STORE, mode)
  const req = work(tx.objectStore(STORE))
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(req.result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

const local = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  remove: (k: string) => {
    try {
      localStorage.removeItem(k)
    } catch {
      /* storage blocked */
    }
  },
}

let saveError: string | null = null
const listeners = new Set<() => void>()
function setSaveError(e: string | null) {
  if (e === saveError) return
  saveError = e
  listeners.forEach((l) => l())
}

/** Why the last save failed, or null when saving works. */
export function useSaveError(): string | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => saveError,
  )
}

/** True when IndexedDB cannot be used at all, so data stays in localStorage as before. */
let localOnly = typeof indexedDB === 'undefined'

const kv: StateStorage = {
  async getItem(name) {
    if (!localOnly) {
      try {
        const v = await run<string | undefined>('readonly', (s) => s.get(name))
        if (v != null) return v
      } catch {
        localOnly = true
      }
    }
    return local.get(name)
  },
  async setItem(name, value) {
    try {
      if (localOnly) {
        localStorage.setItem(name, value)
      } else {
        await run('readwrite', (s) => s.put(value, name))
        // Saved in IndexedDB: the old localStorage copy is no longer needed.
        local.remove(name)
      }
      setSaveError(null)
    } catch (e) {
      const full = e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')
      setSaveError(full ? 'This device is out of storage space.' : 'The browser blocked saving.')
    }
  },
  async removeItem(name) {
    local.remove(name)
    if (!localOnly) await run('readwrite', (s) => s.delete(name)).catch(() => {})
  },
}

export const appStorage = createJSONStorage(() => kv)

/**
 * Asks the browser to keep this app's data even when the device runs low on space or the
 * app is not opened for a while. Browsers decide on their own; installed apps usually get it.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    return (await navigator.storage.persisted()) || (await navigator.storage.persist())
  } catch {
    return false
  }
}

export interface StorageInfo {
  persisted: boolean
  /** Bytes used by this app, when the browser says. */
  usage?: number
  quota?: number
}

export function useStorageInfo(): StorageInfo | null {
  const [info, setInfo] = useState<StorageInfo | null>(null)
  useEffect(() => {
    let live = true
    ;(async () => {
      const persisted = (await navigator.storage?.persisted?.().catch(() => false)) ?? false
      const est = await navigator.storage?.estimate?.().catch(() => undefined)
      if (live) setInfo({ persisted, usage: est?.usage, quota: est?.quota })
    })()
    return () => {
      live = false
    }
  }, [])
  return info
}
