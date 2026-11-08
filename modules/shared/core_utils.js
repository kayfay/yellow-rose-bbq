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

  // A phone held sideways is wider than 768px but still a touch screen with little height: charts there stay
  // static (scroll-safe) with pre-baked labels, and are capped to fit the short screen.
  function isLandscapePhone() {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse) and (max-height: 500px) and (orientation: landscape)').matches;
  }

  function isMobileViewport() {
    return typeof window !== 'undefined' && (window.innerWidth < 768 || isLandscapePhone());
  }

  function fitChartHeight(h) {
    return isLandscapePhone() ? Math.max(220, Math.min(h, window.innerHeight - 110)) : h;
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
  // Event multipliers come only from the calendar (measured, see scripts/calibrate_calendar_multipliers.py); never invented.
  function validEventMultiplier(m) {
    const n = Number(m);
    return Number.isFinite(n) && n > 0 ? n : 1.0;
  }

  function resolveDateEventImpact(dateStr) {
    if (!dateStr) return { multiplier: 1.0, label: '' };
    const calPayload = global.BBQ_PAYLOADS?.calendar_events;
    if (Array.isArray(calPayload)) {
      const matched = calPayload.find(ev => ev && ev.date === dateStr);
      if (matched) {
        const title = String(matched.title || matched.name || '');
        if (/jaguars|stadium|game/i.test(title)) {
          return { multiplier: validEventMultiplier(matched.multiplier), label: title || 'Jaguars Game' };
        }
        if (/holiday|thanksgiving|christmas|new year/i.test(title)) {
          return { multiplier: validEventMultiplier(matched.multiplier), label: title || 'Holiday' };
        }
        if (matched.multiplier && Number(matched.multiplier) !== 1.0) {
          return { multiplier: Number(matched.multiplier), label: title || 'Local Event' };
        }
      }
    }
    if (BASELINE_JAGS_HOME_GAMES.includes(dateStr)) {
      return { multiplier: 1.0, label: 'Jaguars Game' }; // no measured lift (see calendar multiplier_basis)
    }
    if (BASELINE_HOLIDAYS.includes(dateStr)) {
      return { multiplier: 1.0, label: 'Holiday' }; // too few measured holidays to adjust prep
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

  /**
   * Reusable Kitchen Quantity Display Component (`KitchenQuantityDisplay`)
   * Converts raw protein weights/counts into practical smokehouse case and individual
   * cut counts (Packers, Butts, Racks, Ribs, Breasts, Batches/Links) while preserving
   * raw/cooked weight subtext and backend calculations.
   */
  const UNIT_MODE_STORAGE_KEY = 'yr_unit_display_mode_v1';

  const KITCHEN_UNIT_SPECS = {
    brisket: {
      name: 'Brisket',
      lbsPerCase: 82.0,
      cutsPerCase: 5,
      lbsPerCut: 16.4,
      cutLabelSingular: 'Brisket',
      cutLabelPlural: 'Briskets',
      yieldRatio: 0.35,
      portionsPerCookedLb: 2.3
    },
    pork: {
      name: 'Pork Butt',
      lbsPerCase: 32.0,
      cutsPerCase: 4,
      lbsPerCut: 8.0,
      cutLabelSingular: 'Butt',
      cutLabelPlural: 'Butts',
      yieldRatio: 0.44,
      portionsPerCookedLb: 2.0
    },
    pork_ribs: {
      name: 'Pork Spare Ribs',
      racksPerCase: 6,
      racksPerBag: 2,
      lbsPerRack: 5.6,
      lbsPerCase: 33.6,
      cutLabelSingular: 'Rack',
      cutLabelPlural: 'Racks',
      yieldRatio: 0.60,
      bonesPerRack: 12
    },
    dino_ribs: {
      name: 'Beef Dino Ribs',
      ribsPerCase: 12,
      bagsPerCase: 3,
      lbsPerRib: 4.0,
      lbsPerCase: 48.0,
      cutLabelSingular: 'Rib',
      cutLabelPlural: 'Ribs',
      yieldRatio: 0.50
    },
    turkey: {
      name: 'Smoked Turkey Breast',
      lbsPerCase: 20.0,
      cutsPerCase: 2,
      lbsPerCut: 10.0,
      cutLabelSingular: 'Breast',
      cutLabelPlural: 'Breasts',
      yieldRatio: 0.70,
      portionsPerCookedLb: 3.2
    },
    sausage: {
      name: 'House Sausage',
      lbsPerBatch: 60.0,
      linksPerLb: 3.0,
      linksPerBatch: 180,
      cutLabelSingular: 'Link',
      cutLabelPlural: 'Links'
    }
  };

  function getUnitDisplayMode() {
    if (typeof document !== 'undefined' && document.body && document.body.dataset.unitMode) {
      return document.body.dataset.unitMode === 'lbs' ? 'lbs' : 'case';
    }
    try {
      const saved = global.localStorage ? global.localStorage.getItem(UNIT_MODE_STORAGE_KEY) : null;
      return saved === 'lbs' ? 'lbs' : 'case';
    } catch (_e) {
      return 'case';
    }
  }

  function setUnitDisplayMode(mode) {
    const cleanMode = mode === 'lbs' ? 'lbs' : 'case';
    if (typeof document !== 'undefined' && document.body) {
      document.body.dataset.unitMode = cleanMode;
    }
    try {
      if (global.localStorage) {
        global.localStorage.setItem(UNIT_MODE_STORAGE_KEY, cleanMode);
      }
    } catch (_e) {}
    const btn = typeof document !== 'undefined' ? document.getElementById('btn-debug-unit-mode') : null;
    if (btn) {
      btn.textContent = cleanMode === 'case' ? 'Units: Counts' : 'Units: Lbs';
      btn.setAttribute('data-unit-mode', cleanMode);
    }
    return cleanMode;
  }

  function formatKitchenQuantity(meatKey, rawVal, mode) {
    const activeMode = mode || getUnitDisplayMode();
    const val = Math.max(0, Number(rawVal) || 0);

    if (val <= 0) {
      return {
        meatKey,
        mode: activeMode,
        cases: 0,
        cuts: 0,
        rawLbs: 0,
        cookedLbs: 0,
        primaryText: 'Closed • 0 Cases / 0 Cuts',
        secondaryText: '0 lbs raw • 0 lbs cooked',
        caseSummaryText: '(Closed / 0 Cases)'
      };
    }

    if (meatKey === 'brisket') {
      const spec = KITCHEN_UNIT_SPECS.brisket;
      const cases = Number((val / spec.lbsPerCase).toFixed(1));
      const packers = Math.max(1, Math.ceil(val / spec.lbsPerCut));
      const cookedLbs = Math.round(val * spec.yieldRatio);
      const cutWord = packers === 1 ? spec.cutLabelSingular : spec.cutLabelPlural;
      const caseWord = cases === 1 ? 'Case' : 'Cases';
      return {
        meatKey,
        mode: activeMode,
        cases,
        cuts: packers,
        rawLbs: Math.round(val),
        cookedLbs,
        primaryText: activeMode === 'lbs'
          ? `${cookedLbs} lbs Cooked (~${Math.round(val)} lbs Raw)`
          : `${cases} ${caseWord} • ~${packers} ${cutWord}`,
        secondaryText: activeMode === 'lbs'
          ? `${cases} ${caseWord} • ~${packers} ${cutWord}`
          : `~${cookedLbs} lbs cooked • ~${Math.round(val)} lbs raw`,
        countText: `~${packers} ${cutWord}`,
        caseText: `${cases} ${caseWord}`,
        yieldPct: Math.round(spec.yieldRatio * 100),
        caseSummaryText: `(${cases} ${caseWord} / ~${packers} ${cutWord})`
      };
    }

    if (meatKey === 'pork') {
      const spec = KITCHEN_UNIT_SPECS.pork;
      const cases = Number((val / spec.lbsPerCase).toFixed(1));
      const butts = Math.max(1, Math.ceil(val / spec.lbsPerCut));
      const cookedLbs = Math.round(val * spec.yieldRatio);
      const cutWord = butts === 1 ? spec.cutLabelSingular : spec.cutLabelPlural;
      const caseWord = cases === 1 ? 'Case' : 'Cases';
      return {
        meatKey,
        mode: activeMode,
        cases,
        cuts: butts,
        rawLbs: Math.round(val),
        cookedLbs,
        primaryText: activeMode === 'lbs'
          ? `${cookedLbs} lbs Cooked (~${Math.round(val)} lbs Raw)`
          : `${cases} ${caseWord} / ~${butts} ${cutWord}`,
        secondaryText: activeMode === 'lbs'
          ? `${cases} ${caseWord} / ~${butts} ${cutWord}`
          : `~${cookedLbs} lbs cooked • ~${Math.round(val)} lbs raw`,
        countText: `~${butts} ${cutWord}`,
        caseText: `${cases} ${caseWord}`,
        yieldPct: Math.round(spec.yieldRatio * 100),
        caseSummaryText: `(${cases} ${caseWord} / ~${butts} ${cutWord})`
      };
    }

    if (meatKey === 'pork_ribs') {
      const spec = KITCHEN_UNIT_SPECS.pork_ribs;
      const racks = Math.round(val);
      const cases = Number((racks / spec.racksPerCase).toFixed(1));
      const bags = Math.max(1, Math.ceil(racks / spec.racksPerBag));
      const rawLbs = Math.round(racks * spec.lbsPerRack);
      const cookedLbs = Math.round(rawLbs * spec.yieldRatio);
      const cutWord = racks === 1 ? spec.cutLabelSingular : spec.cutLabelPlural;
      const caseWord = cases === 1 ? 'Case' : 'Cases';
      return {
        meatKey,
        mode: activeMode,
        cases,
        cuts: racks,
        bags,
        rawLbs,
        cookedLbs,
        primaryText: activeMode === 'lbs'
          ? `~${rawLbs} lbs Raw (${racks} ${cutWord})`
          : `${racks} ${cutWord} • ${cases} ${caseWord}`,
        secondaryText: activeMode === 'lbs'
          ? `${racks} ${cutWord} • ${cases} ${caseWord} (~${bags} Bags)`
          : `~${rawLbs} lbs raw • ~${bags} Cryovac Bags`,
        countText: `${racks} ${cutWord}`,
        caseText: `${cases} ${caseWord}`,
        yieldPct: Math.round(spec.yieldRatio * 100),
        caseSummaryText: `(${racks} ${cutWord} / ${cases} ${caseWord})`
      };
    }

    if (meatKey === 'dino_ribs') {
      const spec = KITCHEN_UNIT_SPECS.dino_ribs;
      const ribs = Math.round(val);
      const cases = Number((ribs / spec.ribsPerCase).toFixed(1));
      const rawLbs = Math.round(ribs * spec.lbsPerRib);
      const cookedLbs = Math.round(rawLbs * spec.yieldRatio);
      const cutWord = ribs === 1 ? spec.cutLabelSingular : spec.cutLabelPlural;
      const caseWord = cases === 1 ? 'Case' : 'Cases';
      return {
        meatKey,
        mode: activeMode,
        cases,
        cuts: ribs,
        rawLbs,
        cookedLbs,
        primaryText: activeMode === 'lbs'
          ? `~${rawLbs} lbs Raw (${ribs} ${cutWord})`
          : `${ribs} ${cutWord} • ${cases} ${caseWord}`,
        secondaryText: activeMode === 'lbs'
          ? `${ribs} ${cutWord} • ${cases} ${caseWord}`
          : `~${rawLbs} lbs raw • ~${cookedLbs} lbs cooked`,
        countText: `${ribs} ${cutWord}`,
        caseText: `${cases} ${caseWord}`,
        yieldPct: Math.round(spec.yieldRatio * 100),
        caseSummaryText: `(${ribs} ${cutWord} / ${cases} ${caseWord})`
      };
    }

    if (meatKey === 'turkey') {
      const spec = KITCHEN_UNIT_SPECS.turkey;
      // rawVal passed for turkey is cooked usable lbs
      const cookedLbs = Math.round(val);
      const rawLbs = Math.round(val / spec.yieldRatio);
      const cases = Number((rawLbs / spec.lbsPerCase).toFixed(1));
      const breasts = Math.max(1, Math.ceil(rawLbs / spec.lbsPerCut));
      const cutWord = breasts === 1 ? spec.cutLabelSingular : spec.cutLabelPlural;
      const caseWord = cases === 1 ? 'Case' : 'Cases';
      return {
        meatKey,
        mode: activeMode,
        cases,
        cuts: breasts,
        rawLbs,
        cookedLbs,
        primaryText: activeMode === 'lbs'
          ? `${cookedLbs} lbs Cooked (~${rawLbs} lbs Raw)`
          : `${cases} ${caseWord} • ~${breasts} ${cutWord}`,
        secondaryText: activeMode === 'lbs'
          ? `${cases} ${caseWord} • ~${breasts} ${cutWord}`
          : `~${cookedLbs} lbs cooked • ~${rawLbs} lbs raw`,
        countText: `~${breasts} ${cutWord}`,
        caseText: `${cases} ${caseWord}`,
        yieldPct: Math.round(spec.yieldRatio * 100),
        caseSummaryText: `(${cases} ${caseWord} / ~${breasts} ${cutWord})`
      };
    }

    if (meatKey === 'sausage') {
      const spec = KITCHEN_UNIT_SPECS.sausage;
      const rawLbs = Math.round(val);
      const batches = Math.max(1, Math.ceil(rawLbs / spec.lbsPerBatch));
      const links = Math.round(rawLbs * spec.linksPerLb);
      const batchWord = batches === 1 ? 'Batch' : 'Batches';
      return {
        meatKey,
        mode: activeMode,
        cases: batches,
        cuts: links,
        rawLbs,
        cookedLbs: rawLbs,
        primaryText: activeMode === 'lbs'
          ? `${rawLbs} lbs Stuffed (~${links} Links)`
          : `${batches} ${batchWord} • ~${links} Links`,
        secondaryText: activeMode === 'lbs'
          ? `${batches} ${batchWord} • ~${links} Links`
          : `~${rawLbs} lbs stuffed weight (60 lb batch)`,
        countText: `~${links} Links`,
        caseText: `${batches} ${batchWord}`,
        yieldPct: null,
        caseSummaryText: `(${batches} ${batchWord} / ~${links} Links)`
      };
    }

    return {
      meatKey,
      mode: activeMode,
      cases: 0,
      cuts: Math.round(val),
      rawLbs: Math.round(val),
      cookedLbs: Math.round(val),
      primaryText: `${Math.round(val)} Units`,
      secondaryText: '',
      caseSummaryText: `(${Math.round(val)} Units)`
    };
  }

  function KitchenQuantityDisplay(meatKey, rawVal, mode) {
    const q = formatKitchenQuantity(meatKey, rawVal, mode);
    // Counts view: the physical piece count is the big number; weights are muted rows beneath it.
    if (q.mode !== 'lbs' && q.countText) {
      const cooked = q.yieldPct !== null && q.yieldPct !== undefined
        ? `<span class="kitchen-qty-secondary">Cooked ${escapeHTML(q.cookedLbs)} lbs &bull; ${escapeHTML(q.yieldPct)}% yield</span>`
        : '';
      return `<div class="kitchen-qty-display kitchen-qty-counts" data-meat="${escapeHTML(meatKey)}" data-unit-mode="${escapeHTML(q.mode)}">` +
        `<span class="kitchen-qty-primary">${escapeHTML(q.countText)}</span>` +
        `<span class="kitchen-qty-secondary">Raw ${escapeHTML(q.rawLbs)} lbs &bull; ${escapeHTML(q.caseText)}</span>` +
        cooked +
        `</div>`;
    }
    return `<div class="kitchen-qty-display" data-meat="${escapeHTML(meatKey)}" data-unit-mode="${escapeHTML(q.mode)}">` +
      `<span class="kitchen-qty-primary">${escapeHTML(q.primaryText)}</span>` +
      (q.secondaryText ? `<span class="kitchen-qty-secondary">${escapeHTML(q.secondaryText)}</span>` : '') +
      `</div>`;
  }

  // Expose on global namespace and BBQModules.shared
  global.escapeHTML = escapeHTML;
  global.isMobileViewport = isMobileViewport;
  global.isLandscapePhone = isLandscapePhone;
  global.fitChartHeight = fitChartHeight;
  global.getPlotlyConfig = getPlotlyConfig;
  global.applyChartTouchSafety = applyChartTouchSafety;
  global.parseValidDate = parseValidDate;
  global.getActiveDaysCount = getActiveDaysCount;
  global.fetchJsonSafe = fetchJsonSafe;
  global.resolveDateEventImpact = resolveDateEventImpact;
  global.resolveOpenMeteoWeatherImpact = resolveOpenMeteoWeatherImpact;
  global.initRollUpAccordions = initRollUpAccordions;
  global.setAllRollUpSections = setAllRollUpSections;
  global.KITCHEN_UNIT_SPECS = KITCHEN_UNIT_SPECS;
  global.getUnitDisplayMode = getUnitDisplayMode;
  global.setUnitDisplayMode = setUnitDisplayMode;
  global.formatKitchenQuantity = formatKitchenQuantity;
  global.KitchenQuantityDisplay = KitchenQuantityDisplay;
  global.KITCHEN_UNIT_SPECS = KITCHEN_UNIT_SPECS;

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
    setAllRollUpSections,
    KITCHEN_UNIT_SPECS,
    getUnitDisplayMode,
    setUnitDisplayMode,
    formatKitchenQuantity,
    KitchenQuantityDisplay
  };
})(typeof window !== 'undefined' ? window : globalThis);
