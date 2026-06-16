from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint, BigInteger, Float, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base

class Watchlist(Base):
    __tablename__ = "watchlists"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    ticker = Column(String(10), index=True, nullable=False)
    added_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Persisted overview fields (populated on add / refresh)
    company_name = Column(String(255), nullable=True)
    sector = Column(String(255), nullable=True)
    industry = Column(String(255), nullable=True)
    market_cap = Column(BigInteger, nullable=True)
    pe_ratio = Column(Float, nullable=True)
    dividend_yield = Column(Float, nullable=True)
    beta = Column(Float, nullable=True)
    eps = Column(Float, nullable=True)
    current_price = Column(Float, nullable=True)
    previous_close = Column(Float, nullable=True)
    volume = Column(BigInteger, nullable=True)
    website = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=True)
    refresh_error = Column(Text, nullable=True)
    
    # Relationship to user
    user = relationship("User", backref="watchlist_items")
    
    __table_args__ = (
        UniqueConstraint("user_id", "ticker", name="unique_user_ticker"),
    )
