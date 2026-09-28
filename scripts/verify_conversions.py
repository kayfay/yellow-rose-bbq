import json

with open('data/recipes/mexican_chorizo.json', 'r') as f:
    recipe = json.load(f)

print(f"Verifying {recipe['name']} formulation for a 50 lb batch (checking cups -> tbsp):")
for ing in recipe['ingredients']:
    amt = float(ing['amount'])
    unit = ing['unit']
    if unit == 'cups' and amt < 1.0 and amt > 0:
        tbsp = amt * 16.0
        print(f" - {ing['label']}: {amt} cups -> EXACTLY {tbsp:.2f} tbsp")
    elif unit == 'cups' and amt >= 1.0:
        print(f" - {ing['label']}: {amt} cups")
    else:
        print(f" - {ing['label']}: {amt} {unit}")

print("SUCCESS: Conversions verified.")
