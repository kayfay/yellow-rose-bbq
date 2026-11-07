export interface MeatCalculation {
  meat: string;
  targetCookedLbs: number;
  rawLbsRequired: number;
  casesRequired: number;
  unitsDescription: string;
  portionsEstimate?: number;
}

export function purgeJargon(text: string): string {
  let sanitized = text;
  const replacements: Array<[RegExp, string]> = [
    [/multimeatforecaster/gi, 'Pitmaster Daily Forecast'],
    [/safety\s*buffer/gi, 'Prep Target'],
    [/cushion/gi, 'Target'],
    [/extra\s*prep/gi, 'Prep Target'],
    [/variance/gi, 'Difference from Target'],
    [/model\s*evaluation/gi, 'Cook Accuracy Audit'],
    [/cogs/gi, 'Est. Meat Cost'],
    [/gross\s*margin/gi, 'Left After Meat Cost'],
    [/velocity/gi, 'Sales vs. Typical Day'],
    [/hourly\s*sales\s*pace/gi, 'Sales vs. Typical Day'],
    [/dow\s*base/gi, 'Typical Day Baseline'],
    [/z-score/gi, 'Accuracy Score'],
    [/sigma/gi, 'Variation Band'],
    [/elasticity/gi, 'Price Sensitivity'],
    [/stadium\s*lift/gi, 'Event Foot Traffic Lift'],
    [/regression/gi, 'Sales Trend Trendline']
  ];

  for (const [pattern, replacement] of replacements) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}

export function calculateCases(meatKey: string, targetCookedLbs: number): MeatCalculation {
  const key = meatKey.toLowerCase().trim();

  if (key.includes('brisket')) {
    // Y_net = 0.40 (16.4 lb raw packer; 5 packers/case = 82 lbs raw; ~6.56 lbs cooked each)
    const rawLbs = targetCookedLbs / 0.40;
    const packers = Math.ceil(rawLbs / 16.4);
    const cases = Math.ceil((packers / 5) * 10) / 10;
    return {
      meat: 'Brisket',
      targetCookedLbs,
      rawLbsRequired: Math.round(rawLbs),
      casesRequired: cases,
      unitsDescription: `${cases} Cases (${packers} raw packers @ 16.4 lbs each, yielding ~6.56 lbs cooked each)`,
      portionsEstimate: Math.round(targetCookedLbs * 2.3)
    };
  } else if (key.includes('pork') || key.includes('butt') || key.includes('shoulder')) {
    // Y_net = 0.44, 32 lbs raw/case (4 butts @ 8 lbs)
    const rawLbs = targetCookedLbs / 0.44;
    const cases = Math.ceil((rawLbs / 32) * 10) / 10;
    const butts = Math.ceil(rawLbs / 8);
    return {
      meat: 'Pork Butt (Shoulder)',
      targetCookedLbs,
      rawLbsRequired: Math.round(rawLbs),
      casesRequired: cases,
      unitsDescription: `${cases} Cases (${butts} bone-in butts @ 8 lbs each)`,
      portionsEstimate: Math.round(targetCookedLbs * 2.0)
    };
  } else if (key.includes('dino')) {
    // Y_cook = 0.50, 48 lbs/case (12 ribs @ 4 lbs, 3 bags)
    const rawLbs = targetCookedLbs / 0.50;
    const ribs = Math.ceil(rawLbs / 4.0);
    const cases = Math.ceil((ribs / 12) * 10) / 10;
    return {
      meat: 'Beef Dino Ribs',
      targetCookedLbs,
      rawLbsRequired: Math.round(rawLbs),
      casesRequired: cases,
      unitsDescription: `${cases} Cases (${ribs} plate ribs @ 4.0 lbs each, 3 bags/case)`
    };
  } else if (key.includes('rib')) {
    // Y_cook = 0.60, 33.6 lbs/case (6 racks @ 5.6 lbs)
    const rawLbs = targetCookedLbs / 0.60;
    const racks = Math.ceil(rawLbs / 5.6);
    const cases = Math.ceil((racks / 6) * 10) / 10;
    return {
      meat: 'Pork Spare Ribs',
      targetCookedLbs,
      rawLbsRequired: Math.round(rawLbs),
      casesRequired: cases,
      unitsDescription: `${cases} Cases (${racks} racks @ 5.6 lbs each, 2 racks/cryovac)`
    };
  } else if (key.includes('turkey')) {
    // Y_trim = 1.0, Y_cook = 0.70, 20 lbs/case
    const rawLbs = targetCookedLbs / 0.70;
    const cases = Math.ceil((rawLbs / 20) * 10) / 10;
    return {
      meat: 'Smoked Turkey (No-Trim)',
      targetCookedLbs,
      rawLbsRequired: Math.round(rawLbs),
      casesRequired: cases,
      unitsDescription: `${cases} Cases (20 lbs/case raw)`,
      portionsEstimate: Math.round(targetCookedLbs * 3.2)
    };
  } else {
    // Generic fallback
    const rawLbs = targetCookedLbs / 0.50;
    return {
      meat: meatKey,
      targetCookedLbs,
      rawLbsRequired: Math.round(rawLbs),
      casesRequired: Math.ceil(rawLbs / 40),
      unitsDescription: `Approx. ${Math.round(rawLbs)} lbs raw`
    };
  }
}
