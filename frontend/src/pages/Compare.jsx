import React, { useState, useEffect, useMemo } from "react";
import { Loader2, TrendingUp, TrendingDown, GitCompare, ArrowLeftRight } from "lucide-react";
import { api } from "../services/api";
import { StockLogo } from "../components/StockLogo";
import { useWatchlist } from "../context/WatchlistContext";

const formatCompact = (val) => {
  if (val == null) return "N/A";
  if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  return `$${val.toLocaleString()}`;
};

const formatPrice = (val) => {
  if (val == null) return "N/A";
  return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const ChangePill = ({ value }) => {
  if (value == null) return <span className="text-gray-500 text-xs font-medium">N/A</span>;
  const isPos = value >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-lg ${
      isPos ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
    }`}>
      {isPos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {isPos ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
};

const Label = ({ children }) => (
  <td className="py-3 pr-4 text-[11px] text-gray-500 font-medium uppercase tracking-wider whitespace-nowrap">{children}</td>
);

const Value = ({ children, highlight }) => (
  <td className={`py-3 px-4 text-right text-sm font-semibold tabular-nums whitespace-nowrap ${highlight || "text-white"}`}>{children}</td>
);

const DesktopRow = ({ label, valA, valB, highlight }) => (
  <tr className="border-b border-[#242D3D]/20">
    <Label>{label}</Label>
    <Value highlight={highlight}>{valA}</Value>
    <Value highlight={highlight}>{valB}</Value>
  </tr>
);

const MobileCard = ({ ticker, overview, change, label, valA, valB }) => (
  <div className="bg-[#161B26]/40 border border-[#242D3D]/60 rounded-2xl p-4 backdrop-blur-md">
    <div className="flex items-center gap-2 mb-3">
      <StockLogo ticker={ticker} className="w-6 h-6" />
      <span className="text-sm font-bold text-white">{ticker}</span>
      <span className="text-[10px] text-gray-400 font-light truncate ml-1">{overview?.name || ""}</span>
    </div>
    <div className="flex items-center justify-between text-xs py-1.5 border-b border-[#242D3D]/20">
      <span className="text-gray-500 font-medium uppercase tracking-wider">{label}</span>
      <span className={`tabular-nums font-semibold ${highlight || "text-white"}`}>{valA}</span>
    </div>
  </div>
);

const METRICS = [
  { key: "company", label: "Company" },
  { key: "price", label: "Price" },
  { key: "change", label: "Daily Change", pill: true },
  { key: "marketCap", label: "Market Cap" },
  { key: "pe", label: "P/E" },
  { key: "eps", label: "EPS" },
  { key: "divYield", label: "Dividend Yield" },
  { key: "volume", label: "Volume" },
  { key: "range", label: "52 Week Range" },
];

export const Compare = () => {
  const { watchlist, loading: wlLoading } = useWatchlist();
  const [stockA, setStockA] = useState("");
  const [stockB, setStockB] = useState("");
  const [overviewA, setOverviewA] = useState(null);
  const [overviewB, setOverviewB] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");

  const sortedWatchlist = useMemo(() => {
    return [...watchlist].sort((a, b) => (a.ticker || "").localeCompare(b.ticker || ""));
  }, [watchlist]);

  const options = sortedWatchlist.map((item) => ({
    ticker: item.ticker,
    name: item.company_name || item.ticker,
  }));

  const availableA = options.filter((o) => o.ticker !== stockB);
  const availableB = options.filter((o) => o.ticker !== stockA);

  useEffect(() => {
    if (!stockA || !stockB) {
      setOverviewA(null);
      setOverviewB(null);
      setError("");
      return;
    }
    const controller = new AbortController();
    const fetch = async () => {
      setFetching(true);
      setError("");
      try {
        const [oa, ob] = await Promise.all([
          api.get(`/stocks/${stockA}/overview`, { signal: controller.signal }),
          api.get(`/stocks/${stockB}/overview`, { signal: controller.signal }),
        ]);
        setOverviewA(oa);
        setOverviewB(ob);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message);
          setOverviewA(null);
          setOverviewB(null);
        }
      } finally {
        setFetching(false);
      }
    };
    fetch();
    return () => controller.abort();
  }, [stockA, stockB]);

  const changeA = useMemo(() => {
    if (!overviewA?.current_price || !overviewA?.previous_close) return null;
    return ((overviewA.current_price - overviewA.previous_close) / overviewA.previous_close) * 100;
  }, [overviewA]);

  const changeB = useMemo(() => {
    if (!overviewB?.current_price || !overviewB?.previous_close) return null;
    return ((overviewB.current_price - overviewB.previous_close) / overviewB.previous_close) * 100;
  }, [overviewB]);

  const metricValue = (overview, change, key) => {
    switch (key) {
      case "company": return overview?.name || stockA || "N/A";
      case "price": return formatPrice(overview?.current_price);
      case "change": return change;
      case "marketCap": return formatCompact(overview?.market_cap);
      case "pe": return overview?.pe_ratio != null ? overview.pe_ratio.toFixed(2) : "N/A";
      case "eps": return overview?.eps != null ? overview.eps.toFixed(2) : "N/A";
      case "divYield": return overview?.dividend_yield != null ? `${(overview.dividend_yield * 100).toFixed(2)}%` : "N/A";
      case "volume": return overview?.volume != null ? overview.volume.toLocaleString() : "N/A";
      case "range": {
        const hi = overview?.fifty_two_week_high;
        const lo = overview?.fifty_two_week_low;
        return hi != null && lo != null ? `${formatPrice(lo)} – ${formatPrice(hi)}` : "N/A";
      }
      default: return "N/A";
    }
  };

  const showEmpty = !stockA || !stockB;
  const showResult = stockA && stockB && overviewA && overviewB && !fetching;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600/10 via-blue-500/5 to-transparent border border-blue-500/20 p-6 rounded-3xl relative overflow-hidden backdrop-blur-md">
        <div className="absolute top-0 right-0 w-56 h-56 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-600/10 border border-blue-500/20">
            <GitCompare className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-gray-100 leading-none">Stock Comparison</h2>
            <p className="text-xs text-gray-400 font-light mt-1">Select two stocks to compare side by side</p>
          </div>
        </div>
      </div>

      {/* Stock Selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1.5 block">Stock A</label>
          <select
            value={stockA}
            onChange={(e) => { setStockA(e.target.value); setOverviewA(null); setOverviewB(null); }}
            className="w-full bg-[#161B26]/60 border border-[#242D3D]/60 rounded-xl px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-blue-500/50 transition-colors appearance-none cursor-pointer"
          >
            <option value="">{wlLoading ? "Loading watchlist…" : options.length === 0 ? "Watchlist is empty" : "Select a stock…"}</option>
            {availableA.map((o) => (
              <option key={o.ticker} value={o.ticker}>{o.ticker} — {o.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1.5 block">Stock B</label>
          <select
            value={stockB}
            onChange={(e) => { setStockB(e.target.value); setOverviewA(null); setOverviewB(null); }}
            className="w-full bg-[#161B26]/60 border border-[#242D3D]/60 rounded-xl px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-blue-500/50 transition-colors appearance-none cursor-pointer"
          >
            <option value="">{wlLoading ? "Loading watchlist…" : options.length === 0 ? "Watchlist is empty" : "Select a stock…"}</option>
            {availableB.map((o) => (
              <option key={o.ticker} value={o.ticker}>{o.ticker} — {o.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Fetching spinner */}
      {fetching && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && !fetching && (
        <div className="text-center py-8">
          <p className="text-sm text-red-400 font-medium">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {showEmpty && !fetching && !error && (
        <div className="bg-[#161B26]/40 border border-[#242D3D]/60 rounded-3xl backdrop-blur-md py-16 flex flex-col items-center text-center space-y-3">
          <div className="p-4 rounded-2xl bg-[#0B0F19]/60 border border-[#242D3D]/60">
            <ArrowLeftRight className="w-8 h-8 text-gray-600" />
          </div>
          <p className="text-sm font-semibold text-gray-300">Select two stocks to compare.</p>
          <p className="text-xs text-gray-500 font-light max-w-xs">Pick two stocks from your watchlist above to view a side-by-side comparison.</p>
        </div>
      )}

      {/* Comparison Result */}
      {showResult && (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-[#161B26]/40 border border-[#242D3D]/60 rounded-2xl backdrop-blur-md overflow-hidden">
            <div className="px-5 py-3 border-b border-[#242D3D]/40 bg-[#111622]/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StockLogo ticker={stockA} className="w-7 h-7" />
                  <span className="text-sm font-bold text-white">{stockA}</span>
                </div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">vs</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-white">{stockB}</span>
                  <StockLogo ticker={stockB} className="w-7 h-7" />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#242D3D]/30 bg-[#111622]/50">
                    <th className="py-2.5 px-5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">Metric</th>
                    <th className="py-2.5 px-5 text-right text-[10px] font-bold uppercase tracking-wider text-gray-500">{stockA}</th>
                    <th className="py-2.5 px-5 text-right text-[10px] font-bold uppercase tracking-wider text-gray-500">{stockB}</th>
                  </tr>
                </thead>
                <tbody>
                  {METRICS.map((m) => {
                    const a = metricValue(overviewA, changeA, m.key);
                    const b = metricValue(overviewB, changeB, m.key);
                    if (m.pill) {
                      return (
                        <tr key={m.key} className="border-b border-[#242D3D]/20">
                          <Label>{m.label}</Label>
                          <td className="py-3 px-5 text-right"><ChangePill value={a} /></td>
                          <td className="py-3 px-5 text-right"><ChangePill value={b} /></td>
                        </tr>
                      );
                    }
                    return <DesktopRow key={m.key} label={m.label} valA={a} valB={b} />;
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Stacked Cards */}
          <div className="md:hidden space-y-4">
            {METRICS.map((m) => {
              const a = metricValue(overviewA, changeA, m.key);
              const b = metricValue(overviewB, changeB, m.key);
              return (
                <div key={m.key} className="bg-[#161B26]/40 border border-[#242D3D]/60 rounded-2xl p-4 backdrop-blur-md">
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-3">{m.label}</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <StockLogo ticker={stockA} className="w-5 h-5" />
                        <span className="text-xs font-semibold text-gray-300">{stockA}</span>
                      </div>
                      {m.pill ? <ChangePill value={a} /> : <span className="text-sm font-semibold text-white tabular-nums">{a}</span>}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <StockLogo ticker={stockB} className="w-5 h-5" />
                        <span className="text-xs font-semibold text-gray-300">{stockB}</span>
                      </div>
                      {m.pill ? <ChangePill value={b} /> : <span className="text-sm font-semibold text-white tabular-nums">{b}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
