import { t, type MessageKey } from '../i18n/messages';

import { getOutfitRules, parseForecast } from './weatherRules.mjs';

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

const outfitCopy = {
  cold: { image: 'cold.png', alt: 'outfitColdAlt', note: 'outfitCold' },
  cool: { image: 'cool.png', alt: 'outfitCoolAlt', note: 'outfitCool' },
  mild: { image: 'mild.png', alt: 'outfitMildAlt', note: 'outfitMild' },
  warm: { image: 'warm.png', alt: 'outfitWarmAlt', note: 'outfitWarm' },
} satisfies Record<
  'cold' | 'cool' | 'mild' | 'warm',
  { image: string; alt: MessageKey; note: MessageKey }
>;

export function getOutfitRecommendation(
  forecast: Forecast,
  locale: Locale = 'ko',
): OutfitRecommendation {
  const rules = getOutfitRules(
    forecast.daily.temperature_2m_min[0],
    forecast.daily.temperature_2m_max[0],
    forecast.daily.precipitation_probability_max[0],
  );
  const copy = outfitCopy[rules.tier];

  return {
    image: copy.image,
    alt: t(locale, copy.alt),
    note: [t(locale, copy.note), ...(rules.rainAdvice ? [t(locale, 'outfitRain')] : [])].join(' '),
  };
}

const endpoint =
  'https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.978&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FSeoul&forecast_days=1';

export function fetchSeoulWeather(signal?: AbortSignal) {
  return fetch(endpoint, { signal })
    .then((response) => {
      if (!response.ok) throw new Error('Weather request failed');
      return response.json() as Promise<unknown>;
    })
    .then((value) => parseForecast<Forecast>(value));
}

export function weatherCondition(code: number, locale: Locale = 'ko') {
  if ([0, 1].includes(code)) return t(locale, 'weatherSunny');
  if ([1, 2, 3, 45, 48].includes(code)) return t(locale, 'weatherCloudy');
  if ([71, 73, 75, 77, 85, 86].includes(code)) return t(locale, 'weatherSnow');
  if ([95, 96, 99].includes(code)) return t(locale, 'weatherThunder');
  return t(locale, 'weatherRain');
}
