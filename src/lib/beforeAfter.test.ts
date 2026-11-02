import { describe, expect, it } from 'vitest'
import { pairCaption, pairPhotos, stageLabel } from './beforeAfter'
import type { DocPhoto } from './types'

const ph = (id: string, stage?: DocPhoto['stage'], caption = ''): DocPhoto => ({ id, caption, stage })

describe('pairPhotos', () => {
  it('pairs the nth before with the nth after, in order', () => {
    const photos = [ph('b1', 'before'), ph('b2', 'before'), ph('d1', 'during'), ph('a1', 'after'), ph('x'), ph('a2', 'after')]
    const { pairs, rest } = pairPhotos(photos)
    expect(pairs.map((p) => [p.before.id, p.after.id])).toEqual([
      ['b1', 'a1'],
      ['b2', 'a2'],
    ])
    expect(rest.map((p) => p.id)).toEqual(['d1', 'x'])
  })

  it('leaves a before without an after in the rest', () => {
    const { pairs, rest } = pairPhotos([ph('b1', 'before'), ph('a1', 'after'), ph('b2', 'before')])
    expect(pairs).toHaveLength(1)
    expect(rest.map((p) => p.id)).toEqual(['b2'])
  })

  it('has no pairs when nothing is tagged', () => {
    const photos = [ph('1'), ph('2')]
    expect(pairPhotos(photos)).toEqual({ pairs: [], rest: photos })
  })
})

describe('stageLabel', () => {
  it('numbers befores and afters separately', () => {
    const photos = [ph('b1', 'before'), ph('a1', 'after'), ph('b2', 'before'), ph('d', 'during'), ph('x')]
    expect(photos.map((p) => stageLabel(photos, p))).toEqual(['Before 1', 'After 1', 'Before 2', 'During', ''])
  })
})

describe('pairCaption', () => {
  it("uses the after photo's caption first", () => {
    expect(pairCaption({ before: ph('b', 'before', 'Old DB box'), after: ph('a', 'after', 'New DB box with RCCB') })).toBe('New DB box with RCCB')
    expect(pairCaption({ before: ph('b', 'before', 'Old DB box'), after: ph('a', 'after', ' ') })).toBe('Old DB box')
  })
})
