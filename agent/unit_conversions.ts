export interface MeatCalculation {
  meat: string;
  targetCookedLbs: number;
  rawLbsRequired: number;
  casesRequired: number;
  unitsDescription: string;
  portionsEstimate?: number;
  cuts?: number;
  cutLabel?: string;
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
    // Y_net = 0.411 (14.0 lb raw packer; 5 packers/case = 70 lbs raw; ~5.75 lbs cooked each)
    // Verified by cutter: 5 and 3/4 lbs cooked per whole packer
    const packers = Math.ceil(targetCookedLbs / 5.75);
    const rawLbs = packers * 14.0;
    const cases = Math.ceil((packers / 5) * 10) / 10;
    return {
      meat: 'Brisket',
      targetCookedLbs,
      rawLbsRequired: Math.round(rawLbs),
      casesRequired: cases,
      cuts: packers,
      cutLabel: packers === 1 ? 'Packer' : 'Packers',
      unitsDescription: `${packers} Packers (~${cases} Cases)`,
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
      cuts: butts,
      cutLabel: butts === 1 ? 'Butt' : 'Butts',
      unitsDescription: `${butts} Butts (~${cases} Cases)`,
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
      cuts: ribs,
      cutLabel: ribs === 1 ? 'Rib' : 'Ribs',
      unitsDescription: `${ribs} Ribs (~${cases} Cases)`
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
      cuts: racks,
      cutLabel: racks === 1 ? 'Rack' : 'Racks',
      unitsDescription: `${racks} Racks (~${cases} Cases)`
    };
  } else if (key.includes('turkey')) {
    // Each whole turkey breast yields 3.0 lbs cooked (~4.29 lbs raw @ 70% yield)
    const rawLbs = targetCookedLbs / 0.70;
    const breasts = Math.ceil(targetCookedLbs / 3.0);
    const cases = Math.ceil((breasts / 4) * 10) / 10;
    return {
      meat: 'Smoked Turkey (No-Trim)',
      targetCookedLbs,
      rawLbsRequired: Math.round(rawLbs),
      casesRequired: cases,
      cuts: breasts,
      cutLabel: breasts === 1 ? 'Breast' : 'Breasts',
      unitsDescription: `${breasts} Breasts (~${cases} Cases)`,
      portionsEstimate: Math.round(targetCookedLbs * 3.2)
    };
  } else if (key.includes('sausage')) {
    // 3 links/lb, 60 lb nominal batch (180 links)
    const links = Math.ceil(targetCookedLbs * 3.0);
    const batches = Math.ceil(targetCookedLbs / 60.0);
    return {
      meat: 'House Sausage',
      targetCookedLbs,
      rawLbsRequired: Math.round(targetCookedLbs),
      casesRequired: batches,
      cuts: links,
      cutLabel: links === 1 ? 'Link' : 'Links',
      unitsDescription: `${links} Links (~${batches} batch${batches === 1 ? '' : 'es'})`,
      portionsEstimate: links
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
