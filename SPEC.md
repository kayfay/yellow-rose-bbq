# SPEC.md — JD Advanced ML Analytics & Proactive Insight Engine

## 1. Overview & Aligned Parameters (Phase 1 `/grill-me`)
This specification upgrades **JD** from a reactive assistant into a proactive smokehouse analytical partner across `yellow-rose-bbq` and `agent-comms`:
- **Trigger Cadence:**
  1. **Active Service Outliers (`11:00 AM – 8:00 PM EST`, Tue–Sun):** Fires immediately whenever a real anomaly triggers (`>10%` sales pace swing vs. 4-week same-hour median, `>1.25x` meat depletion pace, or Full Food Cost `>36%` / side attachment dip).
  2. **Random Ambient Check-Ins Throughout the Day:** Naturally weaves pacing and Full Food Cost updates into routine check-ins (*"we're pacing at..."*) — no manual user query commands required.
- **Priority Ranking Order:**
  1. **Meat Run-Out Risk** (Physical Brisket Packers, Pork Butts, and Spare Rib Racks remaining on the holding board)
  2. **Sales Pace vs. 4-Week Typical Day** (Actual `$` vs. trailing 4-week same-day/same-hour median)
  3. **Full Food Cost % & Basket/Margin Pacing** (Meat Cost % vs. Full Food Cost % against `32%` / `36%` target bands + side attachment rate)
- **Boss Alert Escalation:** Uses `[Boss Alert: ...]` tag **only** for stockout risk or Full Food Cost `>36%` escalations.

---

## 2. Functional Requirements (EARS Syntax)

### 2.1 Analytics Micro-Engines (`services/analytics/`)
- **REQ-01 (Rolling 4-Week Same-Hour Baseline):** When evaluating current-hour sales performance, `hourly_velocity.py` shall benchmark current completed-hour revenue against the trailing 4-week historical median for the same weekday and hour (`America/New_York`), flagging swings `> 10%` or `> 1.5` standard deviations.
- **REQ-02 (Dynamic Meat Run-Out Projection):** When meat depletion exceeds `1.25x` expected baseline pace, `meat_depletion_timer.py` shall compute the estimated stockout timestamp (`Runout Time = Current Time + Remaining Cooked Lbs / Hourly Depletion Rate`) and output a physical cut recommendation (`slice thicker`, `pull backup pork butt`, `prep extra turkey breast`).
- **REQ-03 (Full Food Cost & Margin Drift Detection):** When evaluating daily service economics, `margin_drift_detector.py` shall read `clover_api/analytics/full_cogs.json` and recent Clover POS basket mix to report Meat Cost % vs. Full Food Cost % (against `<32%` Green, `32–36%` Watch, `>36%` High) and flag side-attachment drops.
- **REQ-04 (Top-Anomaly Ranking & Ambient Check-Ins):** When `insight_synthesizer.py` runs, it shall rank candidate insights strictly by priority (`1: Meat Run-Out`, `2: Sales Pace`, `3: Full Food Cost & Margin`), and when no outlier fires during an ambient check-in, still emit a grounded pacing + Full Food Cost summary.

### 2.2 JD Voice Contract & Grounding (`agents/jd/`)
- **REQ-05 (Authentic Kitchen Voice & Zero Academic Jargon):** When formatting messages in `jd_voice_contract.py` and `message_formatter.py`, JD shall translate all statistical metrics into plain-English smokehouse realities (e.g., `"running hotter than our last month of Thursdays"`, `"4 whole briskets left on the board"`) and strictly prohibit academic jargon (`heteroskedasticity`, `eigenvectors`, `eigenvalues`, `P90 confidence interval`, `regression`, `variance`, `Z-score`, `Sigma`).
- **REQ-06 (Zero Fabricated Numbers):** Every dollar figure, percentage, hour comparison, and physical cut count spoken by JD shall reconcile directly to `data/clover_sales_master.db`, `clover_api/analytics/full_cogs.json`, or `clover_api/analytics/predictive_payload.json`.
- **REQ-07 (Closed-Day & Pre-Service Guard):** On Monday (`Closed`) or pre-service (`gross_revenue == 0`), JD shall never emit false drop alarms, `NaN`, or stockout alerts, instead outputting a calm prep-readiness check-in.
