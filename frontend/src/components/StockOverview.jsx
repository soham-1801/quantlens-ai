import { useState } from "react";
import { Globe } from "lucide-react";
import { MetricTooltip } from "./MetricTooltip";
import { StockLogo } from "./StockLogo";
import { formatPrice, getCurrencySymbol } from "../utils/format";

// 28 words ≈ 3 tight lines in the ~280px sidebar column
const WORD_LIMIT = 28;

const truncateWords = (text, maxWords = WORD_LIMIT) => {
  if (!text) return "";
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ") + "…";
};

export const StockOverview = ({ overview }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!overview) return null;

  const formatCompactNumber = (val) => {
    if (val == null || !Number.isFinite(val)) return "N/A";
    if (val >= 1e12) return `${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9)  return `${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6)  return `${(val / 1e6).toFixed(1)}M`;
    if (val >= 1e3)  return `${(val / 1e3).toFixed(1)}K`;
    return val.toLocaleString();
  };

  const descriptionWords = overview.description?.split(/\s+/) || [];
  const isTruncated = descriptionWords.length > WORD_LIMIT;
  const previewDescription = truncateWords(overview.description, WORD_LIMIT);
  const metaParts = [overview.sector, overview.industry, overview.exchange].filter(Boolean);
  const websiteUrl = overview.website?.startsWith("http")
    ? overview.website
    : overview.website
      ? `https://${overview.website}`
      : null;

  const statItems = [
    {
      label: "EPS",
      value: overview.eps != null && Number.isFinite(overview.eps) ? overview.eps.toFixed(2) : "N/A",
      tooltip: "Earnings Per Share (TTM). Net profit divided by outstanding shares.",
    },
    {
      label: "Beta",
      value: overview.beta != null && Number.isFinite(overview.beta) ? overview.beta.toFixed(2) : "N/A",
      tooltip: "Volatility relative to the overall market. Beta of 1.0 moves with the market.",
    },
    {
      label: "Volume",
      value: overview.volume != null ? formatCompactNumber(overview.volume) : "N/A",
      tooltip: "Total shares traded during the current session.",
    },
    {
      label: "Div Yield",
      value: overview.dividend_yield != null && Number.isFinite(overview.dividend_yield) ? `${(overview.dividend_yield * 100).toFixed(2)}%` : "N/A",
      tooltip: "Annual dividend payment divided by the current stock price.",
    },
    {
      label: "Open",
      value: overview.open_price != null && Number.isFinite(overview.open_price) ? formatPrice(overview.open_price, overview.currency, overview.ticker) : "N/A",
      tooltip: "Opening trade price for the current session.",
    },
    {
      label: "Prev Close",
      value: overview.previous_close != null && Number.isFinite(overview.previous_close) ? formatPrice(overview.previous_close, overview.currency, overview.ticker) : "N/A",
      tooltip: "Official closing price from the previous trading session.",
    },
    {
      label: "52W Range",
      value:
        overview.fifty_two_week_low != null && Number.isFinite(overview.fifty_two_week_low) && overview.fifty_two_week_high != null && Number.isFinite(overview.fifty_two_week_high)
          ? `${getCurrencySymbol(overview.currency, overview.ticker)}${overview.fifty_two_week_low.toFixed(0)}–${getCurrencySymbol(overview.currency, overview.ticker)}${overview.fifty_two_week_high.toFixed(0)}`
          : "N/A",
      tooltip: "Lowest and highest prices traded over the past 52 weeks.",
    },
    {
      label: "Avg Vol",
      value: overview.avg_volume != null ? formatCompactNumber(overview.avg_volume) : "N/A",
      tooltip: "Average daily trading volume over the recent period.",
    },
  ];

  return (
    <div className="bg-[#161B26]/40 border border-[#242D3D]/60 rounded-2xl backdrop-blur-md w-full flex flex-col">

      {/* ── Company Header ─────────────────────────────── */}
      <div className="px-3 pt-2.5 pb-2 border-b border-[#242D3D]/30 flex items-center gap-2 shrink-0">
        <StockLogo
          ticker={overview.ticker}
          website={overview.website}
          className="w-7 h-7 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-black text-white tracking-tight leading-none">
              {overview.ticker}
            </span>
            {websiteUrl && (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-0.5 text-[9px] text-blue-400 hover:text-blue-300 transition-colors shrink-0"
              >
                <Globe className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
          <p className="text-[11px] text-gray-300 font-medium truncate leading-none mt-[3px]">
            {overview.name}
          </p>
          {metaParts.length > 0 && (
            <p className="text-[9px] text-gray-500 truncate mt-[2px] leading-none">
              {metaParts.join(" • ")}
            </p>
          )}
        </div>
      </div>

      {/* ── Key Statistics ──────────────────────────────── */}
      <div className="px-3 pt-1.5 pb-1.5 shrink-0">
        <p className="text-[8px] text-gray-600 font-bold uppercase tracking-widest mb-0.5">
          Key Statistics
        </p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0">
          {statItems.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-1 py-[3px] border-b border-[#242D3D]/15 min-w-0"
            >
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-[9px] text-gray-500 font-semibold uppercase tracking-wide truncate leading-none">
                  {item.label}
                </span>
                <MetricTooltip text={item.tooltip} />
              </div>
              <span className="text-[10px] text-white font-bold tabular-nums shrink-0 leading-none">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── About ─────────────────────────────────────────
          The About section is FIXED HEIGHT regardless of expanded state.
          Collapsed: 80px text box + strong fade + Read More button.
          Expanded:  same 80px box becomes a scroll area — card never grows.
      ── */}
      {overview.description && (
        <div className="px-3 pt-1.5 pb-2 border-t border-[#242D3D]/25 shrink-0">
          <p className="text-[8px] text-gray-600 font-bold uppercase tracking-widest mb-[5px]">
            About
          </p>

          {/* Fixed 80px window — collapsed shows fade, expanded scrolls inside same box */}
          <div
            className="relative"
            style={{ height: 72, overflow: "hidden" }}
          >
            <div
              className="h-full overflow-y-auto pr-0.5"
              style={{ scrollbarWidth: "none" }}
            >
              <p className="text-[11px] text-gray-400 font-light leading-[1.45]">
                {isExpanded ? overview.description : previewDescription}
              </p>
            </div>

            {/* Fade overlay — hidden when expanded (user can scroll) */}
            {!isExpanded && (
              <div
                className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(to top, #161B26 0%, #161B26 20%, rgba(22,27,38,0.9) 55%, transparent 100%)",
                }}
              />
            )}
          </div>

          {isTruncated && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-[4px] text-blue-400 hover:text-blue-300 text-[9px] font-extrabold uppercase tracking-wide focus:outline-none cursor-pointer transition-colors leading-none"
            >
              {isExpanded ? "Show Less ↑" : "Read More ↓"}
            </button>
          )}
        </div>
      )}

      {/* ── Company Information ─────────────────────────
          Matches Key Statistics grid style exactly.
          Adds visual weight to balance sidebar ≈ 85–90% chart height.
      ── */}
      {(overview.sector || overview.industry || overview.exchange || overview.day_high) && (
        <div className="px-3 pt-2 pb-2.5 border-t border-[#242D3D]/25 shrink-0">
          <p className="text-[8px] text-gray-600 font-bold uppercase tracking-widest mb-0.5">
            Company Information
          </p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0">

            {/* Sector — full width row (long value) */}
            {overview.sector && (
              <div className="col-span-2 flex items-center justify-between gap-1 py-[3px] border-b border-[#242D3D]/15 min-w-0">
                <span className="text-[9px] text-gray-500 font-semibold uppercase tracking-wide leading-none shrink-0">
                  Sector
                </span>
                <span className="text-[10px] text-white font-bold leading-none truncate text-right ml-2">
                  {overview.sector}
                </span>
              </div>
            )}

            {/* Industry — full width row (long value) */}
            {overview.industry && (
              <div className="col-span-2 flex items-center justify-between gap-1 py-[3px] border-b border-[#242D3D]/15 min-w-0">
                <span className="text-[9px] text-gray-500 font-semibold uppercase tracking-wide leading-none shrink-0">
                  Industry
                </span>
                <span className="text-[10px] text-white font-bold leading-none truncate text-right ml-2">
                  {overview.industry}
                </span>
              </div>
            )}

            {/* Exchange + Day Range — side by side in the 2-col grid */}
            {overview.exchange && (
              <div className="flex items-center justify-between gap-1 py-[3px] border-b border-[#242D3D]/15 min-w-0">
                <span className="text-[9px] text-gray-500 font-semibold uppercase tracking-wide leading-none truncate">
                  Exchange
                </span>
                <span className="text-[10px] text-white font-bold tabular-nums leading-none shrink-0">
                  {overview.exchange}
                </span>
              </div>
            )}

            {overview.day_high != null && Number.isFinite(overview.day_high) && overview.day_low != null && Number.isFinite(overview.day_low) && (
              <div className="flex items-center justify-between gap-1 py-[3px] border-b border-[#242D3D]/15 min-w-0">
                <span className="text-[9px] text-gray-500 font-semibold uppercase tracking-wide leading-none truncate">
                  Day Hi
                </span>
                <span className="text-[10px] text-white font-bold tabular-nums leading-none shrink-0">
                  {formatPrice(overview.day_high, overview.currency, overview.ticker)}
                </span>
              </div>
            )}

            {/* Day Low */}
            {overview.day_low != null && Number.isFinite(overview.day_low) && (
              <div className="flex items-center justify-between gap-1 py-[3px] border-b border-[#242D3D]/15 min-w-0">
                <span className="text-[9px] text-gray-500 font-semibold uppercase tracking-wide leading-none truncate">
                  Day Lo
                </span>
                <span className="text-[10px] text-white font-bold tabular-nums leading-none shrink-0">
                  {formatPrice(overview.day_low, overview.currency, overview.ticker)}
                </span>
              </div>
            )}

            {/* Website — full width */}
            {websiteUrl && (
              <div className="col-span-2 flex items-center justify-between gap-1 py-[3px] min-w-0">
                <span className="text-[9px] text-gray-500 font-semibold uppercase tracking-wide leading-none shrink-0">
                  Website
                </span>
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-blue-400 hover:text-blue-300 font-bold leading-none truncate text-right ml-2 transition-colors"
                >
                  {overview.website.replace(/^https?:\/\/(www\.)?/, "")}
                </a>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
};
