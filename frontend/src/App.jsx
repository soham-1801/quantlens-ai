import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { WatchlistProvider } from "./context/WatchlistContext";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Dashboard } from "./pages/Dashboard";
import { StockDetail } from "./pages/StockDetail";
import { Watchlist } from "./pages/Watchlist";
import { Compare } from "./pages/Compare";
import { Screener } from "./pages/Screener";
import { Loader2 } from "lucide-react";

const AppContent = () => {
  const { isAuthenticated, loading } = useAuth();
  
  // Track location hash for path-bookmark routing
  const [currentHash, setCurrentHash] = useState(window.location.hash || "#/login");

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash || "#/login");
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const navigateTo = (path) => {
    window.location.hash = path;
  };

  // If loading user profile from token on page reload
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0F19] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">
          Authenticating session...
        </p>
      </div>
    );
  }

  // Guest Routing
  if (!isAuthenticated) {
    if (currentHash === "#/register") {
      return <Register onNavigate={(page) => navigateTo(`#/${page}`)} />;
    }
    return <Login onNavigate={(page) => navigateTo(`#/${page}`)} />;
  }

  // Redirect to dashboard if logged-in user hits guest forms or blank hash
  if (currentHash === "#/login" || currentHash === "#/register" || currentHash === "#/" || currentHash === "") {
    window.location.hash = "#/dashboard";
    return null;
  }

  // Authenticated Routing
  const renderAuthenticatedPage = () => {
    if (currentHash === "#/screener") {
      return <Screener />;
    }
    if (currentHash === "#/compare") {
      return <Compare />;
    }
    if (currentHash.startsWith("#/stock/")) {
      const ticker = currentHash.replace("#/stock/", "").toUpperCase().trim();
      if (ticker) {
        return <StockDetail ticker={ticker} />;
      }
    }
    if (currentHash === "#/watchlist") {
      return <Watchlist />;
    }
    return <Dashboard />;
  };

  // Helper to resolve active sidebar indicator highlights
  const resolveActiveSidebar = () => {
    if (currentHash === "#/screener") return "screener";
    if (currentHash === "#/compare") return "compare";
    if (currentHash.startsWith("#/stock/")) return "dashboard";
    const page = currentHash.replace("#/", "");
    return page || "dashboard";
  };

  return (
    <Layout onNavigate={(page) => navigateTo(`#/${page}`)} currentPage={resolveActiveSidebar()}>
      {renderAuthenticatedPage()}
    </Layout>
  );
};

function App() {
  return (
    <AuthProvider>
      <WatchlistProvider>
        <AppContent />
      </WatchlistProvider>
    </AuthProvider>
  );
}

export default App;

