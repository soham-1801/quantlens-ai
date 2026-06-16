from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class WatchlistBase(BaseModel):
    ticker: str

class WatchlistCreate(WatchlistBase):
    pass

class WatchlistResponse(WatchlistBase):
    id: int
    user_id: int
    added_at: datetime
    
    # Persisted overview fields (returned directly from DB)
    company_name: Optional[str] = None
    sector: Optional[str] = None
    industry: Optional[str] = None
    market_cap: Optional[int] = None
    pe_ratio: Optional[float] = None
    dividend_yield: Optional[float] = None
    beta: Optional[float] = None
    eps: Optional[float] = None
    current_price: Optional[float] = None
    previous_close: Optional[float] = None
    volume: Optional[int] = None
    price_change_percent: Optional[float] = None
    website: Optional[str] = None
    updated_at: Optional[datetime] = None
    refresh_error: Optional[str] = None

    class Config:
        from_attributes = True
