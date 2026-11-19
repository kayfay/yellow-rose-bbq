#!/usr/bin/env python3
"""
Yellow Rose BBQ - Complete Menu COGS & Food Cost Spreadsheet Generator
Compiles all 137 menu items across:
  - Original 61-item website/menu COGS model
  - All 68 previously unmapped Clover POS catalog items (100% of 125 Clover catalog items)
  - All additional WEBSITE_MENU.md and historical Clover POS database items
Writes structured CSV files under data/ with mode 0600.
"""

from __future__ import annotations

import csv
import os
import sys
from pathlib import Path
from typing import Any, Dict, List

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
DATA_DIR = ROOT_DIR / "data"
ARCHIVE_ORIG = ROOT_DIR / "archive" / "yellow_rose_bbq_cogs.csv.20261116.orig"
COGS_CSV = DATA_DIR / "yellow_rose_bbq_cogs.csv"
YIELDS_CSV = DATA_DIR / "yellow_rose_bbq_wholesale_yields.csv"
COMPLETE_MODEL_CSV = DATA_DIR / "yellow_rose_bbq_complete_cogs_model.csv"

CATEGORY_ORDER = [
    "🥪 TEXAS BBQ SANDWICHES & TACOS",
    "🥩 SMOKED MEATS BY THE POUND & RIBS",
    "🍽️ COMBINATION PLATTERS & PLATES",
    "🌽 SCRATCH SIDES, APPETIZERS & DESSERTS",
    "🎉 CATERING TRAYS & FAMILY SPECIALS",
    "🍯 HOUSE SAUCES, DRESSINGS & EXTRAS",
    "🥤 BEVERAGES, BEER & COCKTAILS",
    "🧢 MERCHANDISE, FEES & POS SYSTEM ITEMS",
]

