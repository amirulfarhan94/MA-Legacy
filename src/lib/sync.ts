import { useEffect, useSyncExternalStore } from 'react'
import type { DocumentReference, DocumentSnapshot, QuerySnapshot } from 'firebase/firestore'
import { cloud, useCloudUser } from './cloud'
import { startPhotoSync, stopPhotoSync } from './photoSync'
import { useStore } from './store'
import { applyRemote, diffRecords, localOnly, type RemoteChange, type SyncRecord } from './syncMerge'
import type { CatalogItem, Document, Settings } from './types'

/**
 * Keeps the owner's records the same on every signed-in device through Firestore.
 *
 * The device stays the main copy: the app reads and saves locally as before and works offline.
 * Each record is one cloud document under users/{uid}/{list}/{id} holding the record as JSON,
 * so only what changed is sent. Changes from other devices replace the local record; when two
 * devices edit the same record, the one saved last wins. A delete leaves the record in the
 * cloud marked as deleted for 30 days, so it can be put back (Settings → Recently deleted).
 * Work photos and IC photos are synced separately, by photoSync.ts.
 */

export const SYNCED_LISTS = ['customers', 'documents', 'catalog', 'transactions'] as const
export type SyncedList = (typeof SYNCED_LISTS)[number]

export const KEEP_DELETED_DAYS = 30
const DAY = 24 * 60 * 60 * 1000
/** Firestore refuses documents over 1 MiB. */
const MAX_JSON = 1_000_000
/** Writes per batch; Firestore allows 500. */
const BATCH = 400
/** Holds the uid this device syncs for, so sync starts again by itself next time. */
const SYNC_KEY = 'ma-legacy-sync'

interface CloudRecord {
  json: string
  updatedAt: number
  deleted: boolean
  deletedAt?: number
}

export interface DeletedRecord {
  list: SyncedList
  id: string
  deletedAt: number
  record: SyncRecord
}

export type SyncPhase = 'off' | 'syncing' | 'synced' | 'offline' | 'error'
export interface SyncStatus {
  phase: SyncPhase
  /** Changes made here that the cloud has not confirmed yet. */
  pending: number
  error?: string
}

// ---------------------------------------------------------------- state shared with React

let running: string | undefined
let stops: (() => void)[] = []
/** True while changes from the cloud are put into the store, so they are not sent back. */
let applying = false
/** Lists (and settings) that have heard from the server since sync started. */
let loaded = new Set<string>()
let pending = 0
let error: string | undefined
const deleted = new Map<string, DeletedRecord>()

let status: SyncStatus = { phase: 'off', pending: 0 }
let deletedList: DeletedRecord[] = []
const listeners = new Set<() => void>()
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

function refresh() {
  const online = typeof navigator === 'undefined' || navigator.onLine
  const phase: SyncPhase = !running
    ? 'off'
    : error
      ? 'error'
      : !online
        ? 'offline'
        : pending > 0 || loaded.size < SYNCED_LISTS.length + 1
          ? 'syncing'
          : 'synced'
  if (phase !== status.phase || pending !== status.pending || error !== status.error) {
    status = { phase, pending, error }
    listeners.forEach((l) => l())
  }
}

function refreshDeleted() {
  deletedList = [...deleted.values()].sort((x, y) => y.deletedAt - x.deletedAt)
  listeners.forEach((l) => l())
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', refresh)
  window.addEventListener('offline', refresh)
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribe, () => status)
}

/** Records deleted on any device in the last 30 days, newest first. */
export function useRecentlyDeleted(): DeletedRecord[] {
  return useSyncExternalStore(subscribe, () => deletedList)
}

const storedUid = () => {
  try {
    return localStorage.getItem(SYNC_KEY)
  } catch {
    return null
  }
}
const storeUid = (uid: string | null) => {
  try {
    if (uid) localStorage.setItem(SYNC_KEY, uid)
    else localStorage.removeItem(SYNC_KEY)
  } catch {
    /* storage blocked */
  }
}

/** Whether this device is set to sync (for the signed-in owner). */
export function useSyncWanted(): boolean {
  useSyncStatus()
  return !!storedUid()
}

// ---------------------------------------------------------------- the engine

