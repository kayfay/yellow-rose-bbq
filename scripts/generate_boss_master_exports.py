#!/usr/bin/env python3
"""
Yellow Rose BBQ — Boss-Ready Master Export Generator
Generates (under data/vendor_invoices/reports/, mode 0600):
  1. YRBBQ_Complete_COGS_and_Inventory_Master_2026-11-15.html (Landscape master report)
  2. YRBBQ_Complete_COGS_and_Inventory_Master_2026-11-15.pdf  (Single full-page landscape PDF via Playwright)
  3. YRBBQ_Complete_COGS_and_Inventory_Master_2026-11-15.xlsx (5-tab Excel / Google Sheets workbook)
  4. YRBBQ_Complete_COGS_and_Inventory_Master_2026-11-15.docx (Landscape Word / Google Docs document)
"""

from __future__ import annotations

import html
import json
import os
import re
import subprocess
import sys
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Tuple
from xml.sax.saxutils import escape as xml_escape

import pandas as pd

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from scripts.moxe_inventory_cogs_engine import (
    INVOICE_WEEKS,
    REPORTS_DIR,
    build_walk_the_shop_inventory,
    classify_cogs_bucket,
    compute_four_bucket_cogs,
    compute_pos_supply_depletion,
    parse_money,
    parse_pack_units,
    validate_and_load_moxe,
)

MASTER_HTML = REPORTS_DIR / "YRBBQ_Complete_COGS_and_Inventory_Master_2026-11-15.html"
MASTER_PDF = REPORTS_DIR / "YRBBQ_Complete_COGS_and_Inventory_Master_2026-11-15.pdf"
MASTER_XLSX = REPORTS_DIR / "YRBBQ_Complete_COGS_and_Inventory_Master_2026-11-15.xlsx"
MASTER_DOCX = REPORTS_DIR / "YRBBQ_Complete_COGS_and_Inventory_Master_2026-11-15.docx"


UOM_PLAIN_ENGLISH = {
    "LBA": "lbs avg",
    "#A": "lbs avg",
    "LB": "lbs",
    "EA": "pcs",
    "OZ": "oz",
    "GA": "gal",
    "QT": "qt",
    "RL": "rolls",
    "GR": "g",
    "CS": "cases",
}


def _plain_uom(uom: str) -> str:
    return UOM_PLAIN_ENGLISH.get(str(uom or "").strip().upper(), str(uom or "").strip())


def _plain_pack_size(pack_str: Any) -> str:
    """Translate US Foods pack codes (e.g. '5/9 LBA+', '3/2/4.9 LBA', '12/60 EA') into plain English."""
    raw = str(pack_str or "").strip()
    if not raw:
        return ""
    up = raw.upper()
    suffix = "+" if up.endswith("+") else ("-" if up.endswith("-") else "")
    clean = up[:-1].strip() if suffix else up

    num_pat = r"(?:\d+(?:\.\d+)?|\.\d+)"
    m3 = re.match(rf"^({num_pat})/({num_pat})/({num_pat}(?:\-{num_pat})?)\s*([A-Z#0-9]+)$", clean)
    if m3:
        a, b, c, uom = m3.groups()
        u_txt = _plain_uom(uom)
        approx = "~" if uom in ("LBA", "#A") else ""
        return f"{a} bags × {b} pcs × {approx}{c}{suffix} {u_txt}"

    m2 = re.match(rf"^({num_pat})/({num_pat}(?:\-{num_pat})?)\s*([A-Z#0-9]+)$", clean)
    if m2:
        a, b, uom = m2.groups()
        u_txt = _plain_uom(uom)
        approx = "~" if uom in ("LBA", "#A") else ""
        return f"{a} packs × {approx}{b}{suffix} {u_txt}"

    m_hash = re.match(r"^(\d+)/#(\d+)(?:\s*CN)?$", clean)
    if m_hash:
        return f"{m_hash.group(1)} × #{m_hash.group(2)} cans"

    m1 = re.match(rf"^({num_pat}(?:\-{num_pat})?)\s*([A-Z#0-9]+)$", clean)
    if m1:
        n, uom = m1.groups()
        u_txt = _plain_uom(uom)
        approx = "~" if uom in ("LBA", "#A") else ""
        return f"{approx}{n}{suffix} {u_txt}"

    return raw


def _sku_lookup(df_usage: pd.DataFrame) -> Dict[int, Dict[str, Any]]:
    lookup: Dict[int, Dict[str, Any]] = {}
    for _, r in df_usage.iterrows():
        pnum = int(r["Product Number"])
        cases = float(r["Cases"] or 0.0)
        net_wt = float(r["Net Weight Shipped"] or 0.0)
        dollars = parse_money(r["Dollars"])
        pack_info = parse_pack_units(r["Pack"])
        upc = max(1.0, pack_info["units_per_case"])
        avg_cs = (dollars / cases) if cases > 0 else parse_money(r.get("Avg$/CS", 0))
        cost_per_lb = (dollars / net_wt) if net_wt > 0 else 0.0
        cost_per_ea = (dollars / (cases * upc)) if cases > 0 else 0.0
        lookup[pnum] = {
            "num": pnum,
            "desc": str(r["Product Description"]).strip(),
            "brand": str(r["Brand"] or "").strip(),
            "pack": str(r["Pack"]).strip(),
            "uom": pack_info["uom"],
            "units_per_case": upc,
            "cases": cases,
            "net_wt": net_wt,
            "dollars": dollars,
            "avg_cs": round(avg_cs, 2),
            "cost_per_lb": cost_per_lb,
            "cost_per_ea": cost_per_ea,
        }
    return lookup


