import { calculateCases, purgeJargon } from './unit_conversions.ts';
import { YieldAuditor } from './yield_auditor.ts';
import { ScenarioPlanner } from './scenario_planner.ts';
import {
  getBBQDailyContext,
  getBBQQuickActionPrep,
  getBBQQuickActionNumbers,
  getBBQDigestSnippet,
  getCloverSyncStatus,
  getMidDayRushPacing,
  getSalesDriverAnalysis,
  getWeeklyExecutiveWrapUp
} from './context_provider.ts';

export * from './unit_conversions.ts';
export * from './yield_auditor.ts';
export * from './scenario_planner.ts';
export * from './context_provider.ts';

export interface JDCommandResult {
  success: boolean;
  message: string;
  data?: any;
}

export class JDAgentDomain {
  private yieldAuditor: YieldAuditor;
  private scenarioPlanner: ScenarioPlanner;

  constructor(customYieldAuditor?: YieldAuditor, customScenarioPlanner?: ScenarioPlanner) {
    this.yieldAuditor = customYieldAuditor || new YieldAuditor();
    this.scenarioPlanner = customScenarioPlanner || new ScenarioPlanner();
  }

  public getYieldAuditor(): YieldAuditor {
    return this.yieldAuditor;
  }

  public getScenarioPlanner(): ScenarioPlanner {
    return this.scenarioPlanner;
  }

  public purgeJargon(text: string): string {
    return purgeJargon(text);
  }

  public calculateCases(meat: string, targetCookedLbs: number) {
    return calculateCases(meat, targetCookedLbs);
  }

  public getContext(now = new Date()) {
    return getBBQDailyContext(undefined, now, this.yieldAuditor);
  }

  public getQuickAction(action: 'prep' | 'numbers', now = new Date()) {
    if (action === 'prep') return getBBQQuickActionPrep();
    if (action === 'numbers') return getBBQQuickActionNumbers(now);
    return '';
  }

  public getDigestSnippet(now = new Date()) {
    return getBBQDigestSnippet(now);
  }

  public getMidDayRushPacing(now = new Date()) {
    return getMidDayRushPacing(now);
  }

  public getSalesDriverAnalysis(now = new Date()) {
    return getSalesDriverAnalysis(now);
  }

  public getRollingYieldRadar(meat = 'brisket') {
    return this.yieldAuditor.getRollingYieldRadar(meat);
  }

  public reconcileService(date?: string, meat = 'brisket') {
    return this.yieldAuditor.reconcileService(date, meat);
  }

  public getWeeklyExecutiveWrapUp(now = new Date()) {
    return getWeeklyExecutiveWrapUp(now);
  }

