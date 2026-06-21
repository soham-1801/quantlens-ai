import React, { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Plus, Trash2, Loader2, AlertCircle, ExternalLink, Newspaper, Lightbulb, ArrowUp, ArrowDown } from "lucide-react";
import { StockChart } from "../components/StockChart";
import { StockOverview } from "../components/StockOverview";
import { SentimentCards } from "../components/SentimentCards";
import { api } from "../services/api";
import { StockLogo } from "../components/StockLogo";
import { computePerformanceReturns, formatReturn } from "../utils/performance";
import { useWatchlist } from "../context/WatchlistContext";
import { useAuth } from "../context/AuthContext";

const formatMarketCap = (val) => {
  if (!val || !Number.isFinite(val)) return "N/A";
  if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  return `$${val.toLocaleString()}`;
};

const ReturnPill = ({ label, value }) => {
  const isPositive = value !== null && value >= 0;
  const colorClass =
    value === null
      ? "text-gray-400 bg-[#0B0F19]/50 border-[#242D3D]/50"
      : isPositive
        ? "text-emerald-400 bg-emerald-500/5 border-emerald-500/15"
        : "text-red-400 bg-red-500/5 border-red-500/15";

  return (
    <div
      className={`inline-flex items-center gap-2 h-7 px-2.5 rounded-lg border ${colorClass}`}
    >
      <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">
        {label}
      </span>
      <span className="text-[11px] font-extrabold tabular-nums">{formatReturn(value)}</span>
    </div>
  );
};

