# Multi-Meat Forecasting & Statistical Distillate

## 1. Culinary Yield Invariants (Cooked Usable vs Raw Prep)
- Turkey (No-Trim Spec): Y_trim = 1.0 (0% trim), Y_cook = 0.70 (30% smoke render). Cooked = Raw * 0.70.
- Brisket: Y_net = 0.40 (60% trim & render). Raw = Cooked / 0.40 (~14# packer).
- Pulled Pork: Y_net = 0.44 (56% trim & render). Raw = Cooked / 0.44 (~8# butt).
- Pork Spare Ribs: ~5 lbs/rack raw, 12 bones/rack. Dino Ribs: 3 bones/rack plate.
- Sausage: 60 lbs stuffed / batch. 3 links = 1 lb (85% yield).
- Portion Multipliers (per Cooked lb): Turkey 3.2 (5 oz), Pork 2.0 (8 oz), Brisket 2.3 (7 oz).

## 2. Calibrated Multi-Item Forecasting
- DOW Cooked Baselines (Turkey/Brisket/Pork): Scaled to historical weekday & weekend volumes.
- Revenue Multiplier: M_rev = clamp(0.90, Revenue / Baseline_Rev, 1.10) (2800 Tue-Thu, 3500 Fri-Sun).
- Adaptive 14-Day EMA Error Correction: F_t = (Base_DOW * M_rev) + 0.20 * Huber(e_{t-1}, delta=1.5).
- Target Cooked Ceiling: Target = F_t * (1 + Safety_Buffer) [Buffer = 10%].

## 3. Paired Drift Detection Engine
- Paired Alert Rule: (|P - Actual| / Actual > 0.25 AND |P - Actual| >= Deadband) OR |TS| > 4.0.
- Deadbands: Turkey 2.0#, Brisket 5.0#, Pork 4.0#, Sausage 5.0#, Ribs 2 racks, Dino 1 rack.
- Tracking Signal: TS = sum(Actual_i - P_i) / MAD. Recalibrate if TS outside [-4.0, 4.0].
- Target Performance: 30-day historical backtest target MAPE < 15.0% across all categories.

## 4. UI Display Hierarchy & Safety Guardrails
- Primary Metric: Cooked Usable Weight (lbs / units) on front line.
- Subtitle Metric: (~X lbs Raw Prep / ~Y Cases / Z portions) for pitmasters and procurement.
- Closed Days: Zero prep targets and $0 revenue without alert degradation.
