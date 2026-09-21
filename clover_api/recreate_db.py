import sqlite3
from secure_config import DB_PATH
import os

if os.path.exists(DB_PATH):
    os.remove(DB_PATH)

from init_db import init_schema
init_schema()

print("Database recreated with strict schema.")
