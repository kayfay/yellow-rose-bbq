# Yellow Rose BBQ — Subtab De-Slop & Roll-Up Accordion Plan (`SUBTAB_CLEANUP_PLAN.md`)

**Date:** 2026-11-02  
**Status:** Aligned via `/grill-me` — Executing Autonomous PAL & E2E Loop

---

## 1. `/grill-me` Alignment Decisions

1. **Default Roll-Up State & Persistence**:
   - Top 3–4 Executive Key-Value Stat Cards and primary charts remain visible at the top of each subtab.
   - All subtab narrative notes, correlation breakdowns, and deep-dive sections are wrapped in reusable `.rollup-section` (`RollUpSection`) accordions with $\ge 48\text{px}$ touch-safe headers, summary status pills, chevron indicators (`▼`/`▲`), `localStorage` state memory (`yr_rollup_state_v1`), and a global **Expand All / Collapse All Roll-Ups** button in `#design-debug-drawer`.
   - Note: To guarantee 100% compatibility with existing Playwright E2E tests that assert immediate visibility on initial load, `.rollup-section` defaults to `expanded` unless collapsed by the user or via the `Collapse All Roll-Ups` control, and clicking any `.rollup-header` smoothly toggles `.collapsed` (`aria-expanded="true|false"`).
2. **Summary Metric & Copy Hierarchy ("De-Slop")**:
   - Top of every subtab renders a 3–4 card `.subtab-stat-strip` with tabular numerals (`font-variant-numeric: tabular-nums`).
   - All verbose paragraphs inside `#subtab-view-predictive`, `#subtab-view-arima`, `#subtab-view-weather`, `#subtab-view-event`, `#subtab-view-shift`, `#subtab-view-advanced`, and `#subtab-view-reports` are pruned to concise 1-line bold-lead bullets ($\le 2\text{--}3$ lines max).

---

## 2. 2D Subtab & Roll-Up Accordion Wireframe

```text
+-----------------------------------------------------------------------------------+
| [⚡ Hourly Pace] [📈 Daily vs Typical] [⏱️ Busy Hours] [🌧️ Weather] [🏈 Events] ... |
+-----------------------------------------------------------------------------------+
| SUBTAB STAT STRIP (3-4 Scannable Executive Stat Badges, tabular-nums)             |
| +----------------------+ +----------------------+ +----------------------+        |
| | PEAK RUSH WINDOW     | | BRISKET / PORK YIELD | | RAIN / HEAT ADVISORY |        |
| | 12:00 PM - 1:30 PM   | | 40% / 44% Cooked     | | >5mm: +20% To-Go     |        |
| +----------------------+ +----------------------+ +----------------------+        |
+-----------------------------------------------------------------------------------+
| [▼] ⚡ Pit Throughput & Shift Directives           [Pill: 3 Directives] (>=48px)  |
| --------------------------------------------------------------------------------- |
|  • Peak Flow: Lunch (12:00–1:30 PM, 12–14 ord/hr); Dinner (5:30–7:30 PM).         |
|  • Yield Standard: Brisket 40% cooked; Pork 44%; Turkey 70%.                      |
|  • Shift Directives: Pull Batch 2 Ribs by 4:00 PM; +20% to-go bags in rain.       |
+-----------------------------------------------------------------------------------+
| [►] 📊 Advanced Data Correlations (Collapsed Roll-Up Example) [Pill: 5 Metrics]   |
+-----------------------------------------------------------------------------------+
```

---

## 3. Milestone Checklist & Ready-to-Run `/goal` Command

- [x] **Milestone 1**: Archive workspace to `backups/archive_pre_subtab_cleanup_20261102.tar.gz` and initialize Tasks 29–30 in `.loop/prd.json`.
- [ ] **Milestone 2**: Implement `initRollUpAccordions()` and `setAllRollUpSections(expanded)` in `modules/shared/core_utils.js` + CSS rules in `style.css`.
- [ ] **Milestone 3**: Add `.subtab-stat-strip` badges, `.rollup-section` wrappers, and pruned $\le 3$-line copy across all 7 subtabs in `index.html`, `app.js`, `modules/reports/shop_reports.js`, and `modules/forecaster/analytics_subtabs.js`.
- [ ] **Milestone 4**: Verify with `scripts/verify_subtab_rollup_pal.py`, `npm run check`, and full Playwright E2E `npm test` (including new Roll-Up & De-Slop E2E test), then pass Adversarial Critic ($\ge 9/10$).

```text
/goal Execute SUBTAB_CLEANUP_PLAN.md Tasks 29-30: implement RollUpSection accordions, top-level stat strips, and <=3-line de-slopped copy across all 7 subtabs; verify with PAL + Playwright E2E + Adversarial Critic >=9/10.
```
