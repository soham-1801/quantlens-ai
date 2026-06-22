import requests, re, json

ticker = "TCS.NS"
headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

url = f"https://finance.yahoo.com/quote/{ticker}"
resp = requests.get(url, headers=headers, timeout=15)
print(f"HTML status: {resp.status_code}")

if resp.status_code == 200:
    # Try multiple patterns
    patterns = [
        r'root\.App\.main\s*=\s*({.*?});',
        r'"QuoteSummaryStore"\s*:\s*(\{.*?\}),\s*"QuoteTimeSeriesStore"',
        r'"QuoteSummaryStore":\s*({.*?}),\s*"QuoteTimeSeriesStore"',
        r'window\.__PRELOADED_STATE__\s*=\s*({.*?});',
    ]
    for i, pat in enumerate(patterns):
        match = re.search(pat, resp.text, re.DOTALL)
        if match:
            print(f"\nPattern {i} matched! Length: {len(match.group(1))}")
            try:
                data = json.loads(match.group(1))
                print(f"Type: {type(data).__name__}")
                if isinstance(data, dict):
                    print(f"Top keys: {list(data.keys())[:10]}")
                    # Try to find QuoteSummaryStore
                    qs = data
                    for key_path in [
                        ["QuoteSummaryStore"],
                        ["context", "dispatcher", "stores", "QuoteSummaryStore"],
                    ]:
                        cursor = data
                        for k in key_path:
                            if isinstance(cursor, dict) and k in cursor:
                                cursor = cursor[k]
                            else:
                                cursor = None
                                break
                        if cursor and isinstance(cursor, dict):
                            print(f"\nFound at {key_path}:")
                            ap = cursor.get("assetProfile", {})
                            if isinstance(ap, dict):
                                print(f"  sector: {ap.get('sector')}")
                                print(f"  industry: {ap.get('industry')}")
                                print(f"  website: {ap.get('website')}")
                            sd = cursor.get("summaryDetail", {})
                            if isinstance(sd, dict):
                                print(f"  trailingPE: {sd.get('trailingPE', {}).get('raw')}")
                                print(f"  marketCap: {sd.get('marketCap', {}).get('raw')}")
                            dks = cursor.get("defaultKeyStatistics", {})
                            if isinstance(dks, dict):
                                print(f"  trailingEps: {dks.get('trailingEps', {}).get('raw')}")
            except json.JSONDecodeError as e:
                print(f"  JSON error: {e}")
            break
    else:
        print("No pattern matched")
        # Print first 50000 chars for inspection
        print(resp.text[:50000])
