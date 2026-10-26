import { useSyncExternalStore } from 'react'
import type { Bytes } from 'firebase/firestore'
import { cloud } from './cloud'
import { cloudDeleteQueue, getRecord, putRecord, referencedIds, setRemotePhotos } from './photos'
import { useStore } from './store'
import type { Document, Transaction } from './types'

/** Records in Recently deleted, whose photos stay in the cloud so they can be restored. */
export interface InBin {
  documents: Document[]
  transactions: Transaction[]
}

/**
 * Work photos and IC photos in the cloud, while sync is on. Each photo is one Firestore
 * document (users/{uid}/photos/{id}) holding the JPEG bytes, which keeps it on the free plan:
 * photos are scaled to about 200-300 KB, and Firestore allows 1 MiB per document.
 *
 * Photos go up from the device that has them, one at a time, once a saved document uses them.
 * Other devices fetch a photo only when it is shown, printed or backed up. A photo no document
 * uses any more (counting documents in Recently deleted) is deleted from the cloud too.
 */

/** Firestore's limit is 1 MiB per document; leave room for the other fields. */
const MAX_BYTES = 1_000_000

interface CloudPhoto {
  data: Bytes
  type: string
  size: number
  createdAt: number
}

let uid: string | undefined
let stopWatch: (() => void) | undefined
let inBinNow: () => InBin = () => ({ documents: [], transactions: [] })
/** Photos known to be in the cloud, so they are not looked up again. */
const known = new Set<string>()
let queue: string[] = []
let working = false
let timer: ReturnType<typeof setTimeout> | undefined

let left = 0
const listeners = new Set<() => void>()
const setLeft = (n: number) => {
  if (n === left) return
  left = n
  listeners.forEach((l) => l())
}

/** Photos on this device still waiting to go up. */
export function usePhotosToUpload(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => left,
  )
}

const photoRef = async (id: string) => {
  const { db, fs } = await cloud()
  return fs.doc(db, 'users', uid!, 'photos', id)
}

/** Makes a JPEG small enough for one Firestore document. */
async function fit(blob: Blob): Promise<Blob> {
  let out = blob
  for (const [side, quality] of [
    [1400, 0.78],
    [1200, 0.72],
    [1000, 0.68],
  ] as const) {
    if (out.size <= MAX_BYTES) break
    const img = await createImageBitmap(blob)
    const scale = Math.min(1, side / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    out = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Could not shrink a photo.'))), 'image/jpeg', quality))
  }
  return out
}

async function upload(id: string) {
  const r = await getRecord(id)
  if (!r) return
  if (r.synced) return void known.add(id)
  const blob = await fit(r.blob)
  const { fs } = await cloud()
  const photo: CloudPhoto = {
    data: fs.Bytes.fromUint8Array(new Uint8Array(await blob.arrayBuffer())),
    type: blob.type || 'image/jpeg',
    size: blob.size,
    createdAt: r.createdAt,
  }
  // Resolves once the cloud has it; offline it waits for the internet.
  await fs.setDoc(await photoRef(id), photo)
  await putRecord({ ...r, blob, synced: true })
  known.add(id)
}

/** Sends up, one at a time, the photos saved documents use that the cloud has not got yet. */
async function work() {
  if (working) return
  working = true
  try {
    while (uid && queue.length) {
      setLeft(queue.length)
      const id = queue[0]
      try {
        await upload(id)
      } catch {
        // Try again next time (e.g. the photo could not be read); move on to the rest.
      }
      queue = queue.slice(1)
    }
  } finally {
    working = false
    setLeft(queue.length)
  }
}

function scan() {
  if (!uid) return
  const { documents, transactions } = useStore.getState()
  const used = referencedIds(documents, transactions)
  const todo = [...used].filter((id) => !known.has(id) && !queue.includes(id))
  if (!todo.length) return
  queue = [...queue, ...todo]
  setLeft(queue.length)
  work()
}

/** Deletes from the cloud photos removed here that no record, not even a deleted one, still uses. */
async function cleanUp() {
  const ids = cloudDeleteQueue.get()
  if (!uid || !ids.length) return
  const { documents, transactions } = useStore.getState()
  const live = referencedIds(documents, transactions)
  const bin = inBinNow()
  const inBin = referencedIds(bin.documents, bin.transactions)
  const { fs } = await cloud()
  const keep: string[] = []
  for (const id of ids) {
    if (live.has(id)) continue
    if (inBin.has(id)) {
      keep.push(id)
      continue
    }
    fs.deleteDoc(await photoRef(id)).catch(() => {})
    known.delete(id)
  }
  cloudDeleteQueue.set(keep)
}

/**
 * Called by sync once every list has heard from the server: sends up photos the cloud has not
 * got (on the first run, every photo already on this device) and from then on watches for new ones.
 */
export function startPhotoSync(ownerUid: string, inBin: () => InBin) {
  if (uid === ownerUid) return
  stopPhotoSync()
  uid = ownerUid
  inBinNow = inBin
  setRemotePhotos(async (id) => {
    const { fs } = await cloud()
    const snap = await fs.getDoc(await photoRef(id))
    if (!snap.exists()) return null
    const p = snap.data() as CloudPhoto
    known.add(id)
    return new Blob([p.data.toUint8Array() as Uint8Array<ArrayBuffer>], { type: p.type })
  })
  stopWatch = useStore.subscribe((st, prev) => {
    if (st.documents === prev.documents && st.transactions === prev.transactions) return
    clearTimeout(timer)
    timer = setTimeout(scan, 1500)
  })
  scan()
  cleanUp()
}

export function stopPhotoSync() {
  uid = undefined
  stopWatch?.()
  stopWatch = undefined
  clearTimeout(timer)
  setRemotePhotos(undefined)
  queue = []
  setLeft(0)
}

/** Photos in the cloud and the space they take, for Settings. */
export async function cloudPhotoUsage(ownerUid: string): Promise<{ count: number; bytes: number }> {
  const { db, fs } = await cloud()
  const snap = await fs.getAggregateFromServer(fs.collection(db, 'users', ownerUid, 'photos'), { count: fs.count(), bytes: fs.sum('size') })
  return { count: snap.data().count, bytes: snap.data().bytes ?? 0 }
}
