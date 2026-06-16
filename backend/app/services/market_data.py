import yfinance as yf
import requests
import re
from typing import List, Optional, Dict, Any
from datetime import datetime
from app.schemas.stock import StockSearchResult, StockOverview, StockHistoryPoint, StockNewsArticle

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

class MarketDataService:
    _overview_cache = {}  # ticker_upper: (timestamp, StockOverview)
    _history_cache = {}   # (ticker_upper, period): (timestamp, List[StockHistoryPoint])
    _news_cache = {}      # ticker_upper: (timestamp, List[StockNewsArticle])

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
    def get_stock_overview(ticker: str) -> Optional[StockOverview]:
        ticker_upper = ticker.upper().strip()
        now = datetime.now()
        
        # Check cache (60 seconds TTL)
        if ticker_upper in MarketDataService._overview_cache:
            cache_time, cached_data = MarketDataService._overview_cache[ticker_upper]
            if (now - cache_time).total_seconds() < 60:
                return cached_data
                
        try:
            ticker_obj = yf.Ticker(ticker_upper)
            info = ticker_obj.info
            
            if not info or len(info) == 0 or not info.get("symbol"):
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
            
            result = StockOverview(
                ticker=info.get("symbol", ticker_upper).upper(),
                name=info.get("longName") or info.get("shortName") or ticker_upper,
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
            
            # Save to cache
            MarketDataService._overview_cache[ticker_upper] = (now, result)
            return result
        except Exception as e:
            print(f"Error fetching stock overview for {ticker_upper}: {e}")
            return None

    @staticmethod
    def get_stock_history(ticker: str, period: str) -> List[StockHistoryPoint]:
        ticker_upper = ticker.upper().strip()
        cache_key = (ticker_upper, period)
        now = datetime.now()
        
        # Check cache (5 minutes TTL)
        if cache_key in MarketDataService._history_cache:
            cache_time, cached_data = MarketDataService._history_cache[cache_key]
            if (now - cache_time).total_seconds() < 300:
                return cached_data
                
        period_map = {
            "1m": ("1mo", "1d"),
            "6m": ("6mo", "1d"),
            "1y": ("1y", "1d"),
            "5y": ("5y", "1wk")
        }
        
        yf_period, yf_interval = period_map.get(period, ("1mo", "1d"))
        
        try:
            ticker_obj = yf.Ticker(ticker_upper)
            df = ticker_obj.history(period=yf_period, interval=yf_interval)
            
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
                
            # Save to cache
            MarketDataService._history_cache[cache_key] = (now, history_points)
            return history_points
        except Exception as e:
            print(f"Error fetching history for {ticker}: {e}")
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
