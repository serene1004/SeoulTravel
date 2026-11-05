import { Link } from 'react-router-dom';

import { Bookmark, CloudSun } from 'lucide-react';

import { useLocale } from '../context/useLocale';
import { useSavedSpots } from '../context/useSavedSpots';
import { useSeoulWeather } from '../hooks/useSeoulWeather';
import { t } from '../i18n/messages';

import type { Locale } from '../data/spots';

type SiteHeaderProps = {
  overlay?: boolean;
};

export function SiteHeader({ overlay = false }: SiteHeaderProps) {
  const { savedSpotIds } = useSavedSpots();
  const { locale, setLocale } = useLocale();
  const { forecast, hasError: weatherError } = useSeoulWeather();
  const temperature = forecast?.current.temperature_2m;

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
        <label className="language-select">
          <span className="sr-only">{t(locale, 'language')}</span>
          <select
            value={locale}
            onChange={(event) => setLocale(event.target.value as Locale)}
            aria-label={t(locale, 'language')}
          >
            <option value="ko">한국어</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
          </select>
        </label>
      </div>
    </header>
  );
}
