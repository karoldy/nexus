import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import { APP_LANGUAGES, type AppLanguage } from '@/types';
import en from './locales/en.json';
import sc from './locales/sc.json';
import tc from './locales/tc.json';

export const appLanguages = APP_LANGUAGES;

const htmlLang: Record<AppLanguage, string> = {
  sc: 'zh-CN',
  tc: 'zh-TW',
  en: 'en',
};

function normalizeLanguage(code: string): AppLanguage {
  const lower = code.toLowerCase();
  if (lower.startsWith('en')) {
    return 'en';
  }
  if (
    lower.includes('hant') ||
    lower.startsWith('zh-tw') ||
    lower.startsWith('zh-hk') ||
    lower === 'tc'
  ) {
    return 'tc';
  }
  if (lower === 'sc' || lower.includes('hans') || lower.startsWith('zh')) {
    return 'sc';
  }
  return 'sc';
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      sc: { translation: sc },
      tc: { translation: tc },
      en: { translation: en },
    },
    fallbackLng: 'sc',
    supportedLngs: [...appLanguages],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'nexus-lang',
      caches: ['localStorage'],
      convertDetectedLanguage: normalizeLanguage,
    },
  });

i18n.on('languageChanged', (lng) => {
  const language = normalizeLanguage(lng);
  document.documentElement.lang = htmlLang[language];
});

document.documentElement.lang = htmlLang[normalizeLanguage(i18n.language)];

export { i18n };
