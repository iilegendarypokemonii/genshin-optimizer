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
    fallbackLng: 'en',
    // fallbackLng: 'dev', // Switch to this to force the fallback value on missing strings.

    // List all translation namespaces.
    ns: ['languages', 'ui'],
    // Specify the default namespace.
    defaultNS: 'ui',

    // Only use the language code, skipping the region code.
    // For example, en-US becomes simply en.
    load: 'languageOnly',

    returnNull: false,

    backend: {
      // Path to load localization data from.
      loadPath: resolveLocaleLoadPath,
    },
    interpolation: {
      escapeValue: false, //react does interlopation already
    },
  })

// https://www.i18next.com/translation-function/formatting#adding-custom-format-function
i18n.services.formatter?.add('percent', (value, _lng, options) => {
  return (value * 100).toFixed(options.fixed)
})
i18n.services.formatter?.add('fixed', (value, _lng, options) => {
  return value.toFixed(options.fixed)
})

export { i18n }
