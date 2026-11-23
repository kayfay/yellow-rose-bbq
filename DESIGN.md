# DESIGN.md — JD Proactive Analytics Pipeline & Voice Contract

## 1. 2D Data Pipeline Blueprint
```text
+-----------------------------------+
|  Clover Sales DB + full_cogs.json |
|  + predictive_payload.json        |
+-----------------+-----------------+
                  |
                  v
+-------------------------------------------------------------------+
|            JD Background Analytics Engine (services/analytics/)   |
|  +--------------------+ +--------------------+ +----------------+ |
|  | hourly_velocity.py | | meat_depletion_    | | margin_drift_  | |
|  | (4-wk same-hr med) | | timer.py (runout)  | | detector.py    | |
|  +---------+----------+ +---------+----------+ +-------+--------+ |
+------------|----------------------|--------------------|----------+
             +----------------------+--------------------+
                                    |
                                    v
                  +-----------------------------------+
                  |     insight_synthesizer.py        |
                  |  Priority Ranker:                 |
                  |   1. Meat Run-Out Risk            |
                  |   2. Sales Pace vs. 4-Wk Median   |
                  |   3. Full Food Cost % & Margin    |
                  +-----------------+-----------------+
                                    |
                                    v
                  +-----------------------------------+
                  |   agents/jd/jd_voice_contract.py  |
                  |   agents/jd/message_formatter.py  |
                  |  (Kitchen Voice + [Boss Alert:])  |
                  +-----------------+-----------------+
                                    |
                                    v
                  +-----------------------------------+
                  |  JD Proactive Check-In / Dispatch |
                  |  (Outlier Alerts + Ambient Pacing)|
                  +-----------------------------------+
```

---

## 2. Modular Directory Structure & Typed Contracts

```text
services/
  analytics/
    __init__.py
    schemas.py               # Dataclasses: HourlyInsightPayload, JDMessageContext
    hourly_velocity.py       # Trailing 4-week same-day/same-hour median pace engine
    meat_depletion_timer.py  # Physical cut burn rate & stockout timestamp projection
    margin_drift_detector.py # Full Food Cost % (Meat vs. Non-Meat) & side attachment rate
    insight_synthesizer.py   # Ranks anomalies (1: Run-Out, 2: Pace, 3: Food Cost) -> JSON
agents/
  jd/
    __init__.py
    jd_voice_contract.py     # Greeting styles, banned jargon guard, [Boss Alert:] rules
    message_formatter.py     # Fuses HourlyInsightPayload into natural JD kitchen messages
clover_api/tests/
  test_jd_analytics.py       # Deterministic grounding, math parity & voice contract tests
```

### Typed Schema (`services/analytics/schemas.py`)
```python
@dataclass
class HourlyInsightPayload:
    generated_at: str
    service_date: str
    day_name: str
    is_closed: bool
    active_service_hour: int
    # Priority 1: Meat Run-Out
    meat_alerts: List[Dict[str, Any]]
    # Priority 2: Sales Pace
    current_hour_revenue_usd: float
    trailing_4wk_median_usd: float
    pace_delta_usd: float
    pace_delta_pct: float
    is_pace_outlier: bool
    # Priority 3: Full Food Cost & Margin
    meat_cost_pct: Optional[float]
    full_food_cost_pct: Optional[float]
    side_attachment_pct: float
    is_food_cost_alert: bool
    # Ranked Top Takeaway
    top_priority_category: str  # "meat_runout" | "sales_pace" | "food_cost" | "ambient_pacing"
    boss_alert_tag: Optional[str]
    recommended_action: str
```
