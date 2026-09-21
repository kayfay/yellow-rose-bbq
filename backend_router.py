import sqlite3
import json
from datetime import datetime
from clover_api.secure_config import DB_PATH, ANALYTICS_DIR

class DatabaseRouter:
    def __init__(self, db_path=DB_PATH):
        self.db_path = db_path
        self.dash_payload_path = ANALYTICS_DIR / "dashboard_payload.json"

    def get_actual_sales(self, date: str, item: str):
        conn = sqlite3.connect(self.db_path)
        cur = conn.cursor()
        # Ensure date format is YYYY-MM-DD
        try:
            parsed_date = datetime.strptime(date, "%m/%d/%Y").strftime("%Y-%m-%d")
        except:
            parsed_date = date
            
        cur.execute("""
            SELECT SUM(quantity) 
            FROM order_line_items 
            WHERE date(created_time) = ? AND lower(item_name) LIKE ?
        """, (parsed_date, f"%{item}%"))
        res = cur.fetchone()[0]
        conn.close()
        return {
            "date": parsed_date,
            "item": item,
            "quantity": int(res) if res else 0,
            "data_type": "ACTUAL"
        }

    def get_predicted_targets(self, date: str, item: str):
        try:
            parsed_date = datetime.strptime(date, "%m/%d/%Y").strftime("%Y-%m-%d")
        except:
            parsed_date = date
            
        with open(self.dash_payload_path, 'r') as f:
            dash = json.load(f)
            
        records = dash.get("forecast", {}).get("forecast_records", [])
        matched = next((r for r in records if r["date"] == parsed_date), None)
        
        qty = 0
        if matched:
            if item == "rosebuds":
                qty = matched.get("rosebuds_sold", 0)
                
        return {
            "date": parsed_date,
            "item": item,
            "quantity": qty,
            "data_type": "PREDICTED"
        }

    def get_intraday_summary(self, date: str, item: str):
        actuals = self.get_actual_sales(date, item)
        predicted = self.get_predicted_targets(date, item)
        
        return {
            "date": date,
            "item": item,
            "quantity": max(actuals["quantity"], predicted["quantity"]), # simple blend
            "data_type": "INTRADAY"
        }

def route_sales_query(selected_date: str, item: str):
    db = DatabaseRouter()
    
    try:
        parsed_selected = datetime.strptime(selected_date, "%m/%d/%Y")
    except:
        parsed_selected = datetime.strptime(selected_date, "%Y-%m-%d")
        
    current_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    if parsed_selected < current_date:
        data = db.get_actual_sales(date=selected_date, item=item)
    elif parsed_selected > current_date:
        data = db.get_predicted_targets(date=selected_date, item=item)
    else:
        data = db.get_intraday_summary(date=selected_date, item=item)
        
    return data

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 2:
        print(json.dumps(route_sales_query(sys.argv[1], sys.argv[2])))
