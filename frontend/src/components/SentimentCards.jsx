import React from "react";
import { MessageSquare, ExternalLink, Activity, ArrowUpRight, ArrowDownRight } from "lucide-react";

export const SentimentCards = ({ sentiment }) => {
  if (!sentiment) return null;

  const getSentimentConfig = (score) => {
    if (score > 0.15) {
      return {
        label: "Bullish / Positive",
        color: "text-emerald-400",
        bg: "bg-emerald-500/10 border-emerald-500/20",
        gaugeColor: "bg-emerald-500",
        gaugePosition: `${((score + 1) / 2) * 100}%`
      };
    } else if (score < -0.15) {
      return {
        label: "Bearish / Negative",
        color: "text-red-400",
        bg: "bg-red-500/10 border-red-500/20",
        gaugeColor: "bg-red-500",
        gaugePosition: `${((score + 1) / 2) * 100}%`
      };
    } else {
      return {
        label: "Neutral / Flat",
        color: "text-gray-400",
        bg: "bg-gray-500/10 border-gray-500/20",
        gaugeColor: "bg-gray-400",
        gaugePosition: "50%"
      };
    }
  };

  const config = getSentimentConfig(sentiment.overall_sentiment_score);

  const formatTime = (timestamp) => {
    try {
      const date = new Date(timestamp * 1000);
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return "N/A";
    }
  };

  const calculateTrend = () => {
    if (!sentiment.articles || sentiment.articles.length < 2) {
      return {
        trendLabel: "Stable / Flat",
        trendDelta: 0,
        recentAvg: 0,
        olderAvg: 0,
        TrendIcon: Activity,
        trendColorClass: "bg-gray-500/5 text-gray-400 border-gray-500/10"
      };
    }

    const sorted = [...sentiment.articles].sort((a, b) => a.published_at - b.published_at);
    const half = Math.ceil(sorted.length / 2);
    const older = sorted.slice(0, half);
    const recent = sorted.slice(half);

    const olderAvg = older.reduce((sum, a) => sum + (a.sentiment_score || 0), 0) / older.length;
    const recentAvg = recent.reduce((sum, a) => sum + (a.sentiment_score || 0), 0) / recent.length;
    const trendDelta = recentAvg - olderAvg;

    let trendLabel = "Stable / Flat";
    let TrendIcon = Activity;
    let trendColorClass = "bg-gray-500/5 text-gray-400 border-gray-500/10";

    if (trendDelta > 0.05) {
      trendLabel = "Improving / Upward";
      TrendIcon = ArrowUpRight;
      trendColorClass = "bg-emerald-500/5 text-emerald-400 border-emerald-500/10";
    } else if (trendDelta < -0.05) {
      trendLabel = "Weakening / Downward";
      TrendIcon = ArrowDownRight;
      trendColorClass = "bg-red-500/5 text-red-400 border-red-500/10";
    }

    return { trendLabel, trendDelta, recentAvg, olderAvg, TrendIcon, trendColorClass };
  };

  const { trendLabel, trendDelta, recentAvg, olderAvg, TrendIcon, trendColorClass } = calculateTrend();

  const highlightSummary = (text) => {
    if (!text) return null;
    const rules = [
      { pattern: /(\d+ recent news headlines)/gi, cls: "text-blue-400 font-extrabold" },
      { pattern: /(\d+ positive indicator\(s\))/gi, cls: "text-emerald-400 font-extrabold" },
      { pattern: /(\d+ negative indicator\(s\))/gi, cls: "text-red-400 font-extrabold" },
      { pattern: /([+-]\d+\.\d{2})/g, cls: "font-extrabold text-white bg-[#0B0F19] px-1.5 py-0.5 rounded border border-[#242D3D]" },
      { pattern: /(highly bullish|bullish)/gi, cls: "text-emerald-400 font-extrabold uppercase text-[10px] tracking-wider bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20" },
      { pattern: /(bearish)/gi, cls: "text-red-400 font-extrabold uppercase text-[10px] tracking-wider bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20" },
      { pattern: /(neutral to flat|neutral)/gi, cls: "text-gray-400 font-extrabold uppercase text-[10px] tracking-wider bg-gray-500/10 px-1.5 py-0.5 rounded border border-gray-500/20" },
    ];
    let elements = [{ text, highlighted: false }];
    for (const { pattern, cls } of rules) {
      const next = [];
      for (const el of elements) {
        if (el.highlighted) { next.push(el); continue; }
        const parts = [];
        let lastIdx = 0;
        let match;
        const re = new RegExp(pattern.source, pattern.flags);
        while ((match = re.exec(el.text)) !== null) {
          if (match.index > lastIdx) parts.push({ text: el.text.slice(lastIdx, match.index), highlighted: false });
          parts.push({ text: match[1] || match[0], highlighted: true, cls });
          lastIdx = match.index + match[0].length;
        }
        if (lastIdx < el.text.length) parts.push({ text: el.text.slice(lastIdx), highlighted: false });
        next.push(...parts);
      }
      elements = next;
      if (elements.length > 200) break;
    }
    return elements.map((el, i) =>
      el.highlighted
        ? React.createElement("span", { key: i, className: el.cls }, el.text)
        : el.text
    );
  };

  const hasNews = sentiment.articles && sentiment.articles.length > 0;

  // SentimentCards only renders when there are articles — empty state is omitted.
  if (!hasNews) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="bg-[#161B26]/40 border border-[#242D3D]/60 rounded-3xl p-4 md:p-5 backdrop-blur-md flex flex-col gap-4">
        <h3 className="text-xs text-gray-300 font-bold uppercase tracking-wider flex items-center gap-1.5 shrink-0 border-b border-[#242D3D]/40 pb-3">
          <Activity className="w-3.5 h-3.5 text-blue-500" /> AI Sentiment Analysis
        </h3>

        <div className="space-y-4 border-b border-[#242D3D]/20 pb-4">
          <div>
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">NLP Sentiment Score</span>
            <div className="flex items-baseline gap-2.5 mt-1">
              <span className={`text-3xl font-black ${config.color}`}>
                {Number.isFinite(sentiment.overall_sentiment_score) ? `${sentiment.overall_sentiment_score > 0 ? "+" : ""}${sentiment.overall_sentiment_score.toFixed(2)}` : "N/A"}
              </span>
              <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded border ${config.bg}`}>
                {sentiment.overall_sentiment_label}
              </span>
            </div>
            <p className="text-[10px] text-gray-500 font-medium mt-1">
              FinBERT scored headline aggregate sentiment
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="h-2 w-full bg-[#0B0F19] rounded-full relative overflow-visible border border-[#242D3D]/30">
              <div
                className={`h-4 w-4 rounded-full border-2 border-white ${config.gaugeColor} absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-500 shadow-md`}
                style={{ left: config.gaugePosition }}
              />
            </div>
            <div className="flex justify-between text-[8px] text-gray-500 font-bold uppercase tracking-widest">
              <span>Bearish (-1.0)</span>
              <span>Neutral (0.0)</span>
              <span>Bullish (+1.0)</span>
            </div>
          </div>
        </div>

        <div className="border-b border-[#242D3D]/20 pb-4">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Sentiment Trend</span>
          <div className="flex items-center gap-3 mt-2">
            <div className={`p-2.5 rounded-2xl border ${trendColorClass} shrink-0`}>
              <TrendIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-black text-white">{trendLabel}</p>
              <p className="text-[10px] text-gray-400 font-light mt-0.5">
                NLP Shift: {Number.isFinite(trendDelta) ? `${trendDelta >= 0 ? "+" : ""}${trendDelta.toFixed(2)}` : "N/A"}
              </p>
            </div>
          </div>
          <div className="mt-3 space-y-1 text-[10px] text-gray-400 font-light leading-relaxed">
            <div className="flex justify-between">
              <span>Recent Headlines Avg:</span>
              <span className="font-bold text-white">{Number.isFinite(recentAvg) ? recentAvg.toFixed(2) : "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span>Older Headlines Avg:</span>
                <span className="font-bold text-white">{Number.isFinite(olderAvg) ? olderAvg.toFixed(2) : "N/A"}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-[10px] text-gray-300 font-bold uppercase tracking-wider">AI Insights & Summary</span>
          <div className="bg-blue-600/5 border border-blue-500/10 p-4 rounded-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
            <p className="text-xs text-gray-300 font-light leading-relaxed pl-1">
              {highlightSummary(sentiment.summary_paragraph)}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-[#161B26]/40 border border-[#242D3D]/60 rounded-3xl p-4 md:p-5 backdrop-blur-md flex flex-col gap-4">
        <h3 className="text-xs text-gray-300 font-bold uppercase tracking-wider flex items-center gap-1.5 shrink-0 border-b border-[#242D3D]/40 pb-3">
          <MessageSquare className="w-3.5 h-3.5 text-blue-500" /> News & Scored Headlines
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0 border-b border-[#242D3D]/20 pb-4">
          {(() => {
            const bullishArticles = sentiment.articles.filter(a => (a.sentiment_score || 0) > 0.15);
            const topBullish = bullishArticles.length > 0
              ? bullishArticles.reduce((max, a) => (a.sentiment_score > max.sentiment_score ? a : max), bullishArticles[0])
              : null;

            return (
              <div className="bg-[#0B0F19]/40 border border-[#242D3D]/40 rounded-2xl p-3 flex flex-col justify-between min-h-[100px] relative overflow-hidden group">
                <div className="absolute -top-10 -right-10 w-20 h-20 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors pointer-events-none"></div>
                <div>
                  <div className="flex items-center justify-between gap-1 border-b border-[#242D3D]/30 pb-1.5">
                    <span className="text-[9px] text-emerald-400 font-extrabold uppercase tracking-wider bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <ArrowUpRight className="w-2.5 h-2.5" /> Bullish
                    </span>
                    {topBullish && (
                      <span className="text-[9px] font-black text-emerald-400">
                        +{Number.isFinite(topBullish.sentiment_score) ? topBullish.sentiment_score.toFixed(2) : "N/A"}
                      </span>
                    )}
                  </div>
                  {topBullish ? (
                    <a
                      href={topBullish.link}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-[11px] font-bold text-gray-200 hover:text-blue-400 transition-colors mt-2 leading-snug line-clamp-2"
                    >
                      {topBullish.title}
                    </a>
                  ) : (
                    <p className="text-[11px] text-gray-500 font-light mt-2">No bullish headlines tracked.</p>
                  )}
                </div>
                {topBullish && (
                  <div className="text-[8px] text-gray-500 font-medium mt-2 flex justify-between">
                    <span className="truncate max-w-[80px]">{topBullish.publisher}</span>
                    <span>{formatTime(topBullish.published_at)}</span>
                  </div>
                )}
              </div>
            );
          })()}

          {(() => {
            const bearishArticles = sentiment.articles.filter(a => (a.sentiment_score || 0) < -0.15);
            const topBearish = bearishArticles.length > 0
              ? bearishArticles.reduce((min, a) => (a.sentiment_score < min.sentiment_score ? a : min), bearishArticles[0])
              : null;

            return (
              <div className="bg-[#0B0F19]/40 border border-[#242D3D]/40 rounded-2xl p-3 flex flex-col justify-between min-h-[100px] relative overflow-hidden group">
                <div className="absolute -top-10 -right-10 w-20 h-20 bg-red-500/5 rounded-full blur-2xl group-hover:bg-red-500/10 transition-colors pointer-events-none"></div>
                <div>
                  <div className="flex items-center justify-between gap-1 border-b border-[#242D3D]/30 pb-1.5">
                    <span className="text-[9px] text-red-400 font-extrabold uppercase tracking-wider bg-red-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <ArrowDownRight className="w-2.5 h-2.5" /> Bearish
                    </span>
                    {topBearish && (
                      <span className="text-[9px] font-black text-red-400">
                        {Number.isFinite(topBearish.sentiment_score) ? topBearish.sentiment_score.toFixed(2) : "N/A"}
                      </span>
                    )}
                  </div>
                  {topBearish ? (
                    <a
                      href={topBearish.link}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-[11px] font-bold text-gray-200 hover:text-blue-400 transition-colors mt-2 leading-snug line-clamp-2"
                    >
                      {topBearish.title}
                    </a>
                  ) : (
                    <p className="text-[11px] text-gray-500 font-light mt-2">No bearish headlines tracked.</p>
                  )}
                </div>
                {topBearish && (
                  <div className="text-[8px] text-gray-500 font-medium mt-2 flex justify-between">
                    <span className="truncate max-w-[80px]">{topBearish.publisher}</span>
                    <span>{formatTime(topBearish.published_at)}</span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        <div className="min-h-0 pr-0">
          <div className="divide-y divide-[#242D3D]/40 text-[11px]">
            {sentiment.articles.map((article, idx) => {
              const articleConfig = getSentimentConfig(article.sentiment_score || 0.0);
              return (
                <div key={idx} className="py-2.5 flex items-start justify-between gap-4 group hover:bg-white/5 px-2 rounded-xl transition-colors">
                  <div className="space-y-0.5 min-w-0">
                    <a
                      href={article.link}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-gray-200 group-hover:text-blue-400 transition-colors flex items-start gap-1 leading-snug"
                    >
                      <span className="line-clamp-2">{article.title}</span>
                      <ExternalLink className="w-2.5 h-2.5 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[9px] text-gray-500 font-medium">
                      <span>Publisher: <span className="text-gray-400 font-semibold">{article.publisher}</span></span>
                      <span>•</span>
                      <span>{formatTime(article.published_at)}</span>
                    </div>
                  </div>

                  <span className={`text-[8px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border h-fit shrink-0 ${articleConfig.bg}`}>
                    {article.sentiment_label || "neutral"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
