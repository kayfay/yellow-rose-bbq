# Yellow Rose BBQ — Agent Guide

`CLAUDE.md` is a symlink to this file. Edit `AGENTS.md` only.

## 1. Project Overview & Tech Stack

A static single-page app for kitchen-line production and owner BI: meat prep forecasts, a recipe/sausage calculator, and POS analytics. It is served from GitHub Pages (`CNAME`). An hourly Python pipeline pulls Clover POS data and commits the precomputed JSON/JS payloads that the SPA reads.

| Layer | Tech | Where |
|---|---|---|
| Frontend | Vanilla JS (no bundler, no framework), D3 v7, Plotly 2.35 (vendored `.min.js`) | `index.html`, `app.js`, `d3_charts.js`, `tz_utils.js`, `style.css` |
| Analytics pipeline | Python 3.11 (CI) / 3.13 (local), polars, pandas, statsmodels, xgboost, scikit-learn | `clover_api/`, `clover_api/analytics/`, `scripts/`, `generate_historical_payload.py` |
| Payload bundle | Generated JS consumed by the SPA | `clover_api/analytics/payloads.js` ← `clover_api/analytics/build_payloads.py` |
| E2E tests | Playwright (chromium), Node 20 in CI | `tests/e2e/*.spec.js`, `playwright.config.js`, `run_tests.sh` |
| Python tests | `unittest` (pytest is **not** installed) | `clover_api/tests/` |
| Cloudflare Workers | Wrangler, ES modules | `sync_trigger/` (hourly cron → `workflow_dispatch`), `access_agent/` (Telegram Zero Trust bot) |
| CI | GitHub Actions | `.github/workflows/ci.yml`, `.github/workflows/update_clover_data.yml` |

Package managers: `npm` (`package.json`, `package-lock.json`) and `pip` (`requirements.txt`). There is no `pyproject.toml`.

Reference docs: `DATA_LOCATIONS.md` (where data lives), `CODING_STANDARDS.md` (review rules), `VIZ_PLAN.md`, `VERSION_PLAN.md`, `CHANGELOG.md`.

**Legacy, do not import or modify:** root `fix_*.py` / `patch*.js` one-offs and everything in `archive/`.

## 2. Container & Execution Blueprint

There is no Docker setup: no `Dockerfile`, no compose file. Do not invent `docker compose exec` commands. Execution is local and runs in two sandboxes:

- **Python:** the virtualenv `.venv` (Python 3.13, has polars/xgboost/sklearn/statsmodels). Always run `.venv/bin/python <script>`. `.venv4` does not exist; older docs that mention it are wrong.
- **Browser:** `run_tests.sh` **regenerates `local_server.py`**, starts it on `127.0.0.1:8013`, and blocks dotfiles plus `.env`/`.db`/`.sqlite`. Then it runs Playwright with `CI=1` (2 retries). Port 8013 must be free.
- **Workers:** run commands from inside `sync_trigger/` or `access_agent/`. Deploying with `npx wrangler deploy` is outward-facing: ask first.

## 3. Mandatory Verification Commands

Run these from the repo root before claiming any change is done:

```bash
npm run check                                              # node --check app.js d3_charts.js (mirrors CI)
npm test                                                   # Playwright E2E via run_tests.sh; extra args pass through, e.g. npm test -- tests/e2e/layout_order.spec.js
.venv/bin/python -m unittest discover -s clover_api/tests  # Python pipeline + menu-map unit tests
```

Scope-specific checks:

```bash
node --check tz_utils.js                                   # if touched (not covered by npm run check)
.venv/bin/python clover_api/analytics/build_payloads.py    # after changing any analytics JSON shape; rebuilds payloads.js
.venv/bin/python scripts/verify_<area>.py                  # deterministic verifiers, e.g. verify_v2_facelift_pal.py, verify_bi_insight_engine.py
(cd access_agent && npm test && npm run check)
node --check sync_trigger/src/index.js
```

There is no typechecker and no linter configured. `npm run check` is the CI "lint" gate.

Notes:
- The pipeline unit tests write payload JSON under `clover_api/analytics/`. Run `git status` afterwards and do not commit incidental data churn.
- When reporting E2E results, give exact pass/fail/flaky counts. Compare failures against untouched `HEAD` before calling them pre-existing.

