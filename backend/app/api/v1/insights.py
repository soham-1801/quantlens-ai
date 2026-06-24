
import logging
import re
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.core.rate_limit import limiter
from app.models.user import User
from app.models.sentiment_cache import SentimentCache
from app.schemas.stock import StockSentimentSummary, StockNewsArticle, ResearchSummary, EarningsSummary, Recommendation
from app.services.market_data import MarketDataService
from app.services.sentiment import SentimentService

logger = logging.getLogger(__name__)

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

@router.get("/{ticker}/sentiment", response_model=StockSentimentSummary)
@limiter.limit("20/minute")
def get_ticker_sentiment(
    request: Request,
    ticker: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ticker_upper = validate_ticker(ticker)
    
    # 1. Check if we have a fresh cached sentiment record (within 24 hours)
    cache_record = db.query(SentimentCache).filter(SentimentCache.ticker == ticker_upper).first()
    now = datetime.now()
    
    cache_is_fresh = False
    if cache_record:
        # Calculate time difference
        time_diff = now - cache_record.updated_at.replace(tzinfo=None)
        if time_diff < timedelta(hours=24):
            cache_is_fresh = True
            
    if cache_is_fresh:
        # Load from cache, then fetch fresh headlines and score them dynamically
        news_articles = MarketDataService.get_stock_news(ticker_upper)
        _, _, scored_articles = SentimentService.analyze_news_list(news_articles)
        
        return StockSentimentSummary(
            ticker=ticker_upper,
            overall_sentiment_label=cache_record.sentiment_label,
            overall_sentiment_score=cache_record.sentiment_score,
            summary_paragraph=cache_record.summary_paragraph,
            articles=scored_articles
        )
        
    # 3. Cache is stale or missing - perform fresh sentiment analysis
    news_articles = MarketDataService.get_stock_news(ticker_upper)
    if not news_articles:
        # Return a neutral template if there's no news
        empty_summary = f"No recent headlines were found for {ticker_upper}. Quantitative sentiment is neutral by default."
        return StockSentimentSummary(
            ticker=ticker_upper,
            overall_sentiment_label="neutral",
            overall_sentiment_score=0.0,
            summary_paragraph=empty_summary,
            articles=[]
        )
        
    overall_label, overall_score, scored_articles = SentimentService.analyze_news_list(news_articles)
    summary_paragraph = SentimentService.generate_ai_insights_summary(
        ticker_upper, overall_label, overall_score, scored_articles
    )
    
    # 4. Save/Update cache record in DB
    if cache_record:
        cache_record.sentiment_label = overall_label
        cache_record.sentiment_score = overall_score
        cache_record.summary_paragraph = summary_paragraph
        cache_record.updated_at = now
    else:
        new_cache = SentimentCache(
            ticker=ticker_upper,
            sentiment_label=overall_label,
            sentiment_score=overall_score,
            summary_paragraph=summary_paragraph,
            updated_at=now
        )
        db.add(new_cache)
        
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        # Non-fatal database error, we can still return results to the client
        logger.warning("Failed to save sentiment cache for %s: %s", ticker_upper, e)
        
    return StockSentimentSummary(
        ticker=ticker_upper,
        overall_sentiment_label=overall_label,
        overall_sentiment_score=overall_score,
        summary_paragraph=summary_paragraph,
        articles=scored_articles
    )


@router.get("/{ticker}/research", response_model=ResearchSummary)
@limiter.limit("20/minute")
def get_ticker_research(
    request: Request,
    ticker: str,
    current_user: User = Depends(get_current_user)
):
    ticker_upper = validate_ticker(ticker)

    overview = MarketDataService.get_stock_overview(ticker_upper)

    news_articles = MarketDataService.get_stock_news(ticker_upper)
    _, overall_score, scored_articles = SentimentService.analyze_news_list(news_articles) if news_articles else ("neutral", 0.0, [])

    strengths = []
    risks = []
    growth_drivers = []

    if overview:
        if overview.market_cap and overview.market_cap > 1e10:
            strengths.append("Large-cap market leader with substantial valuation")
        if overview.pe_ratio and 10 < overview.pe_ratio < 25:
            strengths.append("Reasonable valuation relative to earnings")
        elif overview.pe_ratio and overview.pe_ratio <= 10:
            strengths.append("Potentially undervalued based on earnings multiple")
        if overview.beta and overview.beta < 1.0:
            strengths.append("Lower volatility compared to the broader market")
        if overview.dividend_yield and overview.dividend_yield > 0:
            strengths.append(f"Pays a dividend yielding {overview.dividend_yield*100:.2f}%")
        if overview.eps and overview.eps > 0:
            strengths.append("Positive earnings per share indicating profitability")
        if overview.pe_ratio and overview.pe_ratio > 30:
            risks.append("Premium valuation multiple may indicate elevated expectations")
        if overview.beta and overview.beta > 1.3:
            risks.append("High beta suggests above-average price volatility")
        if overview.dividend_yield is not None and overview.dividend_yield == 0:
            risks.append("No dividend income stream for income-focused investors")
        if overview.eps and overview.eps < 0:
            risks.append("Negative earnings per share signals unprofitability")
        if overview.market_cap and overview.market_cap < 1e9:
            growth_drivers.append("Smaller market cap offers room for expansion")
        if overview.pe_ratio and overview.pe_ratio < 20:
            growth_drivers.append("Attractive valuation could drive multiple expansion")
        if overview.avg_volume and overview.volume and overview.volume > overview.avg_volume * 1.5:
            growth_drivers.append("Above-average trading volume signals heightened investor interest")
        if overview.sector:
            growth_drivers.append(f"Operates in the {overview.sector} sector with potential industry tailwinds")

    if overall_score > 0.15:
        strengths.append("Favorable market sentiment from recent news coverage")
    if overall_score < -0.15:
        risks.append("Negative sentiment bias in recent news coverage")
    if not strengths:
        strengths.append("Established publicly traded company with available market data")
    if not risks:
        risks.append("No significant red flags detected in current market data")
    if not growth_drivers:
        growth_drivers.append("Market position and ongoing operations provide baseline growth platform")

    takeaway = (
        f"{ticker_upper} presents a {'balanced' if len(strengths) == len(risks) else 'favorable' if len(strengths) > len(risks) else 'cautious'} "
        f"risk-reward profile based on current fundamentals. "
        f"The company shows {len(strengths)} key strength(s) and {len(risks)} noted risk(s). "
        f"Investors should monitor sector trends and upcoming financial results for further direction."
    )

    return ResearchSummary(
        ticker=ticker_upper,
        strengths=strengths,
        risks=risks,
        growth_drivers=growth_drivers,
        key_takeaway=takeaway
    )


@router.get("/{ticker}/earnings", response_model=EarningsSummary)
@limiter.limit("20/minute")
def get_ticker_earnings(
    request: Request,
    ticker: str,
    current_user: User = Depends(get_current_user)
):
    ticker_upper = validate_ticker(ticker)

    # Uses 3-tier fallback: Finnhub -> Direct Yahoo HTTP -> yfinance
    earnings_data = MarketDataService.get_stock_earnings(ticker_upper)

    if not earnings_data:
        return EarningsSummary(
            ticker=ticker_upper,
            next_earnings_date=None,
            revenue_estimate=None,
            eps_estimate=None,
            previous_eps=None,
            earnings_surprise=None,
            message="Earnings data currently unavailable"
        )

    next_date = earnings_data.get("next_earnings_date") or "Est. within 45 days"
    eps_est = earnings_data.get("eps_estimate")
    prev_eps = earnings_data.get("previous_eps")

    if eps_est is None and prev_eps:
        eps_est = round(prev_eps * 1.05, 2)

    return EarningsSummary(
        ticker=ticker_upper,
        next_earnings_date=next_date,
        revenue_estimate=earnings_data.get("revenue_estimate"),
        eps_estimate=eps_est,
        previous_eps=prev_eps,
        earnings_surprise=earnings_data.get("earnings_surprise")
    )


@router.get("/{ticker}/recommendation", response_model=Recommendation)
@limiter.limit("20/minute")
def get_ticker_recommendation(
    request: Request,
    ticker: str,
    current_user: User = Depends(get_current_user)
):
    ticker_upper = validate_ticker(ticker)

    result = MarketDataService.get_stock_recommendation(ticker_upper)
    if not result:
        return Recommendation(
            ticker=ticker_upper,
            signal="HOLD",
            strength="Neutral",
            score=50,
            technical_score=50,
            sentiment_score=50,
            risk_level="Medium",
            reasons=["Insufficient data for recommendation analysis"]
        )

    return Recommendation(**result)
