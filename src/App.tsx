import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';

import { ArrowUpRight, CloudSun, House, Search, X } from 'lucide-react';
import {
  Map,
  NavigationControl,
  Popup,
  type GeoJSONSource,
  type Map as MapLibreMap,
  type MapLayerMouseEvent,
} from 'maplibre-gl';

import { SiteHeader } from './components/SiteHeader';
import { getPublicAttractionRecord } from './data/publicAttractions';
import {
  getSpotCategoryLabel,
  seoulSpots,
  type Locale,
  type Spot,
  type SpotCategory,
} from './data/spots';
import { fetchSeoulWeather, type Forecast, weatherCondition } from './data/weather';
import 'maplibre-gl/dist/maplibre-gl.css';

type Category = 'All' | SpotCategory;

const mapStyleUrl = 'https://tiles.openfreemap.org/styles/bright';
const seoulCenter: [number, number] = [126.9785, 37.5665];

const copy: Record<Locale, Record<string, string>> = {
  ko: {
    all: '전체',
    bestTime: '추천 시간 09:00–12:00',
    clothing: '추천 복장',
    center: '서울 중심으로 보기',
    explore: '서울의 볼거리 먹거리',
    filters: '카테고리',
    nearby: '주변 장소',
    save: '장소 저장하기',
    saved: '저장한 장소',
    search: '장소 또는 지역 검색',
    spot: '장소 정보 보기',
    spots: '개의 장소',
    title: '서울을 한눈에',
  },
  en: {
    all: 'All',
    bestTime: 'Best 09:00–12:00',
    clothing: 'What to wear',
    center: 'Center on Seoul',
    explore: 'Seoul sights & eats',
    filters: 'Filter by',
    nearby: 'Nearby places',
    save: 'Save place',
    saved: 'Saved places',
    search: 'Search a place or area',
    spot: 'View place details',
    spots: 'places',
    title: 'Plan Seoul in one place',
  },
  ja: {
    all: 'すべて',
    bestTime: 'おすすめ 09:00–12:00',
    clothing: '服装のヒント',
    center: 'ソウル中心に戻る',
    explore: 'ソウルの見どころ・グルメ',
    filters: 'カテゴリー',
    nearby: '周辺の場所',
    save: '場所を保存',
    saved: '保存した場所',
    search: '場所・エリアを検索',
    spot: '場所の情報を見る',
    spots: '件の場所',
    title: 'ソウル旅行を、ひとつに',
  },
};

const categories: Category[] = ['All', 'Culture', 'Food', 'Cafe', 'Nature'];
const categoryColors: Record<SpotCategory, string> = {
  Culture: '#c6503a',
  Food: '#d4773c',
  Cafe: '#d5a33e',
  Nature: '#368b68',
};

function toFeatureCollection(items: Spot[]) {
  return {
    type: 'FeatureCollection' as const,
    features: items.map((spot) => ({
      type: 'Feature' as const,
      properties: { id: spot.id, category: spot.category, color: categoryColors[spot.category] },
      geometry: { type: 'Point' as const, coordinates: spot.coordinates },
    })),
  };
}

