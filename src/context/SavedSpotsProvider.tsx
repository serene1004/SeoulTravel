import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { SavedSpotsContext } from './savedSpotsContext';

const storageKey = 'seoul-travel:saved-spots';

function readSavedSpotIds() {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(value)
      ? [...new Set(value.filter((id): id is string => typeof id === 'string'))]
      : [];
  } catch {
    return [];
  }
}

export function SavedSpotsProvider({ children }: { children: ReactNode }) {
  const [savedSpotIds, setSavedSpotIds] = useState(readSavedSpotIds);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(savedSpotIds));
    } catch {
      // Saved places remain available for the current session when browser storage is unavailable.
    }
  }, [savedSpotIds]);

  const toggleSavedSpot = useCallback((spotId: string) => {
    setSavedSpotIds((current) =>
      current.includes(spotId) ? current.filter((id) => id !== spotId) : [...current, spotId],
    );
  }, []);
  const removeSavedSpots = useCallback((spotIds: string[]) => {
    const spotsToRemove = new Set(spotIds);
    setSavedSpotIds((current) => current.filter((id) => !spotsToRemove.has(id)));
  }, []);

  return (
    <SavedSpotsContext.Provider value={{ savedSpotIds, toggleSavedSpot, removeSavedSpots }}>
      {children}
    </SavedSpotsContext.Provider>
  );
}
