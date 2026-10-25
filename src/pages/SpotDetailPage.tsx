import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Clock3, CloudSun, ExternalLink, Footprints, MapPin } from 'lucide-react';

import { SiteHeader } from '../components/SiteHeader';
import {
  getOfficialPlaceUrl,
  getPublicAttractionRecord,
  publicAttractionDataset,
} from '../data/publicAttractions';
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
          <Link to="/explore">지도에서 다른 장소 찾기</Link>
        </section>
      </main>
    );
  }

  const publicRecord = getPublicAttractionRecord(spot.id);
  const officialUrl = getOfficialPlaceUrl(publicRecord?.officialUrl);
  const publicAddress = publicRecord?.address;
  const enrichedFields = publicRecord?.enrichedInfo?.fields;
  const sourceLink = (field: 'address' | 'hours' | 'closedDays' | 'transport', label: string) => {
    const source = enrichedFields?.[field];
    if (!source?.sourceUrl) return null;
    const typeLabel =
      source.sourceType === 'official' ? '공식' : source.sourceType === 'public' ? '공공' : '보조';
    return (
      <a className="spot-field-source" href={source.sourceUrl} target="_blank" rel="noreferrer">
        {label} · {typeLabel} 출처 <ExternalLink size={12} aria-hidden="true" />
      </a>
    );
  };
  const mapUrl = new URL('https://www.google.com/maps/search/');
  mapUrl.searchParams.set('api', '1');
  mapUrl.searchParams.set('query', `${spot.coordinates[1]},${spot.coordinates[0]}`);
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
  const notes = [
    weatherNote,
    {
      icon: Clock3,
      label: '이용시간',
      value: publicRecord?.hours || '운영시간 확인 필요',
      field: 'hours',
      description: publicRecord?.closedDays
        ? `휴무일: ${publicRecord.closedDays}`
        : '방문 전 공식 안내에서 운영시간과 휴무일을 확인해 주세요.',
    },
    {
      icon: Footprints,
      label: '교통 정보',
      value: publicRecord?.transport || '교통 정보 확인 필요',
      field: 'transport',
      description: publicRecord?.tags || '방문 전 지도에서 이동 경로를 확인해 주세요.',
    },
  ];

  return (
    <main className="detail-page">
      <SiteHeader />
      <section className="spot-hero">
        <div className="spot-intro">
          <p className="eyebrow">
            {spot.district.ko} · {getSpotCategoryLabel(spot.category, 'ko')}
          </p>
          <h2>{spot.name.ko}</h2>
          <p>
            {publicRecord?.curationReason ||
              `${spot.district.ko}에서 ${getSpotCategoryLabel(spot.category, 'ko')} 장소를 둘러보세요.`}
          </p>
          <div className="spot-chips">
            {(publicRecord?.tags || spot.note.ko)
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean)
              .slice(0, 3)
              .map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
          </div>
          <p className="spot-intro-links">
            {officialUrl && (
              <>
                <a href={officialUrl} target="_blank" rel="noreferrer">
                  공식 안내 확인
                </a>{' '}
                ·{' '}
              </>
            )}
            <a href={publicAttractionDataset.datasetUrl} target="_blank" rel="noreferrer">
              서울시 관광 명소 데이터
            </a>
          </p>
          <p className="spot-source-note">
            데이터 출처: 서울시 관광 명소 · {publicAttractionDataset.license}
            {publicRecord?.enrichedInfo ? (
              <>
                <br />
                방문 정보 조사일: {publicRecord.enrichedInfo.researchedAt} · 실제 운영 여부와 당일
                변동은 출처에서 확인해 주세요.
              </>
            ) : publicRecord?.operatingStatus !== 'official_information_found' ? (
              <>
                <br />
                운영 정보 미확인 · 방문 전 공식 안내를 확인해 주세요.
              </>
            ) : null}
          </p>
        </div>
      </section>
      <section className="spot-info-list" aria-label="장소 방문 정보">
        <article className="spot-info-row spot-location-row">
          <div className="spot-info-label">
            <MapPin size={17} aria-hidden="true" />
            <p>위치</p>
          </div>
          <div className="spot-info-content">
            <strong>{publicAddress || `${spot.neighborhood.ko}, ${spot.district.ko}`}</strong>
            <small>
              {publicRecord?.enrichedInfo
                ? '공개 출처에서 조사한 주소'
                : publicRecord?.operatingStatus === 'official_information_found'
                  ? '공식 안내 정보 확인'
                  : '운영 정보 미확인 · 방문 전 공식 안내를 확인해 주세요.'}
            </small>
            {sourceLink('address', '주소')}
          </div>
          <a className="spot-map-link" href={mapUrl.href} target="_blank" rel="noreferrer">
            지도에서 위치 보기 <MapPin size={15} aria-hidden="true" />
          </a>
        </article>
        {notes.map((note) => (
          <article className="spot-info-row" key={note.label}>
            <div className="spot-info-label">
              <note.icon size={17} aria-hidden="true" />
              <p>{note.label}</p>
            </div>
            <div className="spot-info-content">
              <strong>{note.value}</strong>
              <small>{note.description}</small>
              {'field' in note && sourceLink(note.field as 'hours' | 'transport', note.label)}
              {'field' in note && note.field === 'hours' && sourceLink('closedDays', '휴무일')}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
