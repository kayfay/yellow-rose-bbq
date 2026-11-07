import * as fs from 'node:fs';
import * as path from 'node:path';
import { purgeJargon, calculateCases } from './unit_conversions.ts';
import { YieldAuditor } from './yield_auditor.ts';

const BBQ_ROOT = path.resolve(import.meta.dirname, '..');
const BRIEF_FILE = path.join(BBQ_ROOT, 'clover_api/analytics/daily_executive_brief.json');
const SYNC_FILE = path.join(BBQ_ROOT, 'clover_api/analytics/sync_status.json');

function localDateParts(d: Date, tz = 'America/New_York'): { date: string; minutes: number } {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p: Record<string, string> = Object.fromEntries(f.formatToParts(d).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

export function getCloverSyncStatus(syncFile = SYNC_FILE): { online: boolean; message: string; lastSyncedAt?: string } {
  try {
    if (!fs.existsSync(syncFile)) return { online: false, message: 'Clover POS: Sync status unavailable' };
    const s = JSON.parse(fs.readFileSync(syncFile, 'utf8'));
    const online = s.status === 'success';
    const timeStr = s.last_synced_at ? s.last_synced_at.slice(11, 16) + ' EST' : 'recent';
    return {
      online,
      message: online ? `Clover POS: ONLINE (Synced ${timeStr})` : 'Clover POS: ⚠️ SYNC PENDING',
      lastSyncedAt: s.last_synced_at
    };
  } catch {
    return { online: false, message: 'Clover POS: Sync status check failed' };
  }
}

export function getBBQDailyContext(file = BRIEF_FILE, now = new Date(), yieldAuditor?: YieldAuditor): { text: string; fresh: boolean } {
  const ya = yieldAuditor || new YieldAuditor();
  const yieldSummary = ya.formatSummaryForPrompt(4);
  const syncInfo = getCloverSyncStatus();

  try {
    if (!fs.existsSync(file)) {
      return {
        fresh: false,
        text: `No BBQ sales data is available right now.\n${syncInfo.message}\n\nRecent Cooked Meat Yield Audits:\n${yieldSummary}`
      };
    }

    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    const b = j.active_service_brief ?? {};
    const ageH = (now.getTime() - Date.parse(j.generated_at)) / 3600000;
    const today = localDateParts(now).date;
    const yDate = new Date(now.getTime() - 24 * 3600000);
    const yesterday = localDateParts(yDate).date;

    const bToday = j.by_date?.[today] || (b.date === today ? b : null);
    const bYesterday = j.by_date?.[yesterday];
    const currentBrief = bToday || b;
    const fresh = ageH < 36 && currentBrief.date === today;

    const keep = ['date', 'day_full_name', 'is_closed', 'status_badge', 'expected_sales_usd', 'typical_day_sales_usd', 'sales_diff_usd', 'estimated_meat_cost_usd', 'left_after_meat_cost_usd', 'primary_driver', 'peak_rush_window', 'the_insight', 'the_action'];
    const snapToday = Object.fromEntries(keep.filter(k => k in currentBrief).map(k => [k, currentBrief[k]]));
    const snapYesterday = bYesterday ? Object.fromEntries(keep.filter(k => k in bYesterday).map(k => [k, bYesterday[k]])) : null;

    let numbersText = `Yellow Rose BBQ Daily Brief (Today is ${today}${fresh ? '' : '; these numbers are NOT from today, name the day when you cite them and do not call them today'}):\n`;
    numbersText += `\n[TODAY'S NUMBERS (${currentBrief.day_full_name ?? 'Day'} ${currentBrief.date ?? today})]:\n${JSON.stringify(snapToday, null, 1)}\n`;

    if (snapYesterday) {
      numbersText += `\n[PREVIOUS DAY / YESTERDAY'S NUMBERS (${snapYesterday.day_full_name ?? 'Yesterday'} ${snapYesterday.date ?? yesterday})]:\n${JSON.stringify(snapYesterday, null, 1)}\n`;
    }

    return {
      fresh,
      text: `${numbersText}\n${syncInfo.message}\n\nRecent Cooked Meat Yield Audits:\n${yieldSummary}`
    };
  } catch {
    return {
      fresh: false,
      text: `No BBQ sales data is available right now.\n${syncInfo.message}\n\nRecent Cooked Meat Yield Audits:\n${yieldSummary}`
    };
  }
}

export function getBBQQuickActionPrep(): string {
  const brisket = calculateCases('brisket', 100);
  const ribs = calculateCases('ribs', 40);

  const raw = `🥩 Today's Smokehouse Prep Plan:\n\n` +
    `🔥 Pitmaster Daily Forecast for ${brisket.meat}:\n` +
    `• Target Cooked: ${brisket.targetCookedLbs} lbs\n` +
    `• Required Raw Weight: ${brisket.rawLbsRequired} lbs\n` +
    `• Case Order: ${brisket.unitsDescription}\n` +
    `• Est. Servings: ~${brisket.portionsEstimate} portions\n\n` +
    `🔥 Pitmaster Daily Forecast for ${ribs.meat}:\n` +
    `• Target Cooked: ${ribs.targetCookedLbs} lbs\n` +
    `• Required Raw Weight: ${ribs.rawLbsRequired} lbs\n` +
    `• Case Order: ${ribs.unitsDescription}\n\n` +
    `Tip: Ready for fire-up at 4:00 AM EST.`;

  return purgeJargon(raw);
}

export function getBBQQuickActionNumbers(now = new Date(), file = BRIEF_FILE): string {
  const today = localDateParts(now).date;
  const yDate = new Date(now.getTime() - 24 * 3600000);
  const yesterday = localDateParts(yDate).date;
  const sync = getCloverSyncStatus();

  try {
    if (!fs.existsSync(file)) return '📊 Yellow Rose BBQ Numbers: Brief data currently unavailable.';
    const bData = JSON.parse(fs.readFileSync(file, 'utf8'));
    const bToday = bData.by_date?.[today] || bData.active_service_brief || {};
    const bYest = bData.by_date?.[yesterday];

    const out = `📊 Yellow Rose BBQ Numbers:\n` +
      `• Today (${bToday.day_full_name || today}): Target Sales $${bToday.expected_sales_usd ?? 'N/A'}${bToday.sales_diff_usd ? ` (+${bToday.sales_diff_usd})` : ''}\n` +
      `  Status: ${bToday.status_badge || 'Active Service'}\n` +
      `  Meat Cost: ~$${bToday.estimated_meat_cost_usd ?? 'N/A'} (Leaves ~$${bToday.left_after_meat_cost_usd ?? 'N/A'} for shop)\n` +
      (bYest ? `• Yesterday (${bYest.day_full_name || yesterday}): Target Sales $${bYest.expected_sales_usd ?? 'N/A'}\n` : '') +
      `• Clover POS Sync: ${sync.online ? 'ONLINE (' + (sync.lastSyncedAt ? sync.lastSyncedAt.slice(11, 16) + ' EST' : 'recent') + ')' : 'PENDING SYNC'}`;

    return purgeJargon(out);
  } catch {
    return '📊 Yellow Rose BBQ Numbers: Brief data currently unavailable.';
  }
}

export function getBBQDigestSnippet(now = new Date(), file = BRIEF_FILE): string {
  const today = localDateParts(now).date;
  const sync = getCloverSyncStatus();

  try {
    if (!fs.existsSync(file)) return `🍖 Yellow Rose BBQ (JD): Daily brief file not found.\n• ${sync.message}`;
    const bData = JSON.parse(fs.readFileSync(file, 'utf8'));
    const brief = bData.by_date?.[today] || bData.active_service_brief || {};
    const sales = brief.expected_sales_usd ? `$${brief.expected_sales_usd}` : 'N/A';
    const rush = brief.peak_rush_window || '12:00 PM – 1:30 PM Lunch Counter Rush';
    const action = brief.the_action || 'Check cutting block staging and meat temperature.';

    const raw = `🍖 Yellow Rose BBQ (JD):\n` +
      `• Target Sales: ${sales} (${brief.status_badge || 'Active Service'})\n` +
      `• Peak Rush: ${rush}\n` +
      `• Pit Action: ${action}\n` +
      `• ${sync.message}`;

    return purgeJargon(raw);
  } catch {
    return `🍖 Yellow Rose BBQ (JD): Operational snapshot currently unavailable.`;
  }
}
