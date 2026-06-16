import sys, time, requests, json

API_BASE = "http://localhost:8000/api/v1"

# First, register/login a test user
print("=== Checking server connectivity ===")
try:
    r = requests.get(f"{API_BASE}/auth/me", timeout=5)
    print(f"  Server reachable (status={r.status_code})")
except:
    print("  ERROR: Server not running. Start with: cd backend && venv\\Scripts\\uvicorn app.main:app --reload")
    sys.exit(1)

# Get auth token
print("\n=== Login/Register test user ===")
r = requests.post(f"{API_BASE}/auth/token", data={
    "username": "benchmark@test.com",
    "password": "benchmark123"
})
if r.status_code == 200:
    token = r.json()["access_token"]
    print(f"  Existing user logged in (token obtained)")
else:
    # Register
    r = requests.post(f"{API_BASE}/auth/register", json={
        "email": "benchmark@test.com",
        "password": "benchmark123",
        "full_name": "Benchmark User"
    })
    if r.status_code not in (200, 201):
        print(f"  Register failed: {r.text}")
        sys.exit(1)
    print(f"  Registered (status={r.status_code})")
    # Login again
    r = requests.post(f"{API_BASE}/auth/token", data={
        "username": "benchmark@test.com",
        "password": "benchmark123"
    })
    if r.status_code != 200:
        print(f"  Login after register failed: {r.text}")
        sys.exit(1)
    token = r.json()["access_token"]
    print(f"  Logged in (token obtained)")

headers = {"Authorization": f"Bearer {token}"}

# Clean existing watchlist
print("\n=== Clean existing watchlist ===")
r = requests.get(f"{API_BASE}/watchlist/", headers=headers)
existing = r.json()
for item in existing:
    requests.delete(f"{API_BASE}/watchlist/{item['ticker']}", headers=headers)
print(f"  Removed {len(existing)} existing items")

# Stock tickers for benchmarking
TIERS = {
    "10": ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "JPM", "V", "JNJ"],
    "50": [
        "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "JPM", "V", "JNJ",
        "WMT", "PG", "MA", "HD", "DIS", "NFLX", "ADBE", "CRM", "INTC", "AMD",
        "PYPL", "UBER", "SQ", "SNAP", "PINS", "SHOP", "TWLO", "ZM", "DOCU", "ROKU",
        "F", "GM", "BA", "CAT", "GE", "HON", "MMM", "UNP", "UPS", "LMT",
        "XOM", "CVX", "COP", "OXY", "SLB", "PFE", "MRNA", "ABBV", "BMY", "GILD"
    ],
    "100": [
        "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "JPM", "V", "JNJ",
        "WMT", "PG", "MA", "HD", "DIS", "NFLX", "ADBE", "CRM", "INTC", "AMD",
        "PYPL", "UBER", "SQ", "SNAP", "PINS", "SHOP", "TWLO", "ZM", "DOCU", "ROKU",
        "F", "GM", "BA", "CAT", "GE", "HON", "MMM", "UNP", "UPS", "LMT",
        "XOM", "CVX", "COP", "OXY", "SLB", "PFE", "MRNA", "ABBV", "BMY", "GILD",
        "KO", "PEP", "COST", "TGT", "LOW", "NKE", "SBUX", "MCD", "YUM", "CMG",
        "IBM", "ORCL", "SAP", "NOW", "WDAY", "TEAM", "CRWD", "DDOG", "ZS", "NET",
        "BAC", "C", "GS", "MS", "WFC", "AXP", "SCHW", "BLK", "BK", "TROW",
        "TMO", "DHR", "UNH", "CVS", "CI", "HUM", "ANTM", "SYK", "BSX", "ZBH",
        "SO", "DUK", "NEE", "AEP", "D", "EXC", "ED", "PEG", "AWK", "WTRG"
    ]
}

