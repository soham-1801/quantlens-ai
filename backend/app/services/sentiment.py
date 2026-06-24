import re
from typing import List, Tuple
from app.schemas.stock import StockNewsArticle

try:
    from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
    _vader = SentimentIntensityAnalyzer()
    _HAS_VADER = True
except ImportError:
    _HAS_VADER = False

class SentimentService:

    @staticmethod
    def analyze_headline_fallback(headline: str) -> Tuple[str, float]:
        text = re.sub(r'[^\w\s]', '', headline.lower())
        words = text.split()
        pos_words = {
            "profit", "growth", "upbeat", "surge", "upgrade", "gain", "higher", "exceed",
            "outperform", "boost", "bullish", "buy", "success", "revenue", "expansion",
            "recordhigh", "soar", "dividend", "positive", "beat", "innovative", "expanding",
            "jump", "climb", "rally", "recovery", "optimistic", "strong", "gains"
        }
        neg_words = {
            "loss", "decline", "drop", "plunge", "downgrade", "fall", "lower", "miss",
            "underperform", "cut", "bearish", "sell", "fail", "debt", "deficit", "shrink",
            "layoff", "negative", "lawsuit", "scandal", "warn", "slump", "slide", "crash",
            "investigation", "weakness", "losses", "sinks"
        }
        pos_count = sum(1 for w in words if w in pos_words)
        neg_count = sum(1 for w in words if w in neg_words)
        total = pos_count + neg_count
        if total == 0:
            return "neutral", 0.0
        score = (pos_count - neg_count) / total
        scaled_score = score * min(1.0, total * 0.4)
        if scaled_score > 0.15:
            label = "positive"
        elif scaled_score < -0.15:
            label = "negative"
        else:
            label = "neutral"
        return label, round(scaled_score, 4)

    @classmethod
    def analyze_headline(cls, headline: str) -> Tuple[str, float]:
        if _HAS_VADER:
            vs = _vader.polarity_scores(headline)
            compound = vs["compound"]
            if compound >= 0.5:
                return "positive", round(compound, 4)
            elif compound >= 0.15:
                return "positive", round(compound, 4)
            elif compound > -0.15:
                return "neutral", round(compound, 4)
            elif compound > -0.5:
                return "negative", round(compound, 4)
            else:
                return "negative", round(compound, 4)
        return cls.analyze_headline_fallback(headline)

    @classmethod
    def analyze_news_list(cls, articles: List[StockNewsArticle]) -> Tuple[str, float, List[StockNewsArticle]]:
        if not articles:
            return "neutral", 0.0, []
        total_score = 0.0
        analyzed_articles = []
        for article in articles:
            label, score = cls.analyze_headline(article.title)
            analyzed_articles.append(StockNewsArticle(
                title=article.title,
                publisher=article.publisher,
                link=article.link,
                published_at=article.published_at,
                sentiment_label=label,
                sentiment_score=score
            ))
            total_score += score
        avg_score = total_score / len(articles)
        if avg_score > 0.15:
            overall_label = "positive"
        elif avg_score < -0.15:
            overall_label = "negative"
        else:
            overall_label = "neutral"
        return overall_label, round(avg_score, 4), analyzed_articles

    @staticmethod
    def generate_ai_insights_summary(ticker: str, label: str, score: float, articles: List[StockNewsArticle]) -> str:
        if not articles:
            return f"No recent headlines were found for {ticker.upper()}. Market sentiment remains neutral by default."
        pos_headlines = sum(1 for a in articles if a.sentiment_label == "positive")
        neg_headlines = sum(1 for a in articles if a.sentiment_label == "negative")
        total = len(articles)
        sentiment_descr = "neutral to flat"
        action_words = "holding pattern"
        if label == "positive":
            sentiment_descr = "highly bullish"
            action_words = "accumulation / long interest"
        elif label == "negative":
            sentiment_descr = "bearish"
            action_words = "selling pressure / risk-off posture"
        summary = (
            f"QuantLens AI analyzed {total} recent news headlines for {ticker.upper()}. "
            f"The NLP sentiment scoring engine indicates a {sentiment_descr} outlook with an aggregate score of {score:+.2f}. "
            f"We tracked {pos_headlines} positive indicator(s) and {neg_headlines} negative indicator(s). "
            f"This suggests market participants are showing a bias towards {action_words}. "
            f"Traders should monitor key price levels and follow upcoming corporate announcements to confirm momentum direction."
        )
        return summary
