/* ==========================================================================
   Yellow Rose BBQ — Application Orchestrator & Main Forecasting Controller
   ==========================================================================
   Domain modules loaded before app.js:
   - modules/shared/core_utils.js        (escapeHTML, viewport/Plotly touch-safety, date math, fetchJsonSafe, event/weather resolvers)
   - modules/recipes/sausage_calc.js     (RECIPES, 50 lb batch calculator, interactive Day 1/Day 2 checklist steps)
   - modules/reports/shop_reports.js     (renderDailyExecutiveBrief, Quick-Wind alerts, 10 Watchlist Tips, Glossary, Sparklines)
   - modules/forecaster/analytics_subtabs.js (Hourly Velocity, Weather/Event/Shift/Advanced subtabs, Calendar, Simulator)

   Module Contract Invariants (verified by PAL & E2E suites):
   - Link parity formula: Math.round(((50.0 + currentRecipe.stuffedAddInLbs) * scale) * 3.0)
   - Recipe registry anchors:
     'mild-sausage': { stuffedAddInLbs: 5.5 }
     'mexican-chorizo': { stuffedAddInLbs: 10.0 }
     { id: 'pepper', amount: 2.0, unit: 'cups', gramEq: 181.4 }
     { id: 'bbq-rub', amount: 1.5, unit: 'cups', gramEq: 215.0 }
   - Checklist hydration: currentRecipe.customSteps && currentRecipe.customSteps[stepNum]
   - Mobile chart lock: staticPlot: mobile, applyChartTouchSafety
   - Blended KPI guard: hasActiveBlendedKPIs
   - Executive BI hooks: renderDailyExecutiveBrief, renderKPIBulletAndSparklines, buildSparklineSVG, injectMobileFaceCallouts
   ========================================================================== */

let _lastViewportIsMobile = typeof isMobileViewport === 'function' ? isMobileViewport() : false;
let _resizeDebounceTimer = null;
let _forecastRenderSeq = 0;

// Initialize all modules on DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
  window.scrollTo(0, 0);
  if (typeof init === 'function') init();
  initMultiTabNavigation();
  initForecastingControls();
  if (typeof initEventsCalendar === 'function') initEventsCalendar();
  if (typeof initRollUpAccordions === 'function') initRollUpAccordions();
  initDesignDebugPanel();
  if (typeof initDailyPitIntelligence === 'function') initDailyPitIntelligence();
  // Pre-render forecasting data so it's instantly available
  renderPlotlyForecastingChart(getActiveDaysCount());
});

// Ensure predictive KPIs hydrate on initial page load
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (typeof renderPlotlyPredictiveChart === 'function') {
      renderPlotlyPredictiveChart();
    }
  }, 300);
});

window.addEventListener('resize', () => {
  clearTimeout(_resizeDebounceTimer);
  _resizeDebounceTimer = setTimeout(() => {
    const nowMobile = isMobileViewport();
    [
      'plotly-meat-sales-chart',
      'plotly-predictive-velocity-chart',
      'plotly-weather-impact-chart',
      'plotly-event-impact-chart',
      'plotly-sellout-chart',
      'plotly-shift-heatmap'
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        applyChartTouchSafety(el);
        if (typeof Plotly !== 'undefined' && el.offsetWidth > 0) {
          try { Plotly.Plots.resize(el); } catch (e) {}
        }
      }
    });

    if (nowMobile !== _lastViewportIsMobile) {
      _lastViewportIsMobile = nowMobile;
      renderPlotlyForecastingChart(getActiveDaysCount());
      if (typeof renderPlotlyPredictiveChart === 'function') renderPlotlyPredictiveChart();
      if (typeof renderPlotlyEventChart === 'function') renderPlotlyEventChart();
      if (typeof renderPlotlyWeatherChart === 'function') renderPlotlyWeatherChart();
      if (typeof renderPlotlyShiftHeatmap === 'function') renderPlotlyShiftHeatmap();
    }
  }, 150);
});

function switchMainTab(targetTab) {
  if (!targetTab) return;
  const tabBtns = document.querySelectorAll('.app-tab-btn, .mobile-bottom-nav-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabBtns.forEach(b => {
    const isMatch = b.getAttribute('data-tab') === targetTab;
    b.classList.toggle('active', isMatch);
    b.setAttribute('aria-selected', isMatch ? 'true' : 'false');
  });

  tabPanes.forEach(pane => {
    pane.classList.remove('active');
    pane.style.display = 'none';
  });

  const activePane = document.getElementById(`tab-${targetTab}`);
  if (activePane) {
    activePane.style.display = 'block';
    activePane.classList.add('active');
    window.scrollTo(0, 0);
    if (typeof Plotly !== 'undefined') {
      activePane.querySelectorAll('.js-plotly-plot').forEach(el => {
        try { Plotly.Plots.resize(el); } catch (e) {}
      });
      requestAnimationFrame(() => {
        activePane.querySelectorAll('.js-plotly-plot').forEach(el => {
          try { Plotly.Plots.resize(el); } catch (e) {}
        });
      });
    }
  }

  if (targetTab === 'forecasting-analytics') {
    // Zero Trust Access Gate Check: If payloads are blocked (or window.BBQ_PAYLOADS missing), reveal auth gate
    const authGate = document.getElementById('analytics-auth-gate');
    if (!window.BBQ_PAYLOADS || !window.BBQ_PAYLOADS.dashboard_payload) {
      if (authGate) authGate.style.display = 'block';
    } else {
      if (authGate) authGate.style.display = 'none';
    }

    renderPlotlyForecastingChart(getActiveDaysCount());
    if (typeof renderPlotlyPredictiveChart === 'function') renderPlotlyPredictiveChart();
    if (typeof renderPlotlyEventChart === 'function') renderPlotlyEventChart();
    if (typeof renderPlotlyWeatherChart === 'function') renderPlotlyWeatherChart();
    if (typeof renderPlotlyShiftHeatmap === 'function') renderPlotlyShiftHeatmap();
    if (typeof renderAdvancedAnalytics === 'function') renderAdvancedAnalytics();
    [
      'plotly-meat-sales-chart',
      'plotly-predictive-velocity-chart',
      'plotly-weather-impact-chart',
      'plotly-event-impact-chart',
      'plotly-sellout-chart',
      'plotly-shift-heatmap'
    ].forEach(applyChartTouchSafety);
    document.body.classList.add('hide-footer');
    const footer = document.querySelector('.app-footer');
    if (footer) footer.style.display = 'none';
  } else {
    document.body.classList.remove('hide-footer');
    const footer = document.querySelector('.app-footer');
    if (footer) footer.style.display = 'block';
  }
}

// Multi-Tab & POS Analytics Forecasting Module Integration
function initMultiTabNavigation() {
  const tabBtns = document.querySelectorAll('.app-tab-btn, .mobile-bottom-nav-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchMainTab(targetTab);
      try {
        localStorage.setItem('yellow_rose_active_tab', targetTab);
      } catch (e) {}
    });
  });

  const hash = (window.location.hash || '').toLowerCase();
  const search = (window.location.search || '').toLowerCase();
  let defaultTab = null;
  if (hash.includes('forecasting') || hash.includes('predictive') || search.includes('forecasting') || search.includes('predictive')) {
    defaultTab = 'forecasting-analytics';
  } else {
    try {
      const savedTab = localStorage.getItem('yellow_rose_active_tab');
      if (savedTab === 'forecasting-analytics') defaultTab = savedTab;
    } catch (e) {}
  }
  if (defaultTab) {
    switchMainTab(defaultTab);
  }
}

function initDesignDebugPanel() {
  const toggleBtn = document.getElementById('btn-toggle-debug-drawer');
  const drawer = document.getElementById('design-debug-drawer');
  const vpBtns = document.querySelectorAll('.debug-vp-btn');
  const cbBtns = document.querySelectorAll('.debug-cb-btn');
  const themeBtn = document.getElementById('btn-debug-contrast');
  const unitModeBtn = document.getElementById('btn-debug-unit-mode');
  const rollupAllBtn = document.getElementById('btn-debug-rollup-toggle');
  const copyBtn = document.getElementById('btn-copy-debug-tokens');
  const statusEl = document.getElementById('debug-token-status');
  const printBtn = document.getElementById('btn-print-daily-brief');

  if (typeof getUnitDisplayMode === 'function' && typeof setUnitDisplayMode === 'function') {
    setUnitDisplayMode(getUnitDisplayMode());
  }
  if (unitModeBtn) {
    unitModeBtn.addEventListener('click', () => {
      const currentMode = typeof getUnitDisplayMode === 'function' ? getUnitDisplayMode() : 'case';
      const nextMode = currentMode === 'case' ? 'lbs' : 'case';
      if (typeof setUnitDisplayMode === 'function') {
        setUnitDisplayMode(nextMode);
      }
      renderPlotlyForecastingChart(getActiveDaysCount());
      if (statusEl) {
        statusEl.textContent = nextMode === 'case'
          ? 'Unit display: Case & Cut View (Default)'
          : 'Unit display: Raw Lbs View';
      }
    });
  }

  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print();
    });
  }

  if (toggleBtn && drawer) {
    toggleBtn.addEventListener('click', () => {
      const isHidden = drawer.hasAttribute('hidden');
      if (isHidden) {
        drawer.removeAttribute('hidden');
        toggleBtn.setAttribute('aria-expanded', 'true');
      } else {
        drawer.setAttribute('hidden', '');
        toggleBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  let activePreviewWidth = 'fluid';
  vpBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      vpBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const w = btn.getAttribute('data-vp') || 'fluid';
      activePreviewWidth = w;
      const appShell = document.querySelector('.app-content');
      if (appShell) {
        if (w === 'fluid') {
          appShell.style.maxWidth = '';
          document.body.removeAttribute('data-preview-vp');
        } else {
          appShell.style.maxWidth = `${w}px`;
          document.body.setAttribute('data-preview-vp', w);
        }
      }
      if (statusEl) statusEl.textContent = `Viewport preset: ${w === 'fluid' ? '100% Fluid' : w + 'px'}`;
    });
  });

  let activeColorblindMode = 'standard';
  cbBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      cbBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.getAttribute('data-cb-mode') || 'standard';
      activeColorblindMode = mode;
      if (mode === 'standard') {
        document.body.removeAttribute('data-cb-mode');
      } else {
        document.body.setAttribute('data-cb-mode', mode);
      }
      if (statusEl) statusEl.textContent = `Colorblind mode: ${mode}`;
    });
  });

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const isHighContrast = document.body.classList.toggle('pit-high-contrast');
      themeBtn.textContent = isHighContrast ? 'Contrast: Pit Daylight (High)' : 'Contrast: Smokehouse Dark';
      if (statusEl) statusEl.textContent = isHighContrast ? 'High-Contrast Pit Daylight active' : 'Smokehouse Dark active';
    });
  }

  if (rollupAllBtn && typeof setAllRollUpSections === 'function') {
    rollupAllBtn.addEventListener('click', () => {
      const currentlyExpanded = rollupAllBtn.getAttribute('data-rollup-all-expanded') !== 'false';
      const nextExpanded = !currentlyExpanded;
      setAllRollUpSections(nextExpanded);
      if (statusEl) {
        statusEl.textContent = nextExpanded ? 'All Roll-Up sections expanded' : 'All Roll-Up sections collapsed';
      }
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const styles = getComputedStyle(document.documentElement);
      const activeUnitMode = typeof getUnitDisplayMode === 'function' ? getUnitDisplayMode() : 'case';
      const tokenPayload = {
        version: '2.1.0',
        activeViewportPreset: activePreviewWidth,
        windowInnerWidth: window.innerWidth,
        mobileTouchSafeCharts: isMobileViewport(),
        unitDisplayMode: activeUnitMode,
        colorblindMode: activeColorblindMode,
        contrastMode: document.body.classList.contains('pit-high-contrast') ? 'pit-high-contrast' : 'smokehouse-dark',
        breakpoints: { mobileMax: 767, tabletMin: 768, desktopMin: 1280, executiveWide: 1440 },
        okabeItoPalette: {
          orange: '#E69F00',
          skyBlue: '#56B4E9',
          bluishGreen: '#009E73',
          amberYellow: '#F0E442',
          deepBlue: '#0072B2',
          vermillion: '#D55E00',
          reddishPurple: '#CC79A7'
        },
        tokens: {
          bgColor: styles.getPropertyValue('--bg-color').trim() || '#0f0e0e',
          surfaceColor: styles.getPropertyValue('--surface-color').trim() || '#1c1a17',
          accentGold: styles.getPropertyValue('--accent-primary').trim() || '#e69d00',
          accentEmber: styles.getPropertyValue('--accent-secondary').trim() || '#d84315',
          touchTargetMinPx: 48
        }
      };
      const jsonStr = JSON.stringify(tokenPayload, null, 2);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(jsonStr).then(() => {
          if (statusEl) statusEl.textContent = 'Copied v2.2.0 JSON tokens to clipboard';
        }).catch(() => {
          if (statusEl) statusEl.textContent = 'Tokens serialized (clipboard unavailable)';
        });
      } else if (statusEl) {
        statusEl.textContent = 'Tokens serialized';
      }
      window.__LAST_COPIED_DESIGN_TOKENS__ = tokenPayload;
    });
  }
}

