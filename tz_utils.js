/**
 * Yellow Rose BBQ - shop-timezone + hourly-actuals helpers.
 * Pure functions (no DOM) so they can be verified under node.
 * Shop timezone is America/New_York; never rely on the browser's timezone.
 */
(function (root) {
  const SHOP_TZ = 'America/New_York';
  const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/;

  let simulatedNow = null;

  function setSimulatedNow(val) {
    if (!val) {
      simulatedNow = null;
      return null;
    }
    const d = val instanceof Date ? new Date(val.getTime()) : new Date(val);
    simulatedNow = isNaN(d.getTime()) ? null : d;
    return simulatedNow;
  }

  function clearSimulatedNow() {
    simulatedNow = null;
  }

  function getEffectiveNow() {
    return simulatedNow ? new Date(simulatedNow.getTime()) : new Date();
  }

  function isSimulating() {
    return simulatedNow !== null;
  }

  /** YYYY-MM-DD of an instant in the shop timezone. */
  function shopDateStr(date) {
    const d = date || getEffectiveNow();
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: SHOP_TZ, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(d);
  }

  /** Hour (0-23) of an instant in the shop timezone. */
  function shopHour(date) {
    const d = date || getEffectiveNow();
    const h = new Intl.DateTimeFormat('en-US', {
      timeZone: SHOP_TZ, hour: 'numeric', hourCycle: 'h23'
    }).format(d);
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
    const effNow = now || getEffectiveNow();
    const today = shopDateStr(effNow);
    if (dateStr > today) return null;
    const isToday = dateStr === today;
    const cutoff = isToday ? shopHour(effNow) : 23;
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

  /**
   * Compute hour-by-hour turnover and blended summary for a given date.
   * Distinguishes:
   *   - 'actual': hour has elapsed (< cutoff on today, or all hours on past date)
   *   - 'live': current hour in progress (=== cutoff on today)
   *   - 'predicted': upcoming hour (> cutoff on today, or future date)
   */
  function computeBlendedDayMetrics(actuals, forecastRecords, now, dateStr) {
    const effNow = now || getEffectiveNow();
    const today = shopDateStr(effNow);
    const targetDate = dateStr || today;
    const isToday = targetDate === today;
    const isPast = targetDate < today;
    const isFuture = targetDate > today;
    const cutoff = isPast ? 23 : (isToday ? shopHour(effNow) : -1);

    const dayData = actuals && actuals.days ? actuals.days[targetDate] : null;
    const recs = Array.isArray(forecastRecords) ? forecastRecords : [];

    const hourly = [];
    let actualSalesSoFar = 0;
    let actualOrdersSoFar = 0;
    let forecastToHour = 0;
    let forecastRemaining = 0;
    let forecastFullDay = 0;

    for (let h = 0; h < 24; h++) {
      const rec = recs.find(r => r.hour === h) || {};
      const actualBucket = (dayData && dayData.buckets && dayData.buckets[h])
        ? dayData.buckets[h]
        : { sales_usd: 0.0, orders: 0 };

      const predRev = Number(rec.predicted_revenue || 0);
      const predOrders = Number(rec.predicted_orders || 0);
      const brisketLbs = Number(rec.brisket_cooked_lbs || 0);
      const porkLbs = Number(rec.pork_cooked_lbs || 0);
      forecastFullDay += predRev;

      let status = 'predicted';
      if (isPast) {
        status = 'actual';
      } else if (isToday) {
        if (h < cutoff) {
          status = 'actual';
        } else if (h === cutoff) {
          status = 'live';
        } else {
          status = 'predicted';
        }
      } else {
        status = 'predicted';
      }

      const actSales = actualBucket.sales_usd;
      const actOrders = actualBucket.orders;

      if (status === 'actual' || status === 'live') {
        actualSalesSoFar += actSales;
        actualOrdersSoFar += actOrders;
        forecastToHour += predRev;
      } else {
        forecastRemaining += predRev;
      }

      // Variance calculation
      const varSales = Math.round((actSales - predRev) * 100) / 100;
      const varOrders = actOrders - predOrders;
      const varPct = predRev > 0 ? Math.round(((actSales - predRev) / predRev) * 1000) / 10 : 0;

      // Format 12-hour display string
      const hour12 = h === 0 ? 12 : (h > 12 ? h - 12 : h);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hourDisplay = `${hour12}:00 ${ampm}`;

      hourly.push({
        hour: h,
        hourDisplay,
        status, // 'actual' | 'live' | 'predicted'
        actualSales: actSales,
        actualOrders: actOrders,
        predictedRevenue: predRev,
        predictedOrders: predOrders,
        varianceSales: varSales,
        varianceOrders: varOrders,
        variancePct: varPct,
        brisketCookedLbs: brisketLbs,
        porkCookedLbs: porkLbs
      });
    }

    const blendedTotalRevenue = Math.round((actualSalesSoFar + forecastRemaining) * 100) / 100;
    const pacingUsd = Math.round((actualSalesSoFar - forecastToHour) * 100) / 100;
    const pacingPct = forecastToHour > 0 ? Math.round(((actualSalesSoFar - forecastToHour) / forecastToHour) * 1000) / 10 : 0;

    return {
      date: targetDate,
      isToday,
      isPast,
      isFuture,
      cutoffHour: cutoff,
      hasActuals: !!dayData,
      hourly,
      summary: {
        actualSalesSoFar: Math.round(actualSalesSoFar * 100) / 100,
        actualOrdersSoFar,
        forecastToHour: Math.round(forecastToHour * 100) / 100,
        forecastRemaining: Math.round(forecastRemaining * 100) / 100,
        forecastFullDay: Math.round(forecastFullDay * 100) / 100,
        blendedTotalRevenue,
        pacingUsd,
        pacingPct
      }
    };
  }

  const api = {
    SHOP_TZ,
    setSimulatedNow,
    clearSimulatedNow,
    getEffectiveNow,
    isSimulating,
    shopDateStr,
    shopHour,
    formatShopTimestamp,
    buildActualsOverlay,
    computeBlendedDayMetrics
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ShopTime = api;
})(typeof window !== 'undefined' ? window : globalThis);

