/**
 * Yellow Rose BBQ - shop-timezone + hourly-actuals helpers.
 * Pure functions (no DOM) so they can be verified under node.
 * Shop timezone is America/New_York; never rely on the browser's timezone.
 */
(function (root) {
  const SHOP_TZ = 'America/New_York';
  const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/;

  /** YYYY-MM-DD of an instant in the shop timezone. */
  function shopDateStr(date) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: SHOP_TZ, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(date);
  }

  /** Hour (0-23) of an instant in the shop timezone. */
  function shopHour(date) {
    const h = new Intl.DateTimeFormat('en-US', {
      timeZone: SHOP_TZ, hour: 'numeric', hourCycle: 'h23'
    }).format(date);
    return parseInt(h, 10) % 24;
  }

  /**
   * "October 14, 2026 at 11:38 PM EDT" for a tz-aware ISO string.
   * Legacy naive strings are treated as shop wall-clock time and shown with "ET".
   */
  function formatShopTimestamp(iso) {
    if (!iso || typeof iso !== 'string') return null;
    if (HAS_ZONE.test(iso.trim())) {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return null;
      const datePart = d.toLocaleDateString('en-US', {
        timeZone: SHOP_TZ, month: 'long', day: 'numeric', year: 'numeric'
      });
      const timePart = d.toLocaleTimeString('en-US', {
        timeZone: SHOP_TZ, hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
      });
      return `${datePart} at ${timePart}`;
    }
    const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
    if (!m) return null;
    const wall = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
    const datePart = wall.toLocaleDateString('en-US', {
      timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric'
    });
    const timePart = wall.toLocaleTimeString('en-US', {
      timeZone: 'UTC', hour: 'numeric', minute: '2-digit'
    });
    return `${datePart} at ${timePart} ET`;
  }

  function weekdayIndexMon0(dateStr) {
    const d = new Date(dateStr + 'T00:00:00Z');
    return (d.getUTCDay() + 6) % 7;
  }

  /**
   * Build chart series + summary for one shop-local date.
   * forecastRecords: [{hour, predicted_orders, predicted_revenue}]
   * Returns null when the date is in the future (forecast-only).
   */
  function buildActualsOverlay(actuals, snapshots, dateStr, forecastRecords, now) {
    const today = shopDateStr(now);
    if (dateStr > today) return null;
    const isToday = dateStr === today;
    const cutoff = isToday ? shopHour(now) : 23;
    const dayData = actuals && actuals.days ? actuals.days[dateStr] : null;
    const recs = Array.isArray(forecastRecords) ? forecastRecords : [];

    const actualOrders = recs.map(r => {
      if (!dayData || r.hour > cutoff) return null;
      return dayData.buckets[r.hour] ? dayData.buckets[r.hour].orders : null;
    });

    // Reconstructed baseline: same-weekday average, excluding the picked date.
    let baselineOrders = null;
    const base = actuals && actuals.weekday_baseline
      ? actuals.weekday_baseline[String(weekdayIndexMon0(dateStr))] : null;
    if (base) {
      const n = base.n - (dayData ? 1 : 0);
      if (n > 0) {
        baselineOrders = recs.map(r => {
          const own = dayData && dayData.buckets[r.hour] ? dayData.buckets[r.hour].orders : 0;
          const sum = base.orders_sum[r.hour] - own;
          return Math.round((sum / n) * 10) / 10;
        });
      }
    }

    const snap = snapshots && snapshots[dateStr] ? snapshots[dateStr].hourly_forecast : null;
    const snapshotOrders = snap
      ? recs.map(r => { const s = snap.find(x => x.hour === r.hour); return s ? s.predicted_orders : null; })
      : null;

    let actualSales = 0;
    let actualOrderCount = 0;
    let forecastToHour = 0;
    let forecastFullDay = 0;
    recs.forEach(r => {
      const rev = r.predicted_revenue || 0;
      forecastFullDay += rev;
      if (r.hour <= cutoff) {
        forecastToHour += rev;
        if (dayData && dayData.buckets[r.hour]) {
          actualSales += dayData.buckets[r.hour].sales_usd;
          actualOrderCount += dayData.buckets[r.hour].orders;
        }
      }
    });

    return {
      date: dateStr,
      isToday,
      cutoffHour: cutoff,
      hasActuals: !!dayData,
      actualOrders,
      baselineOrders,
      snapshotOrders,
      summary: {
        actualSales: Math.round(actualSales * 100) / 100,
        actualOrders: actualOrderCount,
        forecastToHour: Math.round(forecastToHour * 100) / 100,
        forecastFullDay: Math.round(forecastFullDay * 100) / 100
      }
    };
  }

  const api = { SHOP_TZ, shopDateStr, shopHour, formatShopTimestamp, buildActualsOverlay };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ShopTime = api;
})(typeof window !== 'undefined' ? window : globalThis);
