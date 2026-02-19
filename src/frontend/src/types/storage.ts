/**
 * TypeScript interfaces for AsyncStorage data structures
 * Defines the complete data model for persistent race tracking with odds bucket learning
 */

export enum StorageKeys {
  RACES = 'races',
  MODEL_STATE = 'modelState',
  BETTING_HISTORY = 'bettingHistory',
  ODDS_BUCKET_STATS = 'oddsBucketStats',
}

/**
 * Immutable race record - all fields are readonly
 * This record is frozen after creation and cannot be modified
 */
export interface RaceRecord {
  readonly timestamp: number;
  readonly odds: readonly number[];
  readonly impliedProbabilities: readonly number[];
  readonly strategyMode: string;
  readonly predictedProbabilities: readonly number[];
  readonly valueEdge: readonly number[];
  readonly confidenceLevel: 'high' | 'medium' | 'low';
  readonly signalBreakdown: readonly SignalData[];
  readonly recommendedContender: number;
  readonly recommendedBetSize: number;
  readonly modelWeightsSnapshot: ModelWeights;
  readonly actualFirst: number;
  readonly actualSecond: number;
  readonly actualThird: number;
  readonly profitLoss: number;
}

/**
 * Input type for creating a new race record
 * Used before freezing the record
 */
export interface RaceRecordInput {
  odds: number[];
  impliedProbabilities: number[];
  strategyMode: string;
  predictedProbabilities: number[];
  valueEdge: number[];
  confidenceLevel: 'high' | 'medium' | 'low';
  signalBreakdown: SignalData[];
  recommendedContender: number;
  recommendedBetSize: number;
  modelWeightsSnapshot: ModelWeights;
  actualFirst: number;
  actualSecond: number;
  actualThird: number;
  profitLoss: number;
}

/**
 * Signal data for a single contender
 */
export interface SignalData {
  contenderIndex: number;
  signalStrength: number;
  confidence: number;
}

/**
 * Model weights snapshot at time of prediction
 */
export interface ModelWeights {
  oddsWeight: number;
  formWeight: number;
  trustWeight: number;
}

/**
 * Cumulative betting history statistics
 */
export interface BettingHistory {
  cumulativeROI: number;
  totalRaces: number;
  totalWins: number;
  totalProfit: number;
  totalInvested: number;
  winRate: number;
  lastUpdated: number;
}

/**
 * Statistics for a single odds bucket
 * Nine required fields including averageImpliedProbability
 */
export interface OddsBucket {
  totalRaces: number;
  wins: number;
  top3Finishes: number;
  totalImpliedProbability: number;
  averageImpliedProbability: number;
  actualWinRate: number;
  roiIfFlatBet: number;
  varianceScore: number;
  recentWindowPerformance: number;
}

/**
 * Statistics for all four odds buckets
 */
export interface OddsBucketStats {
  '1-2': OddsBucket;
  '3-5': OddsBucket;
  '6-10': OddsBucket;
  '11-30': OddsBucket;
}

/**
 * Signal weights for the prediction model
 */
export interface SignalWeights {
  oddsWeight: number;
  historicalBucketWeight: number;
  recentBucketWeight: number;
  consistencyWeight: number;
}

/**
 * Drift detection state
 */
export interface DriftDetectionState {
  baselineAccuracy: number;
  currentAccuracy: number;
  driftScore: number;
  lastDriftCheck: number;
}

/**
 * Complete model state
 */
export interface ModelState {
  lastUpdated: number;
  totalRacesProcessed: number;
  signalWeights: SignalWeights;
  calibrationScalar: number;
  confidenceScalingFactor: number;
  recentAccuracyWindow: number;
  driftDetectionState: DriftDetectionState;
  raceCount: number;
}

/**
 * Confidence-segmented statistics
 */
export interface ConfidenceStats {
  high: {
    totalRaces: number;
    wins: number;
    winRate: number;
    totalProfit: number;
    totalInvested: number;
    roi: number;
  };
  medium: {
    totalRaces: number;
    wins: number;
    winRate: number;
    totalProfit: number;
    totalInvested: number;
    roi: number;
  };
  low: {
    totalRaces: number;
    wins: number;
    winRate: number;
    totalProfit: number;
    totalInvested: number;
    roi: number;
  };
}
