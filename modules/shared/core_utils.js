/**
 * Yellow Rose BBQ — Shared Core Utilities & Circuit Breakers
 * Provides HTML sanitization, viewport/touch-safety helpers, date parsing,
 * dynamic event/weather impact resolution, and timeout-guarded network fetches.
 */
(function (global) {
  'use strict';

  global.BBQModules = global.BBQModules || {};

  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

  function isMobileViewport() {
    return typeof window !== 'undefined' && window.innerWidth < 768;
  }

  function getPlotlyConfig(extra = {}) {
    const mobile = isMobileViewport();
    return {
      responsive: true,
      displayModeBar: false,
      staticPlot: mobile,
      scrollZoom: false,
      doubleClick: false,
      ...extra
    };
  }

  function applyChartTouchSafety(containerOrId) {
    const el = typeof containerOrId === 'string' ? document.getElementById(containerOrId) : containerOrId;
    if (!el) return;
    const mobile = isMobileViewport();
    el.style.touchAction = 'pan-y';
    if (mobile) {
      el.style.pointerEvents = 'none';
      el.setAttribute('data-mobile-static', 'true');
      el.querySelectorAll('svg, .plot-container, .svg-container, .js-plotly-plot').forEach(node => {
        node.style.pointerEvents = 'none';
        node.style.touchAction = 'pan-y';
      });
    } else {
      el.style.pointerEvents = 'auto';
      el.setAttribute('data-mobile-static', 'false');
      el.querySelectorAll('svg, .plot-container, .svg-container, .js-plotly-plot').forEach(node => {
        node.style.pointerEvents = '';
        node.style.touchAction = 'pan-y';
      });
    }
  }

  function parseValidDate(val) {
    if (!val || typeof val !== 'string') return null;
    const trimmed = val.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
    const d = new Date(trimmed + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  }

  function getActiveDaysCount() {
    const start = document.getElementById('forecast-start-date')?.value;
    const end = document.getElementById('forecast-end-date')?.value;
    if (start && end) {
      const dStart = parseValidDate(start);
      const dEnd = parseValidDate(end);
      if (dStart && dEnd) {
        const diffTime = dEnd.getTime() - dStart.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return diffDays > 0 ? diffDays : 1;
      }
    }
    return 1;
  }

  /**
   * Circuit-breaker JSON fetch wrapper with AbortController timeout.
   * Ensures unreachable or lagging endpoints never freeze kitchen UI interactions.
   */
  async function fetchJsonSafe(url, fallbackData = null, timeoutMs = 4000) {
    if (typeof fetch !== 'function') return fallbackData;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const res = await fetch(url, controller ? { signal: controller.signal } : undefined);
      if (!res.ok) return fallbackData;
      return await res.json();
    } catch (_err) {
      return fallbackData;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  const BASELINE_JAGS_HOME_GAMES = [
    '2026-09-13', '2026-09-27', '2026-10-18', '2026-11-01',
    '2026-11-22', '2026-12-06', '2026-12-20'
  ];

  const BASELINE_HOLIDAYS = [
    '2026-01-01', '2026-05-25', '2026-07-04', '2026-09-07',
    '2026-11-26', '2026-12-25', '2027-01-01', '2027-05-31',
    '2027-07-04', '2027-09-06', '2027-11-25', '2027-12-25'
  ];

  /**
   * Dynamically resolves event multiplier and label for a target date,
   * consulting window.BBQ_PAYLOADS.calendar_events before baseline schedules.
   */
  function resolveDateEventImpact(dateStr) {
    if (!dateStr) return { multiplier: 1.0, label: '' };
    const calPayload = global.BBQ_PAYLOADS?.calendar_events;
    if (Array.isArray(calPayload)) {
      const matched = calPayload.find(ev => ev && ev.date === dateStr);
      if (matched) {
        const title = String(matched.title || matched.name || '');
        if (/jaguars|stadium|game/i.test(title)) {
          return { multiplier: Number(matched.multiplier) || 3.5, label: title || 'Jaguars Game' };
        }
        if (/holiday|thanksgiving|christmas|new year/i.test(title)) {
          return { multiplier: Number(matched.multiplier) || 0.7, label: title || 'Holiday' };
        }
        if (matched.multiplier && Number(matched.multiplier) !== 1.0) {
          return { multiplier: Number(matched.multiplier), label: title || 'Local Event' };
        }
      }
    }
    if (BASELINE_JAGS_HOME_GAMES.includes(dateStr)) {
      return { multiplier: 3.5, label: 'Jaguars Game' };
    }
    if (BASELINE_HOLIDAYS.includes(dateStr)) {
      return { multiplier: 0.7, label: 'Holiday' };
    }
    return { multiplier: 1.0, label: '' };
  }

  /**
   * Queries Open-Meteo in Fahrenheit (°F) with a strict timeout circuit breaker.
   * Applies calibrated rain headwind (0.85x) or extreme heat (0.942x) adjustments.
   */
  async function resolveOpenMeteoWeatherImpact(dateStr, timeoutMs = 3500) {
    if (!dateStr) return { multiplier: 1.0, label: '' };
    const url = `https://api.open-meteo.com/v1/forecast?latitude=30.3322&longitude=-81.6557&daily=temperature_2m_max,precipitation_sum&temperature_unit=fahrenheit&precipitation_unit=mm&timezone=America/New_York&start_date=${encodeURIComponent(dateStr)}&end_date=${encodeURIComponent(dateStr)}`;
    const weatherData = await fetchJsonSafe(url, null, timeoutMs);
    if (weatherData && weatherData.daily) {
      const precip = Array.isArray(weatherData.daily.precipitation_sum) ? weatherData.daily.precipitation_sum[0] : 0;
      const maxTempF = Array.isArray(weatherData.daily.temperature_2m_max) ? weatherData.daily.temperature_2m_max[0] : 75;
      if (typeof precip === 'number' && precip > 10.0) {
        return { multiplier: 0.85, label: 'Heavy Rain' };
      }
      if (typeof maxTempF === 'number' && maxTempF > 90.0) {
        return { multiplier: 0.942, label: 'Extreme Heat' };
      }
    }
    return { multiplier: 1.0, label: '' };
  }

  /**
   * Reusable Roll-Up Accordion Controller (`RollUpSection`)
   * Attaches touch-safe (>=48px) collapse/expand handlers to `.rollup-header` buttons,
   * persists state in localStorage (`yr_rollup_state_v1`), and resizes Plotly charts on expand.
   */
  const ROLLUP_STORAGE_KEY = 'yr_rollup_state_v1';

  function loadRollUpState() {
    try {
      const raw = global.localStorage ? global.localStorage.getItem(ROLLUP_STORAGE_KEY) : null;
      return raw ? JSON.parse(raw) : {};
    } catch (_err) {
      return {};
    }
  }

  function saveRollUpState(stateMap) {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(ROLLUP_STORAGE_KEY, JSON.stringify(stateMap));
      }
    } catch (_err) {}
  }

  function applyRollUpExpansion(sectionEl, expanded) {
    if (!sectionEl) return;
    const headerBtn = sectionEl.querySelector('.rollup-header');
    const bodyEl = sectionEl.querySelector('.rollup-body');
    const chevronEl = sectionEl.querySelector('.rollup-chevron');
    const detailsEl = sectionEl.querySelector('details');

    if (expanded) {
      sectionEl.classList.remove('collapsed');
      if (detailsEl) detailsEl.setAttribute('open', '');
      if (headerBtn) headerBtn.setAttribute('aria-expanded', 'true');
      if (bodyEl) bodyEl.hidden = false;
      if (chevronEl) chevronEl.textContent = '▼';
      if (typeof global.Plotly !== 'undefined' && bodyEl) {
        bodyEl.querySelectorAll('.js-plotly-plot').forEach(plotEl => {
          try { global.Plotly.Plots.resize(plotEl); } catch (_e) {}
        });
      }
    } else {
      sectionEl.classList.add('collapsed');
      if (detailsEl) detailsEl.removeAttribute('open');
      if (headerBtn) headerBtn.setAttribute('aria-expanded', 'false');
      if (bodyEl) bodyEl.hidden = true;
      if (chevronEl) chevronEl.textContent = '▶';
    }
  }

  function setAllRollUpSections(expanded) {
    const sections = document.querySelectorAll('.rollup-section');
    const stateMap = loadRollUpState();
    sections.forEach(sec => {
      applyRollUpExpansion(sec, Boolean(expanded));
      const key = sec.getAttribute('data-rollup-key');
      if (key) stateMap[key] = Boolean(expanded);
    });
    saveRollUpState(stateMap);
    const toggleBtn = document.getElementById('btn-debug-rollup-toggle');
    if (toggleBtn) {
      toggleBtn.textContent = expanded ? 'Roll-Ups: Collapse All' : 'Roll-Ups: Expand All';
      toggleBtn.setAttribute('data-rollup-all-expanded', expanded ? 'true' : 'false');
    }
  }

  function initRollUpAccordions() {
    const sections = document.querySelectorAll('.rollup-section');
    const savedState = loadRollUpState();
    sections.forEach(sec => {
      if (sec.getAttribute('data-rollup-bound') === 'true') return;
      sec.setAttribute('data-rollup-bound', 'true');
      const headerBtn = sec.querySelector('.rollup-header');
      if (!headerBtn) return;

      const key = sec.getAttribute('data-rollup-key');
      const initialExpanded = (key && typeof savedState[key] === 'boolean')
        ? savedState[key]
        : (headerBtn.getAttribute('aria-expanded') !== 'false');
      applyRollUpExpansion(sec, initialExpanded);

      headerBtn.addEventListener('click', (e) => {
        if (headerBtn.tagName === 'SUMMARY') {
          e.preventDefault();
        }
        const currentlyExpanded = headerBtn.getAttribute('aria-expanded') !== 'false';
        const nextExpanded = !currentlyExpanded;
        applyRollUpExpansion(sec, nextExpanded);
        const key = sec.getAttribute('data-rollup-key');
        if (key) {
          const stateMap = loadRollUpState();
          stateMap[key] = nextExpanded;
          saveRollUpState(stateMap);
        }
      });
    });
  }

  // Expose on global namespace and BBQModules.shared
  global.escapeHTML = escapeHTML;
  global.isMobileViewport = isMobileViewport;
  global.getPlotlyConfig = getPlotlyConfig;
  global.applyChartTouchSafety = applyChartTouchSafety;
  global.parseValidDate = parseValidDate;
  global.getActiveDaysCount = getActiveDaysCount;
  global.fetchJsonSafe = fetchJsonSafe;
  global.resolveDateEventImpact = resolveDateEventImpact;
  global.resolveOpenMeteoWeatherImpact = resolveOpenMeteoWeatherImpact;
  global.initRollUpAccordions = initRollUpAccordions;
  global.setAllRollUpSections = setAllRollUpSections;

  global.BBQModules.shared = {
    escapeHTML,
    isMobileViewport,
    getPlotlyConfig,
    applyChartTouchSafety,
    parseValidDate,
    getActiveDaysCount,
    fetchJsonSafe,
    resolveDateEventImpact,
    resolveOpenMeteoWeatherImpact,
    initRollUpAccordions,
    setAllRollUpSections
  };
})(typeof window !== 'undefined' ? window : globalThis);
