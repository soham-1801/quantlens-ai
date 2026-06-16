import re
from typing import List, Dict, Any, Tuple
from app.schemas.stock import StockNewsArticle

# Try to import PyTorch and Transformers for FinBERT
try:
    import torch
    from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline
    HAS_TRANSFORMERS = True
except ImportError:
    HAS_TRANSFORMERS = False

class SentimentService:
    _pipeline = None
    _load_failed = False

    @classmethod
    def _get_finbert_pipeline(cls):
        if not HAS_TRANSFORMERS or cls._load_failed:
            return None
        
        if cls._pipeline is None:
            try:
                print("Attempting to load FinBERT model (ProsusDE/finbert)...")
                tokenizer = AutoTokenizer.from_pretrained("ProsusDE/finbert")
                model = AutoModelForSequenceClassification.from_pretrained("ProsusDE/finbert")
                cls._pipeline = pipeline("sentiment-analysis", model=model, tokenizer=tokenizer)
                print("FinBERT model loaded successfully.")
            except Exception as e:
                print(f"Failed to load FinBERT model: {e}. Falling back to rule-based NLP analyzer.")
                cls._load_failed = True
                
        return cls._pipeline

    @staticmethod
    def analyze_headline_fallback(headline: str) -> Tuple[str, float]:
        """
        Rule-based financial sentiment analyzer (Lexicon fallback).
        Scans headline for strong financial sentiment indicators.
        Returns Tuple of (label, score) in range [-1.0, 1.0].
        """
        # Convert to lowercase and clean punctuation
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
            "investigation", "weakness", "losses", "drop", "sinks"
        }
        
        pos_count = sum(1 for w in words if w in pos_words)
        neg_count = sum(1 for w in words if w in neg_words)
        
        # Simple scoring formula
        total = pos_count + neg_count
        if total == 0:
            return "neutral", 0.0
            
        score = (pos_count - neg_count) / total
        
        # Scale score slightly based on count density to keep it realistic
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
        """
        Runs sentiment analysis on a news headline.
        Tries to use FinBERT; automatically falls back to rule-based model if unavailable/fails.
        Returns Tuple of (label, score) in range [-1.0, 1.0].
        """
        nlp = cls._get_finbert_pipeline()
        
        if nlp is not None:
            try:
                # FinBERT outputs: [{'label': 'positive', 'score': 0.95}]
                result = nlp(headline)[0]
                label = result["label"].lower()  # 'positive', 'neutral', 'negative'
                confidence = result["score"]
                
                # FinBERT confidence is close to 1.0. We map it to [-1.0, 1.0] range
                if label == "positive":
                    score = confidence
                elif label == "negative":
                    score = -confidence
                else:
                    score = 0.0
                    
                return label, round(score, 4)
            except Exception as e:
                print(f"FinBERT pipeline run error: {e}. Falling back to rule-based analyzer.")
                # Fall through to fallback
        
        return cls.analyze_headline_fallback(headline)

    @classmethod
    def analyze_news_list(cls, articles: List[StockNewsArticle]) -> Tuple[str, float, List[StockNewsArticle]]:
        """
        Analyzes a list of news articles.
        Attaches sentiment labels and scores to each article.
        Returns tuple of (overall_label, overall_score, updated_articles).
        """
        if not articles:
            return "neutral", 0.0, []
            
        total_score = 0.0
        analyzed_articles = []
        
        for article in articles:
            label, score = cls.analyze_headline(article.title)
            
            # Create a copy with sentiment fields
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
        """
        Translates overall sentiment and news details into a readable, quant-grade insights paragraph.
        """
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
