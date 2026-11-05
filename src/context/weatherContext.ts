import { createContext } from 'react';

import type { Forecast } from '../data/weather';

export type WeatherContextValue = {
  forecast?: Forecast;
  isLoading: boolean;
  hasError: boolean;
  retry: () => void;
};

export const WeatherContext = createContext<WeatherContextValue | null>(null);
