# Yellow Rose BBQ — Architecture, Contracts & Mathematical Proofs (`DESIGN.md`)

## 1. 2D End-to-End Data Flow Architecture

```
+-------------------------------------------------------------------------+
| data/clover_sales_master.db (7,928 Orders | 33,070 Line Items)          |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
| clover_api/analytics/portion_transformer.py                             |
|  1. Scale normalization: weight_items -> quantity / 1000.0              |
|  2. Combo plate modification parser (BBQ plate, 2 meat plate):          |
|     Splits plate meat weight across parsed protein modifiers            |
|     (Brisket, Ribs, Pulled Pork, Turkey, Sausage)                       |
|  3. Complete PORTION_MAP lookup (Sandwiches, Platters, Tacos, Rosebuds) |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
| Daily POS Cooked Actuals by Protein (America/New_York Date & Weekday)   |
|  - brisket_lbs, pork_ribs_racks, pulled_pork_lbs, turkey_lbs,           |
|    sausage_links, dino_ribs, tacos, rosebuds                            |
+-------------------------------------------------------------------------+
                  |                                   |
                  v                                   v
+-----------------------------------+   +---------------------------------+
| scripts/meat_forecast.py          |   | scripts/backtest_all_forecasts  |
| + clover_api/analytics/modules/   |   |  Compares predicted P50 demand  |
|  - Empirical DOW Medians (P50)    |   |  against real POS daily actuals |
|  - MinTrace Hierarchical Reconcil |   |  (Non-circular evaluation)      |
|  - Quantile Buffer (P90 - P50)    |   +---------------------------------+
|    capped at +1 Brisket           |
|  - Smokehouse Whole-Cut Output    |
+-----------------------------------+
```

## 2. Mathematical Contracts

### 2.1 Combo Plate Modification Attribution
For a combo plate $i \in \{\text{BBQ plate}, \text{2 meat plate}\}$ with modification string $M_i$:
- Extract matched protein tokens $P(M_i) \subseteq \{\text{brisket}, \text{ribs}, \text{pork}, \text{turkey}, \text{sausage}\}$ (handling duplicate selections such as double ribs or moist + lean brisket).
- For **1-meat `BBQ plate`** (total plate cooked equivalent $= 0.5\text{ lb}$ meat or $0.33\text{ rack}$ ribs or $2\text{ links}$ sausage):
  - Attribute $100\%$ of the 1-meat portion to the selected protein in $P(M_i)$ (defaulting to brisket only when $P(M_i) = \emptyset$).
- For **2-meat `2 meat plate`** (2 protein slots, each slot $= 0.33\text{ lb}$ meat or $0.25\text{ rack}$ ribs or $1.5\text{ links}$ sausage):
  - Attribute each slot proportionally to the tokens in $P(M_i)$.

### 2.2 Canonical Unit Conversions (`unit_conversions.py` & `core_utils.js`)
- **Brisket:** $16.4\text{ lb raw packer} \times 0.35 = 5.75\text{ lbs cooked usable}$ ($5\text{ packers/case} = 82\text{ lbs raw}$).
  $$\text{Expected Packers} = \left\lceil \frac{D_{\text{P50}}}{5.75} \right\rceil, \quad \text{Prep Target} = \text{Expected Packers} + \min\left(1, \left\lceil \frac{\max(0, D_{\text{P90}} - D_{\text{P50}})}{5.75} \right\rceil\right)$$
- **Pork Spare Ribs:** $12\text{ bones/rack}$ ($1\text{ Full Rack} = 1.0$, $1/2\text{ Rack} = 0.5$, $\text{Single Bone} = 1/12 \approx 0.0833$, $\text{Platter/Plate Rib Slot} = 0.25\text{–}0.50\text{ rack}$). $6\text{ racks/case} = 30\text{ lbs raw}$.
- **Turkey Breast:** $3.0\text{ lbs cooked per breast}$ ($4.29\text{ lbs raw}$ @ $Y_{\text{cook}} = 0.70$; $20\text{ lbs/case raw}$).
- **Pulled Pork:** $8.0\text{ lbs raw butt} \times 0.44 = 3.52\text{ lbs cooked}$ ($8\text{ butts/case} = 64\text{ lbs raw}$).
- **Sausage:** $3\text{ links/lb}$ ($25\text{ lbs/batch} = 75\text{ links}$).

### 2.3 Smart Closed-Hours Sync Health (`tz_utils.js`)
Let $\Delta t_{\min} = \lfloor (t_{\text{now}} - t_{\text{sync}}) / 60000 \rfloor$, $d = \text{weekday}(t_{\text{now}}, \text{America/New\_York})$, and $h = \text{hour}(t_{\text{now}}, \text{America/New\_York})$.
$$\text{isClosed}(d, h) \iff (d = \text{Mon}) \lor (h < 10) \lor (h \ge 21)$$
If $\text{isClosed}(d, h) \land \Delta t_{\min} \le 1440$, return `{ state: 'fresh', label: 'Closed · Synced', badgeText: '● Closed · Synced' }`.
