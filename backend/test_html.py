import requests, re, json

ticker = "TCS.NS"
headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

# Try direct HTML page
url = f"https://finance.yahoo.com/quote/{ticker}"
resp = requests.get(url, headers=headers, timeout=15)
print(f"HTML status: {resp.status_code}")

if resp.status_code == 200:
    # Extract root.App.main from the HTML
    match = re.search(r'root\.App\.main\s*=\s*({.*?});\s*\n', resp.text, re.DOTALL)
    if match:
        data = json.loads(match.group(1))
        context = data.get("context", {}).get("dispatcher", {}).get("stores", {})
        quote_summary = context.get("QuoteTimeSeriesStore", {})
        print("Keys in QuoteTimeSeriesStore:", list(quote_summary.keys())[:10] if isinstance(quote_summary, dict) else "N/A")
        
        # Try to find fundamental data
        for key in ["sector", "industry", "trailingPE", "epsTrailingTwelveMonths", "marketCap", "website"]:
            val = quote_summary.get(key)
            if val is not None:
                print(f"  {key}: {val}")
        
        # Also check QuoteSummaryStore
        qs_store = context.get("QuoteSummaryStore", {})
        if isinstance(qs_store, dict):
            print(f"\nQuoteSummaryStore keys: {list(qs_store.keys())[:15]}")
            ap = qs_store.get("assetProfile", {})
            if ap:
                print(f"  sector: {ap.get('sector')}")
                print(f"  industry: {ap.get('industry')}")
                print(f"  website: {ap.get('website')}")
            sd = qs_store.get("summaryDetail", {})
            if sd:
                print(f"  trailingPE: {sd.get('trailingPE')}")
                print(f"  marketCap: {sd.get('marketCap')}")
            dks = qs_store.get("defaultKeyStatistics", {})
            if dks:
                print(f"  trailingEps: {dks.get('trailingEps')}")
    
    # If JSON extraction failed, try another approach
    if not match:
        print("No root.App.main found. Page length:", len(resp.text))
        # Try the stores JSON
        match2 = re.search(r'"QuoteSummaryStore":\s*({.*?}),\s*"QuoteTimeSeriesStore"', resp.text, re.DOTALL)
        if match2:
            print(f"Found QuoteSummaryStore (first 200 chars): {match2.group(1)[:200]}")
else:
    print(f"Failed: {resp.status_code}")
