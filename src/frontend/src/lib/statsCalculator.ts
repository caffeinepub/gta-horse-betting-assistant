/**
 * Pure functions for calculating derived statistics from race records
 * Implements odds bucket-based learning with four defined ranges
 */

import type { RaceRecord, BettingHistory, OddsBucketStats, OddsBucket, ModelState } from '../types/storage';

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
 * Classify odds value into one of four bucket keys
 * Ranges: 1-2, 3-5, 6-10, 11-30
 */
export function classifyOddsToBucket(odds: number): '1-2' | '3-5' | '6-10' | '11-30' {
  if (odds >= 1.0 && odds <= 2.0) return '1-2';
  if (odds > 2.0 && odds <= 5.0) return '3-5';
  if (odds > 5.0 && odds <= 10.0) return '6-10';
  return '11-30';
}

/**
 * Create empty bucket with all eight required fields
 */
function createEmptyBucket(): OddsBucket {
  return {
    totalRaces: 0,
    wins: 0,
    top3Finishes: 0,
    totalImpliedProbability: 0,
    actualWinRate: 0,
    roiIfFlatBet: 0,
    varianceScore: 0,
    recentWindowPerformance: 0,
  };
}

/**
 * Calculate variance score for a bucket
 * Measures outcome consistency (lower is more consistent)
 */
function calculateVariance(outcomes: number[]): number {
  if (outcomes.length === 0) return 0;
  
  const mean = outcomes.reduce((sum, val) => sum + val, 0) / outcomes.length;
  const squaredDiffs = outcomes.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / outcomes.length;
  
  return Math.sqrt(variance);
}

/**
 * Calculate recent window performance (last 20 races)
 */
function calculateRecentPerformance(recentOutcomes: number[]): number {
  if (recentOutcomes.length === 0) return 0;
  
  const recentWins = recentOutcomes.filter(outcome => outcome === 1).length;
  return (recentWins / recentOutcomes.length) * 100;
}

/**
 * Calculate odds bucket statistics from race records
 * Aggregates all eight required metrics per bucket
 */
