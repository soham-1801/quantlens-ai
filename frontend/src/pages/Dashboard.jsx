/* eslint-disable react-hooks/set-state-in-effect, react-hooks/immutability */
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useWatchlist } from "../context/WatchlistContext";
import { Search, Star, Trash2, ArrowUpRight, ArrowDownRight, TrendingUp, RefreshCcw, ArrowRight, TrendingDown, Compass } from "lucide-react";
import { StockLogo } from "../components/StockLogo";
import { Skeleton } from "../components/Skeleton";
import { formatPrice } from "../utils/format";

const WatchlistSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-5">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="glass-card rounded-2xl p-5 min-h-[176px] animate-fade-in-up" style={{ animationDelay: `${i * 60}ms` }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="w-20 h-4" />
              <Skeleton className="w-32 h-3" />
            </div>
          </div>
          <div className="flex gap-1">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <Skeleton className="w-8 h-8 rounded-lg" />
          </div>
        </div>
        <div className="mt-6 flex items-end justify-between border-t border-[#242D3D]/30 pt-4">
          <div className="space-y-2">
            <Skeleton className="w-16 h-3" />
            <Skeleton className="w-24 h-5" />
          </div>
          <Skeleton className="w-16 h-8 rounded-xl" />
        </div>
      </div>
    ))}
  </div>
);

