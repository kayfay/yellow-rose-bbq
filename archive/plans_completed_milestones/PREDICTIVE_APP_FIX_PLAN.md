# Predictive App Fix Plan (2026-11-05)

Backlog: `.loop/prd.json` ids 38-50. Backup: `backups/archive_pre_predictive_fixes_20261105.tar.gz`.

## Decisions so far
- **Unit values come from the invoice (data/Submitted_Order564310...csv) and yield sheet, not guesses.**
  Raw per piece: brisket ~16.4 lb (82 lb/case of 5), spare rack ~5.6 lb, pork butt ~8 lb (yield sheet only), turkey ~18.7 lb/case-of-2... Sausage 3 links/lb.
  Cooked per piece = raw x yield (brisket 0.40, butt 0.44, ribs 0.60, sausage 0.85 smoke yield).
- **Brisket cooked-lb-per-piece: user unsure.** Use ~6.5 lb, show counts as estimates; weigh real briskets to calibrate. The 12.0 value in the original request is NOT used.
- **"Hourly Sales Pace" box: rename to "Sales vs. Typical Day"** (Ahead / On pace / Behind + dollar gap).
- **Hourly Sales chart refreshes every hour** and on subtab activation.
- **"other hours": not found anywhere in index.html, app.js, modules or d3_charts.js (grep 2026-11-05). User does not know what it is either. Dropped; revisit only if the user spots it on screen.**
- Test gates use unittest, node --check, Playwright (no pytest/tsc/npm build in repo).

## Tile layout (target)
```
+------------------------------+
| BRISKET            (name)    |
|  4 Briskets          <- big  |
|  Raw 66 lb  (predicted)      |  muted
|  Cooked 26 lb  (measured)    |  muted
|  Cooked lbs Sold: 18         |
|  [Counts | Lbs] toggle above grid
+------------------------------+
Nav: Hourly Sales | Daily vs Typical | Busy Hours | Weather | Game Day | Menu Mix | Shop Reports
     (placeholder subtabs removed after audit)
```

## Milestones
- [ ] M1 copy purge + cushion/labor removal (prd 38-40)
- [ ] M2 labels + pace box rename (41)
- [ ] M3 slider touch lock, tile symmetry, hourly chart repair (42-44)
- [ ] M4 meat cost formula, projection decouple, dynamic insights (45-47)
- [ ] M5 unit dictionary + counts-first tiles + toggle (48-49)
- [ ] M6 critic audit, full test run (50)

## Goal command
/goal Execute PREDICTIVE_APP_FIX_PLAN.md milestones M1-M6 in order, one prd.json story at a time, running npm run check, npm test and the unittest suite after each milestone, logging to .loop/log.md. Stop after 20 turns or 3 turns without test progress.
