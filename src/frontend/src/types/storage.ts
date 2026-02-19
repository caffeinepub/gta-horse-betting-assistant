/**
 * TypeScript interfaces for AsyncStorage data structures
 * Defines the complete data model for persistent race tracking
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

export interface ModelState {
  lastUpdated: number;
  totalRacesProcessed: number;
  learningRate: number;
  weights: ModelWeights;
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

export interface OddsBucket {
  min: number;
  max: number;
}

export interface OddsBucketStats {
  buckets: Map<string, BucketTrustData>;
  lastUpdated: number;
}

export interface BucketTrustData {
  range: OddsBucket;
  trustWeight: number;
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
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
