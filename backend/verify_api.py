import requests
import sys
import uuid

BASE_URL = "http://127.0.0.1:8000/api/v1"

def run_tests():
    print("====================================================")
    print("            QUANTLENS AI LIVE API VERIFIER          ")
    print("====================================================")

    # 1. Register a fresh test user
    email = f"test_api_{uuid.uuid4().hex[:6]}@quantlens.ai"
    password = "TestPassword123!"
    full_name = "API Test Engineer"

    print(f"\n[1/7] Registering test user: {email}...")
    reg_response = requests.post(f"{BASE_URL}/auth/register", json={
        "email": email,
        "password": password,
        "full_name": full_name
    })

    if reg_response.status_code == 201:
        print("SUCCESS: User registration endpoint is working.")
    else:
        print(f"FAILED: User registration failed: {reg_response.text}")
        sys.exit(1)

    # 2. Authenticate and retrieve JWT
    print(f"\n[2/7] Authenticating credentials and obtaining access token...")
    auth_response = requests.post(f"{BASE_URL}/auth/token", data={
        "username": email,
        "password": password
    })

    if auth_response.status_code == 200:
        token_data = auth_response.json()
        access_token = token_data.get("access_token")
        headers = {"Authorization": f"Bearer {access_token}"}
        print("SUCCESS: JWT authentication flow verified.")
    else:
        print(f"FAILED: Auth token acquisition failed: {auth_response.text}")
        sys.exit(1)

    # 3. Test Stock Search / Autocomplete
    print("\n[3/7] Testing Autocomplete Search Endpoint ('/stocks/search?q=APP')...")
    search_response = requests.get(f"{BASE_URL}/stocks/search?q=APP", headers=headers)
    if search_response.status_code == 200:
        results = search_response.json()
        print(f"SUCCESS: Autocomplete search returned {len(results)} suggestions.")
        for res in results[:2]:
            print(f"  - {res['ticker']}: {res['name']} ({res['sector']})")
    else:
        print(f"FAILED: Search endpoint returned status {search_response.status_code}: {search_response.text}")
        sys.exit(1)

    # 4. Test Stock Company Overview
    print("\n[4/7] Testing Stock Overview Endpoint ('/stocks/AAPL/overview')...")
    overview_response = requests.get(f"{BASE_URL}/stocks/AAPL/overview", headers=headers)
    if overview_response.status_code == 200:
        overview = overview_response.json()
        print("SUCCESS: Overview stats retrieved successfully.")
        print(f"  - Ticker:       {overview['ticker']}")
        print(f"  - Company Name: {overview['name']}")
        print(f"  - Sector:       {overview['sector']}")
        print(f"  - Current Price: ${overview['current_price']:.2f}")
        print(f"  - Market Cap:    {overview['market_cap']}")
    else:
        print(f"FAILED: Overview endpoint returned status {overview_response.status_code}: {overview_response.text}")
        sys.exit(1)

    # 5. Test Stock Historical Charts
    print("\n[5/7] Testing Historical Chart History Endpoint ('/stocks/AAPL/history?period=1m')...")
    history_response = requests.get(f"{BASE_URL}/stocks/AAPL/history?period=1m", headers=headers)
    if history_response.status_code == 200:
        history = history_response.json()
        print(f"SUCCESS: Historical prices resolved with {len(history)} data points.")
        if history:
            print(f"  - Initial point: {history[0]['date']} -> Close: ${history[0]['close']:.2f}")
            print(f"  - Final point:   {history[-1]['date']} -> Close: ${history[-1]['close']:.2f}")
    else:
        print(f"FAILED: History endpoint returned status {history_response.status_code}: {history_response.text}")
        sys.exit(1)

    # 6. Test Watchlist CRUD
    print("\n[6/7] Testing Watchlist CRUD Pipeline...")
    
    # POST - Add Ticker
    print("  - POST /watchlist/ (Adding 'AAPL')...")
    add_response = requests.post(f"{BASE_URL}/watchlist/", json={"ticker": "AAPL"}, headers=headers)
    if add_response.status_code == 201:
        print("  SUCCESS: Added AAPL to watchlist.")
    else:
        print(f"  FAILED: Could not add AAPL to watchlist: {add_response.text}")
        sys.exit(1)

    # GET - Retrieve Watchlist
    print("  - GET /watchlist/ (Retrieving watchlist items)...")
    get_response = requests.get(f"{BASE_URL}/watchlist/", headers=headers)
    if get_response.status_code == 200:
        items = get_response.json()
        print(f"  SUCCESS: Found {len(items)} items in user watchlist.")
        for item in items:
            print(f"    * {item['ticker']}: {item['company_name']} - Current Price: ${item['current_price']:.2f} (Daily Change: {item['price_change_percent']:.2f}%)")
    else:
        print(f"  FAILED: Failed to fetch watchlist: {get_response.text}")
        sys.exit(1)

    # DELETE - Remove Ticker
    print("  - DELETE /watchlist/AAPL (Removing 'AAPL')...")
    del_response = requests.delete(f"{BASE_URL}/watchlist/AAPL", headers=headers)
    if del_response.status_code == 200:
        print("  SUCCESS: Removed AAPL from watchlist.")
    else:
        print(f"  FAILED: Failed to remove AAPL from watchlist: {del_response.text}")
        sys.exit(1)

    # 7. Test Sentiment & AI Insights Summary (including Fallback verification)
    print("\n[7/7] Testing Sentiment & AI Insights Summary Endpoint ('/insights/AAPL/sentiment')...")
    sentiment_response = requests.get(f"{BASE_URL}/insights/AAPL/sentiment", headers=headers)
    if sentiment_response.status_code == 200:
        sentiment = sentiment_response.json()
        print("SUCCESS: Sentiment analysis engine finished.")
        print(f"  - Aggregate Sentiment Label: {sentiment['overall_sentiment_label'].upper()}")
        print(f"  - Aggregate Score (-1.0 to +1.0): {sentiment['overall_sentiment_score']:.4f}")
        print(f"  - Tracked Articles Count:         {len(sentiment['articles'])}")
        print(f"  - AI Insights Summary:            {sentiment['summary_paragraph']}")
    else:
        print(f"FAILED: Insights endpoint returned status {sentiment_response.status_code}: {sentiment_response.text}")
        sys.exit(1)

    print("\n====================================================")
    print("       LIVE API VERIFICATION STATUS: ALL TESTS PASSED ")
    print("====================================================")

if __name__ == "__main__":
    try:
        run_tests()
    except requests.exceptions.ConnectionError:
        print("\nERROR: Cannot connect to FastAPI backend server. Ensure it is running on http://127.0.0.1:8000.")
        sys.exit(1)
