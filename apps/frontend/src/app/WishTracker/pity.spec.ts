import {
  capturingRadianceWinChance,
  computeBannerStats,
  computeCapturingRadianceScore,
  sortWishes,
} from './pity'
import type { Wish } from './types'

let seq = 0
function wish(over: Partial<Wish>): Wish {
  seq += 1
  return {
    uid: '100000001',
    gacha_type: '301',
    item_id: '',
    count: '1',
    time: `2025-01-01 00:00:${String(seq % 60).padStart(2, '0')}`,
    name: 'Filler',
    lang: 'en-us',
    item_type: 'Character',
    rank_type: '3',
    id: String(1700000000000000000 + seq),
    ...over,
  }
}

function run(wishes: Wish[]) {
  return computeBannerStats(wishes)
}

describe('computeBannerStats', () => {
  beforeEach(() => {
    seq = 0
  })

  it('counts pity per 5-star and resets after each', () => {
    const wishes = [
      ...Array.from({ length: 9 }, () => wish({})),
      wish({ rank_type: '5', name: 'Nahida' }), // pity 10
      ...Array.from({ length: 4 }, () => wish({})),
      wish({ rank_type: '5', name: 'Furina' }), // pity 5
      ...Array.from({ length: 3 }, () => wish({})), // current pity 3
    ]
    const [stats] = run(wishes)
    expect(stats.key).toBe('301')
    expect(stats.fiveStars.map((f) => f.pity)).toEqual([10, 5])
    expect(stats.fiveStars.map((f) => f.wish.name)).toEqual([
      'Nahida',
      'Furina',
    ])
    expect(stats.currentPity5).toBe(3)
    expect(stats.avgPity5).toBeCloseTo(7.5)
    expect(stats.total).toBe(18)
    expect(stats.primosSpent).toBe(18 * 160)
  })

  it('groups 400 under 301 with shared pity', () => {
    const wishes = [
      ...Array.from({ length: 5 }, () => wish({ gacha_type: '301' })),
      ...Array.from({ length: 4 }, () => wish({ gacha_type: '400' })),
      wish({ gacha_type: '400', rank_type: '5', name: 'Raiden' }), // pity 10 across both
    ]
    const stats = run(wishes)
    expect(stats).toHaveLength(1)
    expect(stats[0].key).toBe('301')
    expect(stats[0].fiveStars[0].pity).toBe(10)
  })

  it('tracks 4-star pity from the last 4★ or 5★', () => {
    const wishes = [
      wish({ rank_type: '4', name: 'Bennett' }),
      wish({}),
      wish({}),
    ]
    const [stats] = run(wishes)
    expect(stats.currentPity4).toBe(2)
    expect(stats.fourStarCount).toBe(1)
  })

  it('handles a banner with no 5-star yet', () => {
    const wishes = Array.from({ length: 7 }, () => wish({ gacha_type: '302' }))
    const [stats] = run(wishes)
    expect(stats.key).toBe('302')
    expect(stats.fiveStars).toEqual([])
    expect(stats.avgPity5).toBe(0)
    expect(stats.currentPity5).toBe(7)
  })

  it('omits empty banner groups and orders groups for display', () => {
    const wishes = [
      wish({ gacha_type: '200' }),
      wish({ gacha_type: '301' }),
      wish({ gacha_type: '100' }),
    ]
    expect(run(wishes).map((s) => s.key)).toEqual(['301', '200', '100'])
  })

  it('single wish that is a 5-star', () => {
    const [stats] = run([
      wish({ rank_type: '5', name: 'Qiqi', gacha_type: '200' }),
    ])
    expect(stats.fiveStars[0].pity).toBe(1)
    expect(stats.currentPity5).toBe(0)
  })

  it('tracks the normal featured guarantee separately from Radiance', () => {
    const [afterLoss] = run([
      wish({ rank_type: '5', name: 'Dehya', gacha_type: '301' }),
    ])
    expect(afterLoss.featuredCharacterGuaranteed).toBe(true)
    expect(afterLoss.capturingRadianceScore).toBe(2)

    const [, standard] = run([
      wish({ rank_type: '5', name: 'Dehya', gacha_type: '301' }),
      wish({ rank_type: '5', name: 'Qiqi', gacha_type: '200' }),
    ])
    expect(standard.featuredCharacterGuaranteed).toBeUndefined()

    const [afterGuaranteedWin] = run([
      wish({ rank_type: '5', name: 'Dehya', gacha_type: '301' }),
      wish({ rank_type: '5', name: 'Columbina', gacha_type: '301' }),
    ])
    expect(afterGuaranteedWin.featuredCharacterGuaranteed).toBe(false)
    expect(afterGuaranteedWin.capturingRadianceScore).toBe(2)
  })
})

