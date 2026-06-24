import React, { useState, useEffect, useRef } from "react";
import { Search, Loader2, ArrowRight } from "lucide-react";
import { api } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { StockLogo } from "./StockLogo.jsx";

export const GlobalSearch = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

  const searchRef = useRef(null);
  const recentSearchesKey = user ? `recent_searches_${user.email}` : "recent_searches_guest";

  // Load Recent Searches
  const loadRecentSearches = () => {
    try {
      const data = localStorage.getItem(recentSearchesKey);
      setRecentSearches(data ? JSON.parse(data) : []);
    } catch (err) {
      console.error("Failed to load recent searches:", err);
      setRecentSearches([]);
    }
  };

  useEffect(() => {
    loadRecentSearches();
  }, [recentSearchesKey]);

  // Click outside search listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search queries
  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setSuggestions([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const data = await api.get(`/stocks/search?q=${searchQuery}`);
        
        // Sort/Rank search results
        const sortedData = sortSearchResults(data, searchQuery);
        setSuggestions(sortedData);
      } catch (err) {
        console.error("Global Search API Error:", err);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Reset index when options change
  useEffect(() => {
    setActiveSuggestionIndex(-1);
  }, [suggestions, searchQuery, isSearchFocused]);

  // Sort and Rank results
  const sortSearchResults = (results, query) => {
    const q = query.toUpperCase().trim();
    return [...results].sort((a, b) => {
      const tickerA = a.ticker.toUpperCase();
      const tickerB = b.ticker.toUpperCase();

      // Priority 1: Exact ticker match
      const isExactA = tickerA === q;
      const isExactB = tickerB === q;
      if (isExactA && !isExactB) return -1;
      if (!isExactA && isExactB) return 1;

      // Priority 1.5: Prefix ticker match
      const startsWithA = tickerA.startsWith(q);
      const startsWithB = tickerB.startsWith(q);
      if (startsWithA && !startsWithB) return -1;
      if (!startsWithA && startsWithB) return 1;

      // Priority 2: US-listed primary equities
      const isUsEquityA = a.quote_type === "EQUITY" && (a.country === "United States" || a.country === "US");
      const isUsEquityB = b.quote_type === "EQUITY" && (b.country === "United States" || b.country === "US");
      if (isUsEquityA && !isUsEquityB) return -1;
      if (!isUsEquityA && isUsEquityB) return 1;

      // Priority 4: ETF (lower priority than single stocks if not exact/prefix match)
      const isEtfA = a.quote_type === "ETF";
      const isEtfB = b.quote_type === "ETF";
      if (isEtfA && !isEtfB) return 1;
      if (!isEtfA && isEtfB) return -1;

      return 0; // fallback to Yahoo's relevance sorting
    });
  };

  // Save recent search (max 10, newest to top, unique) and navigate
  const handleSelectTicker = (item) => {
    try {
      const existing = JSON.parse(localStorage.getItem(recentSearchesKey) || "[]");
      const filtered = existing.filter((s) => s.ticker.toUpperCase() !== item.ticker.toUpperCase());
      const updated = [{ ticker: item.ticker.toUpperCase(), name: item.name }, ...filtered].slice(0, 10);
      localStorage.setItem(recentSearchesKey, JSON.stringify(updated));
      setRecentSearches(updated);
    } catch (err) {
      console.error("Failed to save recent search:", err);
    }

    setSearchQuery("");
    setIsSearchFocused(false);
    window.location.hash = `#/stock/${item.ticker.toUpperCase()}`;
  };

  // Keyboard navigation on search input
  const handleKeyDown = (e) => {
    const showSuggestions = searchQuery.trim().length > 0 && suggestions.length > 0;
    const showRecent = isSearchFocused && searchQuery.trim().length === 0 && recentSearches.length > 0;
    const items = showSuggestions ? suggestions : (showRecent ? recentSearches : []);

    if (items.length === 0 && e.key !== "Enter") return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestionIndex((prev) => (prev + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestionIndex((prev) => (prev - 1 + items.length) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeSuggestionIndex >= 0 && activeSuggestionIndex < items.length) {
        handleSelectTicker(items[activeSuggestionIndex]);
      } else if (searchQuery.trim().length > 0) {
        handleSelectTicker({ ticker: searchQuery, name: "" });
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsSearchFocused(false);
      e.target.blur();
    }
  };

  const showSuggestions = searchQuery.trim().length > 0 && !searchLoading;
  const showRecent = isSearchFocused && searchQuery.trim().length === 0 && recentSearches.length > 0;

  return (
    <div className="relative z-50 w-full min-w-0" ref={searchRef}>
      <div className="flex items-center gap-2 bg-[#161B26]/60 border border-[#242D3D]/60 rounded-xl px-3 py-1.5 focus-within:border-blue-500/50 transition-all w-full">
        <Search className="w-3.5 h-3.5 text-gray-500 shrink-0" />
        <input
          type="text"
          placeholder="Search stocks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => {
            setIsSearchFocused(true);
            loadRecentSearches();
          }}
          onKeyDown={handleKeyDown}
          className="bg-transparent text-xs text-gray-200 outline-none placeholder-gray-500 font-medium w-full"
        />
        {searchLoading && <Loader2 className="w-3 h-3 text-blue-500 animate-spin shrink-0" />}
      </div>

      {isSearchFocused && (
          <div className="absolute top-full right-0 md:left-0 mt-1.5 bg-[#0F131C]/95 border border-[#2E3C54]/60 rounded-xl shadow-2xl z-50 backdrop-blur-xl overflow-hidden divide-y divide-[#242D3D]/50 w-screen max-w-[320px] xs:max-w-[360px] sm:max-w-[400px] md:max-w-md lg:max-w-lg right-0 md:right-auto max-h-64 overflow-y-auto">
          {/* Loading state */}
          {searchLoading && searchQuery.trim().length > 0 && (
            <div className="px-4 py-3 text-xs text-gray-400 font-medium flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
              Searching...
            </div>
          )}

          {/* Suggestions List */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="divide-y divide-[#242D3D]/50">
              {suggestions.map((item, index) => (
                <div
                  key={item.ticker}
                  onClick={() => handleSelectTicker(item)}
                  className={`flex justify-between items-center px-4 py-2.5 cursor-pointer transition-colors group ${
                    index === activeSuggestionIndex ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <StockLogo ticker={item.ticker} className="w-6 h-6 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-white group-hover:text-blue-400 transition-colors truncate">
                          {item.ticker}
                        </span>
                        <span className="text-[8px] text-gray-500 font-bold bg-[#161B26] border border-[#242D3D] px-1 rounded shrink-0">
                          {item.country || "US"}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 font-light truncate mt-0.5">{item.name}</p>
                    </div>
                  </div>
                  <div className="text-right text-[8px] text-gray-500 font-bold uppercase tracking-wider shrink-0 pl-2">
                    <p>{item.sector || "Indices"}</p>
                    <p className="font-light mt-0.5">{item.quote_type || "EQUITY"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {showSuggestions && suggestions.length === 0 && (
            <div className="px-4 py-4 text-center text-xs text-gray-400 font-medium">
              No matching stocks found
            </div>
          )}

          {/* Recent Searches */}
          {showRecent && (
            <div>
              <div className="px-4 py-1.5 bg-[#161B26]/30 text-[9px] text-gray-500 font-bold uppercase tracking-wider">
                Recent Searches
              </div>
              <div className="divide-y divide-[#242D3D]/50">
                {recentSearches.map((item, index) => (
                  <div
                    key={item.ticker}
                    onClick={() => handleSelectTicker(item)}
                    className={`flex justify-between items-center px-4 py-2.5 cursor-pointer transition-colors group ${
                      index === activeSuggestionIndex ? "bg-white/10" : "hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <StockLogo ticker={item.ticker} className="w-6 h-6 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-xs font-extrabold text-white group-hover:text-blue-400 transition-colors">
                          {item.ticker}
                        </span>
                        <p className="text-[9px] text-gray-400 font-light truncate">{item.name}</p>
                      </div>
                    </div>
                    <div className="text-gray-500 group-hover:text-blue-400 transition-colors pr-1">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
