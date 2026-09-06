import { useEffect, useState } from 'react';

import { CloudSun, Shirt, Umbrella, Wind } from 'lucide-react';

import { SiteHeader } from '../components/SiteHeader';
import { fetchSeoulWeather, type Forecast, weatherCondition } from '../data/weather';

function clothing(temperature: number, precipitationChance: number) {
  if (temperature <= 4) return ['패딩이나 두꺼운 코트', '니트·기모 이너', '목도리와 장갑'];
  if (temperature <= 11) return ['트렌치코트나 재킷', '긴팔 상의', '얇은 니트'];
  if (temperature <= 20) return ['가벼운 재킷', '긴팔 또는 셔츠', '편한 운동화'];
  return precipitationChance >= 40
    ? ['가벼운 반팔', '얇은 겉옷', '접이식 우산']
    : ['가벼운 반팔', '통풍 좋은 하의', '선글라스 또는 모자'];
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

  return (
    <main className="weather-page">
      <SiteHeader />
      <section className="weather-hero">
        <p className="eyebrow">SEOUL WEATHER · TODAY</p>
        <h2>현재 서울의 날씨는?</h2>
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
            {weather && <CloudSun size={42} />}
            <strong>{temperature}°</strong>
            <div>
              <b>{weather}</b>
              <span>체감 {apparent}° · 서울</span>
            </div>
          </div>
        )}
      </section>
      {!error && current && today && (
        <section className="weather-guide" aria-label="Today’s Seoul weather and clothing advice">
          <div className="weather-stats">
            <span>
              <Wind size={18} /> 바람 {Math.round(current.wind_speed_10m)} km/h
            </span>
            <span>
              <Umbrella size={18} /> 강수 확률 {rainChance}%
            </span>
            <span>
              최저 {Math.round(today.temperature_2m_min[0])}° / 최고{' '}
              {Math.round(today.temperature_2m_max[0])}°
            </span>
          </div>
          <div className="clothing-guide">
            <Shirt size={22} />
            <div>
              <p className="eyebrow">WHAT TO WEAR</p>
              <h2>오늘의 추천 복장</h2>
              <ul>
                {clothing(
                  Math.round(current.apparent_temperature),
                  today.precipitation_probability_max[0],
                ).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="weather-source">
            날씨 데이터: <a href="https://open-meteo.com/en/docs">Open-Meteo</a>
          </p>
        </section>
      )}
    </main>
  );
}