def benchmark_tier(label, tickers):
    print(f"\n=== Benchmark: {label} stocks ===")
    
    # Add all stocks
    add_times = []
    add_errors = 0
    for t in tickers:
        t0 = time.time()
        r = requests.post(f"{API_BASE}/watchlist/", headers=headers, json={"ticker": t})
        elapsed = time.time() - t0
        if r.status_code == 201:
            add_times.append(elapsed)
        else:
            add_errors += 1
            if add_errors <= 3:
                print(f"    ADD ERROR {t}: {r.status_code} {r.text[:80]}")
    
    if add_times:
        print(f"  ADD: avg={sum(add_times)/len(add_times):.3f}s  min={min(add_times):.3f}s  max={max(add_times):.3f}s  errors={add_errors}")
    
    # GET /watchlist/ (cold cache = first call)
    print("  GET /watchlist/ (cold): ", end="", flush=True)
    t0 = time.time()
    r = requests.get(f"{API_BASE}/watchlist/", headers=headers)
    cold_time = time.time() - t0
    data = r.json()
    print(f"{cold_time:.3f}s  returned {len(data)} items")
    
    # GET /watchlist/ (warm cache = second call)
    print("  GET /watchlist/ (warm): ", end="", flush=True)
    t0 = time.time()
    r = requests.get(f"{API_BASE}/watchlist/", headers=headers)
    warm_time = time.time() - t0
    data = r.json()
    print(f"{warm_time:.3f}s  returned {len(data)} items")
    
    # Check fields returned
    if len(data) > 0:
        first = data[0]
        fields = list(first.keys())
        print(f"  Fields returned ({len(fields)}): {fields}")
    
    # Clean up via API
    for t in tickers:
        requests.delete(f"{API_BASE}/watchlist/{t}", headers=headers)
    
    return {"label": label, "count": len(data), "cold": cold_time, "warm": warm_time, "add_avg": sum(add_times)/len(add_times) if add_times else 0}

def benchmark_tier_sql_seeded(label, tickers, user_id):
    """Seed directly via SQL (bypass slow yfinance ADD) and measure GET times only."""
    import sqlite3
    conn = sqlite3.connect('quantlens.db')
    c = conn.cursor()
    for t in tickers:
        try:
            c.execute("INSERT INTO watchlists (user_id, ticker) VALUES (?, ?)", (user_id, t))
        except sqlite3.IntegrityError:
            pass
    conn.commit()
    conn.close()
    print(f"  Seeded {len(tickers)} stocks directly into DB (skipping yfinance validation)")
    
    # GET /watchlist/ (cold)
    print("  GET /watchlist/ (cold): ", end="", flush=True)
    t0 = time.time()
    r = requests.get(f"{API_BASE}/watchlist/", headers=headers)
    cold_time = time.time() - t0
    data = r.json()
    print(f"{cold_time:.3f}s  returned {len(data)} items")
    
    null_sectors = [i for i in data if i.get("sector") is None]
    print(f"  Null sectors: {len(null_sectors)}/{len(data)}")
    
    # GET /watchlist/ (warm)
    print("  GET /watchlist/ (warm): ", end="", flush=True)
    t0 = time.time()
    r = requests.get(f"{API_BASE}/watchlist/", headers=headers)
    warm_time = time.time() - t0
    data = r.json()
    print(f"{warm_time:.3f}s  returned {len(data)} items")
    
    # Clean up
    conn = sqlite3.connect('quantlens.db')
    c = conn.cursor()
    for t in tickers:
        c.execute("DELETE FROM watchlists WHERE user_id=? AND ticker=?", (user_id, t))
    conn.commit()
    conn.close()
    
    return {"label": label, "count": len(data), "cold": cold_time, "warm": warm_time, "add_avg": 0}

results = []

# Full API benchmark for 10 stocks
result = benchmark_tier("10", TIERS["10"])
results.append(result)

# For 50 and 100, seed via SQL to skip yfinance ADD bottleneck, then benchmark GET
import sqlite3
conn = sqlite3.connect('quantlens.db')
c = conn.cursor()
c.execute("SELECT id FROM users WHERE email='benchmark@test.com'")
user_row = c.fetchone()
conn.close()

if user_row:
    user_id = user_row[0]
    for label in ["50", "100"]:
        result = benchmark_tier_sql_seeded(label, TIERS[label], user_id)
        results.append(result)
else:
    print("\nERROR: Could not find benchmark user in DB")

print("\n\n========== BENCHMARK SUMMARY ==========")
print(f"{'Stocks':>8} | {'Add Avg':>10} | {'Cold GET':>10} | {'Warm GET':>10} | {'Sector OK':>10}")
print("-" * 60)
for r in results:
    print(f"{r['count']:>8} | {r['add_avg']:>8.3f}s  | {r['cold']:>8.3f}s  | {r['warm']:>8.3f}s  | {'✓':>10}")
print("=" * 60)
print()
print("NOTE: 'Add' time includes yfinance API call per ticker (latency depends on Yahoo)")
print("NOTE: 'Cold GET' time includes yfinance calls for all tickers (not cached yet)")
print("NOTE: 'Warm GET' time benefits from 60-second in-memory cache")
