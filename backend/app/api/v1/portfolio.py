from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import yfinance as yf

from app.core.database import get_db
from app.models.portfolio import PortfolioItem
from app.models.user import User
from app.schemas.portfolio import PortfolioCreate, PortfolioUpdate, PortfolioResponse
from app.api.v1.auth import get_current_user

router = APIRouter()

@router.get("/", response_model=List[PortfolioResponse])
def get_portfolio(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    items = db.query(PortfolioItem).filter(PortfolioItem.user_id == current_user.id).all()
    if not items:
        return []
    
    # Fetch current prices using yfinance in batch for efficiency
    tickers = [item.ticker for item in items]
    try:
        # Fast batch fetch
        data = yf.download(" ".join(tickers), period="1d", progress=False)
        # yfinance returns a MultiIndex DataFrame if multiple tickers, else single
        # The column we want is 'Close'
    except Exception as e:
        print(f"Error fetching batch prices: {e}")
        data = None

    response_items = []
    for item in items:
        current_price = None
        if data is not None and not data.empty:
            try:
                if len(tickers) == 1:
                    current_price = float(data['Close'].iloc[-1])
                else:
                    # yf structure for multiple tickers: data['Close']['AAPL'].iloc[-1]
                    if 'Close' in data:
                        current_price = float(data['Close'][item.ticker].iloc[-1])
            except Exception:
                pass

        total_value = None
        total_gain_loss = None
        total_gain_loss_percent = None

        if current_price is not None:
            total_value = current_price * item.shares
            total_cost = item.average_price * item.shares
            total_gain_loss = total_value - total_cost
            if total_cost > 0:
                total_gain_loss_percent = (total_gain_loss / total_cost) * 100

        # Construct response
        resp = PortfolioResponse(
            id=item.id,
            user_id=item.user_id,
            ticker=item.ticker,
            shares=item.shares,
            average_price=item.average_price,
            added_at=item.added_at,
            updated_at=item.updated_at,
            current_price=current_price,
            total_value=total_value,
            total_gain_loss=total_gain_loss,
            total_gain_loss_percent=total_gain_loss_percent
        )
        response_items.append(resp)
        
    return response_items

@router.post("/", response_model=PortfolioResponse)
def add_portfolio_item(
    item_in: PortfolioCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check if exists
    existing = db.query(PortfolioItem).filter(
        PortfolioItem.user_id == current_user.id,
        PortfolioItem.ticker == item_in.ticker
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Item already in portfolio. Use PUT to update shares."
        )
        
    new_item = PortfolioItem(
        user_id=current_user.id,
        ticker=item_in.ticker,
        shares=item_in.shares,
        average_price=item_in.average_price
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    
    return PortfolioResponse(
        id=new_item.id,
        user_id=new_item.user_id,
        ticker=new_item.ticker,
        shares=new_item.shares,
        average_price=new_item.average_price,
        added_at=new_item.added_at,
        updated_at=new_item.updated_at
    )

@router.put("/{ticker}", response_model=PortfolioResponse)
def update_portfolio_item(
    ticker: str,
    item_in: PortfolioUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    item = db.query(PortfolioItem).filter(
        PortfolioItem.user_id == current_user.id,
        PortfolioItem.ticker == ticker
    ).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found in portfolio")
        
    item.shares = item_in.shares
    item.average_price = item_in.average_price
    db.commit()
    db.refresh(item)
    
    return PortfolioResponse(
        id=item.id,
        user_id=item.user_id,
        ticker=item.ticker,
        shares=item.shares,
        average_price=item.average_price,
        added_at=item.added_at,
        updated_at=item.updated_at
    )

@router.delete("/{ticker}")
def delete_portfolio_item(
    ticker: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    item = db.query(PortfolioItem).filter(
        PortfolioItem.user_id == current_user.id,
        PortfolioItem.ticker == ticker
    ).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    db.delete(item)
    db.commit()
    return {"ok": True}
