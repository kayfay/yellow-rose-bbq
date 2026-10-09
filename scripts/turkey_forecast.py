"""
Yellow Rose BBQ - Calibrated Turkey Demand Forecasting Engine
Implements:
1. Day-of-Week Median Baselines & Dynamic Error-Decay EMA
2. Raw vs. Cooked Yield Transformations (70% Nominal Yield)
3. Huber Anomaly Outlier Damping
4. Continuous Tracking Signal & Drift Detection Thresholds (|error| / actual > 0.35)
"""

import math
import json
import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

BASE_DIR = Path(__file__).resolve().parent.parent
LOG_FILE = BASE_DIR / ".loop" / "log.md"

# CULINARY OPERATIONS INVARIANTS
NOMINAL_YIELD = 0.70      # 30% trim & long-smoke shrinkage
MIN_YIELD = 0.65
MAX_YIELD = 0.75
RAW_CASE_LBS = 20.0       # Patuxent Farms 2/10 LBA (2 breasts @ ~10 lbs)

# DAY-OF-WEEK COOKED BASELINES (LBS)
DOW_BASELINE_COOKED: Dict[str, float] = {
    "Mon": 0.0,   # Pit maintenance / Closed
    "Tue": 6.2,   # Light weekday walk-in
    "Wed": 7.2,   # Steady weekday (matches yesterday's ~8 lbs actual)
    "Thu": 7.0,   # Weekday lunch & dinner
    "Fri": 11.5,  # Weekend start rush
    "Sat": 12.9,  # Peak smokehouse service
    "Sun": 8.9    # Sunday smokehouse family service
}

DOW_FULL_NAME = {
    "Monday": "Mon", "Tuesday": "Tue", "Wednesday": "Wed", "Thursday": "Thu",
    "Friday": "Fri", "Saturday": "Sat", "Sunday": "Sun"
}

DRIFT_THRESHOLD_PCT = 0.35  # Trigger warning if |Projected - Actual| / Actual > 35%
TRACKING_SIGNAL_LIMIT = 4.0 # Recalibrate if Tracking Signal not in [-4.0, 4.0]

