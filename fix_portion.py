with open('clover_api/analytics/portion_transformer.py', 'r') as f:
    content = f.read()

target = """    "sausage (mild)": {
        "sausage_links": 1.0
    },
    # Add explicit fallbacks or generic plates here
}"""

replacement = """    "sausage (mild)": {
        "sausage_links": 1.0
    },
    "1/2 rack pork spare ribs": {
        "pork_ribs_racks": 0.5
    },
    "full rack pork spare ribs": {
        "pork_ribs_racks": 1.0
    },
    "single bone pork rib": {
        "pork_ribs_racks": 0.08  # approx 1/12 of a rack
    },
    "turkey sandwich": {
        "turkey_lbs": 0.3
    },
    "bbq sandwich (brisket)": {
        "brisket_lbs": 0.3
    },
    "pork sandwich": {
        "pulled_pork_lbs": 0.3
    },
    "pulled pork sandwich": {
        "pulled_pork_lbs": 0.3
    }
}"""

content = content.replace(target, replacement)

with open('clover_api/analytics/portion_transformer.py', 'w') as f:
    f.write(content)
print("portion_transformer.py patched for missing items.")
