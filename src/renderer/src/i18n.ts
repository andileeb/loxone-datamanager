import { createI18n } from 'vue-i18n'
import en from './locales/en'
import de from './locales/de'

export type AppLocale = 'en' | 'de'

const STORAGE_KEY = 'ldm.locale'

function initialLocale(): AppLocale {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'en' || saved === 'de') return saved
  return navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en'
}

export const i18n = createI18n({
  legacy: false,
  locale: initialLocale(),
  fallbackLocale: 'en',
  messages: { en, de }
})

export function setLocale(locale: AppLocale): void {
  i18n.global.locale.value = locale
  localStorage.setItem(STORAGE_KEY, locale)
}

/** translated error text for known codes, raw (detail-carrying) message otherwise */
export function errorText(e: { code: string; message: string }): string {
  const key = `errors.${e.code}`
  return i18n.global.te(key) ? i18n.global.t(key) : e.message
}