export default function App() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [locale, setLocale] = useState<Locale>('ko');
  const [isMapReady, setIsMapReady] = useState(false);
  const [forecast, setForecast] = useState<Forecast>();

  useEffect(() => {
    fetchSeoulWeather()
      .then(setForecast)
      .catch(() => undefined);
  }, []);

  const visibleSpots = useMemo(() => {
    const normalizedSearch = search.toLocaleLowerCase(locale);
    return seoulSpots.filter((spot) => {
      const matchesCategory = activeCategory === 'All' || spot.category === activeCategory;
      const searchable =
        `${spot.name.ko} ${spot.name.en} ${spot.name.ja} ${spot.district.ko} ${spot.district.en} ${spot.neighborhood.ko} ${spot.neighborhood.en}`.toLocaleLowerCase(
          locale,
        );
      return matchesCategory && searchable.includes(normalizedSearch);
    });
  }, [activeCategory, locale, search]);

  const selected = selectedId ? visibleSpots.find((spot) => spot.id === selectedId) : undefined;
  const hovered = hoveredId ? visibleSpots.find((spot) => spot.id === hoveredId) : undefined;
  const selectedPublicRecord = selected ? getPublicAttractionRecord(selected.id) : undefined;
  const hoveredPublicRecord = hovered ? getPublicAttractionRecord(hovered.id) : undefined;
  const text = copy[locale];

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return undefined;

    const map = new Map({
      container: mapContainerRef.current,
      style: mapStyleUrl,
      center: seoulCenter,
      zoom: 11.35,
    });
    map.addControl(new NavigationControl({ showCompass: true }), 'top-right');
    map.on('load', () => {
      map.addSource('spots', {
        type: 'geojson',
        data: toFeatureCollection(seoulSpots),
        promoteId: 'id',
      });
      map.addLayer({
        id: 'spot-points',
        type: 'circle',
        source: 'spots',
        paint: {
          'circle-radius': 7,
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#fffaf0',
          'circle-stroke-width': 3,
        },
      });
      map.on('mouseenter', 'spot-points', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mousemove', 'spot-points', (event: MapLayerMouseEvent) => {
        const spotId = event.features?.[0]?.properties?.id;
        if (typeof spotId !== 'string') return;
        setHoveredId(spotId);
      });
      map.on('mouseleave', 'spot-points', () => {
        map.getCanvas().style.cursor = '';
        setHoveredId(null);
      });
      map.on('click', 'spot-points', (event: MapLayerMouseEvent) => {
        const spotId = event.features?.[0]?.properties?.id;
        if (typeof spotId === 'string') {
          setHoveredId(null);
          setSelectedId(spotId);
        }
      });
      setIsMapReady(true);
    });

    mapRef.current = map;
    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
      setIsMapReady(false);
    };
  }, []);

  useEffect(() => {
    const source = mapRef.current?.getSource('spots') as GeoJSONSource | undefined;
    if (isMapReady) source?.setData(toFeatureCollection(visibleSpots));
  }, [isMapReady, visibleSpots]);

  useEffect(() => {
    const map = mapRef.current;
    if (!isMapReady || !map) return;
    if (!hovered) {
      popupRef.current?.remove();
      popupRef.current = null;
      return;
    }

    const popupContent = document.createElement('article');
    popupContent.className = 'spot-popup spot-hover-popup';
    const name =
      locale === 'ko' ? hoveredPublicRecord?.name || hovered.name.ko : hovered.name[locale];
    const metadata = hoveredPublicRecord?.address || hovered.note[locale];
    const sourceLabel = getSpotCategoryLabel(hovered.category, locale);
    popupContent.innerHTML = `<div class="spot-popup-kicker"><span>${sourceLabel}</span><span>${hovered.district[locale]}</span></div><strong>${name}</strong><p>${metadata}</p>`;

    const popup =
      popupRef.current ??
      new Popup({
        anchor: 'bottom',
        closeButton: false,
        closeOnClick: false,
        className: 'spot-popup-container',
        offset: 14,
      }).addTo(map);
    popup.setLngLat(hovered.coordinates).setDOMContent(popupContent);
    popupRef.current = popup;
  }, [hovered, hoveredPublicRecord, isMapReady, locale]);

  useEffect(() => {
    if (selected)
      mapRef.current?.flyTo({
        center: selected.coordinates,
        zoom: 14.6,
        duration: 900,
        essential: true,
      });
  }, [selected]);

  useEffect(() => {
    if (!selectedId) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedId]);

  function centerMap() {
    mapRef.current?.flyTo({ center: seoulCenter, zoom: 11.35, duration: 900, essential: true });
  }

  function changeCategory(category: Category) {
    setActiveCategory(category);
    setHoveredId(null);
    setSelectedId(null);
  }

  function changeSearch(value: string) {
    setSearch(value);
    setHoveredId(null);
    setSelectedId(null);
  }

  function closeDialog() {
    setSelectedId(null);
  }

  return (
    <main className="app-shell">
      <SiteHeader locale={locale} onLocaleChange={setLocale} />

      <section className="workspace" id="top">
        <aside className="sidebar" aria-label="Place filters">
          <div className="eyebrow">{text.explore}</div>
          <h2>{text.title}</h2>
          <label className="search-box">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => changeSearch(event.target.value)}
              placeholder={text.search}
            />
          </label>
          <div className="filter-heading">
            <span>{text.filters}</span>
          </div>
          <div className="filter-list">
            {categories.map((category) => (
              <button
                className={activeCategory === category ? 'filter active' : 'filter'}
                key={category}
                onClick={() => changeCategory(category)}
                style={
                  {
                    '--filter-color':
                      category === 'All' ? 'var(--muted)' : categoryColors[category],
                  } as CSSProperties
                }
              >
                <span className="filter-label">
                  {category !== 'All' && (
                    <i aria-hidden="true" style={{ backgroundColor: categoryColors[category] }} />
                  )}
                  {category === 'All' ? text.all : getSpotCategoryLabel(category, locale)}
                </span>
                <small>
                  {category === 'All'
                    ? seoulSpots.length
                    : seoulSpots.filter((spot) => spot.category === category).length}
                </small>
              </button>
            ))}
          </div>
        </aside>

        <section className="map-area" aria-label="Interactive Seoul map">
          <div className="map-canvas" ref={mapContainerRef} aria-label="Map of Seoul places" />
          <button
            className="locate-button"
            onClick={centerMap}
            aria-label={text.center}
            title={text.center}
          >
            <House size={19} />
          </button>
        </section>
      </section>

      {selected && (
        <div
          className="spot-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <article
            className="spot-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="spot-dialog-title"
          >
            <div className="spot-dialog-top">
              <span className="eyebrow">{getSpotCategoryLabel(selected.category, locale)}</span>
              <button type="button" aria-label="Close place details" onClick={closeDialog}>
                <X size={19} />
              </button>
            </div>
            <h2 id="spot-dialog-title">
              {locale === 'ko' && selectedPublicRecord
                ? selectedPublicRecord.name
                : selected.name[locale]}
            </h2>
            <p className="spot-dialog-district">
              {selectedPublicRecord?.address || selected.district[locale]}
            </p>
            <div className="info-rule" />
            <div className="spot-dialog-meta">
              <span>{selectedPublicRecord?.tags || selected.note[locale]}</span>
              <span>{selectedPublicRecord?.hours || text.bestTime}</span>
            </div>
            <section className="spot-dialog-weather">
              <CloudSun size={30} strokeWidth={1.5} />
              <div>
                <b>
                  {forecast
                    ? `${Math.round(forecast.current.temperature_2m)}° · ${weatherCondition(forecast.current.weather_code)}`
                    : '서울 날씨 확인 중'}
                </b>
                <p>
                  {forecast
                    ? `체감 ${Math.round(forecast.current.apparent_temperature)}° · 서울`
                    : '잠시만 기다려 주세요'}
                </p>
              </div>
            </section>
            <Link className="spot-dialog-link" to={`/spots/${selected.id}`}>
              {text.spot}
              <ArrowUpRight size={16} />
            </Link>
          </article>
        </div>
      )}
    </main>
  );
}