function fail(e: unknown) {
  if (!running) return
  const code = (e as { code?: string }).code
  error =
    code === 'permission-denied'
      ? 'The cloud refused access. Sign out and sign in again.'
      : code === 'resource-exhausted'
        ? "Today's free cloud limit is used up. Changes are kept here and sync tomorrow."
        : e instanceof Error
          ? e.message
          : 'Sync failed.'
  refresh()
}

const parse = (json: string): SyncRecord | null => {
  try {
    return JSON.parse(json) as SyncRecord
  } catch {
    return null
  }
}

/** Puts changes from the cloud into the store without sending them back. */
function putInStore(patch: Partial<Record<SyncedList, SyncRecord[]>> | { settings: Settings }) {
  applying = true
  try {
    useStore.setState(patch as never)
  } finally {
    applying = false
  }
}

type Write = { ref: DocumentReference; data: CloudRecord | null }

async function send(writes: Write[]) {
  if (!writes.length) return
  const { db, fs } = await cloud()
  for (let i = 0; i < writes.length; i += BATCH) {
    const batch = fs.writeBatch(db)
    for (const w of writes.slice(i, i + BATCH)) {
      if (w.data) batch.set(w.ref, w.data)
      else batch.delete(w.ref)
    }
    pending++
    refresh()
    // Offline, this waits until the device is back online; the change is already kept locally.
    batch
      .commit()
      .then(() => {
        if (error && !error.includes('too large')) error = undefined
      })
      .catch(fail)
      .finally(() => {
        pending--
        refresh()
      })
  }
}

function record(json: string, deletedAt?: number): CloudRecord {
  const now = Date.now()
  return deletedAt ? { json, updatedAt: now, deleted: true, deletedAt } : { json, updatedAt: now, deleted: false }
}

export async function startSync(uid: string) {
  if (running === uid) return
  stopSync()
  running = uid
  error = undefined
  loaded = new Set()
  deleted.clear()
  refreshDeleted()
  refresh()

  const { db, fs } = await cloud()
  if (running !== uid) return
  const user = fs.doc(db, 'users', uid)
  const listRef = (list: SyncedList) => fs.collection(user, list)
  const settingsRef = fs.doc(user, 'meta', 'settings')

  const tooLarge = (what: string) => {
    error = `${what} is too large to sync (over 1 MB). Use smaller images.`
    refresh()
  }
  const toWrite = (list: SyncedList, r: SyncRecord, deletedAt?: number): Write | null => {
    const json = JSON.stringify(r)
    if (json.length > MAX_JSON) {
      tooLarge(`A record in ${list}`)
      return null
    }
    return { ref: fs.doc(listRef(list), r.id), data: record(json, deletedAt) }
  }

  // Changes made on this device go up.
  stops.push(
    useStore.subscribe((st, prev) => {
      if (applying) return
      const writes: (Write | null)[] = []
      for (const list of SYNCED_LISTS) {
        if (st[list] === prev[list]) continue
        const { upserts, deletes } = diffRecords<SyncRecord>(prev[list], st[list])
        const at = Date.now()
        for (const r of upserts) writes.push(toWrite(list, r))
        for (const r of deletes) writes.push(toWrite(list, r, at))
      }
      if (st.settings !== prev.settings) {
        const json = JSON.stringify(st.settings)
        if (json.length > MAX_JSON) tooLarge('Settings (logo, QR, signature and stamp)')
        else writes.push({ ref: settingsRef, data: record(json) })
      }
      send(writes.filter((w): w is Write => !!w))
    }),
  )

  // Changes from other devices come down.
  const onList = (list: SyncedList) => (snap: QuerySnapshot) => {
    const changes: RemoteChange<SyncRecord>[] = []
    for (const ch of snap.docChanges()) {
      // Ours, not yet confirmed: the store already has it.
      if (ch.doc.metadata.hasPendingWrites) continue
      const key = `${list}/${ch.doc.id}`
      if (ch.type === 'removed') {
        if (deleted.delete(key)) refreshDeleted()
        continue
      }
      const d = ch.doc.data() as CloudRecord
      const r = parse(d.json)
      if (!r) continue
      if (d.deleted) {
        deleted.set(key, { list, id: ch.doc.id, deletedAt: d.deletedAt ?? d.updatedAt, record: r })
        changes.push({ id: ch.doc.id, record: null })
      } else {
        deleted.delete(key)
        changes.push({ id: ch.doc.id, record: r })
      }
    }
    let next = applyRemote(useStore.getState()[list] as SyncRecord[], changes)
    // The catalog is kept in A–Z order, like the store does when an item is saved here.
    if (next && list === 'catalog') next = (next as CatalogItem[]).sort((x, y) => x.description.localeCompare(y.description))
    if (next) putInStore({ [list]: next })
    refreshDeleted()

    // The first answer from the server (not the device's cache): send up what the cloud has
    // never seen, and clear deletes older than 30 days for good.
    if (!snap.metadata.fromCache && !loaded.has(list)) {
      loaded.add(list)
      const known = new Set(snap.docs.map((d) => d.id))
      const writes: (Write | null)[] = localOnly(useStore.getState()[list] as SyncRecord[], known).map((r) => toWrite(list, r))
      const old = Date.now() - KEEP_DELETED_DAYS * DAY
      for (const d of deleted.values()) {
        if (d.list === list && d.deletedAt < old) writes.push({ ref: fs.doc(listRef(list), d.id), data: null })
      }
      send(writes.filter((w): w is Write => !!w))
    }
    whenLoaded()
    refresh()
  }

  // Photos start once every list is up to date, so they are checked against current documents.
  const whenLoaded = () => {
    if (loaded.size < SYNCED_LISTS.length + 1) return
    startPhotoSync(uid, () => [...deleted.values()].filter((d) => d.list === 'documents').map((d) => d.record as Document))
  }

  const onSettings = (snap: DocumentSnapshot) => {
    if (snap.metadata.hasPendingWrites) return
    if (snap.exists()) {
      const json = (snap.data() as CloudRecord).json
      if (json !== JSON.stringify(useStore.getState().settings)) {
        const s = parse(json) as unknown as Settings | null
        if (s) putInStore({ settings: { ...useStore.getState().settings, ...s } })
      }
    }
    if (!snap.metadata.fromCache && !loaded.has('settings')) {
      loaded.add('settings')
      if (!snap.exists()) send([{ ref: settingsRef, data: record(JSON.stringify(useStore.getState().settings)) }])
    }
    whenLoaded()
    refresh()
  }

  for (const list of SYNCED_LISTS) {
    stops.push(fs.onSnapshot(listRef(list), { includeMetadataChanges: true }, onList(list), fail))
  }
  stops.push(fs.onSnapshot(settingsRef, { includeMetadataChanges: true }, onSettings, fail))

  // Changes saved offline in an earlier session are still waiting to go up.
  pending++
  fs.waitForPendingWrites(db)
    .catch(() => {})
    .finally(() => {
      pending--
      refresh()
    })
}

