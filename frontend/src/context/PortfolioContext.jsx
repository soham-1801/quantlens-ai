/* eslint-disable react-hooks/set-state-in-effect, react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { api } from "../services/api";
import { toast } from "react-hot-toast";

const PortfolioContext = createContext(null);

export const PortfolioProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [portfolio, setPortfolio] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadPortfolio = useCallback(async () => {
    if (!isAuthenticated) {
      setPortfolio([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const data = await api.get("/portfolio/");
      setPortfolio(data);
      setError(null);
    } catch (err) {
      console.error("Error loading portfolio:", err);
      setError(err.message || "Failed to load portfolio");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

  const addHolding = async (ticker, shares, averagePrice) => {
    try {
      const existing = portfolio.find(p => p.ticker.toUpperCase() === ticker.toUpperCase());
      if (existing) {
        // If it exists, update it instead
        return await updateHolding(ticker, shares, averagePrice);
      }

      await api.post("/portfolio/", { ticker, shares, average_price: averagePrice });
      await loadPortfolio();
      toast.success(`Added ${ticker} to portfolio`);
    } catch (err) {
      console.error("Error adding holding:", err);
      toast.error(err.message || `Failed to add ${ticker}`);
      throw err;
    }
  };

  const updateHolding = async (ticker, shares, averagePrice) => {
    try {
      await api.put(`/portfolio/${ticker}`, { shares, average_price: averagePrice });
      await loadPortfolio();
      toast.success(`Updated ${ticker} position`);
    } catch (err) {
      console.error("Error updating holding:", err);
      toast.error(err.message || `Failed to update ${ticker}`);
      throw err;
    }
  };

  const removeHolding = async (ticker) => {
    try {
      await api.delete(`/portfolio/${ticker}`);
      setPortfolio(prev => prev.filter(p => p.ticker.toUpperCase() !== ticker.toUpperCase()));
      toast.success(`Removed ${ticker} from portfolio`);
    } catch (err) {
      console.error("Error removing holding:", err);
      toast.error(err.message || `Failed to remove ${ticker}`);
      throw err;
    }
  };

  return (
    <PortfolioContext.Provider
      value={{
        portfolio,
        loading,
        error,
        loadPortfolio,
        addHolding,
        updateHolding,
        removeHolding
      }}
    >
      {children}
    </PortfolioContext.Provider>
  );
};

export const usePortfolio = () => {
  const context = useContext(PortfolioContext);
  if (!context) {
    throw new Error("usePortfolio must be used within a PortfolioProvider");
  }
  return context;
};
