import yfinance as yf
import requests
import re
import pandas as pd
import numpy as np
import math
import time
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
from cachetools import TTLCache
from app.core.config import settings
from app.schemas.stock import StockSearchResult, StockOverview, StockHistoryPoint, StockNewsArticle

YAHOO_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}
YAHOO_CRUMB_URL = "https://query2.finance.yahoo.com/v1/test/getcrumb"

def safe_float(val) -> Optional[float]:
    if val is None:
        return None
    try:
        f_val = float(val)
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

def _yahoo_get_json(url: str, timeout: int = 10) -> Optional[dict]:
    for attempt in range(2):
        try:
            resp = requests.get(url, headers=YAHOO_HEADERS, timeout=timeout)
            if resp.status_code == 429:
                time.sleep(1)
                continue
            if resp.status_code == 401:
                return None
            if resp.status_code == 200:
                return resp.json()
            return None
        except requests.RequestException:
            time.sleep(0.5)
    return None

def _finnhub_get(endpoint: str, params: dict = None) -> Optional[dict]:
    api_key = settings.FINNHUB_API_KEY
    if not api_key:
        return None
    base = "https://finnhub.io/api/v1"
    p = {"token": api_key}
    if params:
        p.update(params)
    try:
        resp = requests.get(f"{base}/{endpoint}", params=p, timeout=10)
        if resp.status_code == 429:
            return None
        if resp.status_code == 200:
            return resp.json()
    except requests.RequestException:
        pass
    return None

def _finnhub_stock_profile(ticker: str) -> Optional[dict]:
    data = _finnhub_get("stock/profile2", {"symbol": ticker})
    if data and data.get("name"):
        return data
    return None

def _finnhub_earnings(ticker: str) -> Optional[list]:
    data = _finnhub_get("earnings-calendar", {"symbol": ticker, "from": datetime.now().strftime("%Y-%m-%d")})
    if isinstance(data, list) and len(data) > 0:
        return data
    return None

def _finnhub_metric(ticker: str) -> Optional[dict]:
    data = _finnhub_get("stock/metric", {"symbol": ticker, "metric": "all"})
    if data and "metric" in data:
        return data["metric"]
    return None

def _fetch_overview_from_finnhub(ticker: str) -> Optional[StockOverview]:
    profile = _finnhub_stock_profile(ticker)
    metric = _finnhub_metric(ticker)
    if not profile:
        return None
    cap_raw = profile.get("marketCapitalization")
    market_cap = (safe_int(cap_raw) * 1_000_000) if cap_raw is not None else None
    return StockOverview(
        ticker=profile.get("ticker", ticker).upper(),
        name=profile.get("name", ticker),
        description=None,
        sector=profile.get("finnhubIndustry"),
        industry=None,
        exchange=profile.get("exchange"),
        website=profile.get("weburl"),
        market_cap=market_cap,
        pe_ratio=safe_float(metric.get("peTTM") if metric else None),
        dividend_yield=safe_float(metric.get("dividendYieldIndicatedAnnual") if metric else None),
        current_price=None,
        day_high=None,
        day_low=None,
        fifty_two_week_high=safe_float(metric.get("52WeekHigh") if metric else None),
        fifty_two_week_low=safe_float(metric.get("52WeekLow") if metric else None),
        volume=None,
        previous_close=safe_float(metric.get("previousClose") if metric else None),
        open_price=None,
        eps=safe_float(metric.get("epsTTM") if metric else None),
        beta=safe_float(metric.get("beta") if metric else None),
        avg_volume=safe_int(metric.get("averageVolume") if metric else None)
    )

