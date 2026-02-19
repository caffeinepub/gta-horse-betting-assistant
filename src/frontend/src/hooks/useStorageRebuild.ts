/**
 * React hook for rebuilding derived statistics
 * Provides manual data recovery functionality
 */

import { useState } from 'react';
import { rebuildDerivedStats, notifyStorageChange } from '../lib/storage';

interface UseStorageRebuildResult {
  rebuild: () => Promise<void>;
  isRebuilding: boolean;
  error: Error | null;
  success: boolean;
}

export function useStorageRebuild(): UseStorageRebuildResult {
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [success, setSuccess] = useState(false);

  const rebuild = async (): Promise<void> => {
    setIsRebuilding(true);
    setError(null);
    setSuccess(false);

    try {
      // Rebuild all derived statistics from races
      rebuildDerivedStats();

      // Notify listeners
      notifyStorageChange();

      setSuccess(true);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to rebuild statistics');
      setError(error);
      throw error;
    } finally {
      setIsRebuilding(false);
    }
  };

  return {
    rebuild,
    isRebuilding,
    error,
    success,
  };
}
