import unittest
import sys
import os

# Add parent directory to path so we can import menu_map
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from menu_map import classify_item, aggregate_by_category

class TestMenuMap(unittest.TestCase):

    def test_classify_item_tacos(self):
        self.assertEqual(classify_item("Crispy Quesa Taco Brisket"), "tacos")
        self.assertEqual(classify_item("taco combo"), "tacos")

    def test_classify_item_brisket(self):
        self.assertEqual(classify_item("1/2 lb Brisket"), "brisket_lbs")
        self.assertEqual(classify_item("Brisket Pound"), "brisket_lbs")
        
    def test_classify_item_pulled_pork(self):
        self.assertEqual(classify_item("Pulled Pork Sandwich"), "sandwiches")
        self.assertEqual(classify_item("1/2 lb Pulled Pork"), "pulled_pork_lbs")

    def test_aggregate_by_category(self):
        import polars as pl
        order_line_items = pl.DataFrame([
            # Weight-based items (quantity is in thousandths, should be divided by 1000)
            {"item_name": "1/2 lb Brisket", "quantity": 500, "price_cents": 1400, "created_time": "2024-01-01 12:00:00"},
            {"item_name": "1 lb Brisket", "quantity": 1000, "price_cents": 2800, "created_time": "2024-01-01 12:00:00"},
            {"item_name": "1/2 lb Pulled Pork", "quantity": 500, "price_cents": 900, "created_time": "2024-01-01 12:00:00"},
            {"item_name": "Turkey", "quantity": 250, "price_cents": 750, "created_time": "2024-01-01 12:00:00"},
            {"item_name": "Sausage link", "quantity": 2000, "price_cents": 600, "created_time": "2024-01-01 12:00:00"},
            
            # Non-weight based items (quantity should be summed as-is)
            {"item_name": "Crispy Quesa Taco Brisket", "quantity": 3, "price_cents": 500, "created_time": "2024-01-01 12:00:00"},
            {"item_name": "Pulled Pork Sandwich", "quantity": 2, "price_cents": 1200, "created_time": "2024-01-01 12:00:00"},
            {"item_name": "Rosebuds", "quantity": 5, "price_cents": 200, "created_time": "2024-01-01 12:00:00"},
            
            # Unknown item
            {"item_name": "Fountain Drink", "quantity": 1, "price_cents": 250, "created_time": "2024-01-01 12:00:00"}
        ])

        result_df = aggregate_by_category(order_line_items)
        
        # Result is a dataframe with columns: date, hour, category, qty_sold
        # Let's convert it back to a dict for easy assertions (summing over date/hour since they are identical in our dummy data)
        agg_result = result_df.group_by("category").agg(pl.col("qty_sold").sum())
        result = dict(zip(agg_result['category'], agg_result['qty_sold']))

        # Assert weight-based items were divided by 1000
        self.assertAlmostEqual(result.get("brisket_lbs", 0), 1.5) # (500 + 1000) / 1000
        self.assertAlmostEqual(result.get("pulled_pork_lbs", 0), 0.5) # 500 / 1000
        self.assertAlmostEqual(result.get("turkey_lbs", 0), 0.25) # 250 / 1000
        self.assertAlmostEqual(result.get("sausage_links", 0), 2.0) # 2000 / 1000

        # Assert non-weight-based items were NOT divided by 1000
        self.assertEqual(result.get("tacos", 0), 3)
        self.assertEqual(result.get("sandwiches", 0), 2)
        self.assertEqual(result.get("rosebuds", 0), 5)
        
        # Unknown should be filtered out (category="other")
        self.assertEqual(result.get("other", 0), 0)

if __name__ == '__main__':
    unittest.main()