def _fetch_overview_from_yahoo_direct(ticker: str) -> Optional[StockOverview]:
    url = f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/{ticker}?modules=summaryProfile,summaryDetail,defaultKeyStatistics,price"
    data = _yahoo_get_json(url)
    if not data:
        url2 = f"https://query1.finance.yahoo.com/v10/finance/quoteSummary/{ticker}?modules=summaryProfile,summaryDetail,defaultKeyStatistics,price"
        data = _yahoo_get_json(url2)
    if not data:
        return None
    try:
        qs = data["quoteSummary"]["result"][0]
    except (KeyError, IndexError, TypeError):
        return None
    sp = qs.get("summaryProfile", {}) or {}
    sd = qs.get("summaryDetail", {}) or {}
    dks = qs.get("defaultKeyStatistics", {}) or {}
    pr = qs.get("price", {}) or {}

    def g(obj, *keys):
        for k in keys:
            v = obj.get(k, {}) if obj else {}
            if isinstance(v, dict) and "raw" in v:
                return v["raw"]
            obj = v
        return None

    name = None
    if pr.get("longName"):
        name = pr["longName"]
    elif pr.get("shortName"):
        name = pr["shortName"]
    elif sp.get("shortName"):
        name = sp["shortName"]

    current_price = g(sd, "regularMarketPrice", "raw") or g(pr, "regularMarketPrice", "raw") or g(sd, "previousClose", "raw")
    raw_yield = g(sd, "dividendYield", "raw")
    dividend_yield = None
    if raw_yield is not None:
        val = safe_float(raw_yield)
        if val is not None:
            dividend_yield = val

    return StockOverview(
        ticker=ticker.upper(),
        name=name or ticker,
        description=sp.get("longBusinessSummary"),
        sector=sp.get("sector"),
        industry=sp.get("industry"),
        exchange=pr.get("exchangeName"),
        website=sp.get("website") or sp.get("companyUrl"),
        market_cap=safe_int(g(pr, "marketCap", "raw") or g(sd, "marketCap", "raw")),
        pe_ratio=safe_float(g(dks, "trailingPE", "raw") or g(sd, "forwardPE", "raw")),
        dividend_yield=dividend_yield,
        current_price=safe_float(current_price),
        day_high=safe_float(g(sd, "dayHigh", "raw")),
        day_low=safe_float(g(sd, "dayLow", "raw")),
        fifty_two_week_high=safe_float(g(sd, "fiftyTwoWeekHigh", "raw")),
        fifty_two_week_low=safe_float(g(sd, "fiftyTwoWeekLow", "raw")),
        volume=safe_int(g(sd, "volume", "raw")),
        previous_close=safe_float(g(sd, "previousClose", "raw")),
        open_price=safe_float(g(sd, "regularMarketOpen", "raw")),
        eps=safe_float(g(dks, "trailingEps", "raw") or g(sd, "forwardEps", "raw")),
        beta=safe_float(g(dks, "beta", "raw") or g(sd, "beta", "raw")),
        avg_volume=safe_int(g(sd, "averageVolume", "raw") or g(sd, "averageDailyVolume10Day", "raw"))
    )

def _fetch_overview_from_yfinance(ticker: str) -> Optional[StockOverview]:
    try:
        ticker_obj = yf.Ticker(ticker)
        info = ticker_obj.info
        if not info or len(info) < 5:
            return None
        current_price = (
            info.get("currentPrice") or
            info.get("regularMarketPrice") or
            info.get("regularMarketPreviousClose") or
            info.get("previousClose")
        )
        raw_yield = info.get("dividendYield")
        dividend_yield = None
        if raw_yield is not None:
            val = safe_float(raw_yield)
            if val is not None:
                dividend_yield = val / 100.0
        return StockOverview(
            ticker=info.get("symbol", ticker).upper(),
            name=info.get("longName") or info.get("shortName") or ticker,
            description=info.get("longBusinessSummary"),
            sector=info.get("sector"),
            industry=info.get("industry"),
            exchange=info.get("exchange") or info.get("fullExchangeName"),
            website=info.get("website"),
            market_cap=safe_int(info.get("marketCap")),
            pe_ratio=safe_float(info.get("trailingPE") or info.get("forwardPE")),
            dividend_yield=dividend_yield,
            current_price=safe_float(current_price),
            day_high=safe_float(info.get("dayHigh") or info.get("regularMarketDayHigh")),
            day_low=safe_float(info.get("dayLow") or info.get("regularMarketDayLow")),
            fifty_two_week_high=safe_float(info.get("fiftyTwoWeekHigh")),
            fifty_two_week_low=safe_float(info.get("fiftyTwoWeekLow")),
            volume=safe_int(info.get("volume") or info.get("regularMarketVolume")),
            previous_close=safe_float(info.get("previousClose") or info.get("regularMarketPreviousClose")),
            open_price=safe_float(info.get("open") or info.get("regularMarketOpen")),
            eps=safe_float(info.get("trailingEps") or info.get("forwardEps")),
            beta=safe_float(info.get("beta")),
            avg_volume=safe_int(info.get("averageVolume") or info.get("averageDailyVolume10Day") or info.get("averageVolume10days"))
        )
    except Exception:
        return None

