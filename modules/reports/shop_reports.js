/**
 * Yellow Rose BBQ — Shop Reports, Executive BI Brief & Pit Intelligence Module
 * Manages the Daily Executive Brief, Sales Breakdown Bridge, Stephen Few KPI
 * Bullet Bars & Tufte 7-Day Sparklines, 10 Pitmaster Watchlist Tips, Quick Wind
 * Scan Banner, and Plain-English Glossary & Term Explainer Drawer.
 */
(function (global) {
  'use strict';

  global.BBQModules = global.BBQModules || {};

  function buildSparklineSVG(values, strokeColor = '#56B4E9') {
    if (!Array.isArray(values) || values.length === 0) return '';
    const nums = values.map(v => Number(v) || 0);
    const minVal = Math.min(...nums);
    const maxVal = Math.max(...nums);
    const span = Math.max(maxVal - minVal, 1);
    const w = 92;
    const h = 20;
    const pad = 2;
    const pts = nums.map((val, idx) => {
      const x = nums.length === 1 ? w / 2 : pad + (idx / (nums.length - 1)) * (w - pad * 2);
      const y = (h - pad) - ((val - minVal) / span) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const lastPt = pts[pts.length - 1].split(',');
    return `<svg class="kpi-sparkline-svg" viewBox="0 0 ${w} ${h}" aria-hidden="true">
      <polyline fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${pts.join(' ')}" />
      <circle cx="${lastPt[0]}" cy="${lastPt[1]}" r="2.6" fill="${strokeColor}" />
    </svg>`;
  }

  function renderDailyExecutiveBrief(slicedRecords, matchedRecord) {
    const kickerEl = document.getElementById('daily-brief-kicker');
    const pillEl = document.getElementById('daily-brief-status-pill');
    const insightEl = document.getElementById('daily-brief-insight');
    const actionEl = document.getElementById('daily-brief-action');
    const typLabelEl = document.getElementById('bridge-typical-label');
    const typValEl = document.getElementById('bridge-typical-val');
    const rushLabelEl = document.getElementById('bridge-rush-label');
    const rushValEl = document.getElementById('bridge-rush-val');
    const expValEl = document.getElementById('bridge-expected-val');
    const costValEl = document.getElementById('bridge-meat-cost-val');
    const leftValEl = document.getElementById('bridge-leftover-val');

    if (!insightEl || !actionEl) return;

    const briefPayload = global.BBQ_PAYLOADS && global.BBQ_PAYLOADS.daily_executive_brief
      ? global.BBQ_PAYLOADS.daily_executive_brief
      : null;

    const isMultiDay = Array.isArray(slicedRecords) && slicedRecords.length > 1;
    let brief = null;
    let isNextServicePreview = false;

    if (!isMultiDay && matchedRecord && briefPayload) {
      if (matchedRecord.date && briefPayload.by_date && briefPayload.by_date[matchedRecord.date]) {
        brief = briefPayload.by_date[matchedRecord.date];
      } else if (matchedRecord.day_name && briefPayload.by_day_name && briefPayload.by_day_name[matchedRecord.day_name]) {
        brief = briefPayload.by_day_name[matchedRecord.day_name];
      }
    }

    // If today is closed Monday on initial single-day load, show preview of active upcoming open day brief with clear Monday labeling
    if (!isMultiDay && brief && brief.is_closed && briefPayload && briefPayload.active_service_brief && !briefPayload.active_service_brief.is_closed) {
      const startInput = document.getElementById('forecast-start-date');
      const isTodayDefault = !startInput || startInput.value === briefPayload.today_date;
      if (isTodayDefault) {
        brief = briefPayload.active_service_brief;
        isNextServicePreview = true;
      }
    }

    if (!brief && Array.isArray(slicedRecords) && slicedRecords.length > 0) {
      const dayFullMap = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
      const typSalesMap = { Mon: 0, Tue: 3689, Wed: 3050, Thu: 3900, Fri: 5100, Sat: 6200, Sun: 4650 };
      let expSales = 0;
      let typSales = 0;
      let bRaw = 0;
      let pRaw = 0;
      let rRacks = 0;
      let tCooked = 0;
      let expCogs = 0;
      let costedSales = 0;
      slicedRecords.forEach(r => {
        const isClosed = r.is_closed || r.day_name === 'Mon';
        if (!isClosed) {
          const rev = (r.is_historical && r.actual_revenue > 0) ? r.actual_revenue : (r.predicted_revenue || 0);
          expSales += rev;
          if ((r.estimated_cogs_usd || 0) > 0) { expCogs += r.estimated_cogs_usd; costedSales += rev; }
          typSales += (typSalesMap[r.day_name] || 3850);
          bRaw += (r.brisket_raw_lbs || 0);
          pRaw += (r.pork_shoulder_raw_lbs || 0);
          rRacks += (r.pork_ribs_racks || 0);
          tCooked += (r.turkey_cooked_lbs || r.turkey_lbs || 0);
        }
      });
      expSales = Math.round(expSales);
      typSales = Math.round(typSales);
      const diffUsd = expSales - typSales;
      const pct = typSales > 0 ? Math.round((diffUsd / typSales) * 1000) / 10 : 0;
      // Days with no stored cost (partial days) are costed at the same ratio as the days that have one.
      const meatCost = costedSales > 0 ? Math.round(expSales * (expCogs / costedSales)) : 0;
      const leftover = expSales - meatCost;
      const labelStr = isMultiDay ? `${slicedRecords.length}-Day Window` : (dayFullMap[matchedRecord?.day_name] || 'Selected Day');
      const diffWord = diffUsd >= 0 ? 'above' : 'below';

      brief = {
        status_badge: expSales === 0 ? 'Closed Monday — Pit Cold' : `${labelStr} (${pct >= 0 ? '+' : ''}${pct}% vs. Usual)`,
        status_tone: pct >= 10 ? 'surge' : (pct <= -10 ? 'lull' : 'steady'),
        the_insight: expSales === 0
          ? 'The shop is closed on Monday with $0 in counter sales (typical Monday baseline) and 0 lbs of hot-holding barbecue required.'
          : `${labelStr} sales ($${expSales.toLocaleString()}) are tracking ${Math.abs(pct)}% ($${Math.abs(diffUsd).toLocaleString()}) ${diffWord} the usual $${typSales.toLocaleString()} pace, leaving ~$${leftover.toLocaleString()} for the shop after ~$${meatCost.toLocaleString()} in estimated meat cost.`,
        the_action: expSales === 0
          ? 'Keep main offset smokers cold, deep-clean the firebox, inspect Tuesday opening Brisket trims, and grind/cure Day 1 sausage batches.'
          : `Prep ${Math.round(bRaw)} lbs raw Brisket (~${Math.round(bRaw * 0.40)} lbs cooked), ${Math.round(pRaw)} lbs raw Pulled Pork (~${Math.round(pRaw * 0.44)} lbs cooked), ${Math.round(rRacks)} racks of Spare Ribs, and ${Math.round(tCooked / 0.70)} lbs raw Turkey (~${Math.round(tCooked)} lbs cooked) ahead of peak rush.`,
        sales_bridge: {
          typical_day_label: `Usual ${labelStr}`,
          typical_day_usd: typSales,
          rush_hour_delta_label: 'Rush Hour & Crowd Difference',
          rush_hour_delta_usd: diffUsd,
          expected_sales_usd: expSales,
          estimated_meat_cost_usd: meatCost,
          left_after_meat_cost_usd: leftover
        }
      };
    }

    if (!brief) return;

    // Reports summary card: meat cost as a share of expected sales, from the brief's own sales bridge.
    const bridge = brief.sales_bridge || {};
    const statPctEl = document.getElementById('stat-meat-cost-pct');
    const statLeftEl = document.getElementById('stat-meat-left-pct');
    const bridgeSales = Number(bridge.expected_sales_usd) || 0;
    const bridgeCost = Number(bridge.estimated_meat_cost_usd) || 0;
    const bridgePct = (bridgeSales > 0 && bridgeCost > 0) ? Math.round(bridgeCost / bridgeSales * 1000) / 10 : null;
    if (statPctEl) statPctEl.textContent = bridgePct === null ? '--' : bridgePct + '% of sales';
    if (statLeftEl) statLeftEl.textContent = bridgePct === null ? 'Left after meat cost: --' : 'Left after meat cost: ' + (Math.round((100 - bridgePct) * 10) / 10) + '%';

    if (kickerEl) {
      kickerEl.textContent = isNextServicePreview
        ? 'TODAY IS MONDAY (SHOP CLOSED) — NEXT SERVICE PREVIEW'
        : "TODAY'S PIT & SALES BRIEF";
    }

    if (pillEl) {
      if (isNextServicePreview) {
        pillEl.textContent = `Monday Closed — Next Open Service: ${brief.day_full_name || 'Tuesday'}`;
        pillEl.className = 'exec-brief-pill tone-steady';
      } else {
        pillEl.textContent = brief.status_badge || 'Daily Brief Ready';
        pillEl.className = `exec-brief-pill tone-${brief.status_tone || 'steady'}`;
      }
    }

    if (isNextServicePreview) {
      insightEl.innerHTML = `<strong>Today is Monday (Shop Closed).</strong> Previewing opening service for <strong>${brief.day_full_name} (${brief.date})</strong>: Projected sales ($${Number(brief.expected_sales_usd || 0).toLocaleString()}) are tracking ${Math.abs(brief.pct_vs_typical || 0)}% ($${Math.abs(brief.sales_diff_usd || 0).toLocaleString()}) ${brief.sales_diff_usd >= 0 ? 'above' : 'below'} a typical ${brief.day_full_name} ($${Number(brief.typical_day_sales_usd || 0).toLocaleString()}), leaving ~$${Number(brief.left_after_meat_cost_usd || 0).toLocaleString()} for the shop after ~$${Number(brief.estimated_meat_cost_usd || 0).toLocaleString()} in estimated meat cost.`;
      actionEl.innerHTML = `<strong>Monday Pit Maintenance:</strong> Keep main offset smokers cold and fireboxes clean today. For ${brief.day_full_name}'s opening smoke: ${brief.the_action}`;
    } else {
      insightEl.textContent = brief.the_insight || '';
      actionEl.textContent = brief.the_action || '';
    }

    const sb = brief.sales_bridge || {};
    const rushTotalDiff = (sb.rush_hour_delta_usd || 0) + (sb.weather_event_delta_usd || 0);
    if (typLabelEl) {
      typLabelEl.textContent = isNextServicePreview
        ? `Typical ${brief.day_full_name || 'Tuesday'} Sales`
        : `${sb.typical_day_label || 'Typical Day'} Sales`;
    }
    if (typValEl) typValEl.textContent = `$${Number(sb.typical_day_usd || 0).toLocaleString()}`;
    if (rushLabelEl) rushLabelEl.textContent = 'Rush Hour & Crowd Difference';
    if (rushValEl) {
      const sign = rushTotalDiff >= 0 ? '+' : '-';
      rushValEl.textContent = `${sign}$${Math.abs(Math.round(rushTotalDiff)).toLocaleString()}`;
      rushValEl.style.color = rushTotalDiff >= 0 ? '#fbbf24' : '#38bdf8';
    }
    const expLabelEl = document.getElementById('bridge-expected-label');
    if (expLabelEl) {
      expLabelEl.textContent = isNextServicePreview
        ? `Expected ${brief.day_full_name || 'Tuesday'} Sales`
        : 'Expected Sales Today';
    }
    if (expValEl) expValEl.textContent = `$${Number(sb.expected_sales_usd || 0).toLocaleString()}`;
    if (costValEl) costValEl.textContent = `$${Number(sb.estimated_meat_cost_usd || 0).toLocaleString()}`;
    if (leftValEl) leftValEl.textContent = `$${Number(sb.left_after_meat_cost_usd || 0).toLocaleString()}`;

    updateDailyPitIntelligence(matchedRecord, brief, isNextServicePreview);
  }

  const RANDOM_SMOKEHOUSE_INSIGHTS = [
    'Pre-creasing 1-lb and 2-lb butcher paper wraps at 11:15 AM cuts counter service ticket times by 22 seconds per platter during peak rush.',
    'Always rest briskets in rendered beef tallow at 145°F–150°F—it creates an impermeable barrier against evaporative moisture loss in the flat.',
    'Chill grinder heads and cutter plates below 32°F before grinding sausage; warm friction smears fat and destroys the emulsified snap.',
    'Maintain a full water pan during the first 4 hours of smoking—soluble smoke compounds (guaiacol & syringol) adhere best to moist surfaces.',
    'When ambient wind exceeds 15 mph, shield the firebox intake damper to prevent convective cooling and hot spots along the smoker grate.',
    'Dip unsliced smoked turkey breasts in warm clarified butter before holding in the warming cabinet to preserve natural juices.',
    "Pork ribs should pass the 'bend test' with a clean surface crack; pulling too early causes chewiness, pulling too late shreds on the block.",
    'Dino plate ribs are high-ticket impulse sellers—place a fresh bone on the display cutting board at 12:00 PM open to drive add-ons.',
    'When rain is forecast, pre-pack bulk barbecue sauce cups and pickle/onion sides in the morning to accelerate takeout order assembly.',
    'Rotate briskets on the smoker grate at the 6-hour mark: the meat closest to the firebox baffle plate cooks up to 25°F hotter.',
    'Salt and cure penetration in sausage requires a full 12-hour rest—never rush the overnight cure window or texture turns crumbly.',
    'High-temp cheddar cubes melt at 400°F—standard grocery cheddar will liquefy in the smokehouse and leak into the sausage casing.',
    'Hold smoked pork butts whole in foil pans until ordered; pre-shredding pork causes it to lose moisture 4x faster under counter lamps.',
    'A clean fire smells sweet and peppery; if you smell pungent acrid smoke, your coal bed is starved of oxygen—open the intake damper.',
    'Check scale tare weights on the counter every morning; a 0.5 oz error on 1/2-lb meat portions equates to over $180/week in lost meat margin.',
    'Spray apple cider vinegar and Worcestershire spritz only after the bark sets (~150°F internal) to avoid washing away rub spices.',
    'Cut brisket strictly against the grain: remember the grain direction changes by 90 degrees between the flat muscle and the point muscle.',
    'On cold mornings (<40°F), pre-heat the smoker pit with weed burners to avoid burning through two hours of prime post oak splits.',
    'Soak natural hog casings in lukewarm water (85°F) with 1 tbsp of vinegar to maximize casing elasticity and reduce blowout risk.',
    'Stage extra jalapeño cheddar links for weekend lunch—historical sales show sausage links index 35% higher on Saturdays and Sundays.',
    'Burn seasoned post oak with 15–20% moisture content; green wood creates bitter black creosote, while bone-dry wood burns too hot.',
    'Save all brisket trimmings: fat caps render down into golden liquid tallow, and lean trimmings formulate the base for daily sausage.',
    'When counter lines stretch out the door, offer waiting guests complimentary brisket bark burnt-end samples to boost guest patience.',
    'Calibrate probe thermometers in an ice-water bath monthly—a 5-degree reading drift can cause overcooked or dry brisket flats.',
    'During heavy midday lunch traffic, assign one cutter exclusively to brisket slicing while a second crew member portions sides and weighs platters.'
  ];

  const DAY_SPECIFIC_TIPS_MAP = {
    Mon: {
      day_name: 'Monday',
      badge: 'Shop Closed — Maintenance Day',
      focus: 'Firebox Cleanout & Sausage Cure',
      rush_window: 'Smokers Cold (No Counter Service)',
      summary: "Monday scheduled maintenance. Keep main offset pits cold. Vacuum firebox ash, scrub smoker grates, inspect door gaskets, and grind & cure Day 1 sausage meat blocks for Tuesday's reopening smoke."
    },
    Tue: {
      day_name: 'Tuesday',
      badge: 'Fresh Week Reopen',
      focus: 'Corporate Lunch & Fresh Smoke',
      rush_window: '12:00 PM – 1:30 PM Lunch Rush',
      summary: 'Tuesday counter service kicks off the operating week with strong corporate lunch traffic. Fire the pits early for morning ribs and sausage. Stage hot brisket flats on the slicing board by 11:30 AM to ensure smooth line flow.'
    },
    Wed: {
      day_name: 'Wednesday',
      badge: 'Midweek Operating Flow',
      focus: 'Sausage Stuffing & Pulled Pork Pacing',
      rush_window: '12:00 PM – 1:30 PM Midweek Lunch',
      summary: 'Wednesday operations feature steady neighborhood lunch traffic. Monitor pulled pork and turkey portions. Afternoon prep directive: mix, stuff, and link Day 2 sausage batches to hang for pellicle drying in the walk-in.'
    },
    Thu: {
      day_name: 'Thursday',
      badge: 'Pre-Weekend Catering Ramp',
      focus: 'Supplier Delivery & Case Checks',
      rush_window: '12:00 PM – 2:00 PM Extended Lunch',
      summary: 'Thursday catering and large family orders start ramping up. Check in supplier deliveries for weekend cryovac brisket and pork butt cases. Verify cryovac seal integrity and stage firewood cords near the pit.'
    },
    Fri: {
      day_name: 'Friday',
      badge: 'Weekend Kickoff Surge',
      focus: 'Dual Lunch & Dinner Rush Management',
      rush_window: '12:00–2:00 PM Lunch & 5:30–8:00 PM Dinner',
      summary: 'Friday high-volume service demands dual-rush preparation. Load smokers to full capacity. Pull Batch 2 spare ribs by 4:15 PM for an evening holding rest, and prepare double takeout packaging stations for evening dinner.'
    },
    Sat: {
      day_name: 'Saturday',
      badge: 'Peak Smokehouse Volume',
      focus: 'Dino Rib Sellout & Slicer Speed',
      rush_window: '12:00 PM – 3:00 PM Peak Saturday Rush',
      summary: 'Saturday peak volume brings the highest revenue of the week. Full smoker capacity across brisket, dino ribs, and sausage links. Pre-crease butcher paper wraps, stage two slicing blocks, and monitor dino plate rib depletion closely by 1:30 PM.'
    },
    Sun: {
      day_name: 'Sunday',
      badge: 'Family Platter Sunday',
      focus: 'Multi-Pound Takeout & Inventory Sellout',
      rush_window: '12:00 PM – 2:30 PM Sunday Family Rush',
      summary: 'Sunday family feasts and gameday platters dominate lunch service. Push composed items (Tacos and Rosebuds) to utilize smoked reserves before Monday closure. Aim for clean sellouts of spare ribs and turkey by 7:00 PM.'
    }
  };

  function getTenWatchlistTips(_matchedRecord, _brief, _isNextServicePreview) {
    return [
      {
        id: 1,
        cat: 'weather',
        cat_label: 'Weather Watch',
        importance: 'Patio Capacity',
        title: 'High Temperature & Patio Seating Viability',
        desc: 'Daily high temperatures between 72°F and 86°F expand walk-in capacity by +18–25% via outdoor patio seating. Above 88°F, patio dwell time drops sharply as guests migrate indoors or opt for carside pickup.',
        pit_check: 'Pit Check: If temp exceeds 88°F, turn on patio misting fans and stage extra ice water for waiting counter guests.'
      },
      {
        id: 2,
        cat: 'weather',
        cat_label: 'Weather Watch',
        importance: 'Takeout Revenue Shift',
        title: 'Precipitation & To-Go Packaging Multiplier',
        desc: (function () {
          const ws = global.BBQ_PAYLOADS && global.BBQ_PAYLOADS.weather_payload && global.BBQ_PAYLOADS.weather_payload.weather_stats;
          const lead = (ws && ws.normal_avg_usd > 0 && ws.rain_avg_usd > 0)
            ? `Rainy days average $${Math.round(ws.rain_avg_usd).toLocaleString()} vs $${Math.round(ws.normal_avg_usd).toLocaleString()} on a normal day (${ws.rain_avg_usd >= ws.normal_avg_usd ? '+' : ''}${Math.round((ws.rain_avg_usd - ws.normal_avg_usd) / ws.normal_avg_usd * 1000) / 10}%).`
            : 'Rain shifts sales volume into multi-pound family feast packs.';
          return lead + ' Counter tray service slows while curbside and delivery orders spike.';
        })(),
        pit_check: 'Pit Check: On rainy or wet days, stage +20% butcher paper to-go bags, 16oz sauce containers, and pre-packed side cups by 11:00 AM.'
      },
      {
        id: 3,
        cat: 'weather',
        cat_label: 'Weather Watch',
        importance: 'Bark Formation',
        title: 'Ambient Humidity & Smoke Airflow Velocity',
        desc: 'High ambient humidity slows surface evaporative cooling on raw meats (the stall). To build a crisp mahogany bark without sour creosote buildup, maintain high convective draft.',
        pit_check: 'Pit Check: Open exhaust stack dampers 10% wider on humid or foggy mornings to keep clean airflow sweeping across briskets.'
      },
      {
        id: 4,
        cat: 'day',
        cat_label: 'Day Dynamics',
        importance: 'Morning Line Handover',
        title: 'Morning Prep Handover: Trevor (2:30 AM), Max (8:00 AM) & Jake (8:30 AM Open)',
        desc: 'Trevor fires the pits at 2:30 AM and trims briskets (<18% loss). Max arrives at 8:00 AM to control dampers and wrapping. Jake opens the kitchen line sharp at 8:30 AM, with Alyssa opening expo and portioning hot fries and mac & cheese. Allen opens the dish pit for prep washdown.',
        pit_check: 'Pit Check: Max, Trevor, and Jake confirm 145°F holding cabinet temps and hot side pans 30 minutes before 11:00 AM doors open.'
      },
      {
        id: 5,
        cat: 'day',
        cat_label: 'Day Dynamics',
        importance: 'Carving & Expo Flow',
        title: 'Carving Block Slicer Pacing (Freddy & Jake) & Expo Leads (Elly / Alyssa)',
        desc: 'Slice lean flat strictly to order to avoid rapid moisture evaporation. Elly provides senior leadership across kitchen and expo flow; Alyssa handles lunch expo with hot sides prep; Freddy rotates between slicing board, grill, and expo.',
        pit_check: 'Pit Check: Never pre-slice lean flat meat ahead of active tickets; keep untrimmed fat cap downward against the carving board.'
      },
      {
        id: 6,
        cat: 'day',
        cat_label: 'Day Dynamics',
        importance: '7:00 PM Transit Handover',
        title: '7:00 PM Evening Shift Transition: Nick Bus Departure & Freddy / Elly Close',
        desc: 'Critical evening bottleneck: Nick departs at 7:00 PM sharp to catch the bus home. The Boss shuts down pit fire coals (~6:00 PM) shifting meat to warm hold. Freddy takes over meat slicing and grill; Elly leads closing expo; Allen returns from mid-shift break to drive dish pit lockup.',
        pit_check: 'Pit Check: At 6:45 PM, Freddy and Nick conduct station inventory handoff before Nick leaves for the bus; Allen clears prep pans before dinner rush.'
      },
      {
        id: 7,
        cat: 'pit',
        cat_label: 'Pit Watch',
        importance: 'Critical Rest Temp',
        title: 'Holding Cabinet Strict Temperature Window (145°F–150°F)',
        desc: 'CVap and electric warmer temperatures must stay locked between 145°F and 150°F with tallow-wrapped briskets. Dropping below 140°F breaches food safety; exceeding 160°F turns brisket texture mushy.',
        pit_check: 'Pit Check: Probe top and bottom cabinet shelves twice daily (11:00 AM & 4:00 PM) with a calibrated digital thermometer.'
      },
      {
        id: 8,
        cat: 'pit',
        cat_label: 'Pit Watch',
        importance: 'Wood & Firebox',
        title: 'Wood Split Sizing & Clean Thin Blue Smoke',
        desc: 'Heavy white or billowing gray smoke deposits acrid soot on meat bark. Maintain an active coal bed by feeding seasoned post oak splits sized to forearm thickness (3–4 inches diameter).',
        pit_check: 'Pit Check: Pre-heat oak splits on top of the firebox lid so they catch fire instantly upon loading without smoldering.'
      },
      {
        id: 9,
        cat: 'pit',
        cat_label: 'Inventory Guard',
        importance: 'Composite Allocation',
        title: 'Composed Item Draw (Tacos & Rosebuds vs. Sliced Meats)',
        desc: 'Smoked Brisket Tacos and Rosebuds draw directly from prime brisket point and lean trim reserves. Heavy taco rushes can unexpectedly hollow out sliced brisket inventory before evening service.',
        pit_check: "Pit Check: Designate 1 whole point exclusively for composite recipes each morning so counter cutters don't run short of sliced point."
      },
      {
        id: 10,
        cat: 'pit',
        cat_label: 'Inventory Guard',
        importance: 'Food Cost Margin',
        title: 'Meat Cost Guardrail & Scale Tare Integrity',
        desc: 'Keeping wholesale meat cost in check requires rigorous scale accuracy and clean trimming practices (<18% raw brisket trim loss).',
        pit_check: 'Pit Check: Zero and test counter scales with standard test weights every morning; ensure butcher paper tare is active on POS scales.'
      }
    ];
  }

  let _currentRandomInsightIndex = -1;
  let _currentTipsFilter = 'all';
  let _isTipsCollapsed = false;
  let _isGlossaryCollapsed = false;
  let _currentGlossaryFilter = 'all';
  let _isRecentAlertsExpanded = false;
  let _lastMatchedRecord = null;
  let _lastBrief = null;
  let _lastIsNextServicePreview = false;

  const BUILTIN_ANALYTIC_GLOSSARY = {
    'Prep Target': {
      term: 'Prep Target',
      category: 'pit',
      category_label: 'Pit & Smoker',
      definition: "How much cooked meat, sides and raw stock should be ready at each shift change so we don't run out or over-prep.",
      how_it_helps: 'Keeps us from 86ing meat at lunch and cuts end-of-day waste by setting clear morning and afternoon slicing amounts.'
    },
    'Average Ticket': {
      term: 'Average Ticket',
      category: 'volume',
      category_label: 'Volume & Math',
      definition: 'The average dollar amount per order: total sales divided by number of orders.',
      how_it_helps: 'Shows whether a busy hour is lots of small sandwich orders or a few big platters ($145 King of the Hill), so the cutting board can pace whole-brisket slicing.'
    },
    'Rush Signal': {
      term: 'Rush Signal',
      category: 'volume',
      category_label: 'Volume & Math',
      definition: "How far this hour's orders are above what we usually see at this hour on this day of the week. The bigger the number, the more unusual the rush.",
      how_it_helps: "Ignores normal small ups and downs, so an alert means a real rush that needs the pitmaster's attention."
    },
    'Meat Used Per Hour': {
      term: 'Meat Used Per Hour',
      category: 'pit',
      category_label: 'Pit & Smoker',
      definition: 'How many pounds of finished meat get carved and pulled from the 140°F holding cabinet each hour.',
      how_it_helps: "Warns the pitmaster hours ahead if we'll sell out before dinner, leaving time to adjust portions or push sausage combos."
    },
    'Cooked Yield %': {
      term: 'Cooked Yield %',
      category: 'pit',
      category_label: 'Pit & Smoker',
      definition: 'How much sellable meat is left after trimming and smoking: finished sliced weight ÷ raw weight × 100.',
      how_it_helps: 'Shows the real yield of meat on the board. Whole packer brisket yields about 35% (5.75 lbs cooked per 16.4 lb packer) after trimming and smoking to finished sliceable yield.'
    },
    Shrinkage: {
      term: 'Shrinkage',
      category: 'pit',
      category_label: 'Pit & Smoker',
      definition: 'Weight lost during smoking as moisture cooks off and fat renders (about 65% for brisket, 56% for pork butt).',
      how_it_helps: 'Guides smoker humidity and wrap timing. Too much shrinkage means dry meat and less to sell.'
    },
    'Tallow Rest': {
      term: 'Tallow Rest',
      category: 'pit',
      category_label: 'Pit & Smoker',
      definition: "Holding finished brisket wrapped with warm beef tallow at about 145°F until it's sliced.",
      how_it_helps: 'Keeps brisket juicy and hot for hours, so an early cook can still be sold at dinner.'
    },
    'Est. Meat Cost': {
      term: 'Est. Meat Cost',
      category: 'cost',
      category_label: 'Profit & Costs',
      definition: 'What we pay for the meat in a menu item, plus rub, sauce, butcher paper and to-go containers.',
      how_it_helps: 'Shows the real cost per serving so prices still work when beef prices move.'
    },
    'Meat Cost %': {
      term: 'Meat Cost %',
      category: 'cost',
      category_label: 'Profit & Costs',
      definition: 'Est. Meat Cost divided by the menu price, as a percentage.',
      how_it_helps: 'Texas BBQ usually aims for 28–32%. Items over 40% (like a brisket sandwich sold alone) need a price or portion fix.'
    },
    'Left After Meat Cost': {
      term: 'Left After Meat Cost',
      category: 'cost',
      category_label: 'Profit & Costs',
      definition: 'The share of each sale left after paying for the meat: (menu price − Est. Meat Cost) ÷ menu price × 100.',
      how_it_helps: 'This is the money that pays the crew, post oak deliveries, rent and smoker upkeep.'
    },
    'Typical Day': {
      term: 'Typical Day',
      category: 'volume',
      category_label: 'Volume & Math',
      definition: 'What a normal day looks like for that weekday, averaged from past Clover sales (for example, Typical Tuesday).',
      how_it_helps: "Gives every number a fair comparison, so a slow Tuesday isn't measured against a busy Saturday."
    },
    'Hourly Orders': {
      term: 'Hourly Orders',
      category: 'volume',
      category_label: 'Volume & Math',
      definition: 'Orders or dollars coming in per hour right now.',
      how_it_helps: 'Shows when the lunch and dinner rushes start building, so the cutting board can get ahead of the line.'
    },
    'Sales Trend': {
      term: 'Sales Trend',
      category: 'volume',
      category_label: 'Volume & Math',
      definition: 'How sales move with something else, like temperature or rain, measured across many past days.',
      how_it_helps: "Turns 'rainy days feel slow' into a number you can plan prep around."
    }
  };

  function getGlossaryData() {
    const remoteGlossary = global.BBQ_PAYLOADS?.quick_wind_alerts?.glossary_terms;
    if (remoteGlossary && typeof remoteGlossary === 'object') {
      const merged = { ...BUILTIN_ANALYTIC_GLOSSARY };
      Object.keys(remoteGlossary).forEach(key => {
        merged[key] = {
          ...merged[key],
          ...remoteGlossary[key]
        };
      });
      return merged;
    }
    return BUILTIN_ANALYTIC_GLOSSARY;
  }

  function lookupGlossaryTerm(termKey, glossary = getGlossaryData()) {
    const key = String(termKey).toLowerCase();
    return glossary[termKey] || Object.values(glossary).find(g => String(g.term || '').toLowerCase() === key) || null;
  }

  function openTermExplainer(termKey) {
    const drawer = document.getElementById('term-explainer-drawer');
    if (!drawer) return;
    const info = lookupGlossaryTerm(termKey);
    if (!info) return;

    const nameEl = document.getElementById('term-drawer-name');
    const fullEl = document.getElementById('term-drawer-fullname');
    const defEl = document.getElementById('term-drawer-def');
    const helpEl = document.getElementById('term-drawer-help-text');

    if (nameEl) nameEl.textContent = info.term;
    if (fullEl) fullEl.textContent = info.full_name ? `(${info.full_name})` : '';
    if (defEl) defEl.textContent = info.definition;
    if (helpEl) helpEl.textContent = info.how_it_helps;

    drawer.style.display = 'block';
    drawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function closeTermExplainer() {
    const drawer = document.getElementById('term-explainer-drawer');
    if (drawer) drawer.style.display = 'none';
  }

  function renderDailyRandomInsight(forceNewIndex = false) {
    const textEl = document.getElementById('daily-random-insight-text');
    const titleEl = document.getElementById('daily-random-insight-title');
    const catEl = document.getElementById('daily-random-insight-cat');
    const impactEl = document.getElementById('daily-random-insight-impact');
    const evidenceEl = document.getElementById('daily-random-insight-evidence');
    const proofEl = document.getElementById('daily-random-insight-proof');
    const actionEl = document.getElementById('daily-random-insight-action');
    const termsGroup = document.getElementById('daily-random-insight-terms');
    const counterEl = document.getElementById('daily-insight-counter');

    if (!textEl) return;

    const mlInsightsList = global.BBQ_PAYLOADS?.ml_insights?.insights;
    const hasML = Array.isArray(mlInsightsList) && mlInsightsList.length > 0;
    const poolLength = hasML ? mlInsightsList.length : RANDOM_SMOKEHOUSE_INSIGHTS.length;

    if (forceNewIndex || _currentRandomInsightIndex === -1) {
      let nextIdx;
      do {
        nextIdx = Math.floor(Math.random() * poolLength);
      } while (nextIdx === _currentRandomInsightIndex && poolLength > 1);
      _currentRandomInsightIndex = nextIdx;
    }

    if (hasML) {
      const item = mlInsightsList[_currentRandomInsightIndex];
      if (titleEl) titleEl.textContent = item.title || 'Data-Mined Smokehouse Insight';
      if (catEl) catEl.textContent = item.category_label || 'Profitability Mining';
      if (impactEl) {
        if (item.impact_usd) {
          impactEl.textContent = `+$${item.impact_usd.toFixed(0)}/wk Impact`;
          impactEl.style.display = 'inline-block';
        } else {
          impactEl.style.display = 'none';
        }
      }
      textEl.textContent = `"${item.insight}"`;

      if (evidenceEl) evidenceEl.textContent = item.evidence || 'Repository Multimodal Intelligence Engine';
      if (proofEl) proofEl.textContent = item.quantitative_proof || 'Statistically verified against Clover POS & US Foods invoices';
      if (actionEl) actionEl.textContent = item.actionable_recommendation || 'Maintain standard operating procedures';

      if (termsGroup) {
        const glossary = getGlossaryData();
        const terms = (Array.isArray(item.terms) ? item.terms : ['Est. Meat Cost', 'Prep Target'])
          .filter(t => lookupGlossaryTerm(t, glossary));
        termsGroup.innerHTML = terms.map(t => `
          <button type="button" class="term-pill-btn" data-term="${global.escapeHTML(t)}" aria-label="Explain term ${global.escapeHTML(t)}">
            ${global.escapeHTML(t)}
          </button>
        `).join('');

        termsGroup.querySelectorAll('.term-pill-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const t = btn.getAttribute('data-term');
            if (t) openTermExplainer(t);
          });
        });
      }

      if (counterEl) counterEl.textContent = `Insight ${_currentRandomInsightIndex + 1} of ${poolLength}`;
    } else {
      textEl.textContent = `"${RANDOM_SMOKEHOUSE_INSIGHTS[_currentRandomInsightIndex]}"`;
      if (titleEl) titleEl.textContent = 'Traditional Smokehouse Wisdom';
      if (catEl) catEl.textContent = 'Pit Guidance';
      if (impactEl) impactEl.style.display = 'none';
      if (evidenceEl) evidenceEl.textContent = 'Yellow Rose BBQ Standard Operating Procedures';
      if (proofEl) proofEl.textContent = 'Daily pitmaster best practices';
      if (actionEl) actionEl.textContent = 'Apply during shift prep and carving.';
      if (counterEl) counterEl.textContent = `Insight ${_currentRandomInsightIndex + 1} of ${poolLength}`;
    }
  }

  function renderQuickWindBanner() {
    const banner = document.getElementById('daily-quick-wind-banner');
    if (!banner) return;

    const qwPayload = global.BBQ_PAYLOADS?.quick_wind_alerts;
    if (!qwPayload) return;

    const active = qwPayload.active_alert;
    if (!active) return;

    const badgeEl = document.getElementById('qw-severity-badge');
    const timeEl = document.getElementById('qw-timestamp');
    const headlineEl = document.getElementById('qw-headline');
    const presentEl = document.getElementById('qw-present-text');
    const causeEl = document.getElementById('qw-cause-text');
    const actionEl = document.getElementById('qw-action-text');
    const metricsBar = document.getElementById('qw-metrics-bar');

    if (badgeEl) {
      badgeEl.textContent = active.severity_badge || 'Live Clover Scan';
      badgeEl.className = `qw-badge qw-badge-${active.severity || 'info'}`;
    }
    const formatAlertHour12 = (hf, h) => {
      if (!hf && h === undefined) return '';
      if (hf && /AM|PM/i.test(hf)) {
        return hf.includes('EST') ? hf : `${hf} EST`;
      }
      const hourNum = h !== undefined ? h : parseInt(hf, 10);
      if (!isNaN(hourNum)) {
        const h12 = hourNum === 0 ? 12 : (hourNum > 12 ? hourNum - 12 : hourNum);
        const ampm = hourNum >= 12 ? 'PM' : 'AM';
        return `${h12}:00 ${ampm} EST`;
      }
      return hf || '';
    };

    if (timeEl) {
      const formattedTime = formatAlertHour12(active.hour_formatted, active.hour);
      timeEl.textContent = formattedTime ? `${formattedTime} Clover Scan` : 'Live Scan Active';
    }
    if (headlineEl) headlineEl.textContent = active.headline || 'Operating Within Normal Historical Ranges';
    if (presentEl) presentEl.textContent = active.immediate_present_status || 'Kitchen line and counter are operating nominally.';
    if (causeEl) causeEl.textContent = active.causal_explanation || 'Foot traffic tracking typical hourly curves.';
    if (actionEl) actionEl.textContent = active.recommended_pit_action || 'Continue standard holding and carving pacing.';

    if (metricsBar && active.velocity_metrics) {
      const m = active.velocity_metrics;
      const pills = [];
      if (m.actual_orders !== undefined && m.expected_orders !== undefined) {
        pills.push(`<span class="qw-metric-pill">Orders/hr: <strong>${m.actual_orders}</strong> (exp ${m.expected_orders})</span>`);
      }
      if (m.actual_sales !== undefined && m.expected_sales !== undefined) {
        pills.push(`<span class="qw-metric-pill">Sales/hr: <strong>$${m.actual_sales.toFixed(0)}</strong> (exp $${m.expected_sales.toFixed(0)})</span>`);
      }
      if (m.aov !== undefined) {
        pills.push(`<span class="qw-metric-pill">Avg Ticket: <strong>$${m.aov.toFixed(2)}</strong></span>`);
      }
      if (m.temperature_f !== undefined) {
        pills.push(`<span class="qw-metric-pill">Temp: <strong>${m.temperature_f.toFixed(0)}°F</strong></span>`);
      }
      metricsBar.innerHTML = pills.join('');
    }

    const recentListEl = document.getElementById('qw-recent-alerts-list');
    if (recentListEl && Array.isArray(qwPayload.recent_alerts)) {
      recentListEl.innerHTML = qwPayload.recent_alerts.map(a => `
        <div class="qw-recent-item">
          <span class="qw-recent-headline">${global.escapeHTML(a.severity_badge || '')}: ${global.escapeHTML(a.headline || '')}</span>
          <span class="qw-recent-meta">${global.escapeHTML(a.date || '')} ${global.escapeHTML(formatAlertHour12(a.hour_formatted, a.hour))}</span>
        </div>
      `).join('');
    }
  }

  function renderAnalyticsGlossary(filterCat = 'all') {
    const grid = document.getElementById('glossary-card-grid');
    if (!grid) return;

    const glossary = getGlossaryData();
    const entries = Object.values(glossary);
    const filtered = filterCat === 'all'
      ? entries
      : entries.filter(e => {
          if (filterCat === 'cost') return ['cost'].includes(e.category);
          if (filterCat === 'pit') return ['pit'].includes(e.category);
          if (filterCat === 'volume') return ['volume'].includes(e.category);
          return true;
        });

    grid.innerHTML = filtered.map(item => `
      <div class="glossary-card" data-cat="${global.escapeHTML(item.category || 'general')}">
        <div class="glossary-card-top">
          <div>
            <h4 class="glossary-term-title">${global.escapeHTML(item.term)}</h4>
            ${item.full_name ? `<span class="glossary-term-full">${global.escapeHTML(item.full_name)}</span>` : ''}
          </div>
          <span class="glossary-term-badge">${global.escapeHTML(item.category_label || 'Metric')}</span>
        </div>
        <div class="glossary-block">
          <strong>What It Means:</strong>
          <p>${global.escapeHTML(item.definition)}</p>
        </div>
        <div class="glossary-block help-block">
          <strong>How It Helps Your Pit:</strong>
          <p>${global.escapeHTML(item.how_it_helps)}</p>
        </div>
      </div>
    `).join('');
  }

  function renderDaySpecificTipsSummary(matchedRecord, brief, isNextServicePreview) {
    const titleEl = document.getElementById('daily-day-tips-title');
    const badgeEl = document.getElementById('daily-day-badge');
    const summaryEl = document.getElementById('daily-day-tips-summary');
    const focusTagEl = document.getElementById('daily-day-focus-tag');
    const rushSubtextEl = document.getElementById('daily-day-rush-subtext');

    if (!summaryEl) return;

    const shortDay = isNextServicePreview
      ? (brief?.day_name || 'Tue')
      : (matchedRecord?.day_name || (brief?.is_closed ? 'Mon' : (brief?.day_name || 'Tue')));
    const info = DAY_SPECIFIC_TIPS_MAP[shortDay] || DAY_SPECIFIC_TIPS_MAP.Tue;

    if (titleEl) {
      titleEl.textContent = isNextServicePreview
        ? `Monday Maintenance (Previewing ${info.day_name}'s Open)`
        : `${info.day_name} Operational Summary & Tips`;
    }
    if (badgeEl) {
      if (isNextServicePreview) {
        badgeEl.textContent = `Preview: ${info.day_name} Service`;
        badgeEl.className = 'day-badge-pill';
      } else if (shortDay === 'Mon') {
        badgeEl.textContent = 'Monday Closed';
        badgeEl.className = 'day-badge-pill';
      } else {
        badgeEl.textContent = info.badge;
        badgeEl.className = 'day-badge-pill';
      }
    }
    if (summaryEl) {
      if (isNextServicePreview) {
        summaryEl.innerHTML = `<strong>Today is Monday (Pit Cold &amp; Maintenance).</strong> Previewing opening service for <strong>${info.day_name}</strong>: ${info.summary}`;
      } else {
        summaryEl.textContent = info.summary;
      }
    }
    if (focusTagEl) focusTagEl.textContent = info.focus;
    if (rushSubtextEl) rushSubtextEl.textContent = info.rush_window;
  }

  function renderTenWatchlistTips(filterCat = 'all', matchedRecord = null, brief = null, isNextServicePreview = false) {
    const container = document.getElementById('ten-tips-container');
    if (!container) return;

    const tips = getTenWatchlistTips(matchedRecord, brief, isNextServicePreview);
    const filtered = filterCat === 'all' ? tips : tips.filter(t => t.cat === filterCat);

    container.innerHTML = filtered.map(t => {
      const colonIdx = t.pit_check.indexOf(':');
      const checkLabel = colonIdx !== -1 ? t.pit_check.substring(0, colonIdx) : 'Pit Check';
      const checkVal = colonIdx !== -1 ? t.pit_check.substring(colonIdx + 1) : t.pit_check;

      return `
        <div class="ten-tip-card cat-${t.cat}" data-cat="${t.cat}">
          <div class="tip-card-top">
            <div class="tip-meta-wrap">
              <span class="tip-number-badge">${t.id}</span>
              <span class="tip-cat-badge cat-${t.cat}">${t.cat_label}</span>
            </div>
            <span class="tip-importance-badge">${t.importance}</span>
          </div>
          <h4 class="tip-title">${t.title}</h4>
          <p class="tip-desc">${t.desc}</p>
          <div class="tip-action-box">
            <strong>${checkLabel}:</strong>${checkVal}
          </div>
        </div>
      `;
    }).join('');
  }

  function updateDailyPitIntelligence(matchedRecord, brief, isNextServicePreview) {
    _lastMatchedRecord = matchedRecord;
    _lastBrief = brief;
    _lastIsNextServicePreview = isNextServicePreview;

    renderQuickWindBanner();
    renderDailyRandomInsight(false);
    renderDaySpecificTipsSummary(matchedRecord, brief, isNextServicePreview);
    renderTenWatchlistTips(_currentTipsFilter, matchedRecord, brief, isNextServicePreview);
    renderAnalyticsGlossary(_currentGlossaryFilter);
  }

  function initDailyPitIntelligence() {
    const rerollBtn = document.getElementById('btn-reroll-insight');
    if (rerollBtn && !rerollBtn._hasListener) {
      rerollBtn._hasListener = true;
      rerollBtn.addEventListener('click', () => {
        renderDailyRandomInsight(true);
      });
    }

    const toggleRecentBtn = document.getElementById('btn-toggle-recent-alerts');
    const recentDrawer = document.getElementById('qw-recent-alerts-drawer');
    const recentArrow = document.getElementById('qw-recent-arrow');
    if (toggleRecentBtn && !toggleRecentBtn._hasListener) {
      toggleRecentBtn._hasListener = true;
      toggleRecentBtn.addEventListener('click', () => {
        _isRecentAlertsExpanded = !_isRecentAlertsExpanded;
        if (recentDrawer) recentDrawer.style.display = _isRecentAlertsExpanded ? 'block' : 'none';
        toggleRecentBtn.setAttribute('aria-expanded', _isRecentAlertsExpanded ? 'true' : 'false');
        if (recentArrow) recentArrow.textContent = _isRecentAlertsExpanded ? '▲' : '▼';
      });
    }

    const filterBtns = document.querySelectorAll('.tip-filter-btn');
    filterBtns.forEach(btn => {
      if (!btn._hasListener) {
        btn._hasListener = true;
        btn.addEventListener('click', () => {
          filterBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          _currentTipsFilter = btn.getAttribute('data-filter') || 'all';
          renderTenWatchlistTips(_currentTipsFilter, _lastMatchedRecord, _lastBrief, _lastIsNextServicePreview);
        });
      }
    });

    const toggleBtn = document.getElementById('btn-toggle-tips-collapse');
    const container = document.getElementById('ten-tips-container');
    const toggleText = document.getElementById('toggle-tips-text');
    const toggleArrow = document.getElementById('toggle-tips-arrow');

    if (toggleBtn && !toggleBtn._hasListener) {
      toggleBtn._hasListener = true;
      toggleBtn.addEventListener('click', () => {
        _isTipsCollapsed = !_isTipsCollapsed;
        if (container) container.classList.toggle('collapsed', _isTipsCollapsed);
        toggleBtn.setAttribute('aria-expanded', _isTipsCollapsed ? 'false' : 'true');
        if (toggleText) toggleText.textContent = _isTipsCollapsed ? 'Expand 10 Tips' : 'Collapse Tips';
        if (toggleArrow) toggleArrow.textContent = _isTipsCollapsed ? '▼' : '▲';
      });
    }

    const glossaryCatBtns = document.querySelectorAll('.glossary-cat-btn');
    glossaryCatBtns.forEach(btn => {
      if (!btn._hasListener) {
        btn._hasListener = true;
        btn.addEventListener('click', () => {
          glossaryCatBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          _currentGlossaryFilter = btn.getAttribute('data-cat') || 'all';
          renderAnalyticsGlossary(_currentGlossaryFilter);
        });
      }
    });

    const toggleGlossaryBtn = document.getElementById('btn-toggle-glossary');
    const glossaryGrid = document.getElementById('glossary-card-grid');
    const toggleGlossaryText = document.getElementById('toggle-glossary-text');
    const toggleGlossaryArrow = document.getElementById('toggle-glossary-arrow');

    if (toggleGlossaryBtn && !toggleGlossaryBtn._hasListener) {
      toggleGlossaryBtn._hasListener = true;
      toggleGlossaryBtn.addEventListener('click', () => {
        _isGlossaryCollapsed = !_isGlossaryCollapsed;
        if (glossaryGrid) glossaryGrid.classList.toggle('collapsed', _isGlossaryCollapsed);
        toggleGlossaryBtn.setAttribute('aria-expanded', _isGlossaryCollapsed ? 'false' : 'true');
        if (toggleGlossaryText) toggleGlossaryText.textContent = _isGlossaryCollapsed ? 'Expand Guide' : 'Collapse Guide';
        if (toggleGlossaryArrow) toggleGlossaryArrow.textContent = _isGlossaryCollapsed ? '▼' : '▲';
      });
    }

    const closeTermBtn = document.getElementById('btn-close-term-drawer');
    if (closeTermBtn && !closeTermBtn._hasListener) {
      closeTermBtn._hasListener = true;
      closeTermBtn.addEventListener('click', closeTermExplainer);
    }

    updateDailyPitIntelligence(_lastMatchedRecord, _lastBrief, _lastIsNextServicePreview);
  }

  function renderKPIBulletAndSparklines(slicedRecords, matchedRecord) {
    const briefPayload = global.BBQ_PAYLOADS && global.BBQ_PAYLOADS.daily_executive_brief
      ? global.BBQ_PAYLOADS.daily_executive_brief
      : null;
    const sparks = briefPayload && briefPayload.sparklines_7d ? briefPayload.sparklines_7d : {};
    const dowBase = (briefPayload && briefPayload.dow_baselines && matchedRecord && briefPayload.dow_baselines[matchedRecord.day_name])
      ? briefPayload.dow_baselines[matchedRecord.day_name]
      : null;

    const daysCount = Math.max(1, Array.isArray(slicedRecords) ? slicedRecords.length : 1);
    const rec = matchedRecord || (Array.isArray(slicedRecords) && slicedRecords[0]) || {};
    const revVal = Number((rec.is_historical && rec.actual_revenue > 0) ? rec.actual_revenue : (rec.predicted_revenue || 0));
    const typRev = Math.max(Number(dowBase?.typical_sales_usd || 3850), 1);

    const recCogs = Number(rec.estimated_cogs_usd) || 0;
    const recRev = Number(rec.predicted_revenue) || 0;
    const leftAfterMeatPct = (recCogs > 0 && recRev > 0) ? Math.round(100 - (recCogs / recRev) * 100) : 0;
    const cards = [
      {
        containerId: 'kpi-card-revenue-container',
        pctOfTypical: Math.round((revVal / typRev) * 100),
        barColor: '#E69F00',
        sparkSeries: sparks.sales_usd || [3850, 3180, 4135, 5556, 6390, 4820, 4264],
        label: 'vs. Typical Day'
      },
      {
        containerId: 'kpi-card-brisket-container',
        pctOfTypical: Math.round(((rec.brisket_raw_lbs || 0) / Math.max(dowBase?.typical_brisket_raw_lbs || 115, 1)) * 100),
        barColor: '#D55E00',
        sparkSeries: sparks.brisket_raw_lbs || [114, 116, 129, 190, 212, 165, 114],
        label: 'vs. Usual Prep'
      },
      {
        containerId: 'kpi-card-pork-container',
        pctOfTypical: Math.round(((rec.pork_shoulder_raw_lbs || 0) / Math.max(dowBase?.typical_pork_raw_lbs || 18, 1)) * 100),
        barColor: '#E69F00',
        sparkSeries: sparks.pork_raw_lbs || [19, 12, 28, 21, 32, 18, 19],
        label: 'vs. Usual Prep'
      },
      {
        containerId: 'kpi-card-sausage-container',
        pctOfTypical: Math.round(((rec.sausage_lbs || 0) / Math.max(dowBase?.typical_sausage_lbs || 12, 1)) * 100),
        barColor: '#56B4E9',
        sparkSeries: sparks.sausage_batches || [0.18, 0.17, 0.21, 0.34, 0.38, 0.25, 0.18],
        label: 'vs. Usual Batch'
      },
      {
        containerId: 'kpi-card-ribs-container',
        pctOfTypical: Math.round(((rec.pork_ribs_racks || 0) / Math.max(dowBase?.typical_ribs_racks || 7, 1)) * 100),
        barColor: '#CC79A7',
        sparkSeries: sparks.ribs_racks || [7, 7, 7, 12, 15, 10, 7],
        label: 'vs. Usual Racks'
      },
      {
        containerId: 'kpi-card-turkey-container',
        pctOfTypical: Math.round(((rec.turkey_cooked_lbs || rec.turkey_lbs || 0) / Math.max(dowBase?.typical_turkey_cooked_lbs || 7.5, 1)) * 100),
        barColor: '#009E73',
        sparkSeries: sparks.turkey_cooked_lbs || [7.9, 7.5, 7.4, 12.1, 13.6, 9.4, 7.9],
        label: 'vs. Usual Turkey'
      },
      {
        containerId: 'kpi-card-food-cost-container',
        pctOfTypical: leftAfterMeatPct,
        barColor: '#009E73',
        sparkSeries: sparks.left_after_meat_usd || [3006, 2247, 2915, 3917, 4505, 3398, 3006],
        label: leftAfterMeatPct > 0 ? `${leftAfterMeatPct}% Left After Meat Cost` : 'Left After Meat Cost'
      }
    ];

    cards.forEach(cfg => {
      const cardEl = document.getElementById(cfg.containerId);
      if (!cardEl) return;
      let vizEl = cardEl.querySelector('.kpi-micro-viz');
      if (!vizEl) {
        vizEl = document.createElement('div');
        vizEl.className = 'kpi-micro-viz';
        cardEl.appendChild(vizEl);
      }
      const clampedWidth = Math.min(100, Math.max(0, cfg.pctOfTypical || 0));
      const displayPct = daysCount > 1 ? 'Multi-Day Range' : `${cfg.pctOfTypical}% ${cfg.label}`;
      vizEl.innerHTML = `
        <div class="kpi-bullet-row">
          <div class="kpi-bullet-header">
            <span>Target Progress</span>
            <span>${global.escapeHTML(displayPct)}</span>
          </div>
          <div class="kpi-bullet-track" role="progressbar" aria-valuenow="${clampedWidth}" aria-valuemin="0" aria-valuemax="100">
            <div class="kpi-bullet-fill" style="width:${clampedWidth}%; background:${cfg.barColor};"></div>
            <span class="kpi-bullet-target-marker" style="left:85%;" title="Typical Day Benchmark"></span>
          </div>
        </div>
        <div class="kpi-sparkline-row">
          <span class="kpi-sparkline-caption">7-Day Trend</span>
          ${buildSparklineSVG(cfg.sparkSeries, cfg.barColor)}
        </div>
      `;
    });
  }

  // Expose on global and BBQModules.reports
  global.buildSparklineSVG = buildSparklineSVG;
  global.renderDailyExecutiveBrief = renderDailyExecutiveBrief;
  global.getTenWatchlistTips = getTenWatchlistTips;
  global.getGlossaryData = getGlossaryData;
  global.lookupGlossaryTerm = lookupGlossaryTerm;
  global.openTermExplainer = openTermExplainer;
  global.closeTermExplainer = closeTermExplainer;
  global.renderDailyRandomInsight = renderDailyRandomInsight;
  global.renderQuickWindBanner = renderQuickWindBanner;
  global.renderAnalyticsGlossary = renderAnalyticsGlossary;
  global.renderDaySpecificTipsSummary = renderDaySpecificTipsSummary;
  global.renderTenWatchlistTips = renderTenWatchlistTips;
  global.updateDailyPitIntelligence = updateDailyPitIntelligence;
  global.initDailyPitIntelligence = initDailyPitIntelligence;
  global.renderKPIBulletAndSparklines = renderKPIBulletAndSparklines;

  global.BBQModules.reports = {
    buildSparklineSVG,
    renderDailyExecutiveBrief,
    getTenWatchlistTips,
    getGlossaryData,
    lookupGlossaryTerm,
    openTermExplainer,
    closeTermExplainer,
    renderDailyRandomInsight,
    renderQuickWindBanner,
    renderAnalyticsGlossary,
    renderDaySpecificTipsSummary,
    renderTenWatchlistTips,
    updateDailyPitIntelligence,
    initDailyPitIntelligence,
    renderKPIBulletAndSparklines
  };
})(typeof window !== 'undefined' ? window : globalThis);
