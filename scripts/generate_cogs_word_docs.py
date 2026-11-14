#!/usr/bin/env python3
"""
Yellow Rose BBQ - Word (.docx) Document Generator
Generates three professional OpenXML (.docx) documents for COGS analysis:
  1. Yellow_Rose_BBQ_Packaging_Cost_Matrix.docx
  2. Yellow_Rose_BBQ_MOXE_Data_Collection_Workflow.docx
  3. Yellow_Rose_BBQ_Owner_Handoff_and_Recipe_Gap_Fill.docx
"""

import os
import zipfile
import html
from pathlib import Path

ROOT_DIR = Path('/home/atools/Documents/GitHub/yellow-rose-bbq')
DOCS_DIR = ROOT_DIR / 'data' / 'word_documents'
DOCS_DIR.mkdir(parents=True, exist_ok=True)


class ProfessionalDocx:
    def __init__(self, doc_title, subtitle=''):
        self.doc_title = doc_title
        self.subtitle = subtitle
        self.body = []

        # Header banner
        self.body.append(f'''<w:p>
            <w:pPr><w:spacing w:before="0" w:after="80"/></w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="38"/><w:color w:val="1B365D"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr><w:t>{html.escape(doc_title)}</w:t></w:r>
        </w:p>''')

        if subtitle:
            self.body.append(f'''<w:p>
                <w:pPr>
                    <w:spacing w:before="0" w:after="240"/>
                    <w:pBdr><w:bottom w:val="single" w:sz="12" w:space="6" w:color="D97706"/></w:pBdr>
                </w:pPr>
                <w:r><w:rPr><w:i/><w:sz w:val="24"/><w:color w:val="64748B"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr><w:t>{html.escape(subtitle)}</w:t></w:r>
            </w:p>''')

    def add_h1(self, text):
        self.body.append(f'''<w:p>
            <w:pPr>
                <w:spacing w:before="320" w:after="120"/>
                <w:pBdr><w:bottom w:val="single" w:sz="6" w:space="4" w:color="CBD5E1"/></w:pBdr>
            </w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="1B365D"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr><w:t>{html.escape(text)}</w:t></w:r>
        </w:p>''')

    def add_h2(self, text):
        self.body.append(f'''<w:p>
            <w:pPr><w:spacing w:before="200" w:after="80"/></w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="2B4C7E"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr><w:t>{html.escape(text)}</w:t></w:r>
        </w:p>''')

    def add_p(self, text, bold_prefix='', italic=False):
        b_xml = f'<w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="0F172A"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr><w:t>{html.escape(bold_prefix)} </w:t></w:r>' if bold_prefix else ''
        i_xml = '<w:i/>' if italic else ''
        self.body.append(f'''<w:p>
            <w:pPr><w:spacing w:before="60" w:after="80"/></w:pPr>
            {b_xml}
            <w:r><w:rPr><w:sz w:val="22"/>{i_xml}<w:color w:val="334155"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr><w:t>{html.escape(text)}</w:t></w:r>
        </w:p>''')

    def add_callout(self, text, title='KEY TAKEAWAY'):
        self.body.append(f'''<w:tbl>
            <w:tblPr>
                <w:tblW w:w="9360" w:type="dxa"/>
                <w:tblBorders>
                    <w:top w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/>
                    <w:left w:val="single" w:sz="24" w:space="0" w:color="D97706"/>
                    <w:insideH w:val="none"/><w:insideV w:val="none"/>
                </w:tblBorders>
            </w:tblPr>
            <w:tr>
                <w:tc>
                    <w:tcPr>
                        <w:tcW w:w="9360" w:type="dxa"/>
                        <w:shd w:val="clear" w:color="auto" w:fill="FFFBEB"/>
                        <w:tcMar><w:top w:w="140"/><w:bottom w:w="140"/><w:left w:w="200"/><w:right w:w="140"/></w:tcMar>
                    </w:tcPr>
                    <w:p>
                        <w:r><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="92400E"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr><w:t>{html.escape(title)}: </w:t></w:r>
                        <w:r><w:rPr><w:sz w:val="20"/><w:color w:val="78350F"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr><w:t>{html.escape(text)}</w:t></w:r>
                    </w:p>
                </w:tc>
            </w:tr>
        </w:tbl>''')

    def add_bullet(self, text, bold_prefix='', checked=None):
        prefix_char = ''
        if checked is True:
            prefix_char = '[X] '
        elif checked is False:
            prefix_char = '[  ] '

        b_xml = f'<w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="0F172A"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr><w:t>{html.escape(prefix_char + bold_prefix)} </w:t></w:r>' if (bold_prefix or prefix_char) else ''

        self.body.append(f'''<w:p>
            <w:pPr>
                <w:ind w:left="360"/>
                <w:spacing w:before="40" w:after="60"/>
            </w:pPr>
            {b_xml}
            <w:r><w:rPr><w:sz w:val="22"/><w:color w:val="334155"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr><w:t>{html.escape(text)}</w:t></w:r>
        </w:p>''')

    def add_table(self, headers, rows, col_widths=None):
        if not col_widths:
            col_widths = [str(int(9360 / len(headers)))] * len(headers)

        t_xml = ['''<w:tbl>
            <w:tblPr>
                <w:tblW w:w="9360" w:type="dxa"/>
                <w:tblBorders>
                    <w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
                    <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
                    <w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
                    <w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
                    <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
                    <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
                </w:tblBorders>
            </w:tblPr>''']

        # Header Row
        t_xml.append('<w:tr><w:trPr><w:tblHeader/></w:trPr>')
        for idx, h in enumerate(headers):
            w = col_widths[idx]
            t_xml.append(f'''<w:tc>
                <w:tcPr>
                    <w:tcW w:w="{w}" w:type="dxa"/>
                    <w:shd w:val="clear" w:color="auto" w:fill="1B365D"/>
                    <w:tcMar><w:top w:w="140"/><w:bottom w:w="140"/><w:left w:w="120"/><w:right w:w="120"/></w:tcMar>
                </w:tcPr>
                <w:p><w:r><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="FFFFFF"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr><w:t>{html.escape(h)}</w:t></w:r></w:p>
            </w:tc>''')
        t_xml.append('</w:tr>')

        # Data Rows
        for r_idx, row in enumerate(rows):
            bg = 'F8FAFC' if r_idx % 2 == 1 else 'FFFFFF'
            t_xml.append('<w:tr>')
            for idx, val in enumerate(row):
                w = col_widths[idx]
                t_xml.append(f'''<w:tc>
                    <w:tcPr>
                        <w:tcW w:w="{w}" w:type="dxa"/>
                        <w:shd w:val="clear" w:color="auto" w:fill="{bg}"/>
                        <w:tcMar><w:top w:w="100"/><w:bottom w:w="100"/><w:left w:w="120"/><w:right w:w="120"/></w:tcMar>
                    </w:tcPr>
                    <w:p><w:r><w:rPr><w:sz w:val="19"/><w:color w:val="1E293B"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr><w:t>{html.escape(str(val))}</w:t></w:r></w:p>
                </w:tc>''')
            t_xml.append('</w:tr>')
        t_xml.append('</w:tbl>')
        self.body.append(''.join(t_xml))

    def save(self, filepath):
        content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>'''
        rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>'''

        body_content = ''.join(self.body)
        body_content += '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>'
        doc_xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>{body_content}</w:body>
