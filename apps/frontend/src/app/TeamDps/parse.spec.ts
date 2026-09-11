import {
  allCharacterKeys,
  charKeyToLocGenderedCharKey,
} from '@genshin-optimizer/gi/consts'
import charNames from '../../../../../libs/gi/dm-localization/assets/locales/en/charNames_gen.json'
import type { CharNameMap } from './parse'
import { parseOcrLines } from './parse'
import type { OcrLine } from './types'

const nameMap: CharNameMap = Object.fromEntries(
  allCharacterKeys.map((ck) => [
    ck,
    (charNames as Record<string, string>)[
      charKeyToLocGenderedCharKey(ck, 'F')
    ] ?? ck,
  ])
)

let autoY = 0
function line(text: string, over: Partial<OcrLine> = {}): OcrLine {
  autoY += 30
  return { text, x: 40, y: autoY, w: 500, h: 22, ...over }
}

/** Real OCR line with explicit box from a cargo-test dump. */
function at(x: number, y: number, w: number, h: number, text: string): OcrLine {
  return { text, x, y, w, h }
}

beforeEach(() => {
  autoY = 0
})

describe('parseOcrLines', () => {
  test('parses a synthetic single-line HUD', () => {
    const res = parseOcrLines(
      [
        line('Complete stage & exit'),
        line('DPS : 589 311'),
        line('Damage : 31061996'),
        line('Chasca : 23498282(76%)'),
        line('Nicole : 197781(1%)'),
        line('Durin : 6787701(22%)'),
        line('Citlali : 578232(2%)'),
        line('Time Elapsed : 52.71 s'),
        line('Strongest Hit : 856556'),
        line('Stage GUID: 24801105423 UID: 757970926', { x: 1800, w: 700 }),
      ],
      nameMap
    )
    expect(res.dps).toEqual(589311)
    expect(res.totalDamage).toEqual(31061996)
    expect(res.timeElapsedSec).toBeCloseTo(52.71)
    expect(res.strongestHit).toEqual(856556)
    expect(res.uid).toEqual('757970926')
    expect(res.contributions).toEqual([
      { character: 'Chasca', rawName: 'Chasca', damage: 23498282, pct: 76 },
      { character: 'Nicole', rawName: 'Nicole', damage: 197781, pct: 1 },
      { character: 'Durin', rawName: 'Durin', damage: 6787701, pct: 22 },
      { character: 'Citlali', rawName: 'Citlali', damage: 578232, pct: 2 },
    ])
    expect(res.team).toEqual(['Chasca', 'Nicole', 'Durin', 'Citlali'])
    expect(res.warnings).toEqual([])
  })

  test('parses real OCR output with split label/value lines (dump 1)', () => {
    // subset of an actual cargo dump of a 2538x1431 screenshot
    const res = parseOcrLines(
      [
        at(36, 252, 84, 26, 'DPS :'),
        at(191, 241, 215, 50, '589 311'),
        at(55, 39, 314, 30, 'Complete stage & exit'),
        at(5, 328, 180, 34, '+ Damage :'),
        at(279, 324, 491, 32, '31061996 4. Rotation Results :'),
        at(529, 378, 119, 18, 'DPS: 559K'),
        at(502, 405, 353, 23, '• Dmg: 10324258 Time: 18.48s'),
        at(70, 396, 101, 20, 'Chasca :'),
        at(71, 426, 98, 20, 'Nicole :'),
        at(71, 456, 86, 20, 'Durin :'),
        at(89, 493, 73, 20, 'itlal .'),
        at(5, 565, 250, 34, '+ Time Elapsed'),
        at(331, 571, 70, 31, '52.7*'),
        at(5, 600, 274, 32, "+ Stron eSVFli€'"),
        at(312, 608, 93, 24, '56556'),
        at(24, 719, 98, 20, 'Attack :'),
        at(325, 719, 67, 21, '4073'),
        at(24, 869, 143, 20, 'CRIT Rate :'),
        at(344, 869, 49, 21, '19%'),
        at(427, 864, 127, 14, 'Durin : Melt x3'),
        at(2238, 340, 100, 23, 'C asca'),
        at(2251, 704, 86, 24, 'Citlali'),
        at(1848, 1402, 63, 29, 'Stag'),
        at(1912, 1402, 557, 23, 'e GUID: 24801105423 UID: 757970926'),
      ],
      nameMap
    )
    expect(res.dps).toEqual(589311)
    expect(res.totalDamage).toEqual(31061996)
    expect(res.timeElapsedSec).toBeCloseTo(52.7)
    // garbled "Strongest Hit" label: better missing than a wrong value
    expect(res.strongestHit).toBeUndefined()
    expect(res.uid).toEqual('757970926')
    // contribution values were not OCR'd in this shot, but the team still resolves
    expect(res.contributions).toEqual([])
    expect(res.team).toEqual(['Chasca', 'Nicole', 'Durin', 'Citlali'])
  })

  test('parses the multi-pass dump with bullet separators (dump 1 v2)', () => {
    // actual cargo dump after the high-resolution crop passes were added
    const res = parseOcrLines(
      [
        at(35, 252, 84, 26, 'DPS :'),
        at(191, 241, 215, 50, '589 311'),
        at(5, 328, 180, 34, '+ Damage :'),
        at(279, 324, 490, 32, '31061996 4. Rotation Results :'),
        at(527, 506, 120, 18, 'DPS: 587K'),
        at(528, 378, 119, 18, 'DPS•. 559K'),
        at(592, 404, 263, 19, '10324258 Time: 18.48s'),
        at(70, 396, 100, 20, 'Chasca :'),
        at(244, 384, 254, 37, '23498282 (76%) 3'),
        at(70, 425, 98, 21, 'Nicole :'),
        at(287, 429, 128, 25, '197781 (1%)'),
        at(70, 455, 86, 21, 'Durin :'),
        at(274, 496, 147, 24, '578232 (2%)'), // orphan: Citlali label missed
        at(4, 600, 400, 33, "+ Stron e'€Hit+856556"),
        at(2238, 339, 100, 24, 'Chasca'),
        at(2251, 704, 86, 24, 'Citlali'),
        at(1848, 1402, 620, 29, 'stage GUID•. 24801105423 UID•. 757970926'),
      ],
      nameMap
    )
    expect(res.dps).toEqual(589311)
    expect(res.totalDamage).toEqual(31061996)
    expect(res.strongestHit).toEqual(856556)
    expect(res.uid).toEqual('757970926')
    expect(res.contributions).toEqual([
      { character: 'Chasca', rawName: 'Chasca', damage: 23498282, pct: 76 },
      { character: 'Nicole', rawName: 'Nicole', damage: 197781, pct: 1 },
    ])
    expect(res.team).toEqual(['Chasca', 'Nicole', 'Durin', 'Citlali'])
  })

  test('parses real OCR output with per-character damage (dump 2)', () => {
    // subset of an actual cargo dump of a 2546x1427 screenshot
    const res = parseOcrLines(
      [
        at(41, 240, 375, 49, 'DPS: 208 077'),
        at(279, 329, 159, 26, '13492769'), // damage value, label missed by OCR
        at(76, 395, 100, 20, 'Chäsca :'),
        at(261, 395, 199, 24, '9883860 (73%)-'),
        at(76, 425, 70, 20, 'Mona'),
        at(278, 418, 148, 35, '264923 (2")'),
        at(76, 455, 85, 20, 'Durin :'),
        at(262, 465, 101, 18, '3242493'),
        at(76, 492, 90, 20, 'Citlali :'),
        at(286, 496, 147, 24, '101493 (1%)-'),
        at(10, 565, 269, 33, '+ Time Elapsed :'),
        at(323, 570, 107, 23, '64.85 s'),
        at(10, 604, 388, 33, '+ Strongest Hit : 367910'),
        at(29, 718, 98, 20, 'Attack :'),
        at(332, 718, 66, 21, '2594'),
        at(432, 720, 347, 17, 'Chasca : Vaporize x4 Melt XIO Frozen x5'),
        at(2265, 461, 78, 22, 'Mona'),
        at(1853, 1401, 142, 26, 'Stage GUI'),
        at(2020, 1394, 453, 30, ': 24801105423 UID: 757970926'),
      ],
      nameMap
    )
    expect(res.dps).toEqual(208077)
    // no "Damage :" label was recognized; a bare number is not trusted
    expect(res.totalDamage).toBeUndefined()
    expect(res.timeElapsedSec).toBeCloseTo(64.85)
    expect(res.strongestHit).toEqual(367910)
    expect(res.uid).toEqual('757970926')
    expect(res.contributions).toEqual([
      { character: 'Chasca', rawName: 'Chasca', damage: 9883860, pct: 73 },
      { character: 'Mona', rawName: 'Mona', damage: 264923, pct: 2 },
      { character: 'Durin', rawName: 'Durin', damage: 3242493 },
      { character: 'Citlali', rawName: 'Citlali', damage: 101493, pct: 1 },
    ])
    expect(res.team).toEqual(['Chasca', 'Mona', 'Durin', 'Citlali'])
    expect(res.warnings).toEqual(['Total damage not found in the screenshot'])
  })

  test('ignores rotation rows and does not mistake 559K for the DPS', () => {
    const res = parseOcrLines(
      [
        line('3. DPS: 559K', { x: 400 }),
        line('Dmg: 10324258 Time: 18.48s', { x: 430 }),
        line('DPS : 212 099'),
      ],
      nameMap
    )
    expect(res.dps).toEqual(212099)
  })

  test('completes the team from standalone name lines', () => {
    const res = parseOcrLines(
      [
        line('DPS : 212 099'),
        line('Damage : 12270784'),
        line('Chasca', { x: 2300, w: 120 }),
        line('Xilonen :', { x: 2300, w: 120 }),
        line('Durin', { x: 2300, w: 120 }),
        line('Citlali', { x: 2300, w: 120 }),
      ],
      nameMap
    )
    expect(res.team).toEqual(['Chasca', 'Xilonen', 'Durin', 'Citlali'])
    expect(res.contributions).toEqual([])
  })

  test('keeps party order when a middle value line is missing', () => {
    const res = parseOcrLines(
      [
        at(40, 100, 100, 20, 'Chasca :'),
        at(240, 100, 150, 20, '9000000 (75%)'),
        at(40, 130, 100, 20, 'Nicole :'), // value line missed by OCR
        at(40, 160, 100, 20, 'Durin :'),
        at(40, 190, 100, 20, 'Citlali :'),
        at(240, 190, 150, 20, '1000000 (8%)'),
      ],
      nameMap
    )
    // contributions exist only for slots 1 and 4, but the team keeps
    // the on-screen top-to-bottom (party) order
    expect(res.team).toEqual(['Chasca', 'Nicole', 'Durin', 'Citlali'])
    expect(res.contributions.map((c) => c.character)).toEqual([
      'Chasca',
      'Citlali',
    ])
  })

  test('refuses genuinely ambiguous rail names', () => {
    // OCR reads "Iansan" as "lansan": 1 edit from both Iansan and Lan Yan
    const res = parseOcrLines([line('lansan', { x: 2300, w: 120 })], nameMap)
    expect(res.team).toEqual([undefined, undefined, undefined, undefined])
    // cropped "urin" is a substring of both Durin and Furina
    const res2 = parseOcrLines([line('urin', { x: 2300, w: 120 })], nameMap)
    expect(res2.team).toEqual([undefined, undefined, undefined, undefined])
  })

  test('fuzzy-matches OCR typos in contribution rows', () => {
    const res = parseOcrLines(
      [
        line('Nlcole : 197781(1%)'),
        line('Xiangl1ng : 200000(20%)'),
        line('KamisatoAyaka : 300000(30%)'),
      ],
      nameMap
    )
    expect(res.contributions[0].character).toEqual('Nicole')
    expect(res.contributions[1].character).toEqual('Xiangling')
    expect(res.contributions[2].character).toEqual('KamisatoAyaka')
  })

  test('flags Traveler names as ambiguous', () => {
    const res = parseOcrLines([line('Lumine : 100000(10%)')], nameMap)
    expect(res.contributions[0].character).toBeUndefined()
    expect(
      res.warnings.some((w) => w.includes('matches multiple characters'))
    ).toBe(true)
  })

  test('does not parse stat panels or reaction trackers as contributions', () => {
    const res = parseOcrLines(
      [
        line('Attack : 4073'),
        line('Base ATK : 1083'),
        line('Energy Recharge : 120%'),
        line('CRIT Rate : 19%'),
        line('CRIT Damage : 104%'),
        line('Chasca : Melt x10 Swirl x15'),
        line('PyroDmg : 40%'),
        line('Level : 100'),
      ],
      nameMap
    )
    expect(res.contributions).toEqual([])
    expect(res.totalDamage).toBeUndefined()
  })

  test('warns when contributions disagree with the total', () => {
    const res = parseOcrLines(
      [
        line('Damage : 31061996'),
        line('Chasca : 3498282(76%)'),
        line('Nicole : 197781(1%)'),
        line('Durin : 6787701(22%)'),
        line('Citlali : 578232(2%)'),
      ],
      nameMap
    )
    expect(res.warnings.some((w) => w.includes('does not add up'))).toBe(true)
  })

  test('handles empty input', () => {
    const res = parseOcrLines([], nameMap)
    expect(res.dps).toBeUndefined()
    expect(res.team).toEqual([undefined, undefined, undefined, undefined])
    expect(res.warnings.length).toBeGreaterThan(0)
  })
})
