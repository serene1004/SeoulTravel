import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Bookmark, Clock3, CloudSun, ExternalLink, Footprints, MapPin, Route } from 'lucide-react';

import { SiteHeader } from '../components/SiteHeader';
import { useLocale } from '../context/useLocale';
import { useSavedSpots } from '../context/useSavedSpots';
import {
  getOfficialPlaceUrl,
  loadPublicAttractionRecord,
  loadLocalizedPlaceContents,
  publicAttractionDataset,
  type LocalizedPlaceContentMap,
  type PublicAttractionRecord,
} from '../data/publicAttractions';
import { getSpotById, getSpotCategoryLabel } from '../data/spots';
import { weatherCondition } from '../data/weather';
import { useSeoulWeather } from '../hooks/useSeoulWeather';
import { t } from '../i18n/messages';

export default function SpotDetailPage() {
  const { spotId } = useParams();
  const { locale } = useLocale();
  const [localizedContents, setLocalizedContents] = useState<LocalizedPlaceContentMap>({});
  const spot = getSpotById(spotId);
  const selectedSpotId = spot?.id;
  const [loadedPublicRecord, setLoadedPublicRecord] = useState<{
    spotId: string;
    record: PublicAttractionRecord | undefined;
  }>();
  const { savedSpotIds, toggleSavedSpot } = useSavedSpots();
  const { forecast, hasError: weatherError, retry: retryWeather } = useSeoulWeather();

  useEffect(() => {
    let mounted = true;
    void loadLocalizedPlaceContents()
      .then((content) => {
        if (mounted) setLocalizedContents(content);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedSpotId) return undefined;
    let mounted = true;
    void loadPublicAttractionRecord(selectedSpotId)
      .then((record) => {
        if (mounted) setLoadedPublicRecord({ spotId: selectedSpotId, record });
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [selectedSpotId]);

  const publicRecord =
    loadedPublicRecord && loadedPublicRecord.spotId === selectedSpotId
      ? loadedPublicRecord.record
      : undefined;

  if (!spot) {
    return (
      <main className="detail-page">
        <SiteHeader />
        <section className="spot-intro">
          <p className="eyebrow">{t(locale, 'detailKicker')}</p>
          <h2>{t(locale, 'placeNotFound')}</h2>
          <Link to="/explore">{t(locale, 'findAnotherPlace')}</Link>
        </section>
      </main>
    );
  }

  const localizedContent = localizedContents[spot.id]?.[locale];
  const officialUrl = getOfficialPlaceUrl(publicRecord?.officialUrl);
  const publicAddress = publicRecord?.address;
  const displayAddress = localizedContent?.address || (locale === 'ko' ? publicAddress : undefined);
  const isSaved = savedSpotIds.includes(spot.id);
  const enrichedFields = publicRecord?.enrichedInfo?.fields;
  const sourceLink = (field: 'address' | 'hours' | 'closedDays' | 'transport', label: string) => {
    const source = enrichedFields?.[field];
    if (!source?.sourceUrl) return null;
    const typeLabel =
      source.sourceType === 'official'
        ? t(locale, 'sourceOfficial')
        : source.sourceType === 'public'
          ? t(locale, 'sourcePublic')
          : t(locale, 'sourceSupplement');
    return (
      <a className="spot-field-source" href={source.sourceUrl} target="_blank" rel="noreferrer">
        {label} · {typeLabel} {t(locale, 'sourceLabel')}{' '}
        <ExternalLink size={12} aria-hidden="true" />
      </a>
    );
  };
  const mapUrl = new URL('https://www.google.com/maps/search/');
  mapUrl.searchParams.set('api', '1');
  mapUrl.searchParams.set(
    'query',
    `${spot.name[locale]}, ${displayAddress || `${spot.district[locale]}, Seoul`}`,
  );
  const weatherNote = forecast
    ? {
        icon: CloudSun,
        label: t(locale, 'todayWeather'),
        value: `${Math.round(forecast.current.temperature_2m)}° · ${weatherCondition(forecast.current.weather_code, locale)}`,
        description: t(locale, 'feelsLike', {
          temperature: Math.round(forecast.current.apparent_temperature),
        }),
      }
    : weatherError
      ? {
          icon: CloudSun,
          label: t(locale, 'todayWeather'),
          value: t(locale, 'weatherUnavailable'),
          description: t(locale, 'weatherDescription'),
          retry: retryWeather,
        }
      : {
          icon: CloudSun,
          label: t(locale, 'todayWeather'),
          value: t(locale, 'checkingWeather'),
          description: t(locale, 'pleaseWait'),
        };
  const notes = [
    weatherNote,
    {
      icon: Clock3,
      label: t(locale, 'hours'),
      value:
        localizedContent?.hours ||
        (locale === 'ko' ? publicRecord?.hours : undefined) ||
        (locale === 'en' ? 'Check hours' : locale === 'ja' ? '営業時間を確認' : t(locale, 'hours')),
      field: 'hours',
      description: (locale === 'ko' ? publicRecord?.closedDays : localizedContent?.closedDays)
        ? `${t(locale, 'closedDays')}: ${locale === 'ko' ? publicRecord?.closedDays : localizedContent?.closedDays}`
        : t(locale, 'checkOfficialHours'),
    },
    {
      icon: Footprints,
      label: t(locale, 'transport'),
      value:
        localizedContent?.transport ||
        (locale === 'ko' ? publicRecord?.transport : undefined) ||
        (locale === 'en'
          ? 'Check directions'
          : locale === 'ja'
            ? 'アクセス情報を確認'
            : t(locale, 'transport')),
      field: 'transport',
      description:
        localizedContent?.tags ||
        (locale === 'ko' ? publicRecord?.tags : undefined) ||
        t(locale, 'checkRoute'),
    },
  ];
  const placeTags =
    (locale === 'ko' ? publicRecord?.tags || spot.note.ko : localizedContent?.tags) ||
    getSpotCategoryLabel(spot.category, locale);

  return (
    <main className="detail-page">
      <SiteHeader />
      <section className="spot-hero">
        <div className="spot-intro">
          <p className="eyebrow">
            {spot.district[locale]} · {getSpotCategoryLabel(spot.category, locale)}
          </p>
          <h2>{spot.name[locale]}</h2>
          <p>
            {localizedContent?.curationReason ||
              (locale === 'ko' ? publicRecord?.curationReason : undefined) ||
              t(locale, 'detailIntroFallback', {
                district: spot.district[locale],
                category: getSpotCategoryLabel(spot.category, locale),
              })}
          </p>
          <div className="spot-chips">
            {placeTags
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean)
              .slice(0, 3)
              .map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
          </div>
          <p className="spot-intro-links">
            <button
              type="button"
              className="spot-save-inline"
              aria-pressed={isSaved}
              onClick={() => toggleSavedSpot(spot.id)}
            >
              <Bookmark size={15} fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
              {isSaved ? t(locale, 'savedStatus') : t(locale, 'save')}
            </button>
            <Link to={`/routes?from=${encodeURIComponent(spot.id)}`}>
              <Route size={15} aria-hidden="true" /> {t(locale, 'departFromHere')}
            </Link>
            {officialUrl && (
              <>
                <a href={officialUrl} target="_blank" rel="noreferrer">
                  {t(locale, 'officialInfo')}
                </a>{' '}
                ·{' '}
              </>
            )}
            <a href={publicAttractionDataset.datasetUrl} target="_blank" rel="noreferrer">
              {t(locale, 'publicDataset')}
            </a>
          </p>
          <p className="spot-source-note">
            {t(locale, 'dataSource')}: {t(locale, 'seoulAttractionDatasetName')} ·{' '}
            {t(locale, 'publicDatasetLicense')}
            {publicRecord?.enrichedInfo ? (
              <>
                <br />
                {t(locale, 'researchedAt')}: {publicRecord.enrichedInfo.researchedAt} ·{' '}
                {t(locale, 'operatingStatusUnknown')}
              </>
            ) : publicRecord?.operatingStatus !== 'official_information_found' ? (
              <>
                <br />
                {t(locale, 'operatingStatusUnknown')}
              </>
            ) : null}
          </p>
        </div>
      </section>
      <section className="spot-info-list" aria-label={t(locale, 'visitInfo')}>
        <article className="spot-info-row spot-location-row">
          <div className="spot-info-label">
            <MapPin size={17} aria-hidden="true" />
            <p>{t(locale, 'location')}</p>
          </div>
          <div className="spot-info-content">
            <strong>
              {displayAddress || `${spot.neighborhood[locale]}, ${spot.district[locale]}`}
            </strong>
            <small>
              {publicRecord?.enrichedInfo
                ? t(locale, 'researchedAddress')
                : publicRecord?.operatingStatus === 'official_information_found'
                  ? t(locale, 'officialAddress')
                  : t(locale, 'addressUnknown')}
            </small>
            {sourceLink('address', t(locale, 'addressSource'))}
          </div>
          <a className="spot-map-link" href={mapUrl.href} target="_blank" rel="noreferrer">
            {t(locale, 'showOnMap')} <MapPin size={15} aria-hidden="true" />
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
              {'retry' in note && (
                <button className="spot-weather-retry" type="button" onClick={note.retry}>
                  {t(locale, 'retryWeather')}
                </button>
              )}
              {'field' in note && sourceLink(note.field as 'hours' | 'transport', note.label)}
              {'field' in note &&
                note.field === 'hours' &&
                sourceLink('closedDays', t(locale, 'closedDays'))}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