class TurkeyForecaster:
    def __init__(self, safety_buffer_pct: float = 0.10, yield_factor: float = NOMINAL_YIELD):
        self.safety_buffer_pct = safety_buffer_pct
        self.yield_factor = yield_factor
        self.alpha = 0.20 # EMA error decay rate

    def normalize_dow(self, dow_input: str) -> str:
        short = DOW_FULL_NAME.get(dow_input, dow_input[:3].title())
        return short

    def predict(
        self,
        date_str: str,
        revenue: Optional[float] = None,
        recent_errors: Optional[List[float]] = None,
        safety_buffer: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Calculates calibrated turkey forecast for a specific operating date.
        """
        buf = safety_buffer if safety_buffer is not None else self.safety_buffer_pct
        
        # Parse date
        try:
            dt = datetime.datetime.strptime(date_str, "%Y-%m-%d")
            dow = dt.strftime("%a")
        except ValueError:
            dow = self.normalize_dow(date_str)
            dt = datetime.datetime.now()

        base_cooked = DOW_BASELINE_COOKED.get(dow, 6.0)
        
        # Handle closed days
        if dow == "Mon" or (revenue is not None and revenue < 50.0):
            return {
                "date": date_str,
                "day_name": dow,
                "is_closed": True,
                "predicted_demand_cooked_lbs": 0.0,
                "target_prep_cooked_lbs": 0.0,
                "target_prep_raw_lbs": 0.0,
                "cases_raw_required": 0.0,
                "safety_buffer_pct": 0.0,
                "status": "Closed / Pit Maintenance"
            }

        # Revenue index adjustment (bounded within +/- 10% to prevent outlier runaway)
        rev_multiplier = 1.0
        if revenue is not None and revenue > 0:
            benchmark = 3500.0 if dow in ["Fri", "Sat", "Sun"] else 2800.0
            rev_multiplier = min(1.10, max(0.90, revenue / benchmark))

        # Dynamic EMA error correction with Huber damping (cap error effect at +/- 1.0 lb)
        ema_correction = 0.0
        if recent_errors and len(recent_errors) > 0:
            last_err = recent_errors[-1]
            damped_err = max(-1.0, min(1.0, last_err))
            ema_correction = self.alpha * damped_err

        # Core predicted demand (cooked sliced meat equivalent)
        predicted_demand_cooked = round((base_cooked * rev_multiplier) + ema_correction, 2)
        predicted_demand_cooked = max(1.0, predicted_demand_cooked)

        # Production target with safety buffer ceiling to prevent 86ing
        target_prep_cooked = round(predicted_demand_cooked * (1.0 + buf), 2)
        
        # Raw whole breast weight required (scaled by smoke & trim yield)
        target_prep_raw = round(target_prep_cooked / self.yield_factor, 1)
        cases_required = round(target_prep_raw / RAW_CASE_LBS, 2)

        return {
            "date": date_str,
            "day_name": dow,
            "is_closed": False,
            "base_dow_cooked_lbs": base_cooked,
            "predicted_demand_cooked_lbs": predicted_demand_cooked,
            "target_prep_cooked_lbs": target_prep_cooked,
            "target_prep_raw_lbs": target_prep_raw,
            "cases_raw_required": cases_required,
            "safety_buffer_pct": round(buf * 100, 1),
            "status": "Production Target Calibrated"
        }

    def evaluate_drift(
        self,
        actual_cooked: float,
        projected_cooked: float,
        historical_pairs: Optional[List[Tuple[float, float]]] = None,
        log_to_stream: bool = True,
        context_note: str = ""
    ) -> Dict[str, Any]:
        """
        Evaluates projection drift against actuals.
        Computes Relative Error, MAD, and Tracking Signal.
        Appends alert to .loop/log.md if drift detected.
        """
        if actual_cooked <= 0:
            return {"is_drift": False, "relative_error": 0.0, "tracking_signal": 0.0}

        abs_error = abs(projected_cooked - actual_cooked)
        rel_error = abs_error / actual_cooked
        is_drift = rel_error > DRIFT_THRESHOLD_PCT

        # Calculate tracking signal across historical series if provided
        tracking_signal = 0.0
        mad = abs_error
        needs_recalibration = False

        if historical_pairs and len(historical_pairs) > 0:
            errors = [act - proj for act, proj in historical_pairs]
            cum_error = sum(errors)
            mad = sum(abs(e) for e in errors) / len(errors)
            if mad > 0.001:
                tracking_signal = cum_error / mad
                if abs(tracking_signal) > TRACKING_SIGNAL_LIMIT:
                    needs_recalibration = True

        result = {
            "actual_cooked_lbs": actual_cooked,
            "projected_cooked_lbs": projected_cooked,
            "absolute_error_lbs": round(abs_error, 2),
            "relative_error_pct": round(rel_error * 100, 2),
            "is_drift": is_drift,
            "tracking_signal": round(tracking_signal, 2),
            "needs_recalibration": needs_recalibration,
            "threshold_pct": round(DRIFT_THRESHOLD_PCT * 100, 1)
        }

        if (is_drift or needs_recalibration) and log_to_stream:
            self._log_drift_alert(result, context_note)

        return result

    def _log_drift_alert(self, drift_info: Dict[str, Any], note: str = ""):
        """Logs model drift alert directly into the Stream Layer (.loop/log.md)."""
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        alert_msg = (
            f"- **{now_str} [ALERT: MODEL DRIFT DETECTED]**: "
            f"Projected {drift_info['projected_cooked_lbs']} lbs vs. Actual {drift_info['actual_cooked_lbs']} lbs "
            f"(Relative Error: {drift_info['relative_error_pct']}% > {drift_info['threshold_pct']}% threshold | "
            f"Tracking Signal: {drift_info['tracking_signal']}). "
            f"{note}\n"
        )
        if LOG_FILE.exists():
            with open(LOG_FILE, "a") as f:
                f.write(alert_msg)

def legacy_forecast(revenue: float) -> float:
    """Legacy buggy uncalibrated heuristic from app.js."""
    if revenue <= 0:
        return 0.0
    return round(revenue * 0.008 + 10)

if __name__ == "__main__":
    forecaster = TurkeyForecaster()
    # Test Wednesday run with yesterday revenue
    res = forecaster.predict("2026-10-07", revenue=2800.0)
    print("Wednesday Calibrated Run:", res)
