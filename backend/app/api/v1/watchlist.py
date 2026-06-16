from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from typing import List
from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.models.watchlist import Watchlist
from app.schemas.watchlist import WatchlistCreate, WatchlistResponse
from app.services.market_data import MarketDataService

router = APIRouter()

@router.get("/", response_model=List[WatchlistResponse])
def get_watchlist(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    items = db.query(Watchlist).filter(Watchlist.user_id == current_user.id).all()
    results = []
    
    for item in items:
        price_change_percent = None
        if item.current_price is not None and item.previous_close is not None and item.previous_close > 0:
            price_change_percent = ((item.current_price - item.previous_close) / item.previous_close) * 100
                
        results.append(WatchlistResponse(
            id=item.id,
            user_id=item.user_id,
            ticker=item.ticker,
            added_at=item.added_at,
            company_name=item.company_name,
            sector=item.sector,
            industry=item.industry,
            market_cap=item.market_cap,
            pe_ratio=item.pe_ratio,
            dividend_yield=item.dividend_yield,
            beta=item.beta,
            eps=item.eps,
            current_price=item.current_price,
            previous_close=item.previous_close,
            volume=item.volume,
            price_change_percent=price_change_percent,
            website=item.website,
            updated_at=item.updated_at,
            refresh_error=item.refresh_error
        ))
        
    return results

@router.get("/{ticker}", response_model=WatchlistResponse)
def get_watchlist_item(
    ticker: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    item = db.query(Watchlist).filter(
        Watchlist.user_id == current_user.id,
        Watchlist.ticker == ticker.upper()
    ).first()
    
    if not item:
        raise HTTPException(
            status_code=404,
            detail=f"Stock '{ticker.upper()}' is not in your watchlist."
        )
        
    price_change_percent = None
    if item.current_price is not None and item.previous_close is not None and item.previous_close > 0:
        price_change_percent = ((item.current_price - item.previous_close) / item.previous_close) * 100
        
    return WatchlistResponse(
        id=item.id,
        user_id=item.user_id,
        ticker=item.ticker,
        added_at=item.added_at,
        company_name=item.company_name,
        sector=item.sector,
        industry=item.industry,
        market_cap=item.market_cap,
        pe_ratio=item.pe_ratio,
        dividend_yield=item.dividend_yield,
        beta=item.beta,
        eps=item.eps,
        current_price=item.current_price,
        previous_close=item.previous_close,
        volume=item.volume,
        price_change_percent=price_change_percent,
        website=item.website,
        updated_at=item.updated_at,
        refresh_error=item.refresh_error
    )

@router.post("/", response_model=WatchlistResponse, status_code=status.HTTP_201_CREATED)
def add_to_watchlist(
    payload: WatchlistCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ticker_upper = payload.ticker.upper().strip()
    
    # 1. Validate that the ticker is a real stock
    overview = MarketDataService.get_stock_overview(ticker_upper)
    if not overview:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot add to watchlist. Ticker '{ticker_upper}' is invalid or has no data."
        )
        
    # 2. Check if already watchlisted by user
    existing = db.query(Watchlist).filter(
        Watchlist.user_id == current_user.id,
        Watchlist.ticker == ticker_upper
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Ticker '{ticker_upper}' is already in your watchlist."
        )
        
    # 3. Create entry with persisted overview fields
    new_item = Watchlist(
        user_id=current_user.id,
        ticker=ticker_upper,
        company_name=overview.name,
        sector=overview.sector,
        industry=overview.industry,
        market_cap=overview.market_cap,
        pe_ratio=overview.pe_ratio,
        dividend_yield=overview.dividend_yield,
        beta=overview.beta,
        eps=overview.eps,
        current_price=overview.current_price,
        previous_close=overview.previous_close,
        volume=overview.volume,
        website=overview.website,
        updated_at=func.now()
    )
    db.add(new_item)
    try:
        db.commit()
        db.refresh(new_item)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to save watchlist item due to a database error."
        )
        
    return WatchlistResponse(
        id=new_item.id,
        user_id=new_item.user_id,
        ticker=new_item.ticker,
        added_at=new_item.added_at,
        company_name=new_item.company_name,
        sector=new_item.sector,
        industry=new_item.industry,
        market_cap=new_item.market_cap,
        pe_ratio=new_item.pe_ratio,
        dividend_yield=new_item.dividend_yield,
        beta=new_item.beta,
        eps=new_item.eps,
        current_price=new_item.current_price,
        previous_close=new_item.previous_close,
        volume=new_item.volume,
        website=new_item.website,
        updated_at=new_item.updated_at,
        refresh_error=new_item.refresh_error
    )

@router.post("/{ticker}/refresh", response_model=WatchlistResponse)
def refresh_watchlist_item(
    ticker: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ticker_upper = ticker.upper().strip()
    
    item = db.query(Watchlist).filter(
        Watchlist.user_id == current_user.id,
        Watchlist.ticker == ticker_upper
    ).first()
    
    if not item:
        raise HTTPException(
            status_code=404,
            detail=f"Ticker '{ticker_upper}' not found in your watchlist."
        )
    
    overview = MarketDataService.get_stock_overview(ticker_upper)
    refresh_error = None
    if not overview:
        refresh_error = f"Failed to fetch latest data for {ticker_upper}"
    else:
        item.company_name = overview.name
        item.sector = overview.sector
        item.industry = overview.industry
        item.market_cap = overview.market_cap
        item.pe_ratio = overview.pe_ratio
        item.dividend_yield = overview.dividend_yield
        item.beta = overview.beta
        item.eps = overview.eps
        item.current_price = overview.current_price
        item.previous_close = overview.previous_close
        item.volume = overview.volume
        item.website = overview.website
    
    item.updated_at = func.now()
    item.refresh_error = refresh_error
    
    try:
        db.commit()
        db.refresh(item)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to refresh watchlist item due to a database error."
        )
    
    price_change_percent = None
    if item.current_price is not None and item.previous_close is not None and item.previous_close > 0:
        price_change_percent = ((item.current_price - item.previous_close) / item.previous_close) * 100
        
    return WatchlistResponse(
        id=item.id,
        user_id=item.user_id,
        ticker=item.ticker,
        added_at=item.added_at,
        company_name=item.company_name,
        sector=item.sector,
        industry=item.industry,
        market_cap=item.market_cap,
        pe_ratio=item.pe_ratio,
        dividend_yield=item.dividend_yield,
        beta=item.beta,
        eps=item.eps,
        current_price=item.current_price,
        previous_close=item.previous_close,
        volume=item.volume,
        price_change_percent=price_change_percent,
        website=item.website,
        updated_at=item.updated_at,
        refresh_error=item.refresh_error
    )

@router.delete("/{ticker}", status_code=status.HTTP_200_OK)
def remove_from_watchlist(
    ticker: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ticker_upper = ticker.upper().strip()
    
    item = db.query(Watchlist).filter(
        Watchlist.user_id == current_user.id,
        Watchlist.ticker == ticker_upper
    ).first()
    
    if not item:
        raise HTTPException(
            status_code=404,
            detail=f"Ticker '{ticker_upper}' not found in your watchlist."
        )
        
    db.delete(item)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to delete watchlist item due to a database error."
        )
        
    return {"message": f"Successfully removed '{ticker_upper}' from watchlist."}
