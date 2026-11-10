#!/usr/bin/env python3
"""
Yellow Rose BBQ - Complete Historical POS Data Backfill Engine
Pulls complete order, line-item, and payment history from Clover REST API
from restaurant opening (July 21, 2026) through the present date.

Features & Invariants:
  1. Rate-Limit Safe: Queries in 7-day time windows with 0.5s pause between pages (max 2 req/s).
  2. Automatic Retry & Backoff: Exponential backoff on 429 and 5xx gateway errors (up to 5 retries).
  3. Resumable Checkpoints: Tracks completed windows in data/backfill_checkpoint.json.
  4. Durable & Idempotent: Stores into local SQLite data/clover_sales_master.db and syncs to
     clover_api/data/clover_sales.db using INSERT OR REPLACE (zero duplication, append-safe).
  5. Strict Privacy: Master database is 100% local, permissions 0600, and never committed to Git.

Usage:
    python scripts/backfill_clover_history.py [--start-date YYYY-MM-DD] [--force]
"""

import os
import sys
import time
import json
import sqlite3
import shutil
from pathlib import Path
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
import requests
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.append(str(REPO_ROOT))

from clover_api.secure_config import get_headers, get_secure_credentials

LOCAL_TZ = ZoneInfo("America/New_York")
DATA_DIR = REPO_ROOT / "data"
MASTER_DB_PATH = DATA_DIR / "clover_sales_master.db"
CLOVER_DB_PATH = REPO_ROOT / "clover_api" / "data" / "clover_sales.db"
CHECKPOINT_PATH = DATA_DIR / "backfill_checkpoint.json"

DEFAULT_START_DATE = "2026-07-21"
WINDOW_DAYS = 7
PAGE_LIMIT = 500
RATE_LIMIT_DELAY = 0.5
MAX_RETRIES = 5
RATE_LIMIT_BACKOFF_BASE = 2.0

def init_db(db_path: Path):
    """Initialize master SQLite schema with proper primary keys and indexes."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            order_id TEXT PRIMARY KEY,
            created_time TEXT,
            total_cents INTEGER,
            total_usd REAL,
            currency TEXT,
            state TEXT,
            title TEXT,
            note TEXT,
            client_created_time TEXT
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS order_line_items (
            line_item_id TEXT PRIMARY KEY,
            order_id TEXT,
            item_name TEXT,
            item_id TEXT,
            quantity REAL,
            price_cents INTEGER,
            price_usd REAL,
            created_time TEXT,
            hour TEXT,
            order_type TEXT,
            discount_name TEXT,
            modifications TEXT,
            FOREIGN KEY (order_id) REFERENCES orders(order_id)
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS payments (
            payment_id TEXT PRIMARY KEY,
            order_id TEXT,
            created_time TEXT,
            amount_cents INTEGER,
            amount_usd REAL,
            tender_type TEXT,
            result TEXT,
            FOREIGN KEY (order_id) REFERENCES orders(order_id)
        )
    """)

    cur.execute("CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_time)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_items_created ON order_line_items(created_time)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_items_name ON order_line_items(item_name)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id)")

    conn.commit()
    conn.close()
    try:
        os.chmod(db_path, 0o600)
    except Exception:
        pass

def fetch_with_retry(url: str, headers: dict, params: dict) -> dict:
    """Fetch from Clover with exponential backoff on 429 and 5xx errors."""
    retries = 0
    while retries < MAX_RETRIES:
        try:
            res = requests.get(url, headers=headers, params=params, timeout=30)
            if res.status_code == 200:
                time.sleep(RATE_LIMIT_DELAY)
                return res.json()
            elif res.status_code == 429:
                retry_after = float(res.headers.get("Retry-After", RATE_LIMIT_BACKOFF_BASE ** (retries + 1)))
                print(f"    [RATE LIMIT 429] Sleeping for {retry_after:.1f}s (Attempt {retries+1}/{MAX_RETRIES})...")
                time.sleep(retry_after)
                retries += 1
            elif res.status_code in (500, 502, 503, 504):
                sleep_time = RATE_LIMIT_BACKOFF_BASE ** (retries + 1)
                print(f"    [SERVER ERROR {res.status_code}] Sleeping for {sleep_time:.1f}s (Attempt {retries+1}/{MAX_RETRIES})...")
                time.sleep(sleep_time)
                retries += 1
            else:
                res.raise_for_status()
        except (requests.ConnectionError, requests.Timeout) as exc:
            sleep_time = RATE_LIMIT_BACKOFF_BASE ** (retries + 1)
            print(f"    [CONNECTION ERROR] {exc}. Sleeping for {sleep_time:.1f}s (Attempt {retries+1}/{MAX_RETRIES})...")
            time.sleep(sleep_time)
            retries += 1

    raise RuntimeError(f"Failed to fetch {url} after {MAX_RETRIES} attempts.")

