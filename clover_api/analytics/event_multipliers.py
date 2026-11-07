"""
Measured event multipliers (single source for the calendar and the event analytics).

multiplier = median over event days of (that day's sales / median sales of normal days on the same weekday).
- "Normal" days are open days (sales >= MIN_REVENUE) that are not on the event calendar.
- Days under MIN_REVENUE are skipped: they are closed or partial days, not a result.
- A category needs MIN_EVENT_DAYS usable days, otherwise its multiplier is None (callers use 1.0, no effect).
"""

import statistics
from datetime import datetime

MIN_REVENUE = 1500.0
MIN_EVENT_DAYS = 3
MIN_NORMAL_PER_WEEKDAY = 3
NOISE_BAND = 0.15  # day-to-day swings of a normal day are bigger than this, so a smaller effect is not a result


def applied_multiplier(measured):
    """The multiplier the forecast should use: the measured value only when it clears the noise band, else 1.0."""
    if measured is None or abs(measured - 1.0) < NOISE_BAND:
        return 1.0
    return round(measured, 1)


def _weekday(date_str):
    return datetime.strptime(date_str, "%Y-%m-%d").strftime("%a")


def measure_multipliers(daily_revenue, event_dates_by_category):
    """daily_revenue: {YYYY-MM-DD: sales_usd}; event_dates_by_category: {category: iterable of dates}.

    Returns {category: {"multiplier": float|None, "days": int, "ratios": [..]}}.
    """
    event_dates = set()
    for dates in event_dates_by_category.values():
        event_dates.update(dates)

    by_weekday = {}
    for date, rev in daily_revenue.items():
        if date in event_dates or rev is None or not (rev >= MIN_REVENUE):  # also skips NaN
            continue
        by_weekday.setdefault(_weekday(date), []).append(rev)
    baseline = {d: statistics.median(v) for d, v in by_weekday.items() if len(v) >= MIN_NORMAL_PER_WEEKDAY}

    out = {}
    for category, dates in event_dates_by_category.items():
        ratios = []
        for date in dates:
            rev = daily_revenue.get(date)
            base = baseline.get(_weekday(date)) if rev is not None else None
            if base and rev is not None and rev >= MIN_REVENUE:
                ratios.append(rev / base)
        usable = len(ratios) >= MIN_EVENT_DAYS
        out[category] = {
            "multiplier": round(statistics.median(ratios), 2) if usable else None,
            "days": len(ratios),
            "ratios": [round(r, 2) for r in ratios],
        }
    return out
