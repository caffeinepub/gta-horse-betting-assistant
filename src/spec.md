# Specification

## Summary
**Goal:** Define comprehensive modelState storage schema with signal weights and learning parameters to support future adaptive prediction logic.

**Planned changes:**
- Expand ModelState interface in frontend/src/types/storage.ts to include signalWeights object with oddsWeight, historicalBucketWeight, recentBucketWeight, and consistencyWeight fields
- Add calibrationScalar, confidenceScalingFactor, recentAccuracyWindow, driftDetectionState, and raceCount fields to ModelState interface
- Update AsyncStorage implementation in frontend/src/lib/storage.ts to initialize modelState with default values for all new fields when no existing state is found
- Add writeModelState function to frontend/src/lib/storage.ts that persists ModelState to localStorage with immutability enforcement and triggers change listeners
- Add functions to frontend/src/lib/statsCalculator.ts that compute updated signal weights and calibration parameters from race records, returning updated ModelState

**User-visible outcome:** The application now has a complete storage foundation for machine learning parameters that will enable adaptive horse betting predictions in future iterations. No immediate UI changes are visible to users.
