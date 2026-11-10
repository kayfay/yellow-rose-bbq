# JD Intelligence & Smokehouse Analytics Engine: Plan of Record

This Plan of Record establishes the bounded contract, 2D architectural blueprint, and execution roadmap for deploying **JD** as an autonomous, real-time conversational data analyst and pitmaster co-pilot.

---

## 1. Bounded Contract Specification

```json
{
  "goal": "deploy_jd_analytics_intelligence_module",
  "inputs": [
    "JD_ANALYTICS_RECOMMENDATIONS.md",
    "yellow-rose-bbq/clover_api/data/clover_sales.db",
    "yellow-rose-bbq/clover_api/analytics/hourly_actuals.json",
    "yellow-rose-bbq/clover_api/analytics/daily_executive_brief.json",
    "yellow-rose-bbq/clover_api/analytics/historical_payload.json",
    "yellow-rose-bbq/agent/memory/yield_records.json",
    "yellow-rose-bbq/data/yellow_rose_bbq_wholesale_yields.csv"
  ],
  "output": "production-ready yellow-rose-bbq/agent/ domain module & verified test suites",
  "constraints": [
    "zero statistical jargon in output (strictly enforce pitmaster dictionary)",
    "cuts and cases display hierarchy only (brisket packers, butts, racks)",
    "execute build and test suites natively via Node 22.6+ and Python 3.13 (.venv)",
    "never edit source data or raw database schemas (read-only SQLite/JSON)"
  ],
  "done_when": [
    "all 6 analytical capabilities implemented in yellow-rose-bbq/agent/",
    "agent-comms core runtime communicates cleanly via modular delegation",
    "all Tier 1 deterministic gates (npm test, python unit tests) pass 100%",
    "Adversarial Critic audit scores math and copy precision >= 9/10"
  ]
}
```

---

## 2. 2D Decoupled Architecture & Data Flow

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 TELEGRAM CLIENT (USER)                                 │
└───────────────────────────────────────────▲────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        AGENT-COMMS HUB (shared/ & daemon.ts)                           │
│  - Telegram Webhook Router & Outbound Pull Queue (KV Cache)                            │
│  - Natural Language Router (router.ts) & Brain Runner (Gemini 3.8 Flash Sandbox)       │
│  - Scheduler (checkinTick): 8:30 AM EST Morning Digest, 2:00 PM EST Rush Check-in      │
│  - Interactive Inline Keyboards: [🥩 Today's Prep] [📊 Shop Numbers] [🔎 Top Leads]    │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ (Delegates queries & triggers via adapter)
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│               YELLOW-ROSE-BBQ AGENT DOMAIN MODULE (yellow-rose-bbq/agent/)             │
│                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                        index.ts (JDAgentDomain Facade)                         │   │
│   │     - handleCommand(cmd, args)    - getContext(now)                            │   │
│   │     - getQuickAction(action, now) - getDigestSnippet(now)                      │   │
│   └──────┬──────────────────┬─────────────────┬─────────────────┬──────────────────┘   │
│          │                  │                 │                 │                      │
│          ▼                  ▼                 ▼                 ▼                      │
│   ┌──────────────┐   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│   │unit_         │   │yield_        │  │context_      │  │scenario_     │              │
│   │conversions.ts│   │auditor.ts    │  │provider.ts   │  │planner.ts    │              │
│   │- Case packs  │   │- Cook yields │  │- Hourly POS  │  │- Weather sim │              │
│   │- Cushion +10%│   │- Drift radar │  │- Rush pacing │  │- Catering est│              │
│   │- Jargon purge│   │- Shrink/loss │  │- Sales bridge│  │- What-If math│              │
│   └──────────────┘   └──────┬───────┘  └──────┬───────┘  └──────────────┘              │
│                             │                 │                                        │
└─────────────────────────────┼─────────────────┼────────────────────────────────────────┘
                              │                 │
                              ▼                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                      SMOKEHOUSE DATA & TELEMETRY SUBSTRATE                             │
│   - clover_api/data/clover_sales.db (Orders, OrderLineItems, Payments)                 │
│   - clover_api/analytics/*.json (hourly_actuals.json, daily_executive_brief.json)      │
│   - agent/memory/yield_records.json (Cooked yield history & cutter standards)          │
│   - data/yellow_rose_bbq_wholesale_yields.csv (Wholesale trim & invoice specs)         │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Milestone Execution Checklist

- [ ] **Milestone 1: Real-Time Rush Pacing Engine (`context_provider.ts`)**
  - Connect to `clover_sales.db` and `hourly_actuals.json`.
  - Calculate 2:00 PM Post-Lunch pacing against daily baseline rush curves.
  - Generate actionable dinner line adjustments (e.g. slice 1 extra packer early).
  - Expose `/pace` command and natural-language pacing queries.

- [ ] **Milestone 2: Sell-Out & Cut Waste Reconciliation (`yield_auditor.ts`)**
  - Correlate line-item sales tickets with logged cooked meat production.
  - Detect stockouts (e.g., ribs 86'd at 6:45 PM $\rightarrow$ missed dollar opportunity).
  - Calculate holdover surplus and carry-over meat in practical cuts.

- [ ] **Milestone 3: Plain-English Driver & Anomaly Explainer (`context_provider.ts`)**
  - Parse `sales_bridge` telemetry from `daily_executive_brief.json`.
  - Decompose revenue shifts into Rush Hour Delta, Foot Traffic/Weather, and Check Size vs. Volume.
  - Answer natural-language queries: *"Why was Tuesday up so much?"*

- [ ] **Milestone 4: Multi-Cook Yield Drift & Shrink Radar (`yield_auditor.ts`)**
  - Implement rolling 5-cook window monitoring net cooked yield.
  - Alert when brisket drifts below 5.75 lbs / packer (41.1% benchmark).
  - Convert yield drift into estimated wholesale dollar trim loss.

- [ ] **Milestone 5: Conversational "What-If" Scenario Planner (`scenario_planner.ts`)**
  - Build simulator engine combining baseline modifiers with case conversion invariants.
  - Model weather events (e.g. -15% rain impact $\rightarrow$ reduce packer count).
  - Model catering drops (custom guest counts $\rightarrow$ additional raw packers/cases).

- [ ] **Milestone 6: Monday 9:00 AM Executive Retrospective (`index.ts`)**
  - Synthesize 7-day Clover history roll on Monday mornings.
  - Report Gross Revenue vs. Baseline, Contribution Margin after Meat Cost, and Case Purchasing Guide for distributor ordering.

- [ ] **Milestone 7: Verification, Diagnostic Gallery & Critic Audit**
  - Enforce zero-jargon linter sensors and unit parity tests.
  - Record execution artifacts and JSON outputs into `progress.html`.
  - Execute read-only Adversarial Critic audit achieving $\ge 9/10$ rating.

---

## 4. Autonomous Loop Trigger

To initiate Phase 2 through Phase 8 under the autonomous harness, execute:

```bash
/goal deploy_jd_analytics_intelligence_module
```
