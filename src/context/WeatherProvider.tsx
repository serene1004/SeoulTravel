import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { fetchSeoulWeather, type Forecast } from '../data/weather';

import { WeatherContext } from './weatherContext';

type WeatherState = {
  forecast?: Forecast;
  status: 'loading' | 'ready' | 'error';
};

export function WeatherProvider({ children }: { children: ReactNode }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<WeatherState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    let didTimeout = false;
    const timeoutId = window.setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, 15_000);

    fetchSeoulWeather(controller.signal)
      .then((forecast) => setState({ forecast, status: 'ready' }))
      .catch(() => {
        if (!controller.signal.aborted || didTimeout) setState({ status: 'error' });
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
      });

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((current) => current + 1);
  }, []);

  return (
    <WeatherContext.Provider
      value={{
        forecast: state.forecast,
        isLoading: state.status === 'loading',
        hasError: state.status === 'error',
        retry,
      }}
    >
      {children}
    </WeatherContext.Provider>
  );
}
