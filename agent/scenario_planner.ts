import { calculateCases, purgeJargon } from './unit_conversions.ts';

export interface WeatherScenarioOptions {
  weatherCondition: 'rain' | 'storm' | 'snow' | 'extreme_heat' | 'clear' | 'fair';
  trafficModifierPct?: number; // e.g. -15 for 15% reduction
  targetDate?: string;
  baselineSalesUsd?: number;
  baselineBrisketPackers?: number;
}

export interface CateringScenarioOptions {
  guestCount: number;
  meatTypes?: Array<'brisket' | 'pork' | 'ribs' | 'turkey' | 'sausage'>;
  style?: 'full_meal' | 'light_appetizer' | 'heavy_bbq';
  targetDate?: string;
}

export interface ScenarioResult {
  title: string;
  description: string;
  inputsSummary: string;
  adjustments: string[];
  recommendations: string[];
  data: Record<string, any>;
}

export class ScenarioPlanner {
  /**
   * Simulate weather impacts on smokehouse demand and prep.
   * Rain/Storm defaults to -15% foot traffic, saving packers from holdover.
   */
  public simulateWeather(options: WeatherScenarioOptions): ScenarioResult {
    const condition = options.weatherCondition.toLowerCase();
    let modPct = options.trafficModifierPct;

    if (modPct === undefined) {
      if (condition.includes('rain') || condition.includes('shower')) modPct = -15;
      else if (condition.includes('storm') || condition.includes('thunder')) modPct = -25;
      else if (condition.includes('snow') || condition.includes('blizzard')) modPct = -35;
      else if (condition.includes('heat') || condition.includes('hot')) modPct = -10;
      else modPct = 0;
    }

    const baselineSales = options.baselineSalesUsd || 4000;
    const projectedSales = Math.round(baselineSales * (1 + modPct / 100));
    const salesDiff = projectedSales - baselineSales;

    // Normal day brisket target: ~100 lbs cooked (~17-18 packers, ~3.5 cases)
    const baseCookedBrisket = 100;
    const adjustedCookedBrisket = Math.max(20, Math.round(baseCookedBrisket * (1 + modPct / 100)));
    const baseCalc = calculateCases('brisket', baseCookedBrisket);
    const adjCalc = calculateCases('brisket', adjustedCookedBrisket);

    // Spare ribs adjustment: normally ~8 racks
    const baseRacks = 8;
    const adjRacks = Math.max(2, Math.round(baseRacks * (1 + modPct / 100)));

    const adjustments: string[] = [
      `Expected Sales: $${projectedSales.toLocaleString()} (${modPct >= 0 ? '+' : ''}${modPct}% vs $${baselineSales.toLocaleString()} baseline)`,
      `Brisket Prep: Target ${adjustedCookedBrisket} lbs cooked (${adjCalc.unitsDescription}) vs normal ${baseCookedBrisket} lbs cooked`,
      `Spare Ribs Prep: Target ${adjRacks} racks vs normal ${baseRacks} racks`
    ];

    const recommendations: string[] = [];
    if (modPct < 0) {
      const packersSaved = Math.max(1, Math.round((baseCookedBrisket - adjustedCookedBrisket) / 5.75));
      recommendations.push(
        `Trim & stage ${packersSaved} fewer brisket packer(s) for the morning smoke to prevent afternoon holdover.`,
        `Hold 2nd-stage brisket uncut in the hotbox (145°F) until counter ticket volume confirms demand.`
      );
    } else {
      recommendations.push(
        `Stage 1 extra brisket packer on the cutting board 30 minutes before 12:00 PM EST lunch rush.`,
        `Keep sausage links hot and pre-staged for rapid takeout turnover.`
      );
    }

    const desc = modPct < 0
      ? `Simulated ${condition} weather with a ${Math.abs(modPct)}% foot traffic reduction.`
      : `Simulated favorable weather with a ${modPct}% foot traffic lift.`;

    return {
      title: `🌦️ Smokehouse Weather Simulation: ${condition.toUpperCase()}`,
      description: desc,
      inputsSummary: `Weather: ${condition} | Traffic Modifier: ${modPct}% | Baseline Sales: $${baselineSales}`,
      adjustments,
      recommendations,
      data: {
        condition,
        trafficModifierPct: modPct,
        baselineSalesUsd: baselineSales,
        projectedSalesUsd: projectedSales,
        salesDiffUsd: salesDiff,
        adjustedCookedBrisketLbs: adjustedCookedBrisket,
        adjustedPackers: Math.ceil(adjustedCookedBrisket / 5.75),
        adjCalc
      }
    };
  }