# 76 additional POS/Menu items ensuring 100% coverage of Clover catalog (125/125),
# WEBSITE_MENU.md (127/127), and active Clover POS database items.
ADDITIONAL_MENU_ITEMS: List[Dict[str, Any]] = [
    # 🥪 TEXAS BBQ SANDWICHES & TACOS
    {
        "Category": "🥪 TEXAS BBQ SANDWICHES & TACOS",
        "Menu Item": "BBQ Sandwich (Standard POS Ring)",
        "Portion Specification": "6 oz cooked brisket/pork + brioche bun & pickles",
        "Wholesale Component Math": "$4.76 meat (6 oz) + $0.35 bun",
        "Portion COGS ($)": 5.11,
        "Retail Price ($)": 12.00,
    },
    {
        "Category": "🥪 TEXAS BBQ SANDWICHES & TACOS",
        "Menu Item": "Moist Brisket Sandwich",
        "Portion Specification": "7 oz fatty point sliced brisket + brioche bun & pickles",
        "Wholesale Component Math": "$5.56 meat (7 oz) + $0.35 bun",
        "Portion COGS ($)": 5.91,
        "Retail Price ($)": 13.00,
    },
    {
        "Category": "🥪 TEXAS BBQ SANDWICHES & TACOS",
        "Menu Item": "Lean Brisket Sandwich",
        "Portion Specification": "7 oz lean flat sliced brisket + brioche bun & pickles",
        "Wholesale Component Math": "$5.56 meat (7 oz) + $0.35 bun",
        "Portion COGS ($)": 5.91,
        "Retail Price ($)": 13.00,
    },
    {
        "Category": "🥪 TEXAS BBQ SANDWICHES & TACOS",
        "Menu Item": "Chopped Moist Brisket Sandwich",
        "Portion Specification": "7 oz chopped moist brisket + brioche bun & pickles",
        "Wholesale Component Math": "$5.56 meat (7 oz) + $0.35 bun",
        "Portion COGS ($)": 5.91,
        "Retail Price ($)": 13.00,
    },
    {
        "Category": "🥪 TEXAS BBQ SANDWICHES & TACOS",
        "Menu Item": "Chopped Lean Brisket Sandwich",
        "Portion Specification": "7 oz chopped lean brisket + brioche bun & pickles",
        "Wholesale Component Math": "$5.56 meat (7 oz) + $0.35 bun",
        "Portion COGS ($)": 5.91,
        "Retail Price ($)": 13.00,
    },
    {
        "Category": "🥪 TEXAS BBQ SANDWICHES & TACOS",
        "Menu Item": "Turkey Bacon Ranch Sandwich",
        "Portion Specification": "5 oz smoked turkey + 2 strips bacon + ranch + brioche bun",
        "Wholesale Component Math": "$1.60 turkey + $0.55 bacon/ranch + $0.35 bun",
        "Portion COGS ($)": 2.50,
        "Retail Price ($)": 14.00,
    },
    {
        "Category": "🥪 TEXAS BBQ SANDWICHES & TACOS",
        "Menu Item": "904 Local Special Sandwich",
        "Portion Specification": "5 oz pulled pork or chopped brisket + brioche bun",
        "Wholesale Component Math": "$2.05 blended meat + $0.35 bun",
        "Portion COGS ($)": 2.40,
        "Retail Price ($)": 9.04,
    },
    {
        "Category": "🥪 TEXAS BBQ SANDWICHES & TACOS",
        "Menu Item": "Smoked Turkey Quesadilla",
        "Portion Specification": "4 oz smoked turkey + 12\" flour tortilla & quesa blend",
        "Wholesale Component Math": "$1.28 turkey + $0.95 tortilla & cheese",
        "Portion COGS ($)": 2.23,
        "Retail Price ($)": 14.00,
    },
    {
        "Category": "🥪 TEXAS BBQ SANDWICHES & TACOS",
        "Menu Item": "Brisket Bacon Ranch Quesadilla",
        "Portion Specification": "4 oz brisket + bacon + ranch + 12\" flour tortilla & cheese",
        "Wholesale Component Math": "$3.18 brisket + $0.55 bacon/ranch + $0.95 tortilla/cheese",
        "Portion COGS ($)": 4.68,
        "Retail Price ($)": 16.00,
    },
    {
        "Category": "🥪 TEXAS BBQ SANDWICHES & TACOS",
        "Menu Item": "Turkey Bacon Ranch Quesadilla",
        "Portion Specification": "4 oz turkey + bacon + ranch + 12\" flour tortilla & cheese",
        "Wholesale Component Math": "$1.28 turkey + $0.55 bacon/ranch + $0.95 tortilla/cheese",
        "Portion COGS ($)": 2.78,
        "Retail Price ($)": 14.00,
    },
    {
        "Category": "🥪 TEXAS BBQ SANDWICHES & TACOS",
        "Menu Item": "Three-Cheese Quesadilla",
        "Portion Specification": "4 oz melted cheddar/jack/quesa blend + 12\" flour tortilla",
        "Wholesale Component Math": "$0.95 cheese blend + $0.35 tortilla & salsa",
        "Portion COGS ($)": 1.30,
        "Retail Price ($)": 7.00,
    },
    {
        "Category": "🥪 TEXAS BBQ SANDWICHES & TACOS",
        "Menu Item": "Quesabirria Taco (Single)",
        "Portion Specification": "2.5 oz braised birria/brisket + griddled tortilla, cheese & consommé",
        "Wholesale Component Math": "$1.55 birria meat + $0.45 tortilla, cheese & broth",
        "Portion COGS ($)": 2.00,
        "Retail Price ($)": 5.50,
    },
    # 🥩 SMOKED MEATS BY THE POUND & RIBS
    {
        "Category": "🥩 SMOKED MEATS BY THE POUND & RIBS",
        "Menu Item": "Smoked BBQ Chicken Wings (5-Piece)",
        "Portion Specification": "5 jumbo smoked wings tossed in original BBQ glaze",
        "Wholesale Component Math": "$2.15 raw wings (5 pc) + $0.30 BBQ glaze & ranch",
        "Portion COGS ($)": 2.45,
        "Retail Price ($)": 7.50,
    },
    {
        "Category": "🥩 SMOKED MEATS BY THE POUND & RIBS",
        "Menu Item": "Smoked Buffalo Chicken Wings (5-Piece)",
        "Portion Specification": "5 jumbo smoked wings tossed in spicy buffalo sauce",
        "Wholesale Component Math": "$2.15 raw wings (5 pc) + $0.30 buffalo glaze & ranch",
        "Portion COGS ($)": 2.45,
        "Retail Price ($)": 7.50,
    },
    {
        "Category": "🥩 SMOKED MEATS BY THE POUND & RIBS",
        "Menu Item": "Smoked Pork Belly (Single Portion)",
        "Portion Specification": "6 oz sliced/cubed smoked pork belly",
        "Wholesale Component Math": "$2.10 pork belly (6 oz cooked) + $0.20 glaze",
        "Portion COGS ($)": 2.30,
        "Retail Price ($)": 7.50,
    },
    # 🍽️ COMBINATION PLATTERS & PLATES
    {
        "Category": "🍽️ COMBINATION PLATTERS & PLATES",
        "Menu Item": "BBQ Plate w/ 2 Sides (POS Combo Button)",
        "Portion Specification": "0.5 lb smoked meat + 2 standard 6 oz sides",
        "Wholesale Component Math": "$4.65 blended 0.5 lb meat + $1.60 (2 sides)",
        "Portion COGS ($)": 6.25,
        "Retail Price ($)": 18.00,
    },
    {
        "Category": "🍽️ COMBINATION PLATTERS & PLATES",
        "Menu Item": "Guisada Taco Plate (w/ 2 Sides)",
        "Portion Specification": "2 beef guisada tacos + Tex Mex Rice & Charro Beans",
        "Wholesale Component Math": "$2.50 (2 guisada tacos) + $1.50 rice & beans",
        "Portion COGS ($)": 4.00,
        "Retail Price ($)": 15.00,
    },
    {
        "Category": "🍽️ COMBINATION PLATTERS & PLATES",
        "Menu Item": "King of the Hill Pitmaster Feast",
        "Portion Specification": "1 lb brisket + 1 lb pork + full rack ribs + 1 dino rib + 2 links + 4 sides",
        "Wholesale Component Math": "$12.70 brisket + $4.14 pork + $13.44 ribs + $11.50 dino + $2.50 links + $3.60 sides",
        "Portion COGS ($)": 47.88,
        "Retail Price ($)": 145.00,
    },
    # 🌽 SCRATCH SIDES, APPETIZERS & DESSERTS
    {
        "Category": "🌽 SCRATCH SIDES, APPETIZERS & DESSERTS",
        "Menu Item": "BBQ Cheese Fries",
        "Portion Specification": "6 oz seasoned fries + warm queso + 4 oz chopped brisket/pork & BBQ drizzle",
        "Wholesale Component Math": "$0.65 fries + $0.75 queso + $2.15 smoked meat",
        "Portion COGS ($)": 3.55,
        "Retail Price ($)": 12.00,
    },
    {
        "Category": "🌽 SCRATCH SIDES, APPETIZERS & DESSERTS",
        "Menu Item": "Texas Cheese Fries (TX Cheese)",
        "Portion Specification": "6 oz seasoned fries + warm queso + bacon, jalapeños & 4 oz smoked meat",
        "Wholesale Component Math": "$0.65 fries + $0.85 queso/bacon + $2.15 smoked meat",
        "Portion COGS ($)": 3.65,
        "Retail Price ($)": 12.00,
    },
    {
        "Category": "🌽 SCRATCH SIDES, APPETIZERS & DESSERTS",
        "Menu Item": "Chili Cheese Fries",
        "Portion Specification": "6 oz seasoned fries + 6 oz Texas red brisket chili & cheddar",
        "Wholesale Component Math": "$0.65 fries + $1.65 brisket chili + $0.55 cheese",
        "Portion COGS ($)": 2.85,
        "Retail Price ($)": 12.00,
    },
    {
        "Category": "🌽 SCRATCH SIDES, APPETIZERS & DESSERTS",
        "Menu Item": "Cheese Fries (Side Order)",
        "Portion Specification": "6 oz seasoned french fries + warm melted queso sauce",
        "Wholesale Component Math": "$0.65 fries + $0.75 warm queso",
        "Portion COGS ($)": 1.40,
        "Retail Price ($)": 7.00,
    },
    {
        "Category": "🌽 SCRATCH SIDES, APPETIZERS & DESSERTS",
        "Menu Item": "Texas Red Cup Chili (8 oz)",
        "Portion Specification": "8 oz cup smoked brisket Texas red chili + cheddar",
        "Wholesale Component Math": "$1.45 brisket trim chili + $0.30 cheddar & cup",
        "Portion COGS ($)": 1.75,
        "Retail Price ($)": 5.00,
    },
    {
        "Category": "🌽 SCRATCH SIDES, APPETIZERS & DESSERTS",
        "Menu Item": "Pimento Cheese w/ Crackers",
        "Portion Specification": "6 oz house sharp cheddar pimento spread + club crackers",
        "Wholesale Component Math": "$1.25 cheddar/pimento/mayo + $0.35 crackers",
        "Portion COGS ($)": 1.60,
        "Retail Price ($)": 7.00,
    },
    {
        "Category": "🌽 SCRATCH SIDES, APPETIZERS & DESSERTS",
        "Menu Item": "Classic Creamy Coleslaw (Side)",
        "Portion Specification": "6 oz shredded green/red cabbage & carrot slaw",
        "Wholesale Component Math": "$0.45 cabbage/carrots + $0.25 slaw dressing",
        "Portion COGS ($)": 0.70,
        "Retail Price ($)": 4.50,
    },
    {
        "Category": "🌽 SCRATCH SIDES, APPETIZERS & DESSERTS",
        "Menu Item": "Elote Pasta Salad (Side)",
        "Portion Specification": "6 oz roasted corn & cavatappi pasta in cotija crema",
        "Wholesale Component Math": "$0.55 cavatappi/corn + $0.40 cotija/crema",
        "Portion COGS ($)": 0.95,
        "Retail Price ($)": 5.00,
    },
    {
        "Category": "🌽 SCRATCH SIDES, APPETIZERS & DESSERTS",
        "Menu Item": "Smoked Street Corn (Side)",
        "Portion Specification": "6 oz buttered smoked sweet corn kernels with pit rub",
        "Wholesale Component Math": "$0.55 sweet corn + $0.25 butter & seasoning",
        "Portion COGS ($)": 0.80,
        "Retail Price ($)": 4.50,
    },
    {
        "Category": "🌽 SCRATCH SIDES, APPETIZERS & DESSERTS",
        "Menu Item": "Sautéed Garlic Cabbage (Side)",
        "Portion Specification": "6 oz pan-seared green cabbage with bacon & garlic",
        "Wholesale Component Math": "$0.45 green cabbage + $0.30 bacon render & garlic",
        "Portion COGS ($)": 0.75,
        "Retail Price ($)": 4.50,
    },
    {
        "Category": "🌽 SCRATCH SIDES, APPETIZERS & DESSERTS",
        "Menu Item": "Southern Cheese Grits (Side)",
        "Portion Specification": "6 oz stone-ground creamy cheddar grits",
        "Wholesale Component Math": "$0.35 grits/cream + $0.45 sharp cheddar & butter",
        "Portion COGS ($)": 0.80,
        "Retail Price ($)": 4.50,
    },
    {
        "Category": "🌽 SCRATCH SIDES, APPETIZERS & DESSERTS",
        "Menu Item": "Cowgirl Salad (Side)",
        "Portion Specification": "6 oz black bean, sweet corn, tomato & cilantro lime salad",
        "Wholesale Component Math": "$0.55 beans/corn/peppers + $0.25 lime vinaigrette",
        "Portion COGS ($)": 0.80,
        "Retail Price ($)": 4.50,
    },
    {
        "Category": "🌽 SCRATCH SIDES, APPETIZERS & DESSERTS",
        "Menu Item": "Smokehouse Holiday Stuffing (Side)",
        "Portion Specification": "6 oz savory herb & smoked sausage cornbread dressing",
        "Wholesale Component Math": "$0.50 cornbread/stock + $0.40 smoked sausage & herbs",
        "Portion COGS ($)": 0.90,
        "Retail Price ($)": 4.50,
    },
    {
        "Category": "🌽 SCRATCH SIDES, APPETIZERS & DESSERTS",
        "Menu Item": "Tex Mex Jalapeño Cornbread",
        "Portion Specification": "Single baked cheddar-jalapeño skillet cornbread square",
        "Wholesale Component Math": "$0.45 cornmeal/buttermilk/eggs + $0.25 cheddar & jalapeño",
        "Portion COGS ($)": 0.70,
        "Retail Price ($)": 3.50,
    },
    # 🎉 CATERING TRAYS & FAMILY SPECIALS
    {
        "Category": "🎉 CATERING TRAYS & FAMILY SPECIALS",
        "Menu Item": "Charro Bean Catering Tray (1/2 Steam Pan)",
        "Portion Specification": "Deep 1/2 steam pan pinto beans w/ brisket ends (feeds 20-25)",
        "Wholesale Component Math": "$6.20 pinto beans/veg + $3.10 brisket trim + $0.85 foil pan/lid",
        "Portion COGS ($)": 10.15,
        "Retail Price ($)": 45.00,
    },
    {
        "Category": "🎉 CATERING TRAYS & FAMILY SPECIALS",
        "Menu Item": "Coleslaw Catering Tray (1/2 Steam Pan)",
        "Portion Specification": "Deep 1/2 steam pan creamy house slaw (feeds 20-25)",
        "Wholesale Component Math": "$5.40 shredded cabbage/carrot + $2.65 dressing + $0.85 pan/lid",
        "Portion COGS ($)": 8.90,
        "Retail Price ($)": 45.00,
    },
    {
        "Category": "🎉 CATERING TRAYS & FAMILY SPECIALS",
        "Menu Item": "Potato Salad Catering Tray (1/2 Steam Pan)",
        "Portion Specification": "Deep 1/2 steam pan mustard/herb potato salad (feeds 20-25)",
        "Wholesale Component Math": "$6.50 red potatoes/eggs + $2.85 dressing + $0.85 pan/lid",
        "Portion COGS ($)": 10.20,
        "Retail Price ($)": 45.00,
    },
    {
        "Category": "🎉 CATERING TRAYS & FAMILY SPECIALS",
        "Menu Item": "Elote Pasta Salad Catering Tray (1/2 Steam Pan)",
        "Portion Specification": "Deep 1/2 steam pan elote pasta salad (feeds 20-25)",
        "Wholesale Component Math": "$6.80 cavatappi/corn + $3.45 cotija/crema + $0.85 pan/lid",
        "Portion COGS ($)": 11.10,
        "Retail Price ($)": 45.00,
    },
    {
        "Category": "🎉 CATERING TRAYS & FAMILY SPECIALS",
        "Menu Item": "Fresh Green Beans Catering Tray (1/2 Steam Pan)",
        "Portion Specification": "Deep 1/2 steam pan southern green beans (feeds 20-25)",
        "Wholesale Component Math": "$6.90 green beans + $2.15 bacon/onion/stock + $0.85 pan/lid",
        "Portion COGS ($)": 9.90,
        "Retail Price ($)": 45.00,
    },
    {
        "Category": "🎉 CATERING TRAYS & FAMILY SPECIALS",
        "Menu Item": "Green Bean Catering Tray (Alt POS Button)",
        "Portion Specification": "Deep 1/2 steam pan southern green beans (feeds 20-25)",
        "Wholesale Component Math": "$6.90 green beans + $2.15 bacon/onion/stock + $0.85 pan/lid",
        "Portion COGS ($)": 9.90,
        "Retail Price ($)": 45.00,
    },
    {
        "Category": "🎉 CATERING TRAYS & FAMILY SPECIALS",
        "Menu Item": "Caesar Salad Catering Tray (1/2 Steam Pan)",
        "Portion Specification": "Deep 1/2 steam pan romaine, parmesan, croutons & Caesar dressing",
        "Wholesale Component Math": "$5.80 chopped romaine + $3.25 parmesan/croutons/dressing + $0.85 pan/lid",
        "Portion COGS ($)": 9.90,
        "Retail Price ($)": 45.00,
    },
    {
        "Category": "🎉 CATERING TRAYS & FAMILY SPECIALS",
        "Menu Item": "Sautéed Cabbage Catering Tray (1/2 Steam Pan)",
        "Portion Specification": "Deep 1/2 steam pan bacon-sautéed cabbage (feeds 20-25)",
        "Wholesale Component Math": "$5.20 green cabbage + $2.75 bacon/butter/garlic + $0.85 pan/lid",
        "Portion COGS ($)": 8.80,
        "Retail Price ($)": 45.00,
    },
    {
        "Category": "🎉 CATERING TRAYS & FAMILY SPECIALS",
        "Menu Item": "Seasoned French Fry Catering Tray (1/2 Steam Pan)",
        "Portion Specification": "Deep 1/2 steam pan seasoned crinkle-cut fries (feeds 15-20)",
        "Wholesale Component Math": "$6.40 crinkle fries + $1.35 fry oil/rub + $0.85 pan/lid",
        "Portion COGS ($)": 8.60,
        "Retail Price ($)": 45.00,
    },
    {
        "Category": "🎉 CATERING TRAYS & FAMILY SPECIALS",
        "Menu Item": "Smoked Corn Catering Tray (1/2 Steam Pan)",
        "Portion Specification": "Deep 1/2 steam pan buttered smoked sweet corn (feeds 20-25)",
        "Wholesale Component Math": "$6.50 sweet corn + $2.25 butter & pit seasoning + $0.85 pan/lid",
        "Portion COGS ($)": 9.60,
        "Retail Price ($)": 45.00,
    },
    {
        "Category": "🎉 CATERING TRAYS & FAMILY SPECIALS",
        "Menu Item": "Elote Street Corn Catering Tray (1/2 Steam Pan)",
        "Portion Specification": "Deep 1/2 steam pan Mexican street corn w/ cotija & crema (feeds 20-25)",
        "Wholesale Component Math": "$6.50 roasted corn + $3.85 cotija/crema/tajin + $0.85 pan/lid",
        "Portion COGS ($)": 11.20,
        "Retail Price ($)": 50.00,
    },
    # 🍯 HOUSE SAUCES, DRESSINGS & EXTRAS
    {
        "Category": "🍯 HOUSE SAUCES, DRESSINGS & EXTRAS",
        "Menu Item": "Original Texas BBQ Sauce (8 oz Bottle/Tub)",
        "Portion Specification": "8 oz house espresso/molasses BBQ sauce + deli container",
        "Wholesale Component Math": "$0.95 house BBQ sauce (8 oz) + $0.11 container/lid",
        "Portion COGS ($)": 1.06,
        "Retail Price ($)": 5.00,
    },
    {
        "Category": "🍯 HOUSE SAUCES, DRESSINGS & EXTRAS",
        "Menu Item": "Spicy Texas BBQ Sauce (8 oz Bottle/Tub)",
        "Portion Specification": "8 oz cayenne/habanero BBQ sauce + deli container",
        "Wholesale Component Math": "$1.00 spicy BBQ sauce (8 oz) + $0.11 container/lid",
        "Portion COGS ($)": 1.11,
        "Retail Price ($)": 5.00,
    },
    {
        "Category": "🍯 HOUSE SAUCES, DRESSINGS & EXTRAS",
        "Menu Item": "Carolina Gold Mustard Sauce (8 oz Bottle/Tub)",
        "Portion Specification": "8 oz tangy mustard BBQ sauce + deli container",
        "Wholesale Component Math": "$0.90 mustard sauce (8 oz) + $0.11 container/lid",
        "Portion COGS ($)": 1.01,
        "Retail Price ($)": 5.00,
    },
    {
        "Category": "🍯 HOUSE SAUCES, DRESSINGS & EXTRAS",
        "Menu Item": "House Buttermilk Ranch (8 oz Tub)",
        "Portion Specification": "8 oz scratch herb buttermilk ranch + deli container",
        "Wholesale Component Math": "$1.10 mayo/buttermilk/herbs (8 oz) + $0.11 container/lid",
        "Portion COGS ($)": 1.21,
        "Retail Price ($)": 5.00,
    },
    {
        "Category": "🍯 HOUSE SAUCES, DRESSINGS & EXTRAS",
        "Menu Item": "Original Texas BBQ Sauce (16 oz Pint)",
        "Portion Specification": "16 oz pint house original BBQ sauce + container",
        "Wholesale Component Math": "$1.90 house BBQ sauce (16 oz) + $0.16 pint container/lid",
        "Portion COGS ($)": 2.06,
        "Retail Price ($)": 9.75,
    },
    {
        "Category": "🍯 HOUSE SAUCES, DRESSINGS & EXTRAS",
        "Menu Item": "Spicy Texas BBQ Sauce (16 oz Pint)",
        "Portion Specification": "16 oz pint house spicy BBQ sauce + container",
        "Wholesale Component Math": "$2.00 spicy BBQ sauce (16 oz) + $0.16 pint container/lid",
        "Portion COGS ($)": 2.16,
        "Retail Price ($)": 9.75,
    },
    {
        "Category": "🍯 HOUSE SAUCES, DRESSINGS & EXTRAS",
        "Menu Item": "Carolina Gold Mustard Sauce (16 oz Pint)",
        "Portion Specification": "16 oz pint tangy mustard BBQ sauce + container",
        "Wholesale Component Math": "$1.80 mustard sauce (16 oz) + $0.16 pint container/lid",
        "Portion COGS ($)": 1.96,
        "Retail Price ($)": 9.75,
    },
    {
        "Category": "🍯 HOUSE SAUCES, DRESSINGS & EXTRAS",
        "Menu Item": "House Buttermilk Ranch (16 oz Pint)",
        "Portion Specification": "16 oz pint scratch buttermilk ranch + container",
        "Wholesale Component Math": "$2.20 mayo/buttermilk/herbs (16 oz) + $0.16 pint container/lid",
        "Portion COGS ($)": 2.36,
        "Retail Price ($)": 9.75,
    },
    {
        "Category": "🍯 HOUSE SAUCES, DRESSINGS & EXTRAS",
        "Menu Item": "Ranch Dressing Side Cup (2 oz)",
        "Portion Specification": "2 oz portion cup buttermilk ranch + lid",
        "Wholesale Component Math": "$0.22 ranch (2 oz) + $0.04 portion cup/lid",
        "Portion COGS ($)": 0.26,
        "Retail Price ($)": 0.50,
    },
    {
        "Category": "🍯 HOUSE SAUCES, DRESSINGS & EXTRAS",
        "Menu Item": "Warm Queso Cheese Sauce Side (2 oz)",
        "Portion Specification": "2 oz portion cup melted queso blanco/cheddar",
        "Wholesale Component Math": "$0.30 queso sauce (2 oz) + $0.04 portion cup/lid",
        "Portion COGS ($)": 0.34,
        "Retail Price ($)": 1.00,
    },
    {
        "Category": "🍯 HOUSE SAUCES, DRESSINGS & EXTRAS",
        "Menu Item": "Extra Toasted Brioche Bun",
        "Portion Specification": "1 buttered & griddled 4.5\" brioche bun",
        "Wholesale Component Math": "$0.35 brioche bun + $0.04 butter",
        "Portion COGS ($)": 0.39,
        "Retail Price ($)": 1.00,
    },
    # 🥤 BEVERAGES, BEER & COCKTAILS
    {
        "Category": "🥤 BEVERAGES, BEER & COCKTAILS",
        "Menu Item": "Coca-Cola Fountain Drink / Bottled Soda (24 oz)",
        "Portion Specification": "24 oz PET cold cup + slotted lid + straw + BIB syrup & ice",
        "Wholesale Component Math": "$0.24 BIB syrup + $0.10 PET cup + $0.055 lid/straw",
        "Portion COGS ($)": 0.40,
        "Retail Price ($)": 2.95,
    },
    {
        "Category": "🥤 BEVERAGES, BEER & COCKTAILS",
        "Menu Item": "Kids Fountain Drink (12-14 oz)",
        "Portion Specification": "12-14 oz PET cold cup + lid + straw + BIB syrup & ice",
        "Wholesale Component Math": "$0.14 BIB syrup + $0.08 PET cup + $0.055 lid/straw",
        "Portion COGS ($)": 0.28,
        "Retail Price ($)": 1.50,
    },
    {
        "Category": "🥤 BEVERAGES, BEER & COCKTAILS",
        "Menu Item": "Fresh Cherry Limeade (24 oz)",
        "Portion Specification": "24 oz cup + lime juice, cherry syrup, lemon-lime soda & cherry garnish",
        "Wholesale Component Math": "$0.55 lime/cherry syrup/soda + $0.155 cup/lid/straw",
        "Portion COGS ($)": 0.71,
        "Retail Price ($)": 4.50,
    },
    {
        "Category": "🥤 BEVERAGES, BEER & COCKTAILS",
        "Menu Item": "House Cinnamon Horchata (24 oz)",
        "Portion Specification": "24 oz cup + sweet rice milk, cinnamon & vanilla",
        "Wholesale Component Math": "$0.50 rice milk/condensed milk/cinnamon + $0.155 cup/lid/straw",
        "Portion COGS ($)": 0.66,
        "Retail Price ($)": 4.00,
    },
    {
        "Category": "🥤 BEVERAGES, BEER & COCKTAILS",
        "Menu Item": "Brewed Iced Tea (1 Gallon Jug)",
        "Portion Specification": "1-gallon plastic jug + freshly brewed sweet/unsweet black tea",
        "Wholesale Component Math": "$0.45 bulk tea & cane sugar + $0.65 gallon jug/cap",
        "Portion COGS ($)": 1.10,
        "Retail Price ($)": 6.75,
    },
    {
        "Category": "🥤 BEVERAGES, BEER & COCKTAILS",
        "Menu Item": "Canned Still Water",
        "Portion Specification": "12 oz aluminum can / bottle purified water",
        "Wholesale Component Math": "$0.38 wholesale beverage unit cost",
        "Portion COGS ($)": 0.38,
        "Retail Price ($)": 2.00,
    },
    {
        "Category": "🥤 BEVERAGES, BEER & COCKTAILS",
        "Menu Item": "Topo Chico Mineral Water / Hard Seltzer",
        "Portion Specification": "12 oz glass bottle / can Topo Chico",
        "Wholesale Component Math": "$1.35 wholesale bottle/can cost",
        "Portion COGS ($)": 1.35,
        "Retail Price ($)": 5.00,
    },
    {
        "Category": "🥤 BEVERAGES, BEER & COCKTAILS",
        "Menu Item": "Miller Lite (12 oz Can/Bottle)",
        "Portion Specification": "12 oz domestic light lager",
        "Wholesale Component Math": "$1.10 distributor case unit cost (24-pk)",
        "Portion COGS ($)": 1.10,
        "Retail Price ($)": 4.50,
    },
    {
        "Category": "🥤 BEVERAGES, BEER & COCKTAILS",
        "Menu Item": "Coors Banquet (12 oz Can/Bottle)",
        "Portion Specification": "12 oz domestic lager",
        "Wholesale Component Math": "$1.15 distributor case unit cost (24-pk)",
        "Portion COGS ($)": 1.15,
        "Retail Price ($)": 5.00,
    },
    {
        "Category": "🥤 BEVERAGES, BEER & COCKTAILS",
        "Menu Item": "Shiner Bock (12 oz Can/Bottle)",
        "Portion Specification": "12 oz Texas dark bock beer",
        "Wholesale Component Math": "$1.35 distributor case unit cost (24-pk)",
        "Portion COGS ($)": 1.35,
        "Retail Price ($)": 5.50,
    },
    {
        "Category": "🥤 BEVERAGES, BEER & COCKTAILS",
        "Menu Item": "Dos Equis Especial (12 oz Can/Bottle)",
        "Portion Specification": "12 oz Mexican import lager",
        "Wholesale Component Math": "$1.45 distributor case unit cost (24-pk)",
        "Portion COGS ($)": 1.45,
        "Retail Price ($)": 6.00,
    },
    {
        "Category": "🥤 BEVERAGES, BEER & COCKTAILS",
        "Menu Item": "Local Craft IPA (12 oz Can)",
        "Portion Specification": "12 oz regional craft India Pale Ale",
        "Wholesale Component Math": "$1.85 craft distributor unit cost (24-pk)",
        "Portion COGS ($)": 1.85,
        "Retail Price ($)": 6.50,
    },
    {
        "Category": "🥤 BEVERAGES, BEER & COCKTAILS",
        "Menu Item": "Carbliss Black Raspberry Canned Cocktail",
        "Portion Specification": "12 oz RTD vodka cocktail can",
        "Wholesale Component Math": "$2.10 RTD spirits distributor unit cost",
        "Portion COGS ($)": 2.10,
        "Retail Price ($)": 6.00,
    },
    {
        "Category": "🥤 BEVERAGES, BEER & COCKTAILS",
        "Menu Item": "Carbliss Mango Canned Cocktail",
        "Portion Specification": "12 oz RTD vodka cocktail can",
        "Wholesale Component Math": "$2.10 RTD spirits distributor unit cost",
        "Portion COGS ($)": 2.10,
        "Retail Price ($)": 6.00,
    },
    {
        "Category": "🥤 BEVERAGES, BEER & COCKTAILS",
        "Menu Item": "Mango Carbliss Canned Cocktail (Alt Button)",
        "Portion Specification": "12 oz RTD vodka cocktail can",
        "Wholesale Component Math": "$2.10 RTD spirits distributor unit cost",
        "Portion COGS ($)": 2.10,
        "Retail Price ($)": 6.00,
    },
    {
        "Category": "🥤 BEVERAGES, BEER & COCKTAILS",
        "Menu Item": "Margarita Carbliss Canned Cocktail",
        "Portion Specification": "12 oz RTD tequila margarita cocktail can",
        "Wholesale Component Math": "$2.10 RTD spirits distributor unit cost",
        "Portion COGS ($)": 2.10,
        "Retail Price ($)": 6.00,
    },
    # 🧢 MERCHANDISE, FEES & POS SYSTEM ITEMS
    {
        "Category": "🧢 MERCHANDISE, FEES & POS SYSTEM ITEMS",
        "Menu Item": "Yellow Rose BBQ Embroidered Hat",
        "Portion Specification": "Custom embroidered snapback/trucker cap",
        "Wholesale Component Math": "$8.50 wholesale embroidered cap unit cost",
        "Portion COGS ($)": 8.50,
        "Retail Price ($)": 30.00,
    },
    {
        "Category": "🧢 MERCHANDISE, FEES & POS SYSTEM ITEMS",
        "Menu Item": "Yellow Rose BBQ Embroidered Patch",
        "Portion Specification": "Iron-on / sew-on woven logo patch",
        "Wholesale Component Math": "$1.20 wholesale woven patch unit cost",
        "Portion COGS ($)": 1.20,
        "Retail Price ($)": 6.00,
    },
    {
        "Category": "🧢 MERCHANDISE, FEES & POS SYSTEM ITEMS",
        "Menu Item": "Yellow Rose BBQ Die-Cut Sticker",
        "Portion Specification": "Weatherproof vinyl logo decal",
        "Wholesale Component Math": "$0.25 bulk vinyl print cost",
        "Portion COGS ($)": 0.25,
        "Retail Price ($)": 2.00,
    },
    {
        "Category": "🧢 MERCHANDISE, FEES & POS SYSTEM ITEMS",
        "Menu Item": "Gift Card Load ($5.00 Base Denomination)",
        "Portion Specification": "Stored-value gift card / PVC card carrier (non-food liability)",
        "Wholesale Component Math": "$0.15 PVC card & sleeve cost (load value redeemed on food)",
        "Portion COGS ($)": 0.15,
        "Retail Price ($)": 5.00,
    },
    {
        "Category": "🧢 MERCHANDISE, FEES & POS SYSTEM ITEMS",
        "Menu Item": "Catering Delivery Fee",
        "Portion Specification": "Offsite catering delivery, fuel & insulated cambro transport",
        "Wholesale Component Math": "$15.00 avg driver fuel/mileage reimbursement vs $83.33 avg fee",
        "Portion COGS ($)": 15.00,
        "Retail Price ($)": 83.33,
    },
    {
        "Category": "🧢 MERCHANDISE, FEES & POS SYSTEM ITEMS",
        "Menu Item": "POS Kitchen Modifier (Dont Make Instruction)",
        "Portion Specification": "Non-food POS kitchen hold/prep instruction button ($0.00 ring)",
        "Wholesale Component Math": "$0.00 non-depleting POS kitchen routing flag",
        "Portion COGS ($)": 0.00,
        "Retail Price ($)": 0.00,
    },
]