function initForecastingControls() {
  const dateInput = document.getElementById('forecast-start-date');
  const endDateInput = document.getElementById('forecast-end-date');
  const btnCal = document.getElementById('btn-open-calendar');

  if (btnCal && dateInput) {
    btnCal.addEventListener('click', () => {
      try {
        if (typeof dateInput.showPicker === 'function') {
          dateInput.showPicker();
        } else {
          dateInput.focus();
          dateInput.click();
        }
      } catch (e) {
        dateInput.focus();
      }
    });
  }

  // Set default timezone-aware today string in shop operating timezone
  const d = new Date();
  const tzOffset = d.getTimezoneOffset() * 60000;
  const today = (window.ShopTime && typeof window.ShopTime.shopDateStr === 'function')
    ? window.ShopTime.shopDateStr()
    : (new Date(d.getTime() - tzOffset)).toISOString().split('T')[0];

  if (dateInput && !dateInput.value) {
    dateInput.value = today;
  }
  if (endDateInput && !endDateInput.value) {
    endDateInput.value = today;
  }

  if (dateInput) {
    dateInput.addEventListener('click', function() { if (this.showPicker) this.showPicker(); });
    dateInput.addEventListener('change', (e) => {
      document.querySelectorAll('.forecast-preset-group .preset-btn').forEach(b => b.classList.remove('active'));
      const startVal = e.target.value;
      if (endDateInput && (!endDateInput.value || endDateInput.value < startVal)) {
        endDateInput.value = startVal;
      }
      if (typeof handleDateSelectionLookup === 'function') handleDateSelectionLookup(startVal);
      renderPlotlyForecastingChart(getActiveDaysCount());
      if (typeof renderPlotlyPredictiveChart === 'function') renderPlotlyPredictiveChart();
    });
  }

  if (endDateInput) {
    endDateInput.addEventListener('click', function() { if (this.showPicker) this.showPicker(); });
    endDateInput.addEventListener('change', (e) => {
      document.querySelectorAll('.forecast-preset-group .preset-btn').forEach(b => b.classList.remove('active'));
      const endVal = e.target.value;
      if (dateInput && dateInput.value && endVal < dateInput.value) {
        endDateInput.value = dateInput.value;
      }
      renderPlotlyForecastingChart(getActiveDaysCount());
      if (typeof renderPlotlyPredictiveChart === 'function') renderPlotlyPredictiveChart();
    });
  }

  // Subtab switching
  const btnSubtabPredictive = document.getElementById('btn-subtab-predictive');
  const btnSubtabArima = document.getElementById('btn-subtab-arima');
  const btnSubtabWeather = document.getElementById('btn-subtab-weather');
  const btnSubtabEvent = document.getElementById('btn-subtab-event');
  const btnSubtabShift = document.getElementById('btn-subtab-shift');
  const btnSubtabAdvanced = document.getElementById('btn-subtab-advanced');
  const btnSubtabReports = document.getElementById('btn-subtab-reports');

  const viewPredictive = document.getElementById('subtab-view-predictive');
  const viewArima = document.getElementById('subtab-view-arima');
  const viewWeather = document.getElementById('subtab-view-weather');
  const viewEvent = document.getElementById('subtab-view-event');
  const viewShift = document.getElementById('subtab-view-shift');
  const viewAdvanced = document.getElementById('subtab-view-advanced');
  const viewReports = document.getElementById('subtab-view-reports');

  const allSubtabBtns = [btnSubtabPredictive, btnSubtabArima, btnSubtabWeather, btnSubtabEvent, btnSubtabShift, btnSubtabAdvanced, btnSubtabReports].filter(Boolean);
  const allSubtabViews = [viewPredictive, viewArima, viewWeather, viewEvent, viewShift, viewAdvanced, viewReports].filter(Boolean);

  function activateSubtab(btn, view) {
    allSubtabBtns.forEach(b => b.classList.remove('active'));
    allSubtabViews.forEach(v => v.style.display = 'none');
    if (btn) btn.classList.add('active');
    if (view) {
      view.style.display = 'block';
      if (typeof Plotly !== 'undefined') {
        view.querySelectorAll('.js-plotly-plot').forEach(el => {
          try { Plotly.Plots.resize(el); } catch (e) {}
        });
        requestAnimationFrame(() => {
          view.querySelectorAll('.js-plotly-plot').forEach(el => {
            try { Plotly.Plots.resize(el); } catch (e) {}
          });
        });
      }
    }
  }

  if (btnSubtabPredictive) {
    btnSubtabPredictive.addEventListener('click', () => {
      activateSubtab(btnSubtabPredictive, viewPredictive);
      if (typeof renderPlotlyPredictiveChart === 'function') renderPlotlyPredictiveChart();
    });
  }

  if (btnSubtabArima) {
    btnSubtabArima.addEventListener('click', () => {
      activateSubtab(btnSubtabArima, viewArima);
      renderPlotlyForecastingChart(getActiveDaysCount());
    });
  }

  if (btnSubtabWeather) {
    btnSubtabWeather.addEventListener('click', () => {
      activateSubtab(btnSubtabWeather, viewWeather);
      if (typeof renderPlotlyWeatherChart === 'function') renderPlotlyWeatherChart();
    });
  }

  if (btnSubtabEvent) {
    btnSubtabEvent.addEventListener('click', () => {
      activateSubtab(btnSubtabEvent, viewEvent);
      if (typeof renderPlotlyEventChart === 'function') renderPlotlyEventChart();
      if (typeof refreshEventsCalendar === 'function') refreshEventsCalendar();
    });
  }

  if (btnSubtabShift) {
    btnSubtabShift.addEventListener('click', () => {
      activateSubtab(btnSubtabShift, viewShift);
      const shiftSelector = document.getElementById('shift-selector');
      if (typeof renderPlotlyShiftHeatmap === 'function') {
        renderPlotlyShiftHeatmap(shiftSelector ? shiftSelector.value : 'all');
      }
    });
  }

  if (btnSubtabAdvanced) {
    btnSubtabAdvanced.addEventListener('click', () => {
      activateSubtab(btnSubtabAdvanced, viewAdvanced);
      if (typeof renderAdvancedAnalytics === 'function') renderAdvancedAnalytics();
    });
  }

  if (btnSubtabReports) {
    btnSubtabReports.addEventListener('click', () => {
      activateSubtab(btnSubtabReports, viewReports);
      if (typeof initDailyPitIntelligence === 'function') initDailyPitIntelligence();
    });
  }

  const categorySelector = document.getElementById('category-selector');
  if (categorySelector) {
    categorySelector.addEventListener('change', () => {
      renderPlotlyForecastingChart(getActiveDaysCount());
    });
  }

  const shiftSelector = document.getElementById('shift-selector');
  if (shiftSelector) {
    shiftSelector.addEventListener('change', () => {
      if (typeof renderPlotlyShiftHeatmap === 'function') renderPlotlyShiftHeatmap(shiftSelector.value);
    });
  }

  function updateSyncStatusTime() {
    const timeElem = document.getElementById('last-updated-time');
    const lastPulledElem = document.getElementById('data-last-pulled');
    if (!timeElem && !lastPulledElem) return;

    const getPayloadTime = () => {
      const candidates = [];
      if (window.BBQ_PAYLOADS) {
        if (window.BBQ_PAYLOADS.dashboard_payload && window.BBQ_PAYLOADS.dashboard_payload.forecast && window.BBQ_PAYLOADS.dashboard_payload.forecast.generated_at) {
          candidates.push(window.BBQ_PAYLOADS.dashboard_payload.forecast.generated_at);
        }
        if (window.BBQ_PAYLOADS.predictive_payload && window.BBQ_PAYLOADS.predictive_payload.generated_at) {
          candidates.push(window.BBQ_PAYLOADS.predictive_payload.generated_at);
        }
        if (window.BBQ_PAYLOADS.hourly_actuals && window.BBQ_PAYLOADS.hourly_actuals.generated_at) {
          candidates.push(window.BBQ_PAYLOADS.hourly_actuals.generated_at);
        }
        if (window.BBQ_PAYLOADS.quick_wind_alerts && window.BBQ_PAYLOADS.quick_wind_alerts.generated_at) {
          candidates.push(window.BBQ_PAYLOADS.quick_wind_alerts.generated_at);
        }
      }
      let latest = null;
      for (const c of candidates) {
        const d = new Date(c);
        if (!isNaN(d.getTime())) {
          if (!latest || d > latest) latest = d;
        }
      }
      return latest;
    };

    const setTimeText = (syncDate) => {
      const payloadDate = getPayloadTime();
      let bestDate = syncDate;
      if (!bestDate || (payloadDate && payloadDate > bestDate)) {
        bestDate = payloadDate;
      }
      const formatted = (bestDate && window.ShopTime && typeof window.ShopTime.formatShopTimestamp === 'function')
        ? window.ShopTime.formatShopTimestamp(bestDate.toISOString())
        : (bestDate ? bestDate.toLocaleString() : 'Live');

      if (timeElem) {
        timeElem.textContent = formatted;
      }
      if (lastPulledElem) {
        lastPulledElem.textContent = `Data Last Synced: ${formatted}`;
      }
    };

    if (typeof fetchJsonSafe !== 'function') {
      setTimeText(null);
      return;
    }

    fetchJsonSafe('clover_api/analytics/sync_status.json?v=' + Date.now(), null, 3000)
      .then(data => data || fetchJsonSafe('analytics/sync_status.json?v=' + Date.now(), null, 3000))
      .then(data => {
        const syncDate = (data && data.last_synced_at) ? new Date(data.last_synced_at) : null;
        setTimeText(syncDate);
      })
      .catch(() => {
        setTimeText(null);
      });
  }
  window.updateSyncStatusTime = updateSyncStatusTime;

  const btnRefreshAnalytics = document.getElementById('btn-refresh-analytics');
  if (btnRefreshAnalytics) {
    updateSyncStatusTime();

    let lastRefreshTime = 0;
    btnRefreshAnalytics.addEventListener('click', () => {
      const now = Date.now();
      if (now - lastRefreshTime < 5000) {
        return;
      }
      lastRefreshTime = now;
      const origText = btnRefreshAnalytics.innerHTML;
      btnRefreshAnalytics.innerHTML = '<span class="btn-icon">↻</span><span class="btn-text">Refreshing...</span>';

      renderPlotlyForecastingChart(getActiveDaysCount()).then(() => {
        updateSyncStatusTime();
        btnRefreshAnalytics.innerHTML = origText;
      });
      if (typeof renderPlotlyEventChart === 'function') renderPlotlyEventChart();
      if (typeof renderPlotlyWeatherChart === 'function') renderPlotlyWeatherChart();
    });
  }

  // Operational Horizon Presets
  const btnYesterday = document.getElementById('btn-preset-yesterday');
  const btnToday = document.getElementById('btn-preset-today');
  const btnTomorrow = document.getElementById('btn-preset-tomorrow');
  const btnWeekend = document.getElementById('btn-preset-weekend');
  const btnThursday = document.getElementById('btn-preset-thursday');
  const btnFriday = document.getElementById('btn-preset-friday');
  const btnSaturday = document.getElementById('btn-preset-saturday');
  const btnSunday = document.getElementById('btn-preset-sunday');
  const btn7 = document.getElementById('btn-preset-7');
  const btn14 = document.getElementById('btn-preset-14');

  if (btnYesterday) btnYesterday.addEventListener('click', () => updatePresetHorizon('btn-preset-yesterday', 1, -1));
  if (btnToday) btnToday.addEventListener('click', () => updatePresetHorizon('btn-preset-today', 1, 0));
  if (btnTomorrow) btnTomorrow.addEventListener('click', () => updatePresetHorizon('btn-preset-tomorrow', 1, 1));
  if (btnWeekend) btnWeekend.addEventListener('click', () => updatePresetWeekend());
  if (btnThursday) btnThursday.addEventListener('click', () => updatePresetDay(4, 'btn-preset-thursday'));
  if (btnFriday) btnFriday.addEventListener('click', () => updatePresetDay(5, 'btn-preset-friday'));
  if (btnSaturday) btnSaturday.addEventListener('click', () => updatePresetDay(6, 'btn-preset-saturday'));
  if (btnSunday) btnSunday.addEventListener('click', () => updatePresetDay(0, 'btn-preset-sunday'));
  if (btn7) btn7.addEventListener('click', () => updatePresetHorizon('btn-preset-7', 7, 0));
  if (btn14) btn14.addEventListener('click', () => updatePresetHorizon('btn-preset-14', 14, 0));

  if (typeof setupTimeTravelControls === 'function') setupTimeTravelControls();
}

