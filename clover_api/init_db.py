import sqlite3
from secure_config import DB_PATH

def init_schema():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute('''
    CREATE TABLE IF NOT EXISTS orders (
        order_id TEXT PRIMARY KEY,
        created_time TIMESTAMP,
        total_cents INTEGER,
        total_usd REAL,
        currency TEXT,
        state TEXT,
        title TEXT,
        note TEXT,
        client_created_time TIMESTAMP
    )''')

    cur.execute('''
    CREATE TABLE IF NOT EXISTS order_line_items (
        order_id TEXT,
        line_item_id TEXT,
        item_name TEXT,
        item_id TEXT,
        quantity INTEGER,
        price_cents INTEGER,
        price_usd REAL,
        created_time TIMESTAMP,
        hour TEXT,
        order_type TEXT,
        discount_name TEXT,
        modifications TEXT,
        PRIMARY KEY (order_id, line_item_id)
    )''')

    cur.execute('''
    CREATE TABLE IF NOT EXISTS payments (
        payment_id TEXT PRIMARY KEY,
        order_id TEXT,
        created_time TIMESTAMP,
        amount_cents INTEGER,
        amount_usd REAL,
        tender_type TEXT,
        result TEXT
    )''')

    # Also pos_items, etc., but they don't grow infinitely like orders. We can just replace those or add simple PKs.

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_schema()
