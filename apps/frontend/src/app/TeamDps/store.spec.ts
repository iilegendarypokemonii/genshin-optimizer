import { screenshotRelPath } from './store'

describe('screenshotRelPath', () => {
  test('accepts UUIDs', () => {
    expect(screenshotRelPath('01234567-89ab-cdef-0123-456789abcdef')).toEqual(
      'teamdps/screenshots/01234567-89ab-cdef-0123-456789abcdef.png'
    )
  })
  test('rejects anything path-like', () => {
    expect(() => screenshotRelPath('../../evil')).toThrow()
    expect(() => screenshotRelPath('a/b')).toThrow()
    expect(() => screenshotRelPath('')).toThrow()
    expect(() => screenshotRelPath('teamdps')).toThrow()
  })
})
