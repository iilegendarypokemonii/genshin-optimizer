import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import Backend from 'i18next-http-backend'
import { initReactI18next } from 'react-i18next'

// Probably a way to auto-populate this.
export const languageCodeList = [
  'chs',
  'cht',
  'de',
  'en',
  'es',
  'fr',
  'id',
  'it',
  'ja',
  'ko',
  'pt',
  'ru',
  'th',
  'tr',
  'vi',
]

function getLocaleLoadPath(lng: string, ns: string) {
  if (typeof window === 'undefined')
    return `./assets/locales/${lng}/${ns}.json`
  return new URL(
    `./assets/locales/${lng}/${ns}.json`,
    window.location.href.split('#')[0]
  ).toString()
}

const commonNamespaces = new Set(['build', 'common', 'loadout'])

function getDevLocaleLoadPath(lng: string, ns: string) {
  const relativeBase = commonNamespaces.has(ns)
    ? '../../../common/localization/assets/locales/'
    : ns === 'sillyWisher_charNames'
      ? '../../silly-wisher-names/assets/locales/'
      : ns.endsWith('_gen')
        ? '../../dm-localization/assets/locales/'
        : '../../localization/assets/locales/'
  return new URL(`${relativeBase}${lng}/${ns}.json`, import.meta.url).toString()
}

function resolveLocaleLoadPath(lngs: string | string[], namespaces: string | string[]) {
  const lng = Array.isArray(lngs) ? lngs[0] : lngs
  const ns = Array.isArray(namespaces) ? namespaces[0] : namespaces
  if (import.meta.env.DEV) return getDevLocaleLoadPath(lng, ns)
  return getLocaleLoadPath(lng, ns)
}

function normalizeLanguageCode(lang?: string | null) {
  if (!lang) return undefined
  const languageOnly = lang.toLowerCase().split('-')[0]
  if (languageOnly === 'cimode') return 'en'
  return languageCodeList.includes(languageOnly) ? languageOnly : undefined
}

function getInitialLanguage() {
  if (typeof window === 'undefined') return undefined
  const storedLanguage = normalizeLanguageCode(window.localStorage.getItem('i18nextLng'))
  if (storedLanguage) {
    window.localStorage.setItem('i18nextLng', storedLanguage)
    return storedLanguage
  }

  const navigatorLanguages = [window.navigator.language, ...(window.navigator.languages ?? [])]
  for (const language of navigatorLanguages) {
    const normalized = normalizeLanguageCode(language)
    if (normalized) return normalized
  }

  return 'en'
}

const initialLanguage = getInitialLanguage()

/**
 * @see: https://www.i18next.com/translation-function/essentials
 * @see: https://react.i18next.com/latest/using-with-hooks
 */
i18n
  // load translation using http ->
  // see /public/locales (i.e. https://github.com/i18next/react-i18next/tree/master/example/react/public/locales)
  // learn more: https://github.com/i18next/i18next-http-backend
  .use(Backend)
  // pass the i18n instance to react-i18next.
  .use(initReactI18next)
  // detect user language
  // learn more: https://github.com/i18next/i18next-browser-languageDetector
  .use(LanguageDetector)
  // Configure localization.
  .init({
    // debug: process.env.NODE_ENV === "development",
    // Use English strings by default, if the current language does not include
    // the specified string.
    lng: initialLanguage,
    fallbackLng: 'en',
    // fallbackLng: 'dev', // Switch to this to force the fallback value on missing strings.

    // List all translation namespaces.
    ns: ['languages', 'ui'],
    // Specify the default namespace.
    defaultNS: 'ui',

    // Only use the language code, skipping the region code.
    // For example, en-US becomes simply en.
    load: 'languageOnly',
    supportedLngs: languageCodeList,

    returnNull: false,

    backend: {
      // Path to load localization data from.
      loadPath: resolveLocaleLoadPath,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false, //react does interlopation already
      skipOnVariables: false, // Enables passing nested interpolation
    },
  })
i18n.on('languageChanged', (lng) => {
  const normalized = normalizeLanguageCode(lng)
  if (!normalized) {
    void i18n.changeLanguage('en')
    return
  }
  if (typeof window !== 'undefined')
    window.localStorage.setItem('i18nextLng', normalized)
})
if (!normalizeLanguageCode(i18n.resolvedLanguage)) {
  void i18n.changeLanguage('en')
}
i18n.services.formatter?.add('percent', (value, _lng, options) => {
  return (value * 100).toFixed(options.fixed)
})
i18n.services.formatter?.add('fixed', (value, _lng, options) => {
  return value.toFixed(options.fixed)
})
console.log('i18n initialized')

export { i18n }
