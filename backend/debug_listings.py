import sqlite3

conn = sqlite3.connect("ideora_new.db")
cursor = conn.cursor()
cursor.execute("SELECT title, status, visibility, growth_potential_score, price_cents FROM listings")
rows = cursor.fetchall()
print(f"Total listings: {len(rows)}")
for row in rows:
    print(row)
conn.close()
