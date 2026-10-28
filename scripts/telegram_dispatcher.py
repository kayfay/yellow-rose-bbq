#!/usr/bin/env python3
"""
Yellow Rose BBQ — Automated & Two-Way Interactive Telegram Agent
Shoots auto-generated pitmaster intelligence directly to your phone:
1. Daily Morning Pit Brief: Today's sales target, meat prep lbs, weather shift, Trevor/Max pit schedule, Nick 7 PM bus handoff, and Freddy closing.
2. Real-Time Hourly Quick-Wind Push: Immediate-present velocity surges, ticket spikes, depletion risks, and weather draft shifts with causal explanations and pit actions.
3. Two-Way On-Demand Interactivity: Answers inbound questions via Telegram ("sales", "pacing", "depletion", "brisket status", "crew", "sausage", "weather", "help").

Execution Model:
- Runs 100% locally via Linux cron (zero daemons, zero cloud cost).
- Zero PII: No customer phone numbers or credit cards are ever parsed or transmitted.
- Restricts quick-wind alerts strictly to active service hours (11:00 AM – 8:30 PM EDT). Suppresses overnight pings.
- All secrets loaded strictly from .env.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

os.umask(0o022)

ROOT = Path(__file__).resolve().parent.parent
ANALYTICS_DIR = ROOT / "clover_api" / "analytics"
QUICK_WIND_PATH = ANALYTICS_DIR / "quick_wind_alerts.json"
DAILY_BRIEF_PATH = ANALYTICS_DIR / "daily_executive_brief.json"
DASHBOARD_PAYLOAD_PATH = ANALYTICS_DIR / "dashboard_payload.json"
WEATHER_PAYLOAD_PATH = ANALYTICS_DIR / "weather_payload.json"
ML_INSIGHTS_PATH = ANALYTICS_DIR / "ml_insights.json"
HOURLY_ACTUALS_PATH = ANALYTICS_DIR / "hourly_actuals.json"
STATE_PATH = ANALYTICS_DIR / "telegram_state.json"
ENV_PATH = ROOT / ".env"
CONFIG_PATH = ROOT / "telegram_config.json"


def load_credentials() -> tuple[str, list[str], str]:
    """Loads Telegram bot token, chat ID(s), and Gemini API key from .env or environment."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    chat_ids_str = os.environ.get("TELEGRAM_CHAT_ID", "") or os.environ.get("TELEGRAM_ADMIN_IDS", "")
    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()

    if ENV_PATH.exists():
        try:
            with open(ENV_PATH, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("#") or "=" not in line:
                        continue
                    k, v = line.split("=", 1)
                    k, v = k.strip(), v.strip().strip('"').strip("'")
                    if k == "TELEGRAM_BOT_TOKEN" and not token:
                        token = v
                    elif k in ("TELEGRAM_CHAT_ID", "TELEGRAM_ADMIN_IDS") and not chat_ids_str:
                        chat_ids_str = v
                    elif k == "GEMINI_API_KEY" and not gemini_key:
                        gemini_key = v
        except Exception:
            pass

    if (not token or not chat_ids_str) and CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                if not token:
                    token = cfg.get("bot_token", "").strip()
                if not chat_ids_str:
                    c = cfg.get("chat_ids") or cfg.get("chat_id")
                    if isinstance(c, list):
                        chat_ids_str = ",".join(str(x) for x in c)
                    elif c:
                        chat_ids_str = str(c).strip()
        except Exception:
            pass

    chat_ids = [cid.strip() for cid in chat_ids_str.split(",") if cid.strip()]
    return token, chat_ids, gemini_key


def load_telegram_state() -> dict:
    if STATE_PATH.exists():
        try:
            with open(STATE_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"last_update_id": 0, "pushed_alerts": []}


def save_telegram_state(state: dict):
    try:
        with open(STATE_PATH, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2)
    except Exception as e:
        print(f"[WARN] Failed to save telegram state: {e}")


def send_telegram_message(token: str, chat_id: str, text: str, parse_mode: str = "HTML") -> bool:
    """Dispatches a message to Telegram using standard urllib without external dependencies."""
    if not token or not chat_id:
        print("[WARN] Telegram bot token or chat ID is missing. Message not sent.")
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": parse_mode,
        "disable_web_page_preview": True
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"}
    )

    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            res = json.loads(resp.read().decode("utf-8"))
            if res.get("ok"):
                return True
            else:
                print(f"[ERROR] Telegram API error: {res}")
                return False
    except Exception as e:
        print(f"[ERROR] Failed to send Telegram message: {e}")
        return False


