import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { Clock3, CloudSun, Footprints, MapPin, Sparkles } from 'lucide-react';

import { SiteHeader } from '../components/SiteHeader';
import { getPublicAttractionRecord } from '../data/publicAttractions';
import { getSpotById, getSpotCategoryLabel } from '../data/spots';
import { fetchSeoulWeather, type Forecast, weatherCondition } from '../data/weather';

export default function SpotDetailPage() {
  const { spotId } = useParams();
  const spot = getSpotById(spotId);
  const [forecast, setForecast] = useState<Forecast>();

  useEffect(() => {
    fetchSeoulWeather()
      .then(setForecast)
      .catch(() => undefined);
  }, []);

  if (!spot) {
    return (
      <main className="detail-page">
        <SiteHeader />
        <section className="spot-intro">
          <p className="eyebrow">SPOT NOT FOUND</p>
          <h2>이 장소를 찾을 수 없어요.</h2>
        </section>
      </main>
    );
  }

  const publicRecord = getPublicAttractionRecord(spot.id);
  const publicAddress = publicRecord?.address;
  const weatherNote = forecast
    ? {
        icon: CloudSun,
        label: '오늘의 날씨',
        value: `${Math.round(forecast.current.temperature_2m)}° · ${weatherCondition(forecast.current.weather_code)}`,
        description: `체감 ${Math.round(forecast.current.apparent_temperature)}° · 서울`,
      }
    : {
        icon: CloudSun,
        label: '오늘의 날씨',
        value: '날씨 확인 중',
        description: '잠시만 기다려 주세요.',
      };
  const notes = publicRecord
    ? [
        weatherNote,
        {
          icon: Clock3,
          label: '이용시간',
          value: publicRecord.hours || '별도 확인 필요',
          description: publicRecord.closedDays
            ? `휴무일: ${publicRecord.closedDays}`
            : '운영 정보는 데이터 갱신 시 반영됩니다.',
        },
        {
          icon: Footprints,
          label: '교통 정보',
          value: publicRecord.transport || '별도 확인 필요',
          description: publicRecord.tags || '공공데이터 태그 정보가 없습니다.',
        },
      ]
    : [
        weatherNote,
        {
          icon: Sparkles,
          label: '장소 타입',
          value: getSpotCategoryLabel(spot.category, 'ko'),
          description: '지도에서 같은 타입의 장소를 골라 이어서 둘러볼 수 있어요.',
        },
        {
          icon: Footprints,
          label: '가까운 곳',
          value: `${spot.neighborhood.ko} · 탐색`,
          description: '지도에서 가까운 장소를 이어서 살펴보세요.',
        },
      ];

  return (
    <main className="detail-page">
      <SiteHeader />
      <section className="spot-hero">
        <div className="spot-photo" role="img" aria-label={`${spot.name.en} image placeholder`}>
          <span>SPOT IMAGE</span>
          <b>{spot.name.en}</b>
        </div>
        <div className="spot-intro">
          <p className="eyebrow">
            {spot.district.ko} · {getSpotCategoryLabel(spot.category, 'ko')}
          </p>
          <h2>{spot.name.ko}</h2>
          <p>{spot.neighborhood.ko}의 관광 정보와 이동 동선을 함께 살펴보세요.</p>
          <div className="spot-chips">
            <span>
              <Clock3 size={15} /> {spot.note.ko}
            </span>
            <span>
              <MapPin size={15} /> {publicAddress || `${spot.neighborhood.ko}, ${spot.district.ko}`}
            </span>
          </div>
        </div>
      </section>
      <section className="spot-notes">
        {notes.map(({ icon: Icon, label, value, description }) => (
          <article key={label}>
            <Icon size={23} />
            <p>{label}</p>
            <b>{value}</b>
            <span>{description}</span>
          </article>
        ))}
      </section>
    </main>
  );
}
