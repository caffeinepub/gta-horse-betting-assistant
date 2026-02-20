# Specification

## Summary
**Goal:** Fix odds input auto-advance behavior to allow two-digit entry and implement Enter key navigation.

**Planned changes:**
- Remove single-character auto-advance logic from OddsEntryForm component
- Implement Enter key handler to advance focus between odds input fields
- Update validation to trigger on blur or submit instead of per-character input
- Ensure manual focus navigation (click, tap, Tab) continues to work normally
- Maintain real-time implied probability display without disrupting input

**User-visible outcome:** Users can type two-digit odds values (like "10", "20", "30") without the cursor automatically jumping to the next field. Focus advances to the next field only when the user presses Enter, or users can manually click/tap any field. Validation errors appear only after leaving a field or attempting to submit.
