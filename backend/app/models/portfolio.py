from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base

class PortfolioItem(Base):
    __tablename__ = "portfolio_items"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    ticker = Column(String(32), index=True, nullable=False)
    shares = Column(Float, nullable=False, default=0.0)
    average_price = Column(Float, nullable=False, default=0.0)
    
    added_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationship to user
    user = relationship("User", backref="portfolio_items")
    
    __table_args__ = (
        UniqueConstraint("user_id", "ticker", name="unique_user_portfolio_ticker"),
    )
