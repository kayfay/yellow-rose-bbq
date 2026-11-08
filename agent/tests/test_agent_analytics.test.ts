import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  JDAgentDomain,
  calculateCases,
  purgeJargon,
  YieldAuditor,
  ScenarioPlanner,
  getMidDayRushPacing,
  getSalesDriverAnalysis,
  getWeeklyExecutiveWrapUp
} from '../index.ts';

const BANNED_JARGON = [
  'multimeatforecaster',
  'variance',
  'safety buffer',
  'model evaluation',
  'dow base',
  'z-score',
  'sigma',
  'cogs',
  'velocity',
  'elasticity',
  'stadium lift',
  'regression'
];

function assertNoBannedJargon(text: string, context = '') {
  const lower = text.toLowerCase();
  for (const term of BANNED_JARGON) {
    assert.strictEqual(
      lower.includes(term),
      false,
      `Banned jargon term "${term}" detected in output [${context}]:\n${text}`
    );
  }
}

describe('JD Smokehouse Analytics & Pitmaster Co-Pilot Suite', () => {
  const jd = new JDAgentDomain();

  describe('Capability 1: Mid-Day Rush Pacing Check-ins (2:00 PM EST)', () => {
    it('evaluates cumulative sales through 2:00 PM EST and recommends dinner packer adjustments', () => {
      const pacing = jd.getMidDayRushPacing();
      assert.ok(pacing.date, 'Has target date');
      assert.strictEqual(pacing.hourRecorded, 14, 'Cutoff hour is 14 (2:00 PM EST)');
      assert.ok(typeof pacing.salesToDateUsd === 'number', 'Sales to date is numeric');
      assert.ok(typeof pacing.expectedToDateUsd === 'number', 'Expected sales is numeric');
      assert.ok(['ahead', 'on_pace', 'behind'].includes(pacing.status), 'Valid status');
      assert.ok(pacing.dinnerAdjustment.length > 10, 'Has actionable dinner line adjustment');
      assert.match(pacing.formattedMessage, /2:00 PM EST/i, 'Uses 12-hour EST uppercase timestamp');

      assertNoBannedJargon(pacing.formattedMessage, 'Capability 1 - getMidDayRushPacing');
    });

    it('handles /pace command and subcommands via handleCommand', () => {
      const res = jd.handleCommand('/pace', []);
      assert.strictEqual(res.success, true);
      assert.match(res.message, /Mid-Day Rush Pacing Check-In/i);
      assertNoBannedJargon(res.message, 'Capability 1 - /pace');

      const subRes = jd.handleCommand('/jd', ['pace']);
      assert.strictEqual(subRes.success, true);
      assertNoBannedJargon(subRes.message, 'Capability 1 - /jd pace');
    });
  });

  describe('Capability 2: Sell-Out & Cut Waste Reconciliation', () => {
    it('detects holdover and converts leftover meat into practical whole packers and cases', () => {
      const ya = jd.getYieldAuditor();
      const rec = ya.reconcileService('2026-11-03', 'brisket');

      assert.strictEqual(rec.meat, 'Brisket');
      assert.ok(rec.cookedLbsPrepped > 0, 'Prepped weight > 0');
      assert.ok(rec.cookedLbsSold > 0, 'Sold weight > 0');
      assert.ok(rec.cutsUnitsDescription.length > 0, 'Has cuts and cases description');
      assert.ok(rec.actionRecommendation.length > 0, 'Has kitchen action recommendation');

      assertNoBannedJargon(rec.formattedMessage, 'Capability 2 - reconcileService');
    });

    it('handles /reconcile command via handleCommand', () => {
      const res = jd.handleCommand('/reconcile', ['brisket']);
      assert.strictEqual(res.success, true);
      assert.match(res.message, /Sell-Out & Cut Waste Reconciliation/i);
      assertNoBannedJargon(res.message, 'Capability 2 - /reconcile');
    });
  });

  describe('Capability 3: Plain-English Driver & Anomaly Analysis', () => {
    it('decomposes shift performance into Rush Hour Demand and Weather without statistical jargon', () => {
      const drivers = jd.getSalesDriverAnalysis();
      assert.ok(drivers.expectedSalesUsd > 0, 'Has expected sales');
      assert.ok(drivers.typicalSalesUsd > 0, 'Has typical baseline sales');
      assert.ok(typeof drivers.rushHourDeltaUsd === 'number', 'Rush hour delta is numeric');
      assert.ok(typeof drivers.weatherFootTrafficDeltaUsd === 'number', 'Weather delta is numeric');
      assert.ok(drivers.leftAfterMeatCostUsd > 0, 'Left after meat cost is positive');

      assert.match(drivers.formattedMessage, /Rush Hour Demand/i);
      assert.match(drivers.formattedMessage, /Weather & Foot Traffic/i);
      assert.match(drivers.formattedMessage, /Est\. Meat Cost/i);
      assert.match(drivers.formattedMessage, /Left After Meat Cost/i);

      assertNoBannedJargon(drivers.formattedMessage, 'Capability 3 - getSalesDriverAnalysis');
    });

    it('handles /drivers command via handleCommand', () => {
      const res = jd.handleCommand('/drivers', []);
      assert.strictEqual(res.success, true);
      assert.match(res.message, /Shift Sales Driver Analysis/i);
      assertNoBannedJargon(res.message, 'Capability 3 - /drivers');
    });
  });

  describe('Capability 4: Multi-Cook Yield Drift & Trimming Loss Radar', () => {
    it('tracks rolling 5-cook window against 41.1% (5.75 lbs) cutter benchmark and flags dollar trim loss', () => {
      const ya = jd.getYieldAuditor();
      const radar = ya.getRollingYieldRadar('brisket');

      assert.strictEqual(radar.meat, 'Brisket');
      assert.strictEqual(radar.benchmarkPct, 41.1, 'Benchmark is 41.1% net yield');
      assert.ok(radar.cooksCount >= 1, 'Evaluates cooks');
      assert.ok(radar.takeaway.length > 10, 'Has 1-line plain-English takeaway');

      assertNoBannedJargon(radar.formattedMessage, 'Capability 4 - getRollingYieldRadar');
    });

    it('accurately calculates wholesale dollar loss per 5-packer case on sub-benchmark yield drift', () => {
      const testAuditor = new YieldAuditor();
      // Record 3 cooks below benchmark (e.g. 5.0 lbs cooked from 14.0 lb raw = 35.7% yield)
      testAuditor.auditAndRecord('brisket', 5.0, 14.0, 'Sub-spec heavy deckle trim');
      testAuditor.auditAndRecord('brisket', 5.0, 14.0, 'Over-rendered flat');

      const radar = testAuditor.getRollingYieldRadar('brisket');
      assert.strictEqual(radar.status, 'drift_warning');
      assert.ok(radar.dollarLossPerCase > 0, 'Calculates wholesale loss per case');
      assert.match(radar.formattedMessage, /YIELD DRIFT ALERT/i);
      assert.match(radar.takeaway, /per case/i);

      assertNoBannedJargon(radar.formattedMessage, 'Capability 4 - drift alert');
    });

    it('handles /drift command via handleCommand', () => {
      const res = jd.handleCommand('/drift', ['brisket']);
      assert.strictEqual(res.success, true);
      assert.match(res.message, /Cooked Meat Yield Drift Radar/i);
      assertNoBannedJargon(res.message, 'Capability 4 - /drift');
    });
  });

  describe('Capability 5: Conversational "What-If" Scenario Forecasting', () => {
    const sp = new ScenarioPlanner();

    it('simulates weather impact (-15% rain) and scales down raw packer prep to prevent holdover', () => {
      const sim = sp.simulateWeather({ weatherCondition: 'rain' });
      assert.strictEqual(sim.data.trafficModifierPct, -15);
      assert.ok(sim.data.adjustedCookedBrisketLbs < 100, 'Adjusts cooked brisket lbs down');
      assert.ok(sim.recommendations.some(r => r.includes('fewer brisket packer')), 'Recommends staging fewer packers');

      const formatted = sp.formatResult(sim);
      assert.match(formatted, /Smokehouse Weather Simulation/i);
      assert.match(formatted, /Brisket Prep: Target/i);
      assertNoBannedJargon(formatted, 'Capability 5 - simulateWeather');
    });

    it('calculates catering orders with 10% prep cushion and cutting-board case conversions', () => {
      const cater = sp.calculateCatering({
        guestCount: 50,
        meatTypes: ['brisket', 'pork']
      });

      assert.strictEqual(cater.data.guests, 50);
      assert.ok(cater.data.meatDetails.brisket.calc.casesRequired > 0, 'Calculates brisket cases');
      assert.ok(cater.data.meatDetails.pork.calc.casesRequired > 0, 'Calculates pork cases');
      assert.match(cater.recommendations[0], /10% cutting-board prep/i);

      const formatted = sp.formatResult(cater);
      assert.match(formatted, /Catering Order Prep Estimate/i);
      assert.match(formatted, /Cases/i);
      assertNoBannedJargon(formatted, 'Capability 5 - calculateCatering');
    });

    it('handles conversational natural language queries via parseAndSimulate and /scenario', () => {
      const nlRes = sp.parseAndSimulate('We have a 60 person catering party on Saturday for brisket and pulled pork');
      assert.strictEqual(nlRes.data.guests, 60);

      const cmdRes = jd.handleCommand('/scenario', ['rain', '-20%']);
      assert.strictEqual(cmdRes.success, true);
      assert.match(cmdRes.message, /Weather Simulation/i);
      assertNoBannedJargon(cmdRes.message, 'Capability 5 - /scenario');
    });
  });

  describe('Capability 6: Weekly Executive Smokehouse Wrap-Up', () => {
    it('generates Monday 9:00 AM EST retrospective with contribution margin and case purchasing guide', () => {
      const wrapUp = jd.getWeeklyExecutiveWrapUp();
      assert.ok(wrapUp.totalGrossSalesUsd > 0, 'Total gross sales > 0');
      assert.ok(wrapUp.estimatedMeatCostUsd > 0, 'Estimated meat cost > 0');
      assert.ok(wrapUp.leftAfterMeatCostUsd > 0, 'Left after meat cost > 0');
      assert.ok(wrapUp.contributionMarginPct > 50, 'Healthy contribution margin %');
      assert.ok(wrapUp.casePurchasingGuide.brisketCases > 0, 'Calculates brisket case order guide');
      assert.ok(wrapUp.casePurchasingGuide.porkCases > 0, 'Calculates pork case order guide');
      assert.ok(wrapUp.casePurchasingGuide.ribCases > 0, 'Calculates rib case order guide');

      assert.match(wrapUp.formattedMessage, /Monday 9:00 AM EST Smokehouse Retrospective/i);
      assert.match(wrapUp.formattedMessage, /Left After Meat Cost/i);
      assert.match(wrapUp.formattedMessage, /Distributor Case Purchasing Guide/i);
      assert.match(wrapUp.formattedMessage, /US Foods by Monday 2:00 PM EST/i);

      assertNoBannedJargon(wrapUp.formattedMessage, 'Capability 6 - getWeeklyExecutiveWrapUp');
    });

    it('handles /weekly command via handleCommand', () => {
      const res = jd.handleCommand('/weekly', []);
      assert.strictEqual(res.success, true);
      assert.match(res.message, /Smokehouse Retrospective/i);
      assertNoBannedJargon(res.message, 'Capability 6 - /weekly');
    });
  });

  describe('Cutting-Board Invariant & Unit Calibration Standards', () => {
    it('calibrates brisket case conversions to 5.75 lbs cooked / 14.0 lb raw packer (41.1% yield)', () => {
      // 100 lbs cooked brisket / 5.75 = 17.39 -> 18 packers -> 3.6 cases (18 * 14.0 = 252 lbs raw)
      const calc = calculateCases('brisket', 100);
      assert.strictEqual(calc.meat, 'Brisket');
      assert.strictEqual(calc.targetCookedLbs, 100);
      assert.match(calc.unitsDescription, /18 raw packers @ 14\.0 lbs each/i);
      assert.match(calc.unitsDescription, /yielding ~5\.75 lbs cooked each/i);
      assert.strictEqual(calc.casesRequired, 3.6);
      assert.strictEqual(calc.rawLbsRequired, 252);
    });

    it('calibrates pork butt and ribs case conversions accurately', () => {
      const pork = calculateCases('pork', 50);
      assert.strictEqual(pork.meat, 'Pork Butt (Shoulder)');
      assert.ok(pork.casesRequired > 0);

      const ribs = calculateCases('ribs', 30);
      assert.strictEqual(ribs.meat, 'Pork Spare Ribs');
      assert.ok(ribs.casesRequired > 0);
    });
  });
});
