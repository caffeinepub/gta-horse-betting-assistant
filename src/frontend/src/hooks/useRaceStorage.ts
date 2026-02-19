/**
 * React hook for race storage operations
 * Provides async race logging with automatic bucket statistics recalculation
 */

import { useState } from 'react';
import { appendRace, rebuildDerivedStats, notifyStorageChange } from '../lib/storage';
import type { RaceRecordInput } from '../types/storage';

interface UseRaceStorageResult {
  logRaceToStorage: (raceData: RaceRecordInput) => Promise<void>;
  isLogging: boolean;
  error: Error | null;
}

export function useRaceStorage(): UseRaceStorageResult {
  const [isLogging, setIsLogging] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const logRaceToStorage = async (raceData: RaceRecordInput): Promise<void> => {
    setIsLogging(true);
    setError(null);

    try {
      // Append race record (immutable)
      appendRace(raceData);

      // Rebuild all derived statistics including bucket stats
      rebuildDerivedStats();

      // Notify listeners for real-time updates
      notifyStorageChange();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to log race');
      setError(error);
      throw error;
    } finally {
      setIsLogging(false);
    }
  };

  return {
    logRaceToStorage,
    isLogging,
    error,
  };
}
