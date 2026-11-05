import { useContext } from 'react';

import { SavedSpotsContext } from './savedSpotsContext';

export function useSavedSpots() {
  const context = useContext(SavedSpotsContext);
  if (!context) throw new Error('useSavedSpots must be used within SavedSpotsProvider.');
  return context;
}
