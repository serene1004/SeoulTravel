import assert from 'node:assert/strict';
import test from 'node:test';

import { getOutfitRules, getWeatherPlaceMode, parseForecast } from '../src/data/weatherRules.mjs';

function validForecast() {
  return {
    current: {
      apparent_temperature: 9,
      precipitation: 0,
      temperature_2m: 10,
      weather_code: 3,
      wind_speed_10m: 4,
    },
    daily: {
      precipitation_probability_max: [80],
      temperature_2m_max: [14],
      temperature_2m_min: [8],
      time: ['2026-11-06'],
    },
    hourly: {
      precipitation_probability: [80],
      temperature_2m: [10],
      time: ['2026-11-06T09:00'],
      weather_code: [61],
    },
  };
}

test('rain advice is included for cool-day outfit recommendations', () => {
  assert.deepEqual(getOutfitRules(8, 14, 80), { tier: 'cool', rainAdvice: true });
});

test('rain advice threshold applies across every temperature tier', () => {
  for (const [min, max, tier] of [
    [-2, 4, 'cold'],
    [8, 14, 'cool'],
    [14, 20, 'mild'],
    [24, 30, 'warm'],
  ]) {
    assert.deepEqual(getOutfitRules(min, max, 40), { tier, rainAdvice: true });
    assert.equal(getOutfitRules(min, max, 39).rainAdvice, false);
  }
});

test('weather place mode prefers indoor places for rain, snow, or high rain probability', () => {
  const base = {
    current: { precipitation: 0, weather_code: 1 },
    daily: { precipitation_probability_max: [10] },
  };

  assert.equal(getWeatherPlaceMode(base), 'outdoor');
  assert.equal(
    getWeatherPlaceMode({ ...base, daily: { precipitation_probability_max: [40] } }),
    'indoor',
  );
  assert.equal(
    getWeatherPlaceMode({ ...base, current: { ...base.current, precipitation: 0.1 } }),
    'indoor',
  );
  assert.equal(
    getWeatherPlaceMode({ ...base, current: { ...base.current, weather_code: 71 } }),
    'indoor',
  );
});

test('accepts a forecast with all required fields and matching arrays', () => {
  const forecast = validForecast();
  assert.equal(parseForecast(forecast), forecast);
});

test('rejects a successful JSON response that omits required hourly data', () => {
  const forecast = validForecast();
  delete forecast.hourly.weather_code;

  assert.throws(() => parseForecast(forecast), /invalid hourly forecast data/i);
});

test('rejects forecast arrays with mismatched lengths', () => {
  const forecast = validForecast();
  forecast.hourly.weather_code.push(71);

  assert.throws(() => parseForecast(forecast), /invalid hourly forecast data/i);
});
