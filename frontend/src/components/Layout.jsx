import React from "react";
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
} from "lucide-react";

export const Layout = ({ children, onNavigate, currentPage }) => {
  const { user, logout } = useAuth();
  const { count } = useWatchlist();

  const navItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: <Layers className="w-4 h-4" />,
      badge: null,
    },
    {
      id: "watchlist",
      label: "Watchlist",
      icon: <Star className="w-4 h-4" />,
      badge: count > 0 ? count : null,
    },
    {
      id: "compare",
      label: "Compare",
      icon: <GitCompare className="w-4 h-4" />,
      badge: null,
    },
    {
      id: "screener",
      label: "Screener",
      icon: <Filter className="w-4 h-4" />,
      badge: null,
    },
  ];

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-[#111622] border-b md:border-b-0 md:border-r border-[#242D3D] flex flex-col shrink-0">
        {/* Brand */}
        <div className="p-6 border-b border-[#242D3D] flex items-center gap-3">
          <div className="bg-blue-600/10 p-2 rounded-lg border border-blue-500/20">
            <ShieldCheck className="w-6 h-6 text-blue-500 animate-pulse" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-wider bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              QUANTLENS AI
            </h1>
            <span className="text-[10px] text-gray-500 font-semibold tracking-widest uppercase">
              Foundation Core
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-medium text-sm ${
                  active
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                    : "text-gray-400 hover:bg-[#1C2333] hover:text-gray-200"
                }`}
              >
                <span className="flex items-center gap-3">
                  {item.icon}
                  {item.label}
                </span>
                {item.badge != null && (
                  <span
                    className={`text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none ${
                      active
                        ? "bg-white/20 text-white"
                        : "bg-blue-500/15 text-blue-400 border border-blue-500/20"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User card */}
        <div className="p-4 border-t border-[#242D3D] bg-[#0E131E]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 truncate">
              <div className="w-8 h-8 rounded-full bg-blue-600/10 border border-blue-500/30 flex items-center justify-center shrink-0">
                <UserIcon className="w-4 h-4 text-blue-400" />
              </div>
              <div className="truncate">
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">
                  Account
                </p>
                <h4 className="text-sm font-medium text-gray-200 truncate">
                  {user?.full_name || user?.email || "Demo User"}
                </h4>
              </div>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header bar */}
        <header className="h-16 border-b border-[#242D3D] bg-[#111622]/80 backdrop-blur-md px-6 flex items-center justify-between relative z-40">
          <div className="flex items-center gap-3 w-full max-w-[240px] xs:max-w-[280px] sm:max-w-sm md:max-w-md">
            <span className="text-[10px] font-bold px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wide shrink-0">
              Auth Stable
            </span>
            <GlobalSearch />
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-[#161B26] px-3 py-1.5 rounded-lg border border-[#242D3D]">
            <Server className="w-3.5 h-3.5 text-emerald-400" />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span>API Online</span>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-6 md:p-8 max-w-[1440px] w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
