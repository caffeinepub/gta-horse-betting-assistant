/**
 * Pure functions for calculating derived statistics from race records
 * Implements odds bucket-based learning with four defined ranges and five-step prediction engine
 * CRITICAL: All implied probability calculations use the correct formula: 1 / (odds + 1)
 */

import type { 
  RaceRecord, 
  BettingHistory, 
  OddsBucketStats, 
  OddsBucket, 
  ModelState, 
  SignalWeights, 
  ConfidenceStats,
  CalibrationUpdate,
  DriftDetectionResult
} from '../types/storage';

/**
 * Calculate cumulative betting history from race records
 * Uses user-selected bet amounts (betAmount field) for all calculations
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
    // Use betAmount if available, otherwise fall back to recommendedBetSize
    totalInvested += race.betAmount || race.recommendedBetSize;
    
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
 * Create empty bucket with all nine required fields
 */
function createEmptyBucket(): OddsBucket {
  return {
    totalRaces: 0,
    wins: 0,
    top3Finishes: 0,
    totalImpliedProbability: 0,
    averageImpliedProbability: 0,
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
 * Aggregates all nine required metrics per bucket including averageImpliedProbability
 * CRITICAL: Uses correct implied probability formula 1/(odds+1) from stored race records
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
      // Use stored implied probability (already calculated with correct formula)
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

      // Calculate ROI using correct fractional odds payout
      // For odds X/1: profit = betAmount × odds, total return = betAmount × (odds + 1)
      const betAmount = 1.0;
      bucket.totalBet += betAmount;
      if (won) {
        bucket.totalPayout += betAmount * (odds + 1); // stake + profit
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
      averageImpliedProbability: buckets['1-2'].totalRaces > 0 ? buckets['1-2'].totalImpliedProbability / buckets['1-2'].totalRaces : 0,
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
      averageImpliedProbability: buckets['3-5'].totalRaces > 0 ? buckets['3-5'].totalImpliedProbability / buckets['3-5'].totalRaces : 0,
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
      averageImpliedProbability: buckets['6-10'].totalRaces > 0 ? buckets['6-10'].totalImpliedProbability / buckets['6-10'].totalRaces : 0,
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
      averageImpliedProbability: buckets['11-30'].totalRaces > 0 ? buckets['11-30'].totalImpliedProbability / buckets['11-30'].totalRaces : 0,
      actualWinRate: buckets['11-30'].totalRaces > 0 ? (buckets['11-30'].wins / buckets['11-30'].totalRaces) * 100 : 0,
      roiIfFlatBet: buckets['11-30'].totalBet > 0 ? ((buckets['11-30'].totalPayout - buckets['11-30'].totalBet) / buckets['11-30'].totalBet) * 100 : 0,
      varianceScore: calculateVariance(buckets['11-30'].outcomes),
      recentWindowPerformance: calculateRecentPerformance(buckets['11-30'].recentOutcomes),
    },
  };
}

/**
 * Update signal weights based on race outcome
 * Gradual adjustments of 1-3% per race
 * Compares predicted vs actual using correct implied probability baseline
 */
