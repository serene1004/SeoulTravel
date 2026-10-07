import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';

import { ArrowUpRight, ChevronLeft, ChevronRight, CloudSun, Search, X } from 'lucide-react';

import { ExploreMap, type ClusterPlace } from './components/ExploreMap';
import { SiteHeader } from './components/SiteHeader';
import { getPublicAttractionRecord, mapPublicAttractions } from './data/publicAttractions';
import { getSpotCategoryLabel, seoulSpots, type Locale, type SpotCategory } from './data/spots';
import { fetchSeoulWeather, type Forecast, weatherCondition } from './data/weather';

type Category = 'All' | SpotCategory;

const copy: Record<Locale, Record<string, string>> = {
  ko: {
    all: '전체',
    bestTime: '추천 시간 09:00–12:00',
    center: '서울 중심으로 보기',
    explore: '서울의 볼거리 먹거리',
    filters: '카테고리',
    search: '장소 또는 지역 검색',
    spot: '장소 정보 보기',
    title: '서울을 한눈에',
  },
  en: {
    all: 'All',
    bestTime: 'Best 09:00–12:00',
    center: 'Center on Seoul',
    explore: 'Seoul sights & eats',
    filters: 'Filter by',
    search: 'Search a place or area',
    spot: 'View place details',
    title: 'Plan Seoul in one place',
  },
  ja: {
    all: 'すべて',
    bestTime: 'おすすめ 09:00–12:00',
    center: 'ソウル中心に戻る',
    explore: 'ソウルの見どころ・グルメ',
    filters: 'カテゴリー',
    search: '場所・エリアを検索',
    spot: '場所の情報を見る',
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
const clusterPageSize = 5;
const searchDebounceMs = 300;

export default function App() {
  const [activeCategory, setActiveCategory] = useState<Category>('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPublicId, setSelectedPublicId] = useState<string | null>(null);
  const [selectedClusterPlaces, setSelectedClusterPlaces] = useState<ClusterPlace[]>([]);
  const [clusterListPage, setClusterListPage] = useState(0);
  const [sameLocationIndex, setSameLocationIndex] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [locale, setLocale] = useState<Locale>('ko');
  const [forecast, setForecast] = useState<Forecast>();

  useEffect(() => {
    fetchSeoulWeather()
      .then(setForecast)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (searchInput === search) return undefined;
    const timeoutId = window.setTimeout(() => {
      setSearch(searchInput);
      setSelectedId(null);
      setSelectedPublicId(null);
      setSelectedClusterPlaces([]);
      setClusterListPage(0);
      setSameLocationIndex(0);
    }, searchDebounceMs);
    return () => window.clearTimeout(timeoutId);
  }, [search, searchInput]);

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
  const visiblePublicAttractions = useMemo(() => {
    const normalizedSearch = search.toLocaleLowerCase(locale);
    return mapPublicAttractions.filter(
      (attraction) =>
        (activeCategory === 'All' || attraction.category === activeCategory) &&
        `${attraction.name} ${attraction.district ?? ''}`
          .toLocaleLowerCase(locale)
          .includes(normalizedSearch),
    );
  }, [activeCategory, locale, search]);

  const selected = selectedId ? visibleSpots.find((spot) => spot.id === selectedId) : undefined;
  const selectedPublicAttraction = selectedPublicId
    ? visiblePublicAttractions.find((attraction) => attraction.id === selectedPublicId)
    : undefined;
  const selectedPublicRecord = selected ? getPublicAttractionRecord(selected.id) : undefined;
  const selectedClusterItems = selectedClusterPlaces.flatMap((place) => {
    if (place.kind === 'spot') {
      const spot = seoulSpots.find((item) => item.id === place.id);
      return spot ? [{ ...place, name: spot.name[locale], category: spot.category }] : [];
    }
    const attraction = mapPublicAttractions.find((item) => item.id === place.id);
    return attraction ? [{ ...place, name: attraction.name, category: attraction.category }] : [];
  });
  const clusterPageCount = Math.ceil(selectedClusterItems.length / clusterPageSize);
  const pagedClusterItems = selectedClusterItems.slice(
    clusterListPage * clusterPageSize,
    (clusterListPage + 1) * clusterPageSize,
  );
  const isSameLocationCluster =
    selectedClusterPlaces.length > 1 &&
    selectedClusterPlaces.every(
    (place) =>
      place.coordinates[0] === selectedClusterPlaces[0]?.coordinates[0] &&
      place.coordinates[1] === selectedClusterPlaces[0]?.coordinates[1],
    );
  const text = copy[locale];

  useEffect(() => {
    if (!selectedId && !selectedPublicId && !selectedClusterPlaces.length) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && closeDialog();
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedClusterPlaces.length, selectedId, selectedPublicId]);

  function closeDialog() {
    setSelectedId(null);
    setSelectedPublicId(null);
    setSelectedClusterPlaces([]);
    setClusterListPage(0);
    setSameLocationIndex(0);
  }
  function changeCategory(category: Category) {
    setActiveCategory(category);
    closeDialog();
  }
  function changeSearch(value: string) {
    setSearchInput(value);
  }
  function selectClusterPlace(place: ClusterPlace) {
    if (isSameLocationCluster) {
      setSameLocationIndex(
        selectedClusterItems.findIndex((item) => item.id === place.id && item.kind === place.kind),
      );
    } else {
      setSelectedClusterPlaces([]);
      setClusterListPage(0);
      setSameLocationIndex(0);
    }
    setSelectedId(place.kind === 'spot' ? place.id : null);
    setSelectedPublicId(place.kind === 'public' ? place.id : null);
  }
  function selectStackPlace(place: ClusterPlace) {
    setSelectedId(place.kind === 'spot' ? place.id : null);
    setSelectedPublicId(place.kind === 'public' ? place.id : null);
  }
  function moveSameLocation(direction: -1 | 1) {
    const index = sameLocationIndex + direction;
    const place = selectedClusterItems[index];
    if (!place) return;
    setSameLocationIndex(index);
    selectStackPlace(place);
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
              value={searchInput}
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
                    ? seoulSpots.length + mapPublicAttractions.length
                    : seoulSpots.filter((spot) => spot.category === category).length +
                      mapPublicAttractions.filter((attraction) => attraction.category === category)
                        .length}
                </small>
              </button>
            ))}
          </div>
        </aside>
        <ExploreMap
          spots={visibleSpots}
          attractions={visiblePublicAttractions}
          locale={locale}
          categoryColors={categoryColors}
          centerLabel={text.center}
          selectedSpotId={selectedId}
          selectedAttractionId={selectedPublicId}
          onSelectSpot={(id) => {
            setSelectedClusterPlaces([]);
            setSameLocationIndex(0);
            setSelectedPublicId(null);
            setSelectedId(id);
          }}
          onSelectAttraction={(id) => {
            setSelectedClusterPlaces([]);
            setSameLocationIndex(0);
            setSelectedId(null);
            setSelectedPublicId(id);
          }}
          onSelectCluster={(places) => {
            if (places.length < 2) return;
            setSelectedClusterPlaces(places);
            setClusterListPage(0);
            setSameLocationIndex(0);
            setSelectedId(null);
            setSelectedPublicId(null);
          }}
        />
      </section>
      {(selected || selectedPublicAttraction || selectedClusterItems.length > 0) && (
        <div
          className="spot-dialog-backdrop"
          onMouseDown={(event) => event.target === event.currentTarget && closeDialog()}
        >
          {isSameLocationCluster && (selected || selectedPublicAttraction) && (
            <nav className="spot-dialog-stack-controls" aria-label="같은 위치의 장소">
              <button
                type="button"
                className="spot-dialog-stack-previous"
                aria-label="이전 장소"
                disabled={sameLocationIndex === 0}
                onClick={() => moveSameLocation(-1)}
              >
                <ChevronLeft size={54} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                className="spot-dialog-stack-next"
                aria-label="다음 장소"
                disabled={sameLocationIndex === selectedClusterItems.length - 1}
                onClick={() => moveSameLocation(1)}
              >
                <ChevronRight size={54} strokeWidth={1.5} />
              </button>
            </nav>
          )}
          <article
            className="spot-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="spot-dialog-title"
          >
            {selectedClusterItems.length > 0 && !selected && !selectedPublicAttraction ? (
              <>
                <div className="spot-dialog-top">
                  <span className="eyebrow">이 주변의 장소</span>
                  <button type="button" aria-label="Close place list" onClick={closeDialog}>
                    <X size={19} />
                  </button>
                </div>
                <h2 id="spot-dialog-title">주변 장소 {selectedClusterItems.length}곳</h2>
                <p className="spot-dialog-district">장소를 선택해 상세 정보를 확인하세요.</p>
                <div className="info-rule" />
                <div className="spot-dialog-list">
                  {pagedClusterItems.map((place) => (
                    <button
                      key={`${place.kind}-${place.id}`}
                      type="button"
                      onClick={() => selectClusterPlace(place)}
                    >
                      <span>{place.name}</span>
                      <small>{getSpotCategoryLabel(place.category, locale)}</small>
                    </button>
                  ))}
                </div>
                {clusterPageCount > 1 && (
                  <nav className="spot-dialog-pagination" aria-label="장소 목록 페이지">
                    <button
                      type="button"
                      disabled={clusterListPage === 0}
                      onClick={() => setClusterListPage((page) => page - 1)}
                    >
                      이전
                    </button>
                    <span>
                      {clusterListPage + 1} / {clusterPageCount}
                    </span>
                    <button
                      type="button"
                      disabled={clusterListPage === clusterPageCount - 1}
                      onClick={() => setClusterListPage((page) => page + 1)}
                    >
                      다음
                    </button>
                  </nav>
                )}
              </>
            ) : (
              <>
                <div className="spot-dialog-top">
                  <span className="eyebrow">
                    {isSameLocationCluster
                      ? `같은 위치의 장소 · ${sameLocationIndex + 1}/${selectedClusterItems.length}`
                      : getSpotCategoryLabel(
                          selectedPublicAttraction?.category ?? selected!.category,
                          locale,
                        )}
                  </span>
                  <button type="button" aria-label="Close place details" onClick={closeDialog}>
                    <X size={19} />
                  </button>
                </div>
                <h2 id="spot-dialog-title">
                  {selectedPublicAttraction
                    ? selectedPublicAttraction.name
                    : locale === 'ko' && selectedPublicRecord
                      ? selectedPublicRecord.name
                      : selected!.name[locale]}
                </h2>
                <p className="spot-dialog-district">
                  {selectedPublicAttraction?.address ||
                    selectedPublicRecord?.address ||
                    selected!.district[locale]}
                </p>
                <div className="info-rule" />
                <div className="spot-dialog-meta">
                  <span>
                    {selectedPublicAttraction?.tags ||
                      selectedPublicRecord?.tags ||
                      selected!.note[locale]}
                  </span>
                  <span>
                    {selectedPublicAttraction?.hours ||
                      selectedPublicRecord?.hours ||
                      text.bestTime}
                  </span>
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
                {selected && (
                  <Link className="spot-dialog-link" to={`/spots/${selected.id}`}>
                    {text.spot}
                    <ArrowUpRight size={16} />
                  </Link>
                )}
              </>
            )}
          </article>
        </div>
      )}
    </main>
  );
}
