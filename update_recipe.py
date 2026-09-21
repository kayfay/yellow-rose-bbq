import re

with open("Yellow Rose BBQ - Custom Sausage Formulations (50 lb Batch).md", "r") as f:
    text = f.read()

# Replace the base blend description
old_desc = "The base meat and fat blend for each 50 lb batch is standardized to: **25.5 lbs Beef Trimmings** (from Brisket trim), **16 lbs Pork Base** (from Pork Spare Rib trimmings), and **8.5 lbs Pork/Beef Fat** (totaling 50 lbs of base block at ~70% lean to 30% fat ratio)."
new_desc = "The base meat and fat blend for each 50 lb batch is standardized to an all-beef sausage: **35 lbs Beef Trimmings** (from Brisket trim) and **15 lbs Beef Fat** (totaling 50 lbs of base block at a 70:30 lean to fat ratio)."
text = text.replace(old_desc, new_desc)

# Replace the ingredients in the table
old_ingredients = "25.5 lbs Beef Trimmings 16 lbs Pork Base 8.5 lbs Pork/Beef Fat"
new_ingredients = "35 lbs Beef Trimmings 15 lbs Beef Fat"
text = text.replace(old_ingredients, new_ingredients)

with open("Yellow Rose BBQ - Custom Sausage Formulations (50 lb Batch).md", "w") as f:
    f.write(text)
