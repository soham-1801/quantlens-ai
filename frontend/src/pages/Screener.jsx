/* eslint-disable react-hooks/set-state-in-effect, react-hooks/immutability */
import { useState, useEffect, useMemo } from "react";
import { Search, ChevronDown, ChevronUp, Trash2, Save, Download, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { api } from "../services/api";
import { formatMarketCap, formatPrice, getUSDEquivalent } from "../utils/format";

const TICKERS = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "NFLX",
  "JPM", "V", "DIS", "WMT", "SPY", "QQQ", "BAC", "PG",
  "MA", "UNH", "HD", "INTC", "AMD", "PYPL", "ADBE", "CRM",
  "KO", "PEP", "NKE", "MRK", "PFE", "ABNB", "UBER", "SQ",
  "SNAP", "SHOP", "ZM", "DASH", "COIN", "RBLX", "PLTR", "SOFI",
  "BA", "CAT", "GE", "IBM", "GS", "MS", "C", "SCHW",
  "CVX", "XOM", "COP", "DUK", "SO", "NEE", "T", "VZ",
  "AMAT", "KLAC", "MU", "TXN", "PANW", "CRWD", "WDAY", "NOW",
  "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS",
  "HINDUNILVR.NS", "BHARTIARTL.NS", "ITC.NS", "SBIN.NS"
];

const MARKET_CAP_OPTIONS = [
  { value: "", label: "All" },
  { value: "small", label: "Small Cap (<$2B)" },
  { value: "mid", label: "Mid Cap ($2B-$10B)" },
  { value: "large", label: "Large Cap (>$10B)" },
];

const BETA_OPTIONS = [
  { value: "", label: "All" },
  { value: "low", label: "Low (<1.0)" },
  { value: "medium", label: "Medium (1.0-1.5)" },
  { value: "high", label: "High (>1.5)" },
];

const PRESETS = [
  { id: "top-gainers", label: "Top Gainers", sort: "daily-desc" },
  { id: "top-losers", label: "Top Losers", sort: "daily-asc" },
  { id: "most-active", label: "Most Active", sort: "volume-desc" },
  { id: "high-dividend", label: "High Dividend", filter: (s) => s.dividend_yield != null && s.dividend_yield >= 0.02 },
  { id: "low-pe", label: "Low P/E", filter: (s) => s.pe_ratio != null && s.pe_ratio <= 15 },
  { id: "large-cap-leaders", label: "Large Cap Leaders", filter: (s) => s.market_cap != null && s.market_cap >= 50e9 },
  { id: "high-growth", label: "High Growth", filter: (s) => s.beta != null && s.beta >= 1.2 },
  { id: "defensive", label: "Defensive", filter: (s) => s.beta != null && s.beta <= 0.8 },
];

const getDailyChange = (s) => {
  if (s.current_price != null && s.previous_close != null && s.previous_close > 0) {
    return ((s.current_price - s.previous_close) / s.previous_close) * 100;
  }
  return null;
};

const computeScore = (s, avgVolume) => {
  let score = 50;

  const usdMc = getUSDEquivalent(s.market_cap, s.currency, s.ticker);
  if (usdMc != null) {
    if (usdMc > 100e9) score += 10;
    else if (usdMc > 10e9) score += 5;
  }

  if (s.pe_ratio != null) {
    if (s.pe_ratio >= 10 && s.pe_ratio <= 30) score += 10;
    else if (s.pe_ratio > 30 && s.pe_ratio <= 50) score += 5;
    else if (s.pe_ratio > 100) score -= 10;
  }

  const daily = getDailyChange(s);
  if (daily != null) {
    if (daily > 0) score += 5;
    else if (daily < 0) score -= 5;
  }

  if (s.dividend_yield != null && s.dividend_yield > 0.02) score += 10;

  if (s.beta != null) {
    if (s.beta >= 0.8 && s.beta <= 1.5) score += 10;
    else if (s.beta > 2.5) score -= 10;
  }

  if (avgVolume > 0 && s.volume != null && s.volume > avgVolume) score += 10;

  return Math.max(0, Math.min(100, Math.round(score)));
};

