from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
import yfinance as yf
from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.models.sentiment_cache import SentimentCache
from app.schemas.stock import StockSentimentSummary, StockNewsArticle, ResearchSummary, EarningsSummary
from app.services.market_data import MarketDataService, safe_float
from app.services.sentiment import SentimentService

router = APIRouter()

@router.get("/{ticker}/sentiment", response_model=StockSentimentSummary)
def get_ticker_sentiment(
    ticker: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ticker_upper = ticker.upper().strip()
    
    # 1. Verify ticker is valid by checking overview
    overview = MarketDataService.get_stock_overview(ticker_upper)
    if not overview:
        raise HTTPException(
            status_code=404,
            detail=f"Stock ticker '{ticker_upper}' is invalid or has no data."
        )
        
    # 2. Check if we have a fresh cached sentiment record (within 24 hours)
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
        print(f"Failed to save sentiment cache: {e}")
        
    return StockSentimentSummary(
        ticker=ticker_upper,
        overall_sentiment_label=overall_label,
        overall_sentiment_score=overall_score,
        summary_paragraph=summary_paragraph,
        articles=scored_articles
    )


@router.get("/{ticker}/research", response_model=ResearchSummary)
def get_ticker_research(
    ticker: str,
    current_user: User = Depends(get_current_user)
):
    ticker_upper = ticker.upper().strip()

    overview = MarketDataService.get_stock_overview(ticker_upper)
    if not overview:
        raise HTTPException(
            status_code=404,
            detail=f"Stock ticker '{ticker_upper}' is invalid or has no data."
        )

    news_articles = MarketDataService.get_stock_news(ticker_upper)
    _, overall_score, scored_articles = SentimentService.analyze_news_list(news_articles) if news_articles else ("neutral", 0.0, [])

    strengths = []
    risks = []
    growth_drivers = []

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
    if overall_score > 0.15:
        strengths.append("Favorable market sentiment from recent news coverage")
    if not strengths:
        strengths.append("Established publicly traded company with available market data")

    if overview.pe_ratio and overview.pe_ratio > 30:
        risks.append("Premium valuation multiple may indicate elevated expectations")
    if overview.beta and overview.beta > 1.3:
        risks.append("High beta suggests above-average price volatility")
    if overview.dividend_yield is not None and overview.dividend_yield == 0:
        risks.append("No dividend income stream for income-focused investors")
    if overview.eps and overview.eps < 0:
        risks.append("Negative earnings per share signals unprofitability")
    if overall_score < -0.15:
        risks.append("Negative sentiment bias in recent news coverage")
    if not risks:
        risks.append("No significant red flags detected in current market data")

    if overview.market_cap and overview.market_cap < 1e9:
        growth_drivers.append("Smaller market cap offers room for expansion")
    if overview.pe_ratio and overview.pe_ratio < 20:
        growth_drivers.append("Attractive valuation could drive multiple expansion")
    if overview.avg_volume and overview.volume and overview.volume > overview.avg_volume * 1.5:
        growth_drivers.append("Above-average trading volume signals heightened investor interest")
    if overview.sector:
        growth_drivers.append(f"Operates in the {overview.sector} sector with potential industry tailwinds")
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
def get_ticker_earnings(
    ticker: str,
    current_user: User = Depends(get_current_user)
):
    ticker_upper = ticker.upper().strip()

    ticker_obj = yf.Ticker(ticker_upper)
    info = ticker_obj.info

    if not info or not info.get("symbol"):
        raise HTTPException(
            status_code=404,
            detail=f"Stock ticker '{ticker_upper}' is invalid or has no data."
        )

    next_date = None
    ts = info.get("earningsTimestamp")
    if ts:
        try:
            next_date = datetime.fromtimestamp(int(ts), tz=timezone.utc).strftime("%b %d, %Y")
        except (ValueError, OSError):
            pass

    revenue_est = safe_float(info.get("totalRevenue")) or (
        safe_float(info.get("revenueEstimate")) if "revenueEstimate" in info else None
    )
    eps_est = safe_float(info.get("epsForward") or info.get("forwardEps"))
    prev_eps = safe_float(info.get("trailingEps"))

    surprise = None
    try:
        earnings = ticker_obj.earnings
        if earnings is not None and not earnings.empty:
            last = earnings.iloc[-1]
            if "surprise" in last:
                surprise = safe_float(last["surprise"])
    except Exception:
        pass

    if not next_date:
        next_date = "Est. within 45 days"

    if eps_est is None and prev_eps:
        eps_est = round(prev_eps * 1.05, 2)

    return EarningsSummary(
        ticker=ticker_upper,
        next_earnings_date=next_date,
        revenue_estimate=revenue_est,
        eps_estimate=eps_est,
        previous_eps=prev_eps,
        earnings_surprise=surprise
    )
