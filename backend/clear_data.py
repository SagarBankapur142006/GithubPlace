import sqlite3

conn = sqlite3.connect("ideora_new.db")
cursor = conn.cursor()

tables = ["transactions", "bounties", "listings", "users"]
for table in tables:
    cursor.execute(f"DELETE FROM {table}")
    print(f"Cleared {cursor.rowcount} rows from {table}")

conn.commit()
conn.close()
print("\nAll data cleared. Fresh start!")
