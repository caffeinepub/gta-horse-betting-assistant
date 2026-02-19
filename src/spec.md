# Specification

## Summary
**Goal:** Implement a persistent AsyncStorage data layer with immutable race records as the single source of truth for the GTA Betting Assistant.

**Planned changes:**
- Add AsyncStorage system with four keys: races (immutable race records array), modelState (learning parameters), bettingHistory (aggregated stats), and oddsBucketStats (odds range trust weights)
- Define immutable race record data model with 13 fields including timestamp, odds, predictions, strategy, results, and profit/loss
- Enforce immutability on saved race records using Object.freeze or readonly types
- Implement rebuild functions to recalculate bettingHistory and oddsBucketStats from races array
- Integrate race record persistence into PredictionAndResults component's logging workflow
- Update ROIDashboard to read performance metrics from AsyncStorage instead of backend queries

**User-visible outcome:** Race history, predictions, and performance metrics are now stored locally and persist across sessions. The ROI dashboard displays cumulative statistics calculated from stored race records, and all betting data remains available even offline.
