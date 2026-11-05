import { CloudSun, Umbrella, Wind } from 'lucide-react';

import { SiteHeader } from '../components/SiteHeader';
import { useLocale } from '../context/useLocale';
import { getOutfitRecommendation, type Forecast, weatherCondition } from '../data/weather';
import { useSeoulWeather } from '../hooks/useSeoulWeather';
import { t } from '../i18n/messages';

function periodForecast(
  forecast: Forecast,
  label: string,
  startHour: number,
  endHour: number,
  representativeHour: number,
  locale: import('../data/spots').Locale,
) {
  const date = forecast.daily.time[0];
  const indexes = forecast.hourly.time.flatMap((time, index) => {
    const hour = Number(time.slice(11, 13));
    return time.startsWith(`${date}T`) && hour >= startHour && hour <= endHour ? [index] : [];
  });

  if (indexes.length === 0) return undefined;

  const representativeIndex = indexes.reduce((closest, index) => {
    const hour = Number(forecast.hourly.time[index].slice(11, 13));
    const closestHour = Number(forecast.hourly.time[closest].slice(11, 13));
    return Math.abs(hour - representativeHour) < Math.abs(closestHour - representativeHour)
      ? index
      : closest;
  });
  const temperatures = indexes.map((index) => forecast.hourly.temperature_2m[index]);

  return {
    label,
    condition: weatherCondition(forecast.hourly.weather_code[representativeIndex], locale),
    low: Math.round(Math.min(...temperatures)),
    high: Math.round(Math.max(...temperatures)),
    precipitationChance: Math.max(
      ...indexes.map((index) => forecast.hourly.precipitation_probability[index]),
    ),
  };
}

export default function WeatherPage() {
  const { locale } = useLocale();
  const { forecast, isLoading, hasError: error, retry } = useSeoulWeather();

  const current = forecast?.current;
  const today = forecast?.daily;
  const weather = current ? weatherCondition(current.weather_code, locale) : undefined;
  const temperature = current ? Math.round(current.temperature_2m) : undefined;
  const apparent = current ? Math.round(current.apparent_temperature) : undefined;
  const rainChance = today?.precipitation_probability_max[0];
  const outfit = forecast ? getOutfitRecommendation(forecast, locale) : undefined;
  const periods = forecast
    ? [
        periodForecast(forecast, t(locale, 'morning'), 6, 11, 9, locale),
        periodForecast(forecast, t(locale, 'afternoon'), 12, 17, 15, locale),
      ].filter((period) => period !== undefined)
    : [];

  return (
    <main className="weather-page">
      <SiteHeader />
      <section className="weather-hero">
        <p className="eyebrow">{t(locale, 'weatherKicker')}</p>
        <h2>{t(locale, 'weatherTitle')}</h2>
        {error ? (
          <div className="weather-error" role="alert">
            <p>{t(locale, 'weatherLoadError')}</p>
            <button type="button" onClick={retry}>
              {t(locale, 'retry')}
            </button>
          </div>
        ) : isLoading ? (
          <div className="weather-summary weather-summary-loading" aria-live="polite">
            <span className="weather-loading-icon" aria-hidden="true" />
            <strong aria-hidden="true">--°</strong>
            <div>
              <b>{t(locale, 'weatherLoading')}</b>
              <span>{t(locale, 'pleaseWait')}</span>
            </div>
          </div>
        ) : (
          <div className="weather-summary">
            {weather && <CloudSun size={32} aria-hidden="true" />}
            <strong>{temperature}°</strong>
            <div>
              <b>{weather}</b>
              <span>{t(locale, 'feelsLike', { temperature: apparent ?? '--' })}</span>
            </div>
          </div>
        )}
        {!error && current && today && (
          <div className="weather-stats" aria-label={t(locale, 'weatherStats')}>
            <span>
              <Wind size={16} aria-hidden="true" />{' '}
              {t(locale, 'wind', { speed: Math.round(current.wind_speed_10m) })}
            </span>
            <span>
              <Umbrella size={16} aria-hidden="true" />{' '}
              {t(locale, 'rainChance', { chance: rainChance ?? '--' })}
            </span>
            <span>
              {t(locale, 'lowHigh', {
                low: Math.round(today.temperature_2m_min[0]),
                high: Math.round(today.temperature_2m_max[0]),
              })}
            </span>
          </div>
        )}
      </section>
      {!error && forecast && (
        <section
          className="weather-guide"
          aria-label={`${t(locale, 'morning')} · ${t(locale, 'afternoon')}`}
        >
          <div className="weather-periods">
            {periods.map((period) => (
              <article className="weather-period" key={period.label}>
                <div className="weather-period-heading">
                  <h3>{period.label}</h3>
                  <span>{period.condition}</span>
                </div>
                <strong>
                  {period.low}°{period.low !== period.high && `–${period.high}°`}
                </strong>
                <span>
                  {t(locale, 'precipitationChance', { chance: period.precipitationChance })}
                </span>
              </article>
            ))}
          </div>
          {outfit && (
            <aside className="outfit-note" aria-label={t(locale, 'outfitAdvice')}>
              <div>
                <p className="eyebrow">{t(locale, 'outfitAdvice')}</p>
                <p>{outfit.note}</p>
              </div>
              <img
                src={`${import.meta.env.BASE_URL}images/weather-outfits/${outfit.image}`}
                alt={outfit.alt}
                loading="lazy"
              />
            </aside>
          )}
          <p className="weather-source">
            {t(locale, 'weatherSource')}: <a href="https://open-meteo.com/en/docs">Open-Meteo</a>
          </p>
        </section>
      )}
    </main>
  );
}
