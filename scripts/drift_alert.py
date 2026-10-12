"""
Yellow Rose BBQ - Automated Paired Model Drift Alert Engine
Evaluates demand projections against actual sales using Paired Drift Detection:
- Triggers alert when (|Projected - Actual| / Actual > 0.25 AND |Projected - Actual| >= Deadband)
  OR Tracking Signal is outside [-4.0, 4.0].
- Item Deadbands avoid false positives on low-volume days:
  Turkey: 2.0 lbs | Brisket: 5.0 lbs | Pork: 4.0 lbs | Sausage: 15.0 links | Ribs: 2.0 racks
- Directly logs structured alerts into the Stream Layer (.loop/log.md).
"""

import sys
import json
import argparse
import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR))

from scripts.meat_forecast import MultiMeatForecaster, ITEM_DEADBANDS, DRIFT_PCT_THRESHOLD, TRACKING_SIGNAL_LIMIT, LOG_FILE

def check_drift(
    item: str,
    actual: float,
    projected: float,
    historical_pairs: Optional[List[Tuple[float, float]]] = None,
    log_to_stream: bool = True,
    note: str = ""
) -> Dict[str, Any]:
    forecaster = MultiMeatForecaster()
    return forecaster.evaluate_paired_drift(
        item_name=item,
        actual=actual,
        projected=projected,
        historical_pairs=historical_pairs,
        log_to_stream=log_to_stream,
        context_note=note
    )

def main():
    parser = argparse.ArgumentParser(description="Yellow Rose BBQ Model Drift Alert Tool")
    parser.add_argument("--item", type=str, default="turkey", help="Meat category name (turkey, brisket, pork, sausage, pork_ribs, etc.)")
    parser.add_argument("--actual", type=float, required=True, help="Actual quantity sold (cooked lbs, links, racks)")
    parser.add_argument("--projected", type=float, required=True, help="Projected demand (cooked lbs, links, racks)")
    parser.add_argument("--note", type=str, default="Manual / Automated CLI drift check", help="Context note for audit log")
    parser.add_argument("--no-log", action="store_true", help="Do not append alert to .loop/log.md")
    args = parser.parse_args()

    res = check_drift(
        item=args.item,
        actual=args.actual,
        projected=args.projected,
        log_to_stream=not args.no_log,
        note=args.note
    )

    print(json.dumps(res, indent=2))
    if res["is_drift"]:
        print(f"\n[WARNING] Paired Model Drift Detected for {args.item.upper()}!")
        print(f"  Projected: {res['projected']} vs Actual: {res['actual']}")
        print(f"  Relative Error: {res['relative_error_pct']}% (Threshold: 25.0%)")
        print(f"  Absolute Error: {res['abs_error']} (Deadband: {res['deadband']})")
        sys.exit(1)
    else:
        print(f"\n[OK] Projection for {args.item} is within acceptable variance.")
        sys.exit(0)

if __name__ == "__main__":
    main()