const getScoreColor = (score) => {
  if (score >= 70) return "text-emerald-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
};

const getScoreRing = (score) => {
  if (score >= 70) return "border-emerald-500/30";
  if (score >= 40) return "border-amber-500/30";
  return "border-red-500/30";
};

const getRating = (score) => {
  if (score == null) return null;
  if (score >= 80) return "BUY";
  if (score >= 60) return "HOLD";
  return "SELL";
};

const getPickReason = (s) => {
  if (s._score >= 85) return "Strong profitability";
  if (s._score >= 75) {
    const usdMc = getUSDEquivalent(s.market_cap, s.currency, s.ticker);
    if (usdMc != null && usdMc > 100e9) return "Large cap leader";
    if (s.pe_ratio != null && s.pe_ratio >= 10 && s.pe_ratio <= 20) return "Attractive valuation";
    const d = getDailyChange(s);
    if (d != null && d > 2) return "Strong momentum";
    return "Balanced fundamentals";
  }
  if (s._score >= 65) {
    if (s.dividend_yield != null && s.dividend_yield > 0.02) return "High dividend profile";
    if (s.beta != null && s.beta >= 0.8 && s.beta <= 1.5) return "Balanced fundamentals";
    const usdMc = getUSDEquivalent(s.market_cap, s.currency, s.ticker);
    if (usdMc != null && usdMc > 50e9) return "Large cap leader";
    return "Attractive valuation";
  }
  if (s.pe_ratio != null && s.pe_ratio <= 15) return "Attractive valuation";
  if (s.dividend_yield != null && s.dividend_yield > 0.03) return "High dividend profile";
  return "Value opportunity";
};

const getRatingClass = (rating) => {
  if (rating === "BUY") return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  if (rating === "SELL") return "text-red-400 bg-red-500/10 border-red-500/20";
  return "text-amber-400 bg-amber-500/10 border-amber-500/20";
};

const SAVED_SCREENS_KEY = "quantlens_saved_screens";
const STOCKS_CACHE_KEY = "quantlens_screener_cache";
const STOCKS_CACHE_TTL = 10 * 60 * 1000;

const FilterSelect = ({ label, value, onChange, options }) => (
  <div>
    <label className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block mb-1">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-[#1C2333] border border-[#242D3D]/60 rounded-lg px-2.5 py-2 text-xs text-gray-200 outline-none focus:border-blue-500/50 transition-colors appearance-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </div>
);

const RangeInput = ({ label, min, max, onMinChange, onMaxChange, minPlaceholder, maxPlaceholder, prefix }) => (
  <div>
    <label className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block mb-1">{label}</label>
    <div className="flex items-center gap-1.5">
      {prefix && <span className="text-[10px] text-gray-500 font-medium">{prefix}</span>}
      <input
        type="number"
        value={min}
        onChange={(e) => onMinChange(e.target.value)}
        placeholder={minPlaceholder || "Min"}
        className="w-full bg-[#1C2333] border border-[#242D3D]/60 rounded-lg px-2 py-1.5 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-blue-500/50 transition-colors"
      />
      <span className="text-[10px] text-gray-600">—</span>
      <input
        type="number"
        value={max}
        onChange={(e) => onMaxChange(e.target.value)}
        placeholder={maxPlaceholder || "Max"}
        className="w-full bg-[#1C2333] border border-[#242D3D]/60 rounded-lg px-2 py-1.5 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-blue-500/50 transition-colors"
      />
    </div>
  </div>
);