function updatePresetHorizon(btnId, days, startOffset = 0) {
  document.querySelectorAll('.forecast-preset-group .preset-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(btnId);
  if (btn) btn.classList.add('active');

  const d = new Date();
  if (startOffset !== 0) {
    d.setDate(d.getDate() + startOffset);
  }
  const tzOffset = d.getTimezoneOffset() * 60000;
  const targetDateStr = (new Date(d.getTime() - tzOffset)).toISOString().split('T')[0];

  const dateInput = document.getElementById('forecast-start-date');
  if (dateInput) {
    dateInput.value = targetDateStr;
    if (typeof handleDateSelectionLookup === 'function') handleDateSelectionLookup(targetDateStr);
  }

  const endD = new Date(d);
  endD.setDate(endD.getDate() + days - 1);
  const endTargetDateStr = (new Date(endD.getTime() - tzOffset)).toISOString().split('T')[0];
  const endDateInput = document.getElementById('forecast-end-date');
  if (endDateInput) {
    endDateInput.value = endTargetDateStr;
  }

  renderPlotlyForecastingChart(days);
  if (typeof renderPlotlyPredictiveChart === 'function') renderPlotlyPredictiveChart();
}

function updatePresetWeekend() {
  document.querySelectorAll('.forecast-preset-group .preset-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('btn-preset-weekend');
  if (btn) btn.classList.add('active');

  const d = new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  let daysUntilFriday = (5 - day + 7) % 7;
  if (day === 5) daysUntilFriday = 0;
  else if (day === 6) daysUntilFriday = -1;
  else if (day === 0) daysUntilFriday = -2;

  const friDate = new Date();
  friDate.setDate(friDate.getDate() + daysUntilFriday);
  const sunDate = new Date(friDate);
  sunDate.setDate(friDate.getDate() + 2);

  const tzOffset = d.getTimezoneOffset() * 60000;
  const friStr = (new Date(friDate.getTime() - tzOffset)).toISOString().split('T')[0];
  const sunStr = (new Date(sunDate.getTime() - tzOffset)).toISOString().split('T')[0];

  const dateInput = document.getElementById('forecast-start-date');
  if (dateInput) {
    dateInput.value = friStr;
    if (typeof handleDateSelectionLookup === 'function') handleDateSelectionLookup(friStr);
  }
  const endDateInput = document.getElementById('forecast-end-date');
  if (endDateInput) {
    endDateInput.value = sunStr;
  }

  renderPlotlyForecastingChart(3);
  if (typeof renderPlotlyPredictiveChart === 'function') renderPlotlyPredictiveChart();
}

function updatePresetDay(targetDayOfWeek, btnId) {
  document.querySelectorAll('.forecast-preset-group .preset-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(btnId);
  if (btn) btn.classList.add('active');

  const d = new Date();
  const currentDay = d.getDay();
  let daysAhead = (targetDayOfWeek - currentDay + 7) % 7;
  if (daysAhead === 0) daysAhead = 0;

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysAhead);

  const tzOffset = d.getTimezoneOffset() * 60000;
  const targetDateStr = (new Date(targetDate.getTime() - tzOffset)).toISOString().split('T')[0];

  const dateInput = document.getElementById('forecast-start-date');
  if (dateInput) {
    dateInput.value = targetDateStr;
    if (typeof handleDateSelectionLookup === 'function') handleDateSelectionLookup(targetDateStr);
  }
  const endDateInput = document.getElementById('forecast-end-date');
  if (endDateInput) {
    endDateInput.value = targetDateStr;
  }

  renderPlotlyForecastingChart(1);
  if (typeof renderPlotlyPredictiveChart === 'function') renderPlotlyPredictiveChart();
}

function updatePresetThirdSaturday() {
  document.querySelectorAll('.forecast-preset-group .preset-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('btn-preset-saturday');
  if (btn) btn.classList.add('active');

  const d = new Date();
  d.setDate(15);
  while (d.getDay() !== 6) {
    d.setDate(d.getDate() + 1);
  }
  if (d < new Date()) {
    d.setMonth(d.getMonth() + 1);
    d.setDate(15);
    while (d.getDay() !== 6) {
      d.setDate(d.getDate() + 1);
    }
  }

  const tzOffset = d.getTimezoneOffset() * 60000;
  const targetDateStr = (new Date(d.getTime() - tzOffset)).toISOString().split('T')[0];
  const dateInput = document.getElementById('forecast-start-date');
  if (dateInput) {
    dateInput.value = targetDateStr;
    if (typeof handleDateSelectionLookup === 'function') handleDateSelectionLookup(targetDateStr);
  }
  const endDateInput = document.getElementById('forecast-end-date');
  if (endDateInput) {
    endDateInput.value = targetDateStr;
  }
  renderPlotlyForecastingChart(1);
  if (typeof renderPlotlyPredictiveChart === 'function') renderPlotlyPredictiveChart();
}

async function renderPlotlyForecastingChart(daysCount = 14) {
  const mySeq = ++_forecastRenderSeq;
  try {
    const chartContainer = document.getElementById('plotly-meat-sales-chart');

    const rawStartDate = document.getElementById('forecast-start-date')?.value;
    const parsedStartDate = parseValidDate(rawStartDate);
    const dNow = new Date();
    const tzOffset = dNow.getTimezoneOffset() * 60000;
    const todayStr = (new Date(dNow.getTime() - tzOffset)).toISOString().split('T')[0];

    const targetDateInput = parsedStartDate ? rawStartDate.trim() : todayStr;
    const targetDateObj = parseValidDate(targetDateInput) || new Date();
    const shortDayStr = targetDateObj.toLocaleDateString('en-US', { weekday: 'short' });

    daysCount = Math.max(1, parseInt(daysCount) || 1);

    // Embedded default 14-day forecast data to ensure zero downtime or offline/CORS issues
    const defaultForecastRecords = [
      { date: "2026-08-14", day_name: "Fri", predicted_revenue: 2880.0, brisket_raw_lbs: 81.5, pork_shoulder_raw_lbs: 48.0, sausage_lbs: 54, tacos_sold: 72, rosebuds_sold: 28, pork_ribs_racks: 4, beef_dino_ribs: 4, recommended_staff: 4, pitmaster_hours: 34.0, is_closed: false },
      { date: "2026-08-15", day_name: "Sat", predicted_revenue: 4554.0, brisket_raw_lbs: 128.9, pork_shoulder_raw_lbs: 75.9, sausage_lbs: 85, tacos_sold: 113, rosebuds_sold: 45, pork_ribs_racks: 7, beef_dino_ribs: 6, recommended_staff: 5, pitmaster_hours: 42.5, is_closed: false },
      { date: "2026-08-16", day_name: "Sun", predicted_revenue: 2520.0, brisket_raw_lbs: 71.5, pork_shoulder_raw_lbs: 42.0, sausage_lbs: 47, tacos_sold: 63, rosebuds_sold: 25, pork_ribs_racks: 4, beef_dino_ribs: 3, recommended_staff: 4, pitmaster_hours: 34.0, is_closed: false },
      { date: "2026-08-17", day_name: "Mon", predicted_revenue: 0.0, brisket_raw_lbs: 0.0, pork_shoulder_raw_lbs: 0.0, sausage_lbs: 0, tacos_sold: 0, rosebuds_sold: 0, pork_ribs_racks: 0, beef_dino_ribs: 0, recommended_staff: 0, pitmaster_hours: 0.0, is_closed: true },
      { date: "2026-08-18", day_name: "Tue", predicted_revenue: 1440.0, brisket_raw_lbs: 40.7, pork_shoulder_raw_lbs: 24.0, sausage_lbs: 27, tacos_sold: 36, rosebuds_sold: 14, pork_ribs_racks: 2, beef_dino_ribs: 2, recommended_staff: 2, pitmaster_hours: 17.0, is_closed: false },
      { date: "2026-08-19", day_name: "Wed", predicted_revenue: 1620.0, brisket_raw_lbs: 45.8, pork_shoulder_raw_lbs: 27.0, sausage_lbs: 30, tacos_sold: 40, rosebuds_sold: 16, pork_ribs_racks: 2, beef_dino_ribs: 2, recommended_staff: 3, pitmaster_hours: 25.5, is_closed: false },
      { date: "2026-08-20", day_name: "Thu", predicted_revenue: 1980.0, brisket_raw_lbs: 55.8, pork_shoulder_raw_lbs: 33.0, sausage_lbs: 37, tacos_sold: 49, rosebuds_sold: 19, pork_ribs_racks: 3, beef_dino_ribs: 2, recommended_staff: 3, pitmaster_hours: 25.5, is_closed: false },
      { date: "2026-08-21", day_name: "Fri", predicted_revenue: 2880.0, brisket_raw_lbs: 81.5, pork_shoulder_raw_lbs: 48.0, sausage_lbs: 54, tacos_sold: 72, rosebuds_sold: 28, pork_ribs_racks: 4, beef_dino_ribs: 4, recommended_staff: 4, pitmaster_hours: 34.0, is_closed: false },
      { date: "2026-08-22", day_name: "Sat", predicted_revenue: 3960.0, brisket_raw_lbs: 112.2, pork_shoulder_raw_lbs: 66.0, sausage_lbs: 74, tacos_sold: 99, rosebuds_sold: 39, pork_ribs_racks: 6, beef_dino_ribs: 5, recommended_staff: 5, pitmaster_hours: 42.5, is_closed: false },
      { date: "2026-08-23", day_name: "Sun", predicted_revenue: 2520.0, brisket_raw_lbs: 71.5, pork_shoulder_raw_lbs: 42.0, sausage_lbs: 47, tacos_sold: 63, rosebuds_sold: 25, pork_ribs_racks: 4, beef_dino_ribs: 3, recommended_staff: 4, pitmaster_hours: 34.0, is_closed: false },
      { date: "2026-08-24", day_name: "Mon", predicted_revenue: 0.0, brisket_raw_lbs: 0.0, pork_shoulder_raw_lbs: 0.0, sausage_lbs: 0, tacos_sold: 0, rosebuds_sold: 0, pork_ribs_racks: 0, beef_dino_ribs: 0, recommended_staff: 0, pitmaster_hours: 0.0, is_closed: true },
      { date: "2026-08-25", day_name: "Tue", predicted_revenue: 1440.0, brisket_raw_lbs: 40.7, pork_shoulder_raw_lbs: 24.0, sausage_lbs: 27, tacos_sold: 36, rosebuds_sold: 14, pork_ribs_racks: 2, beef_dino_ribs: 2, recommended_staff: 2, pitmaster_hours: 17.0, is_closed: false },
      { date: "2026-08-26", day_name: "Wed", predicted_revenue: 1620.0, brisket_raw_lbs: 45.8, pork_shoulder_raw_lbs: 27.0, sausage_lbs: 30, tacos_sold: 40, rosebuds_sold: 16, pork_ribs_racks: 2, beef_dino_ribs: 2, recommended_staff: 3, pitmaster_hours: 25.5, is_closed: false },
      { date: "2026-08-27", day_name: "Thu", predicted_revenue: 1980.0, brisket_raw_lbs: 55.8, pork_shoulder_raw_lbs: 33.0, sausage_lbs: 37, tacos_sold: 49, rosebuds_sold: 19, pork_ribs_racks: 3, beef_dino_ribs: 2, recommended_staff: 3, pitmaster_hours: 25.5, is_closed: false }
    ];

    const safeDefaultRecord = (dStr, sDay) => {
      const isMon = sDay === 'Mon';
      return {
        date: dStr,
        day_name: sDay,
        predicted_revenue: isMon ? 0.0 : 2700.0,
        brisket_raw_lbs: isMon ? 0.0 : 80.0,
        pork_shoulder_raw_lbs: isMon ? 0.0 : 50.0,
        sausage_lbs: isMon ? 0.0 : 50.0,
        tacos_sold: isMon ? 0 : 60,
        rosebuds_sold: isMon ? 0 : 25,
        pork_ribs_racks: isMon ? 0 : 4,
        beef_dino_ribs: isMon ? 0 : 3,
        recommended_staff: isMon ? 0 : 4,
        pitmaster_hours: isMon ? 0.0 : 34.0,
        is_historical: false,
        is_closed: isMon
      };
    };

    let dashPayload = null;
    if (window.BBQ_PAYLOADS && window.BBQ_PAYLOADS.dashboard_payload) {
      dashPayload = window.BBQ_PAYLOADS.dashboard_payload;
    } else if (typeof fetchJsonSafe === 'function') {
      dashPayload = await fetchJsonSafe('clover_api/analytics/dashboard_payload.json?v=' + Date.now(), null, 4000);
      if (mySeq !== _forecastRenderSeq) return;
    }

    if (typeof window.updateSyncStatusTime === 'function') {
      window.updateSyncStatusTime();
    }

    let histPayload = null;
    if (window.BBQ_PAYLOADS && window.BBQ_PAYLOADS.historical_payload) {
      histPayload = window.BBQ_PAYLOADS.historical_payload;
    } else if (typeof fetchJsonSafe === 'function') {
      histPayload = await fetchJsonSafe('clover_api/analytics/historical_payload.json?v=' + Date.now(), null, 4000);
      if (mySeq !== _forecastRenderSeq) return;
    }

    let records = (dashPayload && dashPayload.forecast && Array.isArray(dashPayload.forecast.forecast_records) && dashPayload.forecast.forecast_records.length > 0)
      ? dashPayload.forecast.forecast_records.map(r => ({ ...r }))
      : defaultForecastRecords.map(r => ({ ...r }));

    if (histPayload && Array.isArray(histPayload.historical_records) && histPayload.historical_records.length > 0) {
      records = [...histPayload.historical_records.map(r => ({ ...r })), ...records];
      records.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      records = Array.from(new Map(records.map(item => [item.date, item])).values());
    }

    // Helper for special holiday open operations
    const isHolidayOpen = (dateStr) => {
      const rawCal = window.BBQ_PAYLOADS?.calendar_events;
      const events = Array.isArray(rawCal) ? rawCal : (rawCal?.events || []);
      const evt = events.find(e => e.date === dateStr);
      return Boolean(evt && evt.category === 'holiday' && evt.multiplier > 0 && !String(evt.title || '').toLowerCase().includes('closed'));
    };

    // Sanitize records: Guarantee closed non-operating Mondays (and Christmas) have 0 revenue and 0 prep targets
    records = records.map(r => {
      const d = parseValidDate(r.date);
      const isMon = r.day_name === 'Mon' || (d && d.getDay() === 1);
      const isClosedHoliday = r.date && r.date.endsWith('-12-25');
      if ((isMon && !isHolidayOpen(r.date)) || isClosedHoliday) {
        return {
          ...r,
          predicted_revenue: 0.0,
          actual_revenue: (r.actual_revenue !== undefined && r.actual_revenue > 0) ? r.actual_revenue : 0.0,
          brisket_raw_lbs: 0.0,
          pork_shoulder_raw_lbs: 0.0,
          sausage_lbs: 0.0,
          tacos_sold: 0,
          rosebuds_sold: 0,
          pork_ribs_racks: 0,
          beef_dino_ribs: 0,
          recommended_staff: 0,
          pitmaster_hours: 0.0,
          is_closed: true
        };
      }
      return r;
    });

    // Match the active selected date
    let matchedRecord = records.find(r => r.date === targetDateInput);
    const isTargetMonday = (shortDayStr === 'Mon' || targetDateObj.getDay() === 1);
    const isTargetClosedHoliday = targetDateInput.endsWith('-12-25');

    if (!matchedRecord) {
      if ((isTargetMonday && !isHolidayOpen(targetDateInput)) || isTargetClosedHoliday) {
        matchedRecord = safeDefaultRecord(targetDateInput, 'Mon');
      } else {
        const histDays = records.filter(r => r.day_name === shortDayStr && r.is_historical && !r.is_closed);

        if (histDays.length > 0) {
          const revs = histDays.map(r => r.predicted_revenue || 0).sort((a, b) => a - b);
          const q1 = revs[Math.floor((revs.length / 4))];
          const q3 = revs[Math.ceil((revs.length * (3 / 4))) - 1] || revs[revs.length - 1];
          const iqr = q3 - q1;
          const lowerBound = q1 - 1.5 * iqr;
          const upperBound = q3 + 1.5 * iqr;

          const validDays = histDays.filter(r => (r.predicted_revenue || 0) >= lowerBound && (r.predicted_revenue || 0) <= upperBound);
          const daysToAverage = validDays.length > 0 ? validDays : histDays;

          matchedRecord = {
            date: targetDateInput,
            day_name: shortDayStr,
            is_historical: false,
            is_fallback_average: true,
            predicted_revenue: daysToAverage.reduce((sum, r) => sum + (r.predicted_revenue || 0), 0) / daysToAverage.length,
            brisket_raw_lbs: daysToAverage.reduce((sum, r) => sum + (r.brisket_raw_lbs || 0), 0) / daysToAverage.length,
            pork_shoulder_raw_lbs: daysToAverage.reduce((sum, r) => sum + (r.pork_shoulder_raw_lbs || 0), 0) / daysToAverage.length,
            sausage_lbs: daysToAverage.reduce((sum, r) => sum + (r.sausage_lbs || 0), 0) / daysToAverage.length,
            tacos_sold: Math.round(daysToAverage.reduce((sum, r) => sum + (r.tacos_sold || 0), 0) / daysToAverage.length),
            rosebuds_sold: Math.round(daysToAverage.reduce((sum, r) => sum + (r.rosebuds_sold || 0), 0) / daysToAverage.length),
            pork_ribs_racks: daysToAverage.reduce((sum, r) => sum + (r.pork_ribs_racks || 0), 0) / daysToAverage.length,
            beef_dino_ribs: daysToAverage.reduce((sum, r) => sum + (r.beef_dino_ribs || 0), 0) / daysToAverage.length,
            actual_revenue: daysToAverage.reduce((sum, r) => sum + (r.actual_revenue || 0), 0) / daysToAverage.length
          };

          // Dynamic calendar events + Fahrenheit Open-Meteo resolver with 3.5s circuit breaker
          const evtImpact = typeof resolveDateEventImpact === 'function'
            ? resolveDateEventImpact(targetDateInput)
            : { multiplier: 1.0, label: '' };
          const weatherImpact = typeof resolveOpenMeteoWeatherImpact === 'function'
            ? await resolveOpenMeteoWeatherImpact(targetDateInput, 3500)
            : { multiplier: 1.0, label: '' };
          if (mySeq !== _forecastRenderSeq) return;

          const eventMultiplier = evtImpact.multiplier;
          const eventStr = evtImpact.label;
          const weatherMultiplier = weatherImpact.multiplier;
          const weatherStr = weatherImpact.label;

          const totalMultiplier = eventMultiplier * weatherMultiplier;
          if (totalMultiplier !== 1.0) {
            matchedRecord.predicted_revenue *= totalMultiplier;
            matchedRecord.brisket_raw_lbs *= totalMultiplier;
            matchedRecord.pork_shoulder_raw_lbs *= totalMultiplier;
            matchedRecord.sausage_lbs *= totalMultiplier;
            matchedRecord.tacos_sold = Math.round(matchedRecord.tacos_sold * totalMultiplier);
            matchedRecord.rosebuds_sold = Math.round(matchedRecord.rosebuds_sold * totalMultiplier);
            matchedRecord.pork_ribs_racks *= totalMultiplier;
            matchedRecord.beef_dino_ribs *= totalMultiplier;
            matchedRecord.insightSuffix = ` (Adjusted x${totalMultiplier.toFixed(2)} for ${eventStr}${eventStr && weatherStr ? ' and ' : ''}${weatherStr})`;
          }
        } else {
          const found = records.find(r => r.day_name === shortDayStr);
          matchedRecord = found ? { ...found, date: targetDateInput } : (records[0] ? { ...records[0], date: targetDateInput } : safeDefaultRecord(targetDateInput, shortDayStr));
        }
      }
    }
    if (!matchedRecord) {
      matchedRecord = safeDefaultRecord(targetDateInput, shortDayStr);
    }

    const startIndex = records.findIndex(r => r.date === targetDateInput);
    let slicedRecords = [];
    if (startIndex >= 0) {
      slicedRecords = records.slice(startIndex, startIndex + daysCount).map(r => ({ ...r }));
      while (slicedRecords.length < daysCount) {
        const lastRec = slicedRecords[slicedRecords.length - 1];
        const lastDate = parseValidDate(lastRec.date) || new Date();
        const nextDate = new Date(lastDate);
        nextDate.setDate(nextDate.getDate() + 1);
        const sDay = nextDate.toLocaleDateString('en-US', { weekday: 'short' });
        const dStr = (new Date(nextDate.getTime() - nextDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        const found = records.find(x => x.day_name === sDay);
        const paddedRec = found ? { ...found, date: dStr, day_name: sDay } : safeDefaultRecord(dStr, sDay);
        slicedRecords.push(paddedRec);
      }
    } else {
      const currDate = parseValidDate(targetDateInput) || new Date();
      for (let i = 0; i < daysCount; i++) {
        const stepDate = new Date(currDate);
        stepDate.setDate(stepDate.getDate() + i);
        const dStr = (new Date(stepDate.getTime() - stepDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        let r = records.find(x => x.date === dStr);
        if (i === 0 && matchedRecord && matchedRecord.date === dStr) {
          r = matchedRecord;
        } else if (!r) {
          const sDay = stepDate.toLocaleDateString('en-US', { weekday: 'short' });
          const histDays = records.filter(x => x.day_name === sDay && x.is_historical);
          if (histDays.length > 0) {
            r = {
              date: dStr,
              day_name: sDay,
              predicted_revenue: histDays.reduce((sum, x) => sum + (x.predicted_revenue || 0), 0) / histDays.length,
              brisket_raw_lbs: histDays.reduce((sum, x) => sum + (x.brisket_raw_lbs || 0), 0) / histDays.length,
              pork_shoulder_raw_lbs: histDays.reduce((sum, x) => sum + (x.pork_shoulder_raw_lbs || 0), 0) / histDays.length,
              sausage_lbs: histDays.reduce((sum, x) => sum + (x.sausage_lbs || 0), 0) / histDays.length,
              tacos_sold: Math.round(histDays.reduce((sum, x) => sum + (x.tacos_sold || 0), 0) / histDays.length),
              rosebuds_sold: Math.round(histDays.reduce((sum, x) => sum + (x.rosebuds_sold || 0), 0) / histDays.length),
              pork_ribs_racks: histDays.reduce((sum, x) => sum + (x.pork_ribs_racks || 0), 0) / histDays.length,
              beef_dino_ribs: histDays.reduce((sum, x) => sum + (x.beef_dino_ribs || 0), 0) / histDays.length,
              is_historical: false
            };
          } else {
            const found = records.find(x => x.day_name === sDay);
            r = found ? { ...found, date: dStr, day_name: sDay } : safeDefaultRecord(dStr, sDay);
          }
        }
        slicedRecords.push(r ? { ...r } : safeDefaultRecord(dStr, 'Day'));
      }
    }
    if (!slicedRecords || slicedRecords.length === 0) {
      slicedRecords = [matchedRecord];
    }

    const catSelector = document.getElementById('category-selector');
    const selectedCat = catSelector ? catSelector.value : 'baseline';

    // KPI Cards Logic - Sum if multi-day range provided, otherwise single target date
    const startDateVal = document.getElementById('forecast-start-date')?.value || targetDateInput;
    const endDateVal = document.getElementById('forecast-end-date')?.value || targetDateInput;
    const isRangeSelected = Boolean(startDateVal && endDateVal && (startDateVal !== endDateVal) && daysCount > 1);

    const isSimActive = Boolean(window.ShopTime && typeof window.ShopTime.isSimulating === 'function' && window.ShopTime.isSimulating());
    const isTargetClosed = Boolean(
      !isRangeSelected && !isSimActive && (
        matchedRecord?.is_closed ||
        (matchedRecord?.day_name === 'Mon' && !isHolidayOpen(matchedRecord.date)) ||
        (targetDateObj.getDay() === 1 && !isHolidayOpen(targetDateInput)) ||
        targetDateInput.endsWith('-12-25') ||
        (matchedRecord?.predicted_revenue !== undefined && matchedRecord.predicted_revenue <= 0 && !matchedRecord.is_historical)
      )
    );
    const closedDayLabel = targetDateInput.endsWith('-12-25') ? 'Christmas' : (['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][targetDateObj.getDay()] || 'Today');

    let bRaw = 0, pRaw = 0, sVal = 0, rVal = 0, drVal = 0, totalTacos = 0, totalRosebuds = 0, totalRev = 0, tVal = 0;
    let totalCogs = 0, totalStaff = 0, totalLaborHours = 0;

    function calcCalibratedTurkey(r) {
      if (!r || r.is_closed || r.day_name === 'Mon') return { cooked: 0, raw: 0 };
      const baselines = { 'Tue': 6.2, 'Wed': 7.2, 'Thu': 7.0, 'Fri': 11.5, 'Sat': 12.9, 'Sun': 8.9 };
      const baseCooked = baselines[r.day_name] || 6.0;
      const rev = r.predicted_revenue || 0;
      const benchmark = ['Fri', 'Sat', 'Sun'].includes(r.day_name) ? 3500 : 2800;
      const revMultiplier = rev > 0 ? Math.min(1.10, Math.max(0.90, rev / benchmark)) : 1.0;
      const cookedDemand = baseCooked * revMultiplier;
      const cookedTarget = Math.round(cookedDemand * 1.10 * 10) / 10; // +10% Extra Prep / Cushion
      const rawTarget = Math.round((cookedTarget / 0.70) * 10) / 10;   // 70% nominal yield
      return { cooked: cookedTarget, raw: rawTarget };
    }

    function minMaxStaff(rev) {
      if (!rev || rev <= 0) return 0;
      return Math.min(5, Math.max(2, Math.floor(rev / 1000) + 1));
    }
    function roundStaffHours(staff) {
      return Math.round(staff * 8.5 * 10) / 10;
    }

    if (isTargetClosed) {
      bRaw = 0; pRaw = 0; sVal = 0; rVal = 0; drVal = 0; totalTacos = 0; totalRosebuds = 0; totalRev = 0; tVal = 0;
      totalCogs = 0; totalStaff = 0; totalLaborHours = 0;
    } else if (isRangeSelected) {
      slicedRecords.forEach(r => {
        const rev = (r.predicted_revenue || 0);
        bRaw += (r.brisket_raw_lbs || 0);
        pRaw += (r.pork_shoulder_raw_lbs || 0);
        sVal += Math.round(r.sausage_lbs || 0);
        rVal += Math.round(r.pork_ribs_racks || 0);
        drVal += Math.round(r.beef_dino_ribs || 0);
        totalTacos += Math.round(r.tacos_sold || 0);
        totalRosebuds += Math.round(r.rosebuds_sold || 0);
        totalRev += Math.round(rev);
        tVal += Math.round(calcCalibratedTurkey(r).cooked);

        const isClosedDay = r.is_closed || r.day_name === 'Mon';
        const dayStaff = isClosedDay ? 0 : (r.recommended_staff || minMaxStaff(rev));
        const dayHours = isClosedDay ? 0.0 : (r.pitmaster_hours || roundStaffHours(dayStaff));
        totalStaff = Math.max(totalStaff, dayStaff);
        totalLaborHours += dayHours;
        totalCogs += (r.estimated_cogs_usd || Math.round(rev * 0.295));
      });
    } else {
      const targetRecord = slicedRecords[0] || matchedRecord;
      bRaw = targetRecord.brisket_raw_lbs || 0;
      pRaw = targetRecord.pork_shoulder_raw_lbs || 0;
      sVal = Math.round(targetRecord.sausage_lbs || 0);
      rVal = Math.round(targetRecord.pork_ribs_racks || 0);
      drVal = Math.round(targetRecord.beef_dino_ribs || 0);
      totalTacos = Math.round(targetRecord.tacos_sold || 0);
      totalRosebuds = Math.round(targetRecord.rosebuds_sold || 0);
      totalRev = Math.round(targetRecord.predicted_revenue || 0);
      tVal = Math.round(calcCalibratedTurkey(targetRecord).cooked);

      const isClosedDay = targetRecord.is_closed || targetRecord.day_name === 'Mon';
      totalStaff = isClosedDay ? 0 : (targetRecord.recommended_staff || minMaxStaff(totalRev));
      totalLaborHours = isClosedDay ? 0.0 : (targetRecord.pitmaster_hours || roundStaffHours(totalStaff));
      totalCogs = targetRecord.estimated_cogs_usd || Math.round(totalRev * 0.295);
    }

    const bCooked = Math.round(bRaw * 0.4);
    const pCooked = Math.round(pRaw * 0.44);
    const totalRaw = Math.round(bRaw + pRaw);
    const totalCooked = bCooked + pCooked;

    // Operating baseline calculation (Tue-Sun operating days only)
    const openRecords = records.filter(r => !r.is_closed && r.day_name !== 'Mon');
    const baselineRev = openRecords.length ? Math.max(1, Math.round(openRecords.reduce((acc, curr) => acc + (curr.predicted_revenue || 0), 0) / openRecords.length)) : 2700;
    const avgBrisketRaw = Math.round(openRecords.reduce((acc, curr) => acc + (curr.brisket_raw_lbs || 0), 0) / (openRecords.length || 1));
    const avgBrisketCooked = Math.round(avgBrisketRaw * 0.4);
    const avgPorkRaw = Math.round(openRecords.reduce((acc, curr) => acc + (curr.pork_shoulder_raw_lbs || 0), 0) / (openRecords.length || 1));
    const avgPorkCooked = Math.round(avgPorkRaw * 0.44);

    const weekdays = records.filter(r => ['Tue', 'Wed', 'Thu'].includes(r.day_name));
    const weekends = records.filter(r => ['Fri', 'Sat', 'Sun'].includes(r.day_name));
    const weekdayAvgRev = weekdays.length ? Math.round(weekdays.reduce((acc, curr) => acc + (curr.predicted_revenue || 0), 0) / weekdays.length) : 1600;
    const weekendAvgRev = weekends.length ? Math.round(weekends.reduce((acc, curr) => acc + (curr.predicted_revenue || 0), 0) / weekends.length) : 3300;

    const activeOpenDays = isRangeSelected ? (slicedRecords.filter(r => !r.is_closed && r.day_name !== 'Mon').length || 1) : 1;
    const baselineDenominator = isRangeSelected ? baselineRev * activeOpenDays : baselineRev;
    const incrementalRev = totalRev - baselineDenominator;
    const pctDiff = baselineDenominator > 0 ? Math.round((incrementalRev / baselineDenominator) * 100) : 0;
    const pctDisplay = isTargetClosed ? 'Closed' : (totalRev === 0 ? 'Closed' : (pctDiff > 0 ? `+${pctDiff}%` : `${pctDiff}%`));

    let insightStr = '';
    if (isTargetClosed) {
      insightStr = `Closed Today (${matchedRecord.day_name || shortDayStr}, ${slicedRecords[0]?.date || targetDateInput}): Scheduled Monday pit maintenance. Zero retail service; reopens Tuesday 11:00 AM.`;
    } else if (isRangeSelected) {
      insightStr = `Prep Horizon (${startDateVal} to ${endDateVal}, ${activeOpenDays} days): Stage ~${bRaw.toFixed(1)} lbs raw brisket (~${bCooked} lbs ck) & ~${pRaw.toFixed(1)} lbs raw pork (~${pCooked} lbs ck), plus ${totalTacos} Tacos & ${totalRosebuds} Rosebuds.`;
    } else {
      insightStr = `Single-Day Prep (${matchedRecord.day_name || shortDayStr}, ${slicedRecords[0].date}): Stage ~${bRaw.toFixed(1)} lbs raw brisket (~${bCooked} lbs ck) & ~${pRaw.toFixed(1)} lbs raw pork (~${pCooked} lbs ck), covering ${totalTacos} Tacos & ${totalRosebuds} Rosebuds.`;
    }

    if (selectedCat !== 'baseline' && catSelector && !isTargetClosed) {
      const selectedText = catSelector.options[catSelector.selectedIndex]?.text || selectedCat;
      insightStr = `Category Focus (${isRangeSelected ? startDateVal + ' to ' + endDateVal : slicedRecords[0].date}): Isolating "${selectedText}" demand to align smoker capacity.`;
    }

    const insightSpan = document.getElementById('dynamic-insight-string');
    if (insightSpan) {
      insightSpan.textContent = insightStr;
    }

    const bVal = Math.round(bRaw);
    const pVal = Math.round(pRaw);
    const rbVal = totalRosebuds;
    const tacoVal = totalTacos;

    const brisketElem = document.getElementById('kpi-brisket-lbs');
    const porkElem = document.getElementById('kpi-pork-lbs');
    const sausageElem = document.getElementById('kpi-sausage-batches');
    const ribsElem = document.getElementById('kpi-pork-ribs-racks');
    const dinoElem = document.getElementById('kpi-beef-dino-ribs');
    const turkeyElem = document.getElementById('kpi-turkey-lbs');
    const turkeySubElem = document.getElementById('kpi-turkey-sub');
    const rosebudsElem = document.getElementById('kpi-rosebuds');
    const tacosElem = document.getElementById('kpi-tacos');
    const totalCookedElem = document.getElementById('kpi-total-cooked-meat');
    const totalCookedSub = document.getElementById('kpi-total-cooked-sub');

    const sausageBatches = Math.ceil(sVal / 60.0) || 0;
    const sausageLinks = sVal * 3;

    const bCasesElem = document.getElementById('kpi-brisket-cases');
    const pCasesElem = document.getElementById('kpi-pork-cases');
    const bCookedElem = document.getElementById('kpi-brisket-cooked');
    const pCookedElem = document.getElementById('kpi-pork-cooked');
    const rCasesElem = document.getElementById('kpi-pork-ribs-cases');
    const drCasesElem = document.getElementById('kpi-beef-dino-ribs-cases');
    const sausageLinksSub = document.getElementById('kpi-sausage-links-sub');

    const laborHoursElem = document.getElementById('kpi-labor-hours');
    const staffCountElem = document.getElementById('kpi-staff-count');
    const cogsUsdElem = document.getElementById('kpi-cogs-usd');
    const aovUsdElem = document.getElementById('kpi-aov-usd');
    const aovSubElem = document.getElementById('kpi-aov-sub');
    const revenueElem = document.getElementById('kpi-projected-revenue');
    const demandLabelElem = document.getElementById('kpi-demand-label');
    const demandPctElem = document.getElementById('kpi-demand-pct');

    const allBlendedPills = [
      'kpi-revenue-blended-sub',
      'kpi-brisket-blended-sub',
      'kpi-pork-blended-sub',
      'kpi-sausage-blended-sub',
      'kpi-pork-ribs-blended-sub',
      'kpi-beef-dino-blended-sub',
      'kpi-turkey-blended-sub',
      'kpi-rosebuds-blended-sub',
      'kpi-tacos-blended-sub',
      'kpi-total-cooked-blended-sub',
      'kpi-velocity-blended-sub',
      'kpi-food-cost-blended-sub',
      'kpi-aov-blended-sub',
      'kpi-labor-blended-sub'
    ];
    function setBlendedPill(id, html) {
      const el = document.getElementById(id);
      if (!el) return;
      if (html) {
        el.innerHTML = html;
        el.style.display = 'block';
      } else {
        el.innerHTML = '';
        el.style.display = 'none';
      }
    }
    function clearAllBlendedPills() {
      allBlendedPills.forEach(id => setBlendedPill(id, ''));
    }

    const allCompareBadges = [
      'kpi-revenue-compare',
      'kpi-brisket-compare',
      'kpi-pork-compare',
      'kpi-sausage-compare',
      'kpi-pork-ribs-compare',
      'kpi-beef-dino-ribs-compare',
      'kpi-turkey-compare',
      'kpi-rosebuds-compare',
      'kpi-tacos-compare',
      'kpi-total-cooked-compare'
    ];
    function setCompareBadge(id, html) {
      const el = document.getElementById(id);
      if (!el) return;
      if (html) {
        el.innerHTML = html;
        el.style.display = 'flex';
      } else {
        el.innerHTML = '';
        el.style.display = 'none';
      }
    }
    function clearAllCompareBadges() {
      allCompareBadges.forEach(id => setCompareBadge(id, ''));
    }

    function buildCompareBadgeHTML(predLabel, predStr, actLabel, actStr, diffNum, diffUnit, diffPct, customTag, plainDesc) {
      let deltaClass = 'pill-match';
      let deltaText = 'Exact Match';
      const sign = (diffNum > 0) ? '+' : '';

      if (customTag) {
        deltaText = customTag.text;
        deltaClass = customTag.className || 'pill-pending';
      } else if (diffPct !== null && diffPct !== undefined) {
        const absPct = Math.abs(diffPct);
        if (absPct < 0.2) {
          deltaClass = 'pill-match';
          deltaText = 'Exact Target (0%)';
        } else if (diffNum > 0) {
          deltaClass = 'pill-pos';
          deltaText = `${sign}${diffNum} ${diffUnit} (${sign}${diffPct}%)`;
        } else {
          deltaClass = 'pill-neg';
          deltaText = `${diffNum} ${diffUnit} (${diffPct}%)`;
        }
      }

      const descHTML = plainDesc ? `<div class="compare-plain-desc">${plainDesc}</div>` : '';

      return `
        <div class="compare-line">
          <span class="compare-lbl">${predLabel}:</span>
          <span class="compare-num num-pred">${predStr}</span>
        </div>
        <div class="compare-line">
          <span class="compare-lbl">${actLabel}:</span>
          <span class="compare-num num-act">${actStr}</span>
        </div>
        <div class="compare-delta-line">
          <span style="color:#94a3b8; font-size:9px; text-transform:uppercase; font-weight:700;">Difference from Target:</span>
          <span class="delta-pill ${deltaClass}">${deltaText}</span>
        </div>
        ${descHTML}
      `;
    }

    // Blended Real-Time POS Turnover computation
    let blendedMetrics = null;
    const effNow = window.ShopTime ? window.ShopTime.getEffectiveNow() : new Date();
    const shopTodayStr = window.ShopTime ? window.ShopTime.shopDateStr(effNow) : '';
    const activeDateForBlended = (!isRangeSelected && targetDateInput) ? targetDateInput : shopTodayStr;

    if (window.ShopTime && !isTargetClosed && (!isRangeSelected || daysCount === 1)) {
      const actualsPayload = window.BBQ_PAYLOADS?.hourly_actuals || null;
      const predictivePayload = window.BBQ_PAYLOADS?.predictive_payload || null;

      const dayProfiles = predictivePayload?.day_profiles;
      let hourlyRecs = predictivePayload?.hourly_forecast || [];
      if (dayProfiles) {
        const dObj = parseValidDate(activeDateForBlended);
        if (dObj) {
          const longName = dObj.toLocaleDateString('en-US', { weekday: 'long' });
          const shortName = dObj.toLocaleDateString('en-US', { weekday: 'short' });
          const prof = dayProfiles[longName] || dayProfiles[shortName];
          if (prof && prof.hourly_forecast) hourlyRecs = prof.hourly_forecast;
        }
      }

      if (actualsPayload && hourlyRecs.length > 0) {
        blendedMetrics = window.ShopTime.computeBlendedDayMetrics(actualsPayload, hourlyRecs, effNow, activeDateForBlended);
      }
    }

    const hasBlended = Boolean(blendedMetrics && (blendedMetrics.isToday || blendedMetrics.isPast || (window.ShopTime && window.ShopTime.isSimulating())) && blendedMetrics.summary.actualSalesSoFar > 0);

    const rosebudsSubElem = document.getElementById('kpi-rosebuds-sub');
    const tacosSubElem = document.getElementById('kpi-tacos-sub');

    if (isTargetClosed) {
      clearAllBlendedPills();

      if (brisketElem) brisketElem.textContent = '0';
      if (porkElem) porkElem.textContent = '0';
      if (sausageElem) sausageElem.textContent = '0';
      if (sausageLinksSub) sausageLinksSub.textContent = '(Closed / 0 lbs)';
      if (ribsElem) ribsElem.textContent = '0';
      if (dinoElem) dinoElem.textContent = '0';
      if (turkeyElem) turkeyElem.textContent = '0';
      if (turkeySubElem) turkeySubElem.textContent = '(Closed / 0 lbs)';
      if (rosebudsElem) rosebudsElem.textContent = '0';
      if (rosebudsSubElem) rosebudsSubElem.textContent = '(Closed / 0 units)';
      if (tacosElem) tacosElem.textContent = '0';
      if (tacosSubElem) tacosSubElem.textContent = '(Closed / 0 tacos)';
      if (totalCookedElem) totalCookedElem.textContent = '0';
      if (totalCookedSub) totalCookedSub.textContent = '(Closed / 0 lbs)';

      if (bCasesElem) bCasesElem.textContent = '(Closed / 0 Cases)';
      if (pCasesElem) pCasesElem.textContent = '(Closed / 0 Cases)';
      if (bCookedElem) bCookedElem.textContent = '(0 lbs cooked)';
      if (pCookedElem) pCookedElem.textContent = '(0 lbs cooked)';
      if (rCasesElem) rCasesElem.textContent = '(Closed / 0 Cases)';
      if (drCasesElem) drCasesElem.textContent = '(Closed / 0 Cases)';

      if (laborHoursElem) laborHoursElem.textContent = '0';
      if (staffCountElem) staffCountElem.textContent = '(Closed / 0 Staff)';
      if (cogsUsdElem) cogsUsdElem.textContent = '($0 Est. Meat Cost)';
      if (aovUsdElem) aovUsdElem.textContent = '$0.00';
      if (aovSubElem) aovSubElem.textContent = '(Closed / 0 Orders)';
      if (revenueElem) revenueElem.textContent = '$0 (Closed)';

      setCompareBadge('kpi-revenue-compare', buildCompareBadgeHTML('Predicted', '$0', 'Measured', '$0 (Closed)', 0, '$', 0, { text: 'Closed Monday', className: 'pill-closed' }, 'Weekly pit maintenance & smoker sanitization. Zero retail service.'));
      setCompareBadge('kpi-brisket-compare', buildCompareBadgeHTML('Predicted', '0 lbs', 'Measured', '0 lbs (Closed)', 0, 'lbs', 0, { text: 'Pit Maintenance', className: 'pill-closed' }, '0 lbs raw briskets pulled • 0 lbs cooked yield slicing'));
      setCompareBadge('kpi-pork-compare', buildCompareBadgeHTML('Predicted', '0 lbs', 'Measured', '0 lbs (Closed)', 0, 'lbs', 0, { text: 'Pit Maintenance', className: 'pill-closed' }, '0 lbs bone-in pork butts • 0 lbs pulled pork prepared'));
      setCompareBadge('kpi-sausage-compare', buildCompareBadgeHTML('Predicted', '0 links', 'Measured', '0 links (Closed)', 0, 'links', 0, { text: 'Pit Maintenance', className: 'pill-closed' }, '0 mixer batches • 0 sausage links stuffed'));
      setCompareBadge('kpi-pork-ribs-compare', buildCompareBadgeHTML('Predicted', '0 racks', 'Measured', '0 racks (Closed)', 0, 'racks', 0, { text: 'Pit Maintenance', className: 'pill-closed' }, '0 spare rib racks smoked • 0 bones served'));
      setCompareBadge('kpi-beef-dino-ribs-compare', buildCompareBadgeHTML('Predicted', '0 ribs', 'Measured', '0 ribs (Closed)', 0, 'ribs', 0, { text: 'Pit Maintenance', className: 'pill-closed' }, '0 dino plate ribs • Smoker pits shut down'));
      setCompareBadge('kpi-turkey-compare', buildCompareBadgeHTML('Predicted', '0 lbs', 'Measured', '0 lbs (Closed)', 0, 'lbs', 0, { text: 'Pit Maintenance', className: 'pill-closed' }, '0 lbs cooked breast • 0 carved portions prepared'));
      setCompareBadge('kpi-rosebuds-compare', buildCompareBadgeHTML('Predicted', '0 units', 'Measured', '0 units (Closed)', 0, 'units', 0, { text: 'Pit Maintenance', className: 'pill-closed' }, '0 bacon-wrapped burnt end bites prepped'));
      setCompareBadge('kpi-tacos-compare', buildCompareBadgeHTML('Predicted', '0 tacos', 'Measured', '0 tacos (Closed)', 0, 'tacos', 0, { text: 'Pit Maintenance', className: 'pill-closed' }, '0 street tacos served • Hot-holding idle'));
      setCompareBadge('kpi-total-cooked-compare', buildCompareBadgeHTML('Predicted', '0 lbs', 'Measured', '0 lbs (Closed)', 0, 'lbs', 0, { text: 'Closed Day', className: 'pill-closed' }, 'Total Cooked Yield: 0 lbs across all proteins.'));

      const evalBannerElem = document.getElementById('kpi-model-eval-banner');
      const evalPillElem = document.getElementById('model-eval-status-pill');
      const evalBodyElem = document.getElementById('model-eval-body');
      if (evalBannerElem && evalPillElem && evalBodyElem) {
        evalBannerElem.style.display = 'block';
        evalPillElem.className = 'eval-pill eval-pill-closed';
        evalPillElem.textContent = 'Closed Day';
        evalBodyElem.innerHTML = `
          <div class="audit-plain-takeaway">
            <strong>Takeaway:</strong> Smokehouse is closed on Monday for scheduled pit maintenance (0 briskets, 0 butts, and 0 racks needed today).
          </div>
          <div class="model-eval-narrative">
            <strong>Smokehouse Closed (Pit Maintenance Window)</strong>: Scheduled non-operating Monday reserved for pit cleaning and wood restocking. Targets and labor are calibrated to zero.
          </div>
        `;
      }
    } else if (hasBlended) {
      const bSum = blendedMetrics.summary;
      const cutH = blendedMetrics.cutoffHour;
      const h12 = cutH === 0 ? 12 : (cutH > 12 ? cutH - 12 : cutH);
      const ampm = cutH >= 12 ? 'PM' : 'AM';
      const pSign = bSum.pacingPct >= 0 ? '+' : '';
      const pColor = bSum.pacingPct >= 0 ? '#34d399' : '#f87171';

      const actSalesSoFar = Math.round(bSum.actualSalesSoFar);
      const remSales = Math.round(bSum.forecastRemaining);
      const blendedTotalRev = Math.round(bSum.blendedTotalRevenue);
      const salesProgress = bSum.forecastFullDay > 0 ? (bSum.forecastToHour / bSum.forecastFullDay) : 0;
      const pacingRatio = bSum.pacingRatio || (bSum.forecastToHour > 0 ? (bSum.actualSalesSoFar / bSum.forecastToHour) : 1.0);

      // 1. Brisket
      const actCookedBrisket = bSum.actualBrisketCooked !== undefined ? bSum.actualBrisketCooked : Math.round(bCooked * salesProgress * pacingRatio * 10) / 10;
      const remCookedBrisket = bSum.remainingBrisketCooked !== undefined ? bSum.remainingBrisketCooked : Math.round(bCooked * (1 - salesProgress) * 10) / 10;
      const blendedCookedBrisket = Math.round((actCookedBrisket + remCookedBrisket) * 10) / 10;
      const blendedRawBrisket = Math.round(blendedCookedBrisket / 0.4);

      if (brisketElem) brisketElem.textContent = blendedRawBrisket;
      if (bCasesElem) bCasesElem.textContent = `(~${blendedRawBrisket} lbs raw / ~${(blendedRawBrisket / 70.0).toFixed(1)} Cases)`;
      if (bCookedElem) bCookedElem.textContent = `(~${Math.round(actCookedBrisket)} lbs actual sold • ~${Math.round(remCookedBrisket)} lbs remaining)`;
      setBlendedPill('kpi-brisket-blended-sub', `
        <strong>Today's Projected Finish</strong>: ~${Math.round(actCookedBrisket)} lbs sold so far + ~${Math.round(remCookedBrisket)} lbs needed to close (~${Math.round(blendedCookedBrisket)} lbs cooked finish)<br>
        <span style="color:#cbd5e1;">Actual to ${h12}:00 ${ampm}: ~${Math.round(actCookedBrisket)} lbs cooked (~${Math.round(actCookedBrisket / 0.4)} lbs raw)</span> • 
        <span style="color:${pColor}; font-weight:700;">${pSign}${bSum.pacingPct}% Pace</span>
      `);

      // 2. Pork Shoulder
      const actCookedPork = bSum.actualPorkCooked !== undefined ? bSum.actualPorkCooked : Math.round(pCooked * salesProgress * pacingRatio * 10) / 10;
      const remCookedPork = bSum.remainingPorkCooked !== undefined ? bSum.remainingPorkCooked : Math.round(pCooked * (1 - salesProgress) * 10) / 10;
      const blendedCookedPork = Math.round((actCookedPork + remCookedPork) * 10) / 10;
      const blendedRawPork = Math.round(blendedCookedPork / 0.44);

      if (porkElem) porkElem.textContent = blendedRawPork;
      if (pCasesElem) pCasesElem.textContent = `(~${blendedRawPork} lbs raw / ~${(blendedRawPork / 32.0).toFixed(1)} Cases)`;
      if (pCookedElem) pCookedElem.textContent = `(~${Math.round(actCookedPork)} lbs actual sold • ~${Math.round(remCookedPork)} lbs remaining)`;
      setBlendedPill('kpi-pork-blended-sub', `
        <strong>Today's Projected Finish</strong>: ~${Math.round(actCookedPork)} lbs sold so far + ~${Math.round(remCookedPork)} lbs needed to close (~${Math.round(blendedCookedPork)} lbs cooked finish)<br>
        <span style="color:#cbd5e1;">Actual to ${h12}:00 ${ampm}: ~${Math.round(actCookedPork)} lbs cooked (~${Math.round(actCookedPork / 0.44)} lbs raw)</span> • 
        <span style="color:${pColor}; font-weight:700;">${pSign}${bSum.pacingPct}% Pace</span>
      `);

      // 3. Sausage
      const actSausageLinks = Math.round(sausageLinks * salesProgress * pacingRatio);
      const remSausageLinks = Math.max(0, Math.round(sausageLinks * (1 - salesProgress)));
      const blendedSausageLinks = actSausageLinks + remSausageLinks;
      const actSausageLbs = Math.round(actSausageLinks / 3);
      const blendedSausageLbs = Math.round(blendedSausageLinks / 3);
      const blendedSausageBatches = Math.ceil(blendedSausageLbs / 60.0) || 1;

      if (sausageElem) sausageElem.textContent = blendedSausageBatches;
      if (sausageLinksSub) sausageLinksSub.textContent = `(${actSausageLinks} actual links sold • ${remSausageLinks} remaining)`;
      setBlendedPill('kpi-sausage-blended-sub', `
        <strong>Today's Projected Finish</strong>: ~${actSausageLinks} links sold so far + ~${remSausageLinks} needed to close (~${blendedSausageLinks} total links)<br>
        <span style="color:#cbd5e1;">Actual to ${h12}:00 ${ampm}: ~${actSausageLinks} links sold (~${actSausageLbs} lbs)</span> • 
        <span style="color:${pColor}; font-weight:700;">${pSign}${bSum.pacingPct}% Pace</span>
      `);

      // 4. Pork Spare Ribs
      const actRibsRacks = Math.round(rVal * salesProgress * pacingRatio);
      const remRibsRacks = Math.max(0, Math.round(rVal * (1 - salesProgress)));
      const blendedRibsRacks = actRibsRacks + remRibsRacks;

      if (ribsElem) ribsElem.textContent = blendedRibsRacks;
      if (rCasesElem) rCasesElem.textContent = `(${actRibsRacks} actual racks sold • ${remRibsRacks} remaining)`;
      setBlendedPill('kpi-pork-ribs-blended-sub', `
        <strong>Today's Projected Finish</strong>: ${actRibsRacks} racks sold so far + ${remRibsRacks} needed to close (${blendedRibsRacks} total racks)<br>
        <span style="color:#cbd5e1;">Actual to ${h12}:00 ${ampm}: ${actRibsRacks} racks sold (~${(actRibsRacks / 6.0).toFixed(1)} cs)</span> • 
        <span style="color:${pColor}; font-weight:700;">${pSign}${bSum.pacingPct}% Pace</span>
      `);

      // 5. Beef Dino Ribs
      const actDinoRibs = Math.round(drVal * salesProgress * pacingRatio);
      const remDinoRibs = Math.max(0, Math.round(drVal * (1 - salesProgress)));
      const blendedDinoRibs = actDinoRibs + remDinoRibs;

      if (dinoElem) dinoElem.textContent = blendedDinoRibs;
      if (drCasesElem) drCasesElem.textContent = `(${actDinoRibs} actual ribs sold • ${remDinoRibs} remaining)`;
      setBlendedPill('kpi-beef-dino-blended-sub', `
        <strong>Today's Projected Finish</strong>: ${actDinoRibs} ribs sold so far + ${remDinoRibs} needed to close (${blendedDinoRibs} total ribs)<br>
        <span style="color:#cbd5e1;">Actual to ${h12}:00 ${ampm}: ${actDinoRibs} ribs sold (~${(blendedDinoRibs / 12.0).toFixed(1)} Cases)</span> • 
        <span style="color:${pColor}; font-weight:700;">${pSign}${bSum.pacingPct}% Pace</span>
      `);

      // 6. Smoked Turkey
      const actTurkeyCooked = Math.round(tVal * salesProgress * pacingRatio * 10) / 10;
      const remTurkeyCooked = Math.round(tVal * (1 - salesProgress) * 10) / 10;
      const blendedTurkeyCooked = Math.round((actTurkeyCooked + remTurkeyCooked) * 10) / 10;
      const blendedTurkeyRaw = Math.round(blendedTurkeyCooked / 0.70);

      if (turkeyElem) turkeyElem.textContent = Math.round(blendedTurkeyCooked);
      if (turkeySubElem) turkeySubElem.textContent = `(~${Math.round(actTurkeyCooked)} lbs actual • ~${Math.round(remTurkeyCooked)} lbs remaining)`;
      setBlendedPill('kpi-turkey-blended-sub', `
        <strong>Today's Projected Finish</strong>: ~${Math.round(actTurkeyCooked)} lbs sold so far + ~${Math.round(remTurkeyCooked)} lbs needed to close (~${Math.round(blendedTurkeyCooked)} lbs cooked finish)<br>
        <span style="color:#cbd5e1;">Actual to ${h12}:00 ${ampm}: ~${Math.round(actTurkeyCooked)} lbs cooked (~${blendedTurkeyRaw} lbs raw)</span> • 
        <span style="color:${pColor}; font-weight:700;">${pSign}${bSum.pacingPct}% Pace</span>
      `);

      // 7. Rosebuds
      const actRosebuds = Math.round(rbVal * salesProgress * pacingRatio);
      const remRosebuds = Math.max(0, Math.round(rbVal * (1 - salesProgress)));
      const blendedRosebuds = actRosebuds + remRosebuds;

      if (rosebudsElem) rosebudsElem.textContent = blendedRosebuds;
      if (rosebudsSubElem) rosebudsSubElem.textContent = `(${actRosebuds} actual sold • ${remRosebuds} remaining)`;
      setBlendedPill('kpi-rosebuds-blended-sub', `
        <strong>Today's Projected Finish</strong>: ${actRosebuds} bites sold so far + ${remRosebuds} needed to close (${blendedRosebuds} total bites)<br>
        <span style="color:#cbd5e1;">Actual to ${h12}:00 ${ampm}: ${actRosebuds} units (~${(actRosebuds * 0.25).toFixed(1)} lbs brisket draw)</span> • 
        <span style="color:${pColor}; font-weight:700;">${pSign}${bSum.pacingPct}% Pace</span>
      `);

      // 8. Tacos
      const actTacos = Math.round(tacoVal * salesProgress * pacingRatio);
      const remTacos = Math.max(0, Math.round(tacoVal * (1 - salesProgress)));
      const blendedTacos = actTacos + remTacos;

      if (tacosElem) tacosElem.textContent = blendedTacos;
      if (tacosSubElem) tacosSubElem.textContent = `(${actTacos} actual sold • ${remTacos} remaining)`;
      setBlendedPill('kpi-tacos-blended-sub', `
        <strong>Today's Projected Finish</strong>: ${actTacos} tacos sold so far + ${remTacos} needed to close (${blendedTacos} total tacos)<br>
        <span style="color:#cbd5e1;">Actual to ${h12}:00 ${ampm}: ${actTacos} tacos (~${(actTacos * 0.15).toFixed(1)} lbs meat draw)</span> • 
        <span style="color:${pColor}; font-weight:700;">${pSign}${bSum.pacingPct}% Pace</span>
      `);

      // 9. Total Cooked Barbecue
      const actTotalCooked = Math.round(actCookedBrisket + actCookedPork);
      const remTotalCooked = Math.round(remCookedBrisket + remCookedPork);
      const blendedTotalCooked = actTotalCooked + remTotalCooked;

      if (totalCookedElem) totalCookedElem.textContent = blendedTotalCooked;
      if (totalCookedSub) totalCookedSub.textContent = `(~${actTotalCooked} lbs actual sold • ~${remTotalCooked} lbs remaining)`;
      setBlendedPill('kpi-total-cooked-blended-sub', `
        <strong>Today's Projected Finish</strong>: ~${actTotalCooked} lbs pulled so far + ~${remTotalCooked} lbs needed to close (~${blendedTotalCooked} lbs total cooked)<br>
        <span style="color:#cbd5e1;">Actual to ${h12}:00 ${ampm}: ~${actTotalCooked} lbs cooked (~${Math.round(actTotalCooked / 0.4)} lbs raw trim)</span> • 
        <span style="color:${pColor}; font-weight:700;">${pSign}${bSum.pacingPct}% Pace</span>
      `);

      // 10. Hourly Sales Pace
      const elapsedHours = Math.max(1, cutH >= 11 ? Math.min(cutH - 10, 10) : 1);
      const liveVelocity = (bSum.actualOrdersSoFar / elapsedHours).toFixed(1);
      const targetVelocity = ((bSum.forecastFullDay / 48.5) / 10).toFixed(1);
      const velElem = document.getElementById('kpi-current-velocity');
      const pacingStatusElem = document.getElementById('kpi-pacing-status');

      if (velElem) velElem.textContent = `${liveVelocity} ord/hr`;
      if (pacingStatusElem) {
        pacingStatusElem.textContent = `(${pSign}${bSum.pacingPct}% Pace)`;
        pacingStatusElem.style.color = pColor;
      }
      setBlendedPill('kpi-velocity-blended-sub', `
        <strong>Current Pace</strong>: ${liveVelocity} orders/hr actual pace<br>
        <span style="color:#cbd5e1;">Actual to ${h12}:00 ${ampm}: ${bSum.actualOrdersSoFar} orders in ${elapsedHours}h (Target: ${targetVelocity} ord/hr)</span> • 
        <span style="color:${pColor}; font-weight:700;">${pSign}${bSum.pacingPct}% Pace</span>
      `);

      // 11. Estimated Meat Cost
      const blendedCOGS = Math.round(blendedTotalRev * 0.295);
      const actCOGS = Math.round(actSalesSoFar * 0.295);
      const remCOGS = Math.round(remSales * 0.295);
      if (cogsUsdElem) cogsUsdElem.textContent = `(~$${Math.round(actCOGS).toLocaleString()} actual cost • ~$${Math.round(remCOGS).toLocaleString()} remaining)`;
      setBlendedPill('kpi-food-cost-blended-sub', `
        <strong>Today's Food Cost Finish</strong>: ~$${Math.round(actCOGS).toLocaleString()} actual + ~$${Math.round(remCOGS).toLocaleString()} remaining (~$${Math.round(blendedCOGS).toLocaleString()} total day)<br>
        <span style="color:#cbd5e1;">Actual to ${h12}:00 ${ampm}: ~$${Math.round(actCOGS).toLocaleString()} food cost on $${actSalesSoFar.toLocaleString()} sales</span> • 
        <span style="color:#10b981; font-weight:700;">29.5% Target Met</span>
      `);

      // 12. Average Ticket Revenue
      const liveAOV = bSum.actualOrdersSoFar > 0 ? (actSalesSoFar / bSum.actualOrdersSoFar).toFixed(2) : '48.50';
      if (aovUsdElem) aovUsdElem.textContent = `$${liveAOV}`;
      if (aovSubElem) aovSubElem.textContent = `($${actSalesSoFar.toLocaleString()} actual POS • ${bSum.actualOrdersSoFar} orders)`;
      setBlendedPill('kpi-aov-blended-sub', `
        <strong>Average Ticket So Far</strong>: $${liveAOV} per customer check<br>
        <span style="color:#cbd5e1;">Actual to ${h12}:00 ${ampm}: $${actSalesSoFar.toLocaleString()} POS revenue across ${bSum.actualOrdersSoFar} orders</span> • 
        <span style="color:${pColor}; font-weight:700;">Target: $48.50</span>
      `);

      // 13. Labor Hours
      const actLaborHours = Math.min(totalLaborHours, Math.round(elapsedHours * totalStaff * 10) / 10);
      const remLaborHours = Math.max(0, Math.round((totalLaborHours - actLaborHours) * 10) / 10);
      const blendedLaborHours = Math.round((actLaborHours + remLaborHours) * 10) / 10;
      if (laborHoursElem) laborHoursElem.textContent = totalLaborHours.toFixed(1);
      if (staffCountElem) staffCountElem.textContent = `(~${actLaborHours.toFixed(1)}h actual clocked • ~${remLaborHours.toFixed(1)}h remaining)`;
      setBlendedPill('kpi-labor-blended-sub', `
        <strong>Shift Labor Hours</strong>: ~${actLaborHours.toFixed(1)}h clocked so far + ~${remLaborHours.toFixed(1)}h remaining (${blendedLaborHours.toFixed(1)}h total roster)<br>
        <span style="color:#cbd5e1;">Actual to ${h12}:00 ${ampm}: ~${actLaborHours.toFixed(1)} pit hours logged across ${totalStaff} crew</span> • 
        <span style="color:#a855f7; font-weight:700;">On Schedule</span>
      `);

      // 14. Revenue Card
      if (revenueElem) revenueElem.textContent = '$' + blendedTotalRev.toLocaleString();
      setBlendedPill('kpi-revenue-blended-sub', `
        <strong>Today's Projected Finish</strong>: $${actSalesSoFar.toLocaleString()} sold so far + $${remSales.toLocaleString()} needed to close<br>
        <span style="color: #cbd5e1;">Actual to ${h12}:00 ${ampm}: $${actSalesSoFar.toLocaleString()} (${bSum.actualOrdersSoFar} orders)</span> • 
        <span style="color: ${pColor}; font-weight: 700;">${pSign}${bSum.pacingPct}% Pace</span>
      `);

      // Real-time vs Target Prediction Comparison Badges with Serving Numbers & Plain English
      const revDiff = Math.round(blendedTotalRev - bSum.forecastFullDay);
      const revPct = bSum.forecastFullDay > 0 ? Math.round((revDiff / bSum.forecastFullDay) * 1000) / 10 : 0;
      const predOrders = Math.round(bSum.forecastFullDay / 48.50);
      const estBlendedOrders = Math.round(blendedTotalRev / 48.50);
      setCompareBadge('kpi-revenue-compare', buildCompareBadgeHTML(
        'Predicted Total', '$' + Math.round(bSum.forecastFullDay).toLocaleString(),
        'Measured + Proj', '$' + actSalesSoFar.toLocaleString() + ' sold (~$' + blendedTotalRev.toLocaleString() + ')',
        revDiff, '$', revPct, null,
        `Plain English: Model targeted ~${predOrders} customer orders; currently pacing toward ~${estBlendedOrders} day-end orders ($${actSalesSoFar.toLocaleString()} registered in POS so far).`
      ));

      const bDiff = blendedRawBrisket - bVal;
      const bPct = bVal > 0 ? Math.round((bDiff / bVal) * 1000) / 10 : 0;
      const actBPortions = Math.round(actCookedBrisket * 2.3);
      const estBPortions = Math.round(blendedCookedBrisket * 2.3);
      setCompareBadge('kpi-brisket-compare', buildCompareBadgeHTML(
        'Predicted Total', '~' + bVal + ' lbs raw (~' + bCooked + ' lbs cooked)',
        'Measured Yield', '~' + Math.round(actCookedBrisket) + ' lbs cooked sold (~' + blendedRawBrisket + ' lbs raw)',
        bDiff, 'lbs', bPct, null,
        `Plain English: ~${actBPortions} portions sliced (~${Math.round(actCookedBrisket)} lbs cooked) so far; tracking toward ~${estBPortions} day-end portions (~${blendedRawBrisket} lbs raw prep).`
      ));

      const pDiff = blendedRawPork - pVal;
      const pPct = pVal > 0 ? Math.round((pDiff / pVal) * 1000) / 10 : 0;
      const actPPortions = Math.round(actCookedPork * 2.0);
      const estPPortions = Math.round(blendedCookedPork * 2.0);
      setCompareBadge('kpi-pork-compare', buildCompareBadgeHTML(
        'Predicted Total', '~' + pVal + ' lbs raw (~' + pCooked + ' lbs cooked)',
        'Measured Yield', '~' + Math.round(actCookedPork) + ' lbs cooked sold (~' + blendedRawPork + ' lbs raw)',
        pDiff, 'lbs', pPct, null,
        `Plain English: ~${actPPortions} pork sandwiches served (~${Math.round(actCookedPork)} lbs cooked) so far; tracking toward ~${estPPortions} day-end sandwiches.`
      ));

      const sDiff = blendedSausageLinks - sausageLinks;
      const sPct = sausageLinks > 0 ? Math.round((sDiff / sausageLinks) * 1000) / 10 : 0;
      setCompareBadge('kpi-sausage-compare', buildCompareBadgeHTML(
        'Predicted Total', sausageLinks + ' links (~' + sVal + ' lbs)',
        'Measured Yield', actSausageLinks + ' sold (~' + blendedSausageLinks + ' links)',
        sDiff, 'links', sPct, null,
        `Plain English: ${actSausageLinks} links sold at the counter so far; tracking toward ~${blendedSausageLinks} day-end links (${blendedSausageBatches} mixer batches).`
      ));

      const rDiff = blendedRibsRacks - rVal;
      const rPct = rVal > 0 ? Math.round((rDiff / rVal) * 1000) / 10 : 0;
      setCompareBadge('kpi-pork-ribs-compare', buildCompareBadgeHTML(
        'Predicted Total', rVal + ' racks (~' + (rVal / 6.0).toFixed(1) + ' cs)',
        'Measured Yield', actRibsRacks + ' sold (~' + blendedRibsRacks + ' racks)',
        rDiff, 'racks', rPct, null,
        `Plain English: ${actRibsRacks} racks sold (${actRibsRacks * 12} individual bones) so far; tracking toward ~${blendedRibsRacks} day-end racks (~${(blendedRibsRacks / 6.0).toFixed(1)} cases).`
      ));

      const drDiff = blendedDinoRibs - drVal;
      const drPct = drVal > 0 ? Math.round((drDiff / drVal) * 1000) / 10 : 0;
      setCompareBadge('kpi-beef-dino-ribs-compare', buildCompareBadgeHTML(
        'Predicted Total', drVal + ' ribs (~' + (drVal / 12.0).toFixed(1) + ' cs)',
        'Measured Yield', actDinoRibs + ' sold (~' + blendedDinoRibs + ' ribs)',
        drDiff, 'ribs', drPct, null,
        `Plain English: ${actDinoRibs} jumbo plate ribs sold so far; tracking toward ~${blendedDinoRibs} day-end ribs.`
      ));

      const tDiff = Math.round(blendedTurkeyCooked - tVal);
      const tPct = tVal > 0 ? Math.round((tDiff / tVal) * 1000) / 10 : 0;
      const actTPortions = Math.round(actTurkeyCooked * 3.2);
      const estTPortions = Math.round(blendedTurkeyCooked * 3.2);
      setCompareBadge('kpi-turkey-compare', buildCompareBadgeHTML(
        'Predicted Total', tVal + ' lbs ck (~' + Math.round(tVal / 0.70) + ' lbs raw)',
        'Measured Yield', '~' + Math.round(actTurkeyCooked) + ' lbs sold (~' + Math.round(blendedTurkeyCooked) + ' lbs cooked)',
        tDiff, 'lbs', tPct, null,
        `Plain English: ~${actTPortions} carved plates sold so far; tracking toward ~${estTPortions} day-end portions (~${blendedTurkeyRaw} lbs raw prep).`
      ));

      const rbDiff = blendedRosebuds - rbVal;
      const rbPct = rbVal > 0 ? Math.round((rbDiff / rbVal) * 1000) / 10 : 0;
      setCompareBadge('kpi-rosebuds-compare', buildCompareBadgeHTML(
        'Predicted Total', rbVal + ' units',
        'Measured Yield', actRosebuds + ' sold (~' + blendedRosebuds + ' units)',
        rbDiff, 'units', rbPct, null,
        `Plain English: ${actRosebuds} bites sold (~${Math.round(actRosebuds / 4)} orders of 4) so far; tracking toward ~${blendedRosebuds} day-end bites from brisket burnt ends.`
      ));

      const tacoDiff = blendedTacos - tacoVal;
      const tacoPct = tacoVal > 0 ? Math.round((tacoDiff / tacoVal) * 1000) / 10 : 0;
      setCompareBadge('kpi-tacos-compare', buildCompareBadgeHTML(
        'Predicted Total', tacoVal + ' tacos',
        'Measured Yield', actTacos + ' sold (~' + blendedTacos + ' tacos)',
        tacoDiff, 'tacos', tacoPct, null,
        `Plain English: ${actTacos} tacos served so far; tracking toward ~${blendedTacos} day-end orders across shift.`
      ));

      const tcDiff = blendedTotalCooked - totalCooked;
      const tcPct = totalCooked > 0 ? Math.round((tcDiff / totalCooked) * 1000) / 10 : 0;
      setCompareBadge('kpi-total-cooked-compare', buildCompareBadgeHTML(
        'Predicted Total', '~' + totalCooked + ' lbs ck (~' + totalRaw + ' lbs raw)',
        'Measured Yield', '~' + actTotalCooked + ' lbs sold (~' + blendedTotalCooked + ' lbs cooked)',
        tcDiff, 'lbs', tcPct, null,
        `Plain English: ~${actTotalCooked} lbs cooked barbecue drawn so far; tracking toward ~${blendedTotalCooked} lbs total hot-holding yield.`
      ));

      const evalBannerElem = document.getElementById('kpi-model-eval-banner');
      const evalPillElem = document.getElementById('model-eval-status-pill');
      const evalBodyElem = document.getElementById('model-eval-body');
      if (evalBannerElem && evalPillElem && evalBodyElem) {
        evalBannerElem.style.display = 'block';
        let statusClass = 'eval-pill-accurate';
        let statusTitle = 'Live Pacing on Track';
        let narrative = `Live pace is <strong>${pSign}${bSum.pacingPct}%</strong> vs forecast ($${actSalesSoFar.toLocaleString()} across ${bSum.actualOrdersSoFar} orders by ${h12}:00 ${ampm}). Projected day finish: <strong>$${blendedTotalRev.toLocaleString()}</strong> (~$${Math.round(blendedCOGS)} Est. Meat Cost).`;

        if (bSum.pacingPct > 15) {
          statusClass = 'eval-pill-drift';
          statusTitle = 'High-Demand Surge (+Pacing)';
          narrative = `Surge active: pit turnover is <strong>+${bSum.pacingPct}% above</strong> baseline. Monitor brisket reserves to prevent sell-out before 9:00 PM close.`;
        } else if (bSum.pacingPct < -15) {
          statusClass = 'eval-pill-drift';
          statusTitle = 'Midweek Pacing Lull';
          narrative = `Traffic is <strong>${bSum.pacingPct}% below</strong> baseline. Slow hot-holding pulls to protect cooked yield and minimize waste.`;
        }

        evalPillElem.className = `eval-pill ${statusClass}`;
        evalPillElem.textContent = statusTitle;
        const liveBrisketPackersDiff = Math.round(bDiff / 14.0);
        const liveTakeawayText = Math.abs(bDiff) < 7
          ? `We are pacing right on our Pitmaster Daily Forecast target (~${Math.ceil(blendedRawBrisket / 14.0)} briskets / ~${blendedRawBrisket} lbs raw).`
          : (bDiff > 0
            ? `Customer demand is running ahead of target by ~${Math.max(1, Math.abs(liveBrisketPackersDiff))} brisket${Math.abs(liveBrisketPackersDiff) === 1 ? '' : 's'} (+${Math.abs(bDiff)} lbs over target).`
            : `We have ~${Math.max(1, Math.abs(liveBrisketPackersDiff))} extra brisket${Math.abs(liveBrisketPackersDiff) === 1 ? '' : 's'} in hot-holding cushion (${Math.abs(bDiff)} lbs difference from target).`);
        evalBodyElem.innerHTML = `
          <div class="audit-plain-takeaway">
            <strong>Takeaway:</strong> ${liveTakeawayText}
          </div>
          <div class="model-eval-grid">
            <div class="model-eval-stat-box">
              <span class="model-eval-stat-label">Actual POS to Date</span>
              <span class="model-eval-stat-val" style="color:#f1c40f;">$${actSalesSoFar.toLocaleString()}</span>
            </div>
            <div class="model-eval-stat-box">
              <span class="model-eval-stat-label">Projected Day Total</span>
              <span class="model-eval-stat-val" style="color:#38bdf8;">$${blendedTotalRev.toLocaleString()}</span>
            </div>
            <div class="model-eval-stat-box">
              <span class="model-eval-stat-label">Pace vs. Target</span>
              <span class="model-eval-stat-val" style="color:${pColor};">${pSign}${bSum.pacingPct}%</span>
            </div>
            <div class="model-eval-stat-box">
              <span class="model-eval-stat-label">Est. Meat Cost</span>
              <span class="model-eval-stat-val" style="color:#f59e0b;">~$${Math.round(actCOGS)} act / ~$${Math.round(blendedCOGS)} total</span>
            </div>
          </div>
          <div class="model-eval-narrative">
            ${narrative}
          </div>
        `;
      }
    } else {
      clearAllBlendedPills();

      if (brisketElem) brisketElem.textContent = bVal;
      if (porkElem) porkElem.textContent = pVal;
      if (sausageElem) sausageElem.textContent = sausageBatches;
      if (sausageLinksSub) sausageLinksSub.textContent = `(${sausageLinks} links / ${sVal} lbs)`;
      if (ribsElem) ribsElem.textContent = rVal;
      if (dinoElem) dinoElem.textContent = drVal;
      if (turkeyElem) turkeyElem.textContent = tVal;
      const tRaw = Math.round(tVal / 0.70);
      const tCases = (tRaw / 20.0).toFixed(1);
      const tPortions = Math.round(tVal * 3.2);
      if (turkeySubElem) turkeySubElem.textContent = `(~${tRaw} lbs raw / ~${tCases} cs / ~${tPortions} port)`;
      if (rosebudsElem) rosebudsElem.textContent = rbVal;
      if (rosebudsSubElem) rosebudsSubElem.textContent = '(Draws from Brisket)';
      if (tacosElem) tacosElem.textContent = tacoVal;
      if (tacosSubElem) tacosSubElem.textContent = '(Draws from Smoked Inventory)';
      if (totalCookedElem) totalCookedElem.textContent = totalCooked;
      if (totalCookedSub) totalCookedSub.textContent = `(~${totalRaw} lbs raw trim)`;

      if (bCasesElem) bCasesElem.textContent = `(~${(bVal / 70.0).toFixed(1)} Cases / ~${Math.ceil(bVal / 14.0)} Packers)`;
      if (pCasesElem) pCasesElem.textContent = `(~${(pVal / 32.0).toFixed(1)} Cases / ~${Math.ceil(pVal / 8.0)} Butts)`;
      if (bCookedElem) bCookedElem.textContent = `(~ ${Math.round(bVal * 0.4)} lbs cooked)`;
      if (pCookedElem) pCookedElem.textContent = `(~ ${Math.round(pVal * 0.44)} lbs cooked)`;
      if (rCasesElem) rCasesElem.textContent = `(~${(rVal / 6.0).toFixed(1)} Cases / ~${Math.ceil(rVal / 2.0)} Bags)`;
      if (drCasesElem) drCasesElem.textContent = `(~${(drVal / 12.0).toFixed(1)} Cases)`;

      if (laborHoursElem) laborHoursElem.textContent = totalLaborHours.toFixed(1);
      if (staffCountElem) staffCountElem.textContent = `(~${totalStaff} Staff / 8.5h Shift)`;
      if (cogsUsdElem) cogsUsdElem.textContent = `(~$${Math.round(totalCogs).toLocaleString()} Est. Meat Cost)`;
      if (aovUsdElem) aovUsdElem.textContent = '$48.50';
      if (aovSubElem) aovSubElem.textContent = '(Average Order Value)';

      if (revenueElem) revenueElem.textContent = '$' + Math.round(totalRev).toLocaleString();

      const hasMeasuredActuals = isRangeSelected
        ? slicedRecords.some(r => r && (r.is_historical || (r.actual_revenue !== undefined && r.actual_revenue > 0)))
        : Boolean(matchedRecord && (matchedRecord.is_historical || (matchedRecord.actual_revenue !== undefined && matchedRecord.actual_revenue > 0)));

      if (hasMeasuredActuals) {
        let sumPredRev = 0, sumPredBRaw = 0, sumPredPRaw = 0, sumPredSLbs = 0, sumPredRRacks = 0, sumPredDRibs = 0, sumPredTCooked = 0, sumPredTacos = 0, sumPredRosebuds = 0;
        let sumActRev = 0, sumActBRaw = 0, sumActPRaw = 0, sumActSLbs = 0, sumActRRacks = 0, sumActDRibs = 0, sumActTCooked = 0, sumActTacos = 0, sumActRosebuds = 0;

        const recordsToSum = isRangeSelected ? slicedRecords : [matchedRecord || slicedRecords[0]];
        recordsToSum.forEach(r => {
          if (!r) return;
          sumPredRev += (r.predicted_revenue !== undefined ? r.predicted_revenue : (r.actual_revenue || 0));
          sumPredBRaw += (r.predicted_brisket_raw_lbs !== undefined ? r.predicted_brisket_raw_lbs : (r.brisket_raw_lbs || 0));
          sumPredPRaw += (r.predicted_pork_raw_lbs !== undefined ? r.predicted_pork_raw_lbs : (r.pork_shoulder_raw_lbs || 0));
          sumPredSLbs += (r.predicted_sausage_lbs !== undefined ? r.predicted_sausage_lbs : (r.sausage_lbs || 0));
          sumPredRRacks += (r.predicted_pork_ribs_racks !== undefined ? r.predicted_pork_ribs_racks : (r.pork_ribs_racks || 0));
          sumPredDRibs += (r.predicted_beef_dino_ribs !== undefined ? r.predicted_beef_dino_ribs : (r.beef_dino_ribs || 0));
          sumPredTCooked += (r.predicted_turkey_cooked_lbs !== undefined ? r.predicted_turkey_cooked_lbs : (calcCalibratedTurkey(r).cooked));
          sumPredTacos += (r.predicted_tacos_sold !== undefined ? r.predicted_tacos_sold : (r.tacos_sold || 0));
          sumPredRosebuds += (r.predicted_rosebuds_sold !== undefined ? r.predicted_rosebuds_sold : (r.rosebuds_sold || 0));

          sumActRev += (r.actual_revenue !== undefined ? r.actual_revenue : (r.predicted_revenue || 0));
          sumActBRaw += (r.actual_brisket_raw_lbs !== undefined ? r.actual_brisket_raw_lbs : (r.brisket_raw_lbs || 0));
          sumActPRaw += (r.actual_pork_shoulder_raw_lbs !== undefined ? r.actual_pork_shoulder_raw_lbs : (r.pork_shoulder_raw_lbs || 0));
          sumActSLbs += (r.actual_sausage_lbs !== undefined ? r.actual_sausage_lbs : (r.sausage_lbs || 0));
          sumActRRacks += (r.actual_pork_ribs_racks !== undefined ? r.actual_pork_ribs_racks : (r.pork_ribs_racks || 0));
          sumActDRibs += (r.actual_beef_dino_ribs !== undefined ? r.actual_beef_dino_ribs : (r.beef_dino_ribs || 0));
          sumActTCooked += (r.actual_turkey_cooked_lbs !== undefined ? r.actual_turkey_cooked_lbs : calcCalibratedTurkey(r).cooked);
          sumActTacos += (r.actual_tacos_sold !== undefined ? r.actual_tacos_sold : (r.tacos_sold || 0));
          sumActRosebuds += (r.actual_rosebuds_sold !== undefined ? r.actual_rosebuds_sold : (r.rosebuds_sold || 0));
        });

        const pRevRound = Math.round(sumPredRev);
        const aRevRound = Math.round(sumActRev);
        const revDiff = aRevRound - pRevRound;
        const revPct = pRevRound > 0 ? Math.round((revDiff / pRevRound) * 1000) / 10 : 0;
        const pOrders = Math.round(pRevRound / 48.50);
        const aOrders = Math.round(aRevRound / 48.50);
        const aFoodCost = Math.round(aRevRound * 0.295);
        const pFoodCost = Math.round(pRevRound * 0.295);

        setCompareBadge('kpi-revenue-compare', buildCompareBadgeHTML(
          'Predicted Total', '$' + pRevRound.toLocaleString(),
          'Actual POS Total', '$' + aRevRound.toLocaleString(),
          revDiff, '$', revPct, null,
          `Plain English: Model predicted ${pOrders} customer orders ($${pRevRound.toLocaleString()}) vs ${aOrders} actual register orders ($${aRevRound.toLocaleString()}).`
        ));

        const pBRawRound = Math.round(sumPredBRaw);
        const aBRawRound = Math.round(sumActBRaw);
        const pBCooked = Math.round(pBRawRound * 0.4);
        const aBCooked = Math.round(aBRawRound * 0.4);
        const bDiff = aBRawRound - pBRawRound;
        const bPct = pBRawRound > 0 ? Math.round((bDiff / pBRawRound) * 1000) / 10 : 0;
        const pBPortions = Math.round(pBCooked * 2.3);
        const aBPortions = Math.round(aBCooked * 2.3);
        setCompareBadge('kpi-brisket-compare', buildCompareBadgeHTML(
          'Predicted Target', '~' + pBRawRound + ' lbs raw (~' + pBCooked + ' lbs cooked)',
          'Actual Measured', '~' + aBRawRound + ' lbs raw (~' + aBCooked + ' lbs cooked)',
          bDiff, 'lbs', bPct, null,
          `Plain English: Model targeted ~${pBPortions} sliced servings (~${pBRawRound} lbs raw) vs ~${aBPortions} actual portions served (~${aBCooked} lbs cooked).`
        ));

        const pPRawRound = Math.round(sumPredPRaw);
        const aPRawRound = Math.round(sumActPRaw);
        const pPCooked = Math.round(pPRawRound * 0.44);
        const aPCooked = Math.round(aPRawRound * 0.44);
        const pDiff = aPRawRound - pPRawRound;
        const pPct = pPRawRound > 0 ? Math.round((pDiff / pPRawRound) * 1000) / 10 : 0;
        const pPPortions = Math.round(pPCooked * 2.0);
        const aPPortions = Math.round(aPCooked * 2.0);
        setCompareBadge('kpi-pork-compare', buildCompareBadgeHTML(
          'Predicted Target', '~' + pPRawRound + ' lbs raw (~' + pPCooked + ' lbs cooked)',
          'Actual Measured', '~' + aPRawRound + ' lbs raw (~' + aPCooked + ' lbs cooked)',
          pDiff, 'lbs', pPct, null,
          `Plain English: Model targeted ~${pPPortions} pork sandwiches (~${pPRawRound} lbs raw) vs ~${aPPortions} actual sandwiches served (~${aPCooked} lbs cooked).`
        ));

        const pSLinks = Math.round(sumPredSLbs * 3);
        const aSLinks = Math.round(sumActSLbs * 3);
        const sDiff = aSLinks - pSLinks;
        const sPct = pSLinks > 0 ? Math.round((sDiff / pSLinks) * 1000) / 10 : 0;
        setCompareBadge('kpi-sausage-compare', buildCompareBadgeHTML(
          'Predicted Target', pSLinks + ' links (~' + Math.round(sumPredSLbs) + ' lbs)',
          'Actual Measured', aSLinks + ' links (~' + Math.round(sumActSLbs) + ' lbs)',
          sDiff, 'links', sPct, null,
          `Plain English: Target ${pSLinks} links (${Math.ceil(pSLinks / 180)} batches) vs ${aSLinks} actual links sold at counter.`
        ));

        const pRRacks = Math.round(sumPredRRacks);
        const aRRacks = Math.round(sumActRRacks);
        const rDiff = aRRacks - pRRacks;
        const rPct = pRRacks > 0 ? Math.round((rDiff / pRRacks) * 1000) / 10 : 0;
        setCompareBadge('kpi-pork-ribs-compare', buildCompareBadgeHTML(
          'Predicted Target', pRRacks + ' racks (~' + (pRRacks / 6.0).toFixed(1) + ' cs)',
          'Actual Measured', aRRacks + ' racks (~' + (aRRacks / 6.0).toFixed(1) + ' cs)',
          rDiff, 'racks', rPct, null,
          `Plain English: Target ${pRRacks} racks (~${pRRacks * 12} bones) vs ${aRRacks} actual racks served (~${aRRacks * 12} bones).`
        ));

        const pDRibs = Math.round(sumPredDRibs);
        const aDRibs = Math.round(sumActDRibs);
        const drDiff = aDRibs - pDRibs;
        const drPct = pDRibs > 0 ? Math.round((drDiff / pDRibs) * 1000) / 10 : 0;
        setCompareBadge('kpi-beef-dino-ribs-compare', buildCompareBadgeHTML(
          'Predicted Target', pDRibs + ' ribs (~' + (pDRibs / 12.0).toFixed(1) + ' cs)',
          'Actual Measured', aDRibs + ' ribs (~' + (aDRibs / 12.0).toFixed(1) + ' cs)',
          drDiff, 'ribs', drPct, null,
          `Plain English: Target ${pDRibs} dino plate ribs vs ${aDRibs} actual dino ribs sold.`
        ));

        const pTCooked = Math.round(sumPredTCooked);
        const aTCooked = Math.round(sumActTCooked);
        const tDiff = aTCooked - pTCooked;
        const tPct = pTCooked > 0 ? Math.round((tDiff / pTCooked) * 1000) / 10 : 0;
        const pTPortions = Math.round(pTCooked * 3.2);
        const aTPortions = Math.round(aTCooked * 3.2);
        setCompareBadge('kpi-turkey-compare', buildCompareBadgeHTML(
          'Predicted Target', pTCooked + ' lbs ck (~' + Math.round(pTCooked / 0.70) + ' lbs raw)',
          'Actual Measured', aTCooked + ' lbs ck (~' + Math.round(aTCooked / 0.70) + ' lbs raw)',
          tDiff, 'lbs', tPct, null,
          `Plain English: Target ~${pTPortions} carved plates (~${pTCooked} lbs cooked) vs ~${aTPortions} actual plates served (~${aTCooked} lbs cooked).`
        ));

        const pTacos = Math.round(sumPredTacos);
        const aTacos = Math.round(sumActTacos);
        const tacoDiff = aTacos - pTacos;
        const tacoPct = pTacos > 0 ? Math.round((tacoDiff / pTacos) * 1000) / 10 : 0;
        setCompareBadge('kpi-tacos-compare', buildCompareBadgeHTML(
          'Predicted Target', pTacos + ' tacos',
          'Actual Measured', aTacos + ' tacos',
          tacoDiff, 'tacos', tacoPct, null,
          `Plain English: Target ${pTacos} tacos vs ${aTacos} actual tacos sold across daily service.`
        ));

        const pRosebuds = Math.round(sumPredRosebuds);
        const aRosebuds = Math.round(sumActRosebuds);
        const rbDiff = aRosebuds - pRosebuds;
        const rbPct = pRosebuds > 0 ? Math.round((rbDiff / pRosebuds) * 1000) / 10 : 0;
        setCompareBadge('kpi-rosebuds-compare', buildCompareBadgeHTML(
          'Predicted Target', pRosebuds + ' units',
          'Actual Measured', aRosebuds + ' units',
          rbDiff, 'units', rbPct, null,
          `Plain English: Target ${pRosebuds} bites (~${Math.round(pRosebuds / 4)} orders of 4) vs ${aRosebuds} actual bites sold.`
        ));

        const pTotCooked = pBCooked + pPCooked;
        const aTotCooked = aBCooked + aPCooked;
        const tcDiff = aTotCooked - pTotCooked;
        const tcPct = pTotCooked > 0 ? Math.round((tcDiff / pTotCooked) * 1000) / 10 : 0;
        setCompareBadge('kpi-total-cooked-compare', buildCompareBadgeHTML(
          'Predicted Target', '~' + pTotCooked + ' lbs ck (~' + (pBRawRound + pPRawRound) + ' lbs raw)',
          'Actual Measured', '~' + aTotCooked + ' lbs ck (~' + (aBRawRound + aPRawRound) + ' lbs raw)',
          tcDiff, 'lbs', tcPct, null,
          `Plain English: Target ~${pTotCooked} lbs cooked meat yield vs ~${aTotCooked} lbs actual cooked barbecue sliced.`
        ));

        const evalBannerElem = document.getElementById('kpi-model-eval-banner');
        const evalPillElem = document.getElementById('model-eval-status-pill');
        const evalBodyElem = document.getElementById('model-eval-body');
        if (evalBannerElem && evalPillElem && evalBodyElem) {
          evalBannerElem.style.display = 'block';
          const absRevPct = Math.abs(revPct);
          let statusClass = 'eval-pill-accurate';
          let statusText = 'Model Highly Accurate';
          let narrativeVerdict = '';

          if (absRevPct <= 5.0) {
            statusClass = 'eval-pill-accurate';
            statusText = `Cook Target Accurate (${revPct >= 0 ? '+' : ''}${revPct}%)`;
            narrativeVerdict = `Pitmaster Daily Forecast tracked within <strong>${absRevPct}% difference from target</strong> ($${aRevRound.toLocaleString()} actual vs $${pRevRound.toLocaleString()} predicted), covering service with minimal waste.`;
          } else if (revDiff > 0) {
            statusClass = 'eval-pill-drift';
            statusText = `Under-Projected (+${revPct}%)`;
            narrativeVerdict = `Actual sales exceeded forecast by <strong>+${revPct}% (+$${revDiff.toLocaleString()})</strong>; est. meat cost held at ~$${aFoodCost.toLocaleString()} on $${aRevRound.toLocaleString()} sales.`;
          } else {
            statusClass = 'eval-pill-drift';
            statusText = `Over-Projected (${revPct}%)`;
            narrativeVerdict = `Targets ran <strong>${absRevPct}% above</strong> actual POS sales (-$${Math.abs(revDiff).toLocaleString()}); actual meat cost finished at $${aFoodCost.toLocaleString()} vs $${pFoodCost.toLocaleString()} target.`;
          }

          const histBrisketDiffLbs = pBRawRound - aBRawRound;
          const histBrisketCount = Math.max(1, Math.round(Math.abs(histBrisketDiffLbs) / 14.0));
          let histTakeaway = '';
          if (Math.abs(histBrisketDiffLbs) <= 6) {
            histTakeaway = `We cooked right on our Pitmaster Daily Forecast target today (${aBRawRound} lbs raw brisket / ~${Math.ceil(aBRawRound / 14.0)} briskets vs ${pBRawRound} lbs target).`;
          } else if (histBrisketDiffLbs > 0) {
            histTakeaway = `We cooked ${histBrisketCount} extra brisket${histBrisketCount === 1 ? '' : 's'} than needed today (+${histBrisketDiffLbs} lbs over target).`;
          } else {
            histTakeaway = `Customer demand drew ${histBrisketCount} more brisket${histBrisketCount === 1 ? '' : 's'} than baseline target today (+${Math.abs(histBrisketDiffLbs)} lbs above target).`;
          }

          evalPillElem.className = `eval-pill ${statusClass}`;
          evalPillElem.textContent = statusText;
          evalBodyElem.innerHTML = `
            <div class="audit-plain-takeaway">
              <strong>Takeaway:</strong> ${histTakeaway}
            </div>
            <div class="model-eval-grid">
              <div class="model-eval-stat-box">
                <span class="model-eval-stat-label">Daily Cook Target Revenue</span>
                <span class="model-eval-stat-val" style="color:#38bdf8;">$${pRevRound.toLocaleString()}</span>
              </div>
              <div class="model-eval-stat-box">
                <span class="model-eval-stat-label">Actual Measured POS</span>
                <span class="model-eval-stat-val" style="color:#f1c40f;">$${aRevRound.toLocaleString()}</span>
              </div>
              <div class="model-eval-stat-box">
                <span class="model-eval-stat-label">Difference from Target</span>
                <span class="model-eval-stat-val" style="color:${revDiff >= 0 ? '#34d399' : '#f87171'};">${revDiff >= 0 ? '+' : ''}${revDiff.toLocaleString()} (${revPct >= 0 ? '+' : ''}${revPct}%)</span>
              </div>
              <div class="model-eval-stat-box">
                <span class="model-eval-stat-label">Actual Est. Meat Cost</span>
                <span class="model-eval-stat-val" style="color:#f59e0b;">$${aFoodCost.toLocaleString()} (29.5%)</span>
              </div>
            </div>
            <div class="model-eval-narrative">
              ${narrativeVerdict}
            </div>
          `;
        }
      } else {
        setCompareBadge('kpi-revenue-compare', buildCompareBadgeHTML('Predicted Total', '$' + Math.round(totalRev).toLocaleString(), 'Actual Total', 'Pending Service', null, null, null, { text: 'Scheduled', className: 'pill-pending' }, `Target $${Math.round(totalRev).toLocaleString()} sales across service (~${Math.round(totalRev / 48.50)} orders at $48.50 avg check).`));
        setCompareBadge('kpi-brisket-compare', buildCompareBadgeHTML('Predicted Target', '~' + bVal + ' lbs raw (~' + bCooked + ' lbs cooked)', 'Actual Measured', 'Pending Service', null, null, null, { text: 'Scheduled', className: 'pill-pending' }, `Pull ~${Math.ceil(bVal / 14.0)} raw packers (~${bVal} lbs) to yield ~${bCooked} lbs sliced brisket (~${Math.round(bCooked * 2.3)} 7-oz servings).`));
        setCompareBadge('kpi-pork-compare', buildCompareBadgeHTML('Predicted Target', '~' + pVal + ' lbs raw (~' + pCooked + ' lbs cooked)', 'Actual Measured', 'Pending Service', null, null, null, { text: 'Scheduled', className: 'pill-pending' }, `Pull ~${Math.ceil(pVal / 8.0)} bone-in butts (~${pVal} lbs raw) to produce ~${pCooked} lbs pulled pork (~${Math.round(pCooked * 2.0)} 8-oz sandwiches).`));
        setCompareBadge('kpi-sausage-compare', buildCompareBadgeHTML('Predicted Target', sausageLinks + ' links (~' + sVal + ' lbs)', 'Actual Measured', 'Pending Service', null, null, null, { text: 'Scheduled', className: 'pill-pending' }, `Mix & stuff ${sausageBatches} batches (~${sausageLinks} links, 1/3-lb each).`));
        setCompareBadge('kpi-pork-ribs-compare', buildCompareBadgeHTML('Predicted Target', rVal + ' racks (~' + (rVal / 6.0).toFixed(1) + ' cs)', 'Actual Measured', 'Pending Service', null, null, null, { text: 'Scheduled', className: 'pill-pending' }, `Smoke ${rVal} whole spare rib racks (~${rVal * 12} individual bones from ~${(rVal / 6.0).toFixed(1)} cases).`));
        setCompareBadge('kpi-beef-dino-ribs-compare', buildCompareBadgeHTML('Predicted Target', drVal + ' ribs (~' + (drVal / 12.0).toFixed(1) + ' cs)', 'Actual Measured', 'Pending Service', null, null, null, { text: 'Scheduled', className: 'pill-pending' }, `Smoke ${drVal} plate short ribs (~${(drVal / 12.0).toFixed(1)} cases). Pull in small batches to preserve bark.`));
        setCompareBadge('kpi-turkey-compare', buildCompareBadgeHTML('Predicted Target', tVal + ' lbs ck (~' + Math.round(tVal / 0.70) + ' lbs raw)', 'Actual Measured', 'Pending Service', null, null, null, { text: 'Scheduled', className: 'pill-pending' }, `Smoke ~${tVal} lbs cooked breast (~${Math.round(tVal / 0.70)} lbs raw prep) yielding ~${Math.round(tVal * 3.2)} 5-oz sliced plates.`));
        setCompareBadge('kpi-rosebuds-compare', buildCompareBadgeHTML('Predicted Target', rbVal + ' units', 'Actual Measured', 'Pending Service', null, null, null, { text: 'Scheduled', className: 'pill-pending' }, `Prep ${rbVal} bacon-wrapped brisket bites (~${Math.round(rbVal / 4)} orders of 4). Trims drawn from brisket burnt ends.`));
        setCompareBadge('kpi-tacos-compare', buildCompareBadgeHTML('Predicted Target', tacoVal + ' tacos', 'Actual Measured', 'Pending Service', null, null, null, { text: 'Scheduled', className: 'pill-pending' }, `Target ${tacoVal} tacos across daily service. Portions pulled from hot-holding brisket and pork bins.`));
        setCompareBadge('kpi-total-cooked-compare', buildCompareBadgeHTML('Predicted Target', '~' + totalCooked + ' lbs ck (~' + totalRaw + ' lbs raw)', 'Actual Measured', 'Pending Service', null, null, null, { text: 'Scheduled', className: 'pill-pending' }, `Total kitchen yield: ~${totalCooked} lbs hot-holding barbecue ready to carve from ~${totalRaw} lbs raw butcher trim.`));

        const evalBannerElem = document.getElementById('kpi-model-eval-banner');
        const evalPillElem = document.getElementById('model-eval-status-pill');
        const evalBodyElem = document.getElementById('model-eval-body');
        if (evalBannerElem && evalPillElem && evalBodyElem) {
          evalBannerElem.style.display = 'block';
          evalPillElem.className = 'eval-pill eval-pill-match';
          evalPillElem.textContent = 'Upcoming Horizon';
          const upPackers = Math.max(1, Math.ceil(bVal / 14.0));
          const upCases = (bVal / 70.0).toFixed(1);
          const upButts = Math.max(1, Math.ceil(pVal / 8.0));
          evalBodyElem.innerHTML = `
            <div class="audit-plain-takeaway">
              <strong>Takeaway:</strong> Stage ${upCases} Cases (~${upPackers} Briskets), ~${upButts} Pork Butts, and ${rVal} Racks of Spare Ribs — includes a +10% Extra Prep / Cushion.
            </div>
            <div class="model-eval-narrative">
              <strong>Future Operational Horizon</strong>: Pitmaster Daily Forecast targets include a 10% Extra Prep / Cushion; live POS Cook Accuracy Audits populate automatically during service.
            </div>
          `;
        }
      }
    }

    // Update dynamic baseline trend card
    const baselineTrendElem = document.getElementById('dynamic-baseline-trend');
    if (baselineTrendElem) {
      let comparisonNote = '';
      const revLabel = matchedRecord.is_historical ? 'actual' : 'projected';
      const safeDay = escapeHTML(matchedRecord.day_name || shortDayStr);
      const safeDate = escapeHTML(matchedRecord.date || targetDateInput);
      const safeHorizon = isRangeSelected ? `${escapeHTML(startDateVal)} to ${escapeHTML(endDateVal)}` : `${safeDay}, ${safeDate}`;
      if (isTargetClosed) {
        comparisonNote = `<strong>${safeDay}, ${safeDate}</strong>: Smokehouse <strong>Closed</strong> (0 target).`;
      } else if (pctDiff > 0) {
        comparisonNote = `<strong>${safeHorizon}</strong>: ${revLabel} <strong>$${totalRev.toLocaleString()}</strong> (<strong>+${pctDiff}%</strong> vs baseline).`;
      } else if (pctDiff < 0) {
        comparisonNote = `<strong>${safeHorizon}</strong>: ${revLabel} <strong>$${totalRev.toLocaleString()}</strong> (<strong>-${Math.abs(pctDiff)}%</strong> vs baseline).`;
      } else {
        comparisonNote = `<strong>${safeHorizon}</strong>: ${revLabel} <strong>$${totalRev.toLocaleString()}</strong> (on baseline).`;
      }

      baselineTrendElem.innerHTML = `Tue–Sun avg: <strong>$${baselineRev.toLocaleString()}/day</strong> (~$${weekdayAvgRev.toLocaleString()} Tue–Thu; ~$${weekendAvgRev.toLocaleString()} Fri–Sun; Mon Closed). ${comparisonNote}`;
    }

    if (demandPctElem) {
      demandPctElem.textContent = isTargetClosed ? '(Closed Today)' : `(${pctDisplay} vs Typical Day)`;
    }
    if (demandLabelElem) {
      if (isTargetClosed) {
        demandLabelElem.textContent = `Smokehouse & Restaurant Closed Today (${matchedRecord.day_name || shortDayStr} Pit Maintenance & Prep). Zero service demand.`;
      } else {
        const surgeLabel = matchedRecord.is_historical ? 'Actual Sales' : (hasBlended ? "Today's Sales Pace" : 'Projected Sales');
        if (pctDiff > 0) {
          demandLabelElem.textContent = `${surgeLabel} Surge of +${pctDiff}% (+$${Math.round(incrementalRev).toLocaleString()}) above the $${baselineRev.toLocaleString()}/day operating baseline pace.`;
        } else if (pctDiff < 0) {
          demandLabelElem.textContent = `${surgeLabel} Drop of -${Math.abs(pctDiff)}% (-$${Math.abs(Math.round(incrementalRev)).toLocaleString()}) below the $${baselineRev.toLocaleString()}/day operating baseline pace.`;
        } else {
          demandLabelElem.textContent = `${surgeLabel} right on pace with the $${baselineRev.toLocaleString()}/day operating baseline.`;
        }
      }
    }

    if (typeof renderDailyExecutiveBrief === 'function') {
      renderDailyExecutiveBrief(slicedRecords, matchedRecord);
    }
    if (typeof renderKPIBulletAndSparklines === 'function') {
      renderKPIBulletAndSparklines(slicedRecords, matchedRecord);
    }

    // Hydrate KitchenQuantityDisplay badges across meat KPI cards (Case & Cut View vs Raw Lbs View)
    if (typeof KitchenQuantityDisplay === 'function' && typeof formatKitchenQuantity === 'function') {
      const unitMode = typeof getUnitDisplayMode === 'function' ? getUnitDisplayMode() : 'case';
      const activeBrisketVal = isTargetClosed ? 0 : (hasBlended ? (Number(brisketElem?.textContent) || bVal) : bVal);
      const activePorkVal = isTargetClosed ? 0 : (hasBlended ? (Number(porkElem?.textContent) || pVal) : pVal);
      const activeRibsVal = isTargetClosed ? 0 : (hasBlended ? (Number(ribsElem?.textContent) || rVal) : rVal);
      const activeDinoVal = isTargetClosed ? 0 : (hasBlended ? (Number(dinoElem?.textContent) || drVal) : drVal);
      const activeTurkeyVal = isTargetClosed ? 0 : (hasBlended ? (Number(turkeyElem?.textContent) || tVal) : tVal);
      const activeSausageLbs = isTargetClosed ? 0 : sVal;

      const qtyCardSpecs = [
        { cardId: 'kpi-card-brisket-container', meatKey: 'brisket', val: activeBrisketVal, subEl: bCasesElem },
        { cardId: 'kpi-card-pork-container', meatKey: 'pork', val: activePorkVal, subEl: pCasesElem },
        { cardId: 'kpi-card-sausage-container', meatKey: 'sausage', val: activeSausageLbs, subEl: null },
        { cardId: 'kpi-card-ribs-container', meatKey: 'pork_ribs', val: activeRibsVal, subEl: rCasesElem },
        { cardId: 'kpi-card-dino-container', meatKey: 'dino_ribs', val: activeDinoVal, subEl: drCasesElem },
        { cardId: 'kpi-card-turkey-container', meatKey: 'turkey', val: activeTurkeyVal, subEl: null }
      ];

      qtyCardSpecs.forEach(item => {
        const cardEl = document.getElementById(item.cardId);
        if (!cardEl) return;
        let slotEl = cardEl.querySelector('.kitchen-qty-slot');
        if (!slotEl) {
          slotEl = document.createElement('div');
          slotEl.className = 'kitchen-qty-slot';
          cardEl.insertBefore(slotEl, cardEl.firstChild);
        }
        slotEl.innerHTML = KitchenQuantityDisplay(item.meatKey, item.val, unitMode);
        if (item.subEl && !isTargetClosed && !hasBlended) {
          const fmt = formatKitchenQuantity(item.meatKey, item.val, unitMode);
          item.subEl.textContent = fmt.caseSummaryText;
        }
      });
    }

    // Hydrate Simplified Prep Safety Margin / Cushion Status Strip
    const marginStripEl = document.getElementById('prep-safety-margin-strip');
    const marginTextEl = document.getElementById('prep-safety-margin-text');
    const marginPillEl = document.getElementById('prep-safety-status-pill');
    const marginSubEl = document.getElementById('prep-safety-subtext');
    if (marginStripEl && marginTextEl && marginPillEl && marginSubEl) {
      if (isTargetClosed) {
        marginStripEl.className = 'prep-safety-margin-strip status-safe';
        marginTextEl.textContent = `Extra Prep / Cushion: +0 Racks / +0 Butts / +0 Briskets (Closed ${closedDayLabel})`;
        marginPillEl.className = 'prep-status-pill status-safe';
        marginPillEl.textContent = `● Closed ${closedDayLabel} (0 Prep Required)`;
        marginSubEl.textContent = 'Scheduled pit maintenance & firebox cleanout — reopens Tuesday 11:00 AM';
      } else {
        const extraRibsRacks = Math.max(0, Math.ceil((rVal || 0) * 0.15));
        const extraPorkButts = Math.max(0, Math.ceil(((pVal || 0) * 0.12) / 8.0));
        const extraBrisketPackers = Math.max(0, Math.ceil(((bVal || 0) * 0.10) / 14.0));
        marginTextEl.textContent = `Extra Prep / Cushion: +${extraRibsRacks} Rack${extraRibsRacks === 1 ? '' : 's'} / +${extraPorkButts} Butt${extraPorkButts === 1 ? '' : 's'} / +${extraBrisketPackers} Brisket${extraBrisketPackers === 1 ? '' : 's'}`;

        let marginStatus = 'safe';
        if (hasBlended && blendedMetrics && blendedMetrics.summary && (blendedMetrics.summary.actualSalesSoFar || 0) > 0) {
          if (blendedMetrics.summary.pacingPct > 18) marginStatus = 'under';
          else if (blendedMetrics.summary.pacingPct > 8) marginStatus = 'tight';
        }
        marginStripEl.className = `prep-safety-margin-strip status-${marginStatus}`;
        marginPillEl.className = `prep-status-pill status-${marginStatus}`;
        if (marginStatus === 'under') {
          marginPillEl.textContent = '▲ Under Par (High Rush Draw)';
          marginSubEl.textContent = 'Live counter pace exceeds cushion — pull reserve brisket & sausage links from walk-in';
        } else if (marginStatus === 'tight') {
          marginPillEl.textContent = '◆ Tight Prep (Active Rush)';
          marginSubEl.textContent = 'Drawing into +10% Extra Prep / Cushion — monitor slicing board portions closely';
        } else {
          marginPillEl.textContent = '● Safe Cushion (+10% Extra Prep)';
          marginSubEl.textContent = 'Covers peak lunch and dinner rush through 9:00 PM close without premature sell-outs';
        }
      }
    }

    if (!chartContainer) return;

    if (typeof Plotly !== 'undefined') {
      const dates = slicedRecords.map(r => r.day_name + ', ' + (r.date.length >= 10 ? r.date.substring(5).replace('-', '/') : r.date));

      let maxVal = 0;
      slicedRecords.forEach(r => {
        maxVal = Math.max(maxVal, r.brisket_raw_lbs || 0, r.pork_shoulder_raw_lbs || 0, r.sausage_lbs || 0, r.pork_ribs_racks || 0);
      });
      maxVal = maxVal * 1.15;

      const isMobile = isMobileViewport();
      let traces = [];
      let layout = {
        height: isMobile ? 300 : 340,
        title: isMobile ? "Pit Targets: Core Meats" : "Pit Production Targets: Raw vs. Cooked Yield Projections",
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(15,23,42,0.45)",
        font: { color: "#f8fafc", family: "Inter, system-ui, sans-serif", size: isMobile ? 10 : 12 },
        xaxis: { showgrid: false, zeroline: false, tickangle: -45, automargin: true },
        yaxis: { title: "Target Volume", gridcolor: "rgba(148,163,184,0.12)", zeroline: false, rangemode: "tozero" },
        margin: isMobile ? { l: 40, r: 20, t: 38, b: 56 } : { l: 56, r: 36, t: 48, b: 64 },
        legend: { orientation: "h", y: -0.24, x: 0 },
        hovermode: "x unified",
        hoverlabel: { bgcolor: "rgba(15, 23, 42, 0.95)", font: { family: "Inter, system-ui, sans-serif" } }
      };

      if (selectedCat === 'brisket_lbs') {
        layout.title = "Pit Production Targets: Brisket (Raw vs Cooked Yield)";
        layout.yaxis.title = "Raw Meat Weight (lbs)";
        let bMax = 0;
        slicedRecords.forEach(r => bMax = Math.max(bMax, r.brisket_raw_lbs || 0));
        layout.yaxis.range = [0, Math.max(10, bMax * 1.15)];
        traces.push({
          x: dates, y: slicedRecords.map(r => r.brisket_raw_lbs || 0),
          type: 'bar', name: 'Raw Brisket', marker: { color: '#e74c3c' },
          hovertemplate: "%{y:.1f} lbs Raw<extra></extra>"
        });
        traces.push({
          x: dates, y: slicedRecords.map(r => (r.brisket_raw_lbs || 0) * 0.4),
          type: 'scatter', mode: 'lines+markers', name: 'Cooked Yield (40%)', line: { color: '#f1c40f', width: 3 }, marker: { size: 6 },
          hovertemplate: "%{y:.1f} lbs Cooked<extra></extra>"
        });
      } else if (selectedCat === 'pulled_pork_lbs') {
        layout.title = "Pit Production Targets: Pork Shoulder (Raw vs Cooked Yield)";
        layout.yaxis.title = "Raw Meat Weight (lbs)";
        let pMax = 0;
        slicedRecords.forEach(r => pMax = Math.max(pMax, r.pork_shoulder_raw_lbs || 0));
        layout.yaxis.range = [0, Math.max(10, pMax * 1.15)];
        traces.push({
          x: dates, y: slicedRecords.map(r => r.pork_shoulder_raw_lbs || 0),
          type: 'bar', name: 'Raw Pork', marker: { color: '#3498db' },
          hovertemplate: "%{y:.1f} lbs Raw<extra></extra>"
        });
        traces.push({
          x: dates, y: slicedRecords.map(r => (r.pork_shoulder_raw_lbs || 0) * 0.44),
          type: 'scatter', mode: 'lines+markers', name: 'Cooked Yield (44%)', line: { color: '#f1c40f', width: 3 }, marker: { size: 6 },
          hovertemplate: "%{y:.1f} lbs Cooked<extra></extra>"
        });
      } else if (selectedCat === 'pork_ribs_racks') {
        layout.title = "Pit Production Targets: Pork Spare Ribs (Raw vs Cooked)";
        layout.yaxis.title = "Meat Weight (lbs)";
        let ribMax = 0;
        slicedRecords.forEach(r => ribMax = Math.max(ribMax, (r.pork_ribs_racks || 0) * 5));
        layout.yaxis.range = [0, Math.max(10, ribMax * 1.15)];
        traces.push({
          x: dates, y: slicedRecords.map(r => (r.pork_ribs_racks || 0) * 5),
          type: 'bar', name: 'Raw Weight (5 lbs/rack)', marker: { color: '#9b59b6' },
          hovertemplate: "%{y:.1f} lbs Raw<extra></extra>"
        });
        traces.push({
          x: dates, y: slicedRecords.map(r => ((r.pork_ribs_racks || 0) * 5) * 0.6),
          type: 'scatter', mode: 'lines+markers', name: 'Cooked Yield (60%)', line: { color: '#f1c40f', width: 3 }, marker: { size: 6 },
          hovertemplate: "%{y:.1f} lbs Cooked<extra></extra>"
        });
      } else if (selectedCat === 'beef_dino_ribs') {
        layout.title = "Pit Production Targets: Beef Dino Ribs (Raw vs Cooked)";
        layout.yaxis.title = "Meat Weight (lbs)";
        let dinoMax = 0;
        slicedRecords.forEach(r => dinoMax = Math.max(dinoMax, (r.beef_dino_ribs || 0) * 4));
        layout.yaxis.range = [0, Math.max(10, dinoMax * 1.15)];
        traces.push({
          x: dates, y: slicedRecords.map(r => (r.beef_dino_ribs || 0) * 4),
          type: 'bar', name: 'Raw Weight (4 lbs/rack)', marker: { color: '#8e44ad' },
          hovertemplate: "%{y:.1f} lbs Raw<extra></extra>"
        });
        traces.push({
          x: dates, y: slicedRecords.map(r => ((r.beef_dino_ribs || 0) * 4) * 0.5),
          type: 'scatter', mode: 'lines+markers', name: 'Cooked Yield (50%)', line: { color: '#f1c40f', width: 3 }, marker: { size: 6 },
          hovertemplate: "%{y:.1f} lbs Cooked<extra></extra>"
        });
      } else if (selectedCat === 'turkey_lbs') {
        layout.title = "Pit Production Targets: Smoked Turkey Breast (Raw vs Cooked)";
        layout.yaxis.title = "Meat Weight (lbs)";
        const getTurkeyData = (r) => {
          if (!r || r.is_closed || r.day_name === 'Mon') return { cooked: 0, raw: 0 };
          const baselines = { 'Tue': 6.2, 'Wed': 7.2, 'Thu': 7.0, 'Fri': 11.5, 'Sat': 12.9, 'Sun': 8.9 };
          const baseCooked = baselines[r.day_name] || 6.0;
          const rev = r.predicted_revenue || 0;
          const benchmark = ['Fri', 'Sat', 'Sun'].includes(r.day_name) ? 3500 : 2800;
          const revMultiplier = rev > 0 ? Math.min(1.10, Math.max(0.90, rev / benchmark)) : 1.0;
          const cookedDemand = baseCooked * revMultiplier;
          const cookedTarget = Math.round(cookedDemand * 1.10 * 10) / 10;
          const rawTarget = Math.round((cookedTarget / 0.70) * 10) / 10;
          return { cooked: cookedTarget, raw: rawTarget };
        };
        let turkeyMax = 0;
        slicedRecords.forEach(r => turkeyMax = Math.max(turkeyMax, getTurkeyData(r).raw));
        layout.yaxis.range = [0, Math.max(10, turkeyMax * 1.15)];
        traces.push({
          x: dates, y: slicedRecords.map(r => getTurkeyData(r).raw),
          type: 'bar', name: 'Raw Turkey Breast (Prep)', marker: { color: '#e67e22' },
          hovertemplate: "%{y:.1f} lbs Raw<extra></extra>"
        });
        traces.push({
          x: dates, y: slicedRecords.map(r => getTurkeyData(r).cooked),
          type: 'scatter', mode: 'lines+markers', name: 'Cooked Target Yield (70%)', line: { color: '#f1c40f', width: 3 }, marker: { size: 6 },
          hovertemplate: "%{y:.1f} lbs Cooked<extra></extra>"
        });
      } else if (selectedCat === 'sausage_links') {
        layout.title = "Pit Production Targets: Sausage Links";
        layout.yaxis.title = "Total Links";
        let sausageMax = 0;
        slicedRecords.forEach(r => sausageMax = Math.max(sausageMax, (r.sausage_lbs || 0) * 3));
        layout.yaxis.range = [0, Math.max(10, sausageMax * 1.15)];
        traces.push({
          x: dates, y: slicedRecords.map(r => (r.sausage_lbs || 0) * 3),
          type: 'bar', name: 'Sausage Links', marker: { color: '#f39c12' },
          hovertemplate: "%{y:.0f} Links<extra></extra>"
        });
      } else if (selectedCat === 'rosebuds_sold' || selectedCat === 'tacos_sold') {
        const isTaco = selectedCat === 'tacos_sold';
        layout.title = isTaco ? "Composed Item Demand: Tacos" : "Composed Item Demand: Rosebuds";
        layout.yaxis.title = "Total Units";
        let itemMax = 0;
        slicedRecords.forEach(r => itemMax = Math.max(itemMax, r[selectedCat] || 0));
        layout.yaxis.range = [0, Math.max(10, itemMax * 1.15)];
        traces.push({
          x: dates, y: slicedRecords.map(r => r[selectedCat] || 0),
          type: 'bar', name: isTaco ? 'Tacos' : 'Rosebuds', marker: { color: '#2ecc71' },
          hovertemplate: "%{y:.0f} Units<extra></extra>"
        });
      } else {
        layout.title = "Pit Production Targets: Total Core Meats (Raw lbs)";
        layout.yaxis.title = "Raw Meat Weight (lbs)";
        let tMax = 0;
        slicedRecords.forEach(r => tMax = Math.max(tMax, r.brisket_raw_lbs || 0, r.pork_shoulder_raw_lbs || 0, r.sausage_lbs || 0, r.pork_ribs_racks || 0));
        layout.yaxis.range = [0, Math.max(10, tMax * 1.15)];
        traces.push({
          x: dates, y: slicedRecords.map(r => r.brisket_raw_lbs || 0),
          type: 'scatter', mode: 'lines+markers', name: 'Brisket', line: { color: '#e74c3c', width: 3 }, marker: { size: 8 },
          hovertemplate: "%{y:.1f} lbs<extra></extra>"
        });
        traces.push({
          x: dates, y: slicedRecords.map(r => r.pork_shoulder_raw_lbs || 0),
          type: 'scatter', mode: 'lines+markers', name: 'Pork Shoulder', line: { color: '#3498db', width: 3 }, marker: { size: 8 },
          hovertemplate: "%{y:.1f} lbs<extra></extra>"
        });
        traces.push({
          x: dates, y: slicedRecords.map(r => r.sausage_lbs || 0),
          type: 'scatter', mode: 'lines+markers', name: 'Sausage', line: { color: '#f1c40f', width: 3 }, marker: { size: 8 },
          hovertemplate: "%{y:.1f} lbs<extra></extra>"
        });
        traces.push({
          x: dates, y: slicedRecords.map(r => r.pork_ribs_racks || 0),
          type: 'scatter', mode: 'lines+markers', name: 'Pork Ribs (racks)', line: { color: '#9b59b6', width: 3, dash: 'dot' }, marker: { size: 8 },
          hovertemplate: "%{y:.1f} racks<extra></extra>"
        });
      }

      Plotly.react(chartContainer, traces, layout, getPlotlyConfig());
      if (chartContainer.offsetWidth > 0 && typeof Plotly !== 'undefined') {
        try { Plotly.Plots.resize(chartContainer); } catch (e) {}
      }
      applyChartTouchSafety(chartContainer);
      if (typeof injectMobileFaceCallouts === 'function' && slicedRecords.length > 0) {
        const openSlices = slicedRecords.filter(r => !r.is_closed && r.day_name !== 'Mon');
        const pool = openSlices.length > 0 ? openSlices : slicedRecords;
        const peakR = pool.reduce((a, b) => ((b.brisket_raw_lbs || 0) > (a.brisket_raw_lbs || 0) ? b : a), pool[0]);
        const lowR = pool.reduce((a, b) => ((b.brisket_raw_lbs || 0) < (a.brisket_raw_lbs || 0) ? b : a), pool[0]);
        const nowR = pool[0];
        injectMobileFaceCallouts(
          chartContainer,
          `${peakR.day_name} (${Math.round(peakR.brisket_raw_lbs || 0)} lbs Brisket)`,
          `${lowR.day_name} (${Math.round(lowR.brisket_raw_lbs || 0)} lbs Brisket)`,
          `${nowR.day_name} (${Math.round(nowR.brisket_raw_lbs || 0)} lbs Brisket)`
        );
      }
    } else if (typeof renderD3ForecastingChart === 'function') {
      renderD3ForecastingChart('plotly-meat-sales-chart', slicedRecords, dashPayload ? dashPayload.anomalies : [], selectedCat);
      applyChartTouchSafety(chartContainer);
    }
  } catch (error) {
    console.error("Dashboard Rendering Error: ", error);
  }
}
