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
from secure_config import CLOVER_BASE_URL, CLOVER_MERCHANT_ID, get_headers, DB_PATH

RATE_LIMIT_BACKOFF_BASE = 2.0
MAX_RETRIES = 5
DEFAULT_PAGE_LIMIT = 1000

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

def parse_line_items(raw_orders: List[Dict[str, Any]]) -> pd.DataFrame:
    """
    Extracts nested lineItems and other expanded fields from orders into a flat DataFrame.
    """
    parsed = []
    for order in raw_orders:
        order_id = order.get("id")
        created_time = order.get("createdTime")
        dt = pd.to_datetime(created_time, unit="ms") if created_time else pd.NaT
        hour = dt.strftime("%H") if not pd.isna(dt) else None
        
        order_type = order.get("orderType", {}).get("label")
        
        # Calculate order-level discount
        discounts = order.get("discounts", {}).get("elements", [])
        discount_name = discounts[0].get("name") if discounts else None
        discount_amount = sum([d.get("amount", 0) for d in discounts]) if discounts else 0
        
        line_items = order.get("lineItems", {}).get("elements", [])
        for li in line_items:
            # Flatten modifications
            mods = li.get("modifications", {}).get("elements", [])
            mod_str = "|".join([m.get("name", "") for m in mods]) if mods else None
            
            parsed.append({
                "order_id": order_id,
                "line_item_id": li.get("id"),
                "item_name": li.get("name"),
                "item_id": li.get("item", {}).get("id") if isinstance(li.get("item"), dict) else None,
                "quantity": li.get("unitQty", 1) if li.get("unitQty") else 1, # Some Clover items use unitQty, others implicit 1
                "price_cents": li.get("price", 0),
                "price_usd": li.get("price", 0) / 100.0,
                "created_time": dt,
                "hour": hour,
                "order_type": order_type,
                "discount_name": discount_name,
                # "discount_amount": discount_amount, # Removed to prevent cartesian duplication
                "modifications": mod_str
            })

    df = pd.DataFrame(parsed)
    if not df.empty and "created_time" in df.columns:
        df.sort_values(by="created_time", inplace=True)
    return df

def run_ingestion():
    """Main pipeline execution for Clover POS ingestion."""
    print("=== Starting Clover POS API Data Ingestion ===")
    
    # 1. Fetch Orders (Expanded)
    expand_fields = "lineItems,discounts,orderType,lineItems.modifications"
    raw_orders = paginated_fetch("orders", expand=expand_fields)
    
    df_orders = parse_orders(raw_orders)
    save_to_sqlite(df_orders, "orders")
    
    df_line_items = parse_line_items(raw_orders)
    save_to_sqlite(df_line_items, "order_line_items")

    # 2. Fetch Payments
    raw_payments = paginated_fetch("payments")
    df_payments = parse_payments(raw_payments)
    save_to_sqlite(df_payments, "payments")
    
    # 3. Fetch Metadata endpoints
    metadata_endpoints = {
        "categories": "categories",
        "item_stocks": "item_stocks",
        "order_types": "order_types",
        "discount_defs": "discounts",
        "modifier_groups": "modifier_groups",
        "modifiers": "modifiers",
        "tenders": "tenders"
    }
    
    for table_name, endpoint in metadata_endpoints.items():
        raw_data = paginated_fetch(endpoint)
        if raw_data:
            df_meta = pd.DataFrame(raw_data)
            # Remove nested dictionaries/lists to prevent sqlite errors on simple flattening
            for col in df_meta.columns:
                if df_meta[col].apply(lambda x: isinstance(x, (dict, list))).any():
                    df_meta[col] = df_meta[col].astype(str)
            save_to_sqlite(df_meta, table_name)
        else:
            print(f"[INGEST] No data found for {endpoint}")

    print("=== Clover POS API Ingestion Completed Successfully ===")

if __name__ == "__main__":
    run_ingestion()
