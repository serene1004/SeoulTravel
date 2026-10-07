import { BrowserRouter, Route, Routes } from 'react-router-dom';

import ExplorePage from './App';
import HomePage from './pages/HomePage';
import RoutePage from './pages/RoutePage';
import SpotDetailPage from './pages/SpotDetailPage';
import WeatherPage from './pages/WeatherPage';

export default function SiteRoutes() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/spots/:spotId" element={<SpotDetailPage />} />
        <Route path="/routes" element={<RoutePage />} />
        <Route path="/weather" element={<WeatherPage />} />
      </Routes>
    </BrowserRouter>
  );
}
