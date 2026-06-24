import re
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from typing import List
from app.services.market_data import MarketDataService
from app.schemas.stock import StockSearchResult, StockOverview, StockHistoryPoint, StockNewsArticle, TechnicalIndicators
from app.api.v1.auth import get_current_user
from app.core.rate_limit import limiter
from app.models.user import User

router = APIRouter()

TICKER_PATTERN = re.compile(r"^[A-Z0-9.]{1,20}$")

def validate_ticker(ticker: str) -> str:
    cleaned = ticker.upper().strip()
    if not TICKER_PATTERN.match(cleaned):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid ticker symbol: '{ticker}'. Tickers must be 1-20 alphanumeric characters (dots allowed)."
        )
    return cleaned

@router.get("/search", response_model=List[StockSearchResult])
@limiter.limit("30/minute")
def search_stocks(
    request: Request,
    q: str = Query(..., min_length=1, max_length=50),
    current_user: User = Depends(get_current_user)
):
    return MarketDataService.search_stocks(q)

@router.get("/{ticker}/overview", response_model=StockOverview)
@limiter.limit("60/minute")
def get_stock_overview(
    request: Request,
    ticker: str,
    current_user: User = Depends(get_current_user)
):
    ticker = validate_ticker(ticker)
    overview = MarketDataService.get_stock_overview(ticker)
    if not overview:
        raise HTTPException(
            status_code=404,
            detail=f"Stock ticker '{ticker}' not found or data is unavailable."
        )
    return overview

@router.get("/{ticker}/history", response_model=List[StockHistoryPoint])
@limiter.limit("30/minute")
def get_stock_history(
    request: Request,
    ticker: str,
    period: str = Query("1m", pattern="^(1m|6m|1y|5y)$"),
    current_user: User = Depends(get_current_user)
):
    ticker = validate_ticker(ticker)
    history = MarketDataService.get_stock_history(ticker, period)
    if not history:
        raise HTTPException(
            status_code=404,
            detail=f"Historical price data for '{ticker}' is unavailable."
        )
    return history

@router.get("/{ticker}/news", response_model=List[StockNewsArticle])
@limiter.limit("30/minute")
def get_stock_news(
    request: Request,
    ticker: str,
    current_user: User = Depends(get_current_user)
):
    ticker = validate_ticker(ticker)
    news = MarketDataService.get_stock_news(ticker)
    return news

@router.get("/{ticker}/technical", response_model=TechnicalIndicators)
@limiter.limit("30/minute")
def get_stock_technical(
    request: Request,
    ticker: str,
    current_user: User = Depends(get_current_user)
):
    ticker = validate_ticker(ticker)
    result = MarketDataService.get_stock_technical(ticker)
    if not result:
        return TechnicalIndicators(ticker=ticker)
    return TechnicalIndicators(**result)
