/* eslint-disable react-hooks/set-state-in-effect, react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { api } from "../services/api";
import { toast } from "react-hot-toast";

const WatchlistContext = createContext(null);

export const WatchlistProvider = ({ children }) => {
  const { user } = useAuth();
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadWatchlist = useCallback(async () => {
    if (!user) {
      setWatchlist([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api.get("/watchlist/");
      setWatchlist(data || []);
    } catch (err) {
      console.error("Error loading watchlist:", err);
      setWatchlist([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  const addToWatchlist = async (ticker) => {
    try {
      await api.post("/watchlist/", { ticker });
      await loadWatchlist();
      toast.success(`${ticker} added to watchlist`);
    } catch (err) {
      console.error("Error adding to watchlist:", err);
      toast.error(`Failed to add ${ticker}`);
      throw err;
    }
  };

  const removeFromWatchlist = async (ticker) => {
    try {
      await api.delete(`/watchlist/${ticker}`);
      setWatchlist((prev) => prev.filter((item) => item.ticker.toUpperCase() !== ticker.toUpperCase()));
      toast.success(`${ticker} removed from watchlist`);
    } catch (err) {
      console.error("Error removing from watchlist:", err);
      toast.error(`Failed to remove ${ticker}`);
      throw err;
    }
  };

  const refreshItem = async (ticker) => {
    try {
      const updated = await api.post(`/watchlist/${ticker}/refresh`);
      setWatchlist((prev) =>
        prev.map((item) =>
          item.ticker.toUpperCase() === ticker.toUpperCase() ? updated : item
        )
      );
      toast.success(`${ticker} data refreshed`);
      return updated;
    } catch (err) {
      console.error("Error refreshing watchlist item:", err);
      toast.error(`Failed to refresh ${ticker}`);
      throw err;
    }
  };

  const value = {
    watchlist,
    loading,
    count: watchlist.length,
    addToWatchlist,
    removeFromWatchlist,
    refreshItem,
  };

  return (
    <WatchlistContext.Provider value={value}>
      {children}
    </WatchlistContext.Provider>
  );
};

export const useWatchlist = () => {
  const context = useContext(WatchlistContext);
  if (!context) {
    throw new Error("useWatchlist must be used within a WatchlistProvider");
  }
  return context;
};
