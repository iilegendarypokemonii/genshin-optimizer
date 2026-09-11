import { readFileSync } from 'node:fs'
import {
  allCharacterKeys,
  charKeyToLocGenderedCharKey,
} from '@genshin-optimizer/gi/consts'
import charNames from '../../../../../libs/gi/dm-localization/assets/locales/en/charNames_gen.json'
import type { CharNameMap } from './parse'
import { buildRows, parseOcrLines } from './parse'
import type { OcrLine } from './types'

/**
 * Manual harness: run the parser over full OCR dumps produced by the Rust
 * dump test (cargo test dump_ocr_from_env -- --ignored --nocapture).
 *
 *   PARSE_DUMP=path/to/dump.txt npx vitest run parse.dump.spec.ts
 *
 * Skipped entirely when PARSE_DUMP is not set.
 */
const dumpPath = process.env['PARSE_DUMP']
const d = dumpPath ? describe : describe.skip

const nameMap: CharNameMap = Object.fromEntries(
  allCharacterKeys.map((ck) => [
    ck,
    (charNames as Record<string, string>)[
      charKeyToLocGenderedCharKey(ck, 'F')
    ] ?? ck,
  ])
)

d('parse full OCR dumps', () => {
  test('prints parse results per image', () => {
    const text = readFileSync(dumpPath as string, 'utf8')
    const sections: { file: string; lines: OcrLine[] }[] = []
    for (const raw of text.split('\n')) {
      const header = raw.match(/^=== (.*) \(\d+x\d+\)/)
      if (header) {
        sections.push({ file: header[1], lines: [] })
        continue
      }
      const m = raw.match(/^\[(\d+),(\d+),(\d+),(\d+)\] (.*)$/)
      if (m && sections.length) {
        sections[sections.length - 1].lines.push({
          x: Number(m[1]),
          y: Number(m[2]),
          w: Number(m[3]),
          h: Number(m[4]),
          text: m[5],
        })
      }
    }
    expect(sections.length).toBeGreaterThan(0)
    for (const section of sections) {
      if (process.env['PARSE_DUMP_ROWS']) {
        const maxX = Math.max(...section.lines.map((l) => l.x + l.w))
        const rows = buildRows(section.lines, Math.max(250, maxX * 0.12))
        // eslint-disable-next-line no-console
        console.log(`--- rows of ${section.file.split('-').pop()}`)
        for (const row of rows)
          if (row.y < 650 && row.x < 900)
            // eslint-disable-next-line no-console
            console.log(
              `  [${Math.round(row.x)},${Math.round(row.y)}] ${row.text}`
            )
      }
      const res = parseOcrLines(section.lines, nameMap)
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify(
          {
            file: section.file.split('-').pop(),
            dps: res.dps,
            totalDamage: res.totalDamage,
            time: res.timeElapsedSec,
            hit: res.strongestHit,
            uid: res.uid,
            team: res.team,
            contributions: res.contributions.map(
              (c) => `${c.character ?? `?${c.rawName}?`}=${c.damage}`
            ),
            warnings: res.warnings,
          },
          null,
          1
        )
      )
    }
  })
})