  /**
   * Calculate catering prep orders with built-in 10% prep cushion.
   * Standard portions: Brisket (7 oz / 0.44 lb), Pork (8 oz / 0.5 lb), Ribs (4 bones / 0.33 rack), Turkey (5 oz / 0.31 lb).
   */
  public calculateCatering(options: CateringScenarioOptions): ScenarioResult {
    const guests = options.guestCount;
    const meats = options.meatTypes && options.meatTypes.length > 0
      ? options.meatTypes
      : ['brisket', 'pork'];
    const style = options.style || 'full_meal';

    // Multiplier per person based on meal style
    const styleMult = style === 'heavy_bbq' ? 1.25 : style === 'light_appetizer' ? 0.75 : 1.0;

    const adjustments: string[] = [];
    const meatDetails: Record<string, any> = {};

    let totalCookedLbs = 0;

    for (const meat of meats) {
      let personLbs = 0.35; // default 5.6 oz
      if (meat === 'brisket') personLbs = 0.44; // 7 oz cooked
      else if (meat === 'pork') personLbs = 0.50; // 8 oz cooked
      else if (meat === 'turkey') personLbs = 0.31; // 5 oz cooked
      else if (meat === 'sausage') personLbs = 0.33; // 1 large link

      // If multiple meats, divide portion per meat
      const portionShare = meats.length > 1 ? personLbs * 0.7 : personLbs;
      const netCookedNeeded = guests * portionShare * styleMult;

      // Built-in 10% prep cushion: Target Cooked = Forecast * 1.10
      const targetCooked = Math.round(netCookedNeeded * 1.10 * 10) / 10;
      totalCookedLbs += targetCooked;

      const calc = calculateCases(meat, targetCooked);
      meatDetails[meat] = {
        meat,
        targetCookedLbs: targetCooked,
        calc
      };

      adjustments.push(
        `• ${calc.meat}: ${targetCooked} lbs cooked required (${calc.unitsDescription})`
      );
    }

    const recommendations: string[] = [
      `Includes 10% cutting-board prep margin for clean slicing & service loss.`,
      `Fire smokehouse 12-14 hours prior to catering pickup/delivery time.`,
      `Stage in insulated Cambros at >= 145°F until carver service.`
    ];

    return {
      title: `🍖 Catering Order Prep Estimate (${guests} Guests)`,
      description: `Catering plan for ${guests} guests (${meats.join(', ')}) with 10% prep margin.`,
      inputsSummary: `Guest Count: ${guests} | Meats: ${meats.join(', ')} | Style: ${style}`,
      adjustments,
      recommendations,
      data: {
        guests,
        meats,
        style,
        totalCookedLbs,
        meatDetails
      }
    };
  }

  /**
   * Format any scenario result into a clean plain-English pitmaster message.
   */
  public formatResult(result: ScenarioResult): string {
    let msg = `${result.title}\n`;
    msg += `ℹ️ ${result.description}\n\n`;
    msg += `📋 Target Prep Adjustments:\n`;
    for (const a of result.adjustments) {
      msg += `${a.startsWith('•') ? a : '• ' + a}\n`;
    }
    msg += `\n💡 Pitmaster Action:\n`;
    for (const r of result.recommendations) {
      msg += `• ${r}\n`;
    }
    return purgeJargon(msg.trim());
  }

  /**
   * Parse natural language scenario query.
   */
  public parseAndSimulate(text: string): ScenarioResult {
    const lower = text.toLowerCase();

    // Check catering
    const guestMatch = lower.match(/(\d+)\s*(?:person|guest|people|pax|head)/);
    if (lower.includes('cater') || lower.includes('party') || guestMatch) {
      const guests = guestMatch ? parseInt(guestMatch[1], 10) : 40;
      const meats: Array<'brisket' | 'pork' | 'ribs' | 'turkey' | 'sausage'> = [];
      if (lower.includes('brisket')) meats.push('brisket');
      if (lower.includes('pork') || lower.includes('butt')) meats.push('pork');
      if (lower.includes('rib')) meats.push('ribs');
      if (lower.includes('turkey')) meats.push('turkey');
      if (lower.includes('sausage')) meats.push('sausage');

      return this.calculateCatering({
        guestCount: guests,
        meatTypes: meats.length > 0 ? meats : ['brisket', 'pork']
      });
    }

    // Check weather
    if (lower.includes('rain') || lower.includes('storm') || lower.includes('weather') || lower.includes('snow') || lower.includes('traffic')) {
      const pctMatch = lower.match(/(-?\d+)\s*%/);
      const modPct = pctMatch ? parseInt(pctMatch[1], 10) : undefined;
      const condition = lower.includes('storm') ? 'storm' : lower.includes('snow') ? 'snow' : 'rain';
      return this.simulateWeather({
        weatherCondition: condition,
        trafficModifierPct: modPct
      });
    }

    // Default to rain simulation
    return this.simulateWeather({ weatherCondition: 'rain' });
  }
}