def get_telegram_updates(token: str, offset: int = 0) -> list[dict]:
    """Retrieves unread updates from Telegram using getUpdates."""
    if not token:
        return []
    url = f"https://api.telegram.org/bot{token}/getUpdates?offset={offset}&timeout=1"
    req = urllib.request.Request(url, headers={"User-Agent": "YellowRoseBBQ-Bot/2.0"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            res = json.loads(resp.read().decode("utf-8"))
            if res.get("ok"):
                return res.get("result", [])
    except Exception as e:
        print(f"[WARN] Error fetching Telegram updates: {e}")
    return []


def get_previous_night_wrapup() -> str:
    """Extracts actual performance, orders, AOV, and evening rush stats from the last operating day."""
    if not HOURLY_ACTUALS_PATH.exists():
        return ""
    try:
        with open(HOURLY_ACTUALS_PATH, "r", encoding="utf-8") as f:
            h_data = json.load(f)
        days = h_data.get("days", {})
        if not days:
            return ""

        sorted_dates = sorted(days.keys())
        days_with_sales = []
        for d in sorted_dates:
            buckets = days[d].get("buckets", [])
            tot_s = sum(float(b.get("sales_usd", 0) or 0) for b in buckets)
            tot_o = sum(int(b.get("orders", 0) or 0) for b in buckets)
            if tot_s > 0 or tot_o > 0:
                days_with_sales.append((d, tot_s, tot_o, buckets))

        if not days_with_sales:
            return ""

        last_d, last_s, last_o, last_buckets = days_with_sales[-1]
        dt = datetime.strptime(last_d, "%Y-%m-%d")
        day_str = dt.strftime("%A, %b %d")

        lines = []
        if last_o < 10 and len(days_with_sales) > 1:
            lines.append(f"• <b>Special Catering / Advance Order ({day_str}):</b> ${last_s:,.2f} ({last_o} order • AOV ${last_s/max(1,last_o):,.2f})")
            prev_d, prev_s, prev_o, prev_buckets = days_with_sales[-2]
            prev_dt = datetime.strptime(prev_d, "%Y-%m-%d")
            prev_day_str = prev_dt.strftime("%A, %b %d")
            prev_aov = prev_s / max(1, prev_o)
            eve_s = sum(float(b.get("sales_usd", 0) or 0) for b in prev_buckets if 17 <= b.get("hour", 0) <= 20)
            eve_o = sum(int(b.get("orders", 0) or 0) for b in prev_buckets if 17 <= b.get("hour", 0) <= 20)
            meat_carved = prev_o * 0.85
            lines.append(f"• <b>Last Full Service Night ({prev_day_str}):</b> ${prev_s:,.2f} across {prev_o} tickets (AOV ${prev_aov:,.2f})")
            lines.append(f"• <b>Evening Rush (5–8 PM):</b> ${eve_s:,.2f} ({eve_o} tickets • ~{meat_carved:.0f} lbs meat carved)")
        else:
            aov = last_s / max(1, last_o)
            eve_s = sum(float(b.get("sales_usd", 0) or 0) for b in last_buckets if 17 <= b.get("hour", 0) <= 20)
            eve_o = sum(int(b.get("orders", 0) or 0) for b in last_buckets if 17 <= b.get("hour", 0) <= 20)
            meat_carved = last_o * 0.85
            lines.append(f"• <b>Previous Service ({day_str}):</b> ${last_s:,.2f} across {last_o} tickets (AOV ${aov:,.2f})")
            lines.append(f"• <b>Evening Rush (5–8 PM):</b> ${eve_s:,.2f} ({eve_o} tickets • ~{meat_carved:.0f} lbs meat carved)")

        return "\n".join(lines)
    except Exception:
        return ""


def get_operational_attentions() -> list[str]:
    """Retrieves urgent heads-ups, Quick-Wind flags, weather alerts, and shift handoffs for today."""
    attentions = []

    # 1. Quick-Wind Alert Flag
    if QUICK_WIND_PATH.exists():
        try:
            with open(QUICK_WIND_PATH, "r", encoding="utf-8") as f:
                qw = json.load(f)
                active = qw.get("active_alert", {})
                if active and active.get("severity") in ("surge", "warning", "weather"):
                    badge = active.get("severity_badge", "⚡ Quick-Wind Alert")
                    headline = active.get("headline", "")
                    action = active.get("recommended_pit_action", "")
                    attentions.append(f"• <b>{badge}:</b> {headline}\n  <i>Pit Action:</i> {action}")
        except Exception:
            pass

    # 2. Weather & Stack Draft Flag
    if WEATHER_PAYLOAD_PATH.exists():
        try:
            with open(WEATHER_PAYLOAD_PATH, "r", encoding="utf-8") as f:
                w = json.load(f).get("current", {})
                cond = w.get("condition", "Clear")
                precip = float(w.get("precipitation", 0.0) or 0.0)
                temp = float(w.get("temperature_f", 72.0) or 72.0)
                if precip > 0.05 or cond in ("Rain", "Thunderstorm", "Drizzle"):
                    attentions.append(f"• <b>🌧️ Stack Draft Warning ({cond}):</b> Outer chimney steel cooling suppresses draw by 10-15°F. Crack firebox air damper +10% to sustain 250°F post oak burn; stage extra carryout bags.")
                elif temp < 55:
                    attentions.append(f"• <b>❄️ Chilly Morning ({temp:.0f}°F):</b> Pre-heat pits 20 mins longer before meat loading; monitor warming cabinet door seals.")
        except Exception:
            pass

    # 3. Scale Tare & Trim Loss Invariant
    attentions.append("• <b>⚖️ Scale Tare & Yield Invariant:</b> Zero counter scale with butcher paper tare before slicing flat brisket. Trevor's brisket trim target strictly &lt;18% loss to preserve 50.8% cooked yield.")

    # 4. Menu Pricing & Margin Watch
    attentions.append("• <b>🏷️ Menu Board Margin Watch:</b> Audit physical menu board vs Clover terminal ($13 menu photo vs $17 modeled brisket sandwich). Prompt sides ($4.00) and drinks ($2.95) to protect 68%+ gross margin.")

    # 5. Critical Evening Transit Handoff
    attentions.append("• <b>⚠️ 07:00 PM Transit Handoff:</b> Nick departs sharp at 7:00 PM for the bus. Transition primary cutting block and grill lead to Freddy by 6:45 PM; Elly commands closing expo.")

    return attentions


def build_morning_brief_message() -> str:
    """Builds a rich, high-contrast HTML summary of previous night wrap-up, alerts, today's targets, staff, and tips."""
    now = datetime.now(ZoneInfo("America/New_York"))
    today_str = now.strftime("%A, %B %d, %Y")
    day_name = now.strftime("%a")

    forecast = {}
    is_closed = (day_name == "Mon")
    if DASHBOARD_PAYLOAD_PATH.exists():
        try:
            with open(DASHBOARD_PAYLOAD_PATH, "r", encoding="utf-8") as f:
                dash = json.load(f)
                records = dash.get("forecast", {}).get("forecast_records", [])
                for r in records:
                    if r.get("day_name") == day_name:
                        forecast = r
                        is_closed = r.get("is_closed", False)
                        break
        except Exception:
            pass

    weather_summary = "75°F • Typical smokehouse draft"
    if WEATHER_PAYLOAD_PATH.exists():
        try:
            with open(WEATHER_PAYLOAD_PATH, "r", encoding="utf-8") as f:
                w = json.load(f)
                curr = w.get("current", {})
                weather_summary = f"{curr.get('temperature_f', 72):.0f}°F • {curr.get('condition', 'Clear')} • Wind {curr.get('wind_speed_mph', 5):.0f} mph"
        except Exception:
            pass

    rev = forecast.get("predicted_revenue", 0.0)
    brisket_raw = forecast.get("brisket_raw_lbs", 0.0)
    pork_raw = forecast.get("pork_shoulder_raw_lbs", 0.0)
    ribs_racks = forecast.get("pork_ribs_racks", 0)
    sausage_lbs = forecast.get("sausage_lbs", 0.0)

    if is_closed:
        status_line = "🔴 <b>STATUS: MONDAY CLOSED (PIT COLD &amp; MAINTENANCE)</b>"
        sales_section = "<i>Smokers dark. Focus on deep cleaning, supplier delivery check-in, and dry rub restocking.</i>"
    else:
        status_line = f"🟢 <b>STATUS: ACTIVE SERVICE DAY</b>"
        sales_section = (
            f"💰 <b>Projected Revenue:</b> ${rev:,.2f}\n"
            f"🥩 <b>Raw Prep Targets:</b> {brisket_raw:.0f} lbs Brisket (~{brisket_raw/13.5:.1f} packers) | {pork_raw:.0f} lbs Butt | {ribs_racks} Racks Ribs | {sausage_lbs:.0f} lbs Sausage"
        )

    # Previous night wrap-up
    wrapup = get_previous_night_wrapup()
    wrapup_section = ""
    if wrapup:
        wrapup_section = f"🌙 <b>PREVIOUS NIGHT WRAP-UP (Closing Service Intel):</b>\n{wrapup}\n\n"

    # Alerts and attentions
    attentions_list = get_operational_attentions()
    attentions_section = ""
    if attentions_list:
        attentions_section = "🚨 <b>ALERTS &amp; ATTENTIONS (Things You Should Know Today):</b>\n" + "\n".join(attentions_list) + "\n\n"

    msg = f"""🔥 <b>YELLOW ROSE BBQ — DAILY PITMASTER BRIEFING</b>
📅 <b>{today_str}</b>
{status_line}

{wrapup_section}{attentions_section}🎯 <b>TODAY'S PRODUCTION TARGETS:</b>
{sales_section}
🌦️ <b>Weather:</b> {weather_summary}

👥 <b>CREW ROSTER &amp; CRITICAL HANDOFFS:</b>
• <b>02:30 AM (Smoker Crew):</b> <b>Trevor</b> fires pit, trims briskets (&lt;18% loss), rubs &amp; loads big/small pits.
• <b>08:00 AM (Smoker Crew):</b> <b>Max</b> takes over active pit, wraps, probes, and manages 140°F holding.
• <b>08:30 AM (Kitchen Open):</b> <b>Jake</b> opens kitchen line; <b>Alyssa</b> opens expo (fries &amp; mac prep); <b>Allen</b> crafts fresh sausage &amp; Rosebuds + runs dish pit.
• <b>02:00 PM:</b> <b>Nick</b> arrives for night prep; <b>Allen</b> mid-shift break; <b>Jake</b> transitions to evening (leaves 5–7 PM or doubles).
• <b>06:00 PM:</b> <b>The Boss</b> steps in for pit relief &amp; oversees evening pit coal shutdown.
• <b>07:00 PM (⚠️ CRITICAL):</b> <b>Nick</b> departs for the bus. <b>Freddy</b> takes over slicing/grill; <b>Elly</b> leads expo closing.
• <b>Close:</b> <b>Freddy</b>, <b>Elly</b> &amp; <b>Allen</b> complete kitchen breakdown, dish pit sanitation, and lockup.

💡 <b>KEY SMOKEHOUSE WATCHLIST:</b>
1. <b>Scale Tare:</b> Zero counter scale with butcher paper tare to protect 29.5% food cost ratio.
2. <b>Holding Temp:</b> Ensure warming cabinet holds solid at 145°F–150°F (never below 140°F).
3. <b>Carving:</b> Slice brisket flat strictly to order to avoid losing 15% moisture in 6 mins.

📲 <i>Reply with 'sales', 'pacing', 'depletion', 'brisket', 'crew', 'sausage', or 'help' for live updates.</i>"""
    return msg


def build_quick_wind_message(alert: dict) -> str:
    """Builds an immediate-present real-time push alert for Telegram."""
    badge = alert.get("severity_badge", "⚡ Quick-Wind Alert")
    headline = alert.get("headline", "Live Clover Velocity Event")
    present = alert.get("immediate_present_status", "Activity detected on Clover POS.")
    cause = alert.get("causal_explanation", "Normal volume tracking.")
    action = alert.get("recommended_pit_action", "Maintain standard pit operations.")
    time_str = alert.get("hour_formatted", datetime.now().strftime("%H:00"))
    metrics = alert.get("velocity_metrics", {})

    metrics_text = ""
    if "actual_orders" in metrics:
        metrics_text += f"\n📊 <b>Orders:</b> {metrics.get('actual_orders')} /hr (expected {metrics.get('expected_orders')})"
    if "actual_sales" in metrics:
        metrics_text += f"\n💵 <b>Sales:</b> ${metrics.get('actual_sales', 0):.0f} /hr (expected ${metrics.get('expected_sales', 0):.0f})"
    if "aov" in metrics:
        metrics_text += f"\n🏷️ <b>AOV (Avg Ticket):</b> ${metrics.get('aov', 0):.2f}"
    if "z_score" in metrics:
        metrics_text += f"\n📈 <b>Z-Score:</b> {metrics.get('z_score', 0):+.2f}"

    msg = f"""🚨 <b>YELLOW ROSE BBQ — REAL-TIME HOURLY ALERT</b>
⏰ <b>Hour {time_str} Live Scan</b> | {badge}

<b>{headline}</b>
{metrics_text}

⏱️ <b>WHAT'S HAPPENING RIGHT NOW:</b>
{present}

🔍 <b>WHY THIS HAPPENED:</b>
{cause}

🔥 <b>ACTIONABLE PITMASTER STEPS:</b>
{action}

<i>(Auto-scanned from hourly Clover POS transactions)</i>"""
    return msg


# ---------------------------------------------------------------------------
# Inbound Natural Language & Query Answering
# ---------------------------------------------------------------------------

def answer_smokehouse_query(query: str, gemini_key: str = "") -> str:
    """Answers user's inbound Telegram questions with real-time repo facts."""
    q = query.lower().strip()

    # 1. Help Menu
    if q in ("/start", "/help", "help", "menu", "commands"):
        return (
            "🤠 <b>YELLOW ROSE BBQ — SMOKEHOUSE BOT COMMANDS</b>\n\n"
            "Ask me anything or send a keyword:\n"
            "• 💰 <b>'sales'</b> — Today's sales pacing, projected revenue & ticket count\n"
            "• ⚡ <b>'pacing'</b> or <b>'velocity'</b> — Current hourly rush speed & Z-Score\n"
            "• 🥩 <b>'depletion'</b> or <b>'meat draw'</b> — Slicing burn rate & sellout risk\n"
            "• 🪵 <b>'brisket'</b> or <b>'pit'</b> — Smoker capacity, raw target & holding temp\n"
            "• 👥 <b>'crew'</b> or <b>'roster'</b> — Station responsibilities & 7 PM transit handoff\n"
            "• 🌭 <b>'sausage'</b> or <b>'recipes'</b> — 50 lb 70:30 formulations & Rosebuds\n"
            "• 🌦️ <b>'weather'</b> or <b>'draft'</b> — Rain, chimney draft & damper guidance\n"
            "• 🚨 <b>'alert'</b> — Latest Quick-Wind velocity surge status\n\n"
            "<i>You can also ask freeform questions like 'what should we prep if it rains?'</i>"
        )

    # 2. Sales & Revenue
    if any(k in q for k in ("sale", "revenue", "money", "today", "target")):
        now = datetime.now(ZoneInfo("America/New_York"))
        day_name = now.strftime("%a")
        if day_name == "Mon":
            return (
                "🔴 <b>STATUS: MONDAY CLOSED (PIT COLD &amp; MAINTENANCE)</b>\n"
                "• <b>Operating Target:</b> Smokers dark today ($0 sales / 0 orders).\n"
                "• <b>Focus:</b> Deep pit cleaning, US Foods delivery invoice check-in, and dry rub restocking.\n"
                "• <b>Active Service:</b> Tuesday through Sunday (11:00 AM – 8:30 PM EDT)."
            )

        proj_rev = 0.0
        if DASHBOARD_PAYLOAD_PATH.exists():
            try:
                with open(DASHBOARD_PAYLOAD_PATH, "r", encoding="utf-8") as f:
                    dash = json.load(f)
                    for r in dash.get("forecast", {}).get("forecast_records", []):
                        if r.get("day_name") == day_name:
                            proj_rev = r.get("predicted_revenue", 0.0)
                            break
            except Exception:
                pass
        return (
            f"💰 <b>SALES &amp; REVENUE INTEL</b>\n"
            f"• <b>Projected Daily Sales:</b> ${proj_rev:,.2f}\n"
            f"• <b>Operating Target:</b> 29.5% Food Cost ($17 AOV target on individual items, $54-$145 on family trays)\n"
            f"• <b>High-Margin Stars:</b> Homemade Sausage ($1.25 cost / $7.00 retail = 82% margin) and Rosebuds ($5.00)\n"
            f"• <b>Audit Watch:</b> Zero counter scale with butcher paper tare before slicing flat brisket."
        )

    # 3. Pacing & Hourly Rush Velocity
    if any(k in q for k in ("pace", "pacing", "velocity", "rush", "orders", "speed")):
        qw = {}
        if QUICK_WIND_PATH.exists():
            try:
                with open(QUICK_WIND_PATH, "r", encoding="utf-8") as f:
                    qw = json.load(f).get("active_alert", {})
            except Exception:
                pass
        headline = qw.get("headline", "Velocity Normal")
        z = qw.get("velocity_metrics", {}).get("z_score", 0.0)
        orders = qw.get("velocity_metrics", {}).get("actual_orders", 12)
        return (
            f"⚡ <b>SERVICE PACING &amp; VELOCITY SCAN</b>\n"
            f"• <b>Current State:</b> {headline}\n"
            f"• <b>Order Rate:</b> {orders} tickets/hour (Z-Score: {z:+.2f})\n"
            f"• <b>Peak Rush Windows:</b> 12:00 PM – 1:30 PM (lunch rush, high taco/sandwich mix) &amp; 5:30 PM – 7:00 PM (dinner rush, high platter mix)\n"
            f"• <b>Action:</b> If Z-Score &gt; +1.2, open secondary slicing station and stage 2 rested briskets from holding."
        )

    # 4. Depletion & Meat Draw
    if any(k in q for k in ("deplet", "meat draw", "burn", "sellout", "86", "run out")):
        return (
            "🥩 <b>MEAT DRAW &amp; DEPLETION BURN RATE</b>\n"
            "• <b>Average Meat Draw:</b> ~0.85 lbs meat per guest ticket\n"
            "• <b>Depletion Warning Threshold:</b> If 70% of daily PAR is consumed prior to 3:30 PM, prime brisket will 86 before 6:00 PM.\n"
            "• <b>Sellout Mitigation:</b> Cap bulk to-go brisket orders at 1.5 lbs/guest; guide walk-ins to pulled pork combos and handmade sausage links ($5/link); update social sellout banner."
        )

    # 5. Brisket, Smoker, & Pit
    if any(k in q for k in ("brisket", "pit", "smoker", "holding", "damper", "tallow")):
        return (
            "🪵 <b>PITMASTER &amp; SMOKER GEOMETRY</b>\n"
            "• <b>Total Smoker Capacity:</b> 24 briskets max (14 big offset pit + 10 small pit = ~336 lbs raw load).\n"
            "• <b>Trevor's Spec:</b> 2:30 AM pit ignition with post oak coal bed; trim briskets strictly &lt;18% loss to preserve 50.8% cooked yield.\n"
            "• <b>Max's Spec:</b> 8:00 AM handoff; manage airflow dampers, spritz, peach paper wrap at 165°F stall; probe tender ~203°F.\n"
            "• <b>Holding Cabinet:</b> Meats rest in 140°F–150°F tallow warming cabinet until carving. Never allow holding temp below 140°F."
        )

    # 6. Crew Roster & Staff Schedule
    if any(k in q for k in ("crew", "roster", "staff", "schedule", "who", "nick", "freddy", "trevor", "max", "jake", "elly", "alyssa")):
        return (
            "👥 <b>STAFF ROSTER &amp; OPERATIONAL HANDOFFS</b>\n\n"
            "<b>SMOKER CREW (Strictly Pit Operations):</b>\n"
            "• <b>Trevor:</b> 2:30 AM fire, oak coal bed, brisket trimming (&lt;18% loss), meat rubs, smoker loading.\n"
            "• <b>Max:</b> 8:00 AM–6:00 PM airflow dampers, wraps, internal probes, 140°F holding cabinet.\n"
            "• <b>The Boss:</b> Early pit relief &amp; 6:00 PM pit coal shutdown.\n"
            "<i>(Note: Neither Nick nor Freddy work on smoker crew; both are dedicated to kitchen line.)</i>\n\n"
            "<b>KITCHEN LINE &amp; EXPO:</b>\n"
            "• <b>Jake:</b> 8:30 AM kitchen line open, leads morning hot prep (leaves 5–7 PM or doubles).\n"
            "• <b>Nick:</b> 2:00 PM–7:00 PM night station prep. <b>CRITICAL:</b> Leaves sharp at 7:00 PM for the bus!\n"
            "• <b>Freddy:</b> Closes kitchen; takes over cutting block and grill lead prior to 7:00 PM.\n"
            "• <b>Elly:</b> Senior lead, runs expo floor, sides replenishment, closes expo.\n"
            "• <b>Alyssa:</b> Opens expo, preps fries, mac &amp; cheese, and portion cups.\n"
            "• <b>Stan:</b> Alternate expo shifts.\n\n"
            "<b>SPECIALTY CRAFTING &amp; DISH PIT:</b>\n"
            "• <b>Allen (User):</b> Crafts 50 lb custom sausage formulations (70:30 grind), hand-rolls fresh Rosebuds, runs dish pit open to close (with mid-shift break)."
        )

    # 7. Sausage Formulations & Rosebuds
    if any(k in q for k in ("sausage", "recipe", "formulation", "rosebud", "elote", "verde", "birria", "cabbage")):
        return (
            "🌭 <b>HOUSE SAUSAGE &amp; ROSEBUD CRAFTING SPECS</b>\n"
            "• <b>50 lb Base Block:</b> 35 lbs beef trimmings (from brisket trim) + 15 lbs beef fat = 70:30 lean-to-fat grind.\n"
            "• <b>Cure Salt:</b> Exactly 60g Pink Curing Salt #1 per 50 lb batch; mix to emulsified tacky bind, stuff into natural 32-35mm hog casings, twist 6-inch links.\n"
            "• <b>6 Custom Recipes:</b>\n"
            "  1. <i>The Elote:</i> 5-7.5 lbs smoked corn pico, 2.5 lbs parmesan, cilantro/onion, coarse black pepper.\n"
            "  2. <i>The Salsa Verde:</i> 2.5 lbs salsa verde, 5 lbs melty cheese, cilantro/onion.\n"
            "  3. <i>Sweet Bacon &amp; Cream Cheese:</i> 5 lbs cream cheese, 5 lbs cooked bacon, honey drizzle, signature BBQ rub.\n"
            "  4. <i>Garlic Parmesan:</i> 1.5-2.5 lbs sautéed minced garlic, 5 lbs parmesan, signature rub.\n"
            "  5. <i>Farmhouse Cabbage &amp; Bacon:</i> 5-7.5 lbs sautéed cabbage, 5 lbs bacon bits, garlic, black pepper.\n"
            "  6. <i>Garlic Birria &amp; Cheese:</i> 10 lbs birria meat/reduced consommé, 5 lbs cheese, sautéed garlic, diced onion.\n"
            "• <b>Rosebuds:</b> Hand-rolled fresh daily by Allen; prime appetizer with high margin ($5.00 retail)."
        )

    # 8. Weather & Chimney Stack Draft
    if any(k in q for k in ("weather", "rain", "wind", "temp", "draft", "stack")):
        w_summary = "75°F • Typical smokehouse draft"
        if WEATHER_PAYLOAD_PATH.exists():
            try:
                with open(WEATHER_PAYLOAD_PATH, "r", encoding="utf-8") as f:
                    w = json.load(f).get("current", {})
                    w_summary = f"{w.get('temperature_f', 72):.0f}°F • {w.get('condition', 'Clear')} • Wind {w.get('wind_speed_mph', 5):.0f} mph • Precip: {w.get('precipitation', 0):.2f}\""
            except Exception:
                pass
        return (
            f"🌦️ <b>WEATHER &amp; SMOKER DRAFT CONDITIONS</b>\n"
            f"• <b>Live Stats:</b> {w_summary}\n"
            f"• <b>Stack Draft Physics:</b> Cold air or active rain cools outer steel chimney pipes, suppressing natural draw by 10-15°F.\n"
            f"• <b>Pitmaster Correction:</b> Crack firebox air intake damper +10-15% during rain to maintain 250°F post oak combustion; switch meat wraps to double butcher paper.\n"
            f"• <b>Takeout Shift:</b> Rain increases high-ticket family takeout platters (+20% packaging staging required)."
        )

    # 9. Latest Quick-Wind Alert
    if any(k in q for k in ("alert", "quick wind", "quick-wind", "surge", "warning")):
        if QUICK_WIND_PATH.exists():
            try:
                with open(QUICK_WIND_PATH, "r", encoding="utf-8") as f:
                    active = json.load(f).get("active_alert", {})
                    if active:
                        return build_quick_wind_message(active)
            except Exception:
                pass
        return "⚡ <b>Quick-Wind Status:</b> All pit metrics nominal. No active rushes or depletion warnings detected."

    # 10. Natural Language Fallback (Gemini API if key available)
    if gemini_key:
        try:
            prompt = (
                f"You are the autonomous Yellow Rose BBQ Smokehouse Intelligence Agent. "
                f"Answer the following user question concisely (max 3-4 bullet points or short paragraph) using Texas BBQ pitmaster wisdom. "
                f"Ground facts: We use post oak, offset pits (24 briskets max: 14 big, 10 small), Trevor fires at 2:30 AM (brisket trim <18%), "
                f"Max works 8 AM-6 PM (dampers/wraps/140F holding), The Boss relieves at 6 PM, Jake opens kitchen line at 8:30 AM, Nick departs sharp at 7:00 PM for the bus, "
                f"Freddy closes kitchen/cutting block, Elly leads closing expo, Alyssa opens expo, Allen crafts 50 lb custom sausage (70:30 beef-to-fat grind) and Rosebuds and runs dish pit open-to-close. "
                f"Question: {query}"
            )
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={gemini_key}"
            body = {
                "contents": [{"parts": [{"text": prompt}]}]
            }
            req = urllib.request.Request(
                url,
                data=json.dumps(body).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                res = json.loads(resp.read().decode("utf-8"))
                text = res["candidates"][0]["content"]["parts"][0]["text"].strip()
                return f"🤖 <b>PITMASTER AI INTEL:</b>\n{text}"
        except Exception:
            pass

    # Generic Helpful Fallback
    return (
        f"🤠 I received: '<i>{query}</i>'\n\n"
        "Here are key quick queries you can run right now:\n"
        "• <b>'sales'</b> — Today's revenue & AOV\n"
        "• <b>'pacing'</b> — Rush speed & Z-Score\n"
        "• <b>'depletion'</b> — Slicing burn rate\n"
        "• <b>'brisket'</b> — Smoker load & holding\n"
        "• <b>'crew'</b> — Staff shift handoffs\n"
        "• <b>'sausage'</b> — 50 lb recipes & specs\n"
        "• <b>'weather'</b> — Stack draft & damper tips\n"
        "• <b>'help'</b> — Full command menu"
    )


def process_inbound_messages() -> int:
    """Checks for new inbound messages sent to the bot, answers them, and saves state."""
    token, chat_ids, gemini_key = load_credentials()
    if not token or not chat_ids:
        return 0

    state = load_telegram_state()
    last_update_id = state.get("last_update_id", 0)

    updates = get_telegram_updates(token, offset=last_update_id + 1)
    if not updates:
        return 0

    processed_count = 0
    for u in updates:
        uid = u.get("update_id", 0)
        if uid > last_update_id:
            last_update_id = uid

        msg = u.get("message") or u.get("edited_message")
        if not msg:
            continue

        from_chat = str(msg.get("chat", {}).get("id", ""))
        text = msg.get("text", "").strip()

        # Authorization check: only respond to authorized chat IDs
        if from_chat not in chat_ids:
            print(f"[SECURITY] Ignored message from unauthorized chat_id {from_chat}")
            continue

        if not text:
            continue

        print(f"[INBOUND] Received query from {from_chat}: '{text}'")
        reply = answer_smokehouse_query(text, gemini_key=gemini_key)
        send_telegram_message(token, from_chat, reply)
        processed_count += 1

    state["last_update_id"] = last_update_id
    save_telegram_state(state)
    return processed_count


# ---------------------------------------------------------------------------
# Outbound Dispatch Handlers
# ---------------------------------------------------------------------------

def dispatch_morning_brief() -> bool:
    token, chat_ids, _ = load_credentials()
    if not token or not chat_ids:
        print("[INFO] Telegram credentials not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.")
        return False

    text = build_morning_brief_message()
    success = True
    for cid in chat_ids:
        ok = send_telegram_message(token, cid, text)
        if not ok:
            success = False
        else:
            print(f"[SUCCESS] Dispatched Morning Brief to Telegram chat {cid}")
    return success


def dispatch_quick_wind() -> bool:
    if not QUICK_WIND_PATH.exists():
        print(f"[INFO] No quick wind payload at {QUICK_WIND_PATH}")
        return False

    with open(QUICK_WIND_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    active = data.get("active_alert")
    if not active:
        print("[INFO] No active alert found.")
        return False

    # Only auto-push if severity is surge, warning, or weather (avoid nominal info pings)
    severity = active.get("severity", "info")
    if severity not in ("surge", "warning", "weather"):
        print(f"[INFO] Active alert is '{severity}' (nominal). Skipping auto-push to prevent notification fatigue.")
        return False

    # Restrict Quick-Wind alerts strictly to active counter service hours (11:00 AM - 8:30 PM EDT)
    now = datetime.now(ZoneInfo("America/New_York"))
    if now.strftime("%a") == "Mon":
        print(f"[INFO] Monday is CLOSED (pit cold). Alert '{active.get('alert_id')}' suppressed.")
        return False

    if now.hour < 11 or now.hour > 20 or (now.hour == 20 and now.minute > 30):
        print(f"[INFO] Outside active counter service hours (11:00 AM - 8:30 PM). Alert '{active.get('alert_id')}' suppressed.")
        return False

    # Suppress duplicate alerts already sent
    state = load_telegram_state()
    pushed = state.get("pushed_alerts", [])
    alert_id = active.get("alert_id", "")
    if alert_id in pushed:
        print(f"[INFO] Alert '{alert_id}' already pushed previously. Skipping duplicate push.")
        return False

    token, chat_ids, _ = load_credentials()
    if not token or not chat_ids:
        print("[INFO] Telegram credentials not configured. Alert generated but not pushed.")
        return False

    text = build_quick_wind_message(active)
    success = True
    for cid in chat_ids:
        ok = send_telegram_message(token, cid, text)
        if not ok:
            success = False
        else:
            print(f"[SUCCESS] Pushed Quick-Wind alert '{alert_id}' to Telegram chat {cid}")

    if success:
        pushed.append(alert_id)
        # Keep recent 50 alert IDs
        state["pushed_alerts"] = pushed[-50:]
        save_telegram_state(state)

    return success


def dispatch_test() -> bool:
    token, chat_ids, _ = load_credentials()
    if not token or not chat_ids:
        print("[ERROR] Cannot send test. Please provide TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.")
        return False

    test_msg = (
        "🚀 <b>Yellow Rose BBQ — Autonomous Smokehouse Agent Connected!</b>\n\n"
        "Your unified pitmaster intelligence dispatcher is active:\n"
        "1. 📋 <b>Daily Morning Pit Brief</b> (6:30 AM Sales, Prep Lbs, Crew Schedule &amp; Tips)\n"
        "2. ⚡ <b>Hourly Quick-Wind Alerts</b> (11:00 AM – 8:30 PM Order rushes, meat depletion, catering tickets &amp; draft shifts)\n"
        "3. 💬 <b>Two-Way On-Demand Answers</b> (Text 'sales', 'pacing', 'depletion', 'brisket', 'crew', 'sausage', or 'help' anytime!)\n\n"
        "<i>Running 100% locally via local cron with $0.00 cloud costs and zero background services.</i>"
    )

    success = True
    for cid in chat_ids:
        ok = send_telegram_message(token, cid, test_msg)
        if ok:
            print(f"[SUCCESS] Test message successfully delivered to Telegram chat {cid}!")
        else:
            print(f"[ERROR] Failed delivering test message to {cid}.")
            success = False
    return success


def dispatch_auto() -> bool:
    """Automated smart dispatch for hourly cron.
    1. Checks for inbound user messages and answers them immediately.
    2. Sends morning briefing if in the 6:00-7:00 AM window.
    3. Checks and pushes active quick-wind alerts if within 11:00 AM - 8:30 PM service hours."""
    now = datetime.now(ZoneInfo("America/New_York"))
    day_name = now.strftime("%a")
    hour = now.hour
    minute = now.minute
    sent_something = False

    # Check for Monday (closed day)
    if day_name == "Mon":
        print("[INFO] Monday is CLOSED (pit cold). Outbound alerts suppressed.")
        # Still answer incoming questions if user messages the bot on Monday
        inbound_count = process_inbound_messages()
        if inbound_count > 0:
            print(f"[INFO] Processed and answered {inbound_count} inbound user queries.")
            return True
        return False

    # 1. Process any pending inbound messages
    print("[INFO] Checking inbound Telegram queries...")
    inbound_count = process_inbound_messages()
    if inbound_count > 0:
        print(f"[INFO] Processed and answered {inbound_count} inbound user queries.")
        sent_something = True

    # 2. Morning briefing window (6:00 AM - 7:00 AM)
    state = load_telegram_state()
    today_date = now.strftime("%Y-%m-%d")
    last_brief_date = state.get("last_morning_brief_date", "")

    if hour == 6 and today_date != last_brief_date:
        print(f"[INFO] Current time is {hour}:{minute:02d} EDT. Dispatching Daily Morning Briefing...")
        if dispatch_morning_brief():
            state["last_morning_brief_date"] = today_date
            save_telegram_state(state)
            sent_something = True

    # 3. Quick-Wind velocity scan
    print("[INFO] Checking active Quick-Wind alerts...")
    if dispatch_quick_wind():
        sent_something = True

    return sent_something


def poll_loop(poll_interval: int = 5):
    """Interactive console listener for on-demand local terminal testing."""
    print(f"[*] Starting Yellow Rose BBQ interactive Telegram polling listener (Ctrl+C to stop)...")
    try:
        while True:
            process_inbound_messages()
            time.sleep(poll_interval)
    except KeyboardInterrupt:
        print("\n[*] Polling listener stopped.")


def main():
    parser = argparse.ArgumentParser(description="Yellow Rose BBQ Telegram Intelligence Agent")
    parser.add_argument("--auto", action="store_true", help="Hourly smart mode: inbound queries + 6:30 AM morning brief + daytime quick-wind alerts")
    parser.add_argument("--brief", action="store_true", help="Send daily morning pit briefing")
    parser.add_argument("--quick-wind", action="store_true", help="Check and push active quick-wind alerts")
    parser.add_argument("--test", action="store_true", help="Send test connection message")
    parser.add_argument("--inbound", action="store_true", help="Process pending inbound user messages and reply")
    parser.add_argument("--listen", "--poll", action="store_true", dest="listen", help="Run interactive terminal listener for inbound chat")
    args = parser.parse_args()

    if args.test:
        sys.exit(0 if dispatch_test() else 1)
    elif args.inbound:
        count = process_inbound_messages()
        print(f"[INFO] Handled {count} inbound messages.")
        sys.exit(0)
    elif args.listen:
        poll_loop()
    elif args.auto:
        sys.exit(0 if dispatch_auto() else 0)
    elif args.brief:
        sys.exit(0 if dispatch_morning_brief() else 1)
    elif args.quick_wind:
        sys.exit(0 if dispatch_quick_wind() else 1)
    else:
        print("Yellow Rose BBQ Telegram Agent Ready. Previewing today's morning briefing:\n")
        print(build_morning_brief_message())


if __name__ == "__main__":
    main()
