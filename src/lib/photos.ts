import { useEffect, useState } from 'react'
import type { Document } from './types'

/**
 * Work photos. The pictures are too big for localStorage, so they live in this browser's
 * IndexedDB; documents keep only each photo's id and caption. Backups carry the pictures.
 * With sync on, photoSync.ts also keeps them in the cloud and fetches ones taken elsewhere.
 */

export interface PhotoRecord {
  id: string
  blob: Blob
  createdAt: number
  /** Already in the cloud (sent from here, or fetched from there). */
  synced?: boolean
}

const DB_NAME = 'ma-legacy-photos'
const STORE = 'photos'
/** Longest side of a stored photo: sharp on an A4 page, about 200-300 KB as JPEG. */
const MAX_SIDE = 1600
const DAY = 24 * 60 * 60 * 1000

let dbPromise: Promise<IDBDatabase> | undefined

function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  const tx = (await db()).transaction(STORE, mode)
  const req = work(tx.objectStore(STORE))
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(req ? req.result : (undefined as T))
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export const getRecord = (id: string) => run<PhotoRecord | undefined>('readonly', (s) => s.get(id))
export const putRecord = (r: PhotoRecord) => run('readwrite', (s) => void s.put(r))

/** Fetches a photo that is not on this device from the cloud (set while syncing). */
let remote: ((id: string) => Promise<Blob | null>) | undefined
export function setRemotePhotos(fetcher: typeof remote) {
  remote = fetcher
  // Photos looked for before sync started may be in the cloud: look again.
  for (const [id, url] of urls) if (url === null) urls.delete(id)
}

/** Photos no document uses any more and deleted here, still to be deleted from the cloud. */
const CLOUD_DELETE_KEY = 'ma-legacy-photo-cloud-delete'
export const cloudDeleteQueue = {
  get(): string[] {
    try {
      return JSON.parse(localStorage.getItem(CLOUD_DELETE_KEY) ?? '[]') as string[]
    } catch {
      return []
    }
  },
  set(ids: string[]) {
    try {
      if (ids.length) localStorage.setItem(CLOUD_DELETE_KEY, JSON.stringify([...new Set(ids)]))
      else localStorage.removeItem(CLOUD_DELETE_KEY)
    } catch {
      /* storage blocked */
    }
  },
}

/** Scales a camera photo down and saves it. Returns the new photo's id. */
export async function addPhoto(file: File): Promise<string> {
  const blob = await shrinkPhoto(file)
  const id = crypto.randomUUID()
  await run('readwrite', (s) => s.put({ id, blob, createdAt: Date.now() } satisfies PhotoRecord))
  return id
}

/** Saves a picture that is already small (e.g. an IC photo from an online application). */
export async function addPhotoFromDataUrl(dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob()
  const id = crypto.randomUUID()
  await run('readwrite', (s) => s.put({ id, blob, createdAt: Date.now() } satisfies PhotoRecord))
  return id
}

function shrinkPhoto(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.naturalWidth * scale)
      canvas.height = Math.round(img.naturalHeight * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Could not read that photo.'))
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not save that photo.'))), 'image/jpeg', 0.82)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`${file.name} is not a photo the browser can read.`))
    }
    img.src = url
  })
}

// Object URLs are shared by every view of a photo and kept for the session.
const urls = new Map<string, string | null>()
const pending = new Map<string, Promise<void>>()

function load(id: string): Promise<void> {
  if (urls.has(id)) return Promise.resolve()
  let p = pending.get(id)
  if (!p) {
    p = getRecord(id)
      .then(async (r) => {
        let blob = r?.blob ?? null
        if (!blob && remote) {
          blob = await remote(id).catch(() => null)
          if (blob) await putRecord({ id, blob, createdAt: Date.now(), synced: true }).catch(() => {})
        }
        urls.set(id, blob ? URL.createObjectURL(blob) : null)
      })
      .catch(() => void urls.set(id, null))
      .finally(() => pending.delete(id))
    pending.set(id, p)
  }
  return p
}

/**
 * Display URLs for photos. A photo maps to null when it is not on this device (taken on
 * another one, or the browser's data was cleared) and is missing while still loading.
 */
export function usePhotoUrls(ids: string[]): Record<string, string | null> {
  const key = ids.join(',')
  const [, setVersion] = useState(0)
  useEffect(() => {
    let live = true
    const todo = key ? key.split(',').filter((id) => !urls.has(id)) : []
    if (todo.length) Promise.all(todo.map(load)).then(() => live && setVersion((v) => v + 1))
    return () => {
      live = false
    }
  }, [key])
  return Object.fromEntries(ids.filter((id) => urls.has(id)).map((id) => [id, urls.get(id)!]))
}

/** Waits until the photos are ready to show, e.g. before printing or making a PDF. */
export const photosReady = (ids: string[]) => Promise.all(ids.map(load))

/** Photos still in use: work photos on documents and IC copies on split payment plans. */
export const referencedIds = (docs: Document[]) => new Set(docs.flatMap((d) => [...(d.photos?.map((p) => p.id) ?? []), ...(d.split?.icPhotoIds ?? [])]))

/**
 * Deletes pictures no document uses any more. Photos from the last day are kept, since a
 * document being edited may not have been saved yet.
 */
export async function cleanUpPhotos(docs: Document[]) {
  const used = referencedIds(docs)
  const all = await run<PhotoRecord[]>('readonly', (s) => s.getAll())
  const staleRecords = all.filter((r) => !used.has(r.id) && Date.now() - r.createdAt > DAY)
  const stale = staleRecords.map((r) => r.id)
  if (!stale.length) return
  // Ones in the cloud are deleted there too, once sync has checked no deleted document still needs them.
  const inCloud = staleRecords.filter((r) => r.synced).map((r) => r.id)
  if (inCloud.length) cloudDeleteQueue.set([...cloudDeleteQueue.get(), ...inCloud])
  await run('readwrite', (s) => void stale.forEach((id) => s.delete(id)))
}

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })

/** The documents' photos as data URLs, for a backup file. */
export async function exportPhotos(docs: Document[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const id of referencedIds(docs)) {
    const r = await getRecord(id)
    // With sync on, photos taken on another device come from the cloud.
    const blob = r?.blob ?? (remote ? await remote(id).catch(() => null) : null)
    if (blob) out[id] = await toDataUrl(blob)
  }
  return out
}

/** Saves the photos from a backup file. */
export async function importPhotos(photos: Record<string, string> | undefined) {
  if (!photos) return
  for (const [id, dataUrl] of Object.entries(photos)) {
    const blob = await (await fetch(dataUrl)).blob()
    await run('readwrite', (s) => s.put({ id, blob, createdAt: Date.now() } satisfies PhotoRecord))
    const old = urls.get(id)
    if (old) URL.revokeObjectURL(old)
    urls.delete(id)
  }
}
