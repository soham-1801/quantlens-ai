import React from "react";
import { Info } from "lucide-react";

export const MetricTooltip = ({ text }) => {
  if (!text) return null;

  return (
    <div className="relative inline-flex group/metric-tip shrink-0">
      <Info
        className="w-3 h-3 text-gray-500 hover:text-blue-400 transition-colors duration-200 cursor-help"
        aria-label="More info"
      />
      <div className="absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 w-40 opacity-0 pointer-events-none group-hover/metric-tip:opacity-100 group-hover/metric-tip:pointer-events-auto transition-opacity duration-200 ease-out bg-[#0B0F19]/95 backdrop-blur-md border border-blue-500/20 p-2 rounded-lg text-[10px] text-gray-300 font-medium shadow-lg shadow-blue-500/10 leading-snug text-center z-[60]">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#0B0F19]/95 border-r border-b border-blue-500/20 rotate-45 -mt-[3px]" />
      </div>
    </div>
  );
};