def _compute_row_metrics(cat: str, name: str, spec: str, math_str: str, cogs_val: float, retail_val: float) -> Dict[str, Any]:
    gross_profit = round(retail_val - cogs_val, 2)
    if retail_val > 0:
        fc_pct = round((cogs_val / retail_val) * 100.0, 1)
        gm_pct = round((gross_profit / retail_val) * 100.0, 1)
    else:
        fc_pct = 0.0
        gm_pct = 0.0

    if retail_val == 0.0 and cogs_val == 0.0:
        tier = "⚙️ POS System Flag (0% FC)"
        action = "Kitchen routing modifier only; zero food depletion"
    elif fc_pct < 20.0:
        tier = "⭐ Super Star (<20% FC)"
        action = "Promote heavily; ultra-high profit anchor"
    elif fc_pct <= 25.0:
        tier = "🟢 High Margin (20-25% FC)"
        action = "Strong profit driver; maintain portion consistency"
    elif fc_pct <= 32.0:
        tier = "🎯 Target Benchmark (25-32% FC)"
        action = "Healthy restaurant margin; ideal balance"
    else:
        tier = "⚠️ Watch Margin (>32% FC)"
        action = "Premium meat pull; pair with high-margin sides/drinks"

    return {
        "category": cat,
        "item_name": name,
        "portion_spec": spec,
        "component_cost_math": math_str,
        "portion_cogs_usd": cogs_val,
        "menu_retail_usd": retail_val,
        "gross_margin_usd": gross_profit,
        "food_cost_pct": fc_pct,
        "gross_margin_pct": gm_pct,
        "profitability_tier": tier,
        "operational_guidance": action,
    }


