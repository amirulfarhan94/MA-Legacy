import { describe, expect, it } from 'vitest'
import { applyRemote, diffRecords, duplicateNumbers, localOnly } from './syncMerge'
import type { Document } from './types'

type R = { id: string; name: string }
const a: R = { id: 'a', name: 'Ali' }
const b: R = { id: 'b', name: 'Bala' }
const c: R = { id: 'c', name: 'Chong' }

describe('diffRecords', () => {
  it('finds new, changed and deleted records', () => {
    const b2 = { ...b, name: 'Bala Sdn Bhd' }
    const { upserts, deletes } = diffRecords([a, b, c], [a, b2])
    expect(upserts).toEqual([b2])
    expect(deletes).toEqual([c])
  })

  it('sends nothing when the list is the same', () => {
    const list = [a, b]
    expect(diffRecords(list, [...list])).toEqual({ upserts: [], deletes: [] })
  })

  it('treats a record only on the new side as new', () => {
    expect(diffRecords([a], [c, a]).upserts).toEqual([c])
  })
})

describe('applyRemote', () => {
  it('adds new records first, replaces changed ones in place and removes deleted ones', () => {
    const b2 = { ...b, name: 'Bala Sdn Bhd' }
    const out = applyRemote([a, b, c], [
      { id: 'd', record: { id: 'd', name: 'Devi' } },
      { id: 'b', record: b2 },
      { id: 'c', record: null },
    ])
    expect(out).toEqual([{ id: 'd', name: 'Devi' }, a, b2])
  })

  it('returns null when the cloud has nothing new, so nothing is sent back', () => {
    expect(applyRemote([a, b], [{ id: 'a', record: { ...a } }])).toBeNull()
    expect(applyRemote([a], [{ id: 'z', record: null }])).toBeNull()
    expect(applyRemote([a], [])).toBeNull()
  })

  it('keeps the latest of several changes to one new record', () => {
    const out = applyRemote([a], [
      { id: 'd', record: { id: 'd', name: 'one' } },
      { id: 'd', record: { id: 'd', name: 'two' } },
    ])
    expect(out).toEqual([{ id: 'd', name: 'two' }, a])
  })

  it('drops a new record that is deleted in the same batch', () => {
    expect(applyRemote([a], [{ id: 'd', record: { id: 'd', name: 'x' } }, { id: 'd', record: null }])).toEqual([a])
  })
})

describe('localOnly', () => {
  it('lists records the cloud has never seen', () => {
    expect(localOnly([a, b, c], new Set(['b']))).toEqual([a, c])
  })
})

describe('duplicateNumbers', () => {
  const doc = (id: string, type: Document['type'], number: string) => ({ id, type, number }) as Document
  it('groups documents of one type that share a number', () => {
    const docs = [doc('1', 'invoice', 'INV-1'), doc('2', 'invoice', 'INV-1'), doc('3', 'quotation', 'INV-1'), doc('4', 'invoice', 'INV-2')]
    expect(duplicateNumbers(docs).map((g) => g.map((d) => d.id))).toEqual([['1', '2']])
  })
})
