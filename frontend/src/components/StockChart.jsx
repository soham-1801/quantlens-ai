import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const COLORS = ["#3B82F6", "#22D3EE"];
const GRADIENTS = [
  { id: "colorA", color: "#3B82F6" },
  { id: "colorB", color: "#22D3EE" },
];

export const StockChart = ({ history, period, onPeriodChange, comparison, tickers }) => {
  const periods = [
    { label: "1M", value: "1m" },
    { label: "6M", value: "6m" },
    { label: "1Y", value: "1y" },
    { label: "5Y", value: "5y" },
  ];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div
          className="backdrop-blur-md border border-[#2E3A50]/70 rounded-md z-50"
          style={{
            background: "rgba(11,15,25,0.92)",
            padding: "5px 9px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}
        >
          <p className="text-gray-500 mb-[2px] text-[9px] font-semibold tracking-wide">{label}</p>
          {payload.map((entry, idx) => (
            <p
              key={idx}
              className="font-black tabular-nums text-[11px]"
              style={{ color: entry.color }}
            >
              {entry.name}:{" "}
              {comparison ? `${entry.value >= 0 ? "+" : ""}${entry.value.toFixed(2)}%` : `$${entry.value.toFixed(2)}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const CustomCursor = ({ x, y, height }) => (
    <line
      x1={x} y1={y} x2={x} y2={y + height}
      stroke="#3B82F6"
      strokeOpacity={0.18}
      strokeWidth={1}
      strokeDasharray="3 2"
    />
  );

  const renderAreas = () => {
    if (comparison && tickers) {
      return tickers.map((t, i) => (
        <Area
          key={t}
          type="monotone"
          dataKey={t}
          stroke={COLORS[i]}
          strokeWidth={1.5}
          fillOpacity={0}
          dot={false}
          activeDot={{ r: 3, fill: COLORS[i], stroke: "#0B0F19", strokeWidth: 2 }}
          name={t}
        />
      ));
    }
    return (
      <Area
        type="monotone"
        dataKey="close"
        stroke="#3B82F6"
        strokeWidth={1.5}
        fillOpacity={1}
        fill="url(#colorClose)"
        dot={false}
        activeDot={{ r: 3, fill: "#3B82F6", stroke: "#0B0F19", strokeWidth: 2 }}
      />
    );
  };

  return (
    <div className="bg-[#161B26]/40 border border-[#242D3D]/60 rounded-2xl px-3 pt-2 pb-2 backdrop-blur-md flex flex-col min-w-0">
      <div className="flex justify-between items-center gap-2 shrink-0 mb-1.5">
        <h3 className="font-bold text-gray-200 text-xs tracking-wide uppercase">
          {comparison ? "Relative Performance (%)" : "Price History"}
        </h3>
        <div className="flex bg-[#0B0F19]/60 p-0.5 rounded-lg border border-[#242D3D]/70 w-fit shrink-0 overflow-x-auto">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => onPeriodChange(p.value)}
              className={`text-[9px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md transition-all whitespace-nowrap ${
                period === p.value
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full" style={{ height: 348 }}>
        {history && history.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 8, right: 4, left: -20, bottom: 2 }}>
              <defs>
                <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                </linearGradient>
                {GRADIENTS.map((g) => (
                  <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={g.color} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={g.color} stopOpacity={0.0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#242D3D"
                strokeOpacity={0.2}
                vertical={false}
              />
              <XAxis
                dataKey="date"
                stroke="#374151"
                tick={{ fill: "#4B5563", fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                dy={8}
                minTickGap={40}
              />
              <YAxis
                stroke="#374151"
                tick={{ fill: "#4B5563", fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                domain={["auto", "auto"]}
                tickFormatter={(v) => comparison ? `${v.toFixed(1)}%` : `$${v.toFixed(0)}`}
                width={46}
              />
              <Tooltip content={<CustomTooltip />} cursor={<CustomCursor />} />
              {comparison && tickers && (
                <Legend
                  wrapperStyle={{ fontSize: "10px", color: "#9CA3AF", paddingTop: "4px" }}
                  iconType="circle"
                  iconSize={8}
                />
              )}
              {renderAreas()}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-[11px] text-gray-600 font-medium">
            No price history available.
          </div>
        )}
      </div>
    </div>
  );
};