export const Dashboard = () => {
  const { user } = useAuth();
  const [recentSearches, setRecentSearches] = useState([]);
  const [lastViewed, setLastViewed] = useState([]);
  const { watchlist, loading: watchlistLoading, removeFromWatchlist, refreshItem } = useWatchlist();
  const [refreshingTicker, setRefreshingTicker] = useState("");

  const recentSearchesKey = user ? `recent_searches_${user.email}` : "recent_searches_guest";
  const lastViewedKey = user ? `last_viewed_stocks_${user.email}` : "last_viewed_stocks_guest";

  const loadActivityData = () => {
    try {
      const searches = localStorage.getItem(recentSearchesKey);
      setRecentSearches(searches ? JSON.parse(searches) : []);
      const viewed = localStorage.getItem(lastViewedKey);
      setLastViewed(viewed ? JSON.parse(viewed) : []);
    } catch (err) {
      console.error("Failed to load research workspace data:", err);
    }
  };

  useEffect(() => { loadActivityData(); }, [user]);

  const handleSelectTicker = (item) => {
    window.location.hash = `#/stock/${item.ticker.toUpperCase()}`;
  };

  const handleRemoveFromWatchlist = async (e, ticker) => {
    e.stopPropagation();
    try { await removeFromWatchlist(ticker); } catch (err) { console.error("Watchlist deletion failed:", err); }
  };

  const handleRefreshTicker = async (ticker) => {
    setRefreshingTicker(ticker);
    try { await refreshItem(ticker); } catch (err) { console.error(`Failed to refresh stock quote for ${ticker}:`, err); }
    finally { setRefreshingTicker(""); }
  };

  const sortedWatchlist = [...watchlist].sort((a, b) => {
    const changeA = a.price_change_percent;
    const changeB = b.price_change_percent;
    const hasChangeA = changeA !== null && changeA !== undefined;
    const hasChangeB = changeB !== null && changeB !== undefined;
    if (hasChangeA && hasChangeB) return changeB - changeA;
    if (hasChangeA && !hasChangeB) return -1;
    if (!hasChangeA && hasChangeB) return 1;
    return a.ticker.localeCompare(b.ticker);
  });

  const hasActivity = recentSearches.length > 0 || lastViewed.length > 0;

  return (
    <div className="space-y-4 sm:space-y-6 md:space-y-8 max-w-5xl mx-auto animate-fade-in">
      {/* Banner Card */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600/8 via-blue-500/4 to-transparent border border-blue-500/15 p-5 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/4 rounded-full blur-3xl pointer-events-none" />
        <h2 className="text-lg sm:text-xl md:text-2xl font-extrabold text-gray-100 tracking-tight">
          Workspace Overview
        </h2>
        <p className="text-xs sm:text-sm text-gray-400 font-light max-w-2xl leading-relaxed mt-1.5">
          Welcome back, <span className="text-blue-400 font-bold">{user?.full_name || user?.email}</span>. Search for stocks or manage your watchlist below.
        </p>
      </div>

      {/* Activity Panel */}
      {hasActivity ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
          <div className="glass-card rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-6 space-y-3 sm:space-y-4 animate-fade-in-up">
            <div>
              <h3 className="font-bold text-gray-200 text-xs sm:text-sm tracking-wide uppercase flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-500" /> Recent Searches
              </h3>
              <p className="text-xs text-gray-500 font-light mt-0.5">Your last 10 searched tickers</p>
            </div>
            {recentSearches.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((item, i) => (
                  <button
                    key={item.ticker}
                    onClick={() => handleSelectTicker(item)}
                    className="inline-flex items-center gap-2 bg-[#10141D]/80 border border-[#242D3D]/50 hover:border-blue-500/40 px-3 py-2 rounded-xl cursor-pointer transition-all hover:scale-[1.02] group active:scale-[0.98] animate-fade-in"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <StockLogo ticker={item.ticker} className="w-5 h-5 shrink-0" />
                    <span className="text-xs font-extrabold text-white group-hover:text-blue-400 transition-colors">
                      {item.ticker}
                    </span>
                    <ArrowRight className="w-3 h-3 text-gray-600 group-hover:text-blue-400 transition-colors" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 font-light italic">No recent searches yet.</p>
            )}
          </div>

          <div className="glass-card rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-6 space-y-3 sm:space-y-4 animate-fade-in-up delay-2">
            <div>
              <h3 className="font-bold text-gray-200 text-xs sm:text-sm tracking-wide uppercase flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" /> Last Viewed
              </h3>
              <p className="text-xs text-gray-500 font-light mt-0.5">Last 5 stock detail pages visited</p>
            </div>
            {lastViewed.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {lastViewed.map((item, i) => (
                  <button
                    key={item.ticker}
                    onClick={() => handleSelectTicker(item)}
                    className="inline-flex items-center gap-2 bg-[#10141D]/80 border border-[#242D3D]/50 hover:border-blue-500/40 px-3 py-2 rounded-xl cursor-pointer transition-all hover:scale-[1.02] group active:scale-[0.98] animate-fade-in"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <StockLogo ticker={item.ticker} className="w-5 h-5 shrink-0" />
                    <div className="leading-none text-left">
                      <span className="text-xs font-extrabold text-white group-hover:text-blue-400 transition-colors">
                        {item.ticker}
                      </span>
                      {item.name && (
                        <p className="text-[9px] text-gray-500 truncate max-w-[100px] mt-0.5" title={item.name}>{item.name}</p>
                      )}
                    </div>
                    <ArrowRight className="w-3 h-3 text-gray-600 group-hover:text-blue-400 transition-colors ml-0.5" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 font-light italic">No visited stocks yet.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-center animate-fade-in-up">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#0B0F19]/60 border border-[#242D3D]/60 mb-4">
            <Compass className="w-6 h-6 text-gray-500" />
          </div>
          <h3 className="text-sm font-bold text-gray-300 mb-1">Start Exploring</h3>
          <p className="text-xs text-gray-500 font-light max-w-xs mx-auto leading-relaxed">
            Search for any stock using the global search bar above to begin building your research workspace.
          </p>
        </div>
      )}

      {/* Watchlist Section */}
      <div className="glass-card rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-6 space-y-3 sm:space-y-4 animate-fade-in-up delay-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-200 text-xs sm:text-sm tracking-wide uppercase flex items-center gap-2">
              <Star className="w-4 h-4 text-blue-500 fill-blue-500/20" /> Watchlist
            </h3>
            <p className="text-xs text-gray-500 font-light mt-0.5">
              {sortedWatchlist.length > 0
                ? `${sortedWatchlist.length} stock${sortedWatchlist.length !== 1 ? "s" : ""} tracked`
                : "Real-time ticker tracking and daily movements"}
            </p>
          </div>
        </div>

        {watchlistLoading ? (
          <WatchlistSkeleton />
        ) : sortedWatchlist.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-5">
            {sortedWatchlist.map((item, idx) => {
              const isPositive = item.price_change_percent != null && Number.isFinite(item.price_change_percent) && item.price_change_percent >= 0;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelectTicker(item)}
                  className="glass-card rounded-2xl p-5 cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-[160px] group animate-fade-in-up"
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  <div className="absolute -top-10 -right-10 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors pointer-events-none" />

                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <StockLogo ticker={item.ticker} website={item.website} className="w-10 h-10 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-black text-white group-hover:text-blue-400 transition-colors truncate">
                            {item.ticker}
                          </h4>
                           <span className="text-[8px] text-gray-500 font-bold bg-[#0B0F19] border border-[#242D3D] px-1 py-0.5 rounded uppercase shrink-0">
                            {item.ticker.endsWith(".NS") || item.ticker.endsWith(".BO") ? "IN" : "US"}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 font-light truncate mt-0.5" title={item.company_name || ""}>
                          {item.company_name || "—"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleRefreshTicker(item.ticker)}
                        disabled={refreshingTicker === item.ticker}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors border border-transparent hover:border-blue-500/20 active:scale-90"
                        title="Refresh"
                      >
                        <RefreshCcw className={`w-3.5 h-3.5 ${refreshingTicker === item.ticker ? "animate-spin text-blue-500" : ""}`} />
                      </button>
                      <button
                        onClick={(e) => handleRemoveFromWatchlist(e, item.ticker)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-500/20 active:scale-90"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-auto flex items-end justify-between border-t border-[#242D3D]/25 pt-3">
                    <div>
                      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Price</p>
                      <p className="text-base font-black text-white mt-0.5 tabular-nums">
                        {formatPrice(item.current_price, item.currency, item.ticker)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Change</p>
                      {item.price_change_percent != null && Number.isFinite(item.price_change_percent) ? (
                        <span className={`inline-flex items-center gap-1 font-bold text-xs mt-1 px-2 py-0.5 rounded-lg ${
                          isPositive
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-red-500/10 text-red-400 border border-red-500/20"
                        }`}>
                          {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {isPositive ? "+" : ""}{item.price_change_percent.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-gray-500 font-semibold text-xs mt-1 block">—</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center border border-dashed border-[#242D3D]/50 rounded-xl">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#0B0F19]/60 border border-[#242D3D]/60 mb-3">
              <TrendingDown className="w-5 h-5 text-gray-600" />
            </div>
            <p className="text-sm font-semibold text-gray-300 mb-1">No stocks tracked yet</p>
            <p className="text-xs text-gray-500 font-light max-w-xs mx-auto">
              Search for stocks using the global search bar to add them to your watchlist.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