export const Screener = () => {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [marketCap, setMarketCap] = useState("");
  const [sector, setSector] = useState("");
  const [peMin, setPeMin] = useState("");
  const [peMax, setPeMax] = useState("");
  const [divYieldMin, setDivYieldMin] = useState("");
  const [beta, setBeta] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [preset, setPreset] = useState(null);
  const [savedScreens, setSavedScreens] = useState([]);
  const [activeSavedId, setActiveSavedId] = useState(null);
  const [savingName, setSavingName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [sortField, setSortField] = useState("_score");
  const [sortDir, setSortDir] = useState("desc");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_SCREENS_KEY);
      if (raw) setSavedScreens(JSON.parse(raw));
    } catch (err) {
      console.debug(err);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_SCREENS_KEY, JSON.stringify(savedScreens));
    } catch (err) {
      console.debug(err);
    }
  }, [savedScreens]);

  useEffect(() => {
    const cached = (() => {
      try {
        const raw = localStorage.getItem(STOCKS_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Date.now() - parsed.ts < STOCKS_CACHE_TTL) {
            return parsed.data;
          }
        }
      } catch (err) {
      console.debug(err);
    }
      return null;
    })();
    if (cached) {
      setStocks(cached);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const fetchAll = async () => {
      setLoading(true);
      setError("");
      const results = [];
      const batchSize = 10;
      for (let i = 0; i < TICKERS.length; i += batchSize) {
        if (controller.signal.aborted) break;
        const batch = TICKERS.slice(i, i + batchSize);
        const promises = batch.map((ticker) =>
          api
            .get(`/stocks/${ticker}/overview`, { signal: controller.signal })
            .then((data) => ({ ticker, data, error: null }))
            .catch((err) => ({ ticker, data: null, error: err }))
        );
        const settled = await Promise.all(promises);
        if (controller.signal.aborted) break;
        for (const r of settled) {
          if (r.data) results.push(r.data);
        }
      }
      if (!controller.signal.aborted) {
        setStocks(results);
        try {
          localStorage.setItem(STOCKS_CACHE_KEY, JSON.stringify({ data: results, ts: Date.now() }));
        } catch (err) {
          console.debug(err);
        }
        setLoading(false);
      }
    };
    fetchAll();
    return () => controller.abort();
  }, []);

  const sectors = useMemo(() => {
    const set = new Set();
    for (const s of stocks) {
      if (s.sector) set.add(s.sector);
    }
    return Array.from(set).sort();
  }, [stocks]);

  const filtered = useMemo(() => {
    let result = stocks.filter((s) => {
      if (search) {
        const q = search.toLowerCase();
        const match = s.ticker.toLowerCase().includes(q) || (s.name && s.name.toLowerCase().includes(q));
        if (!match) return false;
      }
      if (marketCap) {
        const mc = s.market_cap;
        if (!mc) return false;
        if (marketCap === "small" && !(mc < 2e9)) return false;
        if (marketCap === "mid" && !(mc >= 2e9 && mc <= 10e9)) return false;
        if (marketCap === "large" && !(mc > 10e9)) return false;
      }
      if (sector && s.sector !== sector) return false;
      if (peMin && (s.pe_ratio == null || s.pe_ratio < parseFloat(peMin))) return false;
      if (peMax && (s.pe_ratio == null || s.pe_ratio > parseFloat(peMax))) return false;
      if (divYieldMin && (s.dividend_yield == null || s.dividend_yield * 100 < parseFloat(divYieldMin))) return false;
      if (beta) {
        const b = s.beta;
        if (b == null) return false;
        if (beta === "low" && !(b < 1.0)) return false;
        if (beta === "medium" && !(b >= 1.0 && b <= 1.5)) return false;
        if (beta === "high" && !(b > 1.5)) return false;
      }
      if (priceMin && (s.current_price == null || s.current_price < parseFloat(priceMin))) return false;
      if (priceMax && (s.current_price == null || s.current_price > parseFloat(priceMax))) return false;
      return true;
    });
    const activePreset = PRESETS.find((p) => p.id === preset);
    if (activePreset && activePreset.filter) {
      result = result.filter(activePreset.filter);
    }
    return result;
  }, [stocks, search, marketCap, sector, peMin, peMax, divYieldMin, beta, priceMin, priceMax, preset]);

  const scored = useMemo(() => {
    const withVol = stocks.filter((s) => s.volume != null);
    const avgVol = withVol.length > 0 ? withVol.reduce((sum, s) => sum + s.volume, 0) / withVol.length : 0;
    const withScore = filtered.map((s) => ({ ...s, _score: computeScore(s, avgVol) }));
    const activePreset = PRESETS.find((p) => p.id === preset);
    if (activePreset && activePreset.sort) {
      return [...withScore].sort((a, b) => {
        const dailyA = getDailyChange(a);
        const dailyB = getDailyChange(b);
        if (activePreset.sort === "daily-desc") return (dailyB ?? -Infinity) - (dailyA ?? -Infinity);
        if (activePreset.sort === "daily-asc") return (dailyA ?? Infinity) - (dailyB ?? Infinity);
        if (activePreset.sort === "volume-desc") return (b.volume ?? 0) - (a.volume ?? 0);
        return 0;
      });
    }
    const mul = sortDir === "asc" ? 1 : -1;
    return [...withScore].sort((a, b) => {
      if (sortField === "_score") return mul * ((a._score ?? 0) - (b._score ?? 0));
      if (sortField === "rating") {
        const order = { BUY: 3, HOLD: 2, SELL: 1 };
        return mul * ((order[getRating(a._score)] || 0) - (order[getRating(b._score)] || 0));
      }
      if (sortField === "ticker") return mul * ((a.ticker || "").localeCompare(b.ticker || ""));
      if (sortField === "name") return mul * ((a.name || "").localeCompare(b.name || ""));
      if (sortField === "current_price") return mul * ((a.current_price ?? 0) - (b.current_price ?? 0));
      if (sortField === "daily") {
        const da = getDailyChange(a) ?? 0;
        const db = getDailyChange(b) ?? 0;
        return mul * (da - db);
      }
      if (sortField === "market_cap") return mul * ((a.market_cap ?? 0) - (b.market_cap ?? 0));
      if (sortField === "pe_ratio") return mul * ((a.pe_ratio ?? 0) - (b.pe_ratio ?? 0));
      if (sortField === "sector") return mul * ((a.sector || "").localeCompare(b.sector || ""));
      return 0;
    });
  }, [filtered, preset, stocks, sortField, sortDir]);

  const ratingCounts = useMemo(() => {
    let buy = 0, hold = 0, sell = 0;
    for (const s of scored) {
      if (s._score >= 80) buy++;
      else if (s._score >= 60) hold++;
      else sell++;
    }
    return { buy, hold, sell };
  }, [scored]);

  const [toast, setToast] = useState("");

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 2500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const exportCSV = () => {
    const rows = [["QuantLens Score", "Rating", "Ticker", "Company", "Price", "Daily Change %", "Market Cap", "P/E", "Sector", "Volume"]];
    for (const s of scored) {
      const dailyPct = s.current_price != null && s.previous_close != null && s.previous_close > 0
        ? ((s.current_price - s.previous_close) / s.previous_close) * 100
        : null;
      rows.push([
        s._score != null ? String(s._score) : "",
        getRating(s._score) || "",
        s.ticker,
        `"${(s.name || "").replace(/"/g, '""')}"`,
        s.current_price != null && Number.isFinite(s.current_price) ? s.current_price.toFixed(2) : "",
        dailyPct != null && Number.isFinite(dailyPct) ? `${dailyPct >= 0 ? "+" : ""}${dailyPct.toFixed(2)}` : "",
        s.market_cap != null ? String(s.market_cap) : "",
        s.pe_ratio != null && Number.isFinite(s.pe_ratio) ? s.pe_ratio.toFixed(2) : "",
        s.sector || "",
        s.volume != null ? String(s.volume) : "",
      ]);
    }
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quantlens-screener-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setToast("CSV exported successfully");
  };

  const navigateToStock = (ticker) => {
    window.location.hash = `#/stock/${ticker}`;
  };

  const clearFilters = () => {
    setMarketCap("");
    setSector("");
    setPeMin("");
    setPeMax("");
    setDivYieldMin("");
    setBeta("");
    setPriceMin("");
    setPriceMax("");
    setSearch("");
    setPreset(null);
    setActiveSavedId(null);
  };

  const saveScreen = () => {
    const name = savingName.trim();
    if (!name) return;
    if (savedScreens.length >= 20) return;
    const newScreen = {
      id: Date.now().toString(),
      name,
      filters: { marketCap, sector, peMin, peMax, divYieldMin, beta, priceMin, priceMax, search, preset },
      createdAt: new Date().toISOString(),
    };
    setSavedScreens((prev) => [newScreen, ...prev]);
    setSavingName("");
    setShowSaveInput(false);
    setActiveSavedId(newScreen.id);
  };

  const loadScreen = (screen) => {
    const f = screen.filters;
    setMarketCap(f.marketCap || "");
    setSector(f.sector || "");
    setPeMin(f.peMin || "");
    setPeMax(f.peMax || "");
    setDivYieldMin(f.divYieldMin || "");
    setBeta(f.beta || "");
    setPriceMin(f.priceMin || "");
    setPriceMax(f.priceMax || "");
    setSearch(f.search || "");
    setPreset(f.preset || null);
    setActiveSavedId(screen.id);
  };

  const deleteScreen = (id) => {
    setSavedScreens((prev) => prev.filter((s) => s.id !== id));
    if (activeSavedId === id) setActiveSavedId(null);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "_score" ? "desc" : "asc");
    }
  };

  const hasActiveFilters = marketCap || sector || peMin || peMax || divYieldMin || beta || priceMin || priceMax || search || preset;

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">AI Stock Screener</h1>
        <p className="text-xs text-gray-500 font-medium mt-1">Discover stocks using quantitative filters.</p>
      </div>

      {/* Quick Screens */}
      {!loading && (
          <div className="glass-card rounded-xl sm:rounded-2xl overflow-hidden glass-card-no-hover">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-[#242D3D]/60">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Quick Screens</h3>
            </div>
          <div className="px-4 py-3 overflow-x-auto">
            <div className="flex items-center gap-2 min-w-max">
              {PRESETS.map((p) => {
                const active = preset === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPreset(active ? null : p.id)}
                    className={`text-[10px] font-bold uppercase tracking-wider whitespace-nowrap px-3 py-1.5 rounded-lg border transition-all ${
                      active
                        ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/15"
                        : "text-gray-400 border-[#242D3D]/60 hover:border-blue-500/30 hover:text-gray-200 bg-[#1C2333]/50"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
        {/* Sidebar */}
        <div className="w-full lg:w-64 shrink-0 flex flex-col gap-4">
          {/* Saved Screens */}
          {!loading && (
            <div className="glass-card rounded-xl sm:rounded-2xl overflow-hidden glass-card-no-hover">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-[#242D3D]/60">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Saved Screens</h3>
              </div>
              <div className="p-3 space-y-2">
                {savedScreens.length === 0 ? (
                  <div className="text-center py-3">
                    <div className="w-8 h-8 rounded-lg bg-[#242D3D]/30 border border-[#242D3D]/60 flex items-center justify-center mx-auto mb-2">
                      <Save className="w-3.5 h-3.5 text-gray-500" />
                    </div>
                    <p className="text-[10px] text-gray-400 font-semibold">Save your research setups</p>
                    <p className="text-[9px] text-gray-500 mt-0.5">Store filter combinations and reload them instantly.</p>
                  </div>
                ) : (
                  savedScreens.map((sc) => {
                    const active = activeSavedId === sc.id;
                    return (
                      <div
                        key={sc.id}
                        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-all ${
                          active
                            ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/15"
                            : "bg-[#1C2333]/50 text-gray-400 border-[#242D3D]/60 hover:border-blue-500/30 hover:text-gray-200"
                        }`}
                        onClick={() => (active ? null : loadScreen(sc))}
                      >
                        <div className="min-w-0 flex-1">
                          <p className={`text-[11px] font-semibold truncate ${active ? "text-white" : "text-gray-300"}`}>
                            {sc.name}
                          </p>
                          <p className="text-[9px] text-gray-500 mt-0.5">
                            {new Date(sc.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteScreen(sc.id); }}
                          className={`p-1 rounded transition-colors shrink-0 ${
                            active
                              ? "hover:bg-white/20 text-white/70 hover:text-white"
                              : "hover:bg-red-500/10 text-gray-500 hover:text-red-400"
                          }`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Filter Panel */}
          <div className="glass-card rounded-xl sm:rounded-2xl overflow-hidden glass-card-no-hover">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="w-full flex items-center justify-between px-5 py-3 border-b border-[#242D3D]/60 lg:cursor-default"
            >
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-400" />
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Filters</h3>
                {hasActiveFilters && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                )}
              </div>
              <div className="flex items-center gap-2">
                {hasActiveFilters && (
                  <button
                    onClick={(e) => { e.stopPropagation(); clearFilters(); }}
                    className="text-[9px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-wider"
                  >
                    Clear
                  </button>
                )}
                <span className="lg:hidden">{showFilters ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}</span>
              </div>
            </button>

            {showFilters && (
              <div className="p-4 space-y-3.5">
                <FilterSelect label="Market Cap" value={marketCap} onChange={setMarketCap} options={MARKET_CAP_OPTIONS} />

                <FilterSelect
                  label="Sector"
                  value={sector}
                  onChange={setSector}
                  options={[{ value: "", label: "All" }, ...sectors.map((s) => ({ value: s, label: s }))]}
                />

                <RangeInput label="P/E Ratio" min={peMin} max={peMax} onMinChange={setPeMin} onMaxChange={setPeMax} minPlaceholder="Min" maxPlaceholder="Max" />

                <div>
                  <label className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Dividend Yield</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={divYieldMin}
                      onChange={(e) => setDivYieldMin(e.target.value)}
                      placeholder="Min %"
                      className="w-full bg-[#1C2333] border border-[#242D3D]/60 rounded-lg px-2 py-1.5 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-blue-500/50 transition-colors"
                    />
                    <span className="text-[10px] text-gray-500">%</span>
                  </div>
                </div>

                <FilterSelect label="Beta" value={beta} onChange={setBeta} options={BETA_OPTIONS} />

                <RangeInput label="Price Range" min={priceMin} max={priceMax} onMinChange={setPriceMin} onMaxChange={setPriceMax} minPlaceholder="Min" maxPlaceholder="Max" prefix="$" />

                {/* Save Screen */}
                <div className="pt-2 border-t border-[#242D3D]/40">
                  {showSaveInput ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={savingName}
                        onChange={(e) => setSavingName(e.target.value)}
                        placeholder="Screen name..."
                        className="w-full bg-[#1C2333] border border-[#242D3D]/60 rounded-lg px-2.5 py-2 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-blue-500/50 transition-colors"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === "Enter") saveScreen(); if (e.key === "Escape") { setShowSaveInput(false); setSavingName(""); } }}
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={saveScreen}
                          disabled={!savingName.trim() || savedScreens.length >= 20}
                          className="flex-1 text-[10px] font-bold uppercase tracking-wider bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setShowSaveInput(false); setSavingName(""); }}
                          className="text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                      {savedScreens.length >= 20 && (
                        <p className="text-[9px] text-red-400 text-center">Maximum 20 saved screens allowed.</p>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => { setShowSaveInput(true); setSavingName(""); }}
                      disabled={savedScreens.length >= 20}
                      className="w-full flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider bg-[#1C2333]/50 hover:bg-blue-600/10 border border-[#242D3D]/60 hover:border-blue-500/30 text-gray-400 hover:text-blue-400 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 rounded-lg transition-all"
                    >
                      <Save className="w-3 h-3" />
                      Save Screen
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="text-[10px] text-gray-600 text-center">
            {loading ? "Loading..." : `${scored.length} of ${stocks.length} stocks match`}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 min-w-0">
          {/* AI Top Picks */}
          {!loading && scored.length > 0 && (
            <div className="glass-card rounded-xl sm:rounded-2xl overflow-hidden glass-card-no-hover mb-3">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-[#242D3D]/60">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">AI Top Picks</h3>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {scored.slice(0, 3).map((s, i) => (
                  <button
                    key={s.ticker}
                    onClick={() => navigateToStock(s.ticker)}
                    className="group bg-[#1C2333]/60 border border-[#242D3D]/60 rounded-xl p-4 text-left hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/5 transition-all cursor-pointer animate-fade-in-up"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-bold text-gray-200 group-hover:text-blue-400 transition-colors">{s.ticker}</p>
                        <p className="text-[10px] text-gray-500 truncate max-w-[140px]">{s.name}</p>
                        <p className="text-[8px] text-gray-600 mt-0.5">{getPickReason(s)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 mt-1">
                        <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-xs font-black ${getScoreColor(s._score)} ${getScoreRing(s._score)} group-hover:scale-105 transition-transform`}>
                          {s._score}
                        </div>
                        {getRating(s._score) && (
                          <div className={`flex items-center gap-0.5 text-[8px] font-black uppercase tracking-wider px-1.5 py-1 rounded border ${getRatingClass(getRating(s._score))}`}>
                            {getRating(s._score) === "BUY" && <TrendingUp className="w-2.5 h-2.5" />}
                            {getRating(s._score) === "SELL" && <TrendingDown className="w-2.5 h-2.5" />}
                            {getRating(s._score) === "HOLD" && <Minus className="w-2.5 h-2.5" />}
                            {getRating(s._score)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-[#242D3D]/30">
                      <span className="text-[9px] text-gray-500 truncate max-w-[110px]">{s.sector || "—"}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-gray-300 tabular-nums">
                          {formatPrice(s.current_price, s.currency, s.ticker)}
                        </span>
                        {(() => {
                          const d = getDailyChange(s);
                          return d != null && Number.isFinite(d) ? (
                            <span className={`text-[10px] font-bold tabular-nums ${d >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {d >= 0 ? "+" : ""}{d.toFixed(2)}%
                            </span>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Rating Summary */}
          {!loading && scored.length > 0 && (
            <div className="glass-card rounded-xl sm:rounded-2xl overflow-hidden glass-card-no-hover mb-3">
              <div className="flex items-center justify-around gap-4 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">BUY</span>
                  <span className="text-xs font-black text-emerald-400 tabular-nums">{ratingCounts.buy}</span>
                </div>
                <div className="w-px h-4 bg-[#242D3D]/60" />
                <div className="flex items-center gap-2">
                  <Minus className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">HOLD</span>
                  <span className="text-xs font-black text-amber-400 tabular-nums">{ratingCounts.hold}</span>
                </div>
                <div className="w-px h-4 bg-[#242D3D]/60" />
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">SELL</span>
                  <span className="text-xs font-black text-red-400 tabular-nums">{ratingCounts.sell}</span>
                </div>
              </div>
            </div>
          )}

          {/* Search + Export */}
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none group-focus-within:text-blue-500 transition-colors" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by ticker or company name..."
                className="w-full bg-[#161B26]/60 border border-[#242D3D]/60 rounded-xl pl-9 pr-3 py-2.5 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>
            <div className="relative group">
              <button
                onClick={exportCSV}
                disabled={scored.length === 0}
                className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-3 py-2.5 rounded-xl border transition-all shrink-0 ${
                  scored.length === 0
                    ? "bg-[#1C2333]/30 border-[#242D3D]/30 text-gray-600 cursor-not-allowed"
                    : "bg-[#1C2333]/50 border-[#242D3D]/60 text-gray-400 hover:border-blue-500/30 hover:text-blue-400 hover:bg-blue-600/5"
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
              {scored.length === 0 && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-gray-800 border border-[#242D3D] text-[9px] text-gray-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  No results to export
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800" />
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div className="glass-card rounded-xl sm:rounded-2xl overflow-hidden glass-card-no-hover">
              <div className="p-5 space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-8 bg-[#242D3D]/30 rounded animate-pulse" />
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="glass-card rounded-xl sm:rounded-2xl p-8 text-center glass-card-no-hover">
              <p className="text-xs text-red-400 font-medium">{error}</p>
            </div>
          ) : scored.length === 0 ? (
            <div className="glass-card rounded-xl sm:rounded-2xl p-8 text-center glass-card-no-hover">
              <p className="text-xs text-gray-500 font-medium">No stocks match current filters.</p>
            </div>
          ) : (
            <div className="glass-card rounded-xl sm:rounded-2xl overflow-hidden glass-card-no-hover">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10 bg-[#161B26]/95 backdrop-blur-sm">
                    <tr>
                      {[
                        { label: "QL Score", field: "_score", align: "center" },
                        { label: "Rating", field: "rating", align: "center" },
                        { label: "Ticker", field: "ticker", align: "left" },
                        { label: "Company", field: "name", align: "left" },
                        { label: "Price", field: "current_price", align: "right" },
                        { label: "Daily Chg %", field: "daily", align: "right" },
                        { label: "Market Cap", field: "market_cap", align: "right" },
                        { label: "P/E", field: "pe_ratio", align: "right" },
                        { label: "Sector", field: "sector", align: "left" },
                      ].map((c) => {
                        const active = sortField === c.field;
                        return (
                          <th
                            key={c.field}
                            onClick={() => handleSort(c.field)}
                            className={`group px-3 py-3 text-[9px] font-bold uppercase tracking-wider cursor-pointer select-none transition-all border-b border-[#242D3D]/40 ${
                              active
                                ? "text-white"
                                : "text-gray-300 hover:text-white"
                            } ${
                              c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"
                            }`}
                          >
                            <span className="inline-flex items-center gap-1">
                              <span>{c.label}</span>
                              {active ? (
                                sortDir === "asc" ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />
                              ) : (
                                <span className="opacity-0 group-hover:opacity-30 transition-opacity">
                                  <ChevronDown className="w-2.5 h-2.5" />
                                </span>
                              )}
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#242D3D]/30">
                    {scored.map((s, index) => {
                      const dailyPct = s.current_price != null && s.previous_close != null && s.previous_close > 0
                        ? ((s.current_price - s.previous_close) / s.previous_close) * 100
                        : null;
                      return (
                        <tr
                          key={s.ticker}
                          onClick={() => navigateToStock(s.ticker)}
                          className="hover:bg-blue-500/5 cursor-pointer transition-colors animate-fade-in-up"
                          style={{ animationDelay: `${index * 20}ms` }}
                        >
                          <td className="px-3 py-3 text-center">
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full border-2 text-[10px] font-black ${getScoreColor(s._score)} ${getScoreRing(s._score)}`}>
                              {s._score != null ? s._score : "—"}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            {getRating(s._score) ? (
                              <span className={`inline-flex items-center gap-0.5 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${getRatingClass(getRating(s._score))}`}>
                                {getRating(s._score) === "BUY" && <TrendingUp className="w-2.5 h-2.5" />}
                                {getRating(s._score) === "SELL" && <TrendingDown className="w-2.5 h-2.5" />}
                                {getRating(s._score) === "HOLD" && <Minus className="w-2.5 h-2.5" />}
                                {getRating(s._score)}
                              </span>
                            ) : (
                              <span className="text-[9px] text-gray-600">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 font-bold text-gray-200">{s.ticker}</td>
                          <td className="px-3 py-3 text-gray-400 max-w-[160px] truncate">{s.name}</td>
                          <td className="px-3 py-3 text-right font-semibold text-gray-200 tabular-nums">
                            {formatPrice(s.current_price, s.currency, s.ticker)}
                          </td>
                          <td className={`px-3 py-3 text-right font-semibold tabular-nums ${
                            dailyPct != null
                              ? dailyPct >= 0 ? "text-emerald-400" : "text-red-400"
                              : "text-gray-500"
                          }`}>
                            {dailyPct != null && Number.isFinite(dailyPct) ? `${dailyPct >= 0 ? "+" : ""}${dailyPct.toFixed(2)}%` : "—"}
                          </td>
                          <td className="px-3 py-3 text-right text-gray-300 tabular-nums">{formatMarketCap(s.market_cap, s.currency, s.ticker)}</td>
                          <td className="px-3 py-3 text-right text-gray-300 tabular-nums">{s.pe_ratio != null && Number.isFinite(s.pe_ratio) ? s.pe_ratio.toFixed(2) : "—"}</td>
                          <td className="px-3 py-3 text-gray-400 max-w-[120px] truncate">{s.sector || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1C2333] border border-emerald-500/30 rounded-xl px-4 py-2.5 shadow-xl shadow-emerald-500/5 animate-in fade-in slide-in-from-bottom-2">
          <p className="text-[11px] font-semibold text-emerald-400 flex items-center gap-2">
            <Download className="w-3.5 h-3.5" />
            {toast}
          </p>
        </div>
      )}
    </div>
  );
};