export function updateSignalWeights(
  currentWeights: SignalWeights,
  race: RaceRecord,
  bucketStats: OddsBucketStats
): SignalWeights {
  const winnerIndex = race.actualFirst;
  const predictedWinner = race.recommendedContender;
  
  // Check if prediction was correct
  const predictionCorrect = winnerIndex === predictedWinner;
  
  // Get winner's odds and bucket
  const winnerOdds = race.odds[winnerIndex];
  const bucketKey = classifyOddsToBucket(winnerOdds);
  const bucket = bucketStats[bucketKey];
  
  // Calculate adjustment magnitude (1-3%)
  const adjustmentMagnitude = 0.02; // 2% per race
  
  // Adjust weights based on outcome
  let newWeights = { ...currentWeights };
  
  if (predictionCorrect) {
    // Increase weight of signals that contributed to correct prediction
    newWeights.oddsWeight += adjustmentMagnitude * 0.4;
    newWeights.historicalBucketWeight += adjustmentMagnitude * 0.3;
    newWeights.recentBucketWeight += adjustmentMagnitude * 0.2;
    newWeights.consistencyWeight += adjustmentMagnitude * 0.1;
  } else {
    // Decrease weight of signals that led to incorrect prediction
    newWeights.oddsWeight -= adjustmentMagnitude * 0.4;
    newWeights.historicalBucketWeight -= adjustmentMagnitude * 0.3;
    newWeights.recentBucketWeight -= adjustmentMagnitude * 0.2;
    newWeights.consistencyWeight -= adjustmentMagnitude * 0.1;
  }
  
  // Normalize weights to sum to 1.0
  const totalWeight = 
    newWeights.oddsWeight +
    newWeights.historicalBucketWeight +
    newWeights.recentBucketWeight +
    newWeights.consistencyWeight;
  
  newWeights.oddsWeight /= totalWeight;
  newWeights.historicalBucketWeight /= totalWeight;
  newWeights.recentBucketWeight /= totalWeight;
  newWeights.consistencyWeight /= totalWeight;
  
  // Clamp each weight to reasonable bounds (0.05 - 0.7)
  newWeights.oddsWeight = Math.max(0.05, Math.min(0.7, newWeights.oddsWeight));
  newWeights.historicalBucketWeight = Math.max(0.05, Math.min(0.7, newWeights.historicalBucketWeight));
  newWeights.recentBucketWeight = Math.max(0.05, Math.min(0.7, newWeights.recentBucketWeight));
  newWeights.consistencyWeight = Math.max(0.05, Math.min(0.7, newWeights.consistencyWeight));
  
  // Re-normalize after clamping
  const clampedTotal = 
    newWeights.oddsWeight +
    newWeights.historicalBucketWeight +
    newWeights.recentBucketWeight +
    newWeights.consistencyWeight;
  
  return {
    oddsWeight: newWeights.oddsWeight / clampedTotal,
    historicalBucketWeight: newWeights.historicalBucketWeight / clampedTotal,
    recentBucketWeight: newWeights.recentBucketWeight / clampedTotal,
    consistencyWeight: newWeights.consistencyWeight / clampedTotal,
  };
}

/**
 * Calculate confidence-segmented statistics
 */
export function calculateConfidenceStats(races: readonly RaceRecord[]): ConfidenceStats {
  const segments = {
    high: { totalRaces: 0, wins: 0, totalProfit: 0, totalInvested: 0, roi: 0, winRate: 0 },
    medium: { totalRaces: 0, wins: 0, totalProfit: 0, totalInvested: 0, roi: 0, winRate: 0 },
    low: { totalRaces: 0, wins: 0, totalProfit: 0, totalInvested: 0, roi: 0, winRate: 0 },
  };

  for (const race of races) {
    const segment = segments[race.confidenceLevel];
    segment.totalRaces++;
    segment.totalProfit += race.profitLoss;
    // Use betAmount if available, otherwise fall back to recommendedBetSize
    segment.totalInvested += race.betAmount || race.recommendedBetSize;
    
    if (race.actualFirst === race.recommendedContender) {
      segment.wins++;
    }
  }

  // Calculate ROI and win rate for each segment
  for (const key of ['high', 'medium', 'low'] as const) {
    const segment = segments[key];
    segment.roi = segment.totalInvested > 0 ? (segment.totalProfit / segment.totalInvested) * 100 : 0;
    segment.winRate = segment.totalRaces > 0 ? (segment.wins / segment.totalRaces) * 100 : 0;
  }

  return segments;
}

/**
 * Calculate calibration update based on prediction accuracy
 * Anchored to correct implied probability baseline
 */
export function calculateCalibrationUpdate(
  adjustedProbabilities: number[],
  impliedProbabilities: number[],
  actualWinner: number,
  currentScalar: number
): CalibrationUpdate {
  const predictedProb = adjustedProbabilities[actualWinner];
  const impliedProb = impliedProbabilities[actualWinner];
  
  // If predicted probability was too high, decrease scalar
  // If predicted probability was too low, increase scalar
  const error = predictedProb - impliedProb;
  
  // Small adjustment (1-2% per race)
  const adjustment = -error * 0.01;
  const newScalar = Math.max(0.5, Math.min(1.5, currentScalar + adjustment));
  
  const adjustmentApplied = Math.abs(newScalar - currentScalar) > 0.001;
  
  return {
    newCalibrationScalar: newScalar,
    adjustmentApplied,
    reason: adjustmentApplied 
      ? `Adjusted calibration by ${(adjustment * 100).toFixed(2)}% based on prediction accuracy`
      : 'No calibration adjustment needed',
  };
}

