export type OutfitTier = 'cold' | 'cool' | 'mild' | 'warm';

export function getOutfitRules(
  minTemperature: number,
  maxTemperature: number,
  precipitationChance: number,
): { tier: OutfitTier; rainAdvice: boolean };

export function getWeatherPlaceMode(forecast: {
  current: { precipitation: number; weather_code: number };
  daily: { precipitation_probability_max: number[] };
}): 'indoor' | 'outdoor';

export function parseForecast<T>(value: unknown): T;
