"""
Yellow Rose BBQ - physical kitchen unit conversions (single source of truth).

Maps weights to the things the line actually handles: whole briskets, pork butts, racks, links.
`raw_lbs_per_unit` and `units_per_case` come from the US Foods invoice of 2026-09-03 where one exists.
`lbs_per_unit` is COOKED lbs per unit (= raw_lbs_per_unit x cook_yield).

modules/shared/core_utils.js mirrors the brisket/pork/rib numbers in KITCHEN_UNIT_SPECS;
clover_api/tests/test_calculations.py fails if the two drift apart.
"""

UNIT_CONVERSIONS = {
    "brisket": {
        "unit_name": "Whole Brisket",
        "unit_name_plural": "Briskets",
        "raw_lbs_per_unit": 16.4,   # invoice: 3 cs = $1,257.15 at $5.10/lb -> ~82 lb/cs of 5
        "units_per_case": 5,
        "cook_yield": 0.35,
        # Owner-confirmed 2026-11-07: one brisket yields 5.75 lb cooked (5 3/4 lb), i.e. ~35% of 16.4 lb raw invoice packer.
        "owner_reported_cooked_lbs_per_unit": 5.75,
        "source": "US Foods invoice 2026-09-03 (catch weight, 5.75 lbs cooked confirmed)",
    },
    "pork_butt": {
        "unit_name": "Pork Butt",
        "unit_name_plural": "Pork Butts",
        "raw_lbs_per_unit": 8.0,    # yield sheet only; no butt on an invoice yet
        "units_per_case": 4,
        "cook_yield": 0.44,
        "source": "data/yellow_rose_bbq_wholesale_yields.csv (confirm with an invoice)",
    },
    "ribs": {
        "unit_name": "Rack of Ribs",
        "unit_name_plural": "Racks of Ribs",
        "raw_lbs_per_unit": 5.6,    # invoice: 5 cs = $402.72 at $2.40/lb -> ~33.6 lb/cs of 6 racks
        "units_per_case": 6,
        "cook_yield": 0.60,
        "source": "US Foods invoice 2026-09-03 (catch weight)",
    },
    "sausage": {
        "unit_name": "Link",
        "unit_name_plural": "Links",
        "raw_lbs_per_unit": 1.0 / 3.0,  # 3 links per lb
        "units_per_case": None,
        "cook_yield": 1.0,
        "source": "house recipe, 3 links per lb",
    },
    "dino_ribs": {
        "unit_name": "Beef Dino Rib",
        "unit_name_plural": "Beef Dino Ribs",
        "raw_lbs_per_unit": 4.0,
        "units_per_case": 12,
        "cook_yield": 0.50,
        "source": "4 lbs/rib, 12 ribs/case (3 bags)",
    },
    "turkey": {
        "unit_name": "Smoked Turkey Breast",
        "unit_name_plural": "Smoked Turkey Breasts",
        "raw_lbs_per_unit": 10.0,
        "units_per_case": 2,
        "cook_yield": 0.70,
        "source": "20 lbs/case raw (2 breasts @ 10 lbs), 70% cook yield",
    },
}

for _spec in UNIT_CONVERSIONS.values():
    _spec["lbs_per_unit"] = round(_spec["raw_lbs_per_unit"] * _spec["cook_yield"], 2)
    _spec["lbs_per_case"] = (
        round(_spec["raw_lbs_per_unit"] * _spec["units_per_case"], 1) if _spec["units_per_case"] else None
    )


def units_for_raw_lbs(meat_key, raw_lbs):
    """Whole pieces needed for a raw-lb target, rounded up (you can't cook 0.4 of a brisket)."""
    import math
    return int(math.ceil(float(raw_lbs) / UNIT_CONVERSIONS[meat_key]["raw_lbs_per_unit"]))
