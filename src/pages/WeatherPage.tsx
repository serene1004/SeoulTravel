import { useEffect, useState } from 'react';

import { CloudSun, Umbrella, Wind } from 'lucide-react';

import { SiteHeader } from '../components/SiteHeader';
import { fetchSeoulWeather, type Forecast, weatherCondition } from '../data/weather';

function outfitFor(temperature: number, precipitationChance: number) {
  if (temperature <= 4) {
    return {
      image: 'cold.png',
      alt: '패딩과 두꺼운 겨울 코트 코디',
      note: '두꺼운 외투와 따뜻한 이너를 챙기면 좋아요.',
    };
  }
  if (temperature <= 11) {
    return {
      image: 'cool.png',
      alt: '재킷과 니트를 겹쳐 입은 도톰한 코디',
      note: '재킷이나 트렌치코트에 얇은 니트를 더해 보세요.',
    };
  }
  if (temperature <= 20) {
    return {
      image: 'mild.png',
      alt: '가벼운 재킷과 셔츠를 활용한 얇은 코디',
      note: '긴팔 옷에 가벼운 겉옷을 더하면 활동하기 좋아요.',
    };
  }
  return {
    image: 'warm.png',
    alt: '통풍이 잘되는 여름 코디',
    note:
      precipitationChance >= 40
        ? '가볍게 입고 접이식 우산을 챙기면 좋아요.'
        : '통풍이 잘되는 옷차림과 모자가 잘 어울려요.',
  };
}

function periodForecast(
  forecast: Forecast,
  label: string,
  startHour: number,
  endHour: number,
  representativeHour: number,
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
    condition: weatherCondition(forecast.hourly.weather_code[representativeIndex]),
    low: Math.round(Math.min(...temperatures)),
    high: Math.round(Math.max(...temperatures)),
    precipitationChance: Math.max(
      ...indexes.map((index) => forecast.hourly.precipitation_probability[index]),
    ),
  };
}

export default function WeatherPage() {
  const [forecast, setForecast] = useState<Forecast>();
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchSeoulWeather()
      .then(setForecast)
      .catch(() => setError(true));
  }, []);

  const current = forecast?.current;
  const today = forecast?.daily;
  const isLoading = !forecast && !error;
  const weather = current ? weatherCondition(current.weather_code) : undefined;
  const temperature = current ? Math.round(current.temperature_2m) : undefined;
  const apparent = current ? Math.round(current.apparent_temperature) : undefined;
  const rainChance = today?.precipitation_probability_max[0];
  const outfit = current && rainChance !== undefined
    ? outfitFor(Math.round(current.apparent_temperature), rainChance)
    : undefined;
  const periods = forecast
    ? [
        periodForecast(forecast, '오전', 6, 11, 9),
        periodForecast(forecast, '오후', 12, 17, 15),
      ].filter((period) => period !== undefined)
    : [];

  return (
    <main className="weather-page">
      <SiteHeader />
      <section className="weather-hero">
        <p className="eyebrow">SEOUL WEATHER · TODAY</p>
        <h2>오늘 서울 날씨</h2>
        {error ? (
          <p className="weather-error">
            날씨 정보를 불러오지 못했어요. 잠시 후 다시 확인해 주세요.
          </p>
        ) : isLoading ? (
          <div className="weather-summary weather-summary-loading" aria-live="polite">
            <span className="weather-loading-icon" aria-hidden="true" />
            <strong aria-hidden="true">--°</strong>
            <div>
              <b>서울 날씨 확인 중</b>
              <span>잠시만 기다려 주세요</span>
            </div>
          </div>
        ) : (
          <div className="weather-summary">
            {weather && <CloudSun size={32} aria-hidden="true" />}
            <strong>{temperature}°</strong>
            <div>
              <b>{weather}</b>
              <span>체감 {apparent}° · 서울</span>
            </div>
          </div>
        )}
        {!error && current && today && (
          <div className="weather-stats" aria-label="오늘 날씨 요약">
            <span>
              <Wind size={16} aria-hidden="true" /> 바람 {Math.round(current.wind_speed_10m)} km/h
            </span>
            <span>
              <Umbrella size={16} aria-hidden="true" /> 강수 확률 {rainChance}%
            </span>
            <span>
              최저 {Math.round(today.temperature_2m_min[0])}° · 최고{' '}
              {Math.round(today.temperature_2m_max[0])}°
            </span>
          </div>
        )}
      </section>
      {!error && forecast && (
        <section className="weather-guide" aria-label="오전과 오후 날씨 예보">
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
                <span>강수 확률 {period.precipitationChance}%</span>
              </article>
            ))}
          </div>
          {outfit && (
            <aside className="outfit-note" aria-label="옷차림 참고">
              <div>
                <p className="eyebrow">옷차림 참고</p>
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
            날씨 데이터: <a href="https://open-meteo.com/en/docs">Open-Meteo</a>
          </p>
        </section>
      )}
    </main>
  );
}
