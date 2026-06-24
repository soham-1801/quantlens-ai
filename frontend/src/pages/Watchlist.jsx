import React, { useState, useMemo } from "react";
import {
  Star,
  ArrowUpRight,
  ArrowDownRight,
  ArrowUpDown,
  RefreshCcw,
  Trash2,
  TrendingUp,
  Loader2,
  BarChart3,
  DollarSign,
  Search,
  TrendingDown,
  PieChart,
  Shield,
  Activity,
  AlertTriangle,
  Lightbulb,
  Bell,
} from "lucide-react";
import { useWatchlist } from "../context/WatchlistContext";
import { StockLogo } from "../components/StockLogo";
import { formatPrice, formatMarketCap, getUSDEquivalent } from "../utils/format";

const formatVolume = (val) => {
  if (val == null || !Number.isFinite(val)) return "N/A";
  if (val < 0) return "N/A";
  if (val === 0) return "0";
  if (val >= 1e9) return `${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `${(val / 1e3).toFixed(0)}K`;
  return val.toLocaleString();
};


const formatTimestamp = (ts) => {
  if (!ts) return "N/A";
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const scoreValuation = (s) => {
  const pe = s.pe_ratio;
  if (pe == null) return 10;
  if (pe <= 0) return 0;
  if (pe > 50) return 20;
  if (pe > 30) return 40;
  if (pe > 20) return 60;
  if (pe > 10) return 80;
  return 100;
};

const scoreProfitability = (s) => {
  const eps = getUSDEquivalent(s.eps, s.currency, s.ticker);
  if (eps == null) return 40;
  if (eps > 5) return 90;
  if (eps > 2) return 70;
  if (eps > 0) return 50;
  return 30;
};

const scoreStability = (s) => {
  const b = s.beta;
  if (b == null) return 50;
  if (b >= 0.8 && b <= 1.5) return 90;
  if (b >= 0.5 && b < 0.8) return 70;
  if (b > 1.5 && b <= 2.5) return 50;
  return 30;
};

const scoreIncome = (s) => {
  const dy = s.dividend_yield;
  if (dy == null) return 30;
  if (dy > 0.03) return 90;
  if (dy > 0.02) return 70;
  if (dy > 0.01) return 50;
  return 30;
};

const scoreScale = (s) => {
  const mc = getUSDEquivalent(s.market_cap, s.currency, s.ticker);
  if (mc == null) return 30;
  if (mc > 100e9) return 90;
  if (mc > 10e9) return 70;
  if (mc > 1e9) return 50;
  return 30;
};

const computeWatchlistScore = (s) => {
  const val = scoreValuation(s) * 0.30;
  const profit = scoreProfitability(s) * 0.25;
  const stab = scoreStability(s) * 0.20;
  const inc = scoreIncome(s) * 0.10;
  const scale = scoreScale(s) * 0.15;
  return Math.max(0, Math.min(100, Math.round(val + profit + stab + inc + scale)));
};

const focusSearchBar = () => {
  const searchInput = document.querySelector('input[placeholder="Search stocks..."]');
  if (searchInput) {
    searchInput.focus();
    searchInput.scrollIntoView({ behavior: "smooth", block: "center" });
  } else {
    window.location.hash = "#/dashboard";
  }
};

const SORT_COLUMNS = [
  { key: "ticker", label: "Ticker", numeric: false, hide: "" },
  { key: "company", label: "Company", numeric: false, hide: "hidden sm:table-cell" },
  { key: "price", label: "Price", numeric: true, hide: "" },
  { key: "change", label: "Change", numeric: true, hide: "" },
  { key: "marketCap", label: "Mkt Cap", numeric: true, hide: "hidden md:table-cell" },
  { key: "volume", label: "Volume", numeric: true, hide: "hidden lg:table-cell" },
];

export const Watchlist = () => {
  const { watchlist, loading, removeFromWatchlist, refreshItem } = useWatchlist();
  const [refreshing, setRefreshing] = useState("");
  const [removing, setRemoving] = useState("");
  const [sortKey, setSortKey] = useState("added_at");
  const [sortDir, setSortDir] = useState("desc");

  const handleRefresh = async (e, ticker) => {
    e.stopPropagation();
    setRefreshing(ticker);
    await refreshItem(ticker);
    setRefreshing("");
  };

  const handleRemove = async (e, ticker) => {
    e.stopPropagation();
    setRemoving(ticker);
    try {
      await removeFromWatchlist(ticker);
    } catch (err) {
      console.error("Failed to remove from watchlist:", err);
    } finally {
      setRemoving("");
    }
  };

  const navigateToStock = (ticker) => {
    window.location.hash = `#/stock/${ticker.toUpperCase()}`;
  };

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "added_at" ? "desc" : "asc");
    }
  };

  const sorted = useMemo(() => {
    const list = [...watchlist];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "ticker":
          cmp = (a.ticker || "").localeCompare(b.ticker || "");
          break;
        case "company":
          cmp = (a.company_name || "").localeCompare(b.company_name || "");
          break;
        case "price":
          cmp = (a.current_price ?? 0) - (b.current_price ?? 0);
          break;
        case "change":
          cmp = (a.price_change_percent ?? 0) - (b.price_change_percent ?? 0);
          break;
        case "marketCap":
          cmp = (a.market_cap ?? 0) - (b.market_cap ?? 0);
          break;
        case "volume":
          cmp = (a.volume ?? 0) - (b.volume ?? 0);
          break;
        default: {
          const dateA = new Date(a.added_at || 0);
          const dateB = new Date(b.added_at || 0);
          cmp = dateA - dateB;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [watchlist, sortKey, sortDir]);

  const getSector = (item) => {
    const raw = item.sector;
    const result = raw && raw.trim() ? raw.trim() : "Unclassified";
    return result;
  };

  const analytics = useMemo(() => {
    const changes = watchlist
      .map((item) => item.price_change_percent)
      .filter((c) => c != null);
    const avgChange =
      changes.length > 0
        ? changes.reduce((a, b) => a + b, 0) / changes.length
        : null;

    // Group portfolio value and market cap by currency
    const portfolioTotals = {};
    const marketCapTotals = {};
    watchlist.forEach((item) => {
      const code = item.currency || (item.ticker.endsWith(".NS") || item.ticker.endsWith(".BO") ? "INR" : "USD");
      portfolioTotals[code] = (portfolioTotals[code] || 0) + (item.current_price || 0);
      marketCapTotals[code] = (marketCapTotals[code] || 0) + (item.market_cap || 0);
    });

    const formatGrouped = (totals, isMarketCap = false) => {
      const entries = Object.entries(totals);
      if (entries.length === 0) return "N/A";
      return entries
        .map(([code, value]) => {
          if (isMarketCap) {
            return formatMarketCap(value, code);
          } else {
            return formatPrice(value, code);
          }
        })
        .join(" + ");
    };

    const portfolioValueStr = formatGrouped(portfolioTotals, false);
    const totalMarketCapStr = formatGrouped(marketCapTotals, true);

    const lastUpdated = watchlist.reduce((latest, item) => {
      const ts = item.updated_at || item.added_at;
      return ts && (!latest || new Date(ts) > new Date(latest)) ? ts : latest;
    }, null);

    const topGainer = (() => {
      const withChanges = watchlist
        .map((item) => ({ item, change: item.price_change_percent }))
        .filter((x) => x.change != null)
        .sort((a, b) => b.change - a.change);
      return withChanges.length > 0 ? withChanges[0] : null;
    })();

    const topLoser = (() => {
      const withChanges = watchlist
        .map((item) => ({ item, change: item.price_change_percent }))
        .filter((x) => x.change != null)
        .sort((a, b) => a.change - b.change);
      return withChanges.length > 0 ? withChanges[0] : null;
    })();

    const sectorMap = {};
    watchlist.forEach((item) => {
      const sector = getSector(item);
      if (!sectorMap[sector]) sectorMap[sector] = { sector, count: 0, marketCap: 0 };
      sectorMap[sector].count++;
      sectorMap[sector].marketCap += getUSDEquivalent(item.market_cap, item.currency, item.ticker) || 0;
    });
    const sectorData = Object.values(sectorMap).sort((a, b) => b.count - a.count);

    if (watchlist.length === 0) {
      return {
        changes, avgChange, totalMarketCap: 0, portfolioValue: 0,
        totalMarketCapStr: "N/A", portfolioValueStr: "N/A", lastUpdated,
        topGainer, topLoser, sectorData,
        grade: "N/A",
        avgScore: 0,
        avgValuation: 0,
        avgProfitability: 0,
        avgStability: 0,
        avgIncome: 0,
        avgScale: 0,
        diversificationScore: 0,
        riskLabel: "Unknown",
        riskColor: "text-gray-500",
        riskBg: "bg-gray-500/10",
        riskBorder: "border-gray-500/20",
        largestSector: null,
        largestSectorPct: 0,
        isConcentrated: false,
        insight: "Add stocks to begin analysis.",
      };
    }

    const scores = watchlist.map((i) => computeWatchlistScore(i));
    const avgScore = scores.reduce((s, v) => s + v, 0) / scores.length;

    const avgValuation = Math.round(watchlist.reduce((s, i) => s + scoreValuation(i), 0) / watchlist.length);
    const avgProfitability = Math.round(watchlist.reduce((s, i) => s + scoreProfitability(i), 0) / watchlist.length);
    const avgStability = Math.round(watchlist.reduce((s, i) => s + scoreStability(i), 0) / watchlist.length);
    const avgIncome = Math.round(watchlist.reduce((s, i) => s + scoreIncome(i), 0) / watchlist.length);
    const avgScale = Math.round(watchlist.reduce((s, i) => s + scoreScale(i), 0) / watchlist.length);

    let grade;
    if (avgScore >= 85) grade = "A";
    else if (avgScore >= 70) grade = "B";
    else if (avgScore >= 55) grade = "C";
    else grade = "D";

    const classifiedCaps = {};
    watchlist.forEach((item) => {
      const sector = getSector(item);
      if (sector === "Unclassified") return;
      const mc = getUSDEquivalent(item.market_cap, item.currency, item.ticker) || 0;
      if (mc <= 0) return;
      classifiedCaps[sector] = (classifiedCaps[sector] || 0) + mc;
    });
    const classifiedEntries = Object.entries(classifiedCaps);
    const totalClassifiedCap = classifiedEntries.reduce((s, [, v]) => s + v, 0);

    let diversificationScore;
    if (classifiedEntries.length === 0 || totalClassifiedCap <= 0) {
      diversificationScore = 0;
    } else {
      classifiedEntries.sort((a, b) => b[1] - a[1]);
      const largestClassifiedPct = classifiedEntries[0][1] / totalClassifiedCap;
      const classifiedCount = classifiedEntries.length;
      if (classifiedCount >= 4 && largestClassifiedPct < 0.35) {
        diversificationScore = 100;
      } else if (classifiedCount >= 3 && largestClassifiedPct < 0.50) {
        diversificationScore = 75;
      } else if (classifiedCount >= 2 && largestClassifiedPct < 0.70) {
        diversificationScore = 50;
      } else {
        diversificationScore = 25;
      }
    }

    const betas = watchlist.map((i) => i.beta).filter((b) => b != null);
    let riskLabel, riskColor, riskBg, riskBorder;
    if (betas.length > 0) {
      const sortedBetas = [...betas].sort((a, b) => a - b);
      const mid = Math.floor(sortedBetas.length / 2);
      const medianBeta = sortedBetas.length % 2 === 0
        ? (sortedBetas[mid - 1] + sortedBetas[mid]) / 2
        : sortedBetas[mid];
      if (medianBeta < 1.0) {
        riskLabel = "Low Risk";
        riskColor = "text-emerald-400";
        riskBg = "bg-emerald-500/10";
        riskBorder = "border-emerald-500/20";
      } else if (medianBeta <= 1.5) {
        riskLabel = "Medium Risk";
        riskColor = "text-amber-400";
        riskBg = "bg-amber-500/10";
        riskBorder = "border-amber-500/20";
      } else {
        riskLabel = "High Risk";
        riskColor = "text-red-400";
        riskBg = "bg-red-500/10";
        riskBorder = "border-red-500/20";
      }
    } else {
      const dailyChanges = watchlist.map((i) => Math.abs(i.price_change_percent || 0)).filter((c) => c > 0);
      if (dailyChanges.length === 0) {
        riskLabel = "Unknown";
        riskColor = "text-gray-500";
        riskBg = "bg-gray-500/10";
        riskBorder = "border-gray-500/20";
      } else {
        const sortedChanges = [...dailyChanges].sort((a, b) => a - b);
        const mid = Math.floor(sortedChanges.length / 2);
        const medianVol = sortedChanges.length % 2 === 0
          ? (sortedChanges[mid - 1] + sortedChanges[mid]) / 2
          : sortedChanges[mid];
        if (medianVol < 1.5) {
          riskLabel = "Low Risk";
          riskColor = "text-emerald-400";
          riskBg = "bg-emerald-500/10";
          riskBorder = "border-emerald-500/20";
        } else if (medianVol < 3.0) {
          riskLabel = "Medium Risk";
          riskColor = "text-amber-400";
          riskBg = "bg-amber-500/10";
          riskBorder = "border-amber-500/20";
        } else {
          riskLabel = "High Risk";
          riskColor = "text-red-400";
          riskBg = "bg-red-500/10";
          riskBorder = "border-red-500/20";
        }
      }
    }

    const sectorCaps = {};
    watchlist.forEach((i) => {
      const sector = getSector(i);
      sectorCaps[sector] = (sectorCaps[sector] || 0) + (getUSDEquivalent(i.market_cap, i.currency, i.ticker) || 0);
    });
    const totalCap = watchlist.reduce((s, i) => s + (getUSDEquivalent(i.market_cap, i.currency, i.ticker) || 0), 0);
    let largestSector = null;
    let largestSectorPct = 0;
    for (const [sector, cap] of Object.entries(sectorCaps)) {
      const pct = totalCap > 0 ? (cap / totalCap) * 100 : 0;
      if (pct > largestSectorPct) {
        largestSectorPct = pct;
        largestSector = sector;
      }
    }
    const isConcentrated = largestSectorPct > 60;

    let insight;
    if (isConcentrated) {
      insight = `${largestSector} concentration exceeds 60%, increasing sector-specific risk.`;
    } else if (diversificationScore >= 75) {
      const sc = classifiedEntries.length;
      if (riskLabel === "Low Risk" || riskLabel === "Medium Risk") {
        insight = `Portfolio is diversified across ${sc} sectors with moderate volatility.`;
      } else {
        insight = `Portfolio is diversified across ${sc} sectors with elevated volatility.`;
      }
    } else {
      const sc = classifiedEntries.length;
      if (riskLabel === "Low Risk") {
        insight = `Portfolio spans ${sc} sectors; adding more could reduce concentration risk.`;
      } else {
        insight = `Portfolio spans ${sc} sectors with elevated volatility; consider hedging strategies.`;
      }
    }

    return {
      changes, avgChange, totalMarketCap: totalCap, portfolioValue: 0,
      totalMarketCapStr, portfolioValueStr, lastUpdated,
      topGainer, topLoser, sectorData,
      grade,
      avgScore: Math.round(avgScore),
      avgValuation,
      avgProfitability,
      avgStability,
      avgIncome,
      avgScale,
      diversificationScore,
      riskLabel,
      riskColor,
      riskBg,
      riskBorder,
      largestSector,
      largestSectorPct,
      isConcentrated,
      insight,
    };
  }, [watchlist]);

  const alerts = useMemo(() => {
    const result = [];
    for (const item of watchlist) {
      const change = item.price_change_percent;
      if (change != null && change > 5) {
        result.push({
          type: "PRICE MOMENTUM",
          ticker: item.ticker,
          explanation: `${item.ticker} surged ${Number.isFinite(change) ? change.toFixed(1) : "N/A"}% today.`,
          severity: "Medium",
          severityOrder: 2,
        });
      }
      if (change != null && change < -5) {
        result.push({
          type: "PRICE DROP",
          ticker: item.ticker,
          explanation: `${item.ticker} dropped ${Number.isFinite(change) ? Math.abs(change).toFixed(1) : "N/A"}% today.`,
          severity: "High",
          severityOrder: 1,
        });
      }
      if (item.beta != null && item.beta > 1.8) {
        result.push({
          type: "HIGH RISK",
          ticker: item.ticker,
          explanation: `${item.ticker} has a beta of ${Number.isFinite(item.beta) ? item.beta.toFixed(2) : "N/A"}, indicating high volatility.`,
          severity: "High",
          severityOrder: 1,
        });
      }
      if (item.pe_ratio != null && item.pe_ratio < 15 && item.eps != null && item.eps > 0) {
        result.push({
          type: "VALUE OPPORTUNITY",
          ticker: item.ticker,
          explanation: `${item.ticker} trades at P/E of ${Number.isFinite(item.pe_ratio) ? item.pe_ratio.toFixed(1) : "N/A"} with positive earnings.`,
          severity: "Medium",
          severityOrder: 2,
        });
      }
      if (item.dividend_yield != null && item.dividend_yield > 0.03) {
        result.push({
          type: "INCOME PICK",
          ticker: item.ticker,
          explanation: `${item.ticker} yields ${Number.isFinite(item.dividend_yield) ? (item.dividend_yield * 100).toFixed(1) : "N/A"}% dividend.`,
          severity: "Low",
          severityOrder: 3,
        });
      }
    }

    const tg = analytics.topGainer;
    const tl = analytics.topLoser;
    if (tg && tg.change != null) {
      result.push({
        type: "WATCHLIST UPDATE",
        ticker: tg.item.ticker,
        explanation: `${tg.item.ticker} is the top gainer at +${Number.isFinite(tg.change) ? tg.change.toFixed(1) : "N/A"}%.`,
        severity: "Info",
        severityOrder: 4,
      });
    }
    if (tl && tl.change != null) {
      result.push({
        type: "WATCHLIST UPDATE",
        ticker: tl.item.ticker,
        explanation: `${tl.item.ticker} is the top loser at ${Number.isFinite(tl.change) ? tl.change.toFixed(1) : "N/A"}%.`,
        severity: "Info",
        severityOrder: 4,
      });
    }

    if (analytics.isConcentrated && analytics.largestSector) {
      result.push({
        type: "CONCENTRATION WARNING",
        ticker: analytics.largestSector,
        explanation: `${analytics.largestSector} exceeds 60% of portfolio, increasing sector-specific risk.`,
        severity: "Info",
        severityOrder: 4,
      });
    }

    if (result.length === 0 && watchlist.length > 0) {
      result.push({
        type: "PORTFOLIO STATUS",
        ticker: "",
        explanation: "Portfolio is stable — no significant movements or risks detected.",
        severity: "Info",
        severityOrder: 4,
      });
    }

    result.sort((a, b) => a.severityOrder - b.severityOrder);
    return result;
  }, [watchlist, analytics.topGainer, analytics.topLoser, analytics.isConcentrated, analytics.largestSector]);

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">
          Loading watchlist…
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-6xl mx-auto animate-fade-in">
      {/* Page header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600/8 via-blue-500/4 to-transparent border border-blue-500/15 p-5 sm:p-6 md:p-7 rounded-2xl sm:rounded-3xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-600/10 border border-blue-500/20">
            <Star className="w-5 h-5 text-blue-400 fill-blue-400/20" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-gray-100 leading-none tracking-tight">
              Watchlist
            </h2>
            <p className="text-xs text-gray-500 font-light mt-1">
              {watchlist.length === 0
                ? "No stocks tracked yet"
                : `${watchlist.length} stock${watchlist.length !== 1 ? "s" : ""} · Real-time tracking`}
            </p>
          </div>
        </div>
      </div>

      {/* Portfolio Overview */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 text-blue-400" />
          <h3 className="text-xs sm:text-sm font-bold text-gray-200 uppercase tracking-wider">
            Portfolio Overview
          </h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          <div className="glass-card rounded-xl sm:rounded-2xl p-3 sm:p-4 glass-card-no-hover">
            <div className="flex items-center gap-2 text-[9px] sm:text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              Holdings
            </div>
            <p className="text-base sm:text-lg font-black text-white tabular-nums">
              {watchlist.length}
            </p>
          </div>
          <div className="glass-card rounded-xl sm:rounded-2xl p-3 sm:p-4 glass-card-no-hover">
            <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1.5">
              <DollarSign className="w-3.5 h-3.5" />
              Market Cap
            </div>
            <p className="text-lg font-black text-white tabular-nums">
              {analytics.totalMarketCapStr}
            </p>
          </div>
          <div className="glass-card rounded-xl sm:rounded-2xl p-3 sm:p-4 glass-card-no-hover">
            <div className="flex items-center gap-2 text-[9px] sm:text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1.5">
              <DollarSign className="w-3.5 h-3.5" />
              Portfolio Value
            </div>
            <p className="text-lg font-black text-white tabular-nums">
              {analytics.portfolioValueStr}
            </p>
          </div>
          <div className="glass-card rounded-xl sm:rounded-2xl p-3 sm:p-4 glass-card-no-hover">
            <div className="flex items-center gap-2 text-[9px] sm:text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1.5">
              <ArrowUpRight className="w-3.5 h-3.5" />
              Avg Change
            </div>
            {analytics.avgChange != null && Number.isFinite(analytics.avgChange) ? (
              <span
                className={`inline-flex items-center gap-1 font-black text-lg tabular-nums ${
                  analytics.avgChange >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {analytics.avgChange >= 0 ? (
                  <ArrowUpRight className="w-4 h-4" />
                ) : (
                  <ArrowDownRight className="w-4 h-4" />
                )}
                {analytics.avgChange >= 0 ? "+" : ""}
                {analytics.avgChange.toFixed(2)}%
              </span>
            ) : (
              <p className="text-lg font-black text-gray-500">N/A</p>
            )}
          </div>
          <div className="glass-card rounded-xl sm:rounded-2xl p-3 sm:p-4 glass-card-no-hover">
            <div className="flex items-center gap-2 text-[9px] sm:text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              Best Performer
            </div>
            {analytics.topGainer ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">{analytics.topGainer.item.ticker}</span>
                <span className="text-xs font-bold text-emerald-400">
                  +{Number.isFinite(analytics.topGainer.change) ? analytics.topGainer.change.toFixed(2) : "N/A"}%
                </span>
              </div>
            ) : (
              <p className="text-lg font-black text-gray-500">N/A</p>
            )}
          </div>
          <div className="glass-card rounded-xl sm:rounded-2xl p-3 sm:p-4 glass-card-no-hover">
            <div className="flex items-center gap-2 text-[9px] sm:text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1.5">
              <TrendingDown className="w-3.5 h-3.5" />
              Worst Performer
            </div>
            {analytics.topLoser ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">{analytics.topLoser.item.ticker}</span>
                <span className="text-xs font-bold text-red-400">
                  {Number.isFinite(analytics.topLoser.change) ? analytics.topLoser.change.toFixed(2) : "N/A"}%
                </span>
              </div>
            ) : (
              <p className="text-lg font-black text-gray-500">N/A</p>
            )}
          </div>
        </div>

        {/* Sector Allocation */}
        {analytics.sectorData.length > 0 && (
          <div className="glass-card rounded-xl sm:rounded-2xl p-3 sm:p-4 glass-card-no-hover">
            <div className="flex items-center gap-2 text-[9px] sm:text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-4">
              <PieChart className="w-3.5 h-3.5" />
              Sector Allocation
            </div>
            <div className="space-y-3">
              {analytics.sectorData.map((s) => {
                const pct = watchlist.length > 0 ? (s.count / watchlist.length) * 100 : 0;
                return (
                  <div key={s.sector}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-300 font-medium truncate mr-2">
                        {s.sector}
                      </span>
                      <span className="text-gray-400 tabular-nums shrink-0 ml-2">
                        {s.count} stock{s.count !== 1 ? "s" : ""} &middot; {Number.isFinite(pct) ? pct.toFixed(1) : "N/A"}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[#242D3D]/60 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500/60 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Smart Alerts */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs sm:text-sm font-bold text-gray-200 uppercase tracking-wider">
            Smart Alerts
          </h3>
          {alerts.length > 0 && (
            <span className="text-[9px] font-bold text-gray-500 bg-[#242D3D]/60 px-1.5 py-0.5 rounded-full">
              {alerts.length}
            </span>
          )}
        </div>
        {alerts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
            {alerts.map((alert, i) => {
              const severityColors = {
                High: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20", dot: "bg-red-500" },
                Medium: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", dot: "bg-amber-500" },
                Low: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", dot: "bg-emerald-500" },
                Info: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", dot: "bg-blue-500" },
              }[alert.severity];
              const typeIcons = {
                "PRICE MOMENTUM": <ArrowUpRight className="w-3 h-3 text-blue-400" />,
                "PRICE DROP": <ArrowDownRight className="w-3 h-3 text-red-400" />,
                "HIGH RISK": <AlertTriangle className="w-3 h-3 text-red-400" />,
                "VALUE OPPORTUNITY": <DollarSign className="w-3 h-3 text-emerald-400" />,
                "INCOME PICK": <TrendingUp className="w-3 h-3 text-emerald-400" />,
                "WATCHLIST UPDATE": <Bell className="w-3 h-3 text-blue-400" />,
                "CONCENTRATION WARNING": <PieChart className="w-3 h-3 text-amber-400" />,
                "PORTFOLIO STATUS": <Shield className="w-3 h-3 text-blue-400" />,
              }[alert.type];
              return (
                <div
                  key={`${alert.ticker}-${alert.type}-${i}`}
                  className="glass-card rounded-xl sm:rounded-2xl p-3 sm:p-4 animate-fade-in-up"
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-500">
                      {typeIcons}
                      {alert.type}
                    </div>
                    <div className={`flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${severityColors.bg} ${severityColors.text} ${severityColors.border}`}>
                      <span className={`w-1 h-1 rounded-full ${severityColors.dot}`} />
                      {alert.severity}
                    </div>
                  </div>
                  <p className={`text-sm font-bold text-white mb-0.5 ${!alert.ticker ? "hidden" : ""}`}>{alert.ticker}</p>
                  <p className="text-[10px] text-gray-400 font-light leading-relaxed">
                    {alert.explanation}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="glass-card rounded-xl sm:rounded-2xl p-3 sm:p-4 glass-card-no-hover flex items-center gap-3">
            <Bell className="w-4 h-4 text-gray-600" />
            <p className="text-xs text-gray-500 font-light">No alerts detected.</p>
          </div>
        )}
      </div>

      {/* Portfolio Health */}
      <div className="space-y-3 sm:space-y-4 relative z-10">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs sm:text-sm font-bold text-gray-200 uppercase tracking-wider">
            Portfolio Health
          </h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
          {/* Grade */}
          <div className="group relative glass-card rounded-xl sm:rounded-2xl p-3 sm:p-4">
            <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-3">
              <Shield className="w-3.5 h-3.5" />
              Portfolio Grade
            </div>
            {watchlist.length > 0 ? (
              <>
                <div className={`text-4xl font-black leading-none ${
                  analytics.grade === "A" ? "text-emerald-400" :
                  analytics.grade === "B" ? "text-blue-400" :
                  analytics.grade === "C" ? "text-amber-400" :
                  "text-red-400"
                }`}>
                  {analytics.grade}
                </div>
                <p className="text-[11px] text-gray-500 font-semibold tabular-nums mt-1">
                  {analytics.avgScore}/100
                </p>
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-48 bg-[#0B0F19] border border-[#242D3D]/80 rounded-xl p-3 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 space-y-1.5">
                  <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1.5">Component Scores</p>
                  {[
                    { label: "Valuation (30%)", value: analytics.avgValuation },
                    { label: "Profitability (25%)", value: analytics.avgProfitability },
                    { label: "Stability (20%)", value: analytics.avgStability },
                    { label: "Income (10%)", value: analytics.avgIncome },
                    { label: "Scale (15%)", value: analytics.avgScale },
                  ].map((c) => (
                    <div key={c.label} className="flex items-center justify-between text-[10px]">
                      <span className="text-gray-400 truncate mr-1">{c.label}</span>
                      <span className={`font-bold tabular-nums ${
                        c.value >= 70 ? "text-emerald-400" : c.value >= 50 ? "text-amber-400" : "text-red-400"
                      }`}>{c.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-lg font-black text-gray-500">N/A</p>
            )}
          </div>

          {/* Diversification */}
          <div className="glass-card rounded-xl sm:rounded-2xl p-3 sm:p-4 glass-card-no-hover">
            <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-3">
              <BarChart3 className="w-3.5 h-3.5" />
              Diversification
            </div>
            <p className="text-lg font-black text-white tabular-nums mb-2">
              {analytics.diversificationScore}/100
            </p>
            <div className="w-full h-1.5 bg-[#242D3D]/60 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500/60 transition-all duration-500"
                style={{ width: `${analytics.diversificationScore}%` }}
              />
            </div>
          </div>

          {/* Risk Score */}
          <div className="glass-card rounded-xl sm:rounded-2xl p-3 sm:p-4 glass-card-no-hover">
            <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-3">
              <AlertTriangle className="w-3.5 h-3.5" />
              Risk Score
            </div>
            {watchlist.length > 0 ? (
              <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border ${analytics.riskBg} ${analytics.riskColor} ${analytics.riskBorder}`}>
                {analytics.riskLabel}
              </span>
            ) : (
              <p className="text-lg font-black text-gray-500">Unknown</p>
            )}
          </div>

          {/* Sector Concentration */}
          <div className="glass-card rounded-xl sm:rounded-2xl p-3 sm:p-4 glass-card-no-hover">
            <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-3">
              <PieChart className="w-3.5 h-3.5" />
              Top Sector
            </div>
            {analytics.largestSector && watchlist.length > 0 ? (
              <div className="space-y-1">
                <p className="text-sm font-bold text-white truncate">
                  {analytics.largestSector}
                </p>
                <p className="text-lg font-black tabular-nums">
                  <span className={analytics.isConcentrated ? "text-amber-400" : "text-gray-300"}>
                    {Number.isFinite(analytics.largestSectorPct) ? `${analytics.largestSectorPct.toFixed(0)}%` : "N/A"}
                  </span>
                </p>
                {analytics.isConcentrated && (
                  <div className="flex items-center gap-1 text-[9px] text-amber-400 font-bold uppercase tracking-wider mt-1">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    Highly Concentrated
                  </div>
                )}
              </div>
            ) : (
              <p className="text-lg font-black text-gray-500">—</p>
            )}
          </div>

          {/* Portfolio Insight */}
          <div className="glass-card rounded-xl sm:rounded-2xl p-3 sm:p-4 glass-card-no-hover col-span-2 sm:col-span-3 lg:col-span-1">
            <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
              <Lightbulb className="w-3.5 h-3.5" />
              Insight
            </div>
            <p className="text-[11px] text-gray-400 font-light leading-relaxed">
              {analytics.insight}
            </p>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {sorted.length === 0 ? (
        <div className="glass-card rounded-xl sm:rounded-3xl pt-10 pb-12 px-6 flex flex-col items-center text-center space-y-6">
          <div className="p-4 rounded-2xl bg-[#0B0F19]/60 border border-[#242D3D]/60">
            <TrendingUp className="w-8 h-8 text-gray-500" />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-gray-300">
              No stocks in your watchlist yet.
            </p>
            <p className="text-xs text-gray-500 font-light max-w-sm mx-auto">
              Use the global search bar at the top of the workspace to find stocks and build your watchlist.
            </p>
          </div>
          <button
            onClick={focusSearchBar}
            className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-blue-400 hover:text-blue-300 border border-blue-500/25 hover:border-blue-500/50 px-5 py-2.5 rounded-lg transition-all"
          >
            <Search className="w-3.5 h-3.5" />
            Search Stocks
          </button>

          {/* Placeholder table preview */}
          <div className="w-full max-w-lg opacity-20 select-none pointer-events-none mt-4">
            <table className="w-full text-left text-[10px]">
              <thead>
                <tr className="text-gray-400 font-bold uppercase tracking-wider border-b border-[#242D3D]/40">
                  <th className="pb-2 pr-4">Ticker</th>
                  <th className="pb-2 pr-4">Price</th>
                  <th className="pb-2 pr-4">Change</th>
                  <th className="pb-2">Market Cap</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#242D3D]/20">
                  <td className="py-2 pr-4 font-semibold text-gray-300">AAPL</td>
                  <td className="py-2 pr-4 text-gray-300">$198.50</td>
                  <td className="py-2 pr-4 text-emerald-400">+1.24%</td>
                  <td className="py-2 text-gray-300">$3.12T</td>
                </tr>
                <tr className="border-b border-[#242D3D]/20">
                  <td className="py-2 pr-4 font-semibold text-gray-300">MSFT</td>
                  <td className="py-2 pr-4 text-gray-300">$425.30</td>
                  <td className="py-2 pr-4 text-red-400">-0.87%</td>
                  <td className="py-2 text-gray-300">$3.18T</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-semibold text-gray-300">GOOGL</td>
                  <td className="py-2 pr-4 text-gray-300">$175.80</td>
                  <td className="py-2 pr-4 text-emerald-400">+0.52%</td>
                  <td className="py-2 text-gray-300">$2.18T</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Finance table */
        <div className="glass-card rounded-xl sm:rounded-2xl overflow-hidden glass-card-no-hover">
          <table className="w-full text-sm">
            {/* Sticky header */}
            <thead>
              <tr className="border-b border-[#242D3D]/60 bg-[#111622] sticky top-0 z-10">
                {SORT_COLUMNS.map((col) => {
                  const isActive = sortKey === col.key;
                  return (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className={`px-2 sm:px-4 py-3.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider cursor-pointer select-none transition-colors whitespace-nowrap ${
                        col.numeric ? "text-right" : "text-left"
                      } ${isActive ? "text-blue-400" : "text-gray-400 hover:text-gray-200"} ${col.hide}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {isActive ? (
                          sortDir === "asc" ? (
                            <span className="text-blue-400 leading-none">↑</span>
                          ) : (
                            <span className="text-blue-400 leading-none">↓</span>
                          )
                        ) : (
                          <ArrowUpDown className="w-2.5 h-2.5 text-gray-500" />
                        )}
                      </span>
                    </th>
                  );
                })}
                <th className="px-2 sm:px-4 py-3.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-gray-400 text-right whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#242D3D]/30">
              {sorted.map((item, index) => {
                const change = item.price_change_percent;
                const isPositive = change != null && change >= 0;

                return (
                  <tr
                    key={item.ticker}
                    onClick={() => navigateToStock(item.ticker)}
                    className="group cursor-pointer transition-all duration-200 hover:bg-blue-500/[0.07] animate-fade-in-up"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    {/* Ticker */}
                    <td className="px-2 sm:px-4 py-3.5 whitespace-nowrap border-l-2 border-l-transparent group-hover:border-l-blue-500/30 transition-all duration-200">
                      <div className="flex items-center gap-2 sm:gap-2.5">
                        <StockLogo
                          ticker={item.ticker}
                          website={item.website}
                          className="w-6 h-6 sm:w-7 sm:h-7 shrink-0"
                        />
                        <div>
                          <span className="text-xs sm:text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                            {item.ticker}
                          </span>
                          <span className="ml-1 text-[8px] sm:text-[9px] text-gray-500 font-bold bg-[#0B0F19] border border-[#242D3D] px-1 rounded uppercase">
                            {item.ticker.endsWith(".NS") || item.ticker.endsWith(".BO") ? "IN" : "US"}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Company */}
                    <td className="px-2 sm:px-4 py-3.5 max-w-[80px] sm:max-w-[120px] md:max-w-[160px] lg:max-w-[220px] hidden sm:table-cell">
                      <p className="text-xs text-gray-400 font-light truncate">
                        {item.company_name || "N/A"}
                      </p>
                    </td>

                    {/* Price */}
                    <td className="px-2 sm:px-4 py-3.5 text-right whitespace-nowrap tabular-nums text-xs sm:text-sm font-semibold text-white">
                      {formatPrice(item.current_price, item.currency, item.ticker)}
                    </td>

                    {/* Daily Change */}
                    <td className="px-2 sm:px-4 py-3.5 text-right whitespace-nowrap">
                      {change != null ? (
                        <span
                          className={`inline-flex items-center gap-1 font-bold text-xs px-2 py-1 rounded-lg ${
                            isPositive
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-red-500/10 text-red-400 border border-red-500/20"
                          }`}
                        >
                          {isPositive ? (
                            <ArrowUpRight className="w-3 h-3" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3" />
                          )}
                          {isPositive ? "+" : ""}
                          {Number.isFinite(change) ? change.toFixed(2) : "N/A"}%
                        </span>
                      ) : (
                        <span className="text-gray-500 text-xs font-medium">N/A</span>
                      )}
                    </td>

                    {/* Market Cap */}
                    <td className="px-2 sm:px-4 py-3.5 text-right whitespace-nowrap tabular-nums text-xs sm:text-sm font-medium text-gray-300 hidden md:table-cell">
                      {formatMarketCap(item.market_cap, item.currency, item.ticker)}
                    </td>

                    {/* Volume */}
                    <td className="px-2 sm:px-4 py-3.5 text-right whitespace-nowrap tabular-nums text-xs sm:text-sm font-medium text-gray-300 hidden lg:table-cell">
                      {formatVolume(item.volume)}
                    </td>

                    {/* Actions */}
                    <td className="px-2 sm:px-4 py-3.5 text-right whitespace-nowrap">
                      <div
                        className="inline-flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => handleRefresh(e, item.ticker)}
                          disabled={refreshing === item.ticker}
                          title="Refresh"
                          className="p-1.5 rounded-lg text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 border border-transparent hover:border-blue-500/20 transition-colors active:scale-95"
                        >
                          <RefreshCcw
                            className={`w-3.5 h-3.5 ${
                              refreshing === item.ticker ? "animate-spin text-blue-500" : ""
                            }`}
                          />
                        </button>
                        <button
                          onClick={(e) => handleRemove(e, item.ticker)}
                          disabled={removing === item.ticker}
                          title="Remove"
                          className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors active:scale-95"
                        >
                          {removing === item.ticker ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