export const StockDetail = ({ ticker }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [history, setHistory] = useState([]);
  const [performanceHistory, setPerformanceHistory] = useState([]);
  const [sentiment, setSentiment] = useState(null);
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [research, setResearch] = useState(null);
  const [researchLoading, setResearchLoading] = useState(true);
  const [earnings, setEarnings] = useState(null);
  const [earningsLoading, setEarningsLoading] = useState(true);

  const { watchlist, addToWatchlist, removeFromWatchlist } = useWatchlist();
  const isWatchlisted = useMemo(() => {
    return watchlist.some((item) => item.ticker.toUpperCase() === ticker.toUpperCase());
  }, [watchlist, ticker]);

  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [period, setPeriod] = useState("1m");

  const hasSentimentData = sentiment?.articles?.length > 0;

  const sentimentCategories = useMemo(() => {
    if (!hasSentimentData) return null;
    const articles = sentiment.articles;
    const total = articles.length;
    const bullish = articles.filter((a) => a.sentiment_label === "positive").length;
    const neutral = articles.filter((a) => a.sentiment_label === "neutral").length;
    const bearish = articles.filter((a) => a.sentiment_label === "negative").length;
    const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);
    const data = [
      { label: "Bullish", pct: pct(bullish), color: "bg-emerald-500" },
      { label: "Neutral", pct: pct(neutral), color: "bg-gray-500" },
      { label: "Bearish", pct: pct(bearish), color: "bg-red-500" },
    ];
    const top = data.reduce((max, d) => (d.pct > max.pct ? d : max), data[0]);
    return { data, overall: top.label };
  }, [sentiment, hasSentimentData]);

  const performanceReturns = useMemo(
    () => computePerformanceReturns(performanceHistory),
    [performanceHistory]
  );

  const dailyChange = useMemo(() => {
    if (
      overview?.current_price == null ||
      overview?.previous_close == null ||
      overview.previous_close <= 0
    ) {
      return null;
    }
    return ((overview.current_price - overview.previous_close) / overview.previous_close) * 100;
  }, [overview]);

  const goBack = () => {
    window.location.hash = "#/dashboard";
  };

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const NAV_TABS = [
    { id: "section-overview", label: "Overview" },
    { id: "section-news", label: "News" },
    { id: "section-sentiment", label: "Sentiment" },
    { id: "section-ai-research", label: "AI Research" },
    { id: "section-earnings", label: "Earnings" },
  ];

  const fetchStockData = async (signal) => {
    setLoading(true);
    setError("");
    setNewsLoading(true);
    setResearchLoading(true);
    setEarningsLoading(true);
    try {
      const [overviewData, historyData, perfHistoryData, sentimentData, newsData, researchData, earningsData] = await Promise.all([
        api.get(`/stocks/${ticker}/overview`, { signal }),
        api.get(`/stocks/${ticker}/history?period=${period}`, { signal }),
        api.get(`/stocks/${ticker}/history?period=1y`, { signal }),
        api.get(`/insights/${ticker}/sentiment`, { signal }),
        api.get(`/stocks/${ticker}/news`, { signal }),
        api.get(`/insights/${ticker}/research`, { signal }),
        api.get(`/insights/${ticker}/earnings`, { signal }),
      ]);
      setOverview(overviewData);
      setHistory(historyData);
      setPerformanceHistory(perfHistoryData);
      setSentiment(sentimentData);
      setNews(Array.isArray(newsData) ? newsData : []);
      setResearch(researchData);
      setEarnings(earningsData);
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message || "Failed to load stock data. Please verify ticker symbol.");
      }
    } finally {
      setLoading(false);
      setNewsLoading(false);
      setResearchLoading(false);
      setEarningsLoading(false);
    }
  };

  const fetchHistoryOnly = async (signal) => {
    try {
      const historyData = await api.get(`/stocks/${ticker}/history?period=${period}`, { signal });
      setHistory(historyData);
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error(err);
      }
    }
  };

  useEffect(() => {
    if (ticker) {
      const controller = new AbortController();
      fetchStockData(controller.signal);
      return () => controller.abort();
    }
  }, [ticker]);

  useEffect(() => {
    if (overview && overview.ticker) {
      try {
        const userEmail = user ? user.email : "guest";
        const lastViewedKey = `last_viewed_stocks_${userEmail}`;
        const existing = JSON.parse(localStorage.getItem(lastViewedKey) || "[]");
        const filtered = existing.filter((s) => s.ticker.toUpperCase() !== overview.ticker.toUpperCase());
        const updated = [{ ticker: overview.ticker.toUpperCase(), name: overview.name }, ...filtered].slice(0, 5);
        localStorage.setItem(lastViewedKey, JSON.stringify(updated));
      } catch (err) {
        console.error("Failed to save last viewed stock:", err);
      }
    }
  }, [overview, user]);

  useEffect(() => {
    if (ticker && !loading) {
      const controller = new AbortController();
      fetchHistoryOnly(controller.signal);
      return () => controller.abort();
    }
  }, [period]);

  const toggleWatchlist = async () => {
    setWatchlistLoading(true);
    try {
      if (isWatchlisted) {
        await removeFromWatchlist(ticker);
      } else {
        await addToWatchlist(ticker);
      }
    } catch (err) {
      console.error("Watchlist action error:", err);
    } finally {
      setWatchlistLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">
          Analyzing {ticker.toUpperCase()} market indicators...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-4 text-center max-w-md mx-auto px-4">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <h3 className="text-lg font-bold text-gray-200">Data Fetching Error</h3>
        <p className="text-xs text-gray-400 font-light leading-relaxed">{error}</p>
        <button
          onClick={goBack}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs tracking-wider uppercase px-5 py-3 rounded-xl shadow-lg active:scale-98 transition-all flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Go Back to Dashboard
        </button>
      </div>
    );
  }

  const metaParts = [overview?.sector, overview?.industry, overview?.exchange].filter(Boolean);

  const showNav = overview && !loading;

  return (
    <div className="space-y-6 max-w-full">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-[#161B26]/40 border border-[#242D3D]/60 rounded-2xl px-4 py-2.5 backdrop-blur-md" id="section-overview">
        <div className="flex items-start gap-3 min-w-0">
          <button
            onClick={goBack}
            className="flex items-center gap-1 text-[9px] font-bold text-gray-500 hover:text-white uppercase tracking-wider transition-colors shrink-0 mt-1.5"
          >
            <ArrowLeft className="w-3 h-3" /> Back
          </button>

          {overview && (
            <div className="flex items-start gap-2.5 border-l border-[#242D3D] pl-3 min-w-0">
              <StockLogo ticker={overview.ticker} website={overview.website} className="w-9 h-9 shrink-0" />
              <div className="min-w-0 leading-tight">
                <h1 className="text-2xl font-black text-white tracking-tight leading-none">
                  {overview.ticker}
                </h1>
                <p className="text-xs text-gray-300 font-medium mt-0.5 line-clamp-2">{overview.name}</p>
                {metaParts.length > 0 && (
                  <p className="text-[10px] text-gray-500 mt-0.5 truncate" title={metaParts.join(" • ")}>{metaParts.join(" • ")}</p>
                )}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={toggleWatchlist}
          disabled={watchlistLoading}
          className={`flex items-center justify-center gap-2 font-bold text-[10px] tracking-wider uppercase px-4 py-2 rounded-xl active:scale-[0.98] transition-all border w-full lg:w-auto shrink-0 ${
            isWatchlisted
              ? "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/25"
              : "bg-blue-600 hover:bg-blue-500 text-white border-transparent shadow-lg shadow-blue-600/15"
          }`}
        >
          {watchlistLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isWatchlisted ? (
            <>
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove</span>
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" />
              <span>Watchlist</span>
            </>
          )}
        </button>
      </div>

      {/* Section Navigation */}
      {showNav && (
        <div className="sticky top-0 z-40 -mx-6 px-6 bg-[#0B0F19]/90 backdrop-blur-xl border-b border-[#242D3D]/60 py-0">
          <div className="flex items-center gap-1 overflow-x-auto">
            {NAV_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => scrollToSection(tab.id)}
                className="text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:text-gray-200 transition-colors px-3 py-2.5 whitespace-nowrap shrink-0"
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {overview && (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            <div className="bg-[#161B26]/40 border border-[#242D3D]/60 rounded-xl p-2 backdrop-blur-md min-h-[80px]">
              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Price</span>
              <p className="text-sm font-black text-white mt-0.5 tabular-nums">
                {overview.current_price != null && Number.isFinite(overview.current_price) ? `$${overview.current_price.toFixed(2)}` : "N/A"}
              </p>
            </div>

            <div className="bg-[#161B26]/40 border border-[#242D3D]/60 rounded-xl p-2 backdrop-blur-md min-h-[80px]">
              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Daily</span>
              <p
                className={`text-sm font-black mt-0.5 tabular-nums ${
                  dailyChange !== null
                    ? dailyChange >= 0
                      ? "text-emerald-400"
                      : "text-red-400"
                    : "text-gray-400"
                }`}
              >
                {dailyChange !== null && Number.isFinite(dailyChange) ? `${dailyChange >= 0 ? "+" : ""}${dailyChange.toFixed(2)}%` : "N/A"}
              </p>
            </div>

            <div className="bg-[#161B26]/40 border border-[#242D3D]/60 rounded-xl p-2 backdrop-blur-md min-h-[80px]">
              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Mkt Cap</span>
              <p className="text-sm font-black text-white mt-0.5 tabular-nums truncate">
                {formatMarketCap(overview.market_cap)}
              </p>
            </div>

            <div className="bg-[#161B26]/40 border border-[#242D3D]/60 rounded-xl p-2 backdrop-blur-md min-h-[80px]">
              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">P/E</span>
              <p className="text-sm font-black text-white mt-0.5 tabular-nums">
                {overview.pe_ratio != null && Number.isFinite(overview.pe_ratio) ? overview.pe_ratio.toFixed(2) : "N/A"}
              </p>
            </div>

            <div className="bg-[#161B26]/40 border border-[#242D3D]/60 rounded-xl p-2 backdrop-blur-md col-span-1 min-h-[80px]">
              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Sentiment</span>
              {hasSentimentData ? (
                <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                  {(() => {
                    const score = sentiment.overall_sentiment_score;
                    let label = "Neutral";
                    let colorClass = "text-gray-400 bg-gray-500/5 border-gray-500/10";
                    if (score > 0.15) {
                      label = "Bullish";
                      colorClass = "text-emerald-400 bg-emerald-500/5 border-emerald-500/10";
                    } else if (score < -0.15) {
                      label = "Bearish";
                      colorClass = "text-red-400 bg-red-500/5 border-red-500/10";
                    }
                    return (
                      <>
                        <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${colorClass}`}>
                          {label}
                        </span>
                        <span className="text-[10px] text-gray-400 tabular-nums">
                          {Number.isFinite(score) ? `${score > 0 ? "+" : ""}${score.toFixed(2)}` : "N/A"}
                        </span>
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div className="mt-0.5 leading-none">
                  <span className="text-sm font-black text-gray-500 tabular-nums">—</span>
                  <span className="block text-[9px] font-bold uppercase text-gray-500 tracking-wider mt-0.5">
                    No Data
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Performance snapshot panel */}
          <div className="bg-[#161B26]/40 border border-[#242D3D]/60 rounded-xl px-2.5 py-1 backdrop-blur-md flex flex-wrap items-center gap-2">
            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider shrink-0 mr-1">
              Performance
            </span>
            <ReturnPill label="1M" value={performanceReturns.oneMonth} />
            <ReturnPill label="YTD" value={performanceReturns.ytd} />
            <ReturnPill label="52W" value={performanceReturns.fiftyTwoWeek} />
          </div>
        </>
      )}

      {/* Main workspace: chart + news (left) | overview (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-2.5 gap-y-2.5 lg:gap-y-0 items-start">
        {/* Left column: chart (with optional no-news strip inside) + full sentiment when news exists */}
        <div className="lg:col-span-2 min-w-0 flex flex-col gap-2 order-1">
          <StockChart
            history={history}
            period={period}
            onPeriodChange={setPeriod}
          />
          {hasSentimentData && <SentimentCards sentiment={sentiment} />}

          {/* Bottom grid: News + Sentiment Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 mt-4" id="section-news">
            {/* News Section */}
            <div className="bg-[#161B26]/40 border border-[#242D3D]/60 rounded-2xl backdrop-blur-md" id="section-news-card">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-[#242D3D]/40">
                <Newspaper className="w-4 h-4 text-blue-400" />
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">News</h3>
              </div>
              <div className="divide-y divide-[#242D3D]/30">
                {newsLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="px-5 py-3.5 space-y-2">
                      <div className="h-3.5 bg-[#242D3D]/40 rounded animate-pulse w-3/4" />
                      <div className="h-3 bg-[#242D3D]/30 rounded animate-pulse w-1/2" />
                    </div>
                  ))
                ) : news.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 px-5 text-center">
                    <div className="w-12 h-12 rounded-xl bg-[#242D3D]/30 border border-[#242D3D]/60 flex items-center justify-center mb-3">
                      <Newspaper className="w-5 h-5 text-gray-500" />
                    </div>
                    <p className="text-xs text-gray-400 font-semibold mb-1">No recent news coverage</p>
                    <p className="text-[10px] text-gray-500 leading-relaxed max-w-[220px]">
                      We are monitoring this stock for new articles.
                    </p>
                    <p className="text-[9px] text-gray-600 mt-3">
                      Last checked: {new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                ) : (
                  news.slice(0, 10).map((article, idx) => (
                    <a
                      key={idx}
                      href={article.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block px-5 py-3.5 hover:bg-blue-500/5 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-gray-200 group-hover:text-blue-400 transition-colors leading-relaxed line-clamp-2">
                            {article.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] text-gray-500 font-medium">{article.publisher}</span>
                            <span className="text-[8px] text-gray-600">•</span>
                            <span className="text-[10px] text-gray-500 tabular-nums">
                              {article.published_at
                                ? new Date(article.published_at * 1000).toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })
                                : ""}
                            </span>
                          </div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-gray-600 group-hover:text-blue-400 shrink-0 mt-0.5 transition-colors" />
                      </div>
                    </a>
                  ))
                )}
              </div>
            </div>

            {/* Sentiment Overview Card */}
            <div className="bg-[#161B26]/40 border border-[#242D3D]/60 rounded-2xl backdrop-blur-md" id="section-sentiment">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-[#242D3D]/40">
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-emerald-400 via-gray-400 to-red-400" />
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Sentiment Overview</h3>
              </div>
              <div className="p-5">
                {sentiment === null && !hasSentimentData ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="space-y-1.5">
                        <div className="h-3 bg-[#242D3D]/40 rounded animate-pulse w-1/3" />
                        <div className="h-2.5 bg-[#242D3D]/30 rounded animate-pulse w-full" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(() => {
                      const hasData = sentimentCategories !== null;
                      const cats = hasData
                        ? sentimentCategories
                        : {
                            data: [
                              { label: "Bullish", pct: 0, color: "bg-emerald-500" },
                              { label: "Neutral", pct: 0, color: "bg-gray-500" },
                              { label: "Bearish", pct: 0, color: "bg-red-500" },
                            ],
                            overall: "Neutral",
                          };
                      return (
                        <>
                          {/* Overall badge */}
                          <div className="flex items-center justify-center">
                            <span
                              className={`inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-lg border ${
                                cats.overall === "Bullish"
                                  ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                  : cats.overall === "Bearish"
                                    ? "text-red-400 bg-red-500/10 border-red-500/20"
                                    : "text-gray-400 bg-gray-500/10 border-gray-500/20"
                              }`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  cats.overall === "Bullish"
                                    ? "bg-emerald-500"
                                    : cats.overall === "Bearish"
                                      ? "bg-red-500"
                                      : "bg-gray-400"
                                }`}
                              />
                              {cats.overall}
                            </span>
                          </div>

                          {/* Category bars */}
                          {cats.data.map((cat) => (
                            <div key={cat.label}>
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-gray-300 font-medium">{cat.label}</span>
                                <span className="text-gray-400 tabular-nums font-semibold">{cat.pct}%</span>
                              </div>
                              <div className="w-full h-2 bg-[#242D3D]/60 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${cat.color}`}
                                  style={{ width: `${cat.pct}%` }}
                                />
                              </div>
                            </div>
                          ))}

                          {/* No-data message */}
                          {!hasData && (
                            <p className="text-[10px] text-gray-500 font-medium text-center pt-1">
                              No recent news coverage available.
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AI Research Summary */}
          <div className="bg-[#161B26]/40 border border-[#242D3D]/60 rounded-2xl backdrop-blur-md mt-6" id="section-ai-research">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-[#242D3D]/40">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">AI Research Summary</h3>
            </div>
            <div className="p-5">
              {researchLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <div className="h-3 bg-[#242D3D]/40 rounded animate-pulse w-1/4" />
                      <div className="h-3 bg-[#242D3D]/30 rounded animate-pulse w-3/4" />
                      <div className="h-3 bg-[#242D3D]/30 rounded animate-pulse w-2/3" />
                    </div>
                  ))}
                </div>
              ) : !research ? (
                <p className="text-xs text-gray-500 font-medium text-center py-6">AI research summary unavailable.</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-2">Bull Case</h4>
                      <ul className="space-y-1">
                        {research.strengths.map((s, i) => (
                          <li key={i} className="text-xs text-gray-300 flex items-start gap-1.5">
                            <span className="text-emerald-500 mt-0.5 shrink-0">•</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-red-400 mb-2">Bear Case</h4>
                      <ul className="space-y-1">
                        {research.risks.map((r, i) => (
                          <li key={i} className="text-xs text-gray-300 flex items-start gap-1.5">
                            <span className="text-red-500 mt-0.5 shrink-0">•</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-blue-400 mb-2">Catalysts</h4>
                      <ul className="space-y-1">
                        {research.growth_drivers.map((g, i) => (
                          <li key={i} className="text-xs text-gray-300 flex items-start gap-1.5">
                            <span className="text-blue-500 mt-0.5 shrink-0">•</span>
                            <span>{g}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-orange-400 mb-2">Risk Factors</h4>
                      <ul className="space-y-1">
                        <li className="text-xs text-gray-500 italic flex items-start gap-1.5">
                          <span className="text-orange-500 mt-0.5 shrink-0">•</span>
                          <span>Analysis in progress.</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Investment Outlook */}
                  <div className="mt-4 pt-4 border-t border-[#242D3D]/40">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1.5">Investment Outlook</h4>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      {research.strengths.length > research.risks.length
                        ? "Favorable outlook supported by a greater number of positive factors relative to risks."
                        : research.risks.length > research.strengths.length
                          ? "Cautious outlook warranted as risk factors outweigh positive catalysts."
                          : "Balanced outlook with comparable positive and negative factors."}
                    </p>
                  </div>

                  {/* Key Takeaway */}
                  {research.key_takeaway && (
                    <div className="mt-4 pt-4 border-t border-[#242D3D]/40">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1.5">Key Takeaway</h4>
                      <p className="text-xs text-gray-400 leading-relaxed">{research.key_takeaway}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Earnings Intelligence */}
          <div className="bg-[#161B26]/40 border border-[#242D3D]/60 rounded-2xl backdrop-blur-md mt-6" id="section-earnings">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#242D3D]/40">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">$</div>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Earnings Intelligence</h3>
              </div>
              {(() => {
                if (earningsLoading || !earnings) return null;
                const parsed = earnings.next_earnings_date ? new Date(earnings.next_earnings_date) : null;
                const daysUntil = parsed && !isNaN(parsed.getTime())
                  ? Math.ceil((parsed - new Date()) / (1000 * 60 * 60 * 24))
                  : null;
                const badge =
                  daysUntil !== null && daysUntil > 0
                    ? { label: "Upcoming", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" }
                    : daysUntil !== null
                      ? { label: "Reported", cls: "text-gray-400 bg-gray-500/10 border-gray-500/20" }
                      : { label: "Unknown", cls: "text-gray-500 bg-gray-500/5 border-gray-500/10" };
                return (
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${badge.cls}`}>
                    {badge.label}
                  </span>
                );
              })()}
            </div>
            <div className="p-6">
              {earningsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-[#161B26]/40 border border-[#242D3D]/60 rounded-xl p-4 space-y-2">
                      <div className="h-3 bg-[#242D3D]/40 rounded animate-pulse w-3/4" />
                      <div className="h-6 bg-[#242D3D]/30 rounded animate-pulse w-1/2" />
                    </div>
                  ))}
                </div>
              ) : !earnings ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-10 h-10 rounded-xl bg-[#242D3D]/30 border border-[#242D3D]/60 flex items-center justify-center mb-3">
                    <span className="text-sm font-black text-gray-500">$</span>
                  </div>
                  <p className="text-xs text-gray-500 font-medium">Earnings intelligence unavailable.</p>
                </div>
              ) : (
                (() => {
                  const parsed = earnings.next_earnings_date ? new Date(earnings.next_earnings_date) : null;
                  const daysUntil = parsed && !isNaN(parsed.getTime())
                    ? Math.ceil((parsed - new Date()) / (1000 * 60 * 60 * 24))
                    : null;
                  const metrics = [
                    {
                      label: "Days Until Earnings",
                      value: daysUntil !== null
                        ? daysUntil > 0
                          ? `${daysUntil} Days`
                          : daysUntil === 0
                            ? "Today"
                            : "Passed"
                        : "N/A",
                      sub: null,
                    },
                    {
                      label: "Next Earnings Date",
                      value: earnings.next_earnings_date || "N/A",
                      sub: daysUntil !== null && daysUntil > 0
                        ? `Earnings in ${daysUntil} day${daysUntil !== 1 ? "s" : ""}`
                        : null,
                    },
                    {
                      label: "Revenue Estimate",
                      value: earnings.revenue_estimate != null && Number.isFinite(earnings.revenue_estimate)
                        ? `$${(earnings.revenue_estimate / 1e9).toFixed(2)}B`
                        : "N/A",
                      sub: null,
                    },
                    {
                      label: "EPS Estimate",
                      value: earnings.eps_estimate != null && Number.isFinite(earnings.eps_estimate) ? `$${earnings.eps_estimate.toFixed(2)}` : "N/A",
                      sub: null,
                    },
                    {
                      label: "Previous EPS",
                      value: earnings.previous_eps != null && Number.isFinite(earnings.previous_eps) ? `$${earnings.previous_eps.toFixed(2)}` : "N/A",
                      sub: null,
                    },
                    {
                      label: "Earnings Surprise",
                      value: earnings.earnings_surprise != null && Number.isFinite(earnings.earnings_surprise)
                        ? `${earnings.earnings_surprise >= 0 ? "+" : ""}${earnings.earnings_surprise.toFixed(2)}`
                        : "N/A",
                      sub: null,
                      surprise: earnings.earnings_surprise,
                    },
                  ];
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {metrics.map((m) => (
                        <div
                          key={m.label}
                          className="bg-[#161B26]/40 border border-[#242D3D]/60 rounded-xl p-4 flex flex-col justify-between h-[88px]"
                        >
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{m.label}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            {m.surprise != null && (
                              <span className={m.surprise > 0 ? "text-emerald-400" : "text-red-400"}>
                                {m.surprise > 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                              </span>
                            )}
                            <p
                              className={`text-lg font-black tabular-nums leading-tight ${
                                m.surprise != null
                                  ? m.surprise > 0
                                    ? "text-emerald-400"
                                    : m.surprise < 0
                                      ? "text-red-400"
                                      : "text-gray-400"
                                  : "text-white"
                              }`}
                            >
                              {m.value}
                            </p>
                          </div>
                          {m.sub && (
                            <p className="text-[10px] text-emerald-400 font-semibold mt-1">{m.sub}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>

        {/* Right column: overview sidebar — sticky to chart top, natural height */}
        <div className="lg:col-span-1 min-w-0 order-2 lg:sticky lg:top-0 z-10">
          <StockOverview overview={overview} />
        </div>
      </div>
    </div>
  );
};
