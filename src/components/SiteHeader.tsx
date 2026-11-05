import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { Bookmark, CloudSun } from 'lucide-react';

import { useSavedSpots } from '../context/useSavedSpots';

import type { Locale } from '../data/spots';

type SiteHeaderProps = {
  locale?: Locale;
  onLocaleChange?: (locale: Locale) => void;
  overlay?: boolean;
};

export function SiteHeader({ locale = 'ko', onLocaleChange, overlay = false }: SiteHeaderProps) {
  const [temperature, setTemperature] = useState<number>();
  const { savedSpotIds } = useSavedSpots();

  useEffect(() => {
    fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.978&current=temperature_2m',
    )
      .then((response) => response.json() as Promise<{ current: { temperature_2m: number } }>)
      .then((data) => setTemperature(Math.round(data.current.temperature_2m)))
      .catch(() => undefined);
  }, []);

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
          aria-label={`저장한 장소 ${savedSpotIds.length}곳`}
        >
          <Bookmark size={16} aria-hidden="true" />
          <span>저장 {savedSpotIds.length}</span>
        </Link>
        <Link className="weather-pill" to="/weather">
          <CloudSun size={16} />
          <span>{temperature === undefined ? '서울 날씨' : `서울 ${temperature}°`}</span>
        </Link>
        <label className="language-select">
          <span className="sr-only">Language</span>
          <select
            defaultValue={locale}
            onChange={(event) => onLocaleChange?.(event.target.value as Locale)}
            aria-label="Language"
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
