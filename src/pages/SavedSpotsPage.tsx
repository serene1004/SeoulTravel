import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';

import { Bookmark, MapPin, Route, Trash2 } from 'lucide-react';

import { SiteHeader } from '../components/SiteHeader';
import { useLocale } from '../context/useLocale';
import { useSavedSpots } from '../context/useSavedSpots';
import { getSpotCategoryLabel, getSpotById } from '../data/spots';
import { t } from '../i18n/messages';

export default function SavedSpotsPage() {
  const { savedSpotIds, toggleSavedSpot, removeSavedSpots } = useSavedSpots();
  const { locale } = useLocale();
  const savedSpots = useMemo(
    () =>
      savedSpotIds.flatMap((id) => {
        const spot = getSpotById(id);
        return spot ? [spot] : [];
      }),
    [savedSpotIds],
  );
  const validSavedIds = useMemo(() => new Set(savedSpots.map((spot) => spot.id)), [savedSpots]);
  const staleSavedIds = useMemo(
    () => savedSpotIds.filter((id) => !validSavedIds.has(id)),
    [savedSpotIds, validSavedIds],
  );

  useEffect(() => {
    if (staleSavedIds.length > 0) removeSavedSpots(staleSavedIds);
  }, [removeSavedSpots, staleSavedIds]);

  return (
    <main className="saved-page">
      <SiteHeader />
      <section className="saved-content">
        <p className="eyebrow">{t(locale, 'savedPageKicker')}</p>
        <h2>{t(locale, 'savedPageTitle')}</h2>
        <p className="saved-intro">{t(locale, 'savedPageIntro')}</p>

        {savedSpots.length ? (
          <div className="saved-place-list">
            {savedSpots.map((spot) => (
              <article className="saved-place-row" key={spot.id}>
                <div className="saved-place-copy">
                  <span>
                    {spot.district[locale]} · {getSpotCategoryLabel(spot.category, locale)}
                  </span>
                  <h3>{spot.name[locale]}</h3>
                  <p>
                    <MapPin size={14} aria-hidden="true" /> {spot.address}
                  </p>
                </div>
                <div className="saved-place-actions">
                  <Link to={`/spots/${spot.id}`}>{t(locale, 'viewDetails')}</Link>
                  <Link
                    className="saved-route-link"
                    to={`/routes?from=${encodeURIComponent(spot.id)}`}
                  >
                    <Route size={15} aria-hidden="true" /> {t(locale, 'startHere')}
                  </Link>
                  <button
                    type="button"
                    aria-label={`${spot.name[locale]} · ${t(locale, 'removeSaved')}`}
                    onClick={() => toggleSavedSpot(spot.id)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="saved-empty">
            <Bookmark size={24} aria-hidden="true" />
            <h3>{t(locale, 'emptySaved')}</h3>
            <p>{t(locale, 'emptySavedText')}</p>
            <Link to="/explore">{t(locale, 'browsePlaces')}</Link>
          </div>
        )}
      </section>
    </main>
  );
}
