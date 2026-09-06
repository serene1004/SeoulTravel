import { StrictMode } from 'react';

import { createRoot } from 'react-dom/client';

import './styles.css';
import SiteRoutes from './SiteRoutes';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SiteRoutes />
  </StrictMode>,
);