## 4. 3-Layer State Architecture (`.loop/`) — Mandatory

Persist work state across sessions in `.loop/`, which is tracked in git:

1. **`.loop/prd.json`**: the backlog. Format: `{"tasks":[{"id","description","acceptance_criteria","passes"}]}`. Add a task before starting non-trivial work. Set `passes: true` only after the verification commands above succeed.
2. **`.loop/patterns.md`**: durable invariants (yields, formulas, UI/security rules). **Hard cap: 40 lines.** Consolidate or prune before adding. Never duplicate what is in this file.
3. **`.loop/log.md`**: append-only audit log. Add one `## YYYY-MM-DD · <topic>` entry per session covering what changed and why, files touched, and test results with real numbers. Never rewrite past entries.

Read all three at session start. Update them before ending a session.

## 5. Codebase & UI Invariants

The full review rules live in `CODING_STANDARDS.md`. Domain math (yields, portion sizes, drift rules) lives in `.loop/patterns.md`. The key rules:

- **Mobile-first and touch-safe:** tap targets ≥ 48px and body text ≥ 16px. Below 768px, charts are static (`staticPlot: true`, `pointer-events: none`, `touch-action: pan-y`) and carry pre-baked Peak/Low/Now labels. Desktop (≥ 768px) gets tooltips.
- **Single page:** use in-place tab and subtab switches, not new pages or focus-trapping modals. The forecasting order is date picker → projections → hourly → insight buttons. The daily brief and supplier info live only in the Shop Reports subtab (`#subtab-view-reports`).
- **Chart safety:** check that the container exists and is visible before any D3/Plotly render. Treat `dashPayload` and `historicalRecords` as read-only and clone before filtering. Guard against `NaN` before writing SVG attributes; the console-cleanliness E2E fails on any console error.
- **Closed days** (Mon/Tue) render `$0 (Closed)` with zero prep. They must never throw or raise drop alarms.
- **Plain-English copy, no AI slop:** do not show jargon in the UI ("Z-Score", "Sigma", "COGS", "Velocity", "DOW Base"). Use "Typical Tuesday", "Est. Meat Cost", and "Hourly Sales Pace" instead. Keep copy short and concrete, with no marketing filler or emoji decoration.
- **Colors:** use the Okabe-Ito palette tokens from `.loop/patterns.md`, keep high contrast for kitchen glare, and add no 3D effects or heavy gridlines.
- **Cache busting:** when changing `app.js` or `style.css`, bump the `?v=` query string in `index.html`.
- **Fault-isolated pipeline:** each analytics script reads its inputs, writes its own JSON, and must degrade by logging `[WARN]` and writing an empty or default payload when data is missing. One failing stage must not block `build_payloads.py`. Optional outbound calls such as the Telegram dispatcher stay non-fatal (`|| true`).
- **Generated artifacts:** do not hand-edit `clover_api/analytics/*.json`, `api/analytics/*.json`, `analytics/*.json`, or `payloads.js`. Change the producing script and regenerate.

## 6. Security & Safety Guardrails

- **Non-destructive by default:** copy a file into `archive/` (e.g. `archive/<name>.<date>.orig`) before deleting or wholesale-rewriting it. Never `git reset --hard`, `git clean`, or force-push. Never delete `*.db`, `backups/`, `backup_db/`, or `data/`.
- **Secrets:** credentials live only in `.env` (gitignored, intended mode `0600`) and GitHub/Cloudflare secrets (`CLOVER_MERCHANT_ID`, `CLOVER_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `GITHUB_TOKEN`). Never print, log, commit, or embed them in client JS or payloads. Never expose wholesale cost breakdowns to the public SPA.
- **Web hygiene:** do not use `document.write()`. Escape dynamic HTML with `escapeHTML`. Use parameterized SQL (`?`) only. Files are `0644`, dirs and scripts `0755`.
- **Protected CI/CD paths:** ask before changing `.github/workflows/*`, `sync_trigger/`, `access_agent/wrangler.toml`, or `scripts/detect_clover_env.py`. These run with repo write access or live credentials.
- **Concurrent bot commits:** the sync workflow pushes `chore(data)` commits to `master` every hour. Run `git pull --rebase` before pushing. Commit and push only when the user asks.
- **External actions** need explicit approval: Worker deploys, Telegram sends, Clover API writes, and manual `workflow_dispatch`.