def fetch_window_orders(base_url: str, merchant_id: str, headers: dict, start_ms: int, end_ms: int) -> list:
    """Fetch all orders in a specific time window with lineItems and discounts expanded."""
    url = f"{base_url}/v3/merchants/{merchant_id}/orders"
    expand = "lineItems,discounts,orderType,lineItems.modifications"
    all_orders = []
    offset = 0

    while True:
        params = {
            "filter": [f"createdTime>={start_ms}", f"createdTime<={end_ms}"],
            "expand": expand,
            "limit": PAGE_LIMIT,
            "offset": offset,
            "orderBy": "createdTime ASC"
        }
        data = fetch_with_retry(url, headers, params)
        elements = data.get("elements", [])
        if not elements:
            break
        all_orders.extend(elements)
        if len(elements) < PAGE_LIMIT:
            break
        offset += PAGE_LIMIT

    return all_orders

def fetch_window_payments(base_url: str, merchant_id: str, headers: dict, start_ms: int, end_ms: int) -> list:
    """Fetch all payments in a specific time window."""
    url = f"{base_url}/v3/merchants/{merchant_id}/payments"
    all_payments = []
    offset = 0

    while True:
        params = {
            "filter": [f"createdTime>={start_ms}", f"createdTime<={end_ms}"],
            "limit": PAGE_LIMIT,
            "offset": offset,
            "orderBy": "createdTime ASC"
        }
        data = fetch_with_retry(url, headers, params)
        elements = data.get("elements", [])
        if not elements:
            break
        all_payments.extend(elements)
        if len(elements) < PAGE_LIMIT:
            break
        offset += PAGE_LIMIT

    return all_payments

