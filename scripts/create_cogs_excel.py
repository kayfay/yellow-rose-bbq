#!/usr/bin/env python3
"""
Create Yellow Rose BBQ Multi-Tab Excel Workbook (.xlsx)
Reads the individual CSV files and compiles them into a single valid OpenXML .xlsx file
with 3 distinct tabs:
  1. Menu Item COGS
  2. Wholesale & Yields
  3. Executive Summary & KPIs
"""

import csv
import io
import re
import zipfile
import html
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
OUTPUT_XLSX = DATA_DIR / "yellow_rose_bbq_cogs.xlsx"

CSV_1 = DATA_DIR / "yellow_rose_bbq_cogs.csv"
CSV_2 = DATA_DIR / "yellow_rose_bbq_wholesale_yields.csv"
CSV_3 = DATA_DIR / "yellow_rose_bbq_complete_cogs_model.csv"
CSV_4 = DATA_DIR / "yellow_rose_bbq_clover_audit.csv"
CSV_5 = DATA_DIR / "yellow_rose_bbq_audit_report.csv"

def get_col_letter(col_idx):
    """Convert 1-based column index to Excel column letters (A, B, ..., Z, AA, AB, ...)."""
    result = ""
    while col_idx > 0:
        col_idx, remainder = divmod(col_idx - 1, 26)
        result = chr(65 + remainder) + result
    return result

