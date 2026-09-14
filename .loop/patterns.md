# Repository Patterns & Architectural Invariants

## State Synchronization & Layout
- Decouple date selection events from layout alterations; do not toggle visibility of flow-disrupting elements above KPI grids.
- Ensure KPI metrics recalculate deterministically based on date range (sum for multi-day range, single day for target date).

## Chart Rendering & DOM Stability
- Never destroy or rebuild chart containers (`Plotly.newPlot` or `container.innerHTML = ''`) on dynamic filter changes.
- Use in-place updates: `Plotly.react` or D3 data joins (`.data().join()`) to update series and axes smoothly.
- Preserve DOM wrapper dimensions and positioning to eliminate Cumulative Layout Shift (CLS).

## Defensive Time-Series Forecasting
- Always sanitize and validate date inputs before instantiating `Date` objects or calling `.toISOString()`.
- Default to ISO-safe boundaries when date parsing encounters null, undefined, or malformed strings.
- Guarantee non-empty fallback records with explicit numeric defaults (`0.0`) to avoid `NaN` propagation or zero-division.
- Avoid duplicate event listeners on date inputs to eliminate race conditions and re-render loops.
