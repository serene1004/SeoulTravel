import { Link } from 'react-router-dom';

import { Bookmark, MapPin, Route, Trash2 } from 'lucide-react';

import { SiteHeader } from '../components/SiteHeader';
import { useSavedSpots } from '../context/useSavedSpots';
import { getSpotCategoryLabel, getSpotById } from '../data/spots';

export default function SavedSpotsPage() {
  const { savedSpotIds, toggleSavedSpot } = useSavedSpots();
  const savedSpots = savedSpotIds.flatMap((id) => {
    const spot = getSpotById(id);
    return spot ? [spot] : [];
  });

  return (
    <main className="saved-page">
      <SiteHeader />
      <section className="saved-content">
        <p className="eyebrow">YOUR SEOUL SHORTLIST</p>
        <h2>저장한 장소</h2>
        <p className="saved-intro">여행 후보를 모아두고, 길찾기에서 출발지로 바로 선택하세요.</p>

        {savedSpots.length ? (
          <div className="saved-place-list">
            {savedSpots.map((spot) => (
              <article className="saved-place-row" key={spot.id}>
                <div className="saved-place-copy">
                  <span>
                    {spot.district.ko} · {getSpotCategoryLabel(spot.category, 'ko')}
                  </span>
                  <h3>{spot.name.ko}</h3>
                  <p>
                    <MapPin size={14} aria-hidden="true" /> {spot.address}
                  </p>
                </div>
                <div className="saved-place-actions">
                  <Link to={`/spots/${spot.id}`}>상세 보기</Link>
                  <Link
                    className="saved-route-link"
                    to={`/routes?from=${encodeURIComponent(spot.id)}`}
                  >
                    <Route size={15} aria-hidden="true" /> 여기서 출발
                  </Link>
                  <button
                    type="button"
                    aria-label={`${spot.name.ko} 저장 취소`}
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
            <h3>아직 저장한 장소가 없어요.</h3>
            <p>지도나 장소 상세 화면에서 마음에 드는 곳을 저장해 보세요.</p>
            <Link to="/explore">서울 장소 둘러보기</Link>
          </div>
        )}
      </section>
    </main>
  );
}
