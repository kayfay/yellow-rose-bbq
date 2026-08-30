with open('clover_api/analytics/portion_transformer.py', 'r') as f:
    content = f.read()

target = '((pl.col("brisket_lbs") / 0.4) / 12.0).ceil().cast(pl.Int32).alias("Total Whole Briskets Needed")'
replacement = '''((pl.col("brisket_lbs") / 0.4) / 12.0).ceil().cast(pl.Int32).alias("Total Whole Briskets Needed"),
            (((pl.col("brisket_lbs") / 0.4) / 12.0) / 5.0).ceil().cast(pl.Int32).alias("Total Cases of Brisket Needed")'''

if "Total Cases of Brisket Needed" not in content:
    content = content.replace(target, replacement)
    with open('clover_api/analytics/portion_transformer.py', 'w') as f:
        f.write(content)
    print("portion_transformer.py patched to add Total Cases of Brisket Needed")
else:
    print("Already added")