def store_records(conn: sqlite3.Connection, orders: list, payments: list):
    """Upsert parsed orders, line items, and payments into SQLite."""
    cur = conn.cursor()

    for order in orders:
        c_time = order.get("createdTime")
        dt_str = pd.to_datetime(c_time, unit="ms").isoformat() if c_time else None
        client_c_time = order.get("clientCreatedTime")
        client_dt_str = pd.to_datetime(client_c_time, unit="ms").isoformat() if client_c_time else None

        cur.execute("""
            INSERT OR REPLACE INTO orders (
                order_id, created_time, total_cents, total_usd, currency, state, title, note, client_created_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            order.get("id"),
            dt_str,
            order.get("total", 0),
            (order.get("total", 0) or 0) / 100.0,
            order.get("currency", "USD"),
            order.get("state"),
            order.get("title"),
            order.get("note"),
            client_dt_str
        ))

        dt = pd.to_datetime(c_time, unit="ms") if c_time else None
        hour = dt.strftime("%H") if dt is not None else None
        order_type = order.get("orderType", {}).get("label") if isinstance(order.get("orderType"), dict) else None
        discounts = order.get("discounts", {}).get("elements", []) if isinstance(order.get("discounts"), dict) else []
        discount_name = discounts[0].get("name") if discounts else None

        line_items = order.get("lineItems", {}).get("elements", []) if isinstance(order.get("lineItems"), dict) else []
        for li in line_items:
            mods = li.get("modifications", {}).get("elements", []) if isinstance(li.get("modifications"), dict) else []
            mod_str = "|".join([m.get("name", "") for m in mods]) if mods else None

            cur.execute("""
                INSERT OR REPLACE INTO order_line_items (
                    line_item_id, order_id, item_name, item_id, quantity, price_cents, price_usd,
                    created_time, hour, order_type, discount_name, modifications
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                li.get("id"),
                order.get("id"),
                li.get("name"),
                li.get("item", {}).get("id") if isinstance(li.get("item"), dict) else None,
                li.get("unitQty", 1) or 1,
                li.get("price", 0),
                (li.get("price", 0) or 0) / 100.0,
                dt_str,
                hour,
                order_type,
                discount_name,
                mod_str
            ))

    for pay in payments:
        p_time = pay.get("createdTime")
        p_dt_str = pd.to_datetime(p_time, unit="ms").isoformat() if p_time else None
        order_ref = pay.get("order", {}).get("id") if isinstance(pay.get("order"), dict) else None

        cur.execute("""
            INSERT OR REPLACE INTO payments (
                payment_id, order_id, created_time, amount_cents, amount_usd, tender_type, result
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            pay.get("id"),
            order_ref,
            p_dt_str,
            pay.get("amount", 0),
            (pay.get("amount", 0) or 0) / 100.0,
            pay.get("tender", {}).get("label") if isinstance(pay.get("tender"), dict) else "Unknown",
            pay.get("result")
        ))

    conn.commit()

def run_backfill(start_date_str: str = DEFAULT_START_DATE, force: bool = False):
    creds = get_secure_credentials()
    headers = get_headers()

    init_db(MASTER_DB_PATH)

    now_ny = datetime.now(LOCAL_TZ)
    start_dt = datetime.strptime(start_date_str, "%Y-%m-%d").replace(tzinfo=LOCAL_TZ)

    checkpoint = {}
    if CHECKPOINT_PATH.is_file() and not force:
        try:
            with open(CHECKPOINT_PATH, "r") as f:
                checkpoint = json.load(f)
        except Exception:
            checkpoint = {}

    completed_windows = set(checkpoint.get("completed_windows", []))

    # Generate 7-day windows from start_dt to now_ny
    windows = []
    curr = start_dt
    while curr < now_ny:
        next_curr = min(curr + timedelta(days=WINDOW_DAYS), now_ny)
        windows.append((curr, next_curr))
        curr = next_curr

    print("=" * 70)
    print(" Yellow Rose BBQ — Complete Clover Historical Backfill Engine")
    print("=" * 70)
    print(f"Target Start Date:  {start_date_str} (Opening Day)")
    print(f"Target End Date:    {now_ny.strftime('%Y-%m-%d %H:%M:%S EST')}")
    print(f"Total 7-Day Slices: {len(windows)}")
    print(f"Master Database:    {MASTER_DB_PATH}")
    print(f"Rate Pacing:        {RATE_LIMIT_DELAY}s/request (Polite 2 req/s ceiling)")
    print("-" * 70)

    conn = sqlite3.connect(MASTER_DB_PATH)
    total_new_orders = 0
    total_new_items = 0

    try:
        for idx, (w_start, w_end) in enumerate(windows, 1):
            w_key = f"{w_start.strftime('%Y-%m-%d')}_{w_end.strftime('%Y-%m-%d')}"
            if w_key in completed_windows and not force:
                print(f"[{idx:02d}/{len(windows)}] Window {w_start.strftime('%Y-%m-%d')} to {w_end.strftime('%Y-%m-%d')} — ALREADY COMPLETED (Skipping)")
                continue

            start_ms = int(w_start.timestamp() * 1000)
            end_ms = int(w_end.timestamp() * 1000)

            print(f"[{idx:02d}/{len(windows)}] Querying Clover for {w_start.strftime('%Y-%m-%d')} -> {w_end.strftime('%Y-%m-%d')}...", end="", flush=True)

            orders = fetch_window_orders(creds["base_url"], creds["merchant_id"], headers, start_ms, end_ms)
            payments = fetch_window_payments(creds["base_url"], creds["merchant_id"], headers, start_ms, end_ms)

            store_records(conn, orders, payments)

            # Count line items in this batch
            item_count = sum(len(o.get("lineItems", {}).get("elements", [])) for o in orders if isinstance(o.get("lineItems"), dict))
            total_new_orders += len(orders)
            total_new_items += item_count

            print(f" DONE: {len(orders)} orders, {item_count} items, {len(payments)} payments.")

            completed_windows.add(w_key)
            with open(CHECKPOINT_PATH, "w") as f:
                json.dump({
                    "last_updated": datetime.now(LOCAL_TZ).isoformat(),
                    "completed_windows": sorted(list(completed_windows)),
                    "total_orders_backfilled": total_new_orders,
                    "total_items_backfilled": total_new_items
                }, f, indent=2)

    finally:
        conn.close()

    # Sync to local clover_api database so local analytics engines use the full history
    CLOVER_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(MASTER_DB_PATH, CLOVER_DB_PATH)
    print(f"[SYNC] Mirrored master database to {CLOVER_DB_PATH}")

    # Summary
    conn = sqlite3.connect(MASTER_DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT count(*), min(date(created_time)), max(date(created_time)), count(distinct date(created_time)) FROM orders")
    order_stats = cur.fetchone()
    cur.execute("SELECT count(*) FROM order_line_items")
    item_count = cur.fetchone()[0]
    conn.close()

    print("=" * 70)
    print(" [BACKFILL COMPLETE] Clover POS Historical Database Fully Assembled")
    print("=" * 70)
    print(f"Total Unique Days:  {order_stats[3]} service days")
    print(f"Earliest Order:     {order_stats[1]}")
    print(f"Latest Order:       {order_stats[2]}")
    print(f"Total Orders:       {order_stats[0]:,}")
    print(f"Total Line Items:   {item_count:,}")
    print("=" * 70)

if __name__ == "__main__":
    force_run = "--force" in sys.argv
    start_arg = DEFAULT_START_DATE
    for i, a in enumerate(sys.argv):
        if a == "--start-date" and i + 1 < len(sys.argv):
            start_arg = sys.argv[i + 1]

    run_backfill(start_date_str=start_arg, force=force_run)
