from pydantic import BaseModel
from typing import Optional, List

class StockSearchResult(BaseModel):
    ticker: str
    name: str
    sector: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    quote_type: Optional[str] = None


class StockOverview(BaseModel):
    ticker: str
    name: str
    description: Optional[str] = None
    sector: Optional[str] = None
    industry: Optional[str] = None
    exchange: Optional[str] = None
    website: Optional[str] = None
    market_cap: Optional[int] = None
    pe_ratio: Optional[float] = None
    dividend_yield: Optional[float] = None
    current_price: Optional[float] = None
    day_high: Optional[float] = None
    day_low: Optional[float] = None
    fifty_two_week_high: Optional[float] = None
    fifty_two_week_low: Optional[float] = None
    volume: Optional[int] = None
    previous_close: Optional[float] = None
    open_price: Optional[float] = None
    eps: Optional[float] = None
    beta: Optional[float] = None
    avg_volume: Optional[int] = None

class StockHistoryPoint(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: int

class StockNewsArticle(BaseModel):
    title: str
    publisher: str
    link: str
    published_at: int
    sentiment_label: Optional[str] = None
    sentiment_score: Optional[float] = None

class StockSentimentSummary(BaseModel):
    ticker: str
    overall_sentiment_label: str  # positive, neutral, negative
    overall_sentiment_score: float  # -1.0 to 1.0
    summary_paragraph: str
    articles: List[StockNewsArticle]

class ResearchSummary(BaseModel):
    ticker: str
    strengths: List[str]
    risks: List[str]
    growth_drivers: List[str]
    key_takeaway: str

class EarningsSummary(BaseModel):
    ticker: str
    next_earnings_date: Optional[str] = None
    revenue_estimate: Optional[float] = None
    eps_estimate: Optional[float] = None
    previous_eps: Optional[float] = None
    earnings_surprise: Optional[float] = None
    message: Optional[str] = None
