"""
Yellow Rose BBQ - Comprehensive Cost of Goods Sold (Full COGS) Engine
Computes Meat + Bakery/Perishables + Sides + Packaging/Sauce costs per sold item
and per service day, reconciling against data/vendor_invoices/ when available
without exposing raw wholesale invoice lines in public payloads.
"""

import csv
import json
import os
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

os.umask(0o022)

ANALYTICS_DIR = Path(__file__).resolve().parent
BASE_DIR = ANALYTICS_DIR.parent.parent
RECIPE_BOM_PATH = ANALYTICS_DIR / "recipe_bom.json"
VENDOR_INVOICES_DIR = BASE_DIR / "data" / "vendor_invoices"

EST_AVG_TICKET_USD = 48.50


def load_recipe_bom(bom_path: Path = RECIPE_BOM_PATH) -> dict:
    """Load the declarative recipe BOM catalog."""
    with open(bom_path, "r", encoding="utf-8") as f:
        return json.load(f)


def reconcile_vendor_unit_costs(bom: dict, invoices_dir: Path = VENDOR_INVOICES_DIR) -> dict:
    """
    Fault-isolated reconciliation of protein raw costs against local vendor invoice CSVs.
    Never logs or emits raw invoice line items; falls back to BOM defaults if missing.
    """
    protein_costs = dict(bom.get("protein_raw_cost_per_lb", {}))
    if not invoices_dir.exists():
        print("[WARN] Vendor invoices directory missing; using calibrated BOM defaults.")
        return protein_costs

    csv_files = sorted(invoices_dir.glob("*.csv"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not csv_files:
        print("[WARN] No vendor invoice CSVs found; using calibrated BOM defaults.")
        return protein_costs

    matched = False
    for csv_path in csv_files[:3]:
        try:
            with open(csv_path, "r", encoding="utf-8-sig", errors="ignore") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    desc = (
                        row.get("Product Description")
                        or row.get("DESCRIPTION")
                        or row.get("Item Description")
                        or ""
                    ).strip().lower()
                    raw_price = (
                        row.get("Unit Price")
                        or row.get("PRICE")
                        or row.get("Price")
                        or ""
                    ).replace("$", "").replace(",", "").strip()
                    if not desc or not raw_price:
                        continue
                    try:
                        price = float(raw_price)
                    except ValueError:
                        continue
                    if price <= 0 or price > 30.0:
                        continue
                    if "brisket" in desc and "beef" in desc:
                        protein_costs["brisket"] = round(price, 2)
                        matched = True
                    elif "boston butt" in desc or ("pork" in desc and "butt" in desc):
                        protein_costs["pork"] = round(price, 2)
                        matched = True
                    elif "sparerib" in desc or "spare rib" in desc:
                        protein_costs["ribs"] = round(price, 2)
                        matched = True
                    elif "turkey" in desc and "breast" in desc:
                        protein_costs["turkey"] = round(price, 2)
                        matched = True
        except Exception:
            continue

    if not matched:
        print("[WARN] No matching protein unit prices in vendor invoices; using calibrated BOM defaults.")
    return protein_costs


def calculate_line_item_bom_cost(item_key: str, qty: float, bom: dict, protein_costs: dict | None = None) -> dict:
    """
    Multiply sold item count by its recipe BOM to compute meat, bakery, sides, and packaging cost.
    """
    recipes = bom.get("recipes", {})
    recipe = recipes.get(item_key)
    if not recipe or qty <= 0:
        return {
            "meat_cost": 0.0,
            "bakery_cost": 0.0,
            "sides_cost": 0.0,
            "packaging_cost": 0.0,
            "non_meat_cost": 0.0,
            "total_cogs": 0.0,
        }

    p_costs = protein_costs or bom.get("protein_raw_cost_per_lb", {})
    yields = bom.get("protein_yields", {})

    meat_cut = recipe.get("meat_cut")
    cooked_lbs = float(recipe.get("cooked_meat_lbs", 0.0)) * qty
    if meat_cut and cooked_lbs > 0:
        raw_rate = float(p_costs.get(meat_cut, 0.0))
        y_net = float(yields.get(meat_cut, 1.0)) or 1.0
        meat_cost = round((cooked_lbs / y_net) * raw_rate, 2)
    else:
        meat_cost = 0.0

    bakery_cost = round((float(recipe.get("bun_cost", 0.0)) + float(recipe.get("pickle_onion_cost", 0.0))) * qty, 2)
    sides_cost = round(float(recipe.get("sides_cost", 0.0)) * qty, 2)
    packaging_cost = round((float(recipe.get("paper_tray_cost", 0.0)) + float(recipe.get("sauce_cost", 0.0))) * qty, 2)
    non_meat_cost = round(bakery_cost + sides_cost + packaging_cost, 2)
    total_cogs = round(meat_cost + non_meat_cost, 2)

    return {
        "meat_cost": meat_cost,
        "bakery_cost": bakery_cost,
        "sides_cost": sides_cost,
        "packaging_cost": packaging_cost,
        "non_meat_cost": non_meat_cost,
        "total_cogs": total_cogs,
    }


def classify_pacing_band(cogs_pct: float | None, target_bands: dict) -> tuple[str, str]:
    """Return (pacing_band, pacing_label) using target thresholds."""
    if cogs_pct is None:
        return "pending", "Pending Service"
    green_max = float(target_bands.get("green_max_pct", 32.0))
    amber_max = float(target_bands.get("amber_max_pct", 36.0))
    if cogs_pct < green_max:
        return "green", f"Healthy Pacing (<{green_max:g}%)"
    if cogs_pct <= amber_max:
        return "amber", f"Watch ({green_max:g}–{amber_max:g}%)"
    return "red", f"Over Budget (>{amber_max:g}%)"


def build_daily_full_cogs_record(
    date_str: str,
    day_name: str,
    gross_revenue: float,
    meat_cost: float,
    est_orders: float,
    bom: dict,
    is_closed: bool = False,
) -> dict:
    """Build a single day's Full COGS record with strict math parity and zero-revenue guards."""
    target_bands = bom.get("target_bands", {"green_max_pct": 32.0, "amber_max_pct": 36.0})

    if is_closed or day_name == "Mon":
        return {
            "date": date_str,
            "day_name": day_name,
            "status": "closed",
            "gross_revenue": 0.0,
            "meat_cost": 0.0,
            "bakery_cost": 0.0,
            "sides_cost": 0.0,
            "packaging_cost": 0.0,
            "non_meat_cost": 0.0,
            "total_cogs": 0.0,
            "meat_cost_pct": None,
            "cogs_pct": None,
            "pacing_band": "closed",
            "pacing_label": "$0 (Closed)",
        }

    gross_rev = round(max(0.0, float(gross_revenue or 0.0)), 2)
    if gross_rev <= 0.0:
        return {
            "date": date_str,
            "day_name": day_name,
            "status": "pending",
            "gross_revenue": 0.0,
            "meat_cost": 0.0,
            "bakery_cost": 0.0,
            "sides_cost": 0.0,
            "packaging_cost": 0.0,
            "non_meat_cost": 0.0,
            "total_cogs": 0.0,
            "meat_cost_pct": None,
            "cogs_pct": None,
            "pacing_band": "pending",
            "pacing_label": "Pending Service",
        }

    orders = max(1.0, float(est_orders or 0.0))
    ratios = bom.get("non_meat_ratios_by_category", {})
    bakery_cost = round(orders * float(ratios.get("bakery_per_order", 0.72)), 2)
    sides_cost = round(orders * float(ratios.get("sides_per_order", 1.48)), 2)
    packaging_cost = round(orders * float(ratios.get("packaging_per_order", 1.05)), 2)

    meat_cost_clean = round(max(0.0, float(meat_cost or 0.0)), 2)
    non_meat_cost = round(bakery_cost + sides_cost + packaging_cost, 2)
    total_cogs = round(meat_cost_clean + non_meat_cost, 2)

    meat_cost_pct = round((meat_cost_clean / gross_rev) * 100.0, 1)
    cogs_pct = round((total_cogs / gross_rev) * 100.0, 1)
    # Enforce monotonicity invariant against rounding edge cases
    if cogs_pct < meat_cost_pct:
        cogs_pct = meat_cost_pct

    pacing_band, pacing_label = classify_pacing_band(cogs_pct, target_bands)
    return {
        "date": date_str,
        "day_name": day_name,
        "status": "ok",
        "gross_revenue": gross_rev,
        "meat_cost": meat_cost_clean,
        "bakery_cost": bakery_cost,
        "sides_cost": sides_cost,
        "packaging_cost": packaging_cost,
        "non_meat_cost": non_meat_cost,
        "total_cogs": total_cogs,
        "meat_cost_pct": meat_cost_pct,
        "cogs_pct": cogs_pct,
        "pacing_band": pacing_band,
        "pacing_label": pacing_label,
    }


def _estimate_meat_cost_from_forecast_record(rec: dict, protein_costs: dict) -> float:
    """Compute wholesale raw meat batch cost from a dashboard forecast record."""
    brisket_raw = float(rec.get("brisket_raw_lbs") or 0.0)
    pork_raw = float(rec.get("pork_shoulder_raw_lbs") or 0.0)
    ribs_racks = float(rec.get("pork_ribs_racks") or 0.0)
    dino_ribs = float(rec.get("beef_dino_ribs") or 0.0)
    turkey_raw = float(rec.get("turkey_raw_lbs") or rec.get("turkey_lbs") or 0.0)
    sausage_lbs = float(rec.get("sausage_lbs") or 0.0)

    cost = (
        brisket_raw * float(protein_costs.get("brisket", 5.08))
        + pork_raw * float(protein_costs.get("pork", 1.82))
        + (ribs_racks * 5.6) * float(protein_costs.get("ribs", 2.40))
        + (dino_ribs * (4.0 / 3.0)) * float(protein_costs.get("dino_ribs", 7.95))
        + turkey_raw * float(protein_costs.get("turkey", 3.58))
        + sausage_lbs * float(protein_costs.get("sausage", 3.45))
    )
    return round(cost, 2)


def export_full_cogs_payload(analytics_dir: Path = ANALYTICS_DIR) -> dict:
    """Generate full_cogs.json from dashboard_payload.json and recipe_bom.json."""
    bom = load_recipe_bom(analytics_dir / "recipe_bom.json")
    protein_costs = reconcile_vendor_unit_costs(bom)
    target_bands = bom.get("target_bands", {"green_max_pct": 32.0, "amber_max_pct": 36.0})

    daily_records = {}
    dash_path = analytics_dir / "dashboard_payload.json"
    if dash_path.exists():
        try:
            with open(dash_path, "r", encoding="utf-8") as f:
                dash = json.load(f)
            forecast_records = dash.get("forecast", {}).get("forecast_records", [])
            for rec in forecast_records:
                d_str = rec.get("date")
                if not d_str:
                    continue
                day_name = rec.get("day_name") or ""
                is_closed = bool(rec.get("is_closed")) or day_name == "Mon"
                gross_rev = float(rec.get("predicted_revenue") or 0.0)
                meat_cost = _estimate_meat_cost_from_forecast_record(rec, protein_costs)
                est_orders = (gross_rev / EST_AVG_TICKET_USD) if gross_rev > 0 else 0.0
                daily_records[d_str] = build_daily_full_cogs_record(
                    date_str=d_str,
                    day_name=day_name,
                    gross_revenue=gross_rev,
                    meat_cost=meat_cost,
                    est_orders=est_orders,
                    bom=bom,
                    is_closed=is_closed,
                )
        except Exception as e:
            print(f"[WARN] Could not read dashboard_payload.json for full_cogs: {e}")
    else:
        print("[WARN] dashboard_payload.json missing; writing empty daily full_cogs payload.")

    now_ny = datetime.now(ZoneInfo("America/New_York"))
    payload = {
        "generated_at": now_ny.isoformat(),
        "bom_version": bom.get("version", "1.0.0"),
        "target_bands": target_bands,
        "non_meat_ratios_by_category": bom.get("non_meat_ratios_by_category", {}),
        "daily": daily_records,
    }

    for target_dir in [analytics_dir, BASE_DIR / "analytics", BASE_DIR / "api" / "analytics"]:
        try:
            target_dir.mkdir(parents=True, exist_ok=True)
            out_file = target_dir / "full_cogs.json"
            with open(out_file, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2)
        except Exception as e:
            print(f"[WARN] Failed to write full_cogs.json to {target_dir}: {e}")

    print(f"Successfully generated {analytics_dir / 'full_cogs.json'} ({len(daily_records)} days)")
    return payload


if __name__ == "__main__":
    export_full_cogs_payload()