export function stopSync() {
  stopPhotoSync()
  stops.forEach((s) => s())
  stops = []
  running = undefined
  pending = 0
  error = undefined
  deleted.clear()
  refreshDeleted()
  refresh()
}

// ---------------------------------------------------------------- turning it on and off

/** Whether the cloud already holds records for this owner (from another device). */
export async function cloudHasData(uid: string): Promise<boolean> {
  const { db, fs } = await cloud()
  const user = fs.doc(db, 'users', uid)
  const lists = await Promise.all(SYNCED_LISTS.map((l) => fs.getDocsFromServer(fs.query(fs.collection(user, l), fs.limit(1)))))
  return lists.some((s) => !s.empty)
}

/**
 * Starts syncing this device. 'merge' keeps this device's records and adds the cloud's
 * (for the same record the cloud's copy wins); 'replace' swaps this device's records for the
 * cloud's. Settings always come from the cloud when it has them.
 */
export async function enableSync(uid: string, mode: 'merge' | 'replace') {
  if (mode === 'replace') putInStore({ customers: [], documents: [], catalog: [], transactions: [] })
  storeUid(uid)
  await startSync(uid)
}

/** Stops syncing this device. Its records stay here; the cloud copy stays too. */
export function disableSync() {
  storeUid(null)
  stopSync()
}

/** Puts a deleted record back, here and on every device. */
export function restoreDeleted(d: DeletedRecord) {
  const list = useStore.getState()[d.list] as SyncRecord[]
  useStore.setState({ [d.list]: [d.record, ...list.filter((r) => r.id !== d.id)] } as never)
}

/** Starts sync when the owner who turned it on is signed in, and stops it when they sign out. */
export function useAutoSync() {
  const user = useCloudUser()
  useEffect(() => {
    if (user === undefined) return
    if (user && storedUid() === user.uid) startSync(user.uid)
    else stopSync()
  }, [user])
}
