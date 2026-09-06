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
  };
};

const endpoint =
  'https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.978&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FSeoul';

export function fetchSeoulWeather() {
  return fetch(endpoint).then((response) => {
    if (!response.ok) throw new Error('Weather request failed');
    return response.json() as Promise<Forecast>;
  });
}

export function weatherCondition(code: number) {
  if (code <= 1) return '맑음';
  if (code <= 3 || code === 45 || code === 48) return '구름 많음';
  return '비 소식';
}
