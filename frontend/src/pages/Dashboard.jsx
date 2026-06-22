import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useWatchlist } from "../context/WatchlistContext";
import { Search, Loader2, Star, Trash2, ArrowUpRight, ArrowDownRight, TrendingUp, RefreshCcw, ArrowRight } from "lucide-react";
import { StockLogo } from "../components/StockLogo";

export const Dashboard = () => {
  const { user } = useAuth();
  
  // Activity Workspace state
  const [recentSearches, setRecentSearches] = useState([]);
  const [lastViewed, setLastViewed] = useState([]);
  
  // Watchlist from shared context (single source of truth)
  const { watchlist, loading: watchlistLoading, removeFromWatchlist, refreshItem } = useWatchlist();
  const [refreshingTicker, setRefreshingTicker] = useState("");

  const recentSearchesKey = user ? `recent_searches_${user.email}` : "recent_searches_guest";
  const lastViewedKey = user ? `last_viewed_stocks_${user.email}` : "last_viewed_stocks_guest";

  // Load Activity & Research Workspace Data
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

  useEffect(() => {
    loadActivityData();
  }, [user]);

  // Navigate to stock details
  const handleSelectTicker = (item) => {
    window.location.hash = `#/stock/${item.ticker.toUpperCase()}`;
  };

  // Remove ticker from watchlist
  const handleRemoveFromWatchlist = async (e, ticker) => {
    e.stopPropagation();
    try {
      await removeFromWatchlist(ticker);
    } catch (err) {
      console.error("Watchlist deletion failed:", err);
    }
  };

  // Manual refresh of specific stock details
  const handleRefreshTicker = async (ticker) => {
    setRefreshingTicker(ticker);
    try {
      await refreshItem(ticker);
    } catch (err) {
      console.error(`Failed to refresh stock quote for ${ticker}:`, err);
    } finally {
      setRefreshingTicker("");
    }
  };

  // Sorted Watchlist: Biggest gainers first, alphabetical as fallback
  const sortedWatchlist = [...watchlist].sort((a, b) => {
    const changeA = a.price_change_percent;
    const changeB = b.price_change_percent;
    
    const hasChangeA = changeA !== null && changeA !== undefined;
    const hasChangeB = changeB !== null && changeB !== undefined;
    
    if (hasChangeA && hasChangeB) {
      return changeB - changeA;
    }
    if (hasChangeA && !hasChangeB) return -1;
    if (!hasChangeA && hasChangeB) return 1;
    
    return a.ticker.localeCompare(b.ticker);
  });

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Banner Card */}
      <div className="bg-gradient-to-r from-blue-600/10 via-blue-500/5 to-transparent border border-blue-500/20 p-8 rounded-3xl space-y-2 relative overflow-hidden backdrop-blur-md">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <h2 className="text-xl md:text-2xl font-extrabold text-gray-100 flex items-center gap-2">
          Workspace Overview
        </h2>
        <p className="text-xs md:text-sm text-gray-400 font-light max-w-2xl leading-relaxed">
          Welcome back, <span className="text-blue-400 font-bold">{user?.full_name || user?.email}</span>. Start searching for equity tickers or manage your current watchlists below.
        </p>
      </div>

      {/* Research Workspace Activity Panel */}
      {recentSearches.length > 0 || lastViewed.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Column 1: Recent Searches */}
          <div className="bg-[#161B26]/40 border border-[#242D3D]/60 rounded-3xl p-6 backdrop-blur-md space-y-4">
            <div>
              <h3 className="font-bold text-gray-200 text-sm tracking-wide uppercase flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-500" /> Recent Searches
              </h3>
              <p className="text-xs text-gray-400 font-light mt-0.5">
                Your last 10 searched tickers
              </p>
            </div>
            
            {recentSearches.length > 0 ? (
              <div className="flex flex-wrap gap-2.5">
                {recentSearches.map((item) => (
                  <div
                    key={item.ticker}
                    onClick={() => handleSelectTicker(item)}
                    className="flex items-center gap-2 bg-[#10141D]/80 border border-[#242D3D]/50 hover:border-blue-500/40 px-3.5 py-2 rounded-xl cursor-pointer transition-all hover:scale-[1.02] group"
                  >
                    <StockLogo ticker={item.ticker} className="w-5 h-5 shrink-0" />
                    <span className="text-xs font-extrabold text-white group-hover:text-blue-400 transition-colors">
                      {item.ticker}
                    </span>
                    <ArrowRight className="w-3 h-3 text-gray-600 group-hover:text-blue-400 transition-colors ml-1" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 font-light italic">No recent searches yet.</p>
            )}
          </div>

          {/* Column 2: Last Viewed Stocks */}
          <div className="bg-[#161B26]/40 border border-[#242D3D]/60 rounded-3xl p-6 backdrop-blur-md space-y-4">
            <div>
              <h3 className="font-bold text-gray-200 text-sm tracking-wide uppercase flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" /> Last Viewed Stocks
              </h3>
              <p className="text-xs text-gray-400 font-light mt-0.5">
                Last 5 stock detail pages visited
              </p>
            </div>
            
            {lastViewed.length > 0 ? (
              <div className="flex flex-wrap gap-2.5">
                {lastViewed.map((item) => (
                  <div
                    key={item.ticker}
                    onClick={() => handleSelectTicker(item)}
                    className="flex items-center gap-2 bg-[#10141D]/80 border border-[#242D3D]/50 hover:border-blue-500/40 px-3.5 py-2 rounded-xl cursor-pointer transition-all hover:scale-[1.02] group"
                  >
                    <StockLogo ticker={item.ticker} className="w-5 h-5 shrink-0" />
                    <div className="leading-none">
                      <span className="text-xs font-extrabold text-white group-hover:text-blue-400 transition-colors font-bold">
                        {item.ticker}
                      </span>
                      <p className="text-[9px] text-gray-500 truncate max-w-[120px] mt-1" title={item.name}>{item.name}</p>
                    </div>
                    <ArrowRight className="w-3 h-3 text-gray-600 group-hover:text-blue-400 transition-colors ml-1" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 font-light italic">No visited stocks yet.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-[#161B26]/40 border border-[#242D3D]/60 rounded-3xl p-8 backdrop-blur-md text-center text-xs text-gray-400 font-medium flex flex-col items-center justify-center space-y-3">
          <div className="p-3.5 rounded-2xl bg-[#0B0F19]/60 border border-[#242D3D]/60">
            <TrendingUp className="w-7 h-7 text-gray-500" />
          </div>
          <p className="text-gray-300 font-semibold max-w-sm leading-relaxed">
            Search for stocks using the global search bar to begin building your research workspace.
          </p>
        </div>
      )}

      {/* Watchlist Section */}
      <div className="bg-[#161B26]/40 border border-[#242D3D]/60 rounded-3xl p-6 backdrop-blur-md space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold text-gray-200 text-sm tracking-wide uppercase flex items-center gap-2">
              <Star className="w-4 h-4 text-blue-500 fill-blue-500/10" /> My Watchlist
            </h3>
            <p className="text-xs text-gray-400 font-light mt-0.5">
              Real-time ticker tracking and daily movements
            </p>
          </div>
        </div>

        {watchlistLoading ? (
          <div className="py-12 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : sortedWatchlist.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {sortedWatchlist.map((item) => {
              const isPositive = item.price_change_percent != null && Number.isFinite(item.price_change_percent) && item.price_change_percent >= 0;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelectTicker(item)}
                  className="bg-[#161B26]/40 border border-[#242D3D]/60 hover:border-blue-500/30 rounded-3xl p-5 backdrop-blur-md transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/5 group cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-[176px]"
                >
                  <div className="absolute -top-10 -right-10 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors pointer-events-none"></div>
                  
                  {/* Top Row: Logo, Ticker, Name, Actions */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <StockLogo ticker={item.ticker} website={item.website} className="w-10 h-10" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-black text-white group-hover:text-blue-400 transition-colors truncate" title={item.ticker}>
                            {item.ticker}
                          </h4>
                          <span className="text-[9px] text-gray-500 font-bold bg-[#0B0F19] border border-[#242D3D] px-1 py-0.5 rounded uppercase shrink-0">
                            US
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 font-light truncate mt-0.5" title={item.company_name || "N/A"}>
                          {item.company_name || "N/A"}
                        </p>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleRefreshTicker(item.ticker)}
                        disabled={refreshingTicker === item.ticker}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors border border-transparent hover:border-blue-500/20 active:scale-95 bg-transparent"
                        title="Refresh Stock Data"
                      >
                        <RefreshCcw className={`w-3.5 h-3.5 ${refreshingTicker === item.ticker ? "animate-spin text-blue-500" : ""}`} />
                      </button>
                      <button
                        onClick={(e) => handleRemoveFromWatchlist(e, item.ticker)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-500/20 active:scale-95 bg-transparent"
                        title="Remove Ticker"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Bottom Row: Price and Change */}
                  <div className="mt-4 flex items-end justify-between border-t border-[#242D3D]/30 pt-3">
                    <div>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                        Current Price
                      </p>
                      <p className="text-base font-black text-white mt-0.5">
                        {item.current_price != null && Number.isFinite(item.current_price) ? `$${item.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "N/A"}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                        Change (%)
                      </p>
                      {item.price_change_percent != null && Number.isFinite(item.price_change_percent) ? (
                        <span
                          className={`inline-flex items-center gap-1 font-bold text-xs mt-1 px-2.5 py-0.5 rounded-xl ${
                            isPositive ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
                          }`}
                        >
                          {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                          {Number.isFinite(item.price_change_percent) ? `${isPositive ? "+" : ""}${item.price_change_percent.toFixed(2)}` : "N/A"}%
                        </span>
                      ) : (
                        <span className="text-gray-500 font-semibold text-xs mt-1 inline-block">N/A</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Bottom Line Hover Indicator */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-gray-500 border border-dashed border-[#242D3D]/50 rounded-2xl flex flex-col items-center justify-center space-y-2">
            <TrendingUp className="w-8 h-8 text-gray-600" />
            <p className="font-medium text-gray-300">Start tracking stocks by searching in the global search bar at the top.</p>
          </div>
        )}
      </div>
    </div>
  );
};

