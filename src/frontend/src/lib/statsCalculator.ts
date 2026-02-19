/**
 * Pure functions for calculating derived statistics from race records
 * Implements odds bucket-based learning with four defined ranges and five-step prediction engine
 */

import type { RaceRecord, BettingHistory, OddsBucketStats, OddsBucket, ModelState, SignalWeights, ConfidenceStats } from '../types/storage';

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
 * Calculate Bucket Win Delta: actualWinRate - averageImpliedProbability
 * Returns the delta as a decimal (e.g., 5% difference = 0.05)
 */
export function calculateBucketWinDelta(bucket: OddsBucket): number {
  // Convert actualWinRate from percentage to decimal and subtract averageImpliedProbability (already in decimal)
  return (bucket.actualWinRate / 100) - bucket.averageImpliedProbability;
}

/**
 * Extract Recent Session Delta from recentWindowPerformance
 * Handles both number and object types, returns numeric delta value
 */
export function extractRecentSessionDelta(bucket: OddsBucket): number {
  const recentPerf = bucket.recentWindowPerformance;
  
  // If it's a number, convert from percentage to decimal
  if (typeof recentPerf === 'number') {
    return recentPerf / 100;
  }
  
  // If it's an object with a delta property, use that
  if (typeof recentPerf === 'object' && recentPerf !== null && 'delta' in recentPerf) {
    return (recentPerf as any).delta;
  }
  
  // Default to 0 if we can't extract a value
  return 0;
}

/**
 * Derive Consistency Modifier from varianceScore
 * Lower variance = more consistent = positive modifier
 * Higher variance = less consistent = negative modifier
 */
export function deriveConsistencyModifier(bucket: OddsBucket): number {
  const variance = bucket.varianceScore;
  
  // Normalize variance to a modifier between -0.1 and +0.1
  // Lower variance (< 0.5) gives positive modifier
  // Higher variance (> 0.5) gives negative modifier
  if (variance < 0.5) {
    return 0.1 * (1 - variance / 0.5);
  } else {
    return -0.1 * Math.min(1, (variance - 0.5) / 0.5);
  }
}

/**
 * Signal breakdown for a single contender
 */
export interface SignalBreakdown {
  oddsSignal: number;
  historicalBucketSignal: number;
  recentBucketSignal: number;
  consistencySignal: number;
}

/**
 * Five-step prediction engine implementing bucket-adjusted probability calculation
 * Now returns both adjusted probabilities and signal breakdown for the recommended contender
 * 
 * Step 1: Compute implied probabilities from odds (1/odds for each contender)
 * Step 2: Assign each contender to an odds bucket (1-2, 3-5, 6-10, 11-30)
 * Step 3: Retrieve bucket statistics (Bucket Win Delta, Recent Session Delta, Consistency Modifier)
 * Step 4: Calculate adjusted probability using multiplicative formula with weighted signals
 * Step 5: Normalize probabilities to sum to exactly 100%
 * 
 * @param odds - Array of six odds values
 * @param bucketStats - Odds bucket statistics from storage
 * @param signalWeights - Signal weights from modelState
 * @returns Array of six normalized probabilities that sum to 1.0 (100%)
 */
export function calculateBucketAdjustedProbabilities(
  odds: number[],
  bucketStats: OddsBucketStats,
  signalWeights: SignalWeights
): number[] {
  // Step 1: Compute implied probabilities from odds
  const impliedProbabilities = odds.map(o => 1 / o);
  
  // Step 2 & 3 & 4: Assign to buckets, retrieve stats, and calculate adjusted probabilities
  const adjustedProbabilities = odds.map((oddsValue, index) => {
    const impliedProb = impliedProbabilities[index];
    
    // Step 2: Assign to bucket
    const bucketKey = classifyOddsToBucket(oddsValue);
    const bucket = bucketStats[bucketKey];
    
    // Step 3: Retrieve bucket statistics
    const bucketWinDelta = calculateBucketWinDelta(bucket);
    const recentSessionDelta = extractRecentSessionDelta(bucket);
    const consistencyModifier = deriveConsistencyModifier(bucket);
    
    // Step 4: Calculate adjusted probability
    // Formula: Adjusted = Implied × (1 + historicalWeight × BucketWinDelta + recentWeight × RecentDelta + consistencyWeight × ConsistencyModifier)
    const adjustment = 1 + 
      (signalWeights.historicalBucketWeight * bucketWinDelta) +
      (signalWeights.recentBucketWeight * recentSessionDelta) +
      (signalWeights.consistencyWeight * consistencyModifier);
    
    // Ensure adjustment doesn't go negative
    const safeAdjustment = Math.max(0.1, adjustment);
    
    return impliedProb * safeAdjustment;
  });
  
  // Step 5: Normalize probabilities to sum to exactly 1.0 (100%)
  const total = adjustedProbabilities.reduce((sum, prob) => sum + prob, 0);
  const normalizedProbabilities = adjustedProbabilities.map(prob => prob / total);
  
  return normalizedProbabilities;
}

