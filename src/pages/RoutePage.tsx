import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import {
  ArrowUpRight,
  ArrowUpDown,
  Bookmark,
  Check,
  MapPin,
  Navigation,
  Search,
  Train,
  X,
} from 'lucide-react';

import { SiteHeader } from '../components/SiteHeader';
import { useLocale } from '../context/useLocale';
import { useSavedSpots } from '../context/useSavedSpots';
import { getSpotCategoryLabel, seoulSpots } from '../data/spots';
import { t } from '../i18n/messages';

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
  const { locale } = useLocale();
  const listId = useId();
  const { savedSpotIds } = useSavedSpots();
  const selected = seoulSpots.find((spot) => spot.id === selectedId);
  const selectedName = selected?.name[locale] ?? '';
  const [queryValue, setQueryValue] = useState(selected?.name[locale] ?? '');
  const [querySelectedId, setQuerySelectedId] = useState(selectedId);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const previousSelectedNameRef = useRef(selectedName);
  const excluded = seoulSpots.find((spot) => spot.id === excludedId);
  const availableSpots = seoulSpots.filter((spot) => spot.id !== excludedId);
  const query = querySelectedId === selectedId ? queryValue : selectedName;

  useEffect(() => {
    const previousSelectedName = previousSelectedNameRef.current;
    previousSelectedNameRef.current = selectedName;
    setQueryValue((current) => (current === previousSelectedName ? selectedName : current));
  }, [selectedName]);
  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  const normalizedQueryName = normalizedQuery.replaceAll(/\s+/g, '');
  const excludedMatchesQuery = Boolean(
    normalizedQuery &&
    excluded &&
    [...Object.values(excluded.name), ...Object.values(excluded.district)]
      .join(' ')
      .toLocaleLowerCase(locale)
      .includes(normalizedQuery),
  );
  const matchingSpots = normalizedQuery
    ? availableSpots
        .filter((spot) =>
          [
            ...Object.values(spot.name),
            ...Object.values(spot.district),
            ...Object.values(spot.neighborhood),
          ]
            .join(' ')
            .toLocaleLowerCase(locale)
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
    : [
        ...savedSpotIds
          .map((savedId) => availableSpots.find((spot) => spot.id === savedId))
          .filter((spot): spot is (typeof seoulSpots)[number] => Boolean(spot)),
        ...featuredPlaceNames
          .map((name) => availableSpots.find((spot) => spot.name.ko === name))
          .filter(
            (spot): spot is (typeof seoulSpots)[number] =>
              spot !== undefined && !savedSpotIds.includes(spot.id),
          ),
      ];
  const results = matchingSpots;

  function choose(placeId: string) {
    const place = seoulSpots.find((spot) => spot.id === placeId);
    if (!place) return;
    setQueryValue(place.name[locale]);
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
      setQueryValue(selected?.name[locale] ?? '');
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
            placeholder={t(locale, 'searchPlaceDistrict')}
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
              aria-label={`${label} ${t(locale, 'close')}`}
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
          aria-label={t(locale, 'routeSearchResultsLabel', { label })}
        >
          <p className="route-place-result-heading">
            {normalizedQuery
              ? t(locale, 'searchResultsCount', { count: matchingSpots.length })
              : savedSpotIds.length
                ? t(locale, 'savedAndPopular')
                : t(locale, 'popularPlaces')}
          </p>
          {excludedMatchesQuery && (
            <p className="route-place-result-count">{t(locale, 'samePlaceBlocked')}</p>
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
                  <b>{spot.name[locale]}</b>
                  <small>
                    {spot.district[locale]} · {getSpotCategoryLabel(spot.category, locale)}
                  </small>
                </span>
                {spot.id === selectedId ? (
                  <Check size={16} aria-hidden="true" />
                ) : (
                  savedSpotIds.includes(spot.id) && <Bookmark size={15} aria-hidden="true" />
                )}
              </button>
            ))
          ) : (
            <p className="route-place-no-results">{t(locale, 'noRouteResults')}</p>
          )}
          {normalizedQuery && matchingSpots.length > 8 && (
            <p className="route-place-result-count">
              {t(locale, 'routeMoreResults', { count: matchingSpots.length })}
            </p>
          )}
        </div>
      )}
      {!isOpen && selected && (
        <span className="sr-only">
          {t(locale, 'selectedPlace')}: {selected.name[locale]}
        </span>
      )}
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