def _fetch_history_yfinance(ticker: str, yf_period: str, yf_interval: str) -> Optional[pd.DataFrame]:
    try:
        ticker_obj = yf.Ticker(ticker)
        df = ticker_obj.history(period=yf_period, interval=yf_interval)
        if df is not None and not df.empty:
            return df
    except Exception:
        pass
    return None

def _fetch_earnings_yahoo_direct(ticker: str) -> Optional[dict]:
    url = f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/{ticker}?modules=earnings,earningsHistory,financialData"
    data = _yahoo_get_json(url)
    if not data:
        url2 = f"https://query1.finance.yahoo.com/v10/finance/quoteSummary/{ticker}?modules=earnings,earningsHistory,financialData"
        data = _yahoo_get_json(url2)
    if not data:
        return None
    try:
        qs = data["quoteSummary"]["result"][0]
    except (KeyError, IndexError, TypeError):
        return None
    earnings = qs.get("earnings", {}) or {}
    fd = qs.get("financialData", {}) or {}

    def g(obj, key):
        if not obj:
            return None
        v = obj.get(key, {})
        if isinstance(v, dict) and "raw" in v:
            return v["raw"]
        return None

    eps_estimate = g(fd, "epsForward") or g(fd, "epsTrailingTwelveMonths")
    revenue_estimate = g(fd, "revenueEstimate") or g(fd, "revenuePerShare")
    prev_eps = None
    earnings_history = earnings.get("earningsHistory", [])
    if isinstance(earnings_history, list) and len(earnings_history) > 0:
        latest = earnings_history[-1] or {}
        prev_eps = g(latest, "epsActual")

    next_date = None
    earnings_chart = earnings.get("earningsChart", {}) or {}
    quarterly = earnings_chart.get("quarterly", [])
    if isinstance(quarterly, list) and len(quarterly) > 0:
        next_q = quarterly[-1] or {}
        next_date = next_q.get("date")

    return {
        "next_earnings_date": next_date or "Est. within 45 days",
        "revenue_estimate": safe_float(revenue_estimate),
        "eps_estimate": safe_float(eps_estimate),
        "previous_eps": safe_float(prev_eps),
        "earnings_surprise": None
    }

def _fetch_earnings_finnhub(ticker: str) -> Optional[dict]:
    data = _finnhub_earnings(ticker)
    if not data:
        return None
    latest = data[0]
    return {
        "next_earnings_date": latest.get("date"),
        "revenue_estimate": safe_float(latest.get("revenueEstimate")),
        "eps_estimate": safe_float(latest.get("epsEstimate")),
        "previous_eps": safe_float(latest.get("previousEPS")),
        "earnings_surprise": safe_float(latest.get("surprise"))
    }

def _fetch_news_yahoo_direct(ticker: str) -> Optional[List[StockNewsArticle]]:
    url = f"https://query2.finance.yahoo.com/v1/finance/search?q={ticker}&newsCount=20"
    data = _yahoo_get_json(url)
    if not data:
        return None
    news_list = data.get("news", [])
    if not news_list:
        return None
    articles = []
    for article in news_list:
        title = article.get("title")
        link = article.get("link")
        published_at = article.get("providerPublishTime")
        publisher = article.get("publisher") or "Unknown"
        if title and link:
            articles.append(StockNewsArticle(
                title=title,
                publisher=publisher,
                link=link,
                published_at=published_at or 0
            ))
    return articles if articles else None

def _fetch_news_yfinance(ticker: str) -> Optional[List[StockNewsArticle]]:
    try:
        ticker_obj = yf.Ticker(ticker)
        news = ticker_obj.news
        if not news:
            return None
        articles = []
        for article in news:
            title = article.get("title")
            link = article.get("link")
            published_at = article.get("providerPublishTime")
            publisher = article.get("publisher") or "Unknown"
            if title and link and published_at:
                articles.append(StockNewsArticle(
                    title=title,
                    publisher=publisher,
                    link=link,
                    published_at=published_at
                ))
        return articles if articles else None
    except Exception:
        return None