/**
 * Calculate signal breakdown for a specific contender
 * Returns the individual signal contributions used in the prediction
 */
export function calculateSignalBreakdownForContender(
  contenderIndex: number,
  odds: number[],
  bucketStats: OddsBucketStats,
  signalWeights: SignalWeights
): SignalBreakdown {
  const oddsValue = odds[contenderIndex];
  const impliedProb = 1 / oddsValue;
  
  // Assign to bucket
  const bucketKey = classifyOddsToBucket(oddsValue);
  const bucket = bucketStats[bucketKey];
  
  // Retrieve bucket statistics
  const bucketWinDelta = calculateBucketWinDelta(bucket);
  const recentSessionDelta = extractRecentSessionDelta(bucket);
  const consistencyModifier = deriveConsistencyModifier(bucket);
  
  return {
    oddsSignal: impliedProb,
    historicalBucketSignal: signalWeights.historicalBucketWeight * bucketWinDelta,
    recentBucketSignal: signalWeights.recentBucketWeight * recentSessionDelta,
    consistencySignal: signalWeights.consistencyWeight * consistencyModifier,
  };
}

/**
 * Calculate Value Edge for each contender
 * Value Edge = Adjusted Probability - Implied Probability
 * Positive value edge indicates profitable betting opportunity
 */
export function calculateValueEdge(
  adjustedProbabilities: number[],
  impliedProbabilities: number[]
): number[] {
  return adjustedProbabilities.map((adjusted, index) => adjusted - impliedProbabilities[index]);
}

/**
 * Calculate confidence level based on four factors:
 * 1. Bucket sample size (totalRaces)
 * 2. Variance score
 * 3. Recent model accuracy
 * 4. Calibration health (calibrationScalar)
 * 
 * Thresholds:
 * - High: Sample size >= 50, variance < 0.4, accuracy >= 55%, calibration >= 0.95
 * - Medium: Sample size >= 20, variance < 0.6, accuracy >= 45%, calibration >= 0.85
 * - Low: Everything else
 */
export function calculateConfidence(
  odds: number[],
  bucketStats: OddsBucketStats,
  modelState: ModelState
): 'high' | 'medium' | 'low' {
  // Get bucket for the recommended contender (highest adjusted probability)
  const bucketKeys = odds.map(o => classifyOddsToBucket(o));
  
  // Calculate average metrics across all buckets involved
  let totalSampleSize = 0;
  let totalVariance = 0;
  let count = 0;
  
  for (const bucketKey of bucketKeys) {
    const bucket = bucketStats[bucketKey];
    totalSampleSize += bucket.totalRaces;
    totalVariance += bucket.varianceScore;
    count++;
  }
  
  const avgSampleSize = totalSampleSize / count;
  const avgVariance = totalVariance / count;
  const recentAccuracy = modelState.driftDetectionState.currentAccuracy;
  const calibration = modelState.calibrationScalar;
  
  // High confidence thresholds
  if (
    avgSampleSize >= 50 &&
    avgVariance < 0.4 &&
    recentAccuracy >= 55 &&
    calibration >= 0.95
  ) {
    return 'high';
  }
  
  // Medium confidence thresholds
  if (
    avgSampleSize >= 20 &&
    avgVariance < 0.6 &&
    recentAccuracy >= 45 &&
    calibration >= 0.85
  ) {
    return 'medium';
  }
  
  // Low confidence
  return 'low';
}

