import { t } from '../i18n/messages';

import type { Locale } from './spots';

export type Forecast = {
  current: {
    apparent_temperature: number;
    precipitation: number;
    temperature_2m: number;
    weather_code: number;
    wind_speed_10m: number;
  };
  daily: {
    precipitation_probability_max: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    time: string[];
  };
  hourly: {
    precipitation_probability: number[];
    temperature_2m: number[];
    time: string[];
    weather_code: number[];
  };
};

export type OutfitRecommendation = {
  image: string;
  alt: string;
  note: string;
};

export function getOutfitRecommendation(
  forecast: Forecast,
  locale: Locale = 'ko',
): OutfitRecommendation {
  const temperature =
    (forecast.daily.temperature_2m_min[0] + forecast.daily.temperature_2m_max[0]) / 2;
  const precipitationChance = forecast.daily.precipitation_probability_max[0];

  if (temperature <= 4) {
    return {
      image: 'cold.png',
      alt: t(locale, 'outfitColdAlt'),
      note: t(locale, 'outfitCold'),
    };
  }
  if (temperature <= 11) {
    return {
      image: 'cool.png',
      alt: t(locale, 'outfitCoolAlt'),
      note: t(locale, 'outfitCool'),
    };
  }
  if (temperature <= 20) {
    return {
      image: 'mild.png',
      alt: t(locale, 'outfitMildAlt'),
      note: t(locale, 'outfitMild'),
    };
  }
  return {
    image: 'warm.png',
    alt: t(locale, 'outfitWarmAlt'),
    note: precipitationChance >= 40 ? t(locale, 'outfitWarmRain') : t(locale, 'outfitWarm'),
  };
}

const endpoint =
  'https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.978&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FSeoul&forecast_days=1';

export function fetchSeoulWeather(signal?: AbortSignal) {
  return fetch(endpoint, { signal }).then((response) => {
    if (!response.ok) throw new Error('Weather request failed');
    return response.json() as Promise<Forecast>;
  });
}

export function weatherCondition(code: number, locale: Locale = 'ko') {
  if (code <= 1) return t(locale, 'weatherSunny');
  if (code <= 3 || code === 45 || code === 48) return t(locale, 'weatherCloudy');
  return t(locale, 'weatherRain');
}
