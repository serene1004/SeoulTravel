export function getOutfitRules(minTemperature, maxTemperature, precipitationChance) {
  const temperature = (minTemperature + maxTemperature) / 2;
  const tier =
    temperature <= 4 ? 'cold' : temperature <= 11 ? 'cool' : temperature <= 20 ? 'mild' : 'warm';

  return { tier, rainAdvice: precipitationChance >= 40 };
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumberArray(value) {
  return Array.isArray(value) && value.every((item) => Number.isFinite(item));
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function hasMatchingArrays(record, keys, minimumLength = 1) {
  const arrays = keys.map((key) => record[key]);
  return (
    arrays.every((value) => Array.isArray(value)) &&
    arrays[0].length >= minimumLength &&
    arrays.every((value) => value.length === arrays[0].length)
  );
}

export function parseForecast(value) {
  if (
    !isRecord(value) ||
    !isRecord(value.current) ||
    !isRecord(value.daily) ||
    !isRecord(value.hourly)
  ) {
    throw new TypeError('Weather response has an invalid shape.');
  }

  const { current, daily, hourly } = value;
  const currentFields = [
    'apparent_temperature',
    'precipitation',
    'temperature_2m',
    'weather_code',
    'wind_speed_10m',
  ];
  if (!currentFields.every((field) => Number.isFinite(current[field]))) {
    throw new TypeError('Weather response has invalid current conditions.');
  }

  if (
    !hasMatchingArrays(daily, [
      'precipitation_probability_max',
      'temperature_2m_max',
      'temperature_2m_min',
      'time',
    ]) ||
    !isNumberArray(daily.precipitation_probability_max) ||
    !isNumberArray(daily.temperature_2m_max) ||
    !isNumberArray(daily.temperature_2m_min) ||
    !isStringArray(daily.time)
  ) {
    throw new TypeError('Weather response has invalid daily forecast data.');
  }

  if (
    !hasMatchingArrays(hourly, [
      'precipitation_probability',
      'temperature_2m',
      'time',
      'weather_code',
    ]) ||
    !isNumberArray(hourly.precipitation_probability) ||
    !isNumberArray(hourly.temperature_2m) ||
    !isStringArray(hourly.time) ||
    !isNumberArray(hourly.weather_code)
  ) {
    throw new TypeError('Weather response has invalid hourly forecast data.');
  }

  return value;
}
