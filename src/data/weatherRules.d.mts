export type OutfitTier = 'cold' | 'cool' | 'mild' | 'warm';

export function getOutfitRules(
  minTemperature: number,
  maxTemperature: number,
  precipitationChance: number,
): { tier: OutfitTier; rainAdvice: boolean };

export function parseForecast<T>(value: unknown): T;