export function calculateOddsBucketStats(races: readonly RaceRecord[]): OddsBucketStats {
  // Initialize all four buckets
  const buckets: Record<string, {
    totalRaces: number;
    wins: number;
    top3Finishes: number;
    totalImpliedProbability: number;
    totalPayout: number;
    totalBet: number;
    outcomes: number[];
    recentOutcomes: number[];
  }> = {
    '1-2': { totalRaces: 0, wins: 0, top3Finishes: 0, totalImpliedProbability: 0, totalPayout: 0, totalBet: 0, outcomes: [], recentOutcomes: [] },
    '3-5': { totalRaces: 0, wins: 0, top3Finishes: 0, totalImpliedProbability: 0, totalPayout: 0, totalBet: 0, outcomes: [], recentOutcomes: [] },
    '6-10': { totalRaces: 0, wins: 0, top3Finishes: 0, totalImpliedProbability: 0, totalPayout: 0, totalBet: 0, outcomes: [], recentOutcomes: [] },
    '11-30': { totalRaces: 0, wins: 0, top3Finishes: 0, totalImpliedProbability: 0, totalPayout: 0, totalBet: 0, outcomes: [], recentOutcomes: [] },
  };

  // Process each race
  for (const race of races) {
    // Process each horse in the race
    for (let i = 0; i < race.odds.length; i++) {
      const odds = race.odds[i];
      const bucketKey = classifyOddsToBucket(odds);
      const bucket = buckets[bucketKey];

      bucket.totalRaces++;
      bucket.totalImpliedProbability += race.impliedProbabilities[i];

      // Check if this horse won
      const won = race.actualFirst === i;
      if (won) {
        bucket.wins++;
        bucket.outcomes.push(1);
        bucket.recentOutcomes.push(1);
      } else {
        bucket.outcomes.push(0);
        bucket.recentOutcomes.push(0);
      }

      // Check if this horse finished in top 3
      const inTop3 = race.actualFirst === i || race.actualSecond === i || race.actualThird === i;
      if (inTop3) {
        bucket.top3Finishes++;
      }

      // Calculate ROI (flat $1 bet)
      const betAmount = 1.0;
      bucket.totalBet += betAmount;
      if (won) {
        bucket.totalPayout += odds * betAmount;
      }

      // Keep only last 20 outcomes for recent window
      if (bucket.recentOutcomes.length > 20) {
        bucket.recentOutcomes.shift();
      }
    }
  }

  // Calculate final statistics for each bucket and construct the result
  return {
    '1-2': {
      totalRaces: buckets['1-2'].totalRaces,
      wins: buckets['1-2'].wins,
      top3Finishes: buckets['1-2'].top3Finishes,
      totalImpliedProbability: buckets['1-2'].totalImpliedProbability,
      actualWinRate: buckets['1-2'].totalRaces > 0 ? (buckets['1-2'].wins / buckets['1-2'].totalRaces) * 100 : 0,
      roiIfFlatBet: buckets['1-2'].totalBet > 0 ? ((buckets['1-2'].totalPayout - buckets['1-2'].totalBet) / buckets['1-2'].totalBet) * 100 : 0,
      varianceScore: calculateVariance(buckets['1-2'].outcomes),
      recentWindowPerformance: calculateRecentPerformance(buckets['1-2'].recentOutcomes),
    },
    '3-5': {
      totalRaces: buckets['3-5'].totalRaces,
      wins: buckets['3-5'].wins,
      top3Finishes: buckets['3-5'].top3Finishes,
      totalImpliedProbability: buckets['3-5'].totalImpliedProbability,
      actualWinRate: buckets['3-5'].totalRaces > 0 ? (buckets['3-5'].wins / buckets['3-5'].totalRaces) * 100 : 0,
      roiIfFlatBet: buckets['3-5'].totalBet > 0 ? ((buckets['3-5'].totalPayout - buckets['3-5'].totalBet) / buckets['3-5'].totalBet) * 100 : 0,
      varianceScore: calculateVariance(buckets['3-5'].outcomes),
      recentWindowPerformance: calculateRecentPerformance(buckets['3-5'].recentOutcomes),
    },
    '6-10': {
      totalRaces: buckets['6-10'].totalRaces,
      wins: buckets['6-10'].wins,
      top3Finishes: buckets['6-10'].top3Finishes,
      totalImpliedProbability: buckets['6-10'].totalImpliedProbability,
      actualWinRate: buckets['6-10'].totalRaces > 0 ? (buckets['6-10'].wins / buckets['6-10'].totalRaces) * 100 : 0,
      roiIfFlatBet: buckets['6-10'].totalBet > 0 ? ((buckets['6-10'].totalPayout - buckets['6-10'].totalBet) / buckets['6-10'].totalBet) * 100 : 0,
      varianceScore: calculateVariance(buckets['6-10'].outcomes),
      recentWindowPerformance: calculateRecentPerformance(buckets['6-10'].recentOutcomes),
    },
    '11-30': {
      totalRaces: buckets['11-30'].totalRaces,
      wins: buckets['11-30'].wins,
      top3Finishes: buckets['11-30'].top3Finishes,
      totalImpliedProbability: buckets['11-30'].totalImpliedProbability,
      actualWinRate: buckets['11-30'].totalRaces > 0 ? (buckets['11-30'].wins / buckets['11-30'].totalRaces) * 100 : 0,
      roiIfFlatBet: buckets['11-30'].totalBet > 0 ? ((buckets['11-30'].totalPayout - buckets['11-30'].totalBet) / buckets['11-30'].totalBet) * 100 : 0,
      varianceScore: calculateVariance(buckets['11-30'].outcomes),
      recentWindowPerformance: calculateRecentPerformance(buckets['11-30'].recentOutcomes),
    },
  };
}

/**
 * Calculate accuracy from recent race records
 */
function calculateAccuracy(races: readonly RaceRecord[], windowSize: number): number {
  if (races.length === 0) return 0;
  
  const recentRaces = races.slice(-windowSize);
  const correctPredictions = recentRaces.filter(
    race => race.actualFirst === race.recommendedContender
  ).length;
  
  return (correctPredictions / recentRaces.length) * 100;
}

/**
 * Calculate drift score comparing baseline to current accuracy
 */
function calculateDriftScore(baselineAccuracy: number, currentAccuracy: number): number {
  if (baselineAccuracy === 0) return 0;
  return Math.abs(baselineAccuracy - currentAccuracy) / baselineAccuracy;
}