  public handleCommand(command: string, args: string[]): JDCommandResult {
    // 1. /forecast (Case calculations)
    if (command === '/forecast' || (command === '/jd' && args[0] === 'forecast')) {
      const isSub = command === '/jd';
      const meat = (isSub ? args[1] : args[0]) || 'brisket';
      const lbs = parseFloat(isSub ? args[2] : args[1]) || 100;
      const calc = this.calculateCases(meat, lbs);

      const rawMsg = `🔥 Pitmaster Daily Forecast for ${calc.meat}:\n` +
        `• Target Cooked: ${calc.targetCookedLbs} lbs\n` +
        `• Required Raw Weight: ${calc.rawLbsRequired} lbs\n` +
        `• Case Order: ${calc.unitsDescription}\n` +
        (calc.portionsEstimate ? `• Est. Servings: ~${calc.portionsEstimate} portions\n` : '') +
        `\nTip: Ready for fire-up at 4:00 AM EST.`;

      return {
        success: true,
        message: this.purgeJargon(rawMsg),
        data: calc
      };
    }

    // 2. /yield (Cooked meat yield audit logging)
    if (command === '/yield' || (command === '/jd' && args[0] === 'yield')) {
      const isSub = command === '/jd';
      const actualArgs = isSub ? args.slice(1) : args;
      const meat = actualArgs[0] || 'brisket';
      const cooked = parseFloat(actualArgs[1] || '5.75');
      const raw = parseFloat(actualArgs[2]) || undefined;
      const note = actualArgs.slice(3).join(' ') || undefined;

      const r = this.yieldAuditor.auditAndRecord(meat, cooked, raw, note);
      const sign = r.diffPct >= 0 ? '+' : '';
      const verdict = r.status === 'above_benchmark'
        ? `✅ Above standard (+${r.diffLbs} lbs cooked yield / packer)`
        : r.status === 'below_benchmark'
        ? `⚠️ Below standard (${r.diffLbs} lbs trim/cook loss / packer)`
        : `🎯 Right on standard benchmark`;

      const msg = `🥩 Cooked Meat Yield Audit [${r.id}]: ${r.meat}\n` +
        `• Cooked Weight: ${r.cookedLbs} lbs\n` +
        `• Raw Input: ${r.rawLbs} lbs\n` +
        `• Net Cook Yield: ${r.yieldPct}%\n` +
        `• Standard Benchmark: ${r.benchmarkPct}%\n` +
        `• Difference: ${sign}${r.diffPct}% (${sign}${r.diffLbs} lbs cooked)\n` +
        `• Audit Result: ${verdict}${r.notes ? `\n• Notes: ${r.notes}` : ''}`;

      return {
        success: true,
        message: this.purgeJargon(msg),
        data: r
      };
    }

    // 3. /pace (Capability 1: Mid-Day Rush Pacing Check-In)
    if (command === '/pace' || (command === '/jd' && args[0] === 'pace')) {
      const pacing = this.getMidDayRushPacing();
      return {
        success: true,
        message: pacing.formattedMessage,
        data: pacing
      };
    }

    // 4. /reconcile (Capability 2: Sell-Out & Cut Waste Reconciliation)
    if (command === '/reconcile' || (command === '/jd' && args[0] === 'reconcile')) {
      const isSub = command === '/jd';
      const meat = (isSub ? args[1] : args[0]) || 'brisket';
      const date = isSub ? args[2] : args[1];
      const rec = this.reconcileService(date, meat);
      return {
        success: true,
        message: rec.formattedMessage,
        data: rec
      };
    }

    // 5. /drivers (Capability 3: Plain-English Driver & Anomaly Analysis)
    if (command === '/drivers' || (command === '/jd' && args[0] === 'drivers')) {
      const drivers = this.getSalesDriverAnalysis();
      return {
        success: true,
        message: drivers.formattedMessage,
        data: drivers
      };
    }

    // 6. /drift (Capability 4: Multi-Cook Yield Drift & Trimming Loss Radar)
    if (command === '/drift' || (command === '/jd' && args[0] === 'drift')) {
      const isSub = command === '/jd';
      const meat = (isSub ? args[1] : args[0]) || 'brisket';
      const radar = this.getRollingYieldRadar(meat);
      return {
        success: true,
        message: radar.formattedMessage,
        data: radar
      };
    }

    // 7. /scenario (Capability 5: Conversational "What-If" Scenario Forecasting)
    if (command === '/scenario' || (command === '/jd' && args[0] === 'scenario')) {
      const isSub = command === '/jd';
      const prompt = (isSub ? args.slice(1).join(' ') : args.join(' ')) || 'rain';
      const sim = this.scenarioPlanner.parseAndSimulate(prompt);
      return {
        success: true,
        message: this.scenarioPlanner.formatResult(sim),
        data: sim
      };
    }

    // 8. /weekly (Capability 6: Monday 9:00 AM EST Retrospective)
    if (command === '/weekly' || (command === '/jd' && args[0] === 'weekly')) {
      const wrapUp = this.getWeeklyExecutiveWrapUp();
      return {
        success: true,
        message: wrapUp.formattedMessage,
        data: wrapUp
      };
    }

    // General /jd subcommands
    if (command === '/jd') {
      const sub = args[0] || 'status';
      if (sub === 'status') {
        const sync = getCloverSyncStatus();
        return {
          success: true,
          message: `🍖 JD Status: ONLINE\n- Smokehouse Hub: Yellow Rose BBQ\n- Domain Module: /home/atools/Documents/GitHub/yellow-rose-bbq/agent\n- ${sync.message}\n- Pitmaster Language Filter: ACTIVE\n- Capabilities: /forecast, /yield, /pace, /reconcile, /drivers, /drift, /scenario, /weekly`,
          data: { sync }
        };
      }
      if (sub === 'cases') {
        const meat = args[1] || 'brisket';
        const lbs = parseFloat(args[2]) || 70;
        const calc = this.calculateCases(meat, lbs);
        return {
          success: true,
          message: this.purgeJargon(`📦 Case Conversion for ${calc.meat}:\n• Cooked Goal: ${calc.targetCookedLbs} lbs\n• Case Order: ${calc.unitsDescription}`),
          data: calc
        };
      }
      if (sub === 'sausage') {
        const targetLinks = parseInt(args[1] || '150', 10);
        const batches = Math.ceil((targetLinks / 150) * 10) / 10;
        return {
          success: true,
          message: `🌭 Sausage Formulation (sausage.allen.tools):\n• Links Target: ${targetLinks} links (3.0 links/lb)\n• Formulation Batches: ${batches} x 50-lb base blocks (~60 lb nominal stuffed yield)\n• Smoked Yield: ~85% nominal smokehouse render.`,
          data: { targetLinks, batches }
        };
      }
    }

    return {
      success: false,
      message: `Unknown JD command: ${command}`
    };
  }
}
