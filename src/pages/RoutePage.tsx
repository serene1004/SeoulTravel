import { useId, useState, type KeyboardEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import {
  ArrowLeftRight,
  ArrowUpRight,
  CarFront,
  Check,
  Footprints,
  MapPin,
  Navigation,
  Search,
  Train,
  X,
} from 'lucide-react';

import { SiteHeader } from '../components/SiteHeader';
import { getSpotCategoryLabel, seoulSpots } from '../data/spots';

type TravelMode = 'transit' | 'walking' | 'driving';

const modeOptions: { id: TravelMode; label: string; Icon: typeof Train }[] = [
  { id: 'transit', label: '대중교통', Icon: Train },
  { id: 'walking', label: '도보', Icon: Footprints },
  { id: 'driving', label: '자동차', Icon: CarFront },
];

const featuredPlaceNames = [
  '경복궁',
  '국립중앙박물관',
  '남산서울타워',
  '북촌한옥마을',
  '동대문디자인플라자 (DDP)',
  '서울 한양도성',
];

type PlacePickerProps = {
  label: string;
  id: string;
  selectedId: string;
  excludedId: string;
  onSelect: (placeId: string) => void;
};

function PlacePicker({ label, id, selectedId, excludedId, onSelect }: PlacePickerProps) {
  const listId = useId();
  const [queryValue, setQueryValue] = useState('');
  const [querySelectedId, setQuerySelectedId] = useState(selectedId);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const selected = seoulSpots.find((spot) => spot.id === selectedId);
  const excluded = seoulSpots.find((spot) => spot.id === excludedId);
  const availableSpots = seoulSpots.filter((spot) => spot.id !== excludedId);
  const query = querySelectedId === selectedId ? queryValue : (selected?.name.ko ?? '');
  const normalizedQuery = query.trim().toLocaleLowerCase('ko');
  const normalizedQueryName = normalizedQuery.replaceAll(/\s+/g, '');
  const excludedMatchesQuery = Boolean(
    normalizedQuery &&
      excluded &&
      [excluded.name.ko, excluded.name.en, excluded.name.ja, excluded.district.ko]
        .join(' ')
        .toLocaleLowerCase('ko')
        .includes(normalizedQuery),
  );
  const matchingSpots = normalizedQuery
    ? availableSpots
        .filter((spot) =>
          [spot.name.ko, spot.name.en, spot.name.ja, spot.district.ko, spot.neighborhood.ko]
            .join(' ')
            .toLocaleLowerCase('ko')
            .includes(normalizedQuery),
        )
        .sort((left, right) => {
          const leftName = left.name.ko.toLocaleLowerCase('ko').replaceAll(/\s+/g, '');
          const rightName = right.name.ko.toLocaleLowerCase('ko').replaceAll(/\s+/g, '');
          const leftRank =
            leftName === normalizedQueryName ? 0 : leftName.startsWith(normalizedQueryName) ? 1 : 2;
          const rightRank =
            rightName === normalizedQueryName
              ? 0
              : rightName.startsWith(normalizedQueryName)
                ? 1
                : 2;
          return leftRank - rightRank || left.name.ko.localeCompare(right.name.ko, 'ko');
        })
    : featuredPlaceNames
        .map((name) => availableSpots.find((spot) => spot.name.ko === name))
        .filter((spot): spot is (typeof seoulSpots)[number] => Boolean(spot));
  const results = matchingSpots;

  function choose(placeId: string) {
    const place = seoulSpots.find((spot) => spot.id === placeId);
    if (!place) return;
    setQueryValue(place.name.ko);
    setQuerySelectedId(place.id);
    setIsOpen(false);
    setActiveIndex(-1);
    onSelect(place.id);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!results.length) return;
      setIsOpen(true);
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? results.length - 1 : index - 1));
    } else if (event.key === 'Enter' && isOpen && results.length > 0) {
      event.preventDefault();
      choose(results[activeIndex >= 0 ? activeIndex : 0].id);
    } else if (event.key === 'Escape') {
      setIsOpen(false);
      setQueryValue(selected?.name.ko ?? '');
      setQuerySelectedId(selectedId);
    }
  }

  return (
    <div className="route-place-picker">
      <label htmlFor={id}>
        <span>{label}</span>
        <div className="route-place-input-wrap">
          <Search size={16} aria-hidden="true" />
          <input
            id={id}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={isOpen}
            aria-controls={listId}
            aria-activedescendant={activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
            autoComplete="off"
            placeholder="장소명 또는 자치구 검색"
            value={query}
            onChange={(event) => {
              setQueryValue(event.target.value);
              setQuerySelectedId(selectedId);
              setIsOpen(true);
              setActiveIndex(-1);
              if (!event.target.value) onSelect('');
            }}
            onFocus={() => setIsOpen(true)}
            onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
            onKeyDown={handleKeyDown}
          />
          {query && (
            <button
              type="button"
              className="route-place-clear"
              aria-label={`${label} 지우기`}
              onClick={() => {
                setQueryValue('');
                setQuerySelectedId('');
                setIsOpen(true);
                onSelect('');
                document.getElementById(id)?.focus();
              }}
              onMouseDown={(event) => event.preventDefault()}
            >
              <X size={15} />
            </button>
          )}
        </div>
      </label>
      {isOpen && (
        <div
          className="route-place-results"
          id={listId}
          role="listbox"
          aria-label={`${label} 검색 결과`}
        >
          <p className="route-place-result-heading">
            {normalizedQuery ? `검색 결과 ${matchingSpots.length}곳` : '많이 찾는 장소'}
          </p>
          {excludedMatchesQuery && (
            <p className="route-place-result-count">
              반대편에 이미 선택한 장소는 선택할 수 없어요.
            </p>
          )}
          {results.length ? (
            results.map((spot, index) => (
              <button
                type="button"
                id={`${listId}-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                className={
                  index === activeIndex
                    ? 'route-place-result active'
                    : spot.id === selectedId
                      ? 'route-place-result selected'
                      : 'route-place-result'
                }
                key={spot.id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(spot.id)}
              >
                <span>
                  <b>{spot.name.ko}</b>
                  <small>
                    {spot.district.ko} · {getSpotCategoryLabel(spot.category, 'ko')}
                  </small>
                </span>
                {spot.id === selectedId && <Check size={16} aria-hidden="true" />}
              </button>
            ))
          ) : (
            <p className="route-place-no-results">
              검색 결과가 없어요. 다른 장소를 검색해 주세요. 출발지와 도착지는 서로 달라야 합니다.
            </p>
          )}
          {normalizedQuery && matchingSpots.length > 8 && (
            <p className="route-place-result-count">
              {matchingSpots.length}곳 · 목록을 스크롤하거나 장소명을 더 입력해 좁혀보세요.
            </p>
          )}
        </div>
      )}
      {!isOpen && selected && <span className="sr-only">선택됨: {selected.name.ko}</span>}
    </div>
  );
}

function getDistanceKm(from: [number, number], to: [number, number]) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const [fromLng, fromLat] = from;
  const [toLng, toLat] = to;
  const latitudeDelta = radians(toLat - fromLat);
  const longitudeDelta = radians(toLng - fromLng);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(fromLat)) * Math.cos(radians(toLat)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function createDirectionsUrl(
  from: (typeof seoulSpots)[number],
  to: (typeof seoulSpots)[number],
  mode: TravelMode,
) {
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  url.searchParams.set('origin', `${from.coordinates[1]},${from.coordinates[0]}`);
  url.searchParams.set('destination', `${to.coordinates[1]},${to.coordinates[0]}`);
  url.searchParams.set('travelmode', mode);
  return url.href;
}

export default function RoutePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = useState<TravelMode>('transit');
  const fromId = searchParams.get('from') ?? '';
  const toId = searchParams.get('to') ?? '';
  const from = seoulSpots.find((spot) => spot.id === fromId);
  const to = seoulSpots.find((spot) => spot.id === toId);
  const hasValidRoute = Boolean(from && to && from.id !== to.id);
  const distanceKm =
    hasValidRoute && from && to ? getDistanceKm(from.coordinates, to.coordinates) : 0;
  const directionsUrl =
    hasValidRoute && from && to ? createDirectionsUrl(from, to, mode) : undefined;

  function updateRoute(nextFromId: string, nextToId: string) {
    if (nextFromId && nextFromId === nextToId) return;
    const nextParams = new URLSearchParams();
    if (nextFromId) nextParams.set('from', nextFromId);
    if (nextToId) nextParams.set('to', nextToId);
    setSearchParams(nextParams, { replace: true });
  }

  function swapPlaces() {
    updateRoute(toId, fromId);
  }

  return (
    <main className="route-page">
      <SiteHeader />
      <section className="route-layout">
        <div className="route-copy">
          <p className="eyebrow">LET'S CONNECT THE DOTS</p>
          <h2>
            장소 사이,
            <br />
            <em>길을 찾아볼까요?</em>
          </h2>
          <p>서울 장소 두 곳을 고르면 이동 경로를 지도 앱에서 바로 확인할 수 있어요.</p>

          <div className="route-form">
            <div className="route-place-fields">
              <PlacePicker
                id="route-origin"
                label="출발 장소"
                selectedId={fromId}
                excludedId={toId}
                onSelect={(placeId) => updateRoute(placeId, toId)}
              />
              <PlacePicker
                id="route-destination"
                label="도착 장소"
                selectedId={toId}
                excludedId={fromId}
                onSelect={(placeId) => updateRoute(fromId, placeId)}
              />
            </div>
            <button
              type="button"
              className="route-swap"
              onClick={swapPlaces}
              disabled={!fromId && !toId}
              aria-label="출발지와 도착지 바꾸기"
            >
              <ArrowLeftRight size={18} />
            </button>
          </div>
          {from && to && from.id === to.id && (
            <p className="route-error" role="alert">
              출발지와 다른 장소를 도착지로 선택해 주세요.
            </p>
          )}

          <div className="route-mode-picker" role="group" aria-label="이동 방법">
            {modeOptions.map(({ id, label, Icon }) => (
              <button
                type="button"
                key={id}
                className={mode === id ? 'route-mode active' : 'route-mode'}
                aria-pressed={mode === id}
                onClick={() => setMode(id)}
              >
                <Icon size={17} /> {label}
              </button>
            ))}
          </div>
          <p className="route-provider-note">
            실제 경로와 소요 시간은 선택한 이동 방법으로 지도 앱에서 확인합니다.
          </p>
        </div>

        <div className="route-ticket" aria-live="polite">
          <div className="ticket-top">
            <span>SEOUL ROUTE</span>
            <b>{hasValidRoute ? `${distanceKm.toFixed(1)} km` : '—'}</b>
          </div>
          <div className="ticket-line" aria-hidden="true">
            <i /> <i /> <i /> <i />
          </div>
          {hasValidRoute && from && to ? (
            <>
              <div className="ticket-route">
                <strong>{from.name.ko}</strong>
                <span>
                  <MapPin size={17} /> 직선거리
                </span>
                <strong>{to.name.ko}</strong>
              </div>
              <p className="route-distance-note">
                장소 좌표 간 거리이며 실제 이동 거리와 다를 수 있습니다.
              </p>
              <a className="ticket-map" href={directionsUrl} target="_blank" rel="noreferrer">
                <Navigation size={17} /> 지도에서{' '}
                {modeOptions.find((item) => item.id === mode)?.label} 경로 보기
                <ArrowUpRight size={15} />
              </a>
            </>
          ) : (
            <div className="route-empty-state">
              <MapPin size={27} />
              <strong>출발지와 도착지를 선택해 주세요</strong>
              <span>선정된 서울 여행 장소 {seoulSpots.length}곳에서 고를 수 있습니다.</span>
            </div>
          )}
          <Link to="/explore" className="route-explore-link">
            지도에서 장소 찾기
          </Link>
        </div>
      </section>
    </main>
  );
}
