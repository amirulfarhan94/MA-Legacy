import type { Document } from './types'

/** Anything kept in a synced list: customers, documents, catalog items, transactions. */
export interface SyncRecord {
  id: string
}

/**
 * What changed in a list between two states of the store. The store replaces a record's
 * object whenever it changes, so a new object means a change; a missing id means a delete.
 */
export function diffRecords<T extends SyncRecord>(prev: T[], next: T[]): { upserts: T[]; deletes: T[] } {
  const before = new Map(prev.map((r) => [r.id, r]))
  const upserts = next.filter((r) => before.get(r.id) !== r)
  const after = new Set(next.map((r) => r.id))
  const deletes = prev.filter((r) => !after.has(r.id))
  return { upserts, deletes }
}

/** A change from the cloud: the record as it is now, or null when it was deleted. */
export interface RemoteChange<T> {
  id: string
  record: T | null
}

/**
 * The list with changes from the cloud applied, or null when nothing differs (so the store is
 * left alone and nothing is sent back). New records go first, like records made on this device.
 */
export function applyRemote<T extends SyncRecord>(local: T[], changes: RemoteChange<T>[]): T[] | null {
  if (!changes.length) return null
  const byId = new Map(local.map((r) => [r.id, r]))
  let changed = false
  const added = new Set<string>()
  for (const { id, record } of changes) {
    const mine = byId.get(id)
    if (!record) {
      if (mine) {
        byId.delete(id)
        added.delete(id)
        changed = true
      }
      continue
    }
    if (mine && JSON.stringify(mine) === JSON.stringify(record)) continue
    if (!mine && !local.some((r) => r.id === id)) added.add(id)
    byId.set(id, record)
    changed = true
  }
  if (!changed) return null
  const kept = local.filter((r) => byId.has(r.id)).map((r) => byId.get(r.id)!)
  return [...[...added].map((id) => byId.get(id)!), ...kept]
}

/** Records on this device that the cloud has never seen, to send up once the cloud is reachable. */
export function localOnly<T extends SyncRecord>(local: T[], cloudIds: Set<string>): T[] {
  return local.filter((r) => !cloudIds.has(r.id))
}

/**
 * Documents sharing a type and number. Two devices that are both offline can each give a new
 * invoice the same next number; once they sync, the owner is told so one can be renumbered.
 */
export function duplicateNumbers(docs: Document[]): Document[][] {
  const groups = new Map<string, Document[]>()
  for (const d of docs) {
    if (!d.number) continue
    const key = `${d.type}\u0000${d.number}`
    groups.set(key, [...(groups.get(key) ?? []), d])
  }
  return [...groups.values()].filter((g) => g.length > 1)
}
