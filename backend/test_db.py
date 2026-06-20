import sqlite3
import traceback

try:
    conn = sqlite3.connect("ideora_new.db")
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(listings)")
    for row in cursor.fetchall():
        print(row)
    conn.close()
except Exception as e:
    traceback.print_exc()
