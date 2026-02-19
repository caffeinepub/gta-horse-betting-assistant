/**
 * Pure functions for calculating derived statistics from race records
 * These functions are deterministic and produce consistent results
 */

import type { RaceRecord, BettingHistory, OddsBucketStats, OddsBucket, BucketTrustData } from '../types/storage';

/**
 * Calculate cumulative betting history from race records
 */
export function calculateBettingHistory(races: readonly RaceRecord[]): BettingHistory {
  if (races.length === 0) {
    return {
      cumulativeROI: 0,
      totalRaces: 0,
      totalWins: 0,
      totalProfit: 0,
      totalInvested: 0,
      winRate: 0,
      lastUpdated: Date.now(),
    };
  }

  let totalProfit = 0;
  let totalInvested = 0;
  let totalWins = 0;

  for (const race of races) {
    totalProfit += race.profitLoss;
    totalInvested += race.recommendedBetSize;
    
    // Count as win if recommended contender finished first
    if (race.actualFirst === race.recommendedContender) {
      totalWins++;
    }
  }

  const cumulativeROI = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;
  const winRate = races.length > 0 ? (totalWins / races.length) * 100 : 0;

  return {
    cumulativeROI,
    totalRaces: races.length,
    totalWins,
    totalProfit,
    totalInvested,
    winRate,
    lastUpdated: Date.now(),
  };
}

/**
 * Map odds value to bucket range
 */
function mapOddsToBucket(odds: number): OddsBucket {
  if (odds < 2.0) return { min: 1.0, max: 2.0 };
  if (odds < 3.0) return { min: 2.0, max: 3.0 };
  if (odds < 5.0) return { min: 3.0, max: 5.0 };
  if (odds < 10.0) return { min: 5.0, max: 10.0 };
  return { min: 10.0, max: 1000.0 };
}

/**
 * Create bucket key for Map storage
 */
function bucketKey(bucket: OddsBucket): string {
  return `${bucket.min}-${bucket.max}`;
}

/**
 * Calculate odds bucket statistics from race records
 */
export function calculateOddsBucketStats(races: readonly RaceRecord[]): OddsBucketStats {
  const bucketMap = new Map<string, BucketTrustData>();

  for (const race of races) {
    // Process each contender's odds
    for (let i = 0; i < race.odds.length; i++) {
      const odds = race.odds[i];
      const bucket = mapOddsToBucket(odds);
      const key = bucketKey(bucket);

      // Get or create bucket data
      let bucketData = bucketMap.get(key);
      if (!bucketData) {
        bucketData = {
          range: bucket,
          trustWeight: 0.5,
          totalPredictions: 0,
          correctPredictions: 0,
          accuracy: 0,
        };
        bucketMap.set(key, bucketData);
      }

      // Update statistics
      bucketData.totalPredictions++;
      
      // Check if prediction was correct (contender finished in top 3)
      const finishedInTop3 = 
        race.actualFirst === i || 
        race.actualSecond === i || 
        race.actualThird === i;
      
      const predictedTop3 = race.predictedProbabilities[i] > 0.2;
      
      if (finishedInTop3 && predictedTop3) {
        bucketData.correctPredictions++;
      }

      // Calculate accuracy and trust weight
      bucketData.accuracy = bucketData.totalPredictions > 0
        ? (bucketData.correctPredictions / bucketData.totalPredictions) * 100
        : 0;
      
      // Trust weight increases with accuracy
      bucketData.trustWeight = Math.min(0.95, 0.5 + (bucketData.accuracy / 200));
    }
  }

  return {
    buckets: bucketMap,
    lastUpdated: Date.now(),
  };
}

/**
 * Rebuild all derived statistics from races array
 */
export function rebuildAllStats(races: readonly RaceRecord[]): {
  bettingHistory: BettingHistory;
  oddsBucketStats: OddsBucketStats;
} {
  return {
    bettingHistory: calculateBettingHistory(races),
    oddsBucketStats: calculateOddsBucketStats(races),
  };
}
