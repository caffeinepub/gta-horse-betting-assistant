/**
 * AsyncStorage wrapper for race betting data
 * Provides session tracking, soft/full reset, undo, and data export
 * CRITICAL: Validates and recalculates implied probabilities using 1/(odds+1)
 */

import type { 
  RaceRecord, 
  BettingHistory, 
  OddsBucketStats, 
  ModelState,
  RaceRecordInput,
  SignalWeights,
  DriftDetectionState
} from '../types/storage';
import { 
  calculateBettingHistory, 
  calculateOddsBucketStats, 
  calculateConfidenceStats,
  calculateCalibrationUpdate,
  detectDrift
} from './statsCalculator';
import { deepFreeze } from './immutable';

// Storage keys
const STORAGE_KEYS = {
  RACES: 'gta_races',
  BETTING_HISTORY: 'gta_betting_history',
  ODDS_BUCKET_STATS: 'gta_odds_bucket_stats',
  MODEL_STATE: 'gta_model_state',
  SESSION_START: 'gta_session_start',
} as const;

// Storage change listeners
type StorageListener = () => void;
const storageListeners: StorageListener[] = [];

export function subscribeToStorageChanges(listener: StorageListener): () => void {
  storageListeners.push(listener);
  return () => {
    const index = storageListeners.indexOf(listener);
    if (index > -1) {
      storageListeners.splice(index, 1);
    }
  };
}

export function notifyStorageChange(): void {
  storageListeners.forEach(listener => listener());
}

/**
 * Calculate implied probability using correct fractional odds formula
 * For odds X/1: Implied Probability = 1 / (X + 1)
 */
function calculateImpliedProbability(odds: number): number {
  return 1 / (odds + 1);
}

/**
 * Validate and recalculate implied probabilities if needed
 * Ensures all stored race records use the correct formula
 */
function validateAndFixImpliedProbabilities(race: RaceRecord): RaceRecord {
  const correctedImpliedProbs = race.odds.map(calculateImpliedProbability);
  
  // Check if stored values match correct formula (within small tolerance)
  const needsCorrection = race.impliedProbabilities.some((stored, i) => 
    Math.abs(stored - correctedImpliedProbs[i]) > 0.0001
  );
  
  if (needsCorrection) {
    console.warn('Correcting implied probabilities for race:', race.raceId);
    return {
      ...race,
      impliedProbabilities: correctedImpliedProbs,
    };
  }
  
  return race;
}

// Initialize default model state
function getDefaultModelState(): ModelState {
  return {
    signalWeights: {
      oddsWeight: 0.4,
      historicalBucketWeight: 0.3,
      recentBucketWeight: 0.2,
      consistencyWeight: 0.1,
    },
    calibrationScalar: 1.0,
    driftDetectionState: {
      driftDetected: false,
      lastDriftCheck: Date.now(),
      consecutiveDriftCount: 0,
    },
    lastUpdated: Date.now(),
  };
}

// Get races array
export function getRaces(): RaceRecord[] {
  const stored = localStorage.getItem(STORAGE_KEYS.RACES);
  if (!stored) return [];
  
  try {
    const races = JSON.parse(stored) as RaceRecord[];
    // Validate and fix implied probabilities on read
    return races.map(validateAndFixImpliedProbabilities);
  } catch {
    return [];
  }
}

