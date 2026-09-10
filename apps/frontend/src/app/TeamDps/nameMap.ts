import type { CharacterKey, GenderKey } from '@genshin-optimizer/gi/consts'
import {
  allCharacterKeys,
  charKeyToLocGenderedCharKey,
} from '@genshin-optimizer/gi/consts'
import { i18n } from '@genshin-optimizer/gi/i18n'
import type { CharNameMap } from './parse'

/**
 * English-or-current-locale display name per CharacterKey, for OCR matching.
 * Callers must have loaded the `charNames_gen` namespace
 * (e.g. via useTranslation('charNames_gen')) before calling.
 */
export function getCharNameMap(gender: GenderKey): CharNameMap {
  return Object.fromEntries(
    allCharacterKeys.map((ck: CharacterKey) => [
      ck,
      i18n.t(`charNames_gen:${charKeyToLocGenderedCharKey(ck, gender)}`),
    ])
  ) as CharNameMap
}
