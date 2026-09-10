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

beforeEach(() => {
  autoY = 0
})

/** Mirrors the real sample screenshot HUD. */
function fullHudLines(): OcrLine[] {
  return [
    line('Complete stage & exit'),
    line('DPS : 589 311'),
    line('Damage : 31061996'),
    line('Rotation Results :', { x: 380 }),
    line('3. DPS: 559K', { x: 400 }),
    line('Dmg: 10324258 Time: 18.48s', { x: 430 }),
    line('2. DPS: 661K', { x: 400 }),
    line('Dmg: 11207298 Time: 16.95s', { x: 430 }),
    line('Chasca : 23498282(76%)'),
    line('Nicole : 197781(1%)'),
    line('Durin : 6787701(22%)'),
    line('Citlali : 578232(2%)'),
    line('Time Elapsed : 52.71 s'),
    line('Strongest Hit : 856556'),
    line('Nicole Attributes'),
    line('Attack : 4073'),
    line('Energy Recharge : 120%'),
    line('Chasca : Melt x10 Swirl x15', { x: 340 }),
    line('Chasca', { x: 2300, w: 120 }),
    line('Nicole', { x: 2300, w: 120 }),
    line('Durin', { x: 2300, w: 120 }),
    line('Citlali', { x: 2300, w: 120 }),
    line('Stage GUID: 24801105423 UID: 757970926', { x: 1800, w: 700 }),
  ]
}

describe('parseOcrLines', () => {
  test('parses the full HUD sample', () => {
    const res = parseOcrLines(fullHudLines(), nameMap)
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
    // dps*time = 31062583 vs 31061996: within tolerance, contributions add up
    expect(res.warnings).toEqual([])
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

  test('completes the team from the right rail when contributions are missing', () => {
    const res = parseOcrLines(
      [
        line('DPS : 212 099'),
        line('Damage : 12270784'),
        line('Chasca', { x: 2300, w: 120 }),
        line('Iansan', { x: 2300, w: 120 }),
        line('Durin', { x: 2300, w: 120 }),
        line('Citlali', { x: 2300, w: 120 }),
      ],
      nameMap
    )
    expect(res.team).toEqual(['Chasca', 'Iansan', 'Durin', 'Citlali'])
    expect(res.contributions).toEqual([])
  })

  test('fuzzy-matches OCR typos', () => {
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
        line('Energy Recharge : 120%'),
        line('CRIT Rate : 19%'),
        line('Chasca : Melt x10 Swirl x15'),
        line('PyroDmg : 40%'),
      ],
      nameMap
    )
    expect(res.contributions).toEqual([])
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