/**
 * Compute updated signal weights from race records and current model state
 * Returns updated ModelState with recalculated signal weights and calibration parameters
 */
export function computeUpdatedSignalWeights(
  races: readonly RaceRecord[],
  currentState: ModelState
): ModelState {
  if (races.length === 0) {
    return currentState;
  }

  const bucketStats = calculateOddsBucketStats(races);
  const recentWindow = currentState.recentAccuracyWindow;
  
  // Calculate current accuracy
  const currentAccuracy = calculateAccuracy(races, recentWindow);
  
  // Update baseline if this is the first calculation or we have enough data
  const baselineAccuracy = currentState.driftDetectionState.baselineAccuracy === 0 && races.length >= recentWindow
    ? currentAccuracy
    : currentState.driftDetectionState.baselineAccuracy;
  
  // Calculate drift score
  const driftScore = calculateDriftScore(baselineAccuracy, currentAccuracy);
  
  // Calculate bucket performance weights based on ROI
  const bucketPerformances = [
    { key: '1-2', roi: bucketStats['1-2'].roiIfFlatBet },
    { key: '3-5', roi: bucketStats['3-5'].roiIfFlatBet },
    { key: '6-10', roi: bucketStats['6-10'].roiIfFlatBet },
    { key: '11-30', roi: bucketStats['11-30'].roiIfFlatBet },
  ];
  
  const totalPositiveROI = bucketPerformances.reduce(
    (sum, bucket) => sum + Math.max(0, bucket.roi),
    0
  );
  
  // Adjust signal weights based on bucket performance
  const historicalBucketWeight = totalPositiveROI > 0
    ? 0.25 + (0.1 * (totalPositiveROI / 100))
    : 0.25;
  
  // Adjust recent bucket weight based on recent window performance
  const avgRecentPerformance = (
    bucketStats['1-2'].recentWindowPerformance +
    bucketStats['3-5'].recentWindowPerformance +
    bucketStats['6-10'].recentWindowPerformance +
    bucketStats['11-30'].recentWindowPerformance
  ) / 4;
  
  const recentBucketWeight = avgRecentPerformance > 0
    ? 0.25 + (0.1 * (avgRecentPerformance / 100))
    : 0.25;
  
  // Calculate consistency weight based on variance
  const avgVariance = (
    bucketStats['1-2'].varianceScore +
    bucketStats['3-5'].varianceScore +
    bucketStats['6-10'].varianceScore +
    bucketStats['11-30'].varianceScore
  ) / 4;
  
  const consistencyWeight = avgVariance < 0.5 ? 0.2 : 0.15;
  
  // Normalize weights to sum to 1.0
  const totalWeight = 0.35 + historicalBucketWeight + recentBucketWeight + consistencyWeight;
  const normalizedOddsWeight = 0.35 / totalWeight;
  const normalizedHistoricalWeight = historicalBucketWeight / totalWeight;
  const normalizedRecentWeight = recentBucketWeight / totalWeight;
  const normalizedConsistencyWeight = consistencyWeight / totalWeight;
  
  // Calculate calibration scalar based on overall accuracy
  const calibrationScalar = currentAccuracy > 0
    ? 1.0 + ((currentAccuracy - 50) / 100)
    : 1.0;
  
  // Calculate confidence scaling factor based on race count
  const confidenceScalingFactor = Math.min(1.0, races.length / 100);
  
  return {
    ...currentState,
    lastUpdated: Date.now(),
    totalRacesProcessed: races.length,
    signalWeights: {
      oddsWeight: normalizedOddsWeight,
      historicalBucketWeight: normalizedHistoricalWeight,
      recentBucketWeight: normalizedRecentWeight,
      consistencyWeight: normalizedConsistencyWeight,
    },
    calibrationScalar,
    confidenceScalingFactor,
    recentAccuracyWindow: currentState.recentAccuracyWindow,
    driftDetectionState: {
      baselineAccuracy,
      currentAccuracy,
      driftScore,
      lastDriftCheck: Date.now(),
    },
    raceCount: races.length,
  };
}

/**
 * Compute updated calibration parameters from race records and current model state
 * Returns updated ModelState with recalculated calibration parameters
 */
export function computeUpdatedCalibrationParameters(
  races: readonly RaceRecord[],
  currentState: ModelState
): ModelState {
  return computeUpdatedSignalWeights(races, currentState);
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
