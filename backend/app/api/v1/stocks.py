from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List
from app.services.market_data import MarketDataService
from app.schemas.stock import StockSearchResult, StockOverview, StockHistoryPoint, StockNewsArticle, TechnicalIndicators
from app.api.v1.auth import get_current_user  # Dependency protection
from app.models.user import User

router = APIRouter()

@router.get("/search", response_model=List[StockSearchResult])
def search_stocks(
    q: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user)
):
    return MarketDataService.search_stocks(q)

@router.get("/{ticker}/overview", response_model=StockOverview)
def get_stock_overview(
    ticker: str,
    current_user: User = Depends(get_current_user)
):
    overview = MarketDataService.get_stock_overview(ticker)
    if not overview:
        raise HTTPException(
            status_code=404,
            detail=f"Stock ticker '{ticker.upper()}' not found or data is unavailable."
        )
    return overview

@router.get("/{ticker}/history", response_model=List[StockHistoryPoint])
def get_stock_history(
    ticker: str,
    period: str = Query("1m", regex="^(1m|6m|1y|5y)$"),
    current_user: User = Depends(get_current_user)
):
    # Retrieve time-series details
    history = MarketDataService.get_stock_history(ticker, period)
    if not history:
        raise HTTPException(
            status_code=404,
            detail=f"Historical price data for '{ticker.upper()}' is unavailable."
        )
    return history

@router.get("/{ticker}/news", response_model=List[StockNewsArticle])
def get_stock_news(
    ticker: str,
    current_user: User = Depends(get_current_user)
):
    news = MarketDataService.get_stock_news(ticker)
    return news


@router.get("/{ticker}/technical", response_model=TechnicalIndicators)
def get_stock_technical(
    ticker: str,
    current_user: User = Depends(get_current_user)
):
    result = MarketDataService.get_stock_technical(ticker)
    if not result:
        return TechnicalIndicators(ticker=ticker.upper())
    return TechnicalIndicators(**result)