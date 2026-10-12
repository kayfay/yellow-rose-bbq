"""
Yellow Rose BBQ - Calibrated Multi-Meat Demand Forecasting Engine
Implements:
1. Day-of-Week Median Baselines & Dynamic Error-Decay EMA across all meat categories:
   - Smoked Turkey Breast (Cooked Usable & Raw Prep)
   - Whole Beef Brisket (Cooked Usable & Raw Prep)
   - Pulled Pork / Boston Butt (Cooked Usable & Raw Prep)
   - Pork Spare Ribs (Racks)
   - Beef Dino Ribs (Ribs/Racks)
   - House Smoked Sausage (Batches, Lbs & Links)
   - Composed Items: Tacos & Rosebuds
2. Culinary Yield Invariants & Pack Sizes
   - Turkey (No-Trim Spec): 100% prep yield, 70% nominal smoke render yield.
   - Brisket: 40% net yield (60% trim & render).
   - Pork: 44% net yield (56% trim & render).
   - Sausage: 85% yield, 60 lbs stuffed/batch, 3 links/lb.
3. Paired Drift Detection:
   Triggers alert when (|Projected - Actual| / Actual > 0.25 AND |Projected - Actual| >= Deadband)
   OR Tracking Signal outside [-4.0, 4.0].
"""

import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

BASE_DIR = Path(__file__).resolve().parent.parent
LOG_FILE = BASE_DIR / ".loop" / "log.md"

# YIELD & CONVERSION CONSTANTS
YIELDS = {
    "turkey": {"trim_yield": 1.00, "cook_yield": 0.70, "net_yield": 0.70, "pack_lbs": 20.0, "portion_per_lb": 3.2},
    "brisket": {"trim_yield": 0.85, "cook_yield": 0.47, "net_yield": 0.40, "pack_lbs": 70.0, "portion_per_lb": 2.29},
    "pork": {"trim_yield": 0.90, "cook_yield": 0.49, "net_yield": 0.44, "pack_lbs": 32.0, "portion_per_lb": 2.0},
    "sausage": {"stuffed_batch_lbs": 60.0, "links_per_lb": 3.0, "yield": 0.85},
    "pork_ribs": {"lbs_per_rack": 5.0, "bones_per_rack": 12},
    "beef_dino_ribs": {"lbs_per_plate": 6.0, "bones_per_plate": 3}
}

# DAY-OF-WEEK COOKED BASELINES
DOW_BASELINES: Dict[str, Dict[str, float]] = {
    "Mon": {"turkey_cooked": 0.0, "brisket_cooked": 0.0, "pork_cooked": 0.0, "sausage_links": 0.0, "ribs_racks": 0.0, "dino_ribs": 0.0, "tacos": 0.0, "rosebuds": 0.0},
    "Tue": {"turkey_cooked": 6.2, "brisket_cooked": 28.0, "pork_cooked": 12.0, "sausage_links": 45.0, "ribs_racks": 3.0, "dino_ribs": 0.0, "tacos": 25.0, "rosebuds": 15.0},
    "Wed": {"turkey_cooked": 7.2, "brisket_cooked": 35.0, "pork_cooked": 16.0, "sausage_links": 55.0, "ribs_racks": 4.0, "dino_ribs": 0.0, "tacos": 35.0, "rosebuds": 20.0},
    "Thu": {"turkey_cooked": 7.0, "brisket_cooked": 38.0, "pork_cooked": 16.0, "sausage_links": 60.0, "ribs_racks": 4.0, "dino_ribs": 0.0, "tacos": 35.0, "rosebuds": 20.0},
    "Fri": {"turkey_cooked": 11.5, "brisket_cooked": 55.0, "pork_cooked": 24.0, "sausage_links": 90.0, "ribs_racks": 8.0, "dino_ribs": 4.0, "tacos": 55.0, "rosebuds": 30.0},
    "Sat": {"turkey_cooked": 12.9, "brisket_cooked": 78.0, "pork_cooked": 38.0, "sausage_links": 130.0, "ribs_racks": 12.0, "dino_ribs": 8.0, "tacos": 75.0, "rosebuds": 40.0},
    "Sun": {"turkey_cooked": 8.9, "brisket_cooked": 45.0, "pork_cooked": 20.0, "sausage_links": 75.0, "ribs_racks": 6.0, "dino_ribs": 4.0, "tacos": 45.0, "rosebuds": 25.0}
}