function createDirectionsUrl(from: (typeof seoulSpots)[number], to: (typeof seoulSpots)[number]) {
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  url.searchParams.set('origin', `${from.name.ko}, ${from.address}`);
  url.searchParams.set('destination', `${to.name.ko}, ${to.address}`);
  url.searchParams.set('travelmode', 'transit');
  return url.href;
}

export default function RoutePage() {
  const { locale } = useLocale();
  const [searchParams, setSearchParams] = useSearchParams();
  const fromId = searchParams.get('from') ?? '';
  const toId = searchParams.get('to') ?? '';
  const from = seoulSpots.find((spot) => spot.id === fromId);
  const to = seoulSpots.find((spot) => spot.id === toId);
  const hasValidRoute = Boolean(from && to && from.id !== to.id);
  const distanceKm =
    hasValidRoute && from && to ? getDistanceKm(from.coordinates, to.coordinates) : 0;
  const directionsUrl = hasValidRoute && from && to ? createDirectionsUrl(from, to) : undefined;

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
          <p className="eyebrow">{t(locale, 'routeKicker')}</p>
          <h2>{t(locale, 'routeTitle')}</h2>
          <p>{t(locale, 'routeIntro')}</p>

          <div className="route-form">
            <div className="route-place-fields">
              <PlacePicker
                id="route-origin"
                label={t(locale, 'fromPlace')}
                selectedId={fromId}
                excludedId={toId}
                onSelect={(placeId) => updateRoute(placeId, toId)}
              />
              <button
                type="button"
                className="route-swap"
                onClick={swapPlaces}
                disabled={!fromId && !toId}
                aria-label={t(locale, 'swapPlaces')}
              >
                <ArrowUpDown size={18} aria-hidden="true" />
              </button>
              <PlacePicker
                id="route-destination"
                label={t(locale, 'toPlace')}
                selectedId={toId}
                excludedId={fromId}
                onSelect={(placeId) => updateRoute(fromId, placeId)}
              />
            </div>
          </div>
          {from && to && from.id === to.id && (
            <p className="route-error" role="alert">
              {t(locale, 'samePlaceHint')}
            </p>
          )}

          <div className="route-mode-picker" aria-label={t(locale, 'transit')}>
            <span className="route-mode active">
              <Train size={17} aria-hidden="true" /> {t(locale, 'transit')}
            </span>
          </div>
          <p className="route-provider-note">{t(locale, 'googleTransitNote')}</p>
        </div>

        <div className="route-ticket" aria-live="polite">
          <div className="ticket-top">
            <span>SEOUL ROUTE</span>
            <b>{hasValidRoute ? `${distanceKm.toFixed(1)} km` : '—'}</b>
          </div>
          <div className="ticket-line" aria-hidden="true">
            <i /> <i />
          </div>
          {hasValidRoute && from && to ? (
            <>
              <div className="ticket-route">
                <strong>{from.name[locale]}</strong>
                <span>
                  <MapPin size={17} /> {t(locale, 'straightLine')}
                </span>
                <strong>{to.name[locale]}</strong>
              </div>
              <p className="route-distance-note">{t(locale, 'routeDistanceNote')}</p>
              <a className="ticket-map" href={directionsUrl} target="_blank" rel="noreferrer">
                <Navigation size={17} /> {t(locale, 'routeDirections')}
                <ArrowUpRight size={15} />
              </a>
            </>
          ) : (
            <div className="route-empty-state">
              <MapPin size={27} />
              <strong>{t(locale, 'chooseRoutePlaces')}</strong>
              <span>{t(locale, 'chooseAmongSpots', { count: seoulSpots.length })}</span>
            </div>
          )}
          <Link to="/explore" className="route-explore-link">
            {t(locale, 'findOnMap')}
          </Link>
        </div>
      </section>
    </main>
  );
}
