import { BrowserRouter, Route, Routes } from 'react-router-dom';

import ExplorePage from './App';
import { LocaleProvider } from './context/LocaleProvider';
import { SavedSpotsProvider } from './context/SavedSpotsProvider';
import { WeatherProvider } from './context/WeatherProvider';
import HomePage from './pages/HomePage';
import RoutePage from './pages/RoutePage';
import SavedSpotsPage from './pages/SavedSpotsPage';
import SpotDetailPage from './pages/SpotDetailPage';
import WeatherPage from './pages/WeatherPage';

export default function SiteRoutes() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <LocaleProvider>
        <WeatherProvider>
          <SavedSpotsProvider>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/explore" element={<ExplorePage />} />
              <Route path="/spots/:spotId" element={<SpotDetailPage />} />
              <Route path="/routes" element={<RoutePage />} />
              <Route path="/saved" element={<SavedSpotsPage />} />
              <Route path="/weather" element={<WeatherPage />} />
            </Routes>
          </SavedSpotsProvider>
        </WeatherProvider>
      </LocaleProvider>
    </BrowserRouter>
  );
}
