import sqlite3
conn = sqlite3.connect('quantlens.db')
c = conn.cursor()

# Check schema
c.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='watchlists'")
print('=== Table Schema ===')
print(c.fetchone()[0])

# Check duplicates
print()
print('=== Duplicate Check ===')
c.execute("""
  SELECT user_id, ticker, COUNT(*) as cnt
  FROM watchlists
  GROUP BY user_id, ticker
  HAVING cnt > 1
""")
dupes = c.fetchall()
if dupes:
    for d in dupes:
        print(f'  DUPLICATE: user_id={d[0]}, ticker={d[1]}, count={d[2]}')
else:
    print('  No duplicates found (unique_user_ticker constraint is working)')

# Row count
c.execute('SELECT COUNT(*) FROM watchlists')
total = c.fetchone()[0]
print(f'\n=== Row Count: {total} ===')

# Show all rows with user info
if total > 0:
    print()
    c.execute("""
      SELECT w.id, w.user_id, u.email, w.ticker, w.added_at
      FROM watchlists w
      LEFT JOIN users u ON w.user_id = u.id
      ORDER BY w.user_id, w.ticker
    """)
    for row in c.fetchall():
        print(f'  id={row[0]} user_id={row[1]} email={row[2]} ticker={row[3]} added={row[4]}')

conn.close()