/**
 * Detect drift in model performance
 * Compares recent window (last N races) to historical average
 */
export function detectDrift(races: readonly RaceRecord[], windowSize: number = 20): DriftDetectionResult {
  if (races.length < windowSize * 2) {
    return {
      driftDetected: false,
      recentROI: 0,
      historicalROI: 0,
      threshold: 0.15,
    };
  }

  const recentRaces = races.slice(-windowSize);
  const historicalRaces = races.slice(0, -windowSize);

  const recentStats = calculateBettingHistory(recentRaces);
  const historicalStats = calculateBettingHistory(historicalRaces);

  const recentROI = recentStats.cumulativeROI / 100;
  const historicalROI = historicalStats.cumulativeROI / 100;

  // Detect drift if recent ROI is 15% worse than historical
  const threshold = 0.15;
  const driftDetected = (historicalROI - recentROI) > threshold;

  return {
    driftDetected,
    recentROI,
    historicalROI,
    threshold,
  };
}

/**
 * Calculate recent accuracy (win rate) for the last N races
 */
export function calculateRecentAccuracy(races: readonly RaceRecord[], windowSize: number = 10): number {
  if (races.length === 0) return 0;
  
  const recentRaces = races.slice(-windowSize);
  const wins = recentRaces.filter(race => race.actualFirst === race.recommendedContender).length;
  
  return (wins / recentRaces.length) * 100;
}

/**
 * Get the best performing odds bucket based on ROI
 */
export function getBestPerformingBucket(bucketStats: OddsBucketStats): string {
  const buckets = [
    { name: '1-2', roi: bucketStats['1-2'].roiIfFlatBet, totalRaces: bucketStats['1-2'].totalRaces },
    { name: '3-5', roi: bucketStats['3-5'].roiIfFlatBet, totalRaces: bucketStats['3-5'].totalRaces },
    { name: '6-10', roi: bucketStats['6-10'].roiIfFlatBet, totalRaces: bucketStats['6-10'].totalRaces },
    { name: '11-30', roi: bucketStats['11-30'].roiIfFlatBet, totalRaces: bucketStats['11-30'].totalRaces },
  ];
  
  // Filter buckets with at least 5 races
  const validBuckets = buckets.filter(b => b.totalRaces >= 5);
  
  if (validBuckets.length === 0) return 'N/A';
  
  // Find bucket with highest ROI
  const best = validBuckets.reduce((prev, current) => 
    current.roi > prev.roi ? current : prev
  );
  
  return best.name;
}

/**
 * Get the worst performing odds bucket based on ROI
 */
export function getWorstPerformingBucket(bucketStats: OddsBucketStats): string {
  const buckets = [
    { name: '1-2', roi: bucketStats['1-2'].roiIfFlatBet, totalRaces: bucketStats['1-2'].totalRaces },
    { name: '3-5', roi: bucketStats['3-5'].roiIfFlatBet, totalRaces: bucketStats['3-5'].totalRaces },
    { name: '6-10', roi: bucketStats['6-10'].roiIfFlatBet, totalRaces: bucketStats['6-10'].totalRaces },
    { name: '11-30', roi: bucketStats['11-30'].roiIfFlatBet, totalRaces: bucketStats['11-30'].totalRaces },
  ];
  
  // Filter buckets with at least 5 races
  const validBuckets = buckets.filter(b => b.totalRaces >= 5);
  
  if (validBuckets.length === 0) return 'N/A';
  
  // Find bucket with lowest ROI
  const worst = validBuckets.reduce((prev, current) => 
    current.roi < prev.roi ? current : prev
  );
  
  return worst.name;
}
