# Yellow Rose BBQ - Coding Standards & Review Guidelines

Reviewer agents must check PRs and diffs against these standards.

## 1. Kitchen-Line Ergonomics & UI Standards
- **High-Contrast Readability**: UI must maintain high contrast suitable for harsh kitchen lighting and glare.
- **Large Tap Targets**: Interactive buttons and presets must maintain a minimum 48px touch target for elbow-tap interaction during meat production.
- **Single-Page Simplicity**: Avoid multi-page transitions or modals that trap focus; prefer in-place tab switches and card toggles.

## 2. Chart & Analytics Lifecycle
- **Defensive Container Availability**: Before invoking D3 or Plotly rendering functions, verify the container exists in the DOM and is in the active subtab view to prevent silent rendering into hidden 0x0 boxes.
- **Safe Data Slicing**: Treat analytical payloads (`dashPayload`, `historicalRecords`) as read-only. Always slice or clone arrays before filtering to prevent mutating global state across date range switches.
- **Closed Day Degradation**: Closed days (e.g., Monday/Tuesday closures) must gracefully report `$0 (Closed)` with zeroed raw meat prep targets, never throwing `RangeError` or showing `-95%` drop alarms.

## 3. Code Cleanliness
- **No Direct Patch Scripts**: Do not introduce ad-hoc root scripts (`fix_*.py`, `patch*.js`). All business logic belongs in `app.js` or `clover_api/`.
- **Syntax Verification**: Every PR modifying JavaScript must pass `npm run check` cleanly before merge.
