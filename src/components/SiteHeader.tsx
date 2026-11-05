import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { Bookmark, CloudSun, Globe } from 'lucide-react';

import { useLocale } from '../context/useLocale';
import { useSavedSpots } from '../context/useSavedSpots';
import { useSeoulWeather } from '../hooks/useSeoulWeather';
import { t } from '../i18n/messages';

import type { Locale } from '../i18n/locales';

const localeOptions: { locale: Locale; label: string }[] = [
  { locale: 'ko', label: '한국어' },
  { locale: 'en', label: 'English' },
  { locale: 'ja', label: '日本語' },
];

type SiteHeaderProps = {
  overlay?: boolean;
};

export function SiteHeader({ overlay = false }: SiteHeaderProps) {
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const languageControlRef = useRef<HTMLDivElement>(null);
  const languageTriggerRef = useRef<HTMLButtonElement>(null);
  const { savedSpotIds } = useSavedSpots();
  const { locale, setLocale } = useLocale();
  const { forecast, hasError: weatherError } = useSeoulWeather();
  const temperature = forecast?.current.temperature_2m;

  useEffect(() => {
    if (!isLanguageMenuOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (!languageControlRef.current?.contains(event.target as Node)) {
        setIsLanguageMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsLanguageMenuOpen(false);
        languageTriggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLanguageMenuOpen]);

  return (
    <header className={`site-header${overlay ? ' site-header-overlay' : ''}`}>
      <h1 className="site-brand-heading">
        <Link className="site-brand" to="/" aria-label="Seoul Travel home">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="Seoul Travel" />
        </Link>
      </h1>
      <div className="site-header-actions">
        <Link
          className="saved-spots-link"
          to="/saved"
          aria-label={t(locale, 'savedCountAria', { count: savedSpotIds.length })}
        >
          <Bookmark size={16} aria-hidden="true" />
          <span>{t(locale, 'savedCount', { count: savedSpotIds.length })}</span>
        </Link>
        <Link
          className="weather-pill"
          to="/weather"
          aria-label={weatherError ? t(locale, 'weatherErrorLink') : undefined}
        >
          <CloudSun size={16} />
          <span>
            {temperature === undefined
              ? t(locale, 'seoulWeather')
              : t(locale, 'weatherAt', { temperature: Math.round(temperature) })}
          </span>
        </Link>
        <div className="language-select" ref={languageControlRef}>
          <button
            className="language-select-trigger"
            type="button"
            aria-label={t(locale, 'language')}
            aria-expanded={isLanguageMenuOpen}
            ref={languageTriggerRef}
            onClick={() => setIsLanguageMenuOpen((isOpen) => !isOpen)}
          >
            <Globe size={16} aria-hidden="true" />
            <span>{locale.toUpperCase()}</span>
          </button>
          {isLanguageMenuOpen && (
            <div className="language-select-menu" role="group" aria-label={t(locale, 'language')}>
              {localeOptions.map((option) => (
                <button
                  className="language-select-option"
                  type="button"
                  key={option.locale}
                  aria-label={option.label}
                  aria-pressed={locale === option.locale}
                  onClick={() => {
                    setLocale(option.locale);
                    setIsLanguageMenuOpen(false);
                    languageTriggerRef.current?.focus();
                  }}
                >
                  <span>{option.locale.toUpperCase()}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