# PAIRED DRIFT THRESHOLDS & DEADBANDS
DRIFT_PCT_THRESHOLD = 0.25 # 25% relative error
TRACKING_SIGNAL_LIMIT = 4.0

ITEM_DEADBANDS = {
    "turkey": 2.0,      # lbs cooked
    "brisket": 5.0,     # lbs cooked
    "pork": 4.0,        # lbs cooked
    "sausage": 15.0,    # links (~5 lbs)
    "pork_ribs": 2.0,   # racks
    "dino_ribs": 1.0,   # ribs/plates
    "tacos": 10.0,      # tacos
    "rosebuds": 8.0,    # rosebuds
    "revenue": 250.0    # dollars
}

class MultiMeatForecaster:
    def __init__(self, safety_buffer_pct: float = 0.10):
        self.safety_buffer_pct = safety_buffer_pct
        self.alpha = 0.20 # EMA error decay

    def normalize_dow(self, dow_input: str) -> str:
        names = {"Monday": "Mon", "Tuesday": "Tue", "Wednesday": "Wed", "Thursday": "Thu", "Friday": "Fri", "Saturday": "Sat", "Sunday": "Sun"}
        return names.get(dow_input, dow_input[:3].title())

    def predict_day(
        self,
        date_str: str,
        revenue: Optional[float] = None,
        recent_errors: Optional[Dict[str, List[float]]] = None,
        safety_buffer: Optional[float] = None
    ) -> Dict[str, Any]:
        buf = safety_buffer if safety_buffer is not None else self.safety_buffer_pct
        try:
            dt = datetime.datetime.strptime(date_str, "%Y-%m-%d")
            dow = dt.strftime("%a")
        except ValueError:
            dow = self.normalize_dow(date_str)
            dt = datetime.datetime.now()

        baselines = DOW_BASELINES.get(dow, DOW_BASELINES["Tue"])
        is_closed = (dow == "Mon" or (revenue is not None and revenue < 50.0))

        if is_closed:
            return {
                "date": date_str,
                "day_name": dow,
                "is_closed": True,
                "status": "Closed / Pit Maintenance",
                "predicted_revenue": 0.0,
                "turkey": {"cooked_usable_lbs": 0.0, "raw_prep_lbs": 0.0, "cases_required": 0.0, "portions": 0},
                "brisket": {"cooked_usable_lbs": 0.0, "raw_prep_lbs": 0.0, "cases_required": 0.0, "packers": 0, "portions": 0},
                "pork": {"cooked_usable_lbs": 0.0, "raw_prep_lbs": 0.0, "cases_required": 0.0, "butts": 0, "portions": 0},
                "sausage": {"links": 0, "batches": 0, "lbs": 0.0},
                "pork_ribs": {"racks": 0, "cases": 0.0},
                "beef_dino_ribs": {"ribs": 0, "cases": 0.0},
                "tacos_sold": 0,
                "rosebuds_sold": 0
            }

        # Revenue scaling
        rev_multiplier = 1.0
        if revenue is not None and revenue > 0:
            benchmark = 3500.0 if dow in ["Fri", "Sat", "Sun"] else 2800.0
            rev_multiplier = min(1.10, max(0.90, revenue / benchmark))

        # Helper to compute single meat forecast with EMA error decay
        def calc_item(base_val: float, err_key: str, max_damp: float = 2.0) -> float:
            ema_corr = 0.0
            if recent_errors and err_key in recent_errors and len(recent_errors[err_key]) > 0:
                last_err = recent_errors[err_key][-1]
                damped_err = max(-max_damp, min(max_damp, last_err))
                ema_corr = self.alpha * damped_err
            val = (base_val * rev_multiplier) + ema_corr
            return max(0.0, round(val, 2))

        # Core predictions
        # 1. Turkey (No trim: net yield 70%)
        t_cooked_demand = calc_item(baselines["turkey_cooked"], "turkey", max_damp=1.0)
        t_cooked_target = round(t_cooked_demand * (1.0 + buf), 2)
        t_raw_prep = round(t_cooked_target / YIELDS["turkey"]["net_yield"], 1)
        t_cases = round(t_raw_prep / YIELDS["turkey"]["pack_lbs"], 2)
        t_portions = int(round(t_cooked_target * YIELDS["turkey"]["portion_per_lb"]))

        # 2. Brisket (Net yield 40%)
        b_cooked_demand = calc_item(baselines["brisket_cooked"], "brisket", max_damp=5.0)
        b_cooked_target = round(b_cooked_demand * (1.0 + buf), 2)
        b_raw_prep = round(b_cooked_target / YIELDS["brisket"]["net_yield"], 1)
        b_cases = round(b_raw_prep / YIELDS["brisket"]["pack_lbs"], 1)
        b_packers = int(round(b_raw_prep / 14.0))
        b_portions = int(round(b_cooked_target * YIELDS["brisket"]["portion_per_lb"]))

        # 3. Pork (Net yield 44%)
        p_cooked_demand = calc_item(baselines["pork_cooked"], "pork", max_damp=3.0)
        p_cooked_target = round(p_cooked_demand * (1.0 + buf), 2)
        p_raw_prep = round(p_cooked_target / YIELDS["pork"]["net_yield"], 1)
        p_cases = round(p_raw_prep / YIELDS["pork"]["pack_lbs"], 1)
        p_butts = int(round(p_raw_prep / 8.0))
        p_portions = int(round(p_cooked_target * YIELDS["pork"]["portion_per_lb"]))

        # 4. Sausage
        s_links_demand = calc_item(baselines["sausage_links"], "sausage", max_damp=15.0)
        s_links_target = int(round(s_links_demand * (1.0 + buf)))
        s_lbs = round(s_links_target / YIELDS["sausage"]["links_per_lb"], 1)
        s_batches = int(round(s_lbs / YIELDS["sausage"]["stuffed_batch_lbs"])) or (1 if s_lbs > 0 else 0)

        # 5. Ribs
        r_racks_demand = calc_item(baselines["ribs_racks"], "pork_ribs", max_damp=2.0)
        r_racks_target = int(round(r_racks_demand * (1.0 + buf)))
        r_cases = round(r_racks_target / 6.0, 1)

        # 6. Dino Ribs
        dr_demand = calc_item(baselines["dino_ribs"], "dino_ribs", max_damp=2.0)
        dr_target = int(round(dr_demand * (1.0 + buf)))
        dr_cases = round(dr_target / 12.0, 1)

        # 7. Tacos & Rosebuds
        tacos_target = int(round(calc_item(baselines["tacos"], "tacos", max_damp=10.0)))
        rosebuds_target = int(round(calc_item(baselines["rosebuds"], "rosebuds", max_damp=8.0)))

        return {
            "date": date_str,
            "day_name": dow,
            "is_closed": False,
            "status": "Production Targets Calibrated",
            "predicted_revenue": round(revenue if revenue else (2800.0 if dow in ["Tue", "Wed", "Thu"] else 4200.0), 2),
            "turkey": {
                "cooked_demand_lbs": t_cooked_demand,
                "cooked_usable_lbs": t_cooked_target,
                "raw_prep_lbs": t_raw_prep,
                "cases_required": t_cases,
                "portions": t_portions
            },
            "brisket": {
                "cooked_demand_lbs": b_cooked_demand,
                "cooked_usable_lbs": b_cooked_target,
                "raw_prep_lbs": b_raw_prep,
                "cases_required": b_cases,
                "packers": b_packers,
                "portions": b_portions
            },
            "pork": {
                "cooked_demand_lbs": p_cooked_demand,
                "cooked_usable_lbs": p_cooked_target,
                "raw_prep_lbs": p_raw_prep,
                "cases_required": p_cases,
                "butts": p_butts,
                "portions": p_portions
            },
            "sausage": {
                "links": s_links_target,
                "lbs": s_lbs,
                "batches": s_batches
            },
            "pork_ribs": {
                "racks": r_racks_target,
                "cases": r_cases
            },
            "beef_dino_ribs": {
                "ribs": dr_target,
                "cases": dr_cases
            },
            "tacos_sold": tacos_target,
            "rosebuds_sold": rosebuds_target
        }

    def evaluate_paired_drift(
        self,
        item_name: str,
        actual: float,
        projected: float,
        historical_pairs: Optional[List[Tuple[float, float]]] = None,
        log_to_stream: bool = True,
        context_note: str = ""
    ) -> Dict[str, Any]:
        """
        Evaluates drift using paired detection method:
        Alert triggers if (|Projected - Actual| / Actual > 0.25 AND |Projected - Actual| >= Deadband)
        OR Tracking Signal outside [-4.0, 4.0].
        """
        if actual <= 0:
            return {"item": item_name, "is_drift": False, "relative_error_pct": 0.0, "abs_error": 0.0, "tracking_signal": 0.0}

        abs_error = abs(projected - actual)
        rel_error = abs_error / actual
        deadband = ITEM_DEADBANDS.get(item_name, 2.0)

        # Paired condition
        pct_breach = rel_error > DRIFT_PCT_THRESHOLD
        deadband_breach = abs_error >= deadband
        paired_drift = pct_breach and deadband_breach

        tracking_signal = 0.0
        ts_breach = False
        if historical_pairs and len(historical_pairs) > 0:
            errors = [act - proj for act, proj in historical_pairs]
            cum_error = sum(errors)
            mad = sum(abs(e) for e in errors) / len(errors)
            if mad > 0.001:
                tracking_signal = cum_error / mad
                if abs(tracking_signal) > TRACKING_SIGNAL_LIMIT:
                    ts_breach = True

        is_drift = paired_drift or ts_breach

        result = {
            "item": item_name,
            "actual": actual,
            "projected": projected,
            "abs_error": round(abs_error, 2),
            "relative_error_pct": round(rel_error * 100, 2),
            "deadband": deadband,
            "pct_breach": pct_breach,
            "deadband_breach": deadband_breach,
            "tracking_signal": round(tracking_signal, 2),
            "ts_breach": ts_breach,
            "is_drift": is_drift
        }

        if is_drift and log_to_stream:
            self._log_alert(result, context_note)

        return result

    def _log_alert(self, drift_info: Dict[str, Any], note: str = ""):
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        alert_msg = (
            f"- **{now_str} [ALERT: PAIRED DRIFT DETECTED - {drift_info['item'].upper()}]**: "
            f"Projected {drift_info['projected']} vs. Actual {drift_info['actual']} "
            f"(Rel Error: {drift_info['relative_error_pct']}% > 25% | Abs Error: {drift_info['abs_error']} >= {drift_info['deadband']} | "
            f"Tracking Signal: {drift_info['tracking_signal']}). {note}\n"
        )
        if LOG_FILE.exists():
            with open(LOG_FILE, "a") as f:
                f.write(alert_msg)

if __name__ == "__main__":
    engine = MultiMeatForecaster()
    res = engine.predict_day("2026-10-15", revenue=2800.0)
    print("Thursday Multi-Meat Forecast:")
    print(f"  Turkey: {res['turkey']['cooked_usable_lbs']} lbs cooked usable (~{res['turkey']['raw_prep_lbs']} lbs raw / {res['turkey']['portions']} portions)")
    print(f"  Brisket: {res['brisket']['cooked_usable_lbs']} lbs cooked usable (~{res['brisket']['raw_prep_lbs']} lbs raw / {res['brisket']['packers']} packers)")
    print(f"  Pork: {res['pork']['cooked_usable_lbs']} lbs cooked usable (~{res['pork']['raw_prep_lbs']} lbs raw / {res['pork']['butts']} butts)")
    print(f"  Sausage: {res['sausage']['links']} links ({res['sausage']['lbs']} lbs / {res['sausage']['batches']} batches)")
