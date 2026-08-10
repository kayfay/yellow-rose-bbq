"""
Clover POS API Ingestion Script for Yellow Rose BBQ
Handles querying Clover REST API endpoints (/orders, /payments),
pagination, rate limits, schema parsing, and SQLite storage.
"""

import time
import sqlite3
import requests
import pandas as pd
from typing import Dict, Any, List, Optional
from config import CLOVER_BASE_URL, CLOVER_MERCHANT_ID, get_headers, DB_PATH

RATE_LIMIT_BACKOFF_BASE = 2.0
MAX_RETRIES = 5
DEFAULT_PAGE_LIMIT = 100

def fetch_clover_endpoint(endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Fetches data from a Clover API endpoint with rate-limiting backoff and retries.
    """
    headers = get_headers()
    url = f"{CLOVER_BASE_URL}/v3/merchants/{CLOVER_MERCHANT_ID}/{endpoint.lstrip('/')}"
    params = params or {}

    retries = 0
    while retries < MAX_RETRIES:
        response = requests.get(url, headers=headers, params=params, timeout=30)

        if response.status_code == 200:
            return response.json()
        elif response.status_code == 429:
            # Handle rate limiting: inspect Retry-After header or default to exponential backoff
            retry_after = float(response.headers.get("Retry-After", RATE_LIMIT_BACKOFF_BASE ** (retries + 1)))
            print(f"[RATE LIMIT] 429 encountered. Sleeping for {retry_after:.2f}s...")
            time.sleep(retry_after)
            retries += 1
        else:
            response.raise_for_status()

    raise RuntimeError(f"Failed to fetch {url} after {MAX_RETRIES} attempts due to rate limiting or errors.")

def paginated_fetch(endpoint: str, expand: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Paginates through Clover endpoints using limit and offset parameters.
    """
    records = []
    offset = 0
    limit = DEFAULT_PAGE_LIMIT

    while True:
        params = {"limit": limit, "offset": offset}
        if expand:
            params["expand"] = expand

        payload = fetch_clover_endpoint(endpoint, params=params)
        elements = payload.get("elements", [])
        if not elements:
            break

        records.extend(elements)
        print(f"[INGEST] Fetched {len(elements)} items from {endpoint} (Total so far: {len(records)})")

        if len(elements) < limit:
            break  # Reached the last page

        offset += limit
        time.sleep(0.1)  # Respectful inter-request delay

    return records

def parse_orders(raw_orders: List[Dict[str, Any]]) -> pd.DataFrame:
    """
    Normalizes raw JSON order payloads into a structured pandas DataFrame.
    """
    parsed = []
    for order in raw_orders:
        created_time = order.get("createdTime")
        dt = pd.to_datetime(created_time, unit="ms") if created_time else pd.NaT

        parsed.append({
            "order_id": order.get("id"),
            "created_time": dt,
            "total_cents": order.get("total", 0),
            "total_usd": order.get("total", 0) / 100.0,
            "currency": order.get("currency", "USD"),
            "state": order.get("state"),
            "title": order.get("title"),
            "note": order.get("note"),
            "client_created_time": pd.to_datetime(order.get("clientCreatedTime"), unit="ms") if order.get("clientCreatedTime") else pd.NaT
        })

    df = pd.DataFrame(parsed)
    if not df.empty and "created_time" in df.columns:
        df.sort_values(by="created_time", inplace=True)
    return df

def parse_payments(raw_payments: List[Dict[str, Any]]) -> pd.DataFrame:
    """
    Normalizes raw JSON payment payloads into a structured pandas DataFrame.
    """
    parsed = []
    for pay in raw_payments:
        created_time = pay.get("createdTime")
        dt = pd.to_datetime(created_time, unit="ms") if created_time else pd.NaT

        parsed.append({
            "payment_id": pay.get("id"),
            "order_id": pay.get("order", {}).get("id") if isinstance(pay.get("order"), dict) else None,
            "created_time": dt,
            "amount_cents": pay.get("amount", 0),
            "amount_usd": pay.get("amount", 0) / 100.0,
            "tender_type": pay.get("tender", {}).get("label") if isinstance(pay.get("tender"), dict) else "Unknown",
            "result": pay.get("result")
        })

    df = pd.DataFrame(parsed)
    if not df.empty and "created_time" in df.columns:
        df.sort_values(by="created_time", inplace=True)
    return df

def save_to_sqlite(df: pd.DataFrame, table_name: str):
    """Saves clean pandas DataFrame records to SQLite database."""
    conn = sqlite3.connect(DB_PATH)
    df.to_sql(table_name, conn, if_exists="replace", index=False)
    conn.close()
    print(f"[DATABASE] Saved {len(df)} rows to table '{table_name}' in {DB_PATH}")

def run_ingestion():
    """Main pipeline execution for Clover POS ingestion."""
    print("=== Starting Clover POS API Data Ingestion ===")
    
    # 1. Fetch Orders
    raw_orders = paginated_fetch("orders", expand="lineItems")
    df_orders = parse_orders(raw_orders)
    save_to_sqlite(df_orders, "orders")

    # 2. Fetch Payments
    raw_payments = paginated_fetch("payments")
    df_payments = parse_payments(raw_payments)
    save_to_sqlite(df_payments, "payments")

    print("=== Clover POS API Ingestion Completed Successfully ===")

if __name__ == "__main__":
    run_ingestion()
