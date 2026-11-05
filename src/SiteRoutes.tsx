import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { LocaleProvider } from './context/LocaleProvider';
import { SavedSpotsProvider } from './context/SavedSpotsProvider';
import { useLocale } from './context/useLocale';
import { WeatherProvider } from './context/WeatherProvider';
import { t } from './i18n/messages';

const ExplorePage = lazy(() => import('./App'));
const HomePage = lazy(() => import('./pages/HomePage'));
const RoutePage = lazy(() => import('./pages/RoutePage'));
const SavedSpotsPage = lazy(() => import('./pages/SavedSpotsPage'));
const SpotDetailPage = lazy(() => import('./pages/SpotDetailPage'));
const WeatherPage = lazy(() => import('./pages/WeatherPage'));

function RouteLoading() {
  const { locale } = useLocale();
  return (
    <main className="route-loading" role="status" aria-live="polite">
      {t(locale, 'pageLoading')}
    </main>
  );
}

export default function SiteRoutes() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <LocaleProvider>
        <WeatherProvider>
          <SavedSpotsProvider>
            <Suspense fallback={<RouteLoading />}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/explore" element={<ExplorePage />} />
                <Route path="/spots/:spotId" element={<SpotDetailPage />} />
                <Route path="/routes" element={<RoutePage />} />
                <Route path="/saved" element={<SavedSpotsPage />} />
                <Route path="/weather" element={<WeatherPage />} />
              </Routes>
            </Suspense>
          </SavedSpotsProvider>
        </WeatherProvider>
      </LocaleProvider>
    </BrowserRouter>
  );
}
