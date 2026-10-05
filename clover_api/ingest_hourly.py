import time
import sqlite3
import requests
import pandas as pd
from typing import Dict, Any, List, Optional
from secure_config import CLOVER_BASE_URL, CLOVER_MERCHANT_ID, get_headers, DB_PATH
from init_db import init_schema

RATE_LIMIT_BACKOFF_BASE = 2.0
MAX_RETRIES = 5
DEFAULT_PAGE_LIMIT = 1000

def fetch_clover_endpoint(endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    headers = get_headers()
    url = f"{CLOVER_BASE_URL}/v3/merchants/{CLOVER_MERCHANT_ID}/{endpoint.lstrip('/')}"
    params = params or {}

    retries = 0
    while retries < MAX_RETRIES:
        response = requests.get(url, headers=headers, params=params, timeout=30)
        if response.status_code == 200:
            return response.json()
        elif response.status_code == 429:
            retry_after = float(response.headers.get("Retry-After", RATE_LIMIT_BACKOFF_BASE ** (retries + 1)))
            print(f"[RATE LIMIT] 429 encountered. Sleeping for {retry_after:.2f}s...")
            time.sleep(retry_after)
            retries += 1
        elif response.status_code == 401:
            raise RuntimeError("[HTTP 401 UNAUTHORIZED] Clover API rejected the request.")
        else:
            response.raise_for_status()
    raise RuntimeError(f"Failed to fetch {url} after {MAX_RETRIES} attempts.")

def paginated_fetch(endpoint: str, expand: Optional[str] = None, filter_str: Optional[str] = None) -> List[Dict[str, Any]]:
    records = []
    offset = 0
    limit = DEFAULT_PAGE_LIMIT

    while True:
        params = {"limit": limit, "offset": offset}
        if expand:
            params["expand"] = expand
        if filter_str:
            params["filter"] = filter_str

        payload = fetch_clover_endpoint(endpoint, params=params)
        elements = payload.get("elements", [])
        if not elements:
            break

        records.extend(elements)
        print(f"[INGEST] Fetched {len(elements)} items from {endpoint} (Total so far: {len(records)})")

        if len(elements) < limit:
            break

        offset += limit
        time.sleep(0.1)

    return records

def upsert_to_sqlite(df: pd.DataFrame, table_name: str, pk_columns: List[str] = None):
    """Saves clean pandas DataFrame records to SQLite database using UPSERT (INSERT OR REPLACE)."""
    if df.empty:
        return

    conn = sqlite3.connect(DB_PATH)
    
    if not pk_columns:
        # Default behavior: replace
        df.to_sql(table_name, conn, if_exists="replace", index=False)
        conn.close()
        print(f"[DATABASE] Saved {len(df)} rows to table '{table_name}' (Replace Mode)")
        return
        
    temp_table = f"temp_{table_name}"
    df.to_sql(temp_table, conn, if_exists="replace", index=False)
    
    cols = ", ".join(df.columns)
    
    # We use INSERT OR REPLACE because we defined Primary Keys in init_schema
    query = f"""
    INSERT OR REPLACE INTO {table_name} ({cols})
    SELECT {cols} FROM {temp_table}
    """
    
    cur = conn.cursor()
    try:
        cur.execute(query)
        conn.commit()
    except Exception as e:
        print(f"Error upserting into {table_name}: {e}")
        conn.rollback()
    finally:
        cur.execute(f"DROP TABLE IF EXISTS {temp_table}")
        conn.commit()
        conn.close()
        
    print(f"[DATABASE] Upserted {len(df)} rows to table '{table_name}'")

# Reusing parse methods from ingest.py (Assume they are identical)
from ingest import parse_orders, parse_payments, parse_line_items

def run_ingestion(hourly: bool = False):
    print(f"=== Starting Clover POS API Data Ingestion (Hourly={hourly}) ===")
    init_schema()
    
    filter_str = None
    if hourly:
        # 2 hours ago in milliseconds
        since_ms = int((time.time() - 7200) * 1000)
        filter_str = f"modifiedTime>={since_ms}"
        print(f"Incremental sync: fetching records modified after {since_ms}")

    # 1. Fetch Orders (Expanded)
    expand_fields = "lineItems,discounts,orderType,lineItems.modifications"
    raw_orders = paginated_fetch("orders", expand=expand_fields, filter_str=filter_str)
    
    df_orders = parse_orders(raw_orders)
    upsert_to_sqlite(df_orders, "orders", pk_columns=["order_id"])
    
    df_line_items = parse_line_items(raw_orders)
    upsert_to_sqlite(df_line_items, "order_line_items", pk_columns=["order_id", "line_item_id"])

    # 2. Fetch Payments
    raw_payments = paginated_fetch("payments", filter_str=filter_str)
    df_payments = parse_payments(raw_payments)
    upsert_to_sqlite(df_payments, "payments", pk_columns=["payment_id"])
    
    # Metadata endpoints (we just replace these since they are small and don't change often)
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
            for col in df_meta.columns:
                if df_meta[col].apply(lambda x: isinstance(x, (dict, list))).any():
                    df_meta[col] = df_meta[col].astype(str)
            upsert_to_sqlite(df_meta, table_name)
        else:
            print(f"[INGEST] No data found for {endpoint}")

    print("=== Clover POS API Ingestion Completed Successfully ===")

if __name__ == "__main__":
    import sys
    run_ingestion(hourly="--hourly" in sys.argv)
