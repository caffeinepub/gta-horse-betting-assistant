/**
 * React hook for reading betting history from AsyncStorage
 * Subscribes to storage changes for real-time updates
 */

import { useState, useEffect } from 'react';
import { getBettingHistory, subscribeToStorageChanges } from '../lib/storage';
import type { BettingHistory } from '../types/storage';

interface UseBettingHistoryResult {
  bettingHistory: BettingHistory | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useBettingHistory(): UseBettingHistoryResult {
  const [bettingHistory, setBettingHistory] = useState<BettingHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadHistory = () => {
    try {
      setIsLoading(true);
      setError(null);
      const history = getBettingHistory();
      setBettingHistory(history);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load betting history');
      setError(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();

    // Subscribe to storage changes for real-time updates
    const unsubscribe = subscribeToStorageChanges(() => {
      loadHistory();
    });

    return unsubscribe;
  }, []);

  return {
    bettingHistory,
    isLoading,
    error,
    refresh: loadHistory,
  };
}
