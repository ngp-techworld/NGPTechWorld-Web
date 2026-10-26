import { describe, expect, it } from 'vitest'
import { ui } from './ui'
import { LANGUAGES, DEFAULT_LANG, contentLangOf, isLang, ownsContent } from './languages'

/**
 * A missing key does not throw. It renders as nothing — a heading that is simply absent from the
 * page, in a language nobody on the team reads. With ten dictionaries kept in step by hand that
 * is the failure waiting to happen, so it is the one this file exists to catch.
 */

const CODES = LANGUAGES.map((l) => l.code)
const reference = ui[DEFAULT_LANG]

describe('the dictionaries agree with each other', () => {
  it('ships one for every declared language, and nothing more', () => {
    expect(Object.keys(ui).sort()).toEqual([...CODES].sort())
  })

  it.each(CODES)('%s has exactly the reference keys', (code) => {
    expect(Object.keys(ui[code]).sort()).toEqual(Object.keys(reference).sort())
  })

  it.each(CODES)('%s matches the reference shape — type, and length for lists', (code) => {
    for (const [key, expected] of Object.entries(reference)) {
      const actual = ui[code][key]
      expect(typeof actual, `${code}.${key} is the wrong type`).toBe(typeof expected)
      if (Array.isArray(expected)) {
        expect(actual, `${code}.${key} is not an array`).toBeInstanceOf(Array)
        expect(actual.length, `${code}.${key} has ${actual.length} items, expected ${expected.length}`)
          .toBe(expected.length)
      }
    }
  })

  it.each(CODES)('%s leaves no string blank', (code) => {
    const blank = Object.entries(ui[code])
      .filter(([, v]) => typeof v === 'string' && v.trim() === '')
      .map(([k]) => k)
    expect(blank).toEqual([])
  })

  it.each(CODES)('%s interpolates its function entries', (code) => {
    expect(ui[code].mYears(7)).toContain('7')
    expect(ui[code].cooldownWait(30)).toContain('30')
    expect(ui[code].mOpenLink('GitHub')).toContain('GitHub')
    expect(ui[code].pfIndex(12, 5)).toContain('12')
    expect(ui[code].pfIndex(12, 5)).toContain('5')
    expect(ui[code].pfResults(30)).toContain('30')
    expect(ui[code].pfCounter(3, 9)).toMatch(/3.*9/)
    expect(ui[code].pfOpenShot(4)).toContain('4')
    expect(ui[code].contactAboutProject('Falcon')).toContain('Falcon')
  })

  // The portfolio reads these by the API's own enum values (Enums.php), so a key missing in one
  // language shows as a raw `in_development` or a blank chip there and nowhere else.
  it.each(CODES)('%s labels every platform, development status and technology category', (code) => {
    for (const map of ['platformLabels', 'devStatus', 'techCategories']) {
      expect(Object.keys(ui[code][map]).sort(), `${code}.${map}`).toEqual(Object.keys(reference[map]).sort())
      for (const [key, label] of Object.entries(ui[code][map])) {
        expect(typeof label === 'string' && label.trim() !== '', `${code}.${map}.${key} is blank`).toBe(true)
      }
    }
  })

  it('counts Arabic projects with the right noun form', () => {
    expect(ui.ar.pfResults(1)).toBe('مشروع واحد')
    expect(ui.ar.pfResults(2)).toBe('مشروعان')
    expect(ui.ar.pfResults(7)).toBe('7 مشاريع')
    expect(ui.ar.pfResults(12)).toBe('12 مشروعاً')
    expect(ui.ar.pfResults(100)).toBe('100 مشروع')
    expect(ui.ar.pfIndex(12, 5)).toBe('12 مشروعاً منشوراً في 5 مجالات')
  })
})

describe('the language registry', () => {
  it('speaks Arabic by default and is the only right-to-left one', () => {
    expect(DEFAULT_LANG).toBe('ar')
    expect(LANGUAGES.filter((l) => l.dir === 'rtl').map((l) => l.code)).toEqual(['ar'])
  })

  it('points every European locale at the English database columns', () => {
    // The database has `_ar` and `_en` and nothing else. Any language mapped to a third value
    // would render every service, project and profile on the site blank.
    for (const { code } of LANGUAGES) {
      expect(['ar', 'en']).toContain(contentLangOf(code))
    }
    expect(contentLangOf('de')).toBe('en')
    expect(contentLangOf('ru')).toBe('en')
    expect(contentLangOf('ar')).toBe('ar')
  })

  it('counts only Arabic and English as owning their content', () => {
    expect(CODES.filter(ownsContent)).toEqual(['ar', 'en'])
  })

  it('falls back to the default for an unknown code', () => {
    expect(isLang('zz')).toBe(false)
    expect(contentLangOf('zz')).toBe('ar')
  })
})
