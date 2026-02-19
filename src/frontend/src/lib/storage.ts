/**
 * AsyncStorage wrapper for browser localStorage
 * Provides typed read/write operations with error handling and odds bucket statistics
 */

import { StorageKeys } from '../types/storage';
import type {
  RaceRecord,
  RaceRecordInput,
  ModelState,
  BettingHistory,
  OddsBucketStats,
} from '../types/storage';
import { deepFreeze } from './immutable';
import { calculateBettingHistory, calculateOddsBucketStats } from './statsCalculator';

/**
 * Storage error types
 */
export class StorageError extends Error {
  constructor(message: string, public readonly key?: string) {
    super(message);
    this.name = 'StorageError';
  }
}

export class StorageQuotaError extends StorageError {
  constructor(key?: string) {
    super('Storage quota exceeded', key);
    this.name = 'StorageQuotaError';
  }
}

export class StorageCorruptionError extends StorageError {
  constructor(key?: string) {
    super('Storage data corrupted', key);
    this.name = 'StorageCorruptionError';
  }
}

/**
 * Read data from localStorage with error handling
 */
function readFromStorage<T>(key: StorageKeys): T | null {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;

    const parsed = JSON.parse(item);
    return parsed as T;
  } catch (error) {
    console.error(`Failed to read ${key} from storage:`, error);
    throw new StorageCorruptionError(key);
  }
}

/**
 * Write data to localStorage with error handling
 */
function writeToStorage<T>(key: StorageKeys, data: T): void {
  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem(key, serialized);
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      throw new StorageQuotaError(key);
    }
    console.error(`Failed to write ${key} to storage:`, error);
    throw new StorageError(`Failed to write ${key}`, key);
  }
}

/**
 * Create an immutable race record from input data
 * Returns a deeply frozen object that cannot be modified
 */
export function createRaceRecord(input: RaceRecordInput): RaceRecord {
  const record: RaceRecord = {
    timestamp: Date.now(),
    odds: [...input.odds],
    impliedProbabilities: [...input.impliedProbabilities],
    strategyMode: input.strategyMode,
    predictedProbabilities: [...input.predictedProbabilities],
    valueEdge: [...input.valueEdge],
    confidenceLevel: input.confidenceLevel,
    signalBreakdown: input.signalBreakdown.map(s => ({ ...s })),
    recommendedContender: input.recommendedContender,
    recommendedBetSize: input.recommendedBetSize,
    modelWeightsSnapshot: { ...input.modelWeightsSnapshot },
    actualFirst: input.actualFirst,
    actualSecond: input.actualSecond,
    actualThird: input.actualThird,
    profitLoss: input.profitLoss,
  };

  // Deep freeze to enforce immutability
  return deepFreeze(record);
}

/**
 * Read races array from storage
 */
export function getRaces(): readonly RaceRecord[] {
  const races = readFromStorage<RaceRecord[]>(StorageKeys.RACES);
  return races || [];
}

/**
 * Append a new race record to storage
 * Race records are immutable and append-only
 */
export function appendRace(raceInput: RaceRecordInput): void {
  const existingRaces = getRaces();
  const newRace = createRaceRecord(raceInput);
  
  // Append to array (never modify existing records)
  const updatedRaces = [...existingRaces, newRace];
  writeToStorage(StorageKeys.RACES, updatedRaces);
}

/**
 * Read model state from storage with default initialization
 */
export function readModelState(): ModelState {
  const stored = readFromStorage<ModelState>(StorageKeys.MODEL_STATE);
  
  if (stored) {
    return stored;
  }

  // Initialize with sensible default values
  const defaultState: ModelState = {
    lastUpdated: Date.now(),
    totalRacesProcessed: 0,
    signalWeights: {
      oddsWeight: 0.35,
      historicalBucketWeight: 0.25,
      recentBucketWeight: 0.25,
      consistencyWeight: 0.15,
    },
    calibrationScalar: 1.0,
    confidenceScalingFactor: 1.0,
    recentAccuracyWindow: 20,
    driftDetectionState: {
      baselineAccuracy: 0,
      currentAccuracy: 0,
      driftScore: 0,
      lastDriftCheck: Date.now(),
    },
    raceCount: 0,
  };

  return deepFreeze(defaultState);
}

/**
 * Write model state to storage with immutability enforcement
 */
export function writeModelState(state: ModelState): boolean {
  try {
    const frozen = deepFreeze({ ...state });
    writeToStorage(StorageKeys.MODEL_STATE, frozen);
    notifyStorageChange();
    return true;
  } catch (error) {
    console.error('Failed to write model state:', error);
    return false;
  }
}

/**
 * Read model state from storage (legacy compatibility)
 */
export function getModelState(): ModelState | null {
  return readFromStorage<ModelState>(StorageKeys.MODEL_STATE);
}

/**
 * Write model state to storage (legacy compatibility)
 */
export function setModelState(state: ModelState): void {
  writeToStorage(StorageKeys.MODEL_STATE, state);
}

/**
 * Read betting history from storage
 */
export function getBettingHistory(): BettingHistory | null {
  return readFromStorage<BettingHistory>(StorageKeys.BETTING_HISTORY);
}

/**
 * Write betting history to storage
 */
export function setBettingHistory(history: BettingHistory): void {
  writeToStorage(StorageKeys.BETTING_HISTORY, history);
}

/**
 * Read odds bucket stats from storage
 */
export function getOddsBucketStats(): OddsBucketStats | null {
  return readFromStorage<OddsBucketStats>(StorageKeys.ODDS_BUCKET_STATS);
}

/**
 * Write odds bucket stats to storage
 */
export function setOddsBucketStats(stats: OddsBucketStats): void {
  const frozen = deepFreeze(stats);
  writeToStorage(StorageKeys.ODDS_BUCKET_STATS, frozen);
}

/**
 * Rebuild derived statistics from races array
 * This is the recovery mechanism for data corruption
 */
export function rebuildDerivedStats(): void {
  const races = getRaces();
  
  // Recalculate betting history
  const bettingHistory = calculateBettingHistory(races);
  setBettingHistory(bettingHistory);
  
  // Recalculate odds bucket stats
  const oddsBucketStats = calculateOddsBucketStats(races);
  setOddsBucketStats(oddsBucketStats);
}

/**
 * Update derived stats after a new race is logged
 */
export function updateDerivedStats(): void {
  rebuildDerivedStats();
}

/**
 * Clear all storage (for testing/reset)
 */
export function clearAllStorage(): void {
  Object.values(StorageKeys).forEach(key => {
    localStorage.removeItem(key);
  });
}

/**
 * Storage event emitter for real-time updates
 */
type StorageListener = () => void;
const listeners = new Set<StorageListener>();

export function subscribeToStorageChanges(listener: StorageListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyStorageChange(): void {
  listeners.forEach(listener => listener());
}
