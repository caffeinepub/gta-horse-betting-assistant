/**
 * React hook for undoing the last race
 */

import { useState } from 'react';
import { undoLastRace } from '../lib/storage';

interface UseUndoRaceResult {
  undoRace: () => Promise<boolean>;
  isUndoing: boolean;
  error: string | null;
}

export function useUndoRace(): UseUndoRaceResult {
  const [isUndoing, setIsUndoing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const undoRace = async (): Promise<boolean> => {
    setIsUndoing(true);
    setError(null);

    try {
      const success = undoLastRace();
      if (!success) {
        setError('Failed to undo last race');
      }
      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to undo last race';
      setError(errorMessage);
      return false;
    } finally {
      setIsUndoing(false);
    }
  };

  return {
    undoRace,
    isUndoing,
    error,
  };
}
