import sqlite3

conn = sqlite3.connect("ideora_new.db")
cursor = conn.cursor()
cursor.execute("DELETE FROM listings WHERE title = 'Generated Pitch (Fallback)'")
print(f"Deleted {cursor.rowcount} fallback listings.")
conn.commit()
conn.close()
