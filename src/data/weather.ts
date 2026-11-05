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

export function getOutfitRecommendation(forecast: Forecast): OutfitRecommendation {
  const temperature =
    (forecast.daily.temperature_2m_min[0] + forecast.daily.temperature_2m_max[0]) / 2;
  const precipitationChance = forecast.daily.precipitation_probability_max[0];

  if (temperature <= 4) {
    return {
      image: 'cold.png',
      alt: '패딩과 두꺼운 겨울 코트 코디',
      note: '두꺼운 외투와 따뜻한 이너를 챙기면 좋아요.',
    };
  }
  if (temperature <= 11) {
    return {
      image: 'cool.png',
      alt: '재킷과 니트를 겹쳐 입은 도톰한 코디',
      note: '재킷이나 트렌치코트에 얇은 니트를 더해 보세요.',
    };
  }
  if (temperature <= 20) {
    return {
      image: 'mild.png',
      alt: '가벼운 재킷과 셔츠를 활용한 얇은 코디',
      note: '긴팔에 가벼운 겉옷을 걸치고, 따뜻한 낮에는 벗어 체온을 조절해 보세요.',
    };
  }
  return {
    image: 'warm.png',
    alt: '통풍이 잘되는 여름 코디',
    note:
      precipitationChance >= 40
        ? '가볍게 입고 접이식 우산을 챙기면 좋아요.'
        : '통풍이 잘되는 옷차림과 모자가 잘 어울려요.',
  };
}

const endpoint =
  'https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.978&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FSeoul&forecast_days=1';

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
