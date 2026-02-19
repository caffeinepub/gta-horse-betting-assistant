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
  readonly signalBreakdown: readonly SignalData[];
  readonly recommendedContender: number;
  readonly recommendedBetSize: number;
  readonly modelWeightsSnapshot: Readonly<ModelWeights>;
  readonly actualFirst: number;
  readonly actualSecond: number;
  readonly actualThird: number;
  readonly profitLoss: number;
}

export interface SignalData {
  readonly contenderIndex: number;
  readonly signalStrength: number;
  readonly confidence: number;
}

export interface ModelWeights {
  readonly oddsWeight: number;
  readonly formWeight: number;
  readonly trustWeight: number;
}

/**
 * Signal weights for the machine learning model's weighting system
 */
export interface SignalWeights {
  oddsWeight: number;
  historicalBucketWeight: number;
  recentBucketWeight: number;
  consistencyWeight: number;
}

/**
 * Drift detection state for tracking model performance degradation
 */
export interface DriftDetectionState {
  baselineAccuracy: number;
  currentAccuracy: number;
  driftScore: number;
  lastDriftCheck: number;
}

/**
 * Model state with comprehensive signal weights and learning parameters
 */
export interface ModelState {
  lastUpdated: number;
  totalRacesProcessed: number;
  learningRate: number;
  weights: ModelWeights;
  signalWeights: SignalWeights;
  calibrationScalar: number;
  confidenceScalingFactor: number;
  recentAccuracyWindow: number;
  driftDetectionState: DriftDetectionState;
  raceCount: number;
}

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
 * Odds bucket with eight required statistical fields
 * Tracks performance for a specific odds range
 */
export interface OddsBucket {
  totalRaces: number;
  wins: number;
  top3Finishes: number;
  totalImpliedProbability: number;
  actualWinRate: number;
  roiIfFlatBet: number;
  varianceScore: number;
  recentWindowPerformance: number;
}

/**
 * Odds bucket statistics with exactly four bucket ranges
 * Keys: '1-2', '3-5', '6-10', '11-30'
 */
export interface OddsBucketStats {
  '1-2': OddsBucket;
  '3-5': OddsBucket;
  '6-10': OddsBucket;
  '11-30': OddsBucket;
}

/**
 * Input data for creating a new race record
 */
export interface RaceRecordInput {
  odds: number[];
  impliedProbabilities: number[];
  strategyMode: string;
  predictedProbabilities: number[];
  signalBreakdown: SignalData[];
  recommendedContender: number;
  recommendedBetSize: number;
  modelWeightsSnapshot: ModelWeights;
  actualFirst: number;
  actualSecond: number;
  actualThird: number;
  profitLoss: number;
}