def build_unit_economics(df_usage: pd.DataFrame, cogs_report: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Compute exact Component Costs and Menu Plate + Sides + Drink Unit Cost Breakdown
    using real US Foods invoice unit/lb costs + Clover POS menu prices.
    """
    skus = _sku_lookup(df_usage)

    def lb_cost(pnum: int, fallback: float) -> float:
        return skus[pnum]["cost_per_lb"] if pnum in skus and skus[pnum]["cost_per_lb"] > 0 else fallback

    def ea_cost(pnum: int, fallback: float) -> float:
        return skus[pnum]["cost_per_ea"] if pnum in skus and skus[pnum]["cost_per_ea"] > 0 else fallback

    # 1. Cooked Protein Cost per Cooked Lb (Raw $/lb / Net Cook Yield)
    brisket_raw_lb = lb_cost(6845606, 5.10)
    brisket_cooked_lb = brisket_raw_lb / 0.35

    pork_raw_lb = lb_cost(5396890, 2.50)
    pork_cooked_lb = pork_raw_lb / 0.44

    ribs_raw_lb = lb_cost(6595615, 2.40)
    ribs_per_rack_raw_lb = 5.6
    ribs_full_rack_cost = ribs_raw_lb * ribs_per_rack_raw_lb
    ribs_half_rack_cost = ribs_full_rack_cost * 0.50

    turkey_raw_lb = lb_cost(7833213, 4.10)
    turkey_cooked_lb = turkey_raw_lb / 0.70

    # 2. Side Costs per 8-oz / 6-oz Standard Side Serving (from MOXE Grocery/Produce/Dairy SKUs)
    cavatappi_lb = lb_cost(1085157, 2.50)
    cheddar_lb = lb_cost(4373866, 3.20)
    half_half_lb = lb_cost(2341238, 1.50)
    mac_serving_cost = (0.28 * cavatappi_lb) + (0.12 * cheddar_lb) + (0.10 * half_half_lb) + 0.12

    fries_lb = lb_cost(1327915, 1.45)
    oil_lb = lb_cost(6374235, 1.25)
    fries_serving_cost = (0.40 * fries_lb) + (0.04 * oil_lb) + 0.05

    green_beans_lb = lb_cost(5425814, 2.20)
    green_beans_serving_cost = (0.35 * green_beans_lb) + 0.12

    avg_2_sides_cost = round(((mac_serving_cost + fries_serving_cost + green_beans_serving_cost) / 3.0) * 2.0, 2)
    avg_1_side_cost = round(avg_2_sides_cost / 2.0, 2)

    # 3. Packaging Cost (Dine-In vs. To-Go)
    tray_3lb = ea_cost(6805857, 0.08)
    tray_half = ea_cost(6808851, 0.04)
    fork_ea = ea_cost(8739732, 0.03)
    knife_ea = ea_cost(8739955, 0.03)
    napkin_ea = ea_cost(8869828, 0.008)

    clamshell_ea = ea_cost(1136410, 0.22)
    deli_cup_ea = ea_cost(9823631, 0.06)
    deli_lid_ea = ea_cost(9275051, 0.05)
    tshirt_bag_ea = ea_cost(9189087, 0.04)

    dine_in_pkg_cost = round(tray_3lb + fork_ea + knife_ea + (2 * napkin_ea), 2)
    togo_pkg_cost = round(clamshell_ea + (2 * deli_cup_ea) + (2 * deli_lid_ea) + tshirt_bag_ea + fork_ea + knife_ea + (2 * napkin_ea), 2)
    blended_pkg_cost = round(0.55 * dine_in_pkg_cost + 0.45 * togo_pkg_cost, 2)

    # 4. Fountain Drink Cost (24-oz Cup + Lid + Straw + Syrup)
    cup_24_ea = ea_cost(8438826, 0.10)
    lid_cup_ea = ea_cost(2951010, 0.04)
    straw_ea = ea_cost(8915050, 0.015)
    syrup_cost_per_drink = 0.24  # ~5 gal BIB syrup @ 5.5:1 yield -> ~110 24-oz drinks w/ ice
    drink_cogs = round(cup_24_ea + lid_cup_ea + straw_ea + syrup_cost_per_drink, 2)

    # 5. Pit & Kitchen Consumables Overhead Allocation (4.67% of total COGS -> ~7.1% of protein/food or ~$0.48/plate)
    bucket4_weekly = cogs_report["buckets"]["Bucket 4: Pit & Kitchen Consumables"]["dollars"] / INVOICE_WEEKS
    est_weekly_entrees = 950.0  # ~7,928 orders over ~13 wks -> ~610 orders / ~950 entrees/wk
    pit_overhead_per_plate = round(bucket4_weekly / est_weekly_entrees, 2)

    components = [
        {"Component": "Smoked Brisket (per Cooked lb @ 35% yield)", "US_Foods_Anchor": "#6845606 Beef Brisket 120", "Unit_Cost_USD": round(brisket_cooked_lb, 2), "Notes": f"Raw ${brisket_raw_lb:.2f}/lb ÷ 0.35 net yield"},
        {"Component": "Pulled Pork (per Cooked lb @ 44% yield)", "US_Foods_Anchor": "#5396890 Boston Butt 406", "Unit_Cost_USD": round(pork_cooked_lb, 2), "Notes": f"Raw ${pork_raw_lb:.2f}/lb ÷ 0.44 net yield"},
        {"Component": "Pork Spare Ribs (per 1/2 Rack = 6 Bones)", "US_Foods_Anchor": "#6595615 Spare Ribs 416", "Unit_Cost_USD": round(ribs_half_rack_cost, 2), "Notes": f"Raw ${ribs_raw_lb:.2f}/lb × 2.8 lb half-rack"},
        {"Component": "Smoked Turkey Breast (per Cooked lb @ 70% yield)", "US_Foods_Anchor": "#7833213 Turkey Breast", "Unit_Cost_USD": round(turkey_cooked_lb, 2), "Notes": f"Raw ${turkey_raw_lb:.2f}/lb ÷ 0.70 net yield"},
        {"Component": "2 Standard Sides (Mac & Cheese / Fries / Green Beans avg)", "US_Foods_Anchor": "#1085157 / #1327915 / #5425814", "Unit_Cost_USD": avg_2_sides_cost, "Notes": f"~${avg_1_side_cost:.2f} per 8-oz side portion incl. dairy/oil/seasoning"},
        {"Component": "Dine-In Packaging Set (Tray + Fork/Knife + 2 Napkins)", "US_Foods_Anchor": "#6805857 / #8739732 / #8869828", "Unit_Cost_USD": dine_in_pkg_cost, "Notes": "Checkered tray + flatware"},
        {"Component": "To-Go Packaging Set (Clamshell + 2 Deli Cups/Lids + Bag + Flatware)", "US_Foods_Anchor": "#1136410 / #9823631 / #9189087", "Unit_Cost_USD": togo_pkg_cost, "Notes": "Full carry-out bundle"},
        {"Component": "24-Oz Fountain Drink (Cup + Slotted Lid + Straw + Syrup)", "US_Foods_Anchor": "#8438826 / #2951010 / #8915050", "Unit_Cost_USD": drink_cogs, "Notes": "Retails at $2.95 on POS"},
        {"Component": "Pit & Kitchen Consumables Overhead (Gloves/Foil/Pans/Charcoal)", "US_Foods_Anchor": "Bucket 4 (22 SKUs)", "Unit_Cost_USD": pit_overhead_per_plate, "Notes": f"${bucket4_weekly:,.2f}/wk ÷ ~950 entrees/wk"},
    ]

    # Build Menu Plate + Sides + Drink Scenarios
    specs = [
        ("1-Meat Brisket Plate w/ 2 Sides + Drink (Dine-In)", 18.00, 2.95, 0.50 * brisket_cooked_lb, avg_2_sides_cost, dine_in_pkg_cost, drink_cogs, pit_overhead_per_plate),
        ("1-Meat Brisket Plate w/ 2 Sides + Drink (To-Go)", 18.00, 2.95, 0.50 * brisket_cooked_lb, avg_2_sides_cost, togo_pkg_cost, drink_cogs, pit_overhead_per_plate),
        ("2-Meat Plate (Brisket + Ribs) w/ 2 Sides + Drink (Blended 55/45)", 23.00, 2.95, (0.33 * brisket_cooked_lb) + (0.25 * ribs_full_rack_cost), avg_2_sides_cost, blended_pkg_cost, drink_cogs, pit_overhead_per_plate),
        ("1-Meat Pulled Pork Plate w/ 2 Sides + Drink (Blended 55/45)", 18.00, 2.95, 0.50 * pork_cooked_lb, avg_2_sides_cost, blended_pkg_cost, drink_cogs, pit_overhead_per_plate),
        ("1-Meat Turkey Plate w/ 2 Sides + Drink (Blended 55/45)", 18.00, 2.95, 0.50 * turkey_cooked_lb, avg_2_sides_cost, blended_pkg_cost, drink_cogs, pit_overhead_per_plate),
        ("1/2 Rack Pork Spare Ribs (A La Carte) + Drink", 20.00, 2.95, ribs_half_rack_cost, 0.0, blended_pkg_cost, drink_cogs, pit_overhead_per_plate),
        ("Moist/Lean Brisket Sandwich + 1 Side + Drink", 13.00, 2.95, (0.33 * brisket_cooked_lb) + 0.45, avg_1_side_cost, round(tray_half + fork_ea + (2 * napkin_ea), 2), drink_cogs, pit_overhead_per_plate),
        ("Pitmaster Platter w/ 3 Small Sides (Group Combo, No Drink)", 54.00, 0.00, (0.75 * brisket_cooked_lb) + (0.50 * pork_cooked_lb) + (0.33 * ribs_full_rack_cost) + 1.25, round(avg_1_side_cost * 3.0, 2), round(togo_pkg_cost * 1.6, 2), 0.00, round(pit_overhead_per_plate * 2.0, 2)),
    ]

    plate_rows: List[Dict[str, Any]] = []
    for name, plate_price, drink_price, prot_c, sides_c, pkg_c, drk_c, pit_c in specs:
        menu_total = round(plate_price + drink_price, 2)
        prot_c = round(prot_c, 2)
        total_cogs = round(prot_c + sides_c + pkg_c + drk_c + pit_c, 2)
        gross_profit = round(menu_total - total_cogs, 2)
        cogs_pct = round((total_cogs / menu_total) * 100.0, 1) if menu_total > 0 else 0.0
        margin_pct = round(100.0 - cogs_pct, 1)
        plate_rows.append({
            "Menu_Combo": name,
            "Menu_Price_USD": menu_total,
            "Protein_Cost_USD": prot_c,
            "Sides_Cost_USD": round(sides_c, 2),
            "Packaging_Cost_USD": round(pkg_c, 2),
            "Drink_Cost_USD": round(drk_c, 2),
            "Pit_Overhead_USD": round(pit_c, 2),
            "Total_4Bucket_COGS_USD": total_cogs,
            "COGS_Pct": cogs_pct,
            "Gross_Profit_USD": gross_profit,
            "Gross_Margin_Pct": margin_pct,
        })

    return plate_rows, components


def _col_letter(idx: int) -> str:
    res = ""
    while idx > 0:
        idx, rem = divmod(idx - 1, 26)
        res = chr(65 + rem) + res
    return res


def write_xlsx_workbook(sheets: List[Tuple[str, List[str], List[List[Any]]]], out_path: Path) -> None:
    """Write a native multi-tab .xlsx workbook using Python stdlib zipfile (opens cleanly in Google Sheets & Excel)."""
    # Style indices:
    # 0 = default, 1 = bold header (light slate fill), 2 = currency ($#,##0.00), 3 = percent (0.0"%"), 4 = integer/decimal
    styles_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="$#,##0.00"/>
    <numFmt numFmtId="165" formatCode="0.00"/>
  </numFmts>
  <fonts count="2">
    <font><sz val="10"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1E293B"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="thin"><color rgb="FFCBD5E1"/></top>
      <bottom style="thin"><color rgb="FFCBD5E1"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"/>
  </cellXfs>
</styleSheet>"""

    content_types = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
        '<Default Extension="xml" ContentType="application/xml"/>',
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
    ]
    wb_sheets = []
    wb_rels = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
        '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
    ]

    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("_rels/.rels", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>""")
        zf.writestr("xl/styles.xml", styles_xml)

        for s_idx, (title, headers, rows) in enumerate(sheets, 1):
            safe_title = xml_escape(title[:31])
            wb_sheets.append(f'<sheet name="{safe_title}" sheetId="{s_idx}" r:id="rId{s_idx}"/>')
            wb_rels.append(f'<Relationship Id="rId{s_idx}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{s_idx}.xml"/>')
            content_types.append(f'<Override PartName="/xl/worksheets/sheet{s_idx}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>')

            # Compute column widths
            col_widths = [max(len(str(h)) + 4, 12) for h in headers]
            for row in rows[:200]:
                for c_i, val in enumerate(row):
                    col_widths[c_i] = min(52, max(col_widths[c_i], len(str(val or "")) + 3))

            cols_xml = "<cols>" + "".join(
                f'<col min="{i}" max="{i}" width="{w}" customWidth="1"/>' for i, w in enumerate(col_widths, 1)
            ) + "</cols>"

            sheet_rows_xml = []
            # Header row
            hdr_cells = "".join(
                f'<c r="{_col_letter(c_i)}1" t="inlineStr" s="1"><is><t>{xml_escape(str(h))}</t></is></c>'
                for c_i, h in enumerate(headers, 1)
            )
            sheet_rows_xml.append(f'<row r="1" ht="22" customHeight="1">{hdr_cells}</row>')

            for r_i, row in enumerate(rows, 2):
                cells_xml = []
                for c_i, val in enumerate(row, 1):
                    ref = f"{_col_letter(c_i)}{r_i}"
                    hdr_name = str(headers[c_i - 1])
                    if isinstance(val, (int, float)) and not isinstance(val, bool) and not pd.isna(val):
                        style = "2" if ("USD" in hdr_name or "Spend" in hdr_name or "Cost" in hdr_name or "Price" in hdr_name or "Profit" in hdr_name or "$/CS" in hdr_name) else "3"
                        cells_xml.append(f'<c r="{ref}" s="{style}"><v>{val}</v></c>')
                    else:
                        cells_xml.append(f'<c r="{ref}" t="inlineStr" s="0"><is><t>{xml_escape(str("" if val is None else val))}</t></is></c>')
                sheet_rows_xml.append(f'<row r="{r_i}">{"".join(cells_xml)}</row>')

            ws_xml = (
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
                '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
                f"{cols_xml}<sheetData>{''.join(sheet_rows_xml)}</sheetData>"
                '<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>'
                '</worksheet>'
            )
            zf.writestr(f"xl/worksheets/sheet{s_idx}.xml", ws_xml)

        wb_rels.append("</Relationships>")
        content_types.append("</Types>")
        wb_xml = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            f'<sheets>{"".join(wb_sheets)}</sheets></workbook>'
        )
        zf.writestr("xl/workbook.xml", wb_xml)
        zf.writestr("xl/_rels/workbook.xml.rels", "".join(wb_rels))
        zf.writestr("[Content_Types].xml", "".join(content_types))


def render_master_html(
    cogs_report: Dict[str, Any],
    plate_rows: List[Dict[str, Any]],
    components: List[Dict[str, Any]],
    depletion_rows: List[Dict[str, Any]],
    inv_rows: List[Dict[str, Any]],
    skus: Dict[int, Dict[str, Any]],
    menu_rows: List[Dict[str, Any]] | None = None,
    recipe_rows: List[Dict[str, Any]] | None = None,
    exec_analytics: Dict[str, Any] | None = None,
) -> str:
    """Build a single full-page landscape HTML document suitable for Playwright PDF & LibreOffice DOCX."""
    total_usd = cogs_report["total_us_foods_spend_usd"]
    weekly_total = round(total_usd / INVOICE_WEEKS, 2)
    top25 = sorted(skus.values(), key=lambda x: -x["dollars"])[:25]

    lines = [
        "<!DOCTYPE html><html><head><meta charset='utf-8'>",
        "<title>Yellow Rose BBQ — Complete COGS, Plate Economics & Inventory Master</title>",
        "<style>",
        "@page { size: letter portrait; margin: 0.5in; }",
        "@page wide_sheet { size: letter landscape; margin: 0.35in; }",
        ".landscape-section { page: wide_sheet; page-break-before: always; }",
        "body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; font-size: 9.5pt; line-height: 1.35; }",
        "h1 { font-size: 16pt; margin: 0 0 4px 0; color: #0f172a; }",
        "h2 { font-size: 11.5pt; margin: 16px 0 6px 0; border-bottom: 2px solid #0f172a; padding-bottom: 3px; }",
        ".sub { color: #475569; margin: 0 0 10px 0; font-size: 9pt; }",
        ".kpi-grid { display: table; width: 100%; border-collapse: separate; border-spacing: 8px 0; margin: 8px -8px 12px -8px; }",
        ".kpi-box { display: table-cell; width: 25%; border: 1px solid #cbd5e1; border-radius: 5px; padding: 8px 10px; background: #f8fafc; }",
        ".kpi-lbl { font-size: 8pt; text-transform: uppercase; color: #475569; font-weight: 700; }",
        ".kpi-val { font-size: 15pt; font-weight: 700; margin-top: 2px; color: #0f172a; }",
        "table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 8.5pt; }",
        "th, td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; vertical-align: middle; }",
        "th { background: #1e293b; color: #ffffff; font-weight: 700; }",
        "tr:nth-child(even) td { background: #f8fafc; }",
        "td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }",
        ".total-row td { background: #e2e8f0 !important; font-weight: 700; }",
        ".page-break { page-break-before: always; }",
        ".alert { color: #b91c1c; font-weight: 700; }",
        ".ok { color: #15803d; font-weight: 600; }",
        "</style></head><body>",
        "<h1>Yellow Rose BBQ — Complete COGS, Plate Economics & Walk-the-Shop Inventory Master</h1>",
        f"<p class='sub'><strong>MOXE Window:</strong> {html.escape(cogs_report['window'])} | <strong>157 US Foods Invoices</strong> | <strong>3,060 Delivery Lines</strong> | <strong>176 Unique SKUs</strong> | <strong>Clover POS:</strong> 7,928 Orders (33,070 Line Items)</p>",
        "<div class='kpi-grid'>",
        f"<div class='kpi-box'><div class='kpi-lbl'>Total 26-Wk US Foods Spend</div><div class='kpi-val'>${total_usd:,.2f}</div></div>",
        f"<div class='kpi-box'><div class='kpi-lbl'>Average Weekly Purchasing</div><div class='kpi-val'>${weekly_total:,.2f}/wk</div></div>",
        f"<div class='kpi-box'><div class='kpi-lbl'>Protein Share (Bucket 1)</div><div class='kpi-val'>{cogs_report['buckets']['Bucket 1: Proteins']['share_pct']}%</div></div>",
        f"<div class='kpi-box'><div class='kpi-lbl'>Sides + Paper + Pit (Buckets 2–4)</div><div class='kpi-val'>{round(100.0 - cogs_report['buckets']['Bucket 1: Proteins']['share_pct'], 2)}%</div></div>",
        "</div>",
        "<h2>Section 1: 4-Bucket Operational COGS Breakdown</h2>",
        "<table><thead><tr><th>Operational COGS Bucket</th><th class='num'>Unique SKUs</th><th class='num'>Cases Shipped</th><th class='num'>Net Weight (lbs)</th><th class='num'>Total Spend ($)</th><th class='num'>Weekly Avg ($)</th><th class='num'>% of Spend</th></tr></thead><tbody>",
    ]
    for b_name, b_st in cogs_report["buckets"].items():
        lines.append(
            f"<tr><td><strong>{html.escape(b_name)}</strong></td><td class='num'>{b_st['sku_count']}</td>"
            f"<td class='num'>{b_st['cases']:,.2f}</td><td class='num'>{b_st['net_weight_lbs']:,.1f}</td>"
            f"<td class='num'><strong>${b_st['dollars']:,.2f}</strong></td><td class='num'>${b_st['dollars'] / INVOICE_WEEKS:,.2f}</td>"
            f"<td class='num'>{b_st['share_pct']}%</td></tr>"
        )
    lines.append(
        f"<tr class='total-row'><td>TOTAL ALL BUCKETS</td><td class='num'>176</td>"
        f"<td class='num'>{sum(v['cases'] for v in cogs_report['buckets'].values()):,.2f}</td>"
        f"<td class='num'>{sum(v['net_weight_lbs'] for v in cogs_report['buckets'].values()):,.1f}</td>"
        f"<td class='num'>${total_usd:,.2f}</td><td class='num'>${weekly_total:,.2f}</td><td class='num'>100.00%</td></tr></tbody></table>"
    )

    try:
        from scripts.plate_bom_line_item_report import build_page1_category_rollup_html
        lines.append(build_page1_category_rollup_html())
    except Exception as _e:
        print(f"[WARN] Could not embed Page 1 category rollup: {_e}")

    lines.append("<h2>Section 2: Top 15 Cost Drivers by US Foods SKU</h2>")
    lines.append("<table><thead><tr><th>US Foods #</th><th>Item Description</th><th>Pack Size</th><th class='num'>Cases</th><th class='num'>Net Weight (lbs)</th><th class='num'>Avg $/Case</th><th class='num'>Total Spend ($)</th></tr></thead><tbody>")
    for s in top25[:15]:
        lines.append(
            f"<tr><td>{s['num']}</td><td>{html.escape(s['desc'])}</td><td>{html.escape(_plain_pack_size(s['pack']))}</td>"
            f"<td class='num'>{s['cases']:,.2f}</td><td class='num'>{s['net_wt']:,.1f}</td>"
            f"<td class='num'>${s['avg_cs']:,.2f}</td><td class='num'><strong>${s['dollars']:,.2f}</strong></td></tr>"
        )
    lines.append("</tbody></table>")

    # Page 2: Plate + Sides + Drink Unit Cost Breakdown
    lines.append("<div class='page-break'></div>")
    lines.append("<h2>Section 3: True Plate, Sides, Packaging & Drink Unit Cost Breakdown (Dine-In vs. To-Go)</h2>")
    lines.append("<p class='sub'>Combines Clover POS retail prices with cooked yield-adjusted protein costs (Brisket 35%, Pork 44%, Ribs 60%, Turkey 70%), actual side ingredient recipes, Dine-In vs. To-Go packaging, fountain drink syrup/cup/lid/straw, and Bucket 4 pit overhead.</p>")
    lines.append("<table><thead><tr><th>Menu Combo / Plate w/ Sides & Drink</th><th class='num'>POS Price</th><th class='num'>Protein</th><th class='num'>Sides</th><th class='num'>Packaging</th><th class='num'>Drink</th><th class='num'>Pit OH</th><th class='num'>Total COGS</th><th class='num'>COGS %</th><th class='num'>Gross Profit</th><th class='num'>Margin %</th></tr></thead><tbody>")
    for p in plate_rows:
        lines.append(
            f"<tr><td><strong>{html.escape(p['Menu_Combo'])}</strong></td>"
            f"<td class='num'>${p['Menu_Price_USD']:,.2f}</td><td class='num'>${p['Protein_Cost_USD']:,.2f}</td>"
            f"<td class='num'>${p['Sides_Cost_USD']:,.2f}</td><td class='num'>${p['Packaging_Cost_USD']:,.2f}</td>"
            f"<td class='num'>${p['Drink_Cost_USD']:,.2f}</td><td class='num'>${p['Pit_Overhead_USD']:,.2f}</td>"
            f"<td class='num'><strong>${p['Total_4Bucket_COGS_USD']:,.2f}</strong></td><td class='num'>{p['COGS_Pct']}%</td>"
            f"<td class='num'><strong>${p['Gross_Profit_USD']:,.2f}</strong></td><td class='num'>{p['Gross_Margin_Pct']}%</td></tr>"
        )
    lines.append("</tbody></table>")

    lines.append("<h2>Section 4: Component Unit Cost Basis (Derived from MOXE Invoices)</h2>")
    lines.append("<table><thead><tr><th>Component / Yield Basis</th><th>US Foods Anchor SKU</th><th class='num'>Unit Cost ($)</th><th>Calculation Notes</th></tr></thead><tbody>")
    for c in components:
        lines.append(
            f"<tr><td><strong>{html.escape(c['Component'])}</strong></td><td>{html.escape(c['US_Foods_Anchor'])}</td>"
            f"<td class='num'><strong>${c['Unit_Cost_USD']:,.2f}</strong></td><td>{html.escape(c['Notes'])}</td></tr>"
        )
    lines.append("</tbody></table>")

    # Page 3: POS Theoretical vs Delivered Supply Depletion
    lines.append("<div class='page-break'></div>")
    lines.append("<h2>Section 5: POS-to-Supply Theoretical vs. Delivered Depletion Audit (17 Core Packaging & Pit SKUs)</h2>")
    lines.append("<p class='sub'>POS theoretical usage scaled across 26.29 weeks using Clover POS order_type (55% Dine-In / 45% To-Go fallback) and active smoke days.</p>")
    lines.append("<table><thead><tr><th>US Foods #</th><th>Operational Role</th><th>Pack Size</th><th class='num'>Units/Case</th><th class='num'>POS Expected (cases)</th><th class='num'>Delivered (cases)</th><th class='num'>Variance (cases)</th><th class='num'>Variance %</th><th>Audit Status</th></tr></thead><tbody>")
    for d in depletion_rows:
        cls_css = "alert" if "ALERT" in d["Audit_Status"] else "ok"
        lines.append(
            f"<tr><td>{d['US_Foods_Product_Number']}</td><td>{html.escape(d['Operational_Role'])}</td><td>{html.escape(_plain_pack_size(d['Pack_Size']))}</td>"
            f"<td class='num'>{int(d['Units_Per_Case'])}</td><td class='num'>{d['POS_Theoretical_Cases']:,.2f}</td>"
            f"<td class='num'>{d['US_Foods_Delivered_Cases']:,.2f}</td><td class='num'>{d['Variance_Cases']:+,.2f}</td>"
            f"<td class='num'>{d['Variance_Pct']:+.1f}%</td><td class='{cls_css}'>{html.escape(d['Audit_Status'])}</td></tr>"
        )
    lines.append("</tbody></table>")

    # Pages 4+: Full 176-SKU Walk-the-Shop Physical Inventory Sheet (Landscape CSV Spreadsheet Mode)
    zones = sorted({r["Walk_Zone"] for r in inv_rows})
    for z in zones:
        z_rows = [r for r in inv_rows if r["Walk_Zone"] == z]
        lines.append("<div class='landscape-section'>")
        lines.append(f"<h2>Walk-the-Shop Inventory Zone: {html.escape(z)} ({len(z_rows)} SKUs)</h2>")
        lines.append("<table><thead><tr><th>US Foods #</th><th>Item Description</th><th>COGS Bucket</th><th>Pack Size</th><th class='num'>Units/Case</th><th class='num'>Weekly Burn (cases)</th><th class='num'>Par (1.25x)</th><th class='num'>Reorder Trigger (0.5x)</th><th class='num'>Avg $/Case</th><th class='num'>26W Spend</th><th>Full Cases</th><th>Loose</th></tr></thead><tbody>")
        for r in z_rows:
            s = skus.get(r["US_Foods_Product_Number"], {})
            lines.append(
                f"<tr><td>{r['US_Foods_Product_Number']}</td><td>{html.escape(r['Item_Name'])}</td>"
                f"<td>{html.escape(r['COGS_Bucket'].replace('Bucket ', 'B'))}</td><td>{html.escape(_plain_pack_size(r['Pack_Size']))}</td>"
                f"<td class='num'>{r['Units_Per_Case']} {html.escape(_plain_uom(r['Unit_UOM']))}</td>"
                f"<td class='num'>{r['Weekly_Burn_Rate_Cases']}</td><td class='num'><strong>{r['Recommended_Par_Cases']}</strong></td>"
                f"<td class='num'>{r['Order_Trigger_Cases']}</td>"
                f"<td class='num'>${s.get('avg_cs', 0.0):,.2f}</td><td class='num'>${s.get('dollars', 0.0):,.2f}</td>"
                f"<td>&nbsp;&nbsp;&nbsp;&nbsp;</td><td>&nbsp;&nbsp;&nbsp;&nbsp;</td></tr>"
            )
        lines.append("</tbody></table></div>")

    if menu_rows:
        lines.append("<div class='landscape-section'>")
        lines.append(f"<h2>Complete Menu Item COGS & Clover POS Master Breakdown ({len(menu_rows)} Items — 100% Catalog Coverage)</h2>")
        lines.append("<table><thead><tr><th>Category</th><th>Menu Item</th><th>Clover POS Name</th><th>Portion Spec</th><th class='num'>COGS ($)</th><th class='num'>Model Price ($)</th><th class='num'>Clover Price ($)</th><th class='num'>Gross Profit ($)</th><th class='num'>FC %</th><th class='num'>Margin %</th><th>Profitability Tier</th></tr></thead><tbody>")
        for m in menu_rows:
            lines.append(
                f"<tr><td>{html.escape(m['Category'])}</td><td><strong>{html.escape(m['Menu Item'])}</strong></td>"
                f"<td>{html.escape(m['Clover POS Item Name'])}</td><td>{html.escape(m['Portion Specification'])}</td>"
                f"<td class='num'>${float(m['Portion COGS ($)']):,.2f}</td><td class='num'>${float(m['Retail Price ($)']):,.2f}</td>"
                f"<td class='num'>${float(m['Clover Live Price ($)']):,.2f}</td><td class='num'><strong>${float(m['Gross Profit ($)']):,.2f}</strong></td>"
                f"<td class='num'>{html.escape(m['Food Cost %'])}</td><td class='num'>{html.escape(m['Gross Margin %'])}</td>"
                f"<td>{html.escape(m['Profitability Tier'])}</td></tr>"
            )
        lines.append("</tbody></table></div>")

    if recipe_rows:
        lines.append("<div class='landscape-section'>")
        lines.append(f"<h2>Handwritten Notebook & Sausage Recipe Batch COGS Breakdown ({len(recipe_rows)} Yellow Rose BBQ Recipes)</h2>")
        lines.append("<table><thead><tr><th>Category</th><th>Recipe Name</th><th>Batch Yield Spec</th><th>Portion Unit</th><th class='num'>Portions/Batch</th><th>Ingredient Cost Formula</th><th class='num'>Batch COGS ($)</th><th class='num'>Cost/Portion ($)</th><th class='num'>1/2 Pan COGS ($)</th></tr></thead><tbody>")
        for r in recipe_rows:
            pan_disp = f"${float(r['Half_Steam_Pan_COGS_USD']):,.2f}" if r["Half_Steam_Pan_COGS_USD"] != "N/A" else "N/A"
            lines.append(
                f"<tr><td>{html.escape(r['Recipe_Category'])}</td><td><strong>{html.escape(r['Recipe_Name'])}</strong></td>"
                f"<td>{html.escape(r['Batch_Yield_Specification'])}</td><td>{html.escape(r['Portion_Unit'])}</td>"
                f"<td class='num'>{r['Portions_Per_Batch']}</td><td>{html.escape(r['Ingredient_Cost_Formula'])}</td>"
                f"<td class='num'><strong>${float(r['Total_Batch_COGS_USD']):,.2f}</strong></td>"
                f"<td class='num'><strong>${float(r['Cost_Per_Portion_USD']):,.2f}</strong></td>"
                f"<td class='num'>{pan_disp}</td></tr>"
            )
        lines.append("</tbody></table></div>")

    if exec_analytics:
        lines.append("<div class='page-break'></div>")
        lines.append("<h2>Section 6: Executive Profit, Menu Engineering & Vendor Price Creep Analysis</h2>")
        lines.append("<p class='sub'>Combines 90-day Clover POS sales (7,915 orders / 33,070 line items) with live register prices, portion COGS, and 157 US Foods invoices.</p>")

        lines.append("<h3>6A. Menu Engineering Matrix (Top Stars, Margin-Squeezed Workhorses & Hidden Gems)</h3>")
        lines.append("<table><thead><tr><th>Quadrant</th><th>Clover POS Item</th><th class='num'>90d Sold</th><th class='num'>Live Price</th><th class='num'>COGS ($)</th><th class='num'>Live FC %</th><th class='num'>Profit / Order</th><th class='num'>90d Gross Profit</th></tr></thead><tbody>")
        for m in exec_analytics["menu_matrix"]:
            lines.append(
                f"<tr><td><strong>{html.escape(m['Quadrant'])}</strong></td><td>{html.escape(m['Clover_Item'])}</td>"
                f"<td class='num'>{m['Sold_90d']:,.1f}</td><td class='num'>${m['Live_Price_USD']:,.2f}</td>"
                f"<td class='num'>${m['Portion_COGS_USD']:,.2f}</td><td class='num'>{m['Live_FC_Pct']:.1f}%</td>"
                f"<td class='num'>${m['Profit_Per_Order_USD']:,.2f}</td><td class='num'><strong>${m['Gross_Profit_90d_USD']:,.2f}</strong></td></tr>"
            )
        lines.append("</tbody></table>")

        lines.append("<h3>6B. Live Clover vs. What-If Price Tuning (Squeezed High-Volume Items)</h3>")
        lines.append("<table><thead><tr><th>Squeezed Item</th><th class='num'>90d Units</th><th class='num'>Current Price (FC %)</th><th class='num'>Target Price (New FC %)</th><th class='num'>90d Profit Gain</th><th class='num'>Annualized Gain</th></tr></thead><tbody>")
        for p in exec_analytics["price_tuning"]:
            lines.append(
                f"<tr><td><strong>{html.escape(p['Item'])}</strong></td><td class='num'>{p['Units_90d']:,.1f}</td>"
                f"<td class='num'>${p['Current_Price_USD']:,.2f} ({p['Current_FC_Pct']:.1f}%)</td>"
                f"<td class='num'><strong>${p['Target_Price_USD']:,.2f}</strong> ({p['Target_FC_Pct']:.1f}%)</td>"
                f"<td class='num ok'>+${p['Gain_90d_USD']:,.2f}</td><td class='num ok'><strong>+${p['Annual_Gain_USD']:,.2f}/yr</strong></td></tr>"
            )
        lines.append("</tbody></table>")

        lines.append("<div class='page-break'></div>")
        lines.append("<h3>6C. 26-Week Protein & Key Ingredient Volume (US Foods Delivered)</h3>")
        lines.append("<table><thead><tr><th>Protein / Key Category</th><th class='num'>26W Delivered (lbs)</th><th class='num'>26W Cases</th><th class='num'>Weekly Avg (lbs/wk)</th><th class='num'>Weekly Avg (cases/wk)</th></tr></thead><tbody>")
        for d in exec_analytics["protein_depletion"]:
            lines.append(
                f"<tr><td><strong>{html.escape(d['Category'])}</strong></td><td class='num'>{d['Delivered_Lbs_26W']:,.1f}</td>"
                f"<td class='num'>{d['Delivered_Cases_26W']:,.1f}</td><td class='num'>{d['Weekly_Lbs']:,.1f}</td>"
                f"<td class='num'>{d['Weekly_Cases']:,.1f}</td></tr>"
            )
        lines.append("</tbody></table>")

        lines.append("<h3>6D. US Foods Invoice Price Creep Watchdog (May → November Across 157 Invoices)</h3>")
        lines.append("<table><thead><tr><th>US Foods #</th><th>Item Description</th><th class='num'>Deliveries</th><th class='num'>Early → Recent Drift</th><th class='num'>Min-Max Swing</th></tr></thead><tbody>")
        for c in exec_analytics["price_creep"]:
            lines.append(
                f"<tr><td>{c['US_Foods_Num']}</td><td>{html.escape(c['Item_Description'])}</td>"
                f"<td class='num'>{c['Deliveries']}</td><td class='num alert'>{c['Drift_Pct']:+.1f}%</td>"
                f"<td class='num'>{c['Swing_Pct']:.1f}%</td></tr>"
            )
        lines.append("</tbody></table>")

        lines.append("<h3>6E. Ticket Attachment Multipliers (Across 7,915 Clover Orders)</h3>")
        lines.append("<table><thead><tr><th>Add-On / Category</th><th class='num'>Orders Attached</th><th class='num'>Total Orders</th><th class='num'>Attachment Rate</th></tr></thead><tbody>")
        for a in exec_analytics["ticket_attachments"]:
            lines.append(
                f"<tr><td><strong>{html.escape(a['Category'])}</strong></td><td class='num'>{a['Orders_Attached']:,}</td>"
                f"<td class='num'>{a['Total_Orders']:,}</td><td class='num'><strong>{a['Attachment_Pct']:.1f}%</strong></td></tr>"
            )
        lines.append("</tbody></table>")

    lines.append("</body></html>")
    return "\n".join(lines)


def write_docx_document(
    sections: List[Tuple[str, str, List[str], List[List[Any]], bool]],
    out_path: Path,
) -> None:
    """Write a mixed Portrait (Executive Report) + Landscape (Wide Spreadsheets) .docx using stdlib zipfile."""
    body_parts = [
        '<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr>'
        '<w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr>'
        '<w:t>Yellow Rose BBQ — Complete COGS, Plate Economics &amp; Walk-the-Shop Inventory Master</w:t></w:r></w:p>'
    ]

    portrait_sect = (
        '<w:sectPr>'
        '<w:pgSz w:w="12240" w:h="15840"/>'
        '<w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/>'
        '</w:sectPr>'
    )
    landscape_sect = (
        '<w:sectPr>'
        '<w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/>'
        '<w:pgMar w:top="504" w:right="504" w:bottom="504" w:left="504"/>'
        '</w:sectPr>'
    )

    prev_landscape = False
    for idx, (title, subtitle, headers, rows, is_landscape) in enumerate(sections):
        if idx > 0 and is_landscape != prev_landscape:
            # Close previous section with its orientation before starting the new orientation
            body_parts.append(f'<w:p><w:pPr>{landscape_sect if prev_landscape else portrait_sect}</w:pPr></w:p>')
        prev_landscape = is_landscape

        tbl_w = "14832" if is_landscape else "10800"
        body_parts.append(
            f'<w:p><w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>{xml_escape(title)}</w:t></w:r></w:p>'
        )
        if subtitle:
            body_parts.append(
                f'<w:p><w:r><w:rPr><w:sz w:val="18"/><w:color w:val="475569"/></w:rPr><w:t>{xml_escape(subtitle)}</w:t></w:r></w:p>'
            )
        tbl_rows = []
        hdr_cells = "".join(
            '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="1E293B"/></w:tcPr>'
            f'<w:p><w:r><w:rPr><w:b/><w:sz w:val="16"/><w:color w:val="FFFFFF"/></w:rPr><w:t>{xml_escape(str(h))}</w:t></w:r></w:p></w:tc>'
            for h in headers
        )
        tbl_rows.append(f"<w:tr><w:trPr><w:tblHeader/></w:trPr>{hdr_cells}</w:tr>")
        for row in rows:
            cells = "".join(
                f'<w:tc><w:p><w:r><w:rPr><w:sz w:val="15"/></w:rPr><w:t>{xml_escape(str("" if v is None else v))}</w:t></w:r></w:p></w:tc>'
                for v in row
            )
            tbl_rows.append(f"<w:tr>{cells}</w:tr>")

        body_parts.append(
            '<w:tbl><w:tblPr>'
            f'<w:tblW w:w="{tbl_w}" w:type="dxa"/>'
            '<w:tblBorders>'
            '<w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>'
            '<w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>'
            '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>'
            '<w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>'
            '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>'
            '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>'
            '</w:tblBorders></w:tblPr>'
            f'{"".join(tbl_rows)}</w:tbl><w:p/>'
        )

    sect_pr = landscape_sect if prev_landscape else portrait_sect
    doc_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f'<w:body>{"".join(body_parts)}{sect_pr}</w:body></w:document>'
    )

    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            '</Types>'
        ))
        zf.writestr("_rels/.rels", (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
            '</Relationships>'
        ))
        zf.writestr("word/document.xml", doc_xml)


def _load_merged_menu_cogs() -> List[Dict[str, Any]]:
    import csv as _csv
    cogs_p = BASE_DIR / "data" / "yellow_rose_bbq_cogs.csv"
    audit_p = BASE_DIR / "data" / "yellow_rose_bbq_clover_audit.csv"
    if not cogs_p.exists():
        return []
    with open(cogs_p, "r", encoding="utf-8") as f:
        cogs_list = list(_csv.DictReader(f))
    audit_by_name: Dict[str, Dict[str, str]] = {}
    if audit_p.exists():
        with open(audit_p, "r", encoding="utf-8") as f:
            for r in _csv.DictReader(f):
                audit_by_name[r["Menu Item"]] = r
    merged: List[Dict[str, Any]] = []
    for r in cogs_list:
        a = audit_by_name.get(r["Menu Item"], {})
        merged.append({
            "Category": r["Category"],
            "Menu Item": r["Menu Item"],
            "Clover POS Item Name": a.get("Clover POS Item Name", ""),
            "Portion Specification": r["Portion Specification"],
            "Wholesale Component Math": r["Wholesale Component Math"],
            "Portion COGS ($)": float(r["Portion COGS ($)"]),
            "Retail Price ($)": float(r["Retail Price ($)"]),
            "Clover Live Price ($)": float(a.get("Clover Live Price ($)", "0.00") or 0.0),
            "Gross Profit ($)": float(r["Gross Profit ($)"]),
            "Food Cost %": r["Food Cost %"],
            "Gross Margin %": r["Gross Margin %"],
            "Profitability Tier": r["Profitability Tier"],
            "Operational Guidance": r["Operational Guidance"],
        })
    return merged


def build_executive_profit_analytics(df_usage: pd.DataFrame, df_detail: pd.DataFrame) -> Dict[str, Any]:
    """Compute Menu Engineering Matrix, What-If Price Tuning, 26W Protein Volume, Price Creep, and Ticket Attachment."""
    import csv as _csv
    import sqlite3
    from scripts.verify_cogs_with_clover import EXPLICIT_MAP

    db_path = BASE_DIR / "data" / "clover_sales_master.db"
    cat_path = BASE_DIR / "data" / "clover_live_catalog_audit.json"
    cogs_path = BASE_DIR / "data" / "yellow_rose_bbq_cogs.csv"

    pos_by_name: Dict[str, Tuple[float, float, float]] = {}
    ticket_attachments: List[Dict[str, Any]] = []
    if db_path.exists():
        conn = sqlite3.connect(str(db_path))
        cur = conn.cursor()
        cur.execute("""
            SELECT lower(trim(item_name)),
                   SUM(CASE WHEN quantity > 100 THEN quantity/1000.0 ELSE COALESCE(quantity, 1.0) END) as qty,
                   SUM(price_usd) as rev,
                   AVG(price_usd) as avg_p
            FROM order_line_items
            WHERE item_name IS NOT NULL
            GROUP BY lower(trim(item_name))
        """)
        pos_by_name = {r[0]: (float(r[1] or 0), float(r[2] or 0), float(r[3] or 0)) for r in cur.fetchall()}

        cur.execute("SELECT COUNT(DISTINCT order_id) FROM order_line_items")
        total_orders = int(cur.fetchone()[0] or 1)
        attach_specs = [
            ("Beverages (Soda / Tea / Drinks)", "lower(item_name) LIKE '%coca cola%' OR lower(item_name) LIKE '%drink%' OR lower(item_name) LIKE '%tea%' OR lower(item_name) LIKE '%limeade%' OR lower(item_name) LIKE '%horchata%'"),
            ("Rosebuds (Appetizer)", "lower(item_name) LIKE '%rosebud%'"),
            ("Desserts (Banana Pudding / Churros)", "lower(item_name) LIKE '%banana pudding%' OR lower(item_name) LIKE '%churro%'"),
            ("Smoked Wings (5-Piece)", "lower(item_name) LIKE '%wing%'"),
            ("Skillet Cornbread (Add-On)", "lower(item_name) LIKE '%cornbread%'"),
            ("Single Bone Pork Rib (Add-On)", "lower(item_name) LIKE '%single bone%'"),
        ]
        for label, cond in attach_specs:
            cur.execute(f"SELECT COUNT(DISTINCT order_id) FROM order_line_items WHERE {cond}")
            cnt = int(cur.fetchone()[0] or 0)
            ticket_attachments.append({
                "Category": label,
                "Orders_Attached": cnt,
                "Total_Orders": total_orders,
                "Attachment_Pct": round(cnt / total_orders * 100.0, 1),
            })
        conn.close()

    cat_json = json.loads(cat_path.read_text(encoding="utf-8")) if cat_path.exists() else {}
    cogs_rows = list(_csv.DictReader(open(cogs_path, "r", encoding="utf-8"))) if cogs_path.exists() else []

    seen_clover = set()
    matrix_all: List[Dict[str, Any]] = []
    for r in cogs_rows:
        cname = EXPLICIT_MAP.get(r["Menu Item"], "")
        ckey = cname.lower()
        if not ckey or ckey in seen_clover or "🧢" in r["Category"]:
            continue
        seen_clover.add(ckey)
        cogs_val = float(r["Portion COGS ($)"])
        cat_p = cat_json[ckey]["price"] if ckey in cat_json else 0.0
        qty, _, db_avg_p = pos_by_name.get(ckey, (0.0, 0.0, 0.0))
        live_p = cat_p if cat_p > 0 else (db_avg_p if db_avg_p > 0 else 0.0)
        if live_p <= 0 or qty <= 0:
            continue
        fc_pct = (cogs_val / live_p) * 100.0
        unit_margin = live_p - cogs_val
        tot_profit = qty * unit_margin
        if qty >= 150 and fc_pct <= 32.0:
            quad = "Star (High Vol + Strong Margin)"
        elif qty >= 150 and fc_pct > 32.0:
            quad = "Workhorse (Margin Squeeze)"
        elif qty >= 15 and fc_pct <= 28.0 and unit_margin >= 5.0:
            quad = "Hidden Gem (Upsell Target)"
        else:
            quad = "Low Volume / Standard"
        matrix_all.append({
            "Quadrant": quad,
            "Clover_Item": cname,
            "Sold_90d": round(qty, 1),
            "Live_Price_USD": round(live_p, 2),
            "Portion_COGS_USD": round(cogs_val, 2),
            "Live_FC_Pct": round(fc_pct, 1),
            "Profit_Per_Order_USD": round(unit_margin, 2),
            "Gross_Profit_90d_USD": round(tot_profit, 2),
        })

    stars = sorted([x for x in matrix_all if x["Quadrant"].startswith("Star")], key=lambda x: -x["Gross_Profit_90d_USD"])[:10]
    workhorses = sorted([x for x in matrix_all if x["Quadrant"].startswith("Workhorse")], key=lambda x: -x["Gross_Profit_90d_USD"])[:8]
    gems = sorted([x for x in matrix_all if x["Quadrant"].startswith("Hidden Gem")], key=lambda x: -x["Profit_Per_Order_USD"])[:6]
    menu_matrix = stars + workhorses + gems

    # What-If Price Tuning on Squeezed High-Volume Items
    tuning_specs = [
        ("2 Meat Plate", ["2 meat plate"], 23.00, 9.55, 25.00),
        ("1-Meat BBQ Plate", ["bbq plate"], 18.00, 7.54, 20.00),
        ("Brisket (1 lb)", ["brisket"], 28.50, 12.70, 32.00),
        ("Rosebud (4-Pack)", ["rosebud"], 5.00, 1.85, 6.00),
        ("Moist & Lean Brisket Sandwiches", ["moist sandwich", "lean sandwich"], 13.00, 5.91, 14.50),
        ("Crispy Quesa Taco Brisket", ["crispy quesa taco brisket"], 5.00, 2.04, 5.50),
        ("2 oz Ranch Side Cup", ["ranch side"], 0.50, 0.26, 0.75),
    ]
    price_tuning: List[Dict[str, Any]] = []
    for label, keys, cur_p, cogs_u, tgt_p in tuning_specs:
        units = sum(pos_by_name.get(k, (0.0, 0.0, 0.0))[0] for k in keys)
        gain_90d = round(units * (tgt_p - cur_p), 2)
        price_tuning.append({
            "Item": label,
            "Units_90d": round(units, 1),
            "Current_Price_USD": cur_p,
            "Current_FC_Pct": round(cogs_u / cur_p * 100.0, 1),
            "Target_Price_USD": tgt_p,
            "Target_FC_Pct": round(cogs_u / tgt_p * 100.0, 1),
            "Gain_90d_USD": gain_90d,
            "Annual_Gain_USD": round(gain_90d * 4.0, 2),
        })

    # 26-Week Protein & Key Ingredient Volume
    s_desc = df_usage["Product Description"].fillna("").astype(str).str.lower()
    protein_depletion: List[Dict[str, Any]] = []
    for label, kws in [
        ("Beef Brisket", ["brisket"]),
        ("Pork Spare Ribs", ["sparerib"]),
        ("Pork Boston Butt", ["boston butt", "pork, butt"]),
        ("Turkey Breast", ["turkey, roast breast"]),
        ("Beef Short / Dino Ribs", ["short rib"]),
        ("Jumbo Chicken Wings", ["wing"]),
        ("Cheddar / Melting Cheese", ["cheese, cheddar", "cheese, american", "queso"]),
    ]:
        mask = s_desc.apply(lambda s: any(k in s for k in kws))
        lbs = float(df_usage.loc[mask, "Net Weight Shipped"].fillna(0).sum())
        cs = float(df_usage.loc[mask, "Cases"].fillna(0).sum())
        protein_depletion.append({
            "Category": label,
            "Delivered_Lbs_26W": round(lbs, 1),
            "Delivered_Cases_26W": round(cs, 1),
            "Weekly_Lbs": round(lbs / INVOICE_WEEKS, 1),
            "Weekly_Cases": round(cs / INVOICE_WEEKS, 1),
        })

    # US Foods Price Creep Watchdog
    dfd = df_detail.copy()
    dfd["dt"] = pd.to_datetime(dfd["Invoice Date"], errors="coerce")
    dfd["ext"] = pd.to_numeric(dfd["Extended Price"].fillna("0").astype(str).str.replace("$", "", regex=False).str.replace(",", "", regex=False), errors="coerce").fillna(0.0)
    dfd["wt"] = pd.to_numeric(dfd["Net Weight Shipped"], errors="coerce").fillna(0.0)
    dfd["cs"] = pd.to_numeric(dfd["Cases Shipped"], errors="coerce").fillna(0.0)
    dfv = dfd[(dfd["ext"] > 0) & (dfd["cs"] > 0)].copy()
    dfv["unit_metric"] = dfv.apply(lambda r: r["ext"] / r["wt"] if (str(r["Catch Weight Ind"]).strip() == "Y" and r["wt"] > 0) else r["ext"] / r["cs"], axis=1)

    creep_all: List[Dict[str, Any]] = []
    for (pnum, desc), grp in dfv.groupby(["Product Number", "Product Description"]):
        grp = grp.sort_values("dt")
        if len(grp) >= 5 and grp["ext"].sum() >= 500:
            n_edge = max(2, len(grp) // 4)
            early_avg = grp.iloc[:n_edge]["unit_metric"].mean()
            late_avg = grp.iloc[-n_edge:]["unit_metric"].mean()
            min_v, max_v = grp["unit_metric"].min(), grp["unit_metric"].max()
            drift = ((late_avg - early_avg) / early_avg * 100.0) if early_avg > 0 else 0.0
            swing = ((max_v - min_v) / min_v * 100.0) if min_v > 0 else 0.0
            creep_all.append({
                "US_Foods_Num": int(pnum),
                "Item_Description": str(desc).strip(),
                "Deliveries": int(len(grp)),
                "Drift_Pct": round(drift, 1),
                "Swing_Pct": round(swing, 1),
            })
    price_creep = sorted(creep_all, key=lambda x: -x["Drift_Pct"])[:12]

    return {
        "menu_matrix": menu_matrix,
        "price_tuning": price_tuning,
        "protein_depletion": protein_depletion,
        "price_creep": price_creep,
        "ticket_attachments": ticket_attachments,
    }


def generate_all() -> Dict[str, str]:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    os.chmod(REPORTS_DIR, 0o700)

    df_usage, df_detail = validate_and_load_moxe()
    inv_rows = build_walk_the_shop_inventory(df_usage)
    dep_rows = compute_pos_supply_depletion(df_usage)
    cogs_rep = compute_four_bucket_cogs(df_usage, df_detail, dep_rows)
    skus = _sku_lookup(df_usage)
    plate_rows, components = build_unit_economics(df_usage, cogs_rep)
    menu_rows = _load_merged_menu_cogs()
    from scripts.recipe_cogs_engine import export_recipe_cogs_csvs
    recipe_summary, recipe_detail = export_recipe_cogs_csvs()
    exec_analytics = build_executive_profit_analytics(df_usage, df_detail)

    # 1. Master Landscape HTML
    html_str = render_master_html(cogs_rep, plate_rows, components, dep_rows, inv_rows, skus, menu_rows, recipe_summary, exec_analytics)
    MASTER_HTML.write_text(html_str, encoding="utf-8")

    # 2. Multi-Tab Excel / Google Sheets Workbook (.xlsx)
    s1_hdr = ["COGS_Bucket", "Unique_SKUs", "Cases_Shipped", "Net_Weight_Lbs", "Total_Spend_USD", "Weekly_Avg_USD", "Share_Pct"]
    s1_rows = [
        [b, st["sku_count"], st["cases"], st["net_weight_lbs"], st["dollars"], round(st["dollars"] / INVOICE_WEEKS, 2), st["share_pct"]]
        for b, st in cogs_rep["buckets"].items()
    ]
    s2_hdr = list(plate_rows[0].keys())
    s2_rows = [[r[k] for k in s2_hdr] for r in plate_rows]
    s3_hdr = list(components[0].keys())
    s3_rows = [[r[k] for k in s3_hdr] for r in components]
    s4_hdr = list(dep_rows[0].keys())
    s4_rows = [[r[k] for k in s4_hdr] for r in dep_rows]
    s5_hdr = list(inv_rows[0].keys()) + ["Avg_Price_Per_Case_USD", "Total_Spend_26W_USD"]
    s5_rows = [
        [r[k] for k in inv_rows[0].keys()] + [skus[r["US_Foods_Product_Number"]]["avg_cs"], skus[r["US_Foods_Product_Number"]]["dollars"]]
        for r in inv_rows
    ]
    s6_hdr = list(menu_rows[0].keys()) if menu_rows else []
    s6_rows = [[r[k] for k in s6_hdr] for r in menu_rows] if menu_rows else []
    s7_hdr = list(recipe_summary[0].keys()) if recipe_summary else []
    s7_rows = [[r[k] for k in s7_hdr] for r in recipe_summary] if recipe_summary else []
    s8_hdr = list(recipe_detail[0].keys()) if recipe_detail else []
    s8_rows = [[r[k] for k in s8_hdr] for r in recipe_detail] if recipe_detail else []

    wb_tabs = [
        ("Executive_4Bucket_COGS", s1_hdr, s1_rows),
        ("Plate_Drink_Unit_Costs", s2_hdr, s2_rows),
        ("Component_Cost_Lookup", s3_hdr, s3_rows),
        ("POS_Depletion_Audit", s4_hdr, s4_rows),
        ("Walk_the_Shop_176_SKUs", s5_hdr, s5_rows),
    ]
    if menu_rows:
        wb_tabs.append(("Complete_Menu_137_Items", s6_hdr, s6_rows))
    if recipe_summary:
        wb_tabs.append(("Recipe_Batch_COGS_34", s7_hdr, s7_rows))
    if recipe_detail:
        wb_tabs.append(("Recipe_Ingredient_Lines", s8_hdr, s8_rows))
    if exec_analytics:
        for tab_name, rows_list in [
            ("Exec_Menu_Matrix", exec_analytics["menu_matrix"]),
            ("Exec_Price_Tuning", exec_analytics["price_tuning"]),
            ("Exec_Protein_Volume", exec_analytics["protein_depletion"]),
            ("Exec_USFoods_Price_Creep", exec_analytics["price_creep"]),
            ("Exec_Ticket_Attachments", exec_analytics["ticket_attachments"]),
        ]:
            if rows_list:
                hdrs = list(rows_list[0].keys())
                wb_tabs.append((tab_name, hdrs, [[r[k] for k in hdrs] for r in rows_list]))
    write_xlsx_workbook(wb_tabs, MASTER_XLSX)

    # 3. Single Master PDF (Portrait Executive Report + Landscape CSV Spreadsheet pages via CSS @page)
    node_pdf_script = f"""
const {{ chromium }} = require('playwright');
(async () => {{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://{MASTER_HTML}', {{ waitUntil: 'networkidle' }});
  await page.pdf({{
    path: '{MASTER_PDF}',
    preferCSSPageSize: true,
    printBackground: true
  }});
  await browser.close();
}})();
"""
    subprocess.run(["node", "-e", node_pdf_script], cwd=str(BASE_DIR), check=True)

    # 4. Google Docs-ready DOCX (Portrait Report + Landscape CSV Inventory Spreadsheet)
    docx_sections = [
        ("1. 4-Bucket Operational COGS Breakdown", f"Window: {cogs_rep['window']} | 157 Invoices | 176 SKUs", s1_hdr, [
            [b, st["sku_count"], f"{st['cases']:,.2f}", f"{st['net_weight_lbs']:,.1f}", f"${st['dollars']:,.2f}", f"${st['dollars'] / INVOICE_WEEKS:,.2f}", f"{st['share_pct']}%"]
            for b, st in cogs_rep["buckets"].items()
        ], False),
        ("2. Menu Plate, Sides, Packaging & Drink Unit Cost Breakdown", "POS selling price vs. full 4-Bucket COGS (Protein + Sides + Packaging + Drink + Pit Overhead)", s2_hdr, [
            [r["Menu_Combo"], f"${r['Menu_Price_USD']:,.2f}", f"${r['Protein_Cost_USD']:,.2f}", f"${r['Sides_Cost_USD']:,.2f}", f"${r['Packaging_Cost_USD']:,.2f}", f"${r['Drink_Cost_USD']:,.2f}", f"${r['Pit_Overhead_USD']:,.2f}", f"${r['Total_4Bucket_COGS_USD']:,.2f}", f"{r['COGS_Pct']}%", f"${r['Gross_Profit_USD']:,.2f}", f"{r['Gross_Margin_Pct']}%"]
            for r in plate_rows
        ], False),
        ("3. Component Unit Cost Basis", "Derived directly from US Foods MOXE catch-weight & case prices", s3_hdr, [
            [c["Component"], c["US_Foods_Anchor"], f"${c['Unit_Cost_USD']:,.2f}", c["Notes"]]
            for c in components
        ], False),
        ("4. POS-to-Supply Theoretical vs. Delivered Depletion Audit", "17 Core Packaging & Pit SKUs (55% Dine-In / 45% To-Go fallback)", s4_hdr, [
            [d["US_Foods_Product_Number"], d["Operational_Role"], d["Pack_Size"], int(d["Units_Per_Case"]), d["POS_Theoretical_Cases"], d["US_Foods_Delivered_Cases"], d["Variance_Cases"], f"{d['Variance_Pct']}%", d["Audit_Status"]]
            for d in dep_rows
        ], False),
        ("5. Complete Walk-the-Shop Physical Inventory & Par Sheet (176 SKUs — Landscape Spreadsheet)", "Par Level = 1.25x Weekly Burn | Reorder Trigger = 0.50x Weekly Burn", [
            "Walk Zone", "US Foods #", "Item Name", "Pack Size", "Weekly Burn (cases)", "Par (cases)", "Reorder Trigger (cases)", "Avg $/Case", "Total Spend", "Full Cases", "Loose"
        ], [
            [r["Walk_Zone"], r["US_Foods_Product_Number"], r["Item_Name"], r["Pack_Size"], r["Weekly_Burn_Rate_Cases"], r["Recommended_Par_Cases"], r["Order_Trigger_Cases"], f"${skus[r['US_Foods_Product_Number']]['avg_cs']:,.2f}", f"${skus[r['US_Foods_Product_Number']]['dollars']:,.2f}", "", ""]
            for r in inv_rows
        ], True),
    ]
    if menu_rows:
        docx_sections.append((
            f"6. Complete Menu Item COGS & Clover POS Master Breakdown ({len(menu_rows)} Items — 100% Catalog Coverage)",
            "Includes all sandwiches, tacos, meats, platters, sides, catering trays, sauces, drinks, beer/cocktails, and POS items",
            ["Category", "Menu Item", "Clover POS Name", "Portion Spec", "COGS ($)", "Model Price", "Clover Price", "Profit ($)", "FC %", "Margin %"],
            [
                [
                    m["Category"],
                    m["Menu Item"],
                    m["Clover POS Item Name"],
                    m["Portion Specification"],
                    f"${m['Portion COGS ($)']:,.2f}",
                    f"${m['Retail Price ($)']:,.2f}",
                    f"${m['Clover Live Price ($)']:,.2f}",
                    f"${m['Gross Profit ($)']:,.2f}",
                    m["Food Cost %"],
                    m["Gross Margin %"],
                ]
                for m in menu_rows
            ],
            True,
        ))
    if recipe_summary:
        docx_sections.append((
            f"7. Handwritten Notebook & Sausage Recipe Batch COGS Breakdown ({len(recipe_summary)} Yellow Rose BBQ Recipes)",
            "Cross-referenced from Handwritten Recipe Collection (through Asiago Cheddar Grits, excluding HGC/Dine Happy) + Mild & Jalapeno Cheddar Sausages",
            ["Category", "Recipe Name", "Batch Yield", "Portion Unit", "Portions", "Ingredient Cost Math", "Batch COGS", "Cost/Portion", "1/2 Pan COGS"],
            [
                [
                    r["Recipe_Category"],
                    r["Recipe_Name"],
                    r["Batch_Yield_Specification"],
                    r["Portion_Unit"],
                    r["Portions_Per_Batch"],
                    r["Ingredient_Cost_Formula"],
                    f"${r['Total_Batch_COGS_USD']:,.2f}",
                    f"${r['Cost_Per_Portion_USD']:,.2f}",
                    f"${float(r['Half_Steam_Pan_COGS_USD']):,.2f}" if r["Half_Steam_Pan_COGS_USD"] != "N/A" else "N/A",
                ]
                for r in recipe_summary
            ],
            True,
        ))
    if exec_analytics:
        docx_sections.append((
            "8. Executive Profit, Menu Engineering & What-If Price Tuning",
            "Live Clover POS volume (7,915 orders) joined against portion COGS and live register prices",
            ["Quadrant", "Clover Item", "90d Sold", "Live Price", "COGS ($)", "Live FC %", "Profit/Order", "90d Gross Profit"],
            [
                [m["Quadrant"], m["Clover_Item"], m["Sold_90d"], f"${m['Live_Price_USD']:,.2f}", f"${m['Portion_COGS_USD']:,.2f}", f"{m['Live_FC_Pct']}%", f"${m['Profit_Per_Order_USD']:,.2f}", f"${m['Gross_Profit_90d_USD']:,.2f}"]
                for m in exec_analytics["menu_matrix"]
            ],
            True,
        ))
        docx_sections.append((
            "9. What-If Price Tuning & US Foods Price Creep Watchdog",
            "Modest price adjustments on squeezed high-volume items + top recurring SKUs with vendor price creep",
            ["Item", "90d Units", "Current (FC %)", "Target (New FC %)", "90d Gain", "Annual Gain"],
            [
                [p["Item"], p["Units_90d"], f"${p['Current_Price_USD']:,.2f} ({p['Current_FC_Pct']}%)", f"${p['Target_Price_USD']:,.2f} ({p['Target_FC_Pct']}%)", f"+${p['Gain_90d_USD']:,.2f}", f"+${p['Annual_Gain_USD']:,.2f}"]
                for p in exec_analytics["price_tuning"]
            ],
            False,
        ))
        docx_sections.append((
            "10. US Foods Invoice Price Creep (May -> Nov) & Ticket Attachments",
            "Top 12 recurring US Foods SKUs by Early -> Recent invoice price drift",
            ["US Foods #", "Item Description", "Deliveries", "Early->Recent Drift", "Min-Max Swing"],
            [
                [c["US_Foods_Num"], c["Item_Description"], c["Deliveries"], f"{c['Drift_Pct']:+.1f}%", f"{c['Swing_Pct']:.1f}%"]
                for c in exec_analytics["price_creep"]
            ],
            False,
        ))
    write_docx_document(docx_sections, MASTER_DOCX)

    for p in (MASTER_HTML, MASTER_PDF, MASTER_XLSX, MASTER_DOCX):
        if p.exists():
            os.chmod(p, 0o600)

    return {
        "master_pdf": str(MASTER_PDF),
        "master_xlsx": str(MASTER_XLSX),
        "master_docx": str(MASTER_DOCX),
        "master_html": str(MASTER_HTML),
    }


if __name__ == "__main__":
    out = generate_all()
    print(json.dumps(out, indent=2))
