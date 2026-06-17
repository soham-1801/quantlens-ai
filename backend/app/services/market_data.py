import yfinance as yf
import requests
import re
import traceback
from typing import List, Optional, Dict, Any
from datetime import datetime
from app.schemas.stock import StockSearchResult, StockOverview, StockHistoryPoint, StockNewsArticle
from app.core.config import settings

YAHOO_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
}

def safe_float(val) -> Optional[float]:
    if val is None:
        return None
    try:
        f_val = float(val)
        import math
        if math.isnan(f_val) or math.isinf(f_val):
            return None
        return f_val
    except (ValueError, TypeError):
        return None

def safe_int(val) -> Optional[int]:
    if val is None:
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None

def coalesce(*values):
    for v in values:
        if v is not None:
            return v
    return None

class MarketDataService:
    _overview_cache = {}  # ticker_upper: (timestamp, StockOverview)
    _history_cache = {}   # (ticker_upper, period): (timestamp, List[StockHistoryPoint])
    _news_cache = {}      # ticker_upper: (timestamp, List[StockNewsArticle])
    _last_debug = {}      # ticker_upper: dict of debug info from last call

    @staticmethod
    def search_stocks(query: str) -> List[StockSearchResult]:
        if not query or len(query.strip()) == 0:
            return []
        
        query = query.strip()
        query_upper = query.upper()
        results = []
        
        # 1. Try querying Yahoo Finance autocomplete API
        try:
            url = f"https://query2.finance.yahoo.com/v1/finance/search?q={query}&newsCount=0"
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
            response = requests.get(url, headers=headers, timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                quotes = data.get("quotes", [])
                
                for quote in quotes:
                    symbol = quote.get("symbol")
                    if not symbol:
                        continue
                    
                    # Filter out options, warrants, futures, structured products, and other derivatives
                    quote_type = quote.get("quoteType", "").upper()
                    type_disp = quote.get("typeDisp", "").upper()
                    symbol_upper = symbol.upper()
                    name_upper = (quote.get("longname") or quote.get("shortname") or "").upper()
                    
                    if quote_type not in ("EQUITY", "ETF", "INDEX"):
                        continue
                    if any(t in type_disp for t in ("OPTION", "FUTURE", "WARRANT", "STRUCTURED", "DERIVATIVE")):
                        continue
                    # Check for option contract ticker pattern (e.g. AAPL260618C00175000)
                    if len(symbol_upper) > 10 and any(char.isdigit() for char in symbol_upper):
                        continue
                    if re.search(r'[A-Z]{1,6}\d{6}[CP]\d{8}', symbol_upper):
                        continue
                    # Check for derivative keywords in the name
                    if any(word in name_upper for word in (" PUT", " CALL", " OPTION", " WARRANT", " FUTURE", "STRUCTURED PRODUCT")):
                        continue
                    
                    name = quote.get("longname") or quote.get("shortname") or symbol
                    sector = quote.get("sector")
                    industry = quote.get("industry")
                    country = quote.get("country")
                    
                    results.append(StockSearchResult(
                        ticker=symbol,
                        name=name,
                        sector=sector,
                        industry=industry,
                        country=country,
                        quote_type=quote_type
                    ))
        except Exception as e:
            print(f"Error querying Yahoo autocomplete: {e}")
            
        # 2. Fallback to major equities prefix match if API fails or returns nothing
        if not results:
            fallback_tickers = {
                "AAPL": ("Apple Inc.", "Technology", "Consumer Electronics", "United States", "EQUITY"),
                "MSFT": ("Microsoft Corporation", "Technology", "Software—Infrastructure", "United States", "EQUITY"),
                "GOOGL": ("Alphabet Inc.", "Technology", "Internet Content & Information", "United States", "EQUITY"),
                "AMZN": ("Amazon.com, Inc.", "Consumer Cyclical", "Internet Retail", "United States", "EQUITY"),
                "TSLA": ("Tesla, Inc.", "Consumer Cyclical", "Auto Manufacturers", "United States", "EQUITY"),
                "NVDA": ("NVIDIA Corporation", "Technology", "Semiconductors", "United States", "EQUITY"),
                "META": ("Meta Platforms, Inc.", "Technology", "Internet Content & Information", "United States", "EQUITY"),
                "NFLX": ("Netflix, Inc.", "Communication Services", "Entertainment", "United States", "EQUITY"),
                "JPM": ("JPMorgan Chase & Co.", "Financial Services", "Banks—Diversified", "United States", "EQUITY"),
                "V": ("Visa Inc.", "Financial Services", "Credit Services", "United States", "EQUITY"),
                "DIS": ("The Walt Disney Company", "Communication Services", "Entertainment", "United States", "EQUITY"),
                "WMT": ("Walmart Inc.", "Consumer Defensive", "Discount Stores", "United States", "EQUITY"),
                "SPY": ("SPDR S&P 500 ETF Trust", "Financial Services", "ETF", "United States", "ETF"),
                "QQQ": ("Invesco QQQ Trust", "Financial Services", "ETF", "United States", "ETF"),
            }
            
            for ticker, info in fallback_tickers.items():
                if ticker.startswith(query_upper) or query_upper in info[0].upper():
                    results.append(StockSearchResult(
                        ticker=ticker,
                        name=info[0],
                        sector=info[1],
                        industry=info[2],
                        country=info[3],
                        quote_type=info[4]
                    ))
                    
        # Sort results:
        # 1. Exact ticker match (case-insensitive) comes first.
        # 2. US listed stocks (typically no dot suffix like .TO or .MX) take priority.
        # 3. Asset type priority: EQUITY (0) -> ETF (1) -> INDEX (2) -> others (3).
        # 4. Shorter tickers (primary listings) sorted before longer ones.
        def get_sort_key(item):
            is_exact = 0 if item.ticker.upper() == query_upper else 1
            is_us = 0 if "." not in item.ticker else 1
            
            type_priority = 3
            if item.quote_type:
                qtype = item.quote_type.upper()
                if qtype == "EQUITY":
                    type_priority = 0
                elif qtype == "ETF":
                    type_priority = 1
                elif qtype == "INDEX":
                    type_priority = 2
                    
            return (is_exact, is_us, type_priority, len(item.ticker))

        results.sort(key=get_sort_key)
        return results[:8]

    @staticmethod
    def _raw(obj: Any, *keys: str) -> Any:
        """Extract the 'raw' numeric value from a Yahoo API nested dict."""
        current = obj
        for k in keys:
            if isinstance(current, dict):
                current = current.get(k)
            else:
                return None
        if isinstance(current, dict):
            return current.get("raw", current)
        return current

    @staticmethod
    def _build_from_yahoo_direct(ticker: str) -> Optional[StockOverview]:
        """Fetch overview via direct HTTP to Yahoo Finance v10 API (bypasses yfinance library)."""
        url = (
            f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/{ticker}"
            f"?modules=assetProfile,summaryDetail,price,financialData"
        )
        resp = requests.get(url, headers=YAHOO_HEADERS, timeout=10)
        if resp.status_code != 200:
            MarketDataService._last_debug[ticker] = {"source": "direct_yahoo", "status": resp.status_code}
            return None

        data = resp.json()
        results = data.get("quoteSummary", {}).get("result", [])
        if not results:
            MarketDataService._last_debug[ticker] = {"source": "direct_yahoo", "status": 200, "result_count": 0}
            return None

        quote = results[0]
        ap = quote.get("assetProfile") or {}
        sd = quote.get("summaryDetail") or {}
        pr = quote.get("price") or {}
        fd = quote.get("financialData") or {}
        ext = MarketDataService._raw

        symbol = pr.get("symbol") or ticker
        name = pr.get("longName") or pr.get("shortName") or ticker
        current_price = ext(fd, "currentPrice") or ext(pr, "regularMarketPrice") or ext(sd, "regularMarketPrice")

        raw_dy = ext(sd, "dividendYield")
        dividend_yield = None
        if raw_dy is not None:
            val = safe_float(raw_dy)
            if val is not None:
                dividend_yield = val / 100.0

        overview = StockOverview(
            ticker=symbol.upper(),
            name=name or ticker,
            description=ap.get("longBusinessSummary"),
            sector=ap.get("sector"),
            industry=ap.get("industry"),
            exchange=pr.get("exchange"),
            website=ap.get("website"),
            market_cap=safe_int(ext(pr, "marketCap") or ext(sd, "marketCap")),
            pe_ratio=safe_float(ext(sd, "trailingPE") or ext(sd, "forwardPE")),
            dividend_yield=dividend_yield,
            current_price=safe_float(current_price),
            day_high=safe_float(ext(sd, "dayHigh") or ext(pr, "regularMarketDayHigh")),
            day_low=safe_float(ext(sd, "dayLow") or ext(pr, "regularMarketDayLow")),
            fifty_two_week_high=safe_float(ext(sd, "fiftyTwoWeekHigh")),
            fifty_two_week_low=safe_float(ext(sd, "fiftyTwoWeekLow")),
            volume=safe_int(ext(sd, "volume") or ext(pr, "regularMarketVolume")),
            previous_close=safe_float(ext(sd, "previousClose") or ext(pr, "previousClose")),
            open_price=safe_float(ext(sd, "open") or ext(pr, "regularMarketOpen")),
            eps=safe_float(ext(fd, "epsTrailingTwelveMonths") or ext(fd, "epsForward")),
            beta=safe_float(ext(sd, "beta")),
            avg_volume=safe_int(ext(sd, "averageVolume") or ext(sd, "averageDailyVolume10Day")),
        )

        MarketDataService._last_debug[ticker] = {
            "source": "direct_yahoo",
            "current_price_before": current_price,
            "market_cap_before": safe_int(ext(pr, "marketCap") or ext(sd, "marketCap")),
            "name_before": name,
            "symbol_before": symbol,
        }
        return overview

    @staticmethod
    def _build_from_finnhub(ticker: str) -> Optional[StockOverview]:
        """Fetch overview from Finnhub API (requires FINNHUB_API_KEY in settings)."""
        api_key = settings.FINNHUB_API_KEY
        if not api_key:
            return None

        try:
            quote_resp = requests.get(
                f"https://finnhub.io/api/v1/quote?symbol={ticker}&token={api_key}",
                timeout=10,
            )
            profile_resp = requests.get(
                f"https://finnhub.io/api/v1/stock/profile2?symbol={ticker}&token={api_key}",
                timeout=10,
            )
            metric_resp = requests.get(
                f"https://finnhub.io/api/v1/stock/metric?symbol={ticker}&metric=all&token={api_key}",
                timeout=10,
            )

            if quote_resp.status_code != 200 or profile_resp.status_code != 200:
                MarketDataService._last_debug[ticker] = {"source": "finnhub", "status": quote_resp.status_code}
                return None

            quote = quote_resp.json()
            profile = profile_resp.json()
            metric = metric_resp.json().get("metric", {}) if metric_resp.status_code == 200 else {}

            name = profile.get("name") or ticker
            current_price = safe_float(quote.get("c"))

            raw_dy = safe_float(metric.get("dividendYield"))
            dividend_yield = raw_dy / 100.0 if raw_dy is not None and abs(raw_dy) > 1 else raw_dy

            overview = StockOverview(
                ticker=ticker.upper(),
                name=name,
                description=None,
                sector=None,
                industry=profile.get("finnhubIndustry"),
                exchange=profile.get("exchange"),
                website=profile.get("weburl"),
                market_cap=safe_int(profile.get("marketCapitalization")),
                pe_ratio=safe_float(metric.get("peTTM") or metric.get("peNormalizedAnnual")),
                dividend_yield=dividend_yield,
                current_price=current_price,
                day_high=safe_float(quote.get("h")),
                day_low=safe_float(quote.get("l")),
                fifty_two_week_high=safe_float(metric.get("52WeekHigh")),
                fifty_two_week_low=safe_float(metric.get("52WeekLow")),
                volume=None,
                previous_close=safe_float(quote.get("pc")),
                open_price=safe_float(quote.get("o")),
                eps=safe_float(metric.get("epsTTM") or metric.get("epsBasicExclExtraTTM")),
                beta=safe_float(metric.get("beta")),
                avg_volume=safe_int(metric.get("volumeAvg10Days") or metric.get("volumeAvg3months")),
            )

            MarketDataService._last_debug[ticker] = {
                "source": "finnhub",
                "current_price_before": current_price,
                "market_cap_before": profile.get("marketCapitalization"),
                "name_before": name,
                "symbol_before": ticker,
            }
            return overview
        except Exception as e:
            MarketDataService._last_debug[ticker] = {"source": "finnhub", "error": str(e)}
            return None

    @staticmethod
    def _build_from_yfinance(ticker: str) -> Optional[StockOverview]:
        """Fallback: use yfinance library (may be rate-limited on cloud IPs)."""
        try:
            ticker_obj = yf.Ticker(ticker)
            fi = {}
            try:
                raw = ticker_obj.fast_info
                fi = {
                    "currentPrice": safe_float(coalesce(getattr(raw, "currentPrice", None), getattr(raw, "regularMarketPrice", None))),
                    "previousClose": safe_float(getattr(raw, "previousClose", None)),
                    "dayHigh": safe_float(getattr(raw, "regularMarketDayHigh", None)),
                    "dayLow": safe_float(getattr(raw, "regularMarketDayLow", None)),
                    "open": safe_float(getattr(raw, "regularMarketOpen", None)),
                    "volume": safe_int(getattr(raw, "regularMarketVolume", None)),
                    "fiftyTwoWeekHigh": safe_float(getattr(raw, "fiftyTwoWeekHigh", None)),
                    "fiftyTwoWeekLow": safe_float(getattr(raw, "fiftyTwoWeekLow", None)),
                    "trailingPE": safe_float(getattr(raw, "trailingPE", None)),
                    "forwardPE": safe_float(getattr(raw, "forwardPE", None)),
                    "dividendYield": safe_float(getattr(raw, "dividendYield", None)),
                    "trailingEps": safe_float(getattr(raw, "trailingEps", None)),
                    "beta": safe_float(getattr(raw, "beta", None)),
                    "marketCap": safe_int(getattr(raw, "marketCap", None)),
                    "avgVolume": safe_int(coalesce(getattr(raw, "averageVolume", None), getattr(raw, "averageDailyVolume10Day", None))),
                }
            except Exception:
                fi = {}

            hist = {}
            try:
                df = ticker_obj.history(period="5d")
                if not df.empty:
                    last = df.iloc[-1]
                    hist = {
                        "currentPrice": safe_float(last.get("Close")),
                        "dayHigh": safe_float(last.get("High")),
                        "dayLow": safe_float(last.get("Low")),
                        "open": safe_float(last.get("Open")),
                        "volume": safe_int(last.get("Volume")),
                    }
                    if len(df) >= 2:
                        hist["previousClose"] = safe_float(df.iloc[-2].get("Close"))
            except Exception:
                hist = {}

            info = {}
            try:
                raw_info = ticker_obj.info
                if isinstance(raw_info, dict):
                    info = raw_info
            except Exception:
                info = {}

            def first(*values):
                for v in values:
                    if v is not None:
                        return v
                return None

            symbol = info.get("symbol") or ticker
            name = first(info.get("longName"), info.get("shortName"), ticker)
            if not symbol:
                return None

            current_price = first(
                fi.get("currentPrice"),
                safe_float(hist.get("currentPrice")),
                safe_float(info.get("currentPrice")),
                safe_float(info.get("regularMarketPrice")),
                safe_float(info.get("regularMarketPreviousClose")),
                safe_float(info.get("previousClose"))
            )

            raw_dy = first(fi.get("dividendYield"), info.get("dividendYield"))
            dividend_yield = None
            if raw_dy is not None:
                val = safe_float(raw_dy)
                if val is not None:
                    dividend_yield = val / 100.0

            result = StockOverview(
                ticker=symbol.upper(),
                name=name or symbol,
                description=info.get("longBusinessSummary"),
                sector=info.get("sector"),
                industry=info.get("industry"),
                exchange=first(info.get("exchange"), info.get("fullExchangeName")),
                website=info.get("website"),
                market_cap=first(fi.get("marketCap"), safe_int(info.get("marketCap"))),
                pe_ratio=first(fi.get("trailingPE"), safe_float(info.get("trailingPE")), fi.get("forwardPE"), safe_float(info.get("forwardPE"))),
                dividend_yield=dividend_yield,
                current_price=current_price,
                day_high=first(fi.get("dayHigh"), safe_float(hist.get("dayHigh")), safe_float(info.get("dayHigh")), safe_float(info.get("regularMarketDayHigh"))),
                day_low=first(fi.get("dayLow"), safe_float(hist.get("dayLow")), safe_float(info.get("dayLow")), safe_float(info.get("regularMarketDayLow"))),
                fifty_two_week_high=first(fi.get("fiftyTwoWeekHigh"), safe_float(info.get("fiftyTwoWeekHigh"))),
                fifty_two_week_low=first(fi.get("fiftyTwoWeekLow"), safe_float(info.get("fiftyTwoWeekLow"))),
                volume=first(fi.get("volume"), safe_int(hist.get("volume")), safe_int(info.get("volume")), safe_int(info.get("regularMarketVolume"))),
                previous_close=first(fi.get("previousClose"), safe_float(hist.get("previousClose")), safe_float(info.get("previousClose")), safe_float(info.get("regularMarketPreviousClose"))),
                open_price=first(fi.get("open"), safe_float(hist.get("open")), safe_float(info.get("open")), safe_float(info.get("regularMarketOpen"))),
                eps=first(fi.get("trailingEps"), safe_float(info.get("trailingEps")), safe_float(info.get("forwardEps"))),
                beta=first(fi.get("beta"), safe_float(info.get("beta"))),
                avg_volume=first(
                    fi.get("avgVolume"),
                    safe_int(info.get("averageVolume")),
                    safe_int(info.get("averageDailyVolume10Day")),
                    safe_int(info.get("averageVolume10days"))
                ),
            )

            MarketDataService._last_debug[ticker] = {
                "source": "yfinance",
                "fi_keys": [k for k, v in fi.items() if v is not None],
                "hist_keys": [k for k, v in hist.items() if v is not None],
                "info_keys": list(info.keys())[:10] if isinstance(info, dict) else [],
                "current_price_before": current_price,
                "market_cap_before": first(fi.get("marketCap"), safe_int(info.get("marketCap"))),
                "name_before": name,
                "symbol_before": symbol,
            }
            return result
        except Exception as e:
            MarketDataService._last_debug[ticker] = {"source": "yfinance", "error": str(e)}
            return None

    @staticmethod
    def get_stock_overview(ticker: str) -> Optional[StockOverview]:
        ticker_upper = ticker.upper().strip()
        now = datetime.now()

        # 5-minute cache
        if ticker_upper in MarketDataService._overview_cache:
            cache_time, cached_data = MarketDataService._overview_cache[ticker_upper]
            if (now - cache_time).total_seconds() < 300:
                return cached_data

        # Tier 1: Finnhub (requires FINNHUB_API_KEY env var, works from any cloud IP)
        overview = MarketDataService._build_from_finnhub(ticker_upper)
        if overview and overview.current_price is not None:
            MarketDataService._overview_cache[ticker_upper] = (now, overview)
            return overview

        # Tier 2: Direct Yahoo HTTP call (bypasses yfinance library, uses Chrome UA)
        overview = MarketDataService._build_from_yahoo_direct(ticker_upper)
        if overview and overview.current_price is not None:
            MarketDataService._overview_cache[ticker_upper] = (now, overview)
            return overview

        # Tier 3: yfinance fallback (may be rate-limited on cloud IPs)
        overview = MarketDataService._build_from_yfinance(ticker_upper)
        if overview and overview.current_price is not None:
            MarketDataService._overview_cache[ticker_upper] = (now, overview)
            return overview

        return None

    @staticmethod
    def _build_history_from_finnhub(ticker: str, period: str) -> Optional[List[StockHistoryPoint]]:
        api_key = settings.FINNHUB_API_KEY
        if not api_key:
            return None

        now_ts = int(datetime.now().timestamp())
        period_days = {"1m": 31, "6m": 183, "1y": 365, "5y": 1825}
        resolution = "D" if period != "5y" else "W"
        from_ts = now_ts - period_days.get(period, 31) * 86400

        try:
            resp = requests.get(
                f"https://finnhub.io/api/v1/stock/candle"
                f"?symbol={ticker}&resolution={resolution}"
                f"&from={from_ts}&to={now_ts}&token={api_key}",
                timeout=10,
            )
            if resp.status_code != 200:
                return None

            data = resp.json()
            if data.get("s") != "ok":
                return None

            closes = data.get("c", [])
            highs = data.get("h", [])
            lows = data.get("l", [])
            opens = data.get("o", [])
            volumes = data.get("v", [])
            timestamps = data.get("t", [])

            points = []
            for i in range(len(timestamps)):
                dt = datetime.fromtimestamp(timestamps[i])
                points.append(StockHistoryPoint(
                    date=dt.strftime("%Y-%m-%d"),
                    open=safe_float(opens[i]) if i < len(opens) else 0.0,
                    high=safe_float(highs[i]) if i < len(highs) else 0.0,
                    low=safe_float(lows[i]) if i < len(lows) else 0.0,
                    close=safe_float(closes[i]) if i < len(closes) else 0.0,
                    volume=safe_int(volumes[i]) if i < len(volumes) else 0,
                ))

            return points if points else None
        except Exception:
            return None

    @staticmethod
    def _build_history_from_yahoo_direct(ticker: str, period: str) -> Optional[List[StockHistoryPoint]]:
        period_map = {
            "1m": ("1mo", "1d"),
            "6m": ("6mo", "1d"),
            "1y": ("1y", "1d"),
            "5y": ("5y", "1wk"),
        }
        yf_period, yf_interval = period_map.get(period, ("1mo", "1d"))

        try:
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?range={yf_period}&interval={yf_interval}"
            resp = requests.get(url, headers=YAHOO_HEADERS, timeout=10)
            if resp.status_code != 200:
                return None

            data = resp.json()
            result = data.get("chart", {}).get("result")
            if not result or not isinstance(result, list) or len(result) == 0:
                return None

            chart = result[0]
            timestamps = chart.get("timestamp", [])
            quotes = chart.get("indicators", {}).get("quote", [])
            if not quotes:
                return None

            quote = quotes[0]
            opens = quote.get("open", [])
            highs = quote.get("high", [])
            lows = quote.get("low", [])
            closes = quote.get("close", [])
            volumes = quote.get("volume", [])

            points = []
            for i, ts in enumerate(timestamps):
                from datetime import datetime
                dt = datetime.fromtimestamp(ts)
                points.append(StockHistoryPoint(
                    date=dt.strftime("%Y-%m-%d"),
                    open=safe_float(opens[i]) if i < len(opens) and opens[i] is not None else 0.0,
                    high=safe_float(highs[i]) if i < len(highs) and highs[i] is not None else 0.0,
                    low=safe_float(lows[i]) if i < len(lows) and lows[i] is not None else 0.0,
                    close=safe_float(closes[i]) if i < len(closes) and closes[i] is not None else 0.0,
                    volume=safe_int(volumes[i]) if i < len(volumes) and volumes[i] is not None else 0,
                ))

            return points if points else None
        except Exception:
            return None

    @staticmethod
    def _build_history_from_yfinance(ticker: str, period: str) -> Optional[List[StockHistoryPoint]]:
        period_map = {
            "1m": ("1mo", "1d"),
            "6m": ("6mo", "1d"),
            "1y": ("1y", "1d"),
            "5y": ("5y", "1wk"),
        }
        yf_period, yf_interval = period_map.get(period, ("1mo", "1d"))

        try:
            ticker_obj = yf.Ticker(ticker)
            df = ticker_obj.history(period=yf_period, interval=yf_interval)
            if df.empty:
                return None

            points = []
            for date_index, row in df.iterrows():
                date_str = date_index.strftime("%Y-%m-%d")
                points.append(StockHistoryPoint(
                    date=date_str,
                    open=safe_float(row.get("Open")) or 0.0,
                    high=safe_float(row.get("High")) or 0.0,
                    low=safe_float(row.get("Low")) or 0.0,
                    close=safe_float(row.get("Close")) or 0.0,
                    volume=safe_int(row.get("Volume")) or 0,
                ))
            return points if points else None
        except Exception:
            return None

    @staticmethod
    def get_stock_history(ticker: str, period: str) -> List[StockHistoryPoint]:
        ticker_upper = ticker.upper().strip()
        cache_key = (ticker_upper, period)
        now = datetime.now()

        if cache_key in MarketDataService._history_cache:
            cache_time, cached_data = MarketDataService._history_cache[cache_key]
            if (now - cache_time).total_seconds() < 300:
                return cached_data

        # Tier 1: Finnhub
        points = MarketDataService._build_history_from_finnhub(ticker_upper, period)
        if points:
            MarketDataService._history_cache[cache_key] = (now, points)
            return points

        # Tier 2: Direct Yahoo HTTP
        points = MarketDataService._build_history_from_yahoo_direct(ticker_upper, period)
        if points:
            MarketDataService._history_cache[cache_key] = (now, points)
            return points

        # Tier 3: yfinance fallback
        points = MarketDataService._build_history_from_yfinance(ticker_upper, period)
        if points:
            MarketDataService._history_cache[cache_key] = (now, points)
            return points

        return []

    @staticmethod
    def get_stock_news(ticker: str) -> List[StockNewsArticle]:
        ticker_upper = ticker.upper().strip()
        now = datetime.now()
        
        # Check cache (60 seconds TTL)
        if ticker_upper in MarketDataService._news_cache:
            cache_time, cached_data = MarketDataService._news_cache[ticker_upper]
            if (now - cache_time).total_seconds() < 60:
                return cached_data
                
        try:
            ticker_obj = yf.Ticker(ticker_upper)
            news = ticker_obj.news
            
            if not news:
                return []
                
            articles = []
            for article in news:
                title = article.get("title")
                publisher = article.get("publisher") or "Unknown"
                link = article.get("link")
                published_at = article.get("providerPublishTime")
                
                if title and link and published_at:
                    articles.append(StockNewsArticle(
                        title=title,
                        publisher=publisher,
                        link=link,
                        published_at=published_at
                    ))
            
            # Save to cache
            MarketDataService._news_cache[ticker_upper] = (now, articles)
            return articles
        except Exception as e:
            print(f"Error fetching news for {ticker_upper}: {e}")
            return []

    @staticmethod
    def get_stock_earnings(ticker: str) -> Optional[Dict[str, Any]]:
        ticker_upper = ticker.upper().strip()

        # Tier 1: Finnhub
        result = MarketDataService._build_earnings_from_finnhub(ticker_upper)
        if result:
            return result

        # Tier 2: Direct Yahoo HTTP
        result = MarketDataService._build_earnings_from_yahoo_direct(ticker_upper)
        if result:
            return result

        # Tier 3: yfinance fallback
        result = MarketDataService._build_earnings_from_yfinance(ticker_upper)
        if result:
            return result

        return None

    @staticmethod
    def _build_earnings_from_finnhub(ticker: str) -> Optional[Dict[str, Any]]:
        api_key = settings.FINNHUB_API_KEY
        if not api_key:
            return None

        try:
            earnings_resp = requests.get(
                f"https://finnhub.io/api/v1/stock/earnings?symbol={ticker}&token={api_key}",
                timeout=10,
            )
            if earnings_resp.status_code != 200:
                return None

            earnings_data = earnings_resp.json()
            if not earnings_data or not isinstance(earnings_data, list):
                return None

            from datetime import datetime, timedelta, timezone
            today = datetime.now()
            from_date = today.strftime("%Y-%m-%d")
            to_date = (today + timedelta(days=90)).strftime("%Y-%m-%d")

            cal_resp = requests.get(
                f"https://finnhub.io/api/v1/stock/earnings-calendar?symbol={ticker}&from={from_date}&to={to_date}&token={api_key}",
                timeout=10,
            )

            next_date = None
            revenue_est = None
            eps_est = None

            if cal_resp.status_code == 200:
                cal_data = cal_resp.json()
                cal_entries = cal_data.get("earningsCalendar", [])
                if cal_entries:
                    entry = cal_entries[0]
                    date_str = entry.get("date")
                    if date_str:
                        try:
                            dt = datetime.strptime(date_str, "%Y-%m-%d")
                            next_date = dt.strftime("%b %d, %Y")
                        except (ValueError, AttributeError):
                            pass
                    eps_est = safe_float(entry.get("epsEstimate"))
                    revenue_est = safe_float(entry.get("revenueEstimate"))

            prev_eps = None
            surprise = None
            for er in earnings_data:
                actual = safe_float(er.get("actual"))
                if actual is not None:
                    prev_eps = actual
                if surprise is None:
                    surprise = safe_float(er.get("surprise"))

            if next_date is None and prev_eps is None and eps_est is None:
                return None

            return {
                "next_earnings_date": next_date,
                "revenue_estimate": revenue_est,
                "eps_estimate": eps_est,
                "previous_eps": prev_eps,
                "earnings_surprise": surprise,
            }
        except Exception:
            return None

    @staticmethod
    def _build_earnings_from_yahoo_direct(ticker: str) -> Optional[Dict[str, Any]]:
        try:
            url = (
                f"https://query1.finance.yahoo.com/v10/finance/quoteSummary/{ticker}"
                f"?modules=calendarEvents,earnings,earningsHistory"
            )
            resp = requests.get(url, headers=YAHOO_HEADERS, timeout=10)
            if resp.status_code != 200:
                return None

            data = resp.json()
            result = data.get("quoteSummary", {}).get("result", [])
            if not result:
                return None

            quote = result[0]

            calendar = quote.get("calendarEvents", {}).get("earnings", {})
            earnings_dates = calendar.get("earningsDate", [])
            next_date = None
            if earnings_dates:
                try:
                    ts = earnings_dates[0].get("raw")
                    if ts:
                        from datetime import datetime, timezone
                        next_date = datetime.fromtimestamp(int(ts), tz=timezone.utc).strftime("%b %d, %Y")
                except (ValueError, OSError, TypeError):
                    pass

            revenue_est = safe_float(calendar.get("revenueEstimate", {}).get("raw"))
            eps_est = safe_float(calendar.get("epsEstimate", {}).get("raw"))

            earnings = quote.get("earnings", {})
            prev_eps = safe_float(earnings.get("epsActual", {}).get("raw"))
            if prev_eps is None:
                prev_eps = safe_float(earnings.get("epsTrailingTwelveMonths", {}).get("raw"))

            surprise = None
            earnings_history = quote.get("earningsHistory", {}).get("history", [])
            if earnings_history:
                last_item = earnings_history[-1]
                surprise = safe_float(last_item.get("surprise", {}).get("raw"))

            if next_date is None and prev_eps is None and eps_est is None:
                return None

            return {
                "next_earnings_date": next_date,
                "revenue_estimate": revenue_est,
                "eps_estimate": eps_est,
                "previous_eps": prev_eps,
                "earnings_surprise": surprise,
            }
        except Exception:
            return None

    @staticmethod
    def _build_earnings_from_yfinance(ticker: str) -> Optional[Dict[str, Any]]:
        try:
            ticker_obj = yf.Ticker(ticker)
            info = ticker_obj.info
            if not info or not isinstance(info, dict) or not info.get("symbol"):
                return None

            next_date = None
            ts = info.get("earningsTimestamp")
            if ts:
                try:
                    from datetime import datetime, timezone
                    next_date = datetime.fromtimestamp(int(ts), tz=timezone.utc).strftime("%b %d, %Y")
                except (ValueError, OSError):
                    pass

            revenue_est = safe_float(info.get("totalRevenue")) or safe_float(info.get("revenueEstimate"))
            eps_est = safe_float(info.get("epsForward") or info.get("forwardEps"))
            prev_eps = safe_float(info.get("trailingEps"))

            surprise = None
            try:
                earnings = ticker_obj.earnings
                if earnings is not None and not earnings.empty:
                    last_item = earnings.iloc[-1]
                    surprise = safe_float(last_item.get("surprise"))
            except Exception:
                pass

            if next_date is None and prev_eps is None and eps_est is None:
                return None

            return {
                "next_earnings_date": next_date,
                "revenue_estimate": revenue_est,
                "eps_estimate": eps_est,
                "previous_eps": prev_eps,
                "earnings_surprise": surprise,
            }
        except Exception:
            return None
