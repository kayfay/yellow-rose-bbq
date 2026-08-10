# Texas BBQ Operations & Prep Questionnaire

This document captures operational preferences, pitmaster shift schedules, menu cuts, and smoker constraints to fine-tune the prep target and forecasting algorithms for your Texas BBQ pit operations.

---

## 1. Menu Cuts & Meat Prep Targets

- [ ] **Rib Cut Type**: What specific rib cuts are served on the menu?
  - [ ] Pork Spare Ribs (Standard Texas Cut)
  - [ ] St. Louis Style Cut
  - [ ] Baby Back Ribs
  - [ ] Beef Dino Ribs (Plate Ribs)
  - *Current Algorithm Baseline*: 20% revenue allocation (~32 racks on a $4.8k peak Saturday).

- [ ] **Meat Sales Mix Distribution**: Does your sales volume roughly match these estimates, or should we adjust the ratios?
  - Brisket: `35%` of revenue
  - Pork Shoulder / Pulled Pork: `25%` of revenue
  - Pork Ribs: `20%` of revenue
  - Sausage Links: `20%` of revenue

---

## 2. Pitmaster & Prep Cook Shift Schedules

- [ ] **Exact Shift Start Times**: We currently constrain prep to **3 Prep Cooks** (including the Owner). What are the exact arrival times for your team?
  - **Cook #1 (Early Pit Watch / Fire Manager)**: Arrival time (e.g. 2:00 AM)?
  - **Cook #2 (Morning Trim & Rub Prep)**: Arrival time (e.g. 6:00 AM)?
  - **Cook #3 (Owner / Mid-Day & Service)**: Arrival time?

- [ ] **Overnight Smoke Duties**: Which pitmaster manages the overnight brisket and pork shoulder smoke watch?

---

## 3. Smoker & Equipment Capacity Constraints

- [ ] **Maximum Pit Capacity**: How many total pounds of raw brisket, pork shoulder, and racks of ribs can your smokers handle in a single session?
  - Max Brisket Capacity: `___ lbs`
  - Max Pork Shoulder Capacity: `___ lbs`
  - Max Rib Capacity: `___ racks`

- [ ] **Smoke Time Lead Times**:
  - Brisket cook duration: `12 - 14 hours` (plus 4-hour rest)
  - Pork Shoulder cook duration: `10 - 12 hours`
  - Ribs cook duration: `4 - 6 hours`

---

## 4. Itemized POS Line-Item Ingestion

- [ ] **Clover Itemized Ingestion**: Currently, the forecast converts total daily POS revenue (`total_usd`) into meat weights using Texas BBQ yield formulas. Would you like us to pull individual itemized line items from Clover (e.g., exact count of 1/2 lb brisket portions vs. full racks of ribs sold)?

---

> **How to update**: You can edit this file directly or reply with your answers, and the system will update the prep algorithms accordingly!
