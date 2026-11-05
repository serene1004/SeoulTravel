import { useContext } from 'react';

import { WeatherContext } from '../context/weatherContext';

export function useSeoulWeather() {
  const context = useContext(WeatherContext);
  if (!context) throw new Error('useSeoulWeather must be used within WeatherProvider.');
  return context;
}
