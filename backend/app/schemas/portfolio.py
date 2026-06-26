from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class PortfolioBase(BaseModel):
    ticker: str
    shares: float
    average_price: float

class PortfolioCreate(PortfolioBase):
    pass

class PortfolioUpdate(BaseModel):
    shares: float
    average_price: float

class PortfolioResponse(PortfolioBase):
    id: int
    user_id: int
    added_at: datetime
    updated_at: Optional[datetime] = None
    
    # Dynamic fields computed during API response
    current_price: Optional[float] = None
    total_value: Optional[float] = None
    total_gain_loss: Optional[float] = None
    total_gain_loss_percent: Optional[float] = None

    class Config:
        from_attributes = True
