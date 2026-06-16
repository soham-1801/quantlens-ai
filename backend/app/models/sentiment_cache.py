from sqlalchemy import Column, Integer, String, Float, Text, DateTime
from sqlalchemy.sql import func
from app.core.database import Base

class SentimentCache(Base):
    __tablename__ = "sentiment_cache"
    
    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String(10), unique=True, index=True, nullable=False)
    sentiment_score = Column(Float, nullable=True)  # Range: -1.0 to 1.0
    sentiment_label = Column(String(10), nullable=True)  # positive, neutral, negative
    summary_paragraph = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
