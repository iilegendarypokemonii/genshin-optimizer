import {
  UidMismatchError,
  mergeWishes,
  parseImport,
  validateWishFile,
} from './storage'
import type { Wish } from './types'

function wish(id: string, over: Partial<Wish> = {}): Wish {
  return {
    uid: '100000001',
    gacha_type: '301',
    item_id: '',
    count: '1',
    time: '2025-01-01 00:00:00',
    name: 'Filler',
    lang: 'en-us',
    item_type: 'Character',
    rank_type: '3',
    id,
    ...over,
  }
}

describe('mergeWishes', () => {
  it('adds only unknown ids and never shrinks', () => {
    const existing = [wish('1'), wish('2')]
    const { wishes, added } = mergeWishes(
      existing,
      [wish('2'), wish('3')],
      '100000001'
    )
    expect(added).toBe(1)
    expect(wishes.map((w) => w.id)).toEqual(['1', '2', '3'])
  })

  it('is idempotent', () => {
    const existing = [wish('1')]
    const once = mergeWishes(existing, [wish('1'), wish('2')], '100000001')
    const twice = mergeWishes(once.wishes, [wish('1'), wish('2')], '100000001')
    expect(twice.added).toBe(0)
    expect(twice.wishes).toEqual(once.wishes)
  })

  it('keeps the existing record on id collision (preserves local fields)', () => {
    const existing = [
      wish('1', {
        source: 'paimonmoe',
        name: 'Original',
        capturingRadiance: {
          source: 'player-confirmed',
          confirmedAt: '2026-07-26T00:00:00.000Z',
        },
      }),
    ]
    const { wishes } = mergeWishes(
      existing,
      [wish('1', { name: 'Refetched' })],
      '100000001'
    )
    expect(wishes[0].name).toBe('Original')
    expect(wishes[0].source).toBe('paimonmoe')
    expect(wishes[0].capturingRadiance?.source).toBe('player-confirmed')
  })

  it('restores a missing Radiance annotation from an imported backup', () => {
    const existing = [wish('1', { name: 'Stored name' })]
    const incoming = [
      wish('1', {
        name: 'Backup name',
        capturingRadiance: {
          source: 'player-confirmed',
          confirmedAt: '2026-07-26T00:00:00.000Z',
        },
      }),
    ]

    const { wishes, added } = mergeWishes(existing, incoming, '100000001')
    expect(added).toBe(0)
    expect(wishes[0].name).toBe('Stored name')
    expect(wishes[0].capturingRadiance).toEqual(incoming[0].capturingRadiance)
  })

  it('rejects any record from a different uid without partial effects', () => {
    const incoming = [wish('3'), wish('4', { uid: '999999999' })]
    expect(() => mergeWishes([wish('1')], incoming, '100000001')).toThrow(
      UidMismatchError
    )
  })

  it('handles empty inputs', () => {
    expect(mergeWishes([], [], '100000001')).toEqual({ wishes: [], added: 0 })
    expect(mergeWishes([], [wish('1')], '100000001').added).toBe(1)
  })
})

describe('validateWishFile', () => {
  const valid = {
    uid: '100000001',
    exported: '2025-01-01 00:00',
    wishes: [wish('1')],
  }

  it('accepts the standalone-pipeline file shape', () => {
    expect(validateWishFile(valid).uid).toBe('100000001')
  })

  it('rejects non-objects, missing uid, missing wishes', () => {
    expect(() => validateWishFile(null)).toThrow('JSON object')
    expect(() => validateWishFile([])).toThrow('JSON object')
    expect(() => validateWishFile({ wishes: [] })).toThrow('uid')
    expect(() => validateWishFile({ uid: '100000001' })).toThrow('wishes')
  })

  it('rejects malformed records and mixed uids', () => {
    expect(() => validateWishFile({ ...valid, wishes: [{ id: '1' }] })).toThrow(
      'Malformed wish record'
    )
    expect(() =>
      validateWishFile({ ...valid, wishes: [wish('1', { uid: '999999999' })] })
    ).toThrow('Mixed UIDs')
  })
})

describe('parseImport', () => {
  const single = {
    uid: '100000001',
    exported: '2025-01-01 00:00',
    wishes: [wish('1')],
  }
  const other = {
    uid: '999999999',
    exported: '2025-01-01 00:00',
    wishes: [wish('2', { uid: '999999999' })],
  }

  it('wraps a single wish file', () => {
    expect(parseImport(single).map((f) => f.uid)).toEqual(['100000001'])
  })

  it('accepts a go-wish-backup bundle with multiple profiles', () => {
    const bundle = {
      format: 'go-wish-backup',
      exported: '2025-01-01 00:00',
      profiles: [single, other],
    }
    expect(parseImport(bundle).map((f) => f.uid)).toEqual([
      '100000001',
      '999999999',
    ])
  })

  it('rejects empty bundles and invalid profiles inside a bundle', () => {
    expect(() => parseImport({ profiles: [] })).toThrow('no profiles')
    expect(() => parseImport({ profiles: [{ uid: 'x' }] })).toThrow('uid')
  })
})
