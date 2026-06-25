import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useWatchlist } from "../context/WatchlistContext";
import { GlobalSearch } from "./GlobalSearch";
import {
  LogOut,
  User as UserIcon,
  Layers,
  Star,
  GitCompare,
  Filter,
  ShieldCheck,
  Server,
  Menu,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: <Layers className="w-4 h-4" />, badgeKey: null },
  { id: "watchlist", label: "Watchlist", icon: <Star className="w-4 h-4" />, badgeKey: "watchlist" },
  { id: "compare", label: "Compare", icon: <GitCompare className="w-4 h-4" />, badgeKey: null },
  { id: "screener", label: "Screener", icon: <Filter className="w-4 h-4" />, badgeKey: null },
];

export const Layout = ({ children, onNavigate, currentPage }) => {
  const { user, logout } = useAuth();
  const { count } = useWatchlist();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [currentPage]);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="h-screen bg-[#0B0F19] text-gray-100 flex flex-col md:flex-row overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar — persistent on md+, drawer on mobile */}
      <aside
        className={`
          fixed md:sticky inset-y-0 md:top-0 left-0 z-50
          w-72 md:w-64 md:h-screen
          bg-[#111622] border-r border-[#242D3D]
          flex flex-col shrink-0
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {/* Brand */}
        <div className="p-5 md:p-6 border-b border-[#242D3D] flex items-center gap-3">
          <div className="bg-blue-600/10 p-2 rounded-lg border border-blue-500/20">
            <ShieldCheck className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-base md:text-lg leading-tight tracking-tight bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent truncate">
              QuantLens
            </h1>
            <span className="text-[9px] md:text-[10px] text-gray-500 font-semibold tracking-widest uppercase">
              AI Research Platform
            </span>
          </div>
          <button
            onClick={closeSidebar}
            className="md:hidden p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#1C2333] transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 md:p-4 space-y-1 md:space-y-2 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = currentPage === item.id;
            const badge = item.badgeKey === "watchlist" && count > 0 ? count : null;
            return (
              <button
                key={item.id}
                onClick={() => { onNavigate(item.id); closeSidebar(); }}
                className={`w-full flex items-center justify-between gap-3 px-3 md:px-4 py-2.5 md:py-3 rounded-xl transition-all duration-300 font-medium text-xs md:text-sm min-h-[44px] ${
                  active
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                    : "text-gray-400 hover:bg-[#1C2333] hover:text-gray-200"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <span className="flex items-center gap-3">
                  {item.icon}
                  {item.label}
                </span>
                {badge != null && (
                  <span
                    className={`text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[20px] min-h-[20px] flex items-center justify-center leading-none ${
                      active
                        ? "bg-white/20 text-white"
                        : "bg-blue-500/15 text-blue-400 border border-blue-500/20"
                    }`}
                    aria-label={`${badge} items`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User card */}
        <div className="p-3 md:p-4 border-t border-[#242D3D] bg-[#0E131E]/80">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 truncate min-w-0">
              <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-blue-600/10 border border-blue-500/30 flex items-center justify-center shrink-0">
                <UserIcon className="w-3.5 h-3.5 md:w-4 md:h-4 text-blue-400" />
              </div>
              <div className="truncate min-w-0">
                <p className="text-[8px] md:text-[9px] text-gray-500 font-bold uppercase tracking-wider">
                  Account
                </p>
                <h4 className="text-xs md:text-sm font-medium text-gray-200 truncate">
                  {user?.full_name || user?.email || "Demo User"}
                </h4>
              </div>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="p-2 min-w-[36px] min-h-[36px] md:min-w-[40px] md:min-h-[40px] flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Header bar */}
        <header className="sticky top-0 h-14 md:h-16 border-b border-[#242D3D] bg-[#111622]/80 backdrop-blur-md px-3 md:px-6 flex items-center justify-between z-30 gap-2">
          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
            {/* Hamburger */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-gray-400 hover:text-white rounded-lg hover:bg-[#1C2333] transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
              <span className="text-[9px] md:text-[10px] font-bold px-1.5 md:px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wide shrink-0 whitespace-nowrap">
                Auth Stable
              </span>
              <div className="flex-1 max-w-[160px] xs:max-w-[200px] sm:max-w-xs md:max-w-sm">
                <GlobalSearch />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 md:gap-2 text-[9px] md:text-xs text-gray-400 bg-[#161B26] px-2 md:px-3 py-1 md:py-1.5 rounded-lg border border-[#242D3D] shrink-0">
            <Server className="w-3 h-3 md:w-3.5 md:h-3.5 text-emerald-400" />
            <span className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="hidden xs:inline">API Online</span>
          </div>
        </header>

        {/* Content with responsive padding */}
        <div className="flex-1 p-3 sm:p-4 md:p-6 lg:p-8 w-full mx-auto animate-fade-in"
          style={{ maxWidth: "1440px" }}
        >
          {children}
        </div>
      </main>
    </div>
  );
};