/**
 * Strategy recommendation result
 */
export interface StrategyRecommendation {
  shouldSkip: boolean;
  recommendedIndex: number;
  reason: string;
}

/**
 * Implement four-mode strategy selection algorithm
 * 
 * Safe: Pick highest Adjusted Probability
 * Balanced: Maximize blend of Adjusted Probability and Value Edge
 * Value: Pick highest positive Value Edge above threshold
 * Aggressive: Favor high-odds buckets (6-10, 11-30) with strong positive Value Edge
 * 
 * Returns SKIP recommendation when no contender meets minimum edge criteria
 */
export function getStrategyRecommendation(
  strategyMode: string,
  odds: number[],
  adjustedProbabilities: number[],
  valueEdge: number[]
): StrategyRecommendation {
  const minEdgeThreshold = 0.02; // 2% minimum edge for Value/Aggressive modes
  
  switch (strategyMode) {
    case 'Safe': {
      // Pick highest adjusted probability
      const maxIndex = adjustedProbabilities.indexOf(Math.max(...adjustedProbabilities));
      return {
        shouldSkip: false,
        recommendedIndex: maxIndex,
        reason: 'Highest adjusted probability',
      };
    }
    
    case 'Balanced': {
      // Maximize blend of adjusted probability (70%) and value edge (30%)
      const scores = adjustedProbabilities.map((prob, i) => {
        const normalizedEdge = Math.max(0, valueEdge[i]); // Only consider positive edge
        return (prob * 0.7) + (normalizedEdge * 0.3);
      });
      const maxIndex = scores.indexOf(Math.max(...scores));
      
      // Skip if no meaningful positive edge exists
      const hasPositiveEdge = valueEdge.some(edge => edge > minEdgeThreshold);
      if (!hasPositiveEdge) {
        return {
          shouldSkip: true,
          recommendedIndex: -1,
          reason: 'No meaningful positive edge detected',
        };
      }
      
      return {
        shouldSkip: false,
        recommendedIndex: maxIndex,
        reason: 'Best blend of probability and value',
      };
    }
    
    case 'Value': {
      // Pick highest positive value edge above threshold
      const maxEdge = Math.max(...valueEdge);
      
      if (maxEdge < minEdgeThreshold) {
        return {
          shouldSkip: true,
          recommendedIndex: -1,
          reason: 'No value edge above threshold',
        };
      }
      
      const maxIndex = valueEdge.indexOf(maxEdge);
      return {
        shouldSkip: false,
        recommendedIndex: maxIndex,
        reason: 'Highest positive value edge',
      };
    }
    
    case 'Aggressive': {
      // Favor high-odds buckets (6-10, 11-30) with strong positive value edge
      const highOddsIndices = odds
        .map((o, i) => ({ odds: o, index: i, edge: valueEdge[i] }))
        .filter(item => item.odds > 5.0 && item.edge > minEdgeThreshold);
      
      if (highOddsIndices.length === 0) {
        return {
          shouldSkip: true,
          recommendedIndex: -1,
          reason: 'No high-odds contenders with positive edge',
        };
      }
      
      // Pick the one with highest value edge among high-odds contenders
      const best = highOddsIndices.reduce((max, item) => 
        item.edge > max.edge ? item : max
      );
      
      return {
        shouldSkip: false,
        recommendedIndex: best.index,
        reason: 'High-odds contender with strong value edge',
      };
    }
    
    default:
      // Fallback to Safe mode
      const maxIndex = adjustedProbabilities.indexOf(Math.max(...adjustedProbabilities));
      return {
        shouldSkip: false,
        recommendedIndex: maxIndex,
        reason: 'Highest adjusted probability (default)',
      };
  }
}

/**
 * Calculate recommended bet size based on value edge and confidence level
 * 
 * Bet sizing formula:
 * - Base bet: $1,000
 * - Value edge multiplier: 1 + (valueEdge * 10) capped at 2x
 * - Confidence multiplier: High = 1.5x, Medium = 1.0x, Low = 0.5x
 * - Final bet size rounded to nearest $1,000, capped between $1,000 and $10,000
 */
