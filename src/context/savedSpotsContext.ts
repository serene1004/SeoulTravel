import { createContext } from 'react';

export type SavedSpotsContextValue = {
  savedSpotIds: string[];
  toggleSavedSpot: (spotId: string) => void;
  removeSavedSpots: (spotIds: string[]) => void;
};

export const SavedSpotsContext = createContext<SavedSpotsContextValue | null>(null);
