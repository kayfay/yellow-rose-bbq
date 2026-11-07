import * as fs from 'node:fs';
import * as path from 'node:path';

export interface YieldRecord {
  id: string;
  meat: string;
  rawLbs: number;
  cookedLbs: number;
  yieldPct: number;
  benchmarkPct: number;
  diffPct: number;
  diffLbs: number;
  status: 'above_benchmark' | 'on_benchmark' | 'below_benchmark';
  notes?: string;
  recordedAt: string;
}

export const YIELD_BENCHMARKS: Record<string, { benchmarkPct: number; defaultRawLbs: number; label: string }> = {
  brisket: { benchmarkPct: 41.1, defaultRawLbs: 14.0, label: 'Brisket' }, // 41.1% yield (5.75 lbs cooked / 14.0 lb raw packer verified on cutting board)
  pork: { benchmarkPct: 44.0, defaultRawLbs: 8.0, label: 'Pork Butt (Shoulder)' },
  butt: { benchmarkPct: 44.0, defaultRawLbs: 8.0, label: 'Pork Butt (Shoulder)' },
  shoulder: { benchmarkPct: 44.0, defaultRawLbs: 8.0, label: 'Pork Butt (Shoulder)' },
  ribs: { benchmarkPct: 60.0, defaultRawLbs: 5.6, label: 'Pork Spare Ribs' }, // 5.6 lb rack (invoice)
  rib: { benchmarkPct: 60.0, defaultRawLbs: 5.6, label: 'Pork Spare Ribs' },
  turkey: { benchmarkPct: 70.0, defaultRawLbs: 20.0, label: 'Smoked Turkey' }
};

export class YieldAuditor {
  private baseDir: string;

  constructor(customBaseDir?: string) {
    this.baseDir = customBaseDir || path.resolve(import.meta.dirname);
  }

  private getStorePath(): string {
    const dir = path.join(this.baseDir, 'memory');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, 'yield_records.json');
  }

  public listRecords(): YieldRecord[] {
    const file = this.getStorePath();
    if (!fs.existsSync(file)) return [];
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      return Array.isArray(data) ? data : (data.records || []);
    } catch {
      return [];
    }
  }

  public auditAndRecord(meatInput: string, cookedLbs: number, rawLbsInput?: number, notes?: string): YieldRecord {
    const meatKey = meatInput.toLowerCase().trim();
    let config = YIELD_BENCHMARKS.brisket;
    for (const [key, val] of Object.entries(YIELD_BENCHMARKS)) {
      if (meatKey.includes(key)) {
        config = val;
        break;
      }
    }

    const rawLbs = rawLbsInput && rawLbsInput > 0 ? rawLbsInput : config.defaultRawLbs;
    const yieldPct = Math.round((cookedLbs / rawLbs) * 1000) / 10;
    const benchmarkPct = config.benchmarkPct;
    const diffPct = Math.round((yieldPct - benchmarkPct) * 10) / 10;
    const standardCookedLbs = rawLbs * (benchmarkPct / 100);
    const diffLbs = Math.round((cookedLbs - standardCookedLbs) * 100) / 100;

    let status: YieldRecord['status'] = 'on_benchmark';
    if (diffPct > 0.5) status = 'above_benchmark';
    else if (diffPct < -0.5) status = 'below_benchmark';

    const records = this.listRecords();
    const id = `YLD-${records.length + 1}`;
    const now = new Date().toISOString();

    const record: YieldRecord = {
      id,
      meat: config.label,
      rawLbs,
      cookedLbs,
      yieldPct,
      benchmarkPct,
      diffPct,
      diffLbs,
      status,
      notes,
      recordedAt: now
    };

    records.push(record);
    fs.writeFileSync(this.getStorePath(), JSON.stringify({ records }, null, 2));

    // Append to Layer 1 memory stream if present
    const today = now.slice(0, 10);
    const streamFile = path.join(this.baseDir, 'memory', `${today}.md`);
    try {
      fs.appendFileSync(streamFile, `- [${now}] YIELD AUDIT [${id}]: ${config.label} ${cookedLbs} lbs cooked from ${rawLbs} lbs raw (${yieldPct}%, diff ${diffPct >= 0 ? '+' : ''}${diffPct}% vs ${benchmarkPct}% benchmark)\n`);
    } catch {
      // non-fatal
    }

    return record;
  }

  public formatSummaryForPrompt(limit = 3): string {
    const records = this.listRecords().slice(-limit);
    if (!records.length) return 'No recent yield audits recorded.';
    return records.map(r => {
      const sign = r.diffPct >= 0 ? '+' : '';
      return `- [${r.id}] ${r.meat}: ${r.cookedLbs} lbs cooked from ${r.rawLbs} lbs raw (${r.yieldPct}% net; ${sign}${r.diffPct}% vs benchmark)`;
    }).join('\n');
  }
}
