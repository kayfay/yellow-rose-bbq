/**
 * Yellow Rose BBQ — Forecaster Subtabs, Live Pacing & Executive BI Charts Module
 * Manages Shift Heatmap, Advanced Analytics & Sell-Out Trajectory, Event Impact &
 * Interactive Multiplier Calendar, Weather Impact, 24-Hour Predictive Velocity,
 * Hourly Rush Turnover Deck, and the Time-Travel Clock Simulator.
 */
(function (global) {
  'use strict';

  global.BBQModules = global.BBQModules || {};

  function handleDateSelectionLookup(selectedDateStr) {
    if (!selectedDateStr || typeof selectedDateStr !== 'string') return;
    const d = global.parseValidDate(selectedDateStr);
    if (!d) return;
    const dateFormatted = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      weekday: 'short'
    });

    const histCard = document.getElementById('historical-reference-card');
    if (!histCard) return;

    const dNow = new Date();
    const tzOffset = dNow.getTimezoneOffset() * 60000;
    const todayStr = (new Date(dNow.getTime() - tzOffset)).toISOString().split('T')[0];
    const isPast = selectedDateStr < todayStr;

    if (isPast) {
      histCard.style.display = 'block';
      const dow = d.getDay(); // 0=Sun, 6=Sat

      const dateLabel = document.getElementById('hist-date-label');
      const demandVal = document.getElementById('hist-demand-val');
      const weatherVal = document.getElementById('hist-weather-val');
      const eventVal = document.getElementById('hist-event-val');

      if (dateLabel) dateLabel.textContent = dateFormatted;

      // Real record for that date: actual sales vs the median of the same weekday, plus any calendar event. No typed-in text.
      const P = global.BBQ_PAYLOADS || {};
      const recs = (P.historical_payload && P.historical_payload.historical_records) || [];
      const rec = recs.find(r => r && r.date === selectedDateStr);
      const dayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dow];
      const dayLong = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dow];
      const peers = recs.filter(r => r && r.day_name === dayShort && r.date !== selectedDateStr && (r.actual_revenue || 0) >= 1500).map(r => r.actual_revenue).sort((x, y) => x - y);
      const median = peers.length >= 3 ? (peers.length % 2 ? peers[(peers.length - 1) / 2] : (peers[peers.length / 2 - 1] + peers[peers.length / 2]) / 2) : null;
      const cal = Array.isArray(P.calendar_events) ? P.calendar_events.find(e => e && e.date === selectedDateStr) : null;
      if (demandVal) {
        if (rec && (rec.actual_revenue || 0) > 0 && median) demandVal.textContent = `${(rec.actual_revenue / median).toFixed(2)}x a typical ${dayLong} ($${Math.round(rec.actual_revenue).toLocaleString()} sold)`;
        else if (rec && (rec.actual_revenue || 0) > 0) demandVal.textContent = `$${Math.round(rec.actual_revenue).toLocaleString()} sold`;
        else demandVal.textContent = dow === 1 ? 'Closed (Monday)' : 'No sales recorded';
      }
      if (eventVal) eventVal.textContent = cal ? cal.title : 'No event on the calendar';
      if (weatherVal) weatherVal.textContent = 'Not recorded for past days';
    } else {
      histCard.style.display = 'none';
    }

    if (typeof renderPlotlyPredictiveChart === 'function') {
      renderPlotlyPredictiveChart();
    }
  }

  async function renderPlotlyShiftHeatmap(shift) {
    const container = document.getElementById('plotly-shift-heatmap');
    if (!container) return;

    if (!shift) {
      const shiftSelector = document.getElementById('shift-selector');
      shift = shiftSelector ? shiftSelector.value : 'all';
    }

    const hours = Array.from({ length: 24 }, (_, i) => {
      const h12 = i === 0 ? 12 : (i > 12 ? i - 12 : i);
      const ampm = i >= 12 ? 'PM' : 'AM';
      return `${h12}:00 ${ampm} EST`;
    });
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const defaultZ = days.map((d) => {
      return hours.map((_, h) => {
        if (h < 10 || h > 21) return 0;
        if (d === 'Saturday') return h === 12 || h === 18 ? 4.5 : (h >= 11 && h <= 20 ? 3.0 : 1.0);
        if (d === 'Friday') return h === 12 || h === 18 ? 3.5 : (h >= 11 && h <= 20 ? 2.5 : 0.8);
        if (d === 'Sunday') return h >= 11 && h <= 15 ? 2.8 : 0.5;
        if (d === 'Monday') return 0;
        return h >= 11 && h <= 14 ? 1.8 : (h >= 17 && h <= 20 ? 1.4 : 0.4);
      });
    });

    const defaultShiftLayout = {
      title: 'Historical & Predicted Hourly Sales Demand Heatmap',
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(20,20,30,0.6)',
      font: { color: '#f8fafc', family: 'Inter, system-ui, sans-serif', size: 10 },
      xaxis: { title: 'Time of Day (Pit Operating Window - 12-Hour EST)', gridcolor: '#334155', color: '#94a3b8' },
      yaxis: { gridcolor: '#334155', color: '#94a3b8' },
      margin: { l: 80, r: 40, t: 50, b: 50 }
    };

    try {
      let payload = global.BBQ_PAYLOADS?.shift_payload || null;
      if (!payload && typeof global.fetchJsonSafe === 'function') {
        payload = await global.fetchJsonSafe('clover_api/analytics/shift_payload.json?v=' + Date.now(), null, 4000);
      }
      if (payload && payload.plotly_heatmap && Array.isArray(payload.plotly_heatmap.data)) {
        const traces = JSON.parse(JSON.stringify(payload.plotly_heatmap.data));
        const layout = JSON.parse(JSON.stringify(payload.plotly_heatmap.layout || defaultShiftLayout));
        layout.plot_bgcolor = 'rgba(0,0,0,0)';
        layout.paper_bgcolor = 'rgba(0,0,0,0)';
        layout.font = { family: 'Inter, system-ui, sans-serif', color: '#94a3b8', size: 10 };
        if (layout.xaxis) {
          layout.xaxis.showgrid = false;
          layout.xaxis.zerolinecolor = '#334155';
          layout.xaxis.color = '#94a3b8';
        }
        if (traces.length > 0) {
          traces[0].colorscale = 'YlOrBr';
        }

        if (typeof d3 !== 'undefined' && typeof global.renderD3GenericChart === 'function') {
          global.renderD3GenericChart('plotly-shift-heatmap', traces, layout.title, true, shift);
          if (typeof global.injectMobileFaceCallouts === 'function') {
            global.injectMobileFaceCallouts(
              container,
              'Sat 12:00 PM – 2:00 PM (Peak Rush)',
              'Wed 3:00 PM – 4:00 PM (Midday Lull)',
              '11:00 AM – 9:00 PM Service Window'
            );
          }
        }
        return;
      }
    } catch (_err) {
      // Fallback to embedded shift heatmap dataset
    }

    const defaultShiftTraces = [{
      x: hours,
      y: days,
      z: defaultZ,
      type: 'heatmap',
      colorscale: 'YlOrBr',
      colorbar: { title: 'Relative Rush Density' }
    }];

    if (typeof d3 !== 'undefined' && typeof global.renderD3GenericChart === 'function') {
      global.renderD3GenericChart('plotly-shift-heatmap', defaultShiftTraces, defaultShiftLayout.title, true, shift);
      if (typeof global.injectMobileFaceCallouts === 'function') {
        global.injectMobileFaceCallouts(
          container,
          'Sat 12:00 PM – 2:00 PM (Peak Rush)',
          'Wed 3:00 PM – 4:00 PM (Midday Lull)',
          '11:00 AM – 9:00 PM Service Window'
        );
      }
    }
  }

  function renderAdvancedAnalytics() {
    const payload = global.BBQ_PAYLOADS?.advanced_payload || {};

    if (payload.market_basket) {
      const basketList = document.getElementById('market-basket-list');
      if (basketList) {
        basketList.innerHTML = payload.market_basket.map(item =>
          `<li><strong>${global.escapeHTML(item.pair)}</strong>: Bought together ${item.count} times (${item.confidence}% confidence)</li>`
        ).join('');
      }
    }

    const interList = document.getElementById('interaction-list');
    if (interList) {
      const im = payload.interaction_modeling || {};
      interList.innerHTML = `
        <li><strong>Normal Day Avg:</strong> $${Number(im.normal || 0).toFixed(2)}</li>
        <li><strong>Jaguars Game (Ideal Weather):</strong> $${Number(im.game_only || 0).toFixed(2)}</li>
        <li><strong>Heavy Rain (No Event):</strong> $${Number(im.rain_only || 0).toFixed(2)}</li>
        <li><strong>Jaguars Game + Heavy Rain:</strong> $${Number(im.game_and_rain || 0).toFixed(2)}</li>
      `;
    }

    const orderTypeList = document.getElementById('order-type-list');
    if (orderTypeList && Array.isArray(payload.order_type_segmentation)) {
      orderTypeList.innerHTML = '<ul>' + payload.order_type_segmentation.map(ot =>
        `<li><strong>${global.escapeHTML(ot.order_type || 'Unknown')}</strong>: ${ot.order_count || 0} orders, generating $${(ot.total_revenue || 0).toLocaleString()} (avg $${Number(ot.avg_ticket || 0).toFixed(2)}/ticket)</li>`
      ).join('') + '</ul>';
    }

    const cannList = document.getElementById('cannibalization-list');
    if (cannList) {
      const cann = payload.cannibalization || {};
      cannList.innerHTML = `
        <li><strong>Avg Pork Ribs without Dino Ribs:</strong> ${cann.pork_ribs_avg_without_dino ?? '--'}</li>
        <li><strong>Avg Pork Ribs with Dino Ribs:</strong> ${cann.pork_ribs_avg_with_dino ?? '--'}</li>
        <li><strong>Impact on Pork Ribs:</strong> ${cann.impact_pct ?? 0}%</li>
      `;
    }

    const paydayList = document.getElementById('payday-list');
    if (paydayList) {
      const pe = payload.payday_effect || {};
      paydayList.innerHTML = `
        <li><strong>Normal Avg Ticket:</strong> $${Number(pe.normal_avg_ticket || 0).toFixed(2)}</li>
        <li><strong>Payday Avg Ticket:</strong> $${Number(pe.payday_avg_ticket || 0).toFixed(2)}</li>
      `;
    }

    const selloutChartElem = document.getElementById('plotly-sellout-chart');
    if (selloutChartElem) {
      const mobile = global.isMobileViewport();
      const defaultSelloutHours = ['11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM'];
      const defaultSelloutTraces = [
        {
          x: defaultSelloutHours,
          y: [100, 84, 66, 56, 50, 44, 34, 21, 11, 5, 2],
          name: 'Smoked Brisket Remaining (%)',
          type: 'scatter',
          mode: 'lines+markers',
          line: { color: '#D55E00', width: 3 },
          marker: { size: 6 }
        },
        {
          x: defaultSelloutHours,
          y: [100, 88, 74, 65, 58, 48, 32, 16, 7, 3, 0],
          name: 'Pork Spare Ribs Remaining (%)',
          type: 'scatter',
          mode: 'lines+markers',
          line: { color: '#CC79A7', width: 3 },
          marker: { size: 6 }
        },
        {
          x: defaultSelloutHours,
          y: [100, 90, 78, 70, 63, 55, 44, 31, 20, 12, 8],
          name: 'House Sausage Links Remaining (%)',
          type: 'scatter',
          mode: 'lines+markers',
          line: { color: '#56B4E9', width: 2.5, dash: 'dot' },
          marker: { size: 5 }
        }
      ];
      const defaultSelloutLayout = {
        height: mobile ? 300 : 340,
        title: {
          text: mobile ? 'Sell-Out Depletion Curve' : 'Hourly Smoked Meat Inventory Depletion (11 AM – 9 PM)',
          font: { size: mobile ? 11 : 13, color: '#f8fafc', family: 'Inter, system-ui, sans-serif' }
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(15,23,42,0.45)',
        font: { color: '#f8fafc', family: 'Inter, system-ui, sans-serif', size: 10 },
        xaxis: { showgrid: false, zeroline: false, tickangle: -35 },
        yaxis: { title: mobile ? 'Stock Left (%)' : 'Remaining Hot-Hold Inventory (%)', range: [0, 105], gridcolor: 'rgba(148,163,184,0.12)', zeroline: false },
        legend: { orientation: 'h', y: -0.24, x: 0 },
        margin: mobile ? { l: 38, r: 20, t: 36, b: 56 } : { l: 52, r: 30, t: 44, b: 64 }
      };

      defaultSelloutLayout.height = global.fitChartHeight(defaultSelloutLayout.height); // landscape phones: fit the short screen

      const hasPayloadChart = payload.sell_out_prediction_chart && Array.isArray(payload.sell_out_prediction_chart.data) && payload.sell_out_prediction_chart.data.length > 0;
      const sTraces = hasPayloadChart ? JSON.parse(JSON.stringify(payload.sell_out_prediction_chart.data)) : defaultSelloutTraces;
      const sLayout = hasPayloadChart ? JSON.parse(JSON.stringify(payload.sell_out_prediction_chart.layout || defaultSelloutLayout)) : defaultSelloutLayout;
      sLayout.height = mobile ? 300 : 340;
      sLayout.paper_bgcolor = 'rgba(0,0,0,0)';
      sLayout.plot_bgcolor = 'rgba(15,23,42,0.45)';
      if (sLayout.xaxis) sLayout.xaxis.showgrid = false;
      if (mobile) {
        sLayout.title = { text: 'Sell-Out Depletion Curve', font: { size: 11, color: '#f8fafc' } };
        sLayout.margin = { l: 38, r: 20, t: 36, b: 56 };
      } else {
        sLayout.margin = { l: 52, r: 30, t: 44, b: 64 };
      }
      if (typeof Plotly !== 'undefined') {
        Plotly.newPlot('plotly-sellout-chart', sTraces, sLayout, global.getPlotlyConfig());
        if (selloutChartElem.offsetWidth > 0) {
          try { Plotly.Plots.resize(selloutChartElem); } catch (_e) {}
        }
      }
      global.applyChartTouchSafety(selloutChartElem);
      if (typeof global.injectMobileFaceCallouts === 'function') {
        global.injectMobileFaceCallouts(selloutChartElem, 'Brisket (~7:45 PM)', 'Ribs (~6:30 PM)', 'Sausage (In Stock)');
      }
    }
  }

  function renderPlotlyNoData(containerId) {
    if (typeof d3 === 'undefined') return;
    const container = document.getElementById(containerId);
    if (container) container.innerHTML = '<div style="color: #64748b; padding: 40px; text-align: center;">No Data Available</div>';
  }

  // Live Events & Multiplier Calendar State Management
  const _now = global.ShopTime ? global.ShopTime.getEffectiveNow() : new Date();
  let currentCalYear = _now.getFullYear();
  let currentCalMonth = _now.getMonth();
  let currentCalFilter = 'all';
  let selectedCalDate = global.ShopTime ? global.ShopTime.shopDateStr(_now) : _now.toLocaleDateString('en-CA');
  let calInitialized = false;

  function refreshEventsCalendar() {
    if (typeof global.renderMonthEventsCalendar === 'function') {
      global.renderMonthEventsCalendar(
        'live-events-calendar-grid',
        currentCalYear,
        currentCalMonth,
        currentCalFilter,
        (dateStr, evt) => {
          selectedCalDate = dateStr;
          showCalendarDateDrawer(dateStr, evt);
        },
        selectedCalDate
      );
    }
  }

  function showCalendarDateDrawer(dateStr, evt) {
    const drawer = document.getElementById('calendar-selected-drawer');
    if (!drawer) return;
    drawer.style.display = 'flex';

    const dateObj = new Date(dateStr + 'T00:00:00');
    const formattedDate = dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const dateSpan = document.getElementById('drawer-date-str');
    const badgeSpan = document.getElementById('drawer-mult-badge');
    const titleP = document.getElementById('drawer-event-title');
    const noteP = document.getElementById('drawer-event-note');

    if (dateSpan) dateSpan.textContent = formattedDate;
    if (badgeSpan) badgeSpan.textContent = (evt.multiplier && evt.multiplier !== 1) ? `${evt.multiplier}x Demand Multiplier` : 'No measured sales lift';
    if (titleP) titleP.textContent = `${evt.icon || ''} ${evt.title}`.trim();
    if (noteP) noteP.textContent = evt.note || 'Standard operational pace.';

    const applyBtn = document.getElementById('drawer-apply-btn');
    if (applyBtn) {
      applyBtn.onclick = () => {
        const dateInput = document.getElementById('forecast-start-date');
        if (dateInput) dateInput.value = dateStr;
        handleDateSelectionLookup(dateStr);
        if (typeof global.renderPlotlyForecastingChart === 'function') {
          global.renderPlotlyForecastingChart(14);
        }
        const targetCard = document.querySelector('.forecasting-kpi-grid');
        if (targetCard) {
          targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      };
    }
  }

  function initEventsCalendar() {
    if (calInitialized) return;
    calInitialized = true;

    const btnPrev = document.getElementById('cal-btn-prev');
    const btnNext = document.getElementById('cal-btn-next');
    const btnToday = document.getElementById('cal-btn-today');

    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        currentCalMonth--;
        if (currentCalMonth < 0) {
          currentCalMonth = 11;
          currentCalYear--;
        }
        refreshEventsCalendar();
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        currentCalMonth++;
        if (currentCalMonth > 11) {
          currentCalMonth = 0;
          currentCalYear++;
        }
        refreshEventsCalendar();
      });
    }

    if (btnToday) {
      btnToday.addEventListener('click', () => {
        const now = new Date();
        currentCalYear = now.getFullYear();
        currentCalMonth = now.getMonth();
        refreshEventsCalendar();
      });
    }

    const filterBtns = document.querySelectorAll('.cal-filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCalFilter = btn.getAttribute('data-filter') || 'all';
        refreshEventsCalendar();
      });
    });

    refreshEventsCalendar();
  }

  // Keep only event types with a usable multiplier (a tiny or negative sample, e.g. a refund-only holiday, is not a result),
  // and build the Peak/Low/Now badge text from what is actually plotted.
  function sanitizeEventTraces(traces) {
    const t = traces && traces[0];
    if (!t || !Array.isArray(t.x) || !Array.isArray(t.y)) return { traces, labels: ['No event data yet', 'No event data yet', 'Normal Day (1.0x)'] };
    const keep = t.y.map((v, i) => (typeof v === 'number' && Number.isFinite(v) && v > 0.1 ? i : -1)).filter(i => i >= 0);
    const pick = arr => (Array.isArray(arr) ? keep.map(i => arr[i]) : arr);
    t.x = pick(t.x); t.y = pick(t.y); t.text = t.y.map(v => `${v.toFixed(2)}x`); t.hovertext = pick(t.hovertext);
    if (t.marker && Array.isArray(t.marker.color)) t.marker.color = pick(t.marker.color);
    const entries = t.x.map((name, i) => ({ name, y: t.y[i] }));
    const label = e => (e ? `${e.name} (${e.y.toFixed(2)}x)` : 'n/a');
    const top = entries.reduce((a, b) => (b.y > a.y ? b : a), entries[0]);
    const low = entries.reduce((a, b) => (b.y < a.y ? b : a), entries[0]);
    return { traces, labels: [label(top), label(low), label(entries.find(e => e.name === 'Normal Day') || entries[0])] };
  }

  async function renderPlotlyEventChart() {
    const container = document.getElementById('plotly-event-impact-chart');
    if (!container) return;

    const defaultEventTraces = [{
      x: ['Normal Day'],
      y: [1.0],
      type: 'bar',
      marker: { color: ['#7f8c8d'], opacity: 0.9 },
      text: ['1.0x'],
      textposition: 'auto'
    }];

    const defaultEventLayout = {
      height: global.fitChartHeight(global.isMobileViewport() ? 300 : 340),
      title: global.isMobileViewport() ? 'Event Revenue Multipliers' : 'Sales on Event Days vs. Normal Days',
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(20,20,30,0.6)',
      font: { color: '#f8fafc', family: 'Inter, system-ui, sans-serif', size: 11 },
      xaxis: { gridcolor: 'rgba(255,255,255,0.1)' },
      yaxis: { title: global.isMobileViewport() ? 'Multiplier' : 'Demand Multiplier (vs. Normal Day)', gridcolor: 'rgba(255,255,255,0.1)' },
      margin: global.isMobileViewport() ? { l: 40, r: 20, t: 36, b: 40 } : { l: 60, r: 50, t: 50, b: 50 }
    };

    try {
      let payload = global.BBQ_PAYLOADS?.event_payload || null;
      if (!payload && typeof global.fetchJsonSafe === 'function') {
        payload = await global.fetchJsonSafe('clover_api/analytics/event_payload.json?v=' + Date.now(), null, 4000);
      }
      if (payload && payload.plotly_event_chart) {
        const layout = JSON.parse(JSON.stringify(payload.plotly_event_chart.layout || defaultEventLayout));
        const cleaned = sanitizeEventTraces(JSON.parse(JSON.stringify(payload.plotly_event_chart.data || defaultEventTraces)));
        const traces = cleaned.traces;
        layout.height = global.isMobileViewport() ? 300 : 340;
        layout.plot_bgcolor = 'rgba(0,0,0,0)';
        layout.paper_bgcolor = 'rgba(0,0,0,0)';
        layout.font = { family: 'Inter, system-ui, sans-serif', color: '#94a3b8', size: 10 };
        if (global.isMobileViewport()) {
          layout.title = { text: 'Event Revenue Multipliers', font: { size: 11, color: '#f8fafc' } };
          layout.margin = { l: 40, r: 20, t: 36, b: 40 };
        }
        if (layout.xaxis) {
          layout.xaxis.showgrid = false;
          layout.xaxis.zerolinecolor = '#334155';
          layout.xaxis.color = '#94a3b8';
          if (global.isMobileViewport()) {
            layout.xaxis.title = { text: 'Event Type', font: { size: 10, color: '#94a3b8' } };
          }
        }
        if (layout.yaxis) {
          layout.yaxis.gridcolor = '#334155';
          layout.yaxis.zerolinecolor = '#334155';
          layout.yaxis.color = '#94a3b8';
          if (global.isMobileViewport()) layout.yaxis.title = { text: 'Multiplier vs normal day', font: { size: 10, color: '#94a3b8' } };
        }
        if (typeof Plotly !== 'undefined') {
          Plotly.newPlot('plotly-event-impact-chart', traces, layout, global.getPlotlyConfig());
          if (container.offsetWidth > 0) {
            try { Plotly.Plots.resize(container); } catch (_e) {}
          }
          global.applyChartTouchSafety(container);
          if (typeof global.injectMobileFaceCallouts === 'function') {
            global.injectMobileFaceCallouts(container, cleaned.labels[0], cleaned.labels[1], cleaned.labels[2]);
          }
        }
        refreshEventsCalendar();
        return;
      }
    } catch (_err) {
      // Fallback to embedded event chart dataset
    }

    if (typeof Plotly !== 'undefined') {
      Plotly.newPlot('plotly-event-impact-chart', defaultEventTraces, defaultEventLayout, global.getPlotlyConfig());
      if (container.offsetWidth > 0) {
        try { Plotly.Plots.resize(container); } catch (_e) {}
      }
      global.applyChartTouchSafety(container);
      if (typeof global.injectMobileFaceCallouts === 'function') {
        global.injectMobileFaceCallouts(container, 'Normal Day (1.0x)', 'Normal Day (1.0x)', 'Normal Day (1.0x)');
      }
    }
    refreshEventsCalendar();
  }

  async function renderPlotlyWeatherChart() {
    const container = document.getElementById('plotly-weather-impact-chart');
    if (!container) return;

    const defaultWeatherTraces = [
      {
        x: ['2026-08-14', '2026-08-15', '2026-08-16', '2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20'],
        y: [86, 88, 91, 89, 87, 85, 88],
        name: 'Max Temp (°F)',
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#e67e22', width: 3 }
      },
      {
        x: ['2026-08-14', '2026-08-15', '2026-08-16', '2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20'],
        y: [0, 12.5, 0, 4.2, 0, 0, 8.0],
        name: 'Precipitation (mm)',
        type: 'bar',
        yaxis: 'y2',
        marker: { color: '#3498db' }
      }
    ];

    const defaultWeatherLayout = {
      height: global.fitChartHeight(global.isMobileViewport() ? 300 : 340),
      title: global.isMobileViewport() ? 'Weather vs. Sales Impact' : 'How Weather Affects Daily Sales (Temperature & Rain)',
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(20,20,30,0.6)',
      font: { color: '#f8fafc', family: 'Inter, system-ui, sans-serif', size: 11 },
      xaxis: { showgrid: false, tickangle: 45 },
      yaxis: { title: global.isMobileViewport() ? 'Temp (°F)' : 'Temperature (°F)', gridcolor: 'rgba(255,255,255,0.1)' },
      yaxis2: { title: global.isMobileViewport() ? 'Rain (mm)' : 'Precipitation (mm)', overlaying: 'y', side: 'right', showgrid: false, titlefont: { color: '#3498db' }, tickfont: { color: '#3498db' } },
      legend: { orientation: 'h', y: -0.22, x: 0 },
      margin: global.isMobileViewport() ? { l: 40, r: 40, t: 36, b: 56 } : { l: 60, r: 60, t: 46, b: 64 }
    };

    try {
      let payload = global.BBQ_PAYLOADS?.weather_payload || null;
      if (!payload && typeof global.fetchJsonSafe === 'function') {
        payload = await global.fetchJsonSafe('clover_api/analytics/weather_payload.json?v=' + Date.now(), null, 4000);
      }
      if (payload && payload.plotly_weather_chart) {
        const layout = JSON.parse(JSON.stringify(payload.plotly_weather_chart.layout || defaultWeatherLayout));
        const traces = JSON.parse(JSON.stringify(payload.plotly_weather_chart.data || defaultWeatherTraces));
        layout.height = global.isMobileViewport() ? 300 : 340;
        layout.plot_bgcolor = 'rgba(0,0,0,0)';
        layout.paper_bgcolor = 'rgba(0,0,0,0)';
        layout.font = { family: 'Inter, system-ui, sans-serif', color: '#94a3b8', size: 10 };
        if (global.isMobileViewport()) {
          layout.title = { text: 'Weather vs. Sales Impact', font: { size: 11, color: '#f8fafc' } };
          layout.margin = { l: 40, r: 40, t: 36, b: 60 };
        }
        if (layout.xaxis) {
          layout.xaxis.showgrid = false;
          layout.xaxis.zerolinecolor = '#334155';
          layout.xaxis.color = '#94a3b8';
          if (global.isMobileViewport()) {
            layout.xaxis.title = { text: 'High Temp (°F)', font: { size: 10, color: '#94a3b8' } };
          }
        }
        if (layout.yaxis) {
          layout.yaxis.gridcolor = '#334155';
          layout.yaxis.zerolinecolor = '#334155';
          layout.yaxis.color = '#94a3b8';
        }

        if (typeof Plotly !== 'undefined') {
          Plotly.newPlot('plotly-weather-impact-chart', traces, layout, global.getPlotlyConfig());
          if (container.offsetWidth > 0) {
            try { Plotly.Plots.resize(container); } catch (_e) {}
          }
          global.applyChartTouchSafety(container);
          if (typeof global.injectMobileFaceCallouts === 'function') {
            global.injectMobileFaceCallouts(container, 'Clear 82°F (+Patio Sales)', 'Heavy Rain >10mm (-15% Dine-In)', 'Takeout Shift Active');
          }
        } else if (typeof d3 !== 'undefined' && typeof global.renderD3GenericChart === 'function') {
          global.renderD3GenericChart('plotly-weather-impact-chart', traces, layout.title);
          global.applyChartTouchSafety(container);
        }
        return;
      }
    } catch (_err) {
      // Fallback to embedded weather chart dataset
    }

    if (typeof Plotly !== 'undefined') {
      Plotly.newPlot('plotly-weather-impact-chart', defaultWeatherTraces, defaultWeatherLayout, global.getPlotlyConfig());
      if (container.offsetWidth > 0) {
        try { Plotly.Plots.resize(container); } catch (_e) {}
      }
      global.applyChartTouchSafety(container);
      if (typeof global.injectMobileFaceCallouts === 'function') {
        global.injectMobileFaceCallouts(container, 'Clear 82°F (+Patio Sales)', 'Heavy Rain >10mm (-15% Dine-In)', 'Takeout Shift Active');
      }
    }
  }

  let isOperatingHoursFiltered = true;

  function renderHourlyTurnoverDeck(activeForecast, actuals, effectiveNow, filterOperatingHours = isOperatingHoursFiltered) {
    const container = document.getElementById('hourly-turnover-deck');
    if (!container) return;

    const effNow = effectiveNow || (global.ShopTime ? global.ShopTime.getEffectiveNow() : new Date());
    const startDateInput = document.getElementById('forecast-start-date');
    const targetDateStr = startDateInput && startDateInput.value ? startDateInput.value : (global.ShopTime ? global.ShopTime.shopDateStr(effNow) : '');

    if (!global.ShopTime || typeof global.ShopTime.computeBlendedDayMetrics !== 'function') {
      container.innerHTML = '<div style="color:#94a3b8; font-size:12px;">Turnover metrics engine loading...</div>';
      return;
    }

    const result = global.ShopTime.computeBlendedDayMetrics(actuals, activeForecast, effNow, targetDateStr);
    if (!result || !Array.isArray(result.hourly)) {
      container.innerHTML = '<div style="color:#94a3b8; font-size:12px;">No hourly records available for turnover deck.</div>';
      return;
    }

    const operatingHours = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
    const list = filterOperatingHours
      ? result.hourly.filter(h => operatingHours.includes(h.hour))
      : result.hourly;

    if (list.length === 0) {
      container.innerHTML = '<div style="color:#94a3b8; font-size:12px;">No operating hours match current filter.</div>';
      return;
    }

    const html = list.map(item => {
      let cardClass = 'turnover-card card-predicted';
      let badgeHtml = '<span class="turnover-badge badge-predicted">Projected</span>';
      let mainMetricHtml = '';
      let subMetricHtml = '';

      const pRev = Math.round(item.predictedRevenue);
      const pOrders = item.predictedOrders;
      const aRev = Math.round(item.actualSales);
      const aOrders = item.actualOrders;

      if (item.status === 'actual') {
        cardClass = 'turnover-card card-actual';
        badgeHtml = '<span class="turnover-badge badge-actual">POS Actual</span>';
        const vSign = item.varianceSales >= 0 ? '+' : '';
        const vClass = item.varianceSales >= 0 ? 'pill-positive' : 'pill-negative';
        mainMetricHtml = `
          <div class="turnover-metric-main">$${aRev.toLocaleString()}</div>
          <div class="turnover-sub">${aOrders} POS Orders</div>
        `;
        subMetricHtml = `
          <div class="turnover-sub">
            Model: $${pRev.toLocaleString()} (${pOrders} ord)<br>
            <span class="${vClass}">${vSign}$${Math.round(item.varianceSales).toLocaleString()} (${vSign}${item.variancePct}%)</span>
          </div>
        `;
      } else if (item.status === 'live') {
        cardClass = 'turnover-card card-live';
        badgeHtml = '<span class="turnover-badge badge-live">Live Pacing</span>';
        mainMetricHtml = `
          <div class="turnover-metric-main">$${aRev.toLocaleString()}</div>
          <div class="turnover-sub">${aOrders} orders so far</div>
        `;
        subMetricHtml = `
          <div class="turnover-sub">
            Target: $${pRev.toLocaleString()} (${pOrders} ord)<br>
            <span style="color:#fbbf24; font-weight:600;">Current Active Hour</span>
          </div>
        `;
      } else {
        cardClass = 'turnover-card card-predicted';
        badgeHtml = '<span class="turnover-badge badge-predicted">Projected</span>';
        mainMetricHtml = `
          <div class="turnover-metric-main">$${pRev.toLocaleString()}</div>
          <div class="turnover-sub">~${pOrders} projected orders</div>
        `;
        subMetricHtml = `
          <div class="turnover-sub">
            Cooked Meat Draw Target:<br>
            <span style="color:#f59e0b; font-weight:600;">~${item.brisketCookedLbs} lbs Brisket</span> • 
            <span style="color:#cbd5e1;">~${item.porkCookedLbs} lbs Pork</span>
          </div>
        `;
      }

      let rushTag = '';
      if (item.hour === 12 || item.hour === 13) rushTag = ' • Lunch Rush';
      else if (item.hour === 18 || item.hour === 19) rushTag = ' • Dinner Rush';

      return `
        <div class="${cardClass}" data-hour="${item.hour}">
          <div class="turnover-card-header">
            <span class="turnover-hour-title">${item.hourDisplay}${rushTag}</span>
            ${badgeHtml}
          </div>
          ${mainMetricHtml}
          ${subMetricHtml}
        </div>
      `;
    }).join('');

    container.innerHTML = html;
  }

  async function renderPlotlyPredictiveChart() {
    const chartElem = document.getElementById('plotly-predictive-velocity-chart');
    if (!chartElem) return;
    // Plotly sizes to 0px inside a hidden container; the subtab click handler re-renders once it is visible.
    if (chartElem.offsetParent === null) return;

    let payload = global.BBQ_PAYLOADS?.predictive_payload || null;
    if (!payload && typeof global.fetchJsonSafe === 'function') {
      payload = await global.fetchJsonSafe('clover_api/analytics/predictive_payload.json?v=' + Date.now(), null, 4000);
    }
    if (!payload || !payload.hourly_forecast) return;

    const startDateInput = document.getElementById('forecast-start-date');
    const endDateInput = document.getElementById('forecast-end-date');
    const fallbackDateStr = global.ShopTime ? global.ShopTime.shopDateStr() : (new Date()).toLocaleDateString('en-CA');
    const startDateVal = (startDateInput && startDateInput.value) ? startDateInput.value : fallbackDateStr;
    const endDateVal = (endDateInput && endDateInput.value) ? endDateInput.value : startDateVal;

    let activeForecast = payload.hourly_forecast;
    let activeDirectives = payload.operational_directives;
    let activeKpis = payload.summary_kpis;
    let chartTitle = '24-Hour Order Pace & Smoked Meat Draw';
    let currentDayName = '';

    if (payload.day_profiles && startDateVal) {
      const parts = startDateVal.split('-').map(Number);
      const startObj = new Date(parts[0], parts[1] - 1, parts[2]);
      const dayName = startObj.toLocaleDateString('en-US', { weekday: 'long' });
      currentDayName = dayName;
      const shortDay = startObj.toLocaleDateString('en-US', { weekday: 'short' });

      let daysCount = 1;
      if (endDateVal && endDateVal !== startDateVal) {
        const endParts = endDateVal.split('-').map(Number);
        const endObj = new Date(endParts[0], endParts[1] - 1, endParts[2]);
        daysCount = Math.max(1, Math.round((endObj - startObj) / 86400000) + 1);
      }

      if (daysCount === 1) {
        const profile = payload.day_profiles[dayName] || payload.day_profiles[shortDay] || payload.day_profiles[dayName.toLowerCase()];
        if (profile) {
          activeForecast = profile.hourly_forecast;
          activeDirectives = profile.operational_directives;
          activeKpis = {
            current_sales_velocity: profile.current_sales_velocity,
            pacing_status: profile.pacing_status,
            estimated_food_cost_pct: profile.estimated_food_cost_pct,
            projected_24h_revenue_usd: profile.projected_revenue_usd,
            peak_rush_window: profile.peak_rush_window,
            total_brisket_draw_lbs: profile.total_brisket_draw_lbs,
            total_pork_draw_lbs: profile.total_pork_draw_lbs,
            recommended_staff: profile.recommended_staff,
            pitmaster_hours: profile.pitmaster_hours,
            average_ticket_usd: profile.average_ticket_usd
          };
          chartTitle = `${dayName} Hourly Sales & Smoked Meat Draw (${startDateVal})`;
        }
      } else {
        const rangeHours = [];
        let totalRev = 0;
        let totalCogs = 0;
        let totalBrisket = 0;
        let totalPork = 0;
        let maxOrders = 0;
        let peakHourStr = '';

        const renderDays = Math.min(daysCount, 7);
        for (let i = 0; i < renderDays; i++) {
          const curDate = new Date(startObj);
          curDate.setDate(curDate.getDate() + i);
          const curDayName = curDate.toLocaleDateString('en-US', { weekday: 'long' });
          const curShortDay = curDate.toLocaleDateString('en-US', { weekday: 'short' });
          const profile = payload.day_profiles[curDayName] || payload.day_profiles[curShortDay];
          if (profile && profile.hourly_forecast) {
            profile.hourly_forecast.forEach(r => {
              if (r.predicted_orders > maxOrders) {
                maxOrders = r.predicted_orders;
                peakHourStr = `${r.hour_display} (${curShortDay})`;
              }
              totalRev += (r.predicted_revenue || 0);
              totalCogs += (r.estimated_cogs_usd || 0);
              totalBrisket += (r.brisket_cooked_lbs || 0);
              totalPork += (r.pork_cooked_lbs || 0);
              rangeHours.push({
                ...r,
                hour_display: `${r.hour_display} (${curShortDay})`,
                day_name: curShortDay
              });
            });
          }
        }

        if (rangeHours.length > 0) {
          activeForecast = rangeHours;
          const avgFoodCost = totalRev > 0 ? (totalCogs / totalRev * 100).toFixed(1) : null;
          activeKpis = {
            current_sales_velocity: `${maxOrders.toFixed(1)} orders/hr (Peak)`,
            pacing_status: maxOrders >= 10.0 ? 'Heavy Rush Surge' : 'Normal Pacing',
            estimated_food_cost_pct: avgFoodCost,
            projected_24h_revenue_usd: Math.round(totalRev),
            peak_rush_window: peakHourStr,
            total_brisket_draw_lbs: totalBrisket.toFixed(1),
            total_pork_draw_lbs: totalPork.toFixed(1)
          };
          activeDirectives = [
            `Peak Customer Flow: Expected around ${peakHourStr} reaching ~${maxOrders.toFixed(1)} orders/hr across the ${daysCount}-day window.`,
            `Meat Depletion Pacing: Projected cumulative draw of ~${totalBrisket.toFixed(1)} lbs smoked brisket and ~${totalPork.toFixed(1)} lbs pulled pork from hot storage.`,
            'Weather / Service Action: In high humidity (>85%) or rain (>5mm), stage additional takeout packaging; walk-in dine-in will drop ~15% into to-go family packs.',
            'Smoker Pacing: Balance smoke pit reload intervals to maintain continuous hot holding capacity.'
          ];
          chartTitle = `${daysCount}-Day Hourly Sales & Smoked Meat Draw (${startDateVal} to ${endDateVal})`;
        }
      }
    }

    // Hydrate Crucial Top-Shelf KPIs without overwriting live blended POS actuals
    const kpiVelocity = document.getElementById('kpi-current-velocity');
    const kpiPacing = document.getElementById('kpi-pacing-status');
    const kpiFoodCost = document.getElementById('kpi-food-cost-pct');
    const kpiAov = document.getElementById('kpi-aov-usd');
    const kpiAovSub = document.getElementById('kpi-aov-sub');

    const velBlendedPill = document.getElementById('kpi-velocity-blended-sub');
    const hasActiveBlendedKPIs = Boolean(velBlendedPill && velBlendedPill.style.display === 'block' && velBlendedPill.innerHTML.trim() !== '');

    if (activeKpis) {
      // Est. Meat Cost % (#kpi-food-cost-pct) is written only by app.js from the day's batch cost / projected sales,
      // so it updates whichever subtab is open.
      if (!hasActiveBlendedKPIs) {
        if (kpiVelocity) kpiVelocity.textContent = '--';
        if (kpiPacing) kpiPacing.textContent = (activeKpis.pacing_status === 'Closed' || activeKpis.current_sales_velocity === '0 orders/hr (Closed)') ? '(Closed)' : '(No sales yet)';
        if (kpiAov) {
          if (activeKpis.pacing_status === 'Closed' || activeKpis.current_sales_velocity === '0 orders/hr (Closed)') {
            kpiAov.textContent = '$0.00';
            if (kpiAovSub) kpiAovSub.textContent = '(Closed / 0 Orders)';
          } else {
            const aovVal = activeKpis.average_ticket_usd || 48.50;
            kpiAov.textContent = `$${Number(aovVal).toFixed(2)}`;
            if (kpiAovSub) kpiAovSub.textContent = '(Average Order Value)';
          }
        }
      }
    }

    const velocitySummaryElem = document.getElementById('predictive-velocity-summary');
    if (velocitySummaryElem && activeKpis) {
      if (activeKpis.pacing_status === 'Closed' || activeKpis.current_sales_velocity === '0 orders/hr (Closed)') {
        velocitySummaryElem.textContent = 'Shop is closed today (Monday pit maintenance). Retail counter service and order flow resume Tuesday at 11:00 AM EST.';
      } else if (activeKpis.peak_rush_window) {
        velocitySummaryElem.textContent = `Peak rush window concentrates around ${activeKpis.peak_rush_window} (${activeKpis.current_sales_velocity}); dinner service tapers after 7:30 PM EST.`;
      }
    }

    const formatHour12EST = (h) => {
      const num = parseInt(h, 10) || 0;
      const h12 = num === 0 ? 12 : (num > 12 ? num - 12 : num);
      const ampm = num >= 12 ? 'PM' : 'AM';
      return `${h12}:00 ${ampm} EST`;
    };

    const hours = activeForecast.map(r => r.hour_display ? `${r.hour_display}` : formatHour12EST(r.hour));
    const orders = activeForecast.map(r => r.predicted_orders);
    const brisketDraw = activeForecast.map(r => r.brisket_cooked_lbs);

    const traces = [
      {
        x: hours,
        y: orders,
        name: 'Order Pace (Orders/hr)',
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#3b82f6', width: 3 },
        marker: { size: 6 }
      },
      {
        x: hours,
        y: brisketDraw,
        name: 'Smoked Brisket Draw (lbs/hr)',
        type: 'bar',
        yaxis: 'y2',
        marker: { color: '#e67e22', opacity: 0.7 }
      }
    ];

    const summaryElem = document.getElementById('hourly-actuals-summary');
    if (summaryElem) {
      summaryElem.style.display = 'none';
      summaryElem.textContent = '';
    }
    try {
      const effDate = global.ShopTime ? global.ShopTime.getEffectiveNow() : new Date();
      const pickedDate = startDateVal || (global.ShopTime ? global.ShopTime.shopDateStr(effDate) : '');
      const isSingleDay = !endDateVal || endDateVal === startDateVal || !startDateVal;

      let actuals = global.BBQ_PAYLOADS?.hourly_actuals || null;
      let snapshots = global.BBQ_PAYLOADS?.forecast_snapshots || null;
      if (!actuals && typeof global.fetchJsonSafe === 'function') {
        actuals = await global.fetchJsonSafe('clover_api/analytics/hourly_actuals.json?v=' + Date.now(), null, 4000);
        snapshots = await global.fetchJsonSafe('clover_api/analytics/forecast_snapshots.json?v=' + Date.now(), null, 4000);
      }

      if (global.ShopTime && pickedDate && isSingleDay && activeForecast.every(r => r.hour !== undefined)) {
        const overlay = global.ShopTime.buildActualsOverlay(actuals, snapshots, pickedDate, activeForecast, effDate);
        if (overlay) {
          if (overlay.baselineOrders) {
            traces.push({
              x: hours,
              y: overlay.baselineOrders,
              name: 'Baseline (avg same weekday, reconstructed)',
              type: 'scatter',
              mode: 'lines',
              line: { color: '#94a3b8', width: 2, dash: 'dot' }
            });
          }
          if (overlay.snapshotOrders) {
            traces.push({
              x: hours,
              y: overlay.snapshotOrders,
              name: 'Forecast as predicted that day',
              type: 'scatter',
              mode: 'lines',
              line: { color: '#a78bfa', width: 2, dash: 'dash' }
            });
          }
          if (overlay.hasActuals) {
            traces.push({
              x: hours,
              y: overlay.actualOrders,
              name: 'Actual Orders/hr (POS)',
              type: 'scatter',
              mode: 'lines+markers',
              connectgaps: false,
              line: { color: '#22c55e', width: 3 },
              marker: { size: 7 }
            });
          }
          if (summaryElem) {
            const s = overlay.summary;
            const money = v => '$' + Math.round(v).toLocaleString('en-US');
            if (!overlay.hasActuals) {
              summaryElem.textContent = `No POS records for ${overlay.date}.`;
            } else if (overlay.isToday) {
              const cutH = overlay.cutoffHour;
              const cutH12 = cutH === 0 ? 12 : (cutH > 12 ? cutH - 12 : cutH);
              const cutAmpm = cutH >= 12 ? 'PM' : 'AM';
              summaryElem.textContent = `Today so far (through ${cutH12}:00 ${cutAmpm} EST, as of last sync): ${money(s.actualSales)} actual (${s.actualOrders} orders) vs ${money(s.forecastToHour)} forecast to this hour; full-day forecast ${money(s.forecastFullDay)}.`;
            } else {
              summaryElem.textContent = `${overlay.date}: ${money(s.actualSales)} actual (${s.actualOrders} orders) vs ${money(s.forecastFullDay)} forecast total.`;
            }
            summaryElem.style.display = 'block';
          }
        }
      }

      if (actuals && Array.isArray(activeForecast)) {
        renderHourlyTurnoverDeck(activeForecast, actuals, effDate, isOperatingHoursFiltered);
      }
    } catch (e) {
      console.warn('Hourly actuals overlay unavailable:', e);
    }

    const opPool = activeForecast.filter(r => r.hour >= 11 && r.hour <= 20);
    const scanPool = opPool.length > 0 ? opPool : activeForecast;
    const peakRow = scanPool.reduce((a, b) => ((b.predicted_orders || 0) > (a.predicted_orders || 0) ? b : a), scanPool[0] || {});
    const lowRow = scanPool.reduce((a, b) => ((b.predicted_orders || 0) < (a.predicted_orders || 0) ? b : a), scanPool[0] || {});
    const nowRow = activeForecast[0] || {};
    const peakX = peakRow.hour_display ? `${peakRow.hour_display}` : formatHour12EST(peakRow.hour || 12);
    const nowX = nowRow.hour_display ? `${nowRow.hour_display}` : formatHour12EST(nowRow.hour || 12);

    const mobileAnnotations = global.isMobileViewport() && peakRow ? [
      {
        x: peakX,
        y: peakRow.predicted_orders || 0,
        text: `PEAK: ${peakRow.predicted_orders || 0}/hr`,
        showarrow: true,
        arrowhead: 2,
        ax: 0,
        ay: -24,
        bgcolor: 'rgba(15, 23, 42, 0.92)',
        bordercolor: '#E69F00',
        font: { color: '#fbbf24', size: 11, family: 'JetBrains Mono, monospace' }
      }
    ] : [];

    const mobile = global.isMobileViewport();
    const layout = {
      height: global.fitChartHeight(mobile ? 360 : 340),
      title: {
        text: mobile ? (currentDayName ? `${currentDayName} Hourly Sales & Meat Draw` : 'Hourly Sales & Meat Draw') : chartTitle,
        font: { color: '#f8fafc', family: 'Inter, system-ui, sans-serif', size: mobile ? 11 : 13 }
      },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(15,23,42,0.45)',
      font: { color: '#f8fafc', family: 'Inter, system-ui, sans-serif', size: 10 },
      xaxis: { showgrid: false, zeroline: false, tickangle: -45 },
      yaxis: { title: mobile ? 'Orders/hr' : 'Hourly Orders (per hour)', gridcolor: 'rgba(148,163,184,0.12)', zeroline: false },
      yaxis2: {
        title: mobile ? 'Brisket (lbs/hr)' : 'Cooked Brisket Used (lbs/hr)',
        overlaying: 'y',
        side: 'right',
        showgrid: false,
        zeroline: false,
        titlefont: { color: '#E69F00' },
        tickfont: { color: '#E69F00' }
      },
      annotations: mobileAnnotations,
      legend: { orientation: 'h', y: mobile ? -0.62 : -0.22, x: 0 },
      margin: mobile ? { l: 38, r: 38, t: 36, b: 104 } : { l: 50, r: 50, t: 42, b: 64 }
    };

    if (typeof Plotly !== 'undefined') {
      Plotly.newPlot('plotly-predictive-velocity-chart', traces, layout, global.getPlotlyConfig());
      if (chartElem.offsetWidth > 0) {
        try { Plotly.Plots.resize(chartElem); } catch (_e) {}
      }
      global.applyChartTouchSafety(chartElem);
      if (typeof global.injectMobileFaceCallouts === 'function') {
        global.injectMobileFaceCallouts(
          chartElem,
          `${peakX} (${peakRow.predicted_orders || 0} orders/hr)`,
          `${lowRow.hour_display || lowRow.hour || '3:00 PM'} (${lowRow.predicted_orders || 0} orders/hr)`,
          `${nowX} (${nowRow.predicted_orders || 0} orders/hr)`
        );
      }
    }
  }

  function setupTimeTravelControls() {
    const slider = document.getElementById('time-travel-slider');
    const badge = document.getElementById('time-travel-badge');
    const currentLabel = document.getElementById('time-travel-current-label');
    const btnLunch = document.getElementById('sim-btn-lunch');
    const btnRush = document.getElementById('sim-btn-rush');
    const btnPostrush = document.getElementById('sim-btn-postrush');
    const btnReset = document.getElementById('sim-btn-reset');
    const btnOperating = document.getElementById('btn-turnover-operating');
    const btnAll = document.getElementById('btn-turnover-all');

    function updateSimulatorUI() {
      if (!global.ShopTime) return;
      if (slider) slider.dataset.previewing = '';
      const isSim = global.ShopTime.isSimulating();
      const effNow = global.ShopTime.getEffectiveNow();
      const currentHour = global.ShopTime.shopHour(effNow);
      const dateStr = global.ShopTime.shopDateStr(effNow);

      if (slider) slider.value = currentHour;

      const h12 = currentHour === 0 ? 12 : (currentHour > 12 ? currentHour - 12 : currentHour);
      const ampm = currentHour >= 12 ? 'PM' : 'AM';

      if (badge) {
        if (isSim) {
          badge.className = 'badge-sim-pulse';
          badge.textContent = `Simulated: ${h12}:00 ${ampm} EST`;
        } else {
          badge.className = 'badge-live-pulse';
          badge.textContent = '● Live America/New_York';
        }
      }

      if (currentLabel) {
        if (isSim) {
          currentLabel.innerHTML = `Simulated Cutoff Hour: <strong>${h12}:00 ${ampm} EST</strong> (${dateStr})`;
        } else {
          currentLabel.innerHTML = `Clock Status: <strong>Live Mode (${h12}:${String(effNow.getMinutes()).padStart(2, '0')} ${ampm} EST)</strong>`;
        }
      }

      if (typeof global.renderPlotlyForecastingChart === 'function') {
        global.renderPlotlyForecastingChart(global.getActiveDaysCount());
      }
      if (typeof renderPlotlyPredictiveChart === 'function') {
        renderPlotlyPredictiveChart();
      }
    }

    function setSimHour(hour) {
      if (!global.ShopTime) return;
      const targetDateInput = document.getElementById('forecast-start-date')?.value;
      const targetDateStr = targetDateInput || global.ShopTime.shopDateStr();
      const simDate = typeof global.ShopTime.createShopInstant === 'function'
        ? global.ShopTime.createShopInstant(targetDateStr, hour)
        : new Date(new Date(targetDateStr + 'T12:00:00').setHours(hour, 0, 0, 0));
      global.ShopTime.setSimulatedNow(simDate);
      updateSimulatorUI();
    }

    if (slider) {
      // Commit on release ('change'), not on every drag tick, so a vertical swipe that grazes
      // the slider while scrolling never triggers a chart re-render or time jump.
      // While dragging, show a preview in the label only; nothing re-renders until release.
      slider.addEventListener('input', (e) => {
        slider.dataset.previewing = '1';
        const ph = parseInt(e.target.value, 10);
        const ph12 = ph === 0 ? 12 : (ph > 12 ? ph - 12 : ph);
        if (currentLabel) currentLabel.innerHTML = `Preview: <strong>${ph12}:00 ${ph >= 12 ? 'PM' : 'AM'} EST</strong> (release to apply)`;
      });
      // If the drag ends on the starting value no 'change' fires; put the real clock label back.
      const restoreLabel = () => setTimeout(() => { if (slider.dataset.previewing === '1') updateSimulatorUI(); }, 120);
      ['pointerup', 'touchend', 'keyup', 'blur'].forEach(evt => slider.addEventListener(evt, restoreLabel));
      slider.addEventListener('change', (e) => {
        const h = parseInt(e.target.value, 10);
        setSimHour(h);
      });
    }

    if (btnLunch) btnLunch.addEventListener('click', () => setSimHour(12));
    if (btnRush) btnRush.addEventListener('click', () => setSimHour(19));
    if (btnPostrush) btnPostrush.addEventListener('click', () => setSimHour(20));
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (global.ShopTime) global.ShopTime.clearSimulatedNow();
        updateSimulatorUI();
      });
    }

    if (btnOperating && btnAll) {
      btnOperating.addEventListener('click', () => {
        btnOperating.classList.add('active');
        btnAll.classList.remove('active');
        isOperatingHoursFiltered = true;
        renderPlotlyPredictiveChart();
      });
      btnAll.addEventListener('click', () => {
        btnAll.classList.add('active');
        btnOperating.classList.remove('active');
        isOperatingHoursFiltered = false;
        renderPlotlyPredictiveChart();
      });
    }

    updateSimulatorUI();
    hydrateSubtabStatCards();
    hydrateExplainerLines();
    startHourlyRefresh();
  }


  // Summary cards at the top of each subtab, filled from the same payloads the charts use.
  function hydrateSubtabStatCards() {
    const P = global.BBQ_PAYLOADS || {};
    const fin = x => typeof x === 'number' && Number.isFinite(x);
    const money = n => '$' + Math.round(n).toLocaleString();
    const signedPct = (v, ref) => (fin(v) && fin(ref) && ref > 0) ? ((v - ref) / ref >= 0 ? '+' : '') + (Math.round((v - ref) / ref * 1000) / 10) + '%' : '--';
    const hourLabel = h => `${h === 0 ? 12 : (h > 12 ? h - 12 : h)}:00 ${h >= 12 ? 'PM' : 'AM'} EST`;
    const setStat = (key, kicker, val, sub) => {
      const el = document.querySelector(`[data-stat="${key}"]`);
      if (!el) return;
      if (kicker) el.querySelector('.subtab-stat-kicker').textContent = kicker;
      el.querySelector('.subtab-stat-val').textContent = val;
      el.querySelector('.subtab-stat-sub').textContent = sub;
    };
    const none = (key, kicker) => setStat(key, kicker, '--', 'Not enough sales data yet');

    // Weekday sales history (index 0 = Monday, closed). Averages per hour and per day from real POS buckets.
    const base = P.hourly_actuals && P.hourly_actuals.weekday_baseline;
    const open = [];
    if (base) {
      for (let d = 1; d <= 6; d++) {
        const b = base[String(d)];
        if (b && b.n > 0 && Array.isArray(b.sales_sum) && b.sales_sum.length === 24) open.push({ d, n: b.n, sum: b.sales_sum.map(v => Number(v) || 0) });
      }
    }
    if (open.length) {
      const totalDays = open.reduce((s, o) => s + o.n, 0);
      const hourAvg = Array.from({ length: 24 }, (_, h) => open.reduce((s, o) => s + o.sum[h], 0) / totalDays);
      const argmax = (lo, hi) => { let best = lo; for (let h = lo; h <= hi; h++) if (hourAvg[h] > hourAvg[best]) best = h; return best; };
      const dayAvgOf = o => o.sum.reduce((a, b) => a + b, 0) / o.n;
      const peak = argmax(0, 23), lunch = argmax(10, 15), dinner = argmax(16, 20);
      const busyHours = hourAvg.filter(v => v >= hourAvg[peak] * 0.05).length;
      const openDayAvg = open.reduce((s, o) => s + dayAvgOf(o) * o.n, 0) / totalDays;
      setStat('peak-hour', 'Busiest Hour', hourLabel(peak), `${money(hourAvg[peak])} average sales that hour`);
      setStat('hourly-avg', 'Average Sales Per Busy Hour', money(openDayAvg / busyHours), `${busyHours} busy hours in a typical day`);
      setStat('open-day-avg', 'Average Open Day', money(openDayAvg), `Tue–Sun, ${totalDays} days of sales`);
      const mid = open.filter(o => o.d >= 1 && o.d <= 3), wk = open.filter(o => o.d >= 4);
      const grp = g => g.length ? g.reduce((s, o) => s + dayAvgOf(o) * o.n, 0) / g.reduce((s, o) => s + o.n, 0) : null;
      setStat('midweek-weekend', 'Midweek vs Weekend', (grp(mid) !== null && grp(wk) !== null) ? `${money(grp(mid))} vs ${money(grp(wk))}` : '--', 'Tue–Thu vs Fri–Sun average');
      setStat('lunch-peak', 'Lunch Peak', hourLabel(lunch), `${money(hourAvg[lunch])} average sales that hour`);
      setStat('dinner-peak', 'Dinner Peak', hourLabel(dinner), `${money(hourAvg[dinner])} average sales that hour`);
      let drop = null;
      for (let h = dinner + 1; h < 24; h++) if (hourAvg[h] < hourAvg[dinner] * 0.25) { drop = h; break; }
      setStat('dropoff', 'Sales Drop-Off', drop === null ? '--' : hourLabel(drop), 'Under a quarter of dinner-peak sales');
      const todayStr = global.ShopTime ? global.ShopTime.shopDateStr() : new Date().toLocaleDateString('en-CA');
      const dow = (new Date(todayStr + 'T12:00:00').getDay() + 6) % 7;
      const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const today = open.find(o => o.d === dow);
      if (dow === 0) setStat('typical-day', 'Today', 'Closed', 'Monday, pit maintenance');
      else if (today) setStat('typical-day', `Typical ${dayNames[dow]}`, money(dayAvgOf(today)), `Average of ${today.n} past ${dayNames[dow]}s`);
      else none('typical-day', `Typical ${dayNames[dow]}`);
    } else {
      ['peak-hour', 'hourly-avg', 'open-day-avg', 'midweek-weekend', 'lunch-peak', 'dinner-peak', 'dropoff', 'typical-day'].forEach(k => none(k));
    }

    const ws = P.weather_payload && P.weather_payload.weather_stats;
    if (ws) {
      setStat('rain-days', 'Rainy Days', signedPct(ws.rain_avg_usd, ws.normal_avg_usd), `${money(ws.rain_avg_usd)} vs ${money(ws.normal_avg_usd)} on a normal day`);
      setStat('heat-days', 'Hot Days (over 90°F)', signedPct(ws.heat_avg_usd, ws.normal_avg_usd), `${money(ws.heat_avg_usd)} vs ${money(ws.normal_avg_usd)} on a normal day`);
    } else { none('rain-days'); none('heat-days'); }

    const adv = P.advanced_payload;
    const im = adv && adv.interaction_modeling;
    if (im && fin(im.rain_only)) setStat('rain-game', 'Rain Day, No Game', money(im.rain_only), `vs ${money(im.normal)} on a normal day`);
    else none('rain-game');
    if (im && fin(im.game_and_rain)) setStat('game-rain', 'Game Day + Rain', money(im.game_and_rain), `vs ${money(im.normal)} on a normal day`);
    else none('game-rain');
    const cn = adv && adv.cannibalization;
    if (cn && fin(cn.impact_pct)) setStat('dino-shift', 'Dino vs Pork Rib Shift', `${cn.impact_pct > 0 ? '+' : ''}${cn.impact_pct}% Pork Ribs`, `${cn.pork_ribs_avg_without_dino} → ${cn.pork_ribs_avg_with_dino} racks on Dino days`);
    else none('dino-shift');
    const seg = adv && Array.isArray(adv.order_type_segmentation) ? adv.order_type_segmentation.filter(s => fin(s.avg_ticket)) : [];
    if (seg.length) {
      const top = seg.reduce((a, b) => (b.avg_ticket > a.avg_ticket ? b : a));
      const rest = seg.filter(s => s !== top).map(s => `~${money(s.avg_ticket)} ${s.order_type}`).join(' • ');
      setStat('channel-aov', 'Highest Average Ticket', `~${money(top.avg_ticket)} ${top.order_type}`, rest);
    } else none('channel-aov');

    const es = P.event_payload && P.event_payload.event_stats;
    // Event effect is always the same-weekday multiplier (game days fall on busy weekends, so raw averages mislead).
    const multPct = m => (fin(m) ? (m >= 1 ? '+' : '') + (Math.round((m - 1) * 1000) / 10) + '%' : null);
    if (es && fin(es.jags_multiplier)) setStat('jags', 'Jaguars Home Games', multPct(es.jags_multiplier), `vs a normal day of the same weekday, ${es.jags_days} game days`);
    else if (es) setStat('jags', 'Jaguars Home Games', '--', 'Not enough game days with sales yet');
    else none('jags');
    const cal = Array.isArray(P.calendar_events) ? P.calendar_events : [];
    const todayKey = global.ShopTime ? global.ShopTime.shopDateStr() : new Date().toLocaleDateString('en-CA');
    const upcoming = cal.filter(e => e && e.date >= todayKey).sort((x, y) => (x.date < y.date ? -1 : 1));
    if (upcoming.length) {
      const nx = upcoming[0];
      setStat('next-event', 'Next Local Event', nx.title, `${nx.date} • ${nx.multiplier && nx.multiplier !== 1 ? nx.multiplier + 'x expected sales' : 'no measured sales lift'}`);
      const limit = new Date(todayKey + 'T12:00:00'); limit.setDate(limit.getDate() + 14);
      const limitKey = limit.toLocaleDateString('en-CA');
      setStat('events-ahead', 'Events In The Next 14 Days', String(upcoming.filter(e => e.date <= limitKey).length), 'On the local events calendar');
    } else { none('next-event', 'Next Local Event'); none('events-ahead', 'Events In The Next 14 Days'); }
  }

  // Explainer lines under each subtab: the same payload numbers as the cards, never typed-in values.
  function hydrateExplainerLines() {
    const P = global.BBQ_PAYLOADS || {};
    const fin = x => typeof x === 'number' && Number.isFinite(x);
    const money = n => '$' + Math.round(n).toLocaleString();
    const pct = (v, ref) => (fin(v) && fin(ref) && ref > 0) ? ((v - ref) / ref >= 0 ? '+' : '') + (Math.round((v - ref) / ref * 1000) / 10) + '%' : null;
    const put = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    const ws = P.weather_payload && P.weather_payload.weather_stats;
    const es = P.event_payload && P.event_payload.event_stats;
    const adv = P.advanced_payload || {};
    const nodata = 'Not enough sales data yet.';

    put('live-rain-line', ws && pct(ws.rain_avg_usd, ws.normal_avg_usd) ? `Average ${money(ws.rain_avg_usd)} vs ${money(ws.normal_avg_usd)} on a normal day (${pct(ws.rain_avg_usd, ws.normal_avg_usd)}).` : nodata);
    put('live-heat-line', ws && pct(ws.heat_avg_usd, ws.normal_avg_usd) ? `Average ${money(ws.heat_avg_usd)} vs ${money(ws.normal_avg_usd)} on a normal day (${pct(ws.heat_avg_usd, ws.normal_avg_usd)}).` : nodata);
    put('live-jags-line', es && fin(es.jags_multiplier)
      ? `${es.jags_multiplier}x a normal day of the same weekday across ${es.jags_days} game days${es.jags_applied_multiplier === 1 ? ' (inside normal day-to-day swings, so no prep change)' : ''}.` : 'Not enough game days with sales yet.');

    const cal = Array.isArray(P.calendar_events) ? P.calendar_events : [];
    const range = cat => { const m = cal.filter(e => e && e.category === cat && fin(e.multiplier) && e.multiplier > 0).map(e => e.multiplier); return m.length ? { lo: Math.min(...m), hi: Math.max(...m), n: m.length } : null; };
    const fmtRange = (r, noun) => r ? (r.lo === 1 && r.hi === 1 ? `No measured sales lift; planned at 1.0x across ${r.n} ${noun}${r.n === 1 ? '' : 's'}.` : `Planned at ${r.lo === r.hi ? r.lo + 'x' : r.lo + 'x–' + r.hi + 'x'} across ${r.n} ${noun}${r.n === 1 ? '' : 's'}.`) : 'None on the calendar.';
    const flga = cal.find(e => e && /georgia/i.test(e.title || ''));
    put('live-flga-line', flga ? `${flga.date}: ${flga.multiplier && flga.multiplier !== 1 ? 'planned at ' + flga.multiplier + 'x' : 'no measured sales lift for this event type (planned at 1.0x)'}.` : 'None on the calendar.');
    put('live-concert-line', fmtRange(range('concert'), 'concert'));
    put('live-baseball-line', fmtRange(range('baseball'), 'home game'));
    [['jaguars', 'Stadium', '🏈'], ['concert', 'Concerts', '🎸'], ['baseball', 'Baseball', '⚾']].forEach(([cat, name, icon]) => {
      const btn = document.querySelector(`.cal-filter-btn[data-filter="${cat}"]`);
      const r = range(cat);
      if (btn) btn.textContent = (r && !(r.lo === 1 && r.hi === 1)) ? `${icon} ${name} (${r.lo === r.hi ? r.lo + 'x' : r.lo + 'x–' + r.hi + 'x'})` : `${icon} ${name}`;
    });

    const cn = adv.cannibalization;
    put('live-dino-line', cn && fin(cn.impact_pct) ? `Serving Beef Dino Ribs trims Pork Spare Rib demand from ${cn.pork_ribs_avg_without_dino} to ${cn.pork_ribs_avg_with_dino} racks (${cn.impact_pct}%).` : nodata);
    const seg = Array.isArray(adv.order_type_segmentation) ? adv.order_type_segmentation.filter(x => fin(x.avg_ticket)).sort((a, b) => b.avg_ticket - a.avg_ticket) : [];
    put('live-channel-line', seg.length ? `Average ticket by order type: ${seg.map(x => `${x.order_type} ~${money(x.avg_ticket)}`).join(', ')}.` : nodata);
    const im = adv.interaction_modeling;
    put('live-weather-stadium-line', ws && im && fin(im.game_and_rain) ? `Rainy days average ${money(ws.rain_avg_usd)}${es && fin(es.jags_avg_usd) ? `, Jaguars game days ${money(es.jags_avg_usd)}` : ''}, game days in rain ${money(im.game_and_rain)}.` : nodata);
    const pd = adv.payday_effect;
    put('live-payday-line', pd && fin(pd.payday_avg_ticket) ? `Payday checks average $${pd.payday_avg_ticket.toFixed(2)} vs $${pd.normal_avg_ticket.toFixed(2)} on a standard day.` : nodata);
  }

  global.hydrateSubtabStatCards = hydrateSubtabStatCards;
  global.hydrateExplainerLines = hydrateExplainerLines;

  // Once per shop hour (live mode only): pull fresh payload JSON and redraw the hourly chart.
  function startHourlyRefresh() {
    if (!global.ShopTime || global.__hourlyRefreshStarted) return;
    global.__hourlyRefreshStarted = true;
    let lastHour = global.ShopTime.shopHour(new Date());
    const files = {
      predictive_payload: 'predictive_payload.json',
      hourly_actuals: 'hourly_actuals.json',
      forecast_snapshots: 'forecast_snapshots.json'
    };
    setInterval(async () => {
      if (global.ShopTime.isSimulating()) return;
      const hour = global.ShopTime.shopHour(new Date());
      if (hour === lastHour) return;
      lastHour = hour;
      if (!global.BBQ_PAYLOADS || typeof global.fetchJsonSafe !== 'function') return;
      let gotFresh = false;
      for (const key of Object.keys(files)) {
        const fresh = await global.fetchJsonSafe('clover_api/analytics/' + files[key] + '?v=' + Date.now(), null, 4000);
        if (fresh) { global.BBQ_PAYLOADS[key] = fresh; gotFresh = true; }
      }
      if (!gotFresh) return; // offline or fetch failed: keep what is on screen, redraw next hour
      hydrateSubtabStatCards();
      hydrateExplainerLines();
      // renderPlotlyForecastingChart also recomputes the KPI tiles, projected total and pace pill, so it must run
      // whichever subtab is open (updateSimulatorUI calls it the same way).
      if (typeof global.renderPlotlyForecastingChart === 'function') {
        global.renderPlotlyForecastingChart(global.getActiveDaysCount());
      }
      renderPlotlyPredictiveChart();
    }, 60000);
  }

  // Expose on global and BBQModules.forecaster
  global.handleDateSelectionLookup = handleDateSelectionLookup;
  global.renderPlotlyShiftHeatmap = renderPlotlyShiftHeatmap;
  global.renderAdvancedAnalytics = renderAdvancedAnalytics;
  global.renderPlotlyNoData = renderPlotlyNoData;
  global.renderPlotlyEventChart = renderPlotlyEventChart;
  global.refreshEventsCalendar = refreshEventsCalendar;
  global.showCalendarDateDrawer = showCalendarDateDrawer;
  global.initEventsCalendar = initEventsCalendar;
  global.renderPlotlyWeatherChart = renderPlotlyWeatherChart;
  global.renderPlotlyPredictiveChart = renderPlotlyPredictiveChart;
  global.renderHourlyTurnoverDeck = renderHourlyTurnoverDeck;
  global.setupTimeTravelControls = setupTimeTravelControls;

  global.BBQModules.forecaster = {
    handleDateSelectionLookup,
    renderPlotlyShiftHeatmap,
    renderAdvancedAnalytics,
    renderPlotlyNoData,
    renderPlotlyEventChart,
    refreshEventsCalendar,
    showCalendarDateDrawer,
    initEventsCalendar,
    renderPlotlyWeatherChart,
    renderPlotlyPredictiveChart,
    renderHourlyTurnoverDeck,
    setupTimeTravelControls
  };
})(typeof window !== 'undefined' ? window : globalThis);