describe('sortWishes', () => {
  it('sorts by time then id without mutating input', () => {
    const a = wish({ time: '2025-01-02 00:00:00', id: '2' })
    const b = wish({ time: '2025-01-01 00:00:00', id: '9' })
    const c = wish({ time: '2025-01-01 00:00:00', id: '3' })
    const input = [a, b, c]
    const sorted = sortWishes(input)
    expect(sorted.map((w) => w.id)).toEqual(['3', '9', '2'])
    expect(input.map((w) => w.id)).toEqual(['2', '9', '3'])
  })
})

describe('computeCapturingRadianceScore', () => {
  beforeEach(() => {
    seq = 0
  })

  it('starts at 1 and counts a standard-character event pull as a loss', () => {
    expect(computeCapturingRadianceScore([])).toBe(1)
    expect(
      computeCapturingRadianceScore([wish({ rank_type: '5', name: 'Dehya' })])
    ).toBe(2)
  })

  it('does not change the score for the guaranteed featured pull after a loss', () => {
    expect(
      computeCapturingRadianceScore([
        wish({ rank_type: '5', name: 'Dehya' }),
        wish({ rank_type: '5', name: 'Columbina' }),
        wish({ rank_type: '5', name: 'Diluc', gacha_type: '400' }),
        wish({ rank_type: '5', name: 'Columbina', gacha_type: '400' }),
      ])
    ).toBe(3)
  })

  it('reduces the score for non-guaranteed featured wins with a minimum of 0', () => {
    expect(
      computeCapturingRadianceScore([
        wish({ rank_type: '5', name: 'Columbina' }),
        wish({ rank_type: '5', name: 'Furina' }),
        wish({ rank_type: '5', name: 'Nahida' }),
      ])
    ).toBe(0)
  })

  it('caps the score at 3 after repeated tracked losses', () => {
    expect(
      computeCapturingRadianceScore([
        wish({ rank_type: '5', name: 'Dehya' }),
        wish({ rank_type: '5', name: 'Columbina' }),
        wish({ rank_type: '5', name: 'Diluc' }),
        wish({ rank_type: '5', name: 'Columbina' }),
        wish({ rank_type: '5', name: 'Qiqi' }),
        wish({ rank_type: '5', name: 'Columbina' }),
        wish({ rank_type: '5', name: 'Mona' }),
      ])
    ).toBe(3)
  })

  it('resets the score to 1 after player-confirmed Capturing Radiance', () => {
    expect(
      computeCapturingRadianceScore([
        wish({ rank_type: '5', name: 'Dehya' }),
        wish({ rank_type: '5', name: 'Columbina' }),
        wish({ rank_type: '5', name: 'Diluc' }),
        wish({ rank_type: '5', name: 'Columbina' }),
        wish({
          rank_type: '5',
          name: 'Columbina',
          capturingRadiance: {
            source: 'player-confirmed',
            confirmedAt: '2026-07-26T00:00:00.000Z',
          },
        }),
      ])
    ).toBe(1)
  })

  it('ignores wishes before Version 5.0 and outside Character Event', () => {
    expect(
      computeCapturingRadianceScore([
        wish({
          rank_type: '5',
          name: 'Dehya',
          time: '2024-08-27 23:59:59',
        }),
        wish({ rank_type: '5', name: 'Diluc', gacha_type: '200' }),
      ])
    ).toBe(1)
  })
})

describe('capturingRadianceWinChance', () => {
  it.each([
    [0, 50],
    [1, 50],
    [2, 55],
    [3, 100],
  ])('maps score %i to a %i%% modeled win chance', (score, chance) => {
    expect(capturingRadianceWinChance(score)).toBe(chance)
  })
})