class MarketDataService:
    _overview_cache = TTLCache(maxsize=200, ttl=60)
    _history_cache = TTLCache(maxsize=100, ttl=300)
    _news_cache = TTLCache(maxsize=100, ttl=60)
    _technical_cache = TTLCache(maxsize=100, ttl=300)
    _earnings_cache = TTLCache(maxsize=100, ttl=600)

    @staticmethod
    def search_stocks(query: str) -> List[StockSearchResult]:
        if not query or len(query.strip()) == 0:
            return []
        query = query.strip()
        query_upper = query.upper()
        results = []

        try:
            url = f"https://query2.finance.yahoo.com/v1/finance/search?q={query}&newsCount=0"
            response = requests.get(url, headers=YAHOO_HEADERS, timeout=5)
            if response.status_code == 200:
                data = response.json()
                quotes = data.get("quotes", [])
                for quote in quotes:
                    symbol = quote.get("symbol")
                    if not symbol:
                        continue
                    quote_type = quote.get("quoteType", "").upper()
                    type_disp = quote.get("typeDisp", "").upper()
                    symbol_upper = symbol.upper()
                    name_upper = (quote.get("longname") or quote.get("shortname") or "").upper()
                    if quote_type not in ("EQUITY", "ETF", "INDEX"):
                        continue
                    if any(t in type_disp for t in ("OPTION", "FUTURE", "WARRANT", "STRUCTURED", "DERIVATIVE")):
                        continue
                    if len(symbol_upper) > 10 and any(char.isdigit() for char in symbol_upper):
                        continue
                    if re.search(r'[A-Z]{1,6}\d{6}[CP]\d{8}', symbol_upper):
                        continue
                    if any(word in name_upper for word in (" PUT", " CALL", " OPTION", " WARRANT", " FUTURE", "STRUCTURED PRODUCT")):
                        continue
                    name = quote.get("longname") or quote.get("shortname") or symbol
                    results.append(StockSearchResult(
                        ticker=symbol,
                        name=name,
                        sector=quote.get("sector"),
                        industry=quote.get("industry"),
                        country=quote.get("country"),
                        quote_type=quote_type
                    ))
        except Exception as e:
            print(f"Yahoo autocomplete error: {e}")

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
                        ticker=ticker, name=info[0], sector=info[1],
                        industry=info[2], country=info[3], quote_type=info[4]
                    ))

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
    def get_stock_overview(ticker: str) -> Optional[StockOverview]:
        ticker_upper = ticker.upper().strip()
        if ticker_upper in MarketDataService._overview_cache:
            return MarketDataService._overview_cache[ticker_upper]
        result = (
            _fetch_overview_from_finnhub(ticker_upper)
            or _fetch_overview_from_yahoo_direct(ticker_upper)
            or _fetch_overview_from_yfinance(ticker_upper)
        )
        if result:
            MarketDataService._overview_cache[ticker_upper] = result
        return result

    @staticmethod
    def get_stock_history(ticker: str, period: str) -> List[StockHistoryPoint]:
        ticker_upper = ticker.upper().strip()
        cache_key = (ticker_upper, period)
        if cache_key in MarketDataService._history_cache:
            return MarketDataService._history_cache[cache_key]
        period_map = {
            "1m": ("1mo", "1d"),
            "6m": ("6mo", "1d"),
            "1y": ("1y", "1d"),
            "5y": ("5y", "1wk")
        }
        yf_period, yf_interval = period_map.get(period, ("1mo", "1d"))
        df = _fetch_history_yfinance(ticker_upper, yf_period, yf_interval)
        if df is None or df.empty:
            return []
        df = df[df["Close"].notna()]
        if df.empty:
            return []
        history_points = []
        for date_index, row in df.iterrows():
            date_str = date_index.strftime('%Y-%m-%d')
            history_points.append(StockHistoryPoint(
                date=date_str,
                open=safe_float(row.get('Open')) or 0.0,
                high=safe_float(row.get('High')) or 0.0,
                low=safe_float(row.get('Low')) or 0.0,
                close=safe_float(row.get('Close')) or 0.0,
                volume=safe_int(row.get('Volume')) or 0
            ))
        MarketDataService._history_cache[cache_key] = history_points
        return history_points

    @staticmethod
    def get_stock_news(ticker: str) -> List[StockNewsArticle]:
        ticker_upper = ticker.upper().strip()
        if ticker_upper in MarketDataService._news_cache:
            return MarketDataService._news_cache[ticker_upper]
        articles = (
            _fetch_news_yahoo_direct(ticker_upper)
            or _fetch_news_yfinance(ticker_upper)
            or []
        )
        MarketDataService._news_cache[ticker_upper] = articles
        return articles

    @staticmethod
    def get_stock_technical(ticker: str) -> Optional[Dict[str, Any]]:
        ticker_upper = ticker.upper().strip()
        if ticker_upper in MarketDataService._technical_cache:
            return MarketDataService._technical_cache[ticker_upper]
        df = _fetch_history_yfinance(ticker_upper, "1y", "1d")
        if df is None or df.empty:
            return None
        df = df[df["Close"].notna()].copy()
        if len(df) < 20:
            return None
        close = df["Close"].astype(float)
        high = df["High"].astype(float)
        low = df["Low"].astype(float)

        current_price = safe_float(close.iloc[-1])

        delta = close.diff()
        gain = delta.where(delta > 0, 0.0)
        loss = (-delta.where(delta < 0, 0.0))
        avg_gain = gain.rolling(14).mean()
        avg_loss = loss.rolling(14).mean()
        rs = avg_gain / avg_loss.replace(0, float('nan'))
        rsi_series = 100 - (100 / (1 + rs))
        rsi = safe_float(rsi_series.iloc[-1])

        ema20 = safe_float(close.ewm(span=20, adjust=False).mean().iloc[-1])
        ema50 = safe_float(close.ewm(span=50, adjust=False).mean().iloc[-1])
        sma200 = safe_float(close.rolling(200).mean().iloc[-1]) if len(close) >= 200 else None

        macd_line = close.ewm(span=12, adjust=False).mean() - close.ewm(span=26, adjust=False).mean()
        macd_signal = macd_line.ewm(span=9, adjust=False).mean()
        macd_histogram = macd_line - macd_signal
        macd_val = safe_float(macd_line.iloc[-1])
        macd_sig_val = safe_float(macd_signal.iloc[-1])
        macd_hist_val = safe_float(macd_histogram.iloc[-1])

        sma20 = close.rolling(20).mean()
        std20 = close.rolling(20).std()
        bb_upper = safe_float((sma20 + 2 * std20).iloc[-1])
        bb_middle = safe_float(sma20.iloc[-1])
        bb_lower = safe_float((sma20 - 2 * std20).iloc[-1])

        tr = pd.concat([
            high - low,
            (high - close.shift()).abs(),
            (low - close.shift()).abs()
        ], axis=1).max(axis=1)
        atr = safe_float(tr.rolling(14).mean().iloc[-1])

        result = {
            "ticker": ticker_upper,
            "current_price": current_price,
            "rsi": rsi,
            "ema20": ema20,
            "ema50": ema50,
            "sma200": sma200,
            "macd": {"macd": macd_val, "signal": macd_sig_val, "histogram": macd_hist_val},
            "bollinger": {"upper": bb_upper, "middle": bb_middle, "lower": bb_lower},
            "atr": atr
        }
        MarketDataService._technical_cache[ticker_upper] = result
        return result

    @staticmethod
    def get_stock_earnings(ticker: str) -> Optional[dict]:
        ticker_upper = ticker.upper().strip()
        if ticker_upper in MarketDataService._earnings_cache:
            return MarketDataService._earnings_cache[ticker_upper]
        result = (
            _fetch_earnings_finnhub(ticker_upper)
            or _fetch_earnings_yahoo_direct(ticker_upper)
        )
        if result:
            MarketDataService._earnings_cache[ticker_upper] = result
        return result

    @staticmethod
    def get_stock_recommendation(ticker: str) -> Optional[dict]:
        ticker_upper = ticker.upper().strip()
        technical = MarketDataService.get_stock_technical(ticker_upper)
        if not technical:
            return None
        tech_score = MarketDataService._compute_technical_score(technical)
        from app.services.sentiment import SentimentService
        news_articles = MarketDataService.get_stock_news(ticker_upper)
        _, sent_score, _ = SentimentService.analyze_news_list(news_articles) if news_articles else ("neutral", 0.0, [])
        sent_score_normalized = (sent_score + 1.0) * 50.0
        combined_score = tech_score * 0.7 + sent_score_normalized * 0.3
        signal, strength = MarketDataService._map_signal(combined_score)
        risk_level = MarketDataService._compute_risk_level(technical)
        reasons = MarketDataService._build_reasons(technical, sent_score, combined_score, signal)
        return {
            "ticker": ticker_upper,
            "signal": signal,
            "strength": strength,
            "score": round(combined_score, 2),
            "technical_score": round(tech_score, 2),
            "sentiment_score": round(sent_score_normalized, 2),
            "risk_level": risk_level,
            "reasons": reasons
        }

    @staticmethod
    def _compute_technical_score(technical: dict) -> float:
        score = 50.0
        rsi = technical.get("rsi")
        if rsi is not None:
            if rsi < 30:
                score += 25
            elif rsi < 40:
                score += 10
            elif rsi > 70:
                score -= 25
        cp = technical.get("current_price")
        ema20 = technical.get("ema20")
        ema50 = technical.get("ema50")
        sma200 = technical.get("sma200")
        if cp is not None and ema20 is not None and cp > ema20:
            score += 10
        if cp is not None and ema50 is not None and cp > ema50:
            score += 15
        if cp is not None and sma200 is not None and cp > sma200:
            score += 20
        macd = technical.get("macd", {})
        if isinstance(macd, dict):
            m_val = macd.get("macd")
            m_sig = macd.get("signal")
            if m_val is not None and m_sig is not None:
                if m_val > m_sig:
                    score += 15
                else:
                    score -= 15
        bb = technical.get("bollinger", {})
        if isinstance(bb, dict):
            bb_lower = bb.get("lower")
            bb_upper = bb.get("upper")
            if cp is not None and bb_lower is not None and cp <= bb_lower * 1.02:
                score += 10
            if cp is not None and bb_upper is not None and cp >= bb_upper * 0.98:
                score -= 10
        return max(0.0, min(100.0, score))

    @staticmethod
    def _compute_risk_level(technical: dict) -> str:
        cp = technical.get("current_price")
        atr = technical.get("atr")
        if cp and atr and cp > 0:
            atr_pct = (atr / cp) * 100
            if atr_pct > 3:
                return "High"
            elif atr_pct > 1.5:
                return "Medium"
        return "Low"

    @staticmethod
    def _map_signal(score: float) -> Tuple[str, str]:
        if score >= 80:
            return "STRONG_BUY", "Strong"
        elif score >= 65:
            return "BUY", "Moderate"
        elif score >= 45:
            return "HOLD", "Neutral"
        elif score >= 25:
            return "SELL", "Moderate"
        else:
            return "STRONG_SELL", "Strong"

    @staticmethod
    def _build_reasons(technical: dict, sent_score: float, combined: float, signal: str) -> List[str]:
        reasons = []
        rsi = technical.get("rsi")
        if rsi is not None:
            if rsi < 30:
                reasons.append("RSI indicates oversold conditions")
            elif rsi > 70:
                reasons.append("RSI indicates overbought conditions")
            else:
                reasons.append(f"RSI at {rsi:.1f} — neutral territory")
        cp = technical.get("current_price")
        ema20 = technical.get("ema20")
        ema50 = technical.get("ema50")
        sma200 = technical.get("sma200")
        if cp is not None:
            above = []
            if ema20 is not None and cp > ema20:
                above.append("EMA20")
            if ema50 is not None and cp > ema50:
                above.append("EMA50")
            if sma200 is not None and cp > sma200:
                above.append("SMA200")
            if above:
                reasons.append(f"Price above {', '.join(above)}")
            else:
                reasons.append("Price below key moving averages")
        macd = technical.get("macd", {}) or {}
        m_val = macd.get("macd") if isinstance(macd, dict) else None
        m_sig = macd.get("signal") if isinstance(macd, dict) else None
        if m_val is not None and m_sig is not None:
            reasons.append(f"MACD {'bullish' if m_val > m_sig else 'bearish'} crossover")
        bb = technical.get("bollinger", {}) or {}
        bb_lower = bb.get("lower") if isinstance(bb, dict) else None
        bb_upper = bb.get("upper") if isinstance(bb, dict) else None
        if cp is not None and bb_lower is not None and bb_upper is not None:
            if cp <= bb_lower * 1.02:
                reasons.append("Price near lower Bollinger Band")
            elif cp >= bb_upper * 0.98:
                reasons.append("Price near upper Bollinger Band")
        if abs(sent_score) > 0.15:
            reasons.append(f"News sentiment is {'positive' if sent_score > 0 else 'negative'} ({sent_score:+.2f})")
        else:
            reasons.append("News sentiment is neutral")
        reasons.append(f"Combined score: {combined:.1f}/100 ({signal})")
        return reasons
