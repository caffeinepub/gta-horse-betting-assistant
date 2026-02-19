# Specification

## Summary
**Goal:** Redesign the Prediction Screen to display odds/probabilities, recommended bet details, and signal breakdown in a clear three-section layout.

**Planned changes:**
- Display Strategy Mode at the top with all six odds values and their calculated implied probabilities
- Create a Primary Panel showing the recommended "BEST BET: #X" with Predicted Probability, Implied Probability, Value Edge, Confidence Level, and Recommended Bet
- Create a Secondary Panel displaying a Signal Breakdown with four components: Odds Signal, Historical Bucket Signal, Recent Bucket Signal, and Consistency Signal
- Add optional "Hot Odds Bucket" and "Trap Odds Bucket" indicators based on recent performance
- Update statsCalculator.ts to expose individual signal components as separate numeric values
- Restructure PredictionAndResults component into three distinct visual sections with clear hierarchy

**User-visible outcome:** Users see a redesigned prediction screen with Strategy Mode and all odds/probabilities at the top, a prominent "BEST BET" panel with detailed recommendation metrics, and a secondary panel breaking down the four prediction signals that contribute to the recommendation, plus optional hot/trap bucket indicators.
