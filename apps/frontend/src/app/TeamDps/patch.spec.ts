import { patchForDate } from './patch'

const DAY = 24 * 60 * 60 * 1000
const V70 = Date.UTC(2026, 7, 12)

describe('patchForDate', () => {
  test('anchors 7.0 on 2026-08-12 for 42 days', () => {
    expect(patchForDate(V70)).toEqual('7.0')
    expect(patchForDate(V70 + 41 * DAY)).toEqual('7.0')
    expect(patchForDate(V70 + 42 * DAY)).toEqual('7.1')
    expect(patchForDate(V70 + 5 * 42 * DAY)).toEqual('7.5')
  })
  test('is undefined before the anchor', () => {
    expect(patchForDate(V70 - DAY)).toBeUndefined()
  })
})
