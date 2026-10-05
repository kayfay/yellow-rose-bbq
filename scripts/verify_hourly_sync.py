import sys
import os
import sqlite3
from unittest.mock import patch
from datetime import datetime

# Setup path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'clover_api'))
import ingest_hourly
from secure_config import DB_PATH
from init_db import init_schema

MOCK_ORDERS_PAYLOAD = {
    "elements": [
        {
            "id": "O_123",
            "createdTime": 1700000000000,
            "total": 1500,
            "currency": "USD",
            "state": "PAID"
        }
    ]
}

def mock_fetch_clover_endpoint(endpoint, params=None):
    if endpoint == "orders":
        return MOCK_ORDERS_PAYLOAD
    return {"elements": []}

@patch('ingest_hourly.fetch_clover_endpoint', side_effect=mock_fetch_clover_endpoint)
def verify(mock_fetch):
    # Ensure fresh schema
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    init_schema()

    print("Running initial sync via hourly_sync_job.py simulation...")
    sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'scripts'))
    import hourly_sync_job
    hourly_sync_job.run_ingestion = ingest_hourly.run_ingestion # use the mocked one
    
    # Run the job simulation which also generates the status file
    try:
        hourly_sync_job.run_ingestion(hourly=True)
        hourly_sync_job.update_status_file("success")
    except Exception as e:
        print(f"Failed: {e}")
    
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM orders")
    count_1 = cur.fetchone()[0]
    
    print("Running second sync (idempotency check)...")
    ingest_hourly.run_ingestion(hourly=True)
    
    cur.execute("SELECT COUNT(*) FROM orders")
    count_2 = cur.fetchone()[0]
    
    print(f"Row count after run 1: {count_1}")
    print(f"Row count after run 2: {count_2}")
    
    assert count_1 == 1, "Expected 1 row after first run"
    assert count_2 == 1, "Expected exactly 1 row after second run (deduplication failed!)"
    print("Idempotency verification passed.")
    
    # Verify last synced timestamp endpoint data
    import json
    status_path = os.path.join(os.path.dirname(__file__), '..', 'analytics', 'sync_status.json')
    with open(status_path, "r") as f:
        status = json.load(f)
    last_synced = status.get("last_synced_at")
    assert last_synced, "last_synced_at not found in status file"
    # Validate ISO format
    datetime.fromisoformat(last_synced)
    print(f"Verified last_synced_at timestamp: {last_synced}")

    order_calls = [call for call in mock_fetch.call_args_list if call[0][0] == 'orders']
    assert order_calls, "No calls to orders endpoint found"
    params = order_calls[0][1].get('params', {})
    filter_str = params.get('filter')
    assert filter_str and filter_str.startswith('modifiedTime>='), "Did not find expected filter string for hourly window"
    print(f"Verified hourly window filter: {filter_str}")

if __name__ == "__main__":
    verify()
    print("ALL VERIFICATIONS PASSED")
    sys.exit(0)
