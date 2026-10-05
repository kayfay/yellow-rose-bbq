"""
Yellow Rose BBQ - Food Cost & Wholesale Invoice Engine
Parses US Foods order invoices and computes exact meat cost-per-pound and portion economics.
Uses range-based cooked yields (~38%-45% net yield, 55%-62% shrinkage & trim).
"""

import csv
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
INVOICE_1 = BASE_DIR / "Review order detail_91714857_09042026.csv"
INVOICE_2 = BASE_DIR / "Submitted_Order564310_Cust91714857_09032026.csv"

# Realistic range bounds for smoked Texas BBQ (Trim scraps + Smoker render loss)
YIELD_RANGES = {
    "brisket": {"min_yield": 0.38, "max_yield": 0.45, "nominal_yield": 0.40},
    "pork_butt": {"min_yield": 0.40, "max_yield": 0.48, "nominal_yield": 0.44},
    "pork_ribs": {"min_yield": 0.55, "max_yield": 0.65, "nominal_yield": 0.60},
    "turkey": {"min_yield": 0.65, "max_yield": 0.75, "nominal_yield": 0.70},
    "sausage": {"min_yield": 0.80, "max_yield": 0.90, "nominal_yield": 0.85},
}

def parse_us_foods_invoices():
    """Extracts confirmed wholesale contract pricing from US Foods invoice files."""
    costs = {
        "raw_beef_brisket_per_lb": 5.08,
        "raw_pork_butt_per_lb": 1.82,
        "raw_pork_sparerib_per_lb": 2.40,
        "raw_turkey_breast_per_lb": 3.58,
        "raw_bacon_per_lb": 4.29,
        "cream_cheese_per_lb": 2.89,
        "cheddar_cheese_per_lb": 2.67,
    }
    
    # Ingest from Review Order Detail if available
    if INVOICE_1.exists():
        with open(INVOICE_1, mode='r', encoding='utf-8-sig', errors='ignore') as f:
            reader = csv.DictReader(f)
            for row in reader:
                desc = (row.get('DESCRIPTION') or '').strip().lower()
                price_str = (row.get('PRICE') or '').replace('$', '').strip()
                try:
                    price = float(price_str)
                    if "beef, brisket" in desc and "raw" in desc:
                        costs["raw_beef_brisket_per_lb"] = price
                    elif "pork, boston butt" in desc:
                        costs["raw_pork_butt_per_lb"] = price
                    elif "pork, sparerib" in desc:
                        costs["raw_pork_sparerib_per_lb"] = price
                    elif "cheese, cream" in desc and price > 0:
                        # 10/3 LB CS = 30 lbs
                        costs["cream_cheese_per_lb"] = round(price / 30.0, 2)
                    elif "cheese, cheddar" in desc and price > 0:
                        # 4/5 LB CS = 20 lbs
                        costs["cheddar_cheese_per_lb"] = round(price / 20.0, 2)
                except ValueError:
                    pass

    # Ingest from Submitted Order if available
    if INVOICE_2.exists():
        with open(INVOICE_2, mode='r', encoding='utf-8-sig', errors='ignore') as f:
            reader = csv.DictReader(f)
            for row in reader:
                desc = (row.get('DESCRIPTION') or '').strip().lower()
                cs_str = (row.get('CS PRICE') or '').replace('$', '').strip()
                try:
                    price = float(cs_str)
                    if "turkey, roast breast" in desc:
                        costs["raw_turkey_breast_per_lb"] = price
                except ValueError:
                    pass
                    
    return costs

def compute_effective_meat_costs():
    """Calculates cooked yield cost ranges reflecting trim & smoke shrinkage."""
    raw = parse_us_foods_invoices()
    
    brisket_raw = raw["raw_beef_brisket_per_lb"]
    pork_raw = raw["raw_pork_butt_per_lb"]
    rib_raw = raw["raw_pork_sparerib_per_lb"]
    turkey_raw = raw["raw_turkey_breast_per_lb"]
    
    cooked_costs = {
        "wholesale_raw_costs": raw,
        "yield_estimates": {
            "brisket": {
                "nominal_cost_per_cooked_lb": round(brisket_raw / YIELD_RANGES["brisket"]["nominal_yield"], 2),
                "cost_range_per_cooked_lb": [
                    round(brisket_raw / YIELD_RANGES["brisket"]["max_yield"], 2),
                    round(brisket_raw / YIELD_RANGES["brisket"]["min_yield"], 2)
                ],
                "expected_yield_pct": "38% - 45% (est. 55% - 62% trim & smoke shrinkage)"
            },
            "pulled_pork": {
                "nominal_cost_per_cooked_lb": round(pork_raw / YIELD_RANGES["pork_butt"]["nominal_yield"], 2),
                "cost_range_per_cooked_lb": [
                    round(pork_raw / YIELD_RANGES["pork_butt"]["max_yield"], 2),
                    round(pork_raw / YIELD_RANGES["pork_butt"]["min_yield"], 2)
                ],
                "expected_yield_pct": "40% - 48% (est. 52% - 60% trim & smoke shrinkage)"
            },
            "pork_spare_ribs": {
                "nominal_cost_per_rack": round((rib_raw * 5.0) * 0.85, 2), # 5 lb average slab raw
                "cost_per_lb_raw": rib_raw,
                "expected_yield_pct": "Approx. 12 bones per 5 lb raw rack"
            },
            "turkey": {
                "nominal_cost_per_cooked_lb": round(turkey_raw / YIELD_RANGES["turkey"]["nominal_yield"], 2),
                "expected_yield_pct": "65% - 75% yield"
            }
        },
        "item_portions_cost": {
            "brisket_taco_2oz": round((brisket_raw / 0.40) * (2.0 / 16.0), 2),
            "brisket_sandwich_7oz": round((brisket_raw / 0.40) * (7.0 / 16.0), 2),
            "pork_sandwich_8oz": round((pork_raw / 0.44) * (8.0 / 16.0), 2),
            "full_rack_ribs": round(rib_raw * 5.0, 2),
            "half_rack_ribs": round((rib_raw * 5.0) / 2.0, 2)
        }
    }
    return cooked_costs

if __name__ == "__main__":
    costs = compute_effective_meat_costs()
    print("=== US Foods Wholesale & Smoked Yield Economics ===")
    print(json.dumps(costs, indent=2))
