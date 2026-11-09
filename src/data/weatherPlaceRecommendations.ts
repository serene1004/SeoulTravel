import { seoulSpots, type Spot } from './spots';
import { getWeatherPlaceMode } from './weatherRules.mjs';

import type { Forecast } from './weather';

export type WeatherPlaceMode = ReturnType<typeof getWeatherPlaceMode>;

const placeTypePriority: Record<WeatherPlaceMode, string[]> = {
  indoor: [
    'museum_gallery',
    'performance_craft_activity',
    'cafe_tea_bookcafe',
    'shopping_destination',
    'specialty_culture_shop',
    'specialty_cultural_shop',
    'restaurant_bakery_food_street',
    'restaurant',
  ],
  outdoor: [
    'walk_garden_scenery',
    'landmark_viewpoint',
    'heritage_street_architecture',
    'neighborhood_walk',
    'heritage',
    'heritage_architecture',
  ],
};

const placeCandidates = seoulSpots.flatMap((spot) =>
  spot.placeType && spot.operatingStatus !== 'temporarily_closed'
    ? [{ spot, placeType: spot.placeType }]
    : [],
);

export function getWeatherPlaceRecommendations(
  forecast: Forecast,
  limit = 3,
): { mode: WeatherPlaceMode; places: Spot[] } {
  const mode = getWeatherPlaceMode(forecast);
  const places = placeTypePriority[mode]
    .flatMap((placeType) => {
      const match = placeCandidates.find((candidate) => candidate.placeType === placeType);
      return match ? [match.spot] : [];
    })
    .slice(0, limit);

  return { mode, places };
}
