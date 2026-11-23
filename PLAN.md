# PLAN.md — JD Advanced ML Analytics & Proactive Insight Engine Plan

## Milestones & Deterministic Verification Tasks

### Task 1: Baseline Workspace Backup & Spec Approval (Completed in Pre-Flight)
- **Action:** Verified `backups/archive_pre_jd_analytics_20261123.tar.gz` (`19 MB`, mode `0600`) and generated `SPEC.md`, `DESIGN.md`, `PLAN.md`.
- **Verification:** Archive exists at mode `0600`.

### Task 2: Build `services/analytics/` Micro-Engines
- **Action:**
  - Create `services/analytics/schemas.py`, `hourly_velocity.py`, `meat_depletion_timer.py`, `margin_drift_detector.py`, and `insight_synthesizer.py`.
  - Compute trailing 4-week same-day/same-hour medians (`America/New_York`), real-time meat run-out timers in physical cuts (`Packers`, `Butts`, `Racks`), and Full Food Cost % + side attachment drift.
- **Verification:** `.venv/bin/python services/analytics/insight_synthesizer.py` exits `0` with grounded JSON output.

### Task 3: Build JD Voice Contract & Message Formatter (`agents/jd/`)
- **Action:**
  - Create `agents/jd/jd_voice_contract.py` and `agents/jd/message_formatter.py`.
  - Support both **active-hour outlier alerts** (`[Boss Alert: ...]`) and **random ambient check-ins throughout the day** (*"we're pacing at..."* with Full Food Cost % included, no manual query required).
  - Enforce zero academic jargon and physical smokehouse unit formatting.
- **Verification:** `.venv/bin/python agents/jd/message_formatter.py` outputs realistic, grounded JD check-in messages.

### Task 4: Deterministic Test Suite & Adversarial Critic Audit
- **Action:**
  - Create `clover_api/tests/test_jd_analytics.py` verifying database grounding, run-out timer math, Monday closed-day guard, `[Boss Alert: ...]` rules, and zero banned jargon across 10+ generated messages.
  - Run `.venv/bin/python -m unittest discover -s clover_api/tests`.
  - Spawn independent read-only Adversarial Critic subagent (`research`) to audit 10 generated JD messages for zero hallucinations, authentic pitmaster voice, and actionable recommendations (`>= 9/10` required).
  - Update `.loop/prd.json` (`passes: true`) and `.loop/log.md`.
- **Verification:** `unittest` exits `0`; Adversarial Critic scores `>= 9/10`.
