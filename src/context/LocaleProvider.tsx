import { useEffect, useState, type ReactNode } from 'react';

import { locales } from '../i18n/locales';

import { LocaleContext } from './localeContext';

import type { Locale } from '../i18n/locales';

const storageKey = 'seoul-travel:locale';

function readLocale(): Locale {
  try {
    const storedLocale = localStorage.getItem(storageKey);
    return locales.includes(storedLocale as Locale) ? (storedLocale as Locale) : 'ko';
  } catch {
    return 'ko';
  }
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(readLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      localStorage.setItem(storageKey, locale);
    } catch {
      // Keep the selection for the current session when browser storage is unavailable.
    }
  }, [locale]);

  return <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>;
}