def load_base_61_items() -> List[Dict[str, Any]]:
    source = ARCHIVE_ORIG if ARCHIVE_ORIG.exists() else COGS_CSV
    items: List[Dict[str, Any]] = []
    seen = set()
    add_names = {r["Menu Item"] for r in ADDITIONAL_MENU_ITEMS}
    with open(source, "r", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            nm = r["Menu Item"].strip()
            if nm in add_names or nm in seen:
                continue
            seen.add(nm)
            items.append(
                _compute_row_metrics(
                    r["Category"].strip(),
                    nm,
                    r["Portion Specification"].strip(),
                    r["Wholesale Component Math"].strip(),
                    float(r["Portion COGS ($)"].replace("$", "").strip()),
                    float(r["Retail Price ($)"].replace("$", "").strip()),
                )
            )
    return items


def build_all_menu_items() -> List[Dict[str, Any]]:
    base_items = load_base_61_items()
    extra_items = [
        _compute_row_metrics(
            r["Category"],
            r["Menu Item"],
            r["Portion Specification"],
            r["Wholesale Component Math"],
            float(r["Portion COGS ($)"]),
            float(r["Retail Price ($)"]),
        )
        for r in ADDITIONAL_MENU_ITEMS
    ]
    combined = base_items + extra_items
    cat_rank = {c: i for i, c in enumerate(CATEGORY_ORDER)}
    combined.sort(key=lambda x: cat_rank.get(x["category"], 99))
    return combined


def load_wholesale_yields() -> List[List[str]]:
    if not YIELDS_CSV.exists():
        return []
    with open(YIELDS_CSV, "r", encoding="utf-8") as f:
        rows = list(csv.reader(f))
    return rows[1:] if len(rows) > 1 else []


def main() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    menu_items = build_all_menu_items()
    wholesale_rows = load_wholesale_yields()

    fieldnames = [
        "Category",
        "Menu Item",
        "Portion Specification",
        "Wholesale Component Math",
        "Portion COGS ($)",
        "Retail Price ($)",
        "Gross Profit ($)",
        "Food Cost %",
        "Gross Margin %",
        "Profitability Tier",
        "Operational Guidance",
    ]

    with open(COGS_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(fieldnames)
        for item in menu_items:
            writer.writerow([
                item["category"],
                item["item_name"],
                item["portion_spec"],
                item["component_cost_math"],
                f"{item['portion_cogs_usd']:.2f}",
                f"{item['menu_retail_usd']:.2f}",
                f"{item['gross_margin_usd']:.2f}",
                f"{item['food_cost_pct']:.1f}%",
                f"{item['gross_margin_pct']:.1f}%",
                item["profitability_tier"],
                item["operational_guidance"],
            ])
    os.chmod(COGS_CSV, 0o600)

    yields_fields = [
        "Wholesale Item",
        "US Foods Raw Contract Price",
        "Estimated Cooked Yield",
        "Effective Cost (Cooked / Portion)",
        "Yield & Shrinkage Notes",
    ]
    priced_items = [i for i in menu_items if i["menu_retail_usd"] > 0]
    avg_fc = sum(i["food_cost_pct"] for i in priced_items) / max(1, len(priced_items))

    with open(COMPLETE_MODEL_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["YELLOW ROSE BBQ - COST OF GOODS SOLD (COGS) & MARGIN ANALYSIS"])
        writer.writerow(["Target Food Cost Benchmark", "28.0% - 32.0%"])
        writer.writerow(["Average Menu Food Cost", f"{avg_fc:.1f}%"])
        writer.writerow(["Total Menu Items Analyzed", len(menu_items)])
        writer.writerow([])
        writer.writerow(["--- WHOLESALE COMMODITY CONTRACT PRICES & SMOKED YIELDS ---"])
        writer.writerow(yields_fields)
        for r in wholesale_rows:
            writer.writerow(r)
        writer.writerow([])
        writer.writerow(["--- COMPLETE PORTION-LEVEL COGS & RETAIL MENU BREAKDOWN ---"])
        writer.writerow(fieldnames)
        for item in menu_items:
            writer.writerow([
                item["category"],
                item["item_name"],
                item["portion_spec"],
                item["component_cost_math"],
                f"{item['portion_cogs_usd']:.2f}",
                f"{item['menu_retail_usd']:.2f}",
                f"{item['gross_margin_usd']:.2f}",
                f"{item['food_cost_pct']:.1f}%",
                f"{item['gross_margin_pct']:.1f}%",
                item["profitability_tier"],
                item["operational_guidance"],
            ])
        from scripts.recipe_cogs_engine import export_recipe_cogs_csvs
        recipe_summary, recipe_detail = export_recipe_cogs_csvs()
        writer.writerow([])
        writer.writerow(["--- HANDWRITTEN NOTEBOOK & SAUSAGE RECIPE BATCH COGS BREAKDOWN (34 YRBBQ RECIPES) ---"])
        writer.writerow(list(recipe_summary[0].keys()))
        for r in recipe_summary:
            writer.writerow([r[k] for k in recipe_summary[0].keys()])
    os.chmod(COMPLETE_MODEL_CSV, 0o600)

    print(f"Successfully generated COGS sheets:")
    print(f" - Menu COGS: {COGS_CSV} ({len(menu_items)} items)")
    print(f" - Complete Master Model: {COMPLETE_MODEL_CSV} ({len(menu_items)} items)")


if __name__ == "__main__":
    main()