export function calculateBetSize(
  valueEdge: number,
  confidenceLevel: 'high' | 'medium' | 'low',
  modelState: ModelState
): number {
  const baseBet = 1000;
  
  // Value edge multiplier (positive edge increases bet size)
  const edgeMultiplier = Math.min(2.0, 1 + (Math.max(0, valueEdge) * 10));
  
  // Confidence multiplier
  const confidenceMultiplier = {
    high: 1.5,
    medium: 1.0,
    low: 0.5,
  }[confidenceLevel];
  
  // Calculate raw bet size
  const rawBetSize = baseBet * edgeMultiplier * confidenceMultiplier;
  
  // Round to nearest $1,000 and cap between $1,000 and $10,000
  const roundedBetSize = Math.round(rawBetSize / 1000) * 1000;
  const cappedBetSize = Math.max(1000, Math.min(10000, roundedBetSize));
  
  return cappedBetSize;
}

/**
 * Calculate confidence-segmented statistics from race records
 * Groups races by confidence level and calculates performance metrics for each tier
 */
export function calculateConfidenceStats(races: readonly RaceRecord[]): ConfidenceStats {
  const stats: ConfidenceStats = {
    high: { totalRaces: 0, wins: 0, winRate: 0, totalProfit: 0, totalInvested: 0, roi: 0 },
    medium: { totalRaces: 0, wins: 0, winRate: 0, totalProfit: 0, totalInvested: 0, roi: 0 },
    low: { totalRaces: 0, wins: 0, winRate: 0, totalProfit: 0, totalInvested: 0, roi: 0 },
  };

  for (const race of races) {
    const tier = stats[race.confidenceLevel];
    
    tier.totalRaces++;
    tier.totalProfit += race.profitLoss;
    tier.totalInvested += race.recommendedBetSize;
    
    if (race.actualFirst === race.recommendedContender) {
      tier.wins++;
    }
  }

  // Calculate derived metrics
  for (const level of ['high', 'medium', 'low'] as const) {
    const tier = stats[level];
    tier.winRate = tier.totalRaces > 0 ? (tier.wins / tier.totalRaces) * 100 : 0;
    tier.roi = tier.totalInvested > 0 ? (tier.totalProfit / tier.totalInvested) * 100 : 0;
  }

  return stats;
}

/**
 * Identify hot and trap odds buckets based on recent performance
 * Hot bucket: Best recent performance (highest recentWindowPerformance)
 * Trap bucket: Worst recent performance or highest variance
 */
export function identifyHotAndTrapBuckets(bucketStats: OddsBucketStats): {
  hotBucket: '1-2' | '3-5' | '6-10' | '11-30' | null;
  trapBucket: '1-2' | '3-5' | '6-10' | '11-30' | null;
} {
  const bucketKeys: Array<'1-2' | '3-5' | '6-10' | '11-30'> = ['1-2', '3-5', '6-10', '11-30'];
  
  // Filter buckets with sufficient data (at least 10 races)
  const validBuckets = bucketKeys.filter(key => bucketStats[key].totalRaces >= 10);
  
  if (validBuckets.length === 0) {
    return { hotBucket: null, trapBucket: null };
  }
  
  // Find hot bucket (highest recent performance)
  let hotBucket = validBuckets[0];
  let maxRecentPerf = bucketStats[hotBucket].recentWindowPerformance;
  
  for (const key of validBuckets) {
    const recentPerf = bucketStats[key].recentWindowPerformance;
    if (recentPerf > maxRecentPerf) {
      maxRecentPerf = recentPerf;
      hotBucket = key;
    }
  }
  
  // Find trap bucket (worst recent performance or highest variance)
  let trapBucket = validBuckets[0];
  let minScore = bucketStats[trapBucket].recentWindowPerformance - (bucketStats[trapBucket].varianceScore * 10);
  
  for (const key of validBuckets) {
    const score = bucketStats[key].recentWindowPerformance - (bucketStats[key].varianceScore * 10);
    if (score < minScore) {
      minScore = score;
      trapBucket = key;
    }
  }
  
  return { hotBucket, trapBucket };
}
