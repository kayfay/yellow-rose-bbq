with open('clover_api/analytics/portion_transformer.py', 'r') as f:
    content = f.read()

target = '((pl.col("brisket_lbs") / 0.4) / 12.0).ceil().cast(pl.Int32).alias("Total Whole Briskets Needed"),'
replacement = '((pl.col("brisket_lbs") / 0.4) / 14.0).ceil().cast(pl.Int32).alias("Total Whole Briskets Needed"),'
content = content.replace(target, replacement)

target2 = '(((pl.col("brisket_lbs") / 0.4) / 12.0) / 5.0).ceil().cast(pl.Int32).alias("Total Cases of Brisket Needed")'
replacement2 = '(((pl.col("brisket_lbs") / 0.4) / 14.0) / 5.0).ceil().cast(pl.Int32).alias("Total Cases of Brisket Needed")'
content = content.replace(target2, replacement2)

with open('clover_api/analytics/portion_transformer.py', 'w') as f:
    f.write(content)
print("portion_transformer.py updated to 14 lbs per brisket.")
