/**
 * Complete TypeScript type definitions for race betting storage
 * CRITICAL: impliedProbabilities must be calculated using 1/(odds+1)
 */

// Strategy modes
export type StrategyMode = 'safe' | 'balanced' | 'value' | 'aggressive';

// Confidence levels
export type ConfidenceLevel = 'high' | 'medium' | 'low';

// Odds-only input data
export interface OddsOnlyData {
  odds: number[]; // Six odds values (1-30)
}

// Race record input (before storage)
export interface RaceRecordInput {
  odds: number[]; // Six odds values
  impliedProbabilities: number[]; // Six implied probabilities calculated as 1/(odds+1)
  adjustedProbabilities: number[]; // Six adjusted probabilities after model processing
  recommendedContender: number; // Index 0-5
  recommendedBetSize: number; // System-recommended dollar amount
  betAmount: number; // User-selected bet amount (from slider)
  actualFirst: number; // Index 0-5
  actualSecond: number; // Index 0-5
  actualThird: number; // Index 0-5
  profitLoss: number; // Calculated using correct fractional odds payout and user-selected bet amount
  confidenceLevel: ConfidenceLevel;
  strategyMode: StrategyMode;
  timestamp: number;
}

// Race record (stored with ID)
export interface RaceRecord extends RaceRecordInput {
  raceId: string;
}

// Betting history (cumulative)
export interface BettingHistory {
  cumulativeROI: number; // Percentage
  totalRaces: number;
  totalWins: number;
  totalProfit: number; // Dollar amount
  totalInvested: number; // Dollar amount
  winRate: number; // Percentage
  lastUpdated: number;
}

// Odds bucket (single bucket statistics)
export interface OddsBucket {
  totalRaces: number;
  wins: number;
  top3Finishes: number;
  totalImpliedProbability: number; // Sum of all implied probabilities (calculated as 1/(odds+1))
  averageImpliedProbability: number; // Average implied probability (calculated as 1/(odds+1))
  actualWinRate: number; // Percentage
  roiIfFlatBet: number; // Percentage (uses correct fractional odds payout)
  varianceScore: number;
  recentWindowPerformance: number; // Percentage
}

// Odds bucket statistics (all four buckets)
export interface OddsBucketStats {
  '1-2': OddsBucket;
  '3-5': OddsBucket;
  '6-10': OddsBucket;
  '11-30': OddsBucket;
}

// Signal weights for prediction engine
export interface SignalWeights {
  oddsWeight: number; // 0-1
  historicalBucketWeight: number; // 0-1
  recentBucketWeight: number; // 0-1
  consistencyWeight: number; // 0-1
  // Sum must equal 1.0
}

// Drift detection state
export interface DriftDetectionState {
  driftDetected: boolean;
  lastDriftCheck: number;
  consecutiveDriftCount: number;
}

// Model state (learning weights and calibration)
export interface ModelState {
  signalWeights: SignalWeights;
  calibrationScalar: number; // 0.5-1.5
  driftDetectionState: DriftDetectionState;
  lastUpdated: number;
}

// Confidence-segmented statistics
export interface ConfidenceSegment {
  totalRaces: number;
  wins: number;
  totalProfit: number;
  totalInvested: number;
  roi: number; // Percentage
  winRate: number; // Percentage
}

export interface ConfidenceStats {
  high: ConfidenceSegment;
  medium: ConfidenceSegment;
  low: ConfidenceSegment;
}

// Calibration update result
export interface CalibrationUpdate {
  newCalibrationScalar: number;
  adjustmentApplied: boolean;
  reason: string;
}

// Drift detection result
export interface DriftDetectionResult {
  driftDetected: boolean;
  recentROI: number;
  historicalROI: number;
  threshold: number;
}
