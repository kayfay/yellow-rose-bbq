"""
Yellow Rose BBQ - Hourly Actuals Builder

Aggregates POS orders into 24 hourly buckets per local (America/New_York) day and
writes `hourly_actuals.json` (consumed by the dashboard via payloads.js).

Invariants (see .loop/patterns.md):
  * `orders.created_time` is stored as naive UTC (pd.to_datetime(unit="ms")).
  * Bucketing always happens AFTER converting UTC -> America/New_York.
  * Every day has exactly 24 zero-filled buckets (hour 0-23).
"""

import json
import sqlite3
import sys
from collections import defaultdict
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple
from zoneinfo import ZoneInfo

LOCAL_TZ_NAME = "America/New_York"
LOCAL_TZ = ZoneInfo(LOCAL_TZ_NAME)
ANALYTICS_DIR = Path(__file__).resolve().parent
DEFAULT_DB_PATH = ANALYTICS_DIR.parent / "data" / "clover_sales.db"
OUT_FILE = ANALYTICS_DIR / "hourly_actuals.json"
SNAPSHOT_FILE = ANALYTICS_DIR / "forecast_snapshots.json"


def local_now() -> datetime:
    """Timezone-aware 'now' in the shop's operating timezone."""
    return datetime.now(LOCAL_TZ)


def utc_naive_to_local(value: Any) -> Optional[datetime]:
    """Convert a naive-UTC DB timestamp (str or datetime) to aware America/New_York."""
    if value is None:
        return None
    if isinstance(value, str):
        text = value.strip().replace(" ", "T")
        if not text:
            return None
        try:
            dt = datetime.fromisoformat(text)
        except ValueError:
            return None
    else:
        dt = value
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(LOCAL_TZ)


def empty_buckets() -> List[Dict[str, Any]]:
    return [{"hour": h, "sales_usd": 0.0, "orders": 0} for h in range(24)]


def bucket_orders(rows: Iterable[Tuple[Any, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """
    rows: iterable of (created_time_utc, total_usd).
    Returns {local_date 'YYYY-MM-DD': 24 buckets}. Deterministic, no I/O.
    """
    days: Dict[str, List[Dict[str, Any]]] = {}
    for created, total in rows:
        local = utc_naive_to_local(created)
        if local is None:
            continue
        key = local.strftime("%Y-%m-%d")
        buckets = days.setdefault(key, empty_buckets())
        b = buckets[local.hour]
        b["sales_usd"] = round(b["sales_usd"] + float(total or 0.0), 2)
        b["orders"] += 1
    return days


def _fetch_rows(db_conn: sqlite3.Connection) -> List[Tuple[Any, Any]]:
    cur = db_conn.execute(
        "SELECT created_time, total_usd FROM orders "
        "WHERE lower(COALESCE(state, '')) = 'locked' AND created_time IS NOT NULL"
    )
    return cur.fetchall()


def get_hourly_actuals_for_date(db_conn: sqlite3.Connection, target_date_str: str) -> List[Dict[str, Any]]:
    """
    24 hourly buckets for a LOCAL calendar date (YYYY-MM-DD).
    Raises ValueError on a malformed date.
    """
    date.fromisoformat(target_date_str)  # validates
    return bucket_orders(_fetch_rows(db_conn)).get(target_date_str, empty_buckets())


def build_weekday_baseline(days: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
    """
    Per-weekday (0=Mon..6=Sun) sums and day counts. The UI subtracts the picked
    date from its own weekday before averaging, so the baseline excludes it.
    """
    agg: Dict[int, Dict[str, Any]] = defaultdict(
        lambda: {"n": 0, "sales_sum": [0.0] * 24, "orders_sum": [0] * 24}
    )
    for key, buckets in days.items():
        dow = date.fromisoformat(key).weekday()
        entry = agg[dow]
        entry["n"] += 1
        for b in buckets:
            entry["sales_sum"][b["hour"]] = round(entry["sales_sum"][b["hour"]] + b["sales_usd"], 2)
            entry["orders_sum"][b["hour"]] += b["orders"]
    return {str(dow): agg[dow] for dow in sorted(agg)}


def build_payload(db_conn: sqlite3.Connection, now: Optional[datetime] = None) -> Dict[str, Any]:
    days = bucket_orders(_fetch_rows(db_conn))
    now = now or local_now()
    return {
        "timezone": LOCAL_TZ_NAME,
        "generated_at": now.isoformat(),
        "days": {
            k: {
                "buckets": v,
                "total_sales_usd": round(sum(b["sales_usd"] for b in v), 2),
                "total_orders": sum(b["orders"] for b in v),
            }
            for k, v in sorted(days.items())
        },
        "weekday_baseline": build_weekday_baseline(days),
    }


def snapshot_forecast(predictive_path: Path, snapshot_path: Path, now: Optional[datetime] = None) -> None:
    """
    Persist today's hourly forecast so true historical forecasts accumulate.
    Snapshots for today are refreshed; snapshots for past dates are never overwritten.
    """
    now = now or local_now()
    today = now.strftime("%Y-%m-%d")
    if not snapshot_path.exists():
        snapshot_path.write_text("{}")
    if not predictive_path.exists():
        return
    try:
        predictive = json.loads(predictive_path.read_text())
    except json.JSONDecodeError:
        return
    forecast = predictive.get("hourly_forecast") or []
    recs = [
        {
            "hour": r.get("hour"),
            "predicted_orders": r.get("predicted_orders"),
            "predicted_revenue": r.get("predicted_revenue"),
        }
        for r in forecast
        if r.get("hour") is not None and str(r.get("timestamp", ""))[:10] == today
    ]
    if not recs:
        return
    store: Dict[str, Any] = {}
    if snapshot_path.exists():
        try:
            store = json.loads(snapshot_path.read_text())
        except json.JSONDecodeError:
            store = {}
    store[today] = {"captured_at": now.isoformat(), "hourly_forecast": recs}
    snapshot_path.write_text(json.dumps(dict(sorted(store.items())), indent=2))


def export_hourly_actuals(db_path: Path = DEFAULT_DB_PATH, out_file: Path = OUT_FILE) -> Dict[str, Any]:
    conn = sqlite3.connect(db_path)
    try:
        payload = build_payload(conn)
    finally:
        conn.close()
    out_file.write_text(json.dumps(payload, indent=2))
    snapshot_forecast(ANALYTICS_DIR / "predictive_payload.json", SNAPSHOT_FILE)
    print(f"[HOURLY ACTUALS] {len(payload['days'])} days written to {out_file}")
    return payload


if __name__ == "__main__":
    try:
        export_hourly_actuals()
    except Exception as exc:  # pipeline must not silently drop data
        import traceback

        print(f"[FATAL ERROR] hourly actuals failed: {exc}")
        traceback.print_exc()
        sys.exit(1)
