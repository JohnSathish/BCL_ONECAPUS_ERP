import i18n from 'i18next';
import { en, type MessageKey } from './en';

void i18n.init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: en } },
  interpolation: { escapeValue: false },
});

export function t(key: MessageKey, fallback?: string) {
  return i18n.t(key) || fallback || key;
}

export { i18n };