// Append new race (immutable)
export function appendRace(raceInput: RaceRecordInput): void {
  const races = getRaces();
  
  // Calculate implied probabilities using correct formula
  const impliedProbabilities = raceInput.odds.map(calculateImpliedProbability);
  
  const newRace: RaceRecord = {
    ...raceInput,
    impliedProbabilities, // Ensure correct formula is used
    raceId: `race_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  };
  
  const frozenRace = deepFreeze(newRace);
  const updatedRaces = [...races, frozenRace];
  
  localStorage.setItem(STORAGE_KEYS.RACES, JSON.stringify(updatedRaces));
}

// Get betting history
export function getBettingHistory(): BettingHistory {
  const stored = localStorage.getItem(STORAGE_KEYS.BETTING_HISTORY);
  if (!stored) {
    const races = getRaces();
    return calculateBettingHistory(races);
  }
  
  try {
    return JSON.parse(stored) as BettingHistory;
  } catch {
    const races = getRaces();
    return calculateBettingHistory(races);
  }
}

// Get odds bucket stats
export function getOddsBucketStats(): OddsBucketStats {
  const stored = localStorage.getItem(STORAGE_KEYS.ODDS_BUCKET_STATS);
  if (!stored) {
    const races = getRaces();
    return calculateOddsBucketStats(races);
  }
  
  try {
    return JSON.parse(stored) as OddsBucketStats;
  } catch {
    const races = getRaces();
    return calculateOddsBucketStats(races);
  }
}

// Get model state
export function getModelState(): ModelState {
  const stored = localStorage.getItem(STORAGE_KEYS.MODEL_STATE);
  if (!stored) {
    return getDefaultModelState();
  }
  
  try {
    return JSON.parse(stored) as ModelState;
  } catch {
    return getDefaultModelState();
  }
}

// Update model state
export function updateModelState(updates: Partial<ModelState>): void {
  const current = getModelState();
  const updated = {
    ...current,
    ...updates,
    lastUpdated: Date.now(),
  };
  
  localStorage.setItem(STORAGE_KEYS.MODEL_STATE, JSON.stringify(updated));
}

/**
 * Rebuild all derived statistics from races array
 * Recalculates implied probabilities using correct formula if needed
 */
export function rebuildDerivedStats(): void {
  const races = getRaces();
  
  // Validate and fix all implied probabilities
  const correctedRaces = races.map(validateAndFixImpliedProbabilities);
  
  // Save corrected races if any were fixed
  const needsSave = races.some((race, i) => 
    race.impliedProbabilities !== correctedRaces[i].impliedProbabilities
  );
  
  if (needsSave) {
    localStorage.setItem(STORAGE_KEYS.RACES, JSON.stringify(correctedRaces));
  }
  
  // Recalculate all derived statistics using corrected data
  const bettingHistory = calculateBettingHistory(correctedRaces);
  const bucketStats = calculateOddsBucketStats(correctedRaces);
  
  localStorage.setItem(STORAGE_KEYS.BETTING_HISTORY, JSON.stringify(bettingHistory));
  localStorage.setItem(STORAGE_KEYS.ODDS_BUCKET_STATS, JSON.stringify(bucketStats));
  
  // Update calibration if we have races
  if (correctedRaces.length > 0) {
    const lastRace = correctedRaces[correctedRaces.length - 1];
    const modelState = getModelState();
    
    const calibrationUpdate = calculateCalibrationUpdate(
      lastRace.adjustedProbabilities,
      lastRace.impliedProbabilities,
      lastRace.actualFirst,
      modelState.calibrationScalar
    );
    
    if (calibrationUpdate.adjustmentApplied) {
      updateModelState({
        calibrationScalar: calibrationUpdate.newCalibrationScalar,
      });
    }
  }
  
  // Detect drift every 20 races
  if (correctedRaces.length > 0 && correctedRaces.length % 20 === 0) {
    const driftResult = detectDrift(correctedRaces, 20);
    const modelState = getModelState();
    
    updateModelState({
      driftDetectionState: {
        driftDetected: driftResult.driftDetected,
        lastDriftCheck: Date.now(),
        consecutiveDriftCount: driftResult.driftDetected 
          ? (modelState.driftDetectionState?.consecutiveDriftCount || 0) + 1
          : 0,
      },
    });
  }
}

// Session tracking
export function getSessionStart(): number {
  const stored = localStorage.getItem(STORAGE_KEYS.SESSION_START);
  if (!stored) {
    const now = Date.now();
    setSessionStart(now);
    return now;
  }
  return parseInt(stored, 10);
}

export function setSessionStart(timestamp: number): void {
  localStorage.setItem(STORAGE_KEYS.SESSION_START, timestamp.toString());
}

export function getSessionStats(): BettingHistory {
  const sessionStart = getSessionStart();
  const allRaces = getRaces();
  const sessionRaces = allRaces.filter(race => race.timestamp >= sessionStart);
  
  return calculateBettingHistory(sessionRaces);
}

// Soft reset (session only)
export function softReset(): void {
  setSessionStart(Date.now());
  notifyStorageChange();
}

// Full reset (destructive)
export function fullReset(): void {
  localStorage.removeItem(STORAGE_KEYS.RACES);
  localStorage.removeItem(STORAGE_KEYS.BETTING_HISTORY);
  localStorage.removeItem(STORAGE_KEYS.ODDS_BUCKET_STATS);
  localStorage.removeItem(STORAGE_KEYS.MODEL_STATE);
  setSessionStart(Date.now());
  notifyStorageChange();
}

// Undo last race
export function undoLastRace(): boolean {
  const races = getRaces();
  if (races.length === 0) return false;
  
  const updatedRaces = races.slice(0, -1);
  localStorage.setItem(STORAGE_KEYS.RACES, JSON.stringify(updatedRaces));
  
  rebuildDerivedStats();
  notifyStorageChange();
  
  return true;
}

// Export all data
export function exportAllData(): string {
  const data = {
    races: getRaces(),
    bettingHistory: getBettingHistory(),
    oddsBucketStats: getOddsBucketStats(),
    modelState: getModelState(),
    sessionStart: getSessionStart(),
    exportedAt: Date.now(),
  };
  
  return JSON.stringify(data, null, 2);
}