class SimpleXlsxWriter:
    def __init__(self):
        self.sheets = []  # list of (sheet_name, rows_data)
        self.shared_strings = []
        self.string_map = {}

    def add_string(self, text):
        if text not in self.string_map:
            idx = len(self.shared_strings)
            self.string_map[text] = idx
            self.shared_strings.append(text)
            return idx
        return self.string_map[text]

    def add_sheet(self, sheet_name, rows):
        """rows is a list of lists of values (str, float, int)."""
        self.sheets.append((sheet_name, rows))

    def build_zip(self, output_path):
        # Prepare sheet XMLs
        sheet_xmls = []
        for s_idx, (name, rows) in enumerate(self.sheets):
            xml_lines = [
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
                '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
                '  <sheetData>'
            ]
            for r_idx, row in enumerate(rows, start=1):
                if not row:
                    xml_lines.append(f'    <row r="{r_idx}"/>')
                    continue
                xml_lines.append(f'    <row r="{r_idx}">')
                for c_idx, val in enumerate(row, start=1):
                    col_letter = get_col_letter(c_idx)
                    cell_ref = f"{col_letter}{r_idx}"
                    
                    if val is None or val == "":
                        continue
                    
                    # Check if numeric
                    is_num = False
                    num_val = None
                    if isinstance(val, (int, float)):
                        is_num = True
                        num_val = val
                    elif isinstance(val, str):
                        # Try parsing as float if purely numeric
                        val_strip = val.strip()
                        if re.match(r'^-?\d+(\.\d+)?$', val_strip):
                            is_num = True
                            num_val = float(val_strip) if '.' in val_strip else int(val_strip)

                    if is_num:
                        xml_lines.append(f'      <c r="{cell_ref}"><v>{num_val}</v></c>')
                    else:
                        str_val = str(val)
                        s_idx_val = self.add_string(str_val)
                        xml_lines.append(f'      <c r="{cell_ref}" t="s"><v>{s_idx_val}</v></c>')
                xml_lines.append('    </row>')
            xml_lines.append('  </sheetData>')
            xml_lines.append('</worksheet>')
            sheet_xmls.append("\n".join(xml_lines))

        # Build sharedStrings.xml
        sst_lines = [
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
            f'<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="{len(self.shared_strings)}" uniqueCount="{len(self.shared_strings)}">'
        ]
        for s in self.shared_strings:
            escaped = html.escape(s)
            sst_lines.append(f'  <si><t>{escaped}</t></si>')
        sst_lines.append('</sst>')
        sst_xml = "\n".join(sst_lines)

        # Build [Content_Types].xml
        ct_lines = [
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
            '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
            '  <Default Extension="xml" ContentType="application/xml"/>',
            '  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
            '  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>',
            '  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        ]
        for i in range(1, len(self.sheets) + 1):
            ct_lines.append(f'  <Override PartName="/xl/worksheets/sheet{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>')
        ct_lines.append('</Types>')
        ct_xml = "\n".join(ct_lines)

        # Build _rels/.rels
        rels_xml = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n'
            '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>\n'
            '</Relationships>'
        )

        # Build xl/_rels/workbook.xml.rels
        wb_rels_lines = [
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        ]
        for i in range(1, len(self.sheets) + 1):
            wb_rels_lines.append(f'  <Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i}.xml"/>')
        
        rid_sst = len(self.sheets) + 1
        rid_styles = len(self.sheets) + 2
        wb_rels_lines.append(f'  <Relationship Id="rId{rid_sst}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>')
        wb_rels_lines.append(f'  <Relationship Id="rId{rid_styles}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>')
        wb_rels_lines.append('</Relationships>')
        wb_rels_xml = "\n".join(wb_rels_lines)

        # Build xl/workbook.xml
        wb_lines = [
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
            '  <sheets>'
        ]
        for i, (name, _) in enumerate(self.sheets, start=1):
            clean_name = html.escape(name[:31]) # Excel sheet names max 31 chars
            wb_lines.append(f'    <sheet name="{clean_name}" sheetId="{i}" r:id="rId{i}"/>')
        wb_lines.append('  </sheets>')
        wb_lines.append('</workbook>')
        wb_xml = "\n".join(wb_lines)

        # Build minimal styles.xml
        styles_xml = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">\n'
            '  <fonts count="1"><font><name val="Calibri"/><sz val="11"/></font></fonts>\n'
            '  <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>\n'
            '  <borders count="1"><border><left/><right/><top/><bottom/></border></borders>\n'
            '  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>\n'
            '  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>\n'
            '</styleSheet>'
        )

        # Write out to ZIP
        with zipfile.ZipFile(output_path, 'w', compression=zipfile.ZIP_DEFLATED) as z:
            z.writestr('[Content_Types].xml', ct_xml)
            z.writestr('_rels/.rels', rels_xml)
            z.writestr('xl/workbook.xml', wb_xml)
            z.writestr('xl/_rels/workbook.xml.rels', wb_rels_xml)
            z.writestr('xl/sharedStrings.xml', sst_xml)
            z.writestr('xl/styles.xml', styles_xml)
            for i, sheet_xml in enumerate(sheet_xmls, start=1):
                z.writestr(f'xl/worksheets/sheet{i}.xml', sheet_xml)

def read_csv_rows(path):
    rows = []
    with open(path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        for r in reader:
            rows.append(r)
    return rows

def main():
    writer = SimpleXlsxWriter()

    # Sheet 1: Menu Item COGS Breakdown
    rows1 = read_csv_rows(CSV_1)
    writer.add_sheet("Menu Item COGS", rows1)

    # Sheet 2: Wholesale & Cooked Yields
    rows2 = read_csv_rows(CSV_2)
    writer.add_sheet("Wholesale & Yields", rows2)

    # Sheet 3: Complete Model / Executive Summary
    rows3 = read_csv_rows(CSV_3)
    writer.add_sheet("Master COGS Model", rows3)

    # Sheet 4: Clover POS Live Audit
    if CSV_4.exists():
        rows4 = read_csv_rows(CSV_4)
        writer.add_sheet("Clover POS Audit", rows4)

    # Sheet 5: Executive Report & Findings
    if CSV_5.exists():
        rows5 = read_csv_rows(CSV_5)
        writer.add_sheet("Executive Report", rows5)

    writer.build_zip(OUTPUT_XLSX)
    print(f"Successfully generated Excel workbook with {len(writer.sheets)} tabs: {OUTPUT_XLSX}")

if __name__ == "__main__":
    main()