</w:document>'''

        with zipfile.ZipFile(filepath, 'w', zipfile.ZIP_DEFLATED) as z:
            z.writestr('[Content_Types].xml', content_types)
            z.writestr('_rels/.rels', rels)
            z.writestr('word/document.xml', doc_xml)
        print(f'Successfully generated: {filepath}')


# ==========================================
# 1. BUILD PACKAGING COST MATRIX DOCX
# ==========================================
def build_packaging_matrix():
    doc = ProfessionalDocx('Yellow Rose BBQ — Packaging & Disposables Cost Matrix', 'Landed Item Costs, Case Packs, Component Bundles & Station Mapping')

    doc.add_callout(
        'In smokehouse operations, packaging is a direct variable food cost. A Dine-In plate costs ~$0.08 in disposables, while the exact same order To-Go costs ~$0.55 to $0.70. Accurately attributing packaging to Clover order types is critical to protecting margins.',
        'PROFITABILITY IMPACT'
    )

    doc.add_h1('1. Landed Wholesale Item Costs (US Foods MOXE Export)')
    doc.add_p('The following costs are derived directly from actual delivered invoice history (Port Orange Division, Account #91714857). All unit costs represent exact landed cost per single piece.')

    headers1 = ['Item Description', 'Brand / Code', 'Case Pack', 'Delivered $/Case', 'Unit Cost ($)', 'Primary Usage']
    rows1 = [
        ['3-Compartment Hinged Container (9x9.5" Black)', 'Monogram #528176', '150 EA', '$27.59', '$0.184', '1-Meat, 2-Meat & Combo Plates (To-Go)'],
        ['8 oz Round Clear Deli Container', 'Roseli #1085157', '10/50 (500 EA)', '$34.77', '$0.070', 'Single 6 oz Side Dish (Beans, Mac, Slaw)'],
        ['8-32 oz Clear Flat Deli Container Lid', 'Roseli #1088800', '10/50 (500 EA)', '$23.00', '$0.046', 'Universal Lid for 8 oz and 16 oz Deli Cups'],
        ['16 oz Round Clear Deli Container', 'Harvest Value #567683', '4/50 (200 EA)', '$14.12', '$0.071', 'Pints of Sides / Large Banana Pudding'],
        ['24 oz Cold PET Clear Plastic Cup', 'Monogram #597312', '12/60 (720 EA)', '$94.19', '$0.131', 'Large Fountain Sodas, Sweet & Unsweet Tea'],
        ['12-24 oz Flat Straw Slotted PET Lid', 'Monogram #723985', '12/85 (1020 EA)', '$73.24', '$0.072', 'Cold Beverage Cups'],
        ['Giant Wrapped Red Straw (10.25")', 'Harvest Value #567683', '10/500 (5000 EA)', '$65.70', '$0.013', 'Fountain Drink Station'],
        ['1/2-Size Deep Foil Steam Table Pan (2.5"D)', 'Monogram #723985', '100 EA', '$76.09', '$0.761', 'Catering Side Trays / Smoked Meats Bulk'],
        ['1/2-Size Aluminum Flat Pan Lid', 'Monogram #723986', '100 EA', '$49.23', '$0.492', 'Cover for 1/2 Steam Pan Catering Trays'],
        ['3 lb Food Tray (Paperboard Red/White)', 'Monogram #528176', '2/250 (500 EA)', '$40.26', '$0.081', 'Sandwiches, Wings, Tacos, Dine-In Plates'],
        ['0.5 lb Food Tray (Paperboard Red/White)', 'Harvest Value #661845', '4/250 (1000 EA)', '$29.14', '$0.029', 'Kids Plates, Single Tacos, Dine-In Sides'],
        ['T-Shirt Plastic Carry-Out Bags ("Thank You")', 'Harvest Value #252969', '1000 EA', '$39.94', '$0.040', 'To-Go & Call-In Order Transport'],
        ['Heavyweight Black Plastic Fork', 'Monogram Bulk', '1000 EA', '$27.89', '$0.028', 'Dine-In & To-Go Cutlery'],
        ['Heavyweight Black Plastic Knife', 'Monogram Bulk', '1000 EA', '$34.64', '$0.035', 'Rib & Brisket Service'],
        ['Heavyweight Black Plastic Soup Spoon', 'Monogram Bulk', '1000 EA', '$26.18', '$0.026', 'Chili, Beans & Banana Pudding'],
        ['Interfold Brown Dispenser Napkins (7.88x6.5")', 'Monarch #203904', '24/250 (6000 EA)', '$38.89', '$0.006', 'Dine-In Tables & To-Go Bags (~4 per guest)'],
        ['18" x 500\' Heavy-Duty Aluminum Foil Roll', 'Western Plastics #286P', '1 Roll', '$55.84', '$0.112 / ft', 'Smoker Meat Resting, Wrapping, Kitchen Prep'],
        ['18" x 2000\' Plastic Food Wrap Film', 'Western Plastics', '1 Roll', '$28.89', '$0.014 / ft', 'Line Holding, Pan Covering, Cold Storage'],
        ['XL Powder-Free Black Nitrile Gloves', 'Monogram #528176', '4/250 (1000 EA)', '$42.19', '$0.042 / ea', 'Kitchen Line Handling ($0.084 per pair)'],
        ['45-Gal Low-Density Can Liners (Trash Bags)', 'Monogram Heavy', '100 EA', '$41.72', '$0.417', 'Operational Waste Management']
    ]
    doc.add_table(headers1, rows1, ['2400', '1600', '1300', '1200', '1100', '1760'])

    doc.add_h1('2. Pre-Packaged Component Bundles')
    doc.add_p('When building recipes and menu margins, individual disposables must be combined into standard service packages:')

    headers_bundles = ['Bundle Name', 'Items Included in Bundle', 'Total Bundle Cost', 'Standard Application']
    rows_bundles = [
        ['Standard To-Go Side Set', '1x 8 oz Deli Container ($0.070) + 1x Lid ($0.046)', '$0.116', 'Every individual side ordered To-Go'],
        ['Pint / Large Dessert Set', '1x 16 oz Deli Container ($0.071) + 1x Lid ($0.046)', '$0.117', 'Pints of Mac, Beans, Slaw, Large Banana Pudding'],
        ['24 oz Cold Beverage Set', '1x 24 oz PET Cup ($0.131) + 1x Slotted Lid ($0.072) + 1x Straw ($0.013)', '$0.216', 'Fountain sodas, iced tea, lemonades'],
        ['Full Catering Side Tray Set', '1x Deep 1/2 Steam Pan ($0.761) + 1x Flat Aluminum Lid ($0.492)', '$1.253', 'Mac & Cheese, Green Beans, Wing Catering Trays'],
        ['Standard To-Go Plate Pack', '1x 3-Comp Hinged Box ($0.184) + 1x T-Shirt Bag ($0.040) + 1x Fork/Knife ($0.063) + 4x Napkins ($0.026)', '$0.313', 'Baseline packaging overhead on any To-Go Meat Plate (before sides)'],
        ['Standard Dine-In Boat Setup', '1x 3 lb Paper Boat ($0.081) + 1x Liner Sheet ($0.018) + 1x Fork ($0.028) + 3x Napkins ($0.020)', '$0.147', 'Dine-In Sandwich, Taco Plate, or 1-Meat Plate']
    ]
    doc.add_table(headers_bundles, rows_bundles, ['2200', '3360', '1600', '2200'])

    doc.add_h1('3. Clover Menu Item Packaging Allocation')
    doc.add_p('Comparing actual packaging costs across dine-in versus takeout order channels:')

    headers_alloc = ['Menu Category', 'Dine-In Disposables Used', 'Dine-In Cost', 'To-Go Disposables Used', 'To-Go Cost', 'Variance ($)']
    rows_alloc = [
        ['Texas BBQ Sandwiches', '3 lb Paper Boat + Liner + Napkins', '$0.119', 'Foil Wrap ($0.06) + 3 lb Boat ($0.08) + Bag ($0.04) + Napkins', '$0.206', '+$0.087'],
        ['1-Meat & 2-Meat Plates', '3 lb Paper Boat + 2x 0.5 lb Boats (Sides) + Fork', '$0.167', '3-Comp Box ($0.184) + 2x 8 oz Cups/Lids ($0.232) + Bag + Silverware', '$0.545', '+$0.378'],
        ['Family Feast (Bevo Platter)', '2x 3 lb Boats + 4x 0.5 lb Boats + Butcher Paper', '$0.340', '1/2 Steam Pan + Lid ($1.253) + 4x 8 oz Cups/Lids ($0.464) + 2x Bags', '$1.797', '+$1.457'],
        ['Single Scratch Side (6 oz)', '0.5 lb Paper Boat + Spoon', '$0.055', '8 oz Deli Container + Flat Lid ($0.116) + Bag ($0.04) + Spoon', '$0.182', '+$0.127'],
        ['Pint of Side / Dessert', '16 oz Deli Cup + Lid + Spoon', '$0.143', '16 oz Deli Cup + Lid ($0.117) + Bag ($0.04) + Spoon', '$0.183', '+$0.040'],
        ['Catering Trays (Half Pan)', 'Half Pan + Foil Cover', '$0.950', 'Half Pan ($0.761) + Aluminum Lid ($0.492) + Heavy Duty Bag', '$1.353', '+$0.403']
    ]
    doc.add_table(headers_alloc, rows_alloc, ['1800', '2160', '1100', '2300', '1000', '1000'])

    target_file = DOCS_DIR / 'Yellow_Rose_BBQ_Packaging_Cost_Matrix.docx'
    doc.save(str(target_file))


# ==========================================
# 2. BUILD MOXE WORKFLOW SOP DOCX
# ==========================================
def build_moxe_sop():
    doc = ProfessionalDocx('Yellow Rose BBQ — MOXE Data Collection SOP', 'Standard Operating Procedure: Monthly Vendor Invoices & Pricing Archival')

    doc.add_callout(
        'US Foods MOXE does not offer a direct public API for automated POS syncing. To keep food costs, meat batch formulas, and packaging matrices accurate, follow this monthly 5-minute procedure at the close of every billing cycle.',
        'STANDARD OPERATING PROCEDURE'
    )

    doc.add_h1('1. Overview & Timing')
    doc.add_bullet('Primary Vendor: US Foods (Port Orange Division, Customer #91714857).')
    doc.add_bullet('Schedule: Run on the 1st of every month for the prior calendar month.')
    doc.add_bullet('Required Outputs: Two distinct CSV reports (Purchase Detail and Detail Data).')
    doc.add_bullet('Target Storage: yellow-rose-bbq/data/vendor_invoices/ (Local Repository Vault).')

    doc.add_h1('2. Step-by-Step MOXE Export Instructions')

    doc.add_h2('Step 2.1: Log in to US Foods MOXE')
    doc.add_p('1. Open your browser and navigate to https://www.usfoods.com/order.html.')
    doc.add_p('2. Log in using your primary store credentials.')
    doc.add_p('3. Verify the active account displayed is Yellow Rose BBQ (#91714857).')

    doc.add_h2('Step 2.2: Export Report #1 — "Purchase Detail" (Item Summaries)')
    doc.add_p('This report summarizes total dollars, cases, and catch weights purchased per item across the month.')
    doc.add_p('1. From the top navigation bar, click Reports -> Purchase Analysis.')
    doc.add_p('2. Set Report Type to "Purchase Detail (Summary by Item)".')
    doc.add_p('3. Under Date Range, select Custom Dates (e.g., 08-01-2026 to 08-31-2026).')
    doc.add_p('4. Ensure all Product Classes (Meat, Produce, Disposables, Grocery, Dairy) are checked.')
    doc.add_p('5. Click Export -> CSV (Do NOT choose PDF or Print view).')
    doc.add_p('6. Rename the downloaded file to: YRBBQ_Purchase_Detail_YYYY-MM-DD.csv (using the end date of the month).')

    doc.add_h2('Step 2.3: Export Report #2 — "Detail Data" (Invoice Transactions)')
    doc.add_p('This report captures individual delivery dates, invoice numbers, catch weight tags, and price changes.')
    doc.add_p('1. In the same Reports section, click Order History / Detail Data.')
    doc.add_p('2. Set Date Range to the exact same calendar window as Report #1.')
    doc.add_p('3. Select format: CSV.')
    doc.add_p('4. Export and rename to: YRBBQ_Detail_Data_YYYY-MM-DD.csv.')

    doc.add_h1('3. File Placement & Security Invariant')
    doc.add_p('Because US Foods invoices contain proprietary wholesale contract pricing, strict repository security rules apply:')
    doc.add_bullet('1. Move the downloaded CSVs to: yellow-rose-bbq/data/vendor_invoices/')
    doc.add_bullet('2. Set file permissions to 0600 (Restricted read/write for owner only):')
    doc.add_p('   chmod 0600 data/vendor_invoices/YRBBQ_*.csv', italic=True)
    doc.add_bullet('3. Run the project verification script to ensure the new files are recognized:')
    doc.add_p('   .venv/bin/python scripts/verify_cogs_with_clover.py', italic=True)
    doc.add_bullet('4. (Optional) Run the local encryption tool to create an offsite encrypted backup:')
    doc.add_p('   .venv/bin/python scripts/secure_data_vault.py encrypt', italic=True)

    doc.add_h1('4. Quality Checklist Before Handoff')
    doc.add_bullet('File is CSV format (opens in Excel/text editor, not HTML or corrupted PDF).', checked=True)
    doc.add_bullet('File size is greater than 10 KB (confirms actual transaction rows exist).', checked=True)
    doc.add_bullet('Date range covers full month without overlapping or skipping weeks.', checked=True)
    doc.add_bullet('Delivered cases match physical delivery slips received at the back door.', checked=True)

    target_file = DOCS_DIR / 'Yellow_Rose_BBQ_MOXE_Data_Collection_Workflow.docx'
    doc.save(str(target_file))


# ==========================================
# 3. BUILD OWNER HAND-OFF & RECIPE GAP-FILL DOCX
# ==========================================
def build_owner_handoff():
    doc = ProfessionalDocx('Yellow Rose BBQ — Food Cost Audit & Recipe Gap-Fill Form', 'Working Session Guide for Owner & Pitmaster Collaboration')

    doc.add_callout(
        'Our POS sales and wholesale meat models (Brisket, Ribs, Butts, Sausages) are fully built. This working document cross-references your Handwritten Recipe Collection against our live menu to capture the exact batch portion yields and missing items needed to finalize our storewide COGS.',
        'COLLABORATIVE WORKING DOCUMENT'
    )

    doc.add_h1('1. Handwritten Recipe Cross-Reference & Yield Audit')
    doc.add_p('We extracted the recipes from your handwritten spreadsheet. Below is what we found, along with the critical missing operational number needed for each:')

    headers_recipes = ['Menu Side Dish', 'Handwritten Recipe Found in Collection', 'Key Ingredients Recorded', 'CRITICAL MISSING INFO (Fill In with Owner)']
    rows_recipes = [
        ['Mac & Cheese', 'mac and cheese (Line 43) / Sammie Mac (Line 46)', '3 bags cheddar, 3 logs velveeta, 10 qts half & half, 3 cans nacho cheese, 1/2 cup seasoning', 'How many 6 oz side cups (or 1/2 steam pans) does this full batch yield? [           ] portions'],
        ['Charro Beans', 'CHARRO BEANS (Line 36) / Frijoles charros (Line 2)', '20 guajillo, 6 arbol, 2 anchos, 2 cans beans, onions, tomatoes, jalapeños, bacon/chorizo', 'What size cans of beans are used (#10 or 15 oz)? How many 6 oz portions does 1 pot yield? [           ]'],
        ['Tex-Mex Rice', 'Mexican Rice (Line 4)', '2 cups long grain rice, 3 Roma tomatoes, 1/4 onion, bouillon, spices (Household batch)', 'What is the restaurant commercial batch size (lbs of rice) and total portion yield? [           ] portions'],
        ['Smoked Corn / Elote', 'Smoked Corn (Line 7) & Elote Dressing (Line 39)', 'Drained corn, 1/2 cup honey, Cajun/fry rub, 1/2 cup margarine per pan; Mayo/crema/parm/tajin dressing', 'How many 6 oz side portions are scooped from one 1/2 steam pan? [           ] portions'],
        ['Potato Salad', 'Pot Salad (Line 42) & Unknown Recipe 3 (Line 50)', '12 big potatoes, 1 cup vinegar, 6 cups mayo, 1 cup sour cream, mustard, onions, pickles, dill', 'How many 6 oz deli cups does this 12-potato batch produce? [           ] portions'],
        ['Coleslaw', 'Slaw Dressing (Large Batch - Line 40) & Coleslaw (Line 18)', '16 cups mayo, 2 cups red vinegar, 4 cups sugar, lime juice, garlic, pepper (3:1 cabbage/carrot)', 'How many heads of cabbage per 16-cup dressing batch, and total portions? [           ] portions'],
        ['Birria Consommé', 'Birria Recipe Broth (Line 35)', 'Bouillon, garlic, onion powder, chili powder, cumin, cayenne, oregano, lime juice', 'How many 8 oz dipping consommé cups does 1 pot yield? [           ] portions'],
        ['OG BBQ Sauce', 'OG BBQ Sauce (Line 30)', '3 Gal ketchup, 1 Gal white vin, 1 Gal cider vin, 8c worcestershire, 1c soy, 16c brown sugar, honey', 'Total liquid yield in gallons: [      ] Gallons (Used for pump bar vs prep)'],
        ['Spicy BBQ Sauce', 'Spicy BBQ (Line 8)', '16 cups OG sauce, 4 cups mustard, pepper flakes, cayenne, coarse black pepper', 'Total liquid yield: [      ] Gallons']
    ]
    doc.add_table(headers_recipes, rows_recipes, ['1600', '2160', '2600', '3000'])

    doc.add_h1('2. Missing Recipes (Not in Handwritten Collection)')
    doc.add_p('The following active POS menu items were not found in the handwritten spreadsheet. Fill in standard batch ingredients and portion counts:')

    headers_missing = ['Menu Item', 'Primary Raw Ingredients Used', 'Batch Size / Measure', 'Portion Yield per Batch']
    rows_missing = [
        ['Southern Green Beans', 'Fresh green beans, bacon trimmings, diced onion, broth, black pepper', 'Example: 10 lb bag beans + 2 lb bacon trim', '[           ] 6 oz cups'],
        ['Skillet Cornbread', 'Cornbread mix, buttermilk, eggs, honey butter glaze', 'Example: 1 bag mix + 2 qts buttermilk', '[           ] squares / trays'],
        ['Banana Pudding (Indiv. & Pints)', 'Vanilla custard/pudding, whole milk, fresh bananas, \'Nilla wafers', 'Example: 2 bags pudding + 4 lbs bananas', '[     ] 6 oz cups / [     ] pints'],
        ['Scratch Churros (2-Pack)', 'Churro batter / pre-formed, frying oil, cinnamon sugar, caramel dip', 'Example: 1 case churros', '[           ] 2-pack orders'],
        ['Texas Red Bowl Chili / Frito Pie', 'Smoked brisket/beef trimmings, chili gravy, spices, cheddar, Fritos', 'Example: 1 hotel pan trimmings', '[           ] 12 oz bowls'],
        ['San Antonio Caesar Salad', 'Crisp romaine, cotija/parmesan, croutons, Caesar dressing, 5 oz meat', 'Example: 1 case romaine heads', '[           ] salad portions']
    ]
    doc.add_table(headers_missing, rows_missing, ['2100', '3260', '2200', '1800'])

    doc.add_h1('3. Non-MOXE (US Foods) Purchasing Log')
    doc.add_p('List any ingredients, packaging, or kitchen supplies purchased outside US Foods (e.g. WebstaurantStore, Restaurant Depot, local bakery, timber):')

    headers_nonmoxe = ['Supply Category', 'Current Vendor / Store Name', 'Item Description & Brand', 'Purchase Frequency', 'Typical Cost / Pack Size']
    rows_nonmoxe = [
        ['Sandwich Buns / Brioche', '_________________________', 'Brioche buns (4.5" sliced)', 'Weekly / Bi-weekly', '$_______ / pack of _____'],
        ['Tortillas (Flour & Corn)', '_________________________', '12-14" flour & street corn', 'Weekly', '$_______ / pack of _____'],
        ['Firewood (Post Oak / Hickory)', '_________________________', 'Seasoned split post oak cords', 'Monthly / As needed', '$_______ per cord / pallet'],
        ['Webstaurant Plates & Trays', 'WebstaurantStore', 'Plates, trays, special inserts', 'Monthly', '$_______ per case'],
        ['Specialty Spices / Seasonings', '_________________________', 'Fiesta brand, special peppers', 'As needed', '$_______ per container'],
        ['Local Produce / Dairy Fill-ins', '_________________________', 'Emergency cilantro, limes, milk', 'Weekly fill-in', '$_______ / trip']
    ]
    doc.add_table(headers_nonmoxe, rows_nonmoxe, ['1900', '2160', '2300', '1400', '1600'])

    doc.add_h1('4. Packaging Station Operating Rules (Line SOP Checklist)')
    doc.add_p('Establish standard operating procedures for the kitchen line to prevent over-packaging and cost creep:')

    doc.add_h2('A. Dine-In vs. To-Go Plating Rules')
    doc.add_bullet('Dine-In Meat Plates: Served on 3 lb checkered paper boat with deli liner (No foam box used).', checked=True)
    doc.add_bullet('Dine-In Sides: Served in 0.5 lb paper boats (Do NOT use 8 oz plastic deli tubs with lids for dine-in).', checked=True)
    doc.add_bullet('To-Go Meat Plates: 3-compartment black hinged foam container ($0.184).', checked=True)
    doc.add_bullet('To-Go Sides: 8 oz clear deli cup + lid ($0.116). If plate has 2 sides, place inside 3-comp box or bag separate?', bold_prefix='Decision:')
    doc.add_p('   [  ] Place sides directly in 3-comp container compartments (saves $0.23 per plate).')
    doc.add_p('   [  ] Pack sides in separate 8 oz deli tubs with lids (adds $0.23 per plate).')

    doc.add_h2('B. Condiment Bar & Extra Slices Policy')
    doc.add_bullet('BBQ Sauce Distribution: Self-serve pump station at FOH OR pre-poured 2 oz souffle cups?', bold_prefix='Policy:')
    doc.add_p('   [  ] Guest self-serve pump station (saves labor and plastic cup costs).')
    doc.add_p('   [  ] Staff pre-portions into 2 oz plastic cups ($0.035 cup+lid cost per serving).')
    doc.add_bullet('Pickles & Onions: Self-serve pickle bar OR pre-bagged behind the counter?', bold_prefix='Policy:')
    doc.add_p('   [  ] Self-serve station with 4 oz paper boats.')
    doc.add_p('   [  ] Line staff adds standard garnish (4 pickle slices + 1/4 onion slice per plate).')
    doc.add_bullet('White Bread Standard: How many free slices per 1 lb meat or plate? Standard: [      ] slices.')

    doc.add_h1('5. Sign-off & Next Steps')
    doc.add_p('Once portion yields and non-MOXE vendor costs are filled into this document, the data will be plugged into yellow_rose_bbq_cogs.xlsx to produce exact gross margins, food cost percentages, and item profitability rankings.')
    doc.add_p('Completed By: ___________________________________   Date: ________________________')
    doc.add_p('Approved By (Owner): ____________________________   Date: ________________________')

    target_file = DOCS_DIR / 'Yellow_Rose_BBQ_Owner_Handoff_and_Recipe_Gap_Fill.docx'
    doc.save(str(target_file))


if __name__ == '__main__':
    build_packaging_matrix()
    build_moxe_sop()
    build_owner_handoff()
