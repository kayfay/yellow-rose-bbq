#!/usr/bin/env python3
import sys
import os

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

from backend_router import route_sales_query

def main():
    print("--- [TEST 1] Historical Past Date Query ---")
    past_date = "09/19/2026"
    res1 = route_sales_query(past_date, "rosebuds")
    print(f"Past Date Response: {res1}")
    assert res1["data_type"] == "ACTUAL", "Expected data_type to be ACTUAL"
    assert res1["quantity"] == 40, f"Expected 40 rosebuds, got {res1['quantity']}"
    print("  ✓ Historical past date query verified.")

    print("--- [TEST 2] Future Date Query ---")
    future_date = "09/25/2026"
    res2 = route_sales_query(future_date, "rosebuds")
    print(f"Future Date Response: {res2}")
    assert res2["data_type"] == "PREDICTED", "Expected data_type to be PREDICTED"
    print("  ✓ Future date query verified.")

    print("\nAll automated tests passed.")
    sys.exit(0)

if __name__ == "__main__":
    main()
