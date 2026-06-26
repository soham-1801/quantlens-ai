
const getAvatarColor = (char) => {
  const colors = [
    "from-blue-600 to-indigo-600 text-blue-100 border-blue-500/30",
    "from-purple-600 to-pink-600 text-purple-100 border-purple-500/30",
    "from-emerald-600 to-teal-600 text-emerald-100 border-emerald-500/30",
    "from-amber-600 to-orange-600 text-amber-100 border-amber-500/30",
    "from-pink-600 to-rose-600 text-pink-100 border-pink-500/30",
    "from-cyan-600 to-blue-500 text-cyan-100 border-cyan-500/30",
    "from-indigo-600 to-violet-600 text-indigo-100 border-indigo-500/30",
  ];
  const code = char.charCodeAt(0) || 0;
  return colors[code % colors.length];
};

export const StockLogo = ({ ticker, className = "w-8 h-8" }) => {
  const firstLetter = ticker ? ticker.charAt(0).toUpperCase() : "?";
  const gradientClass = getAvatarColor(firstLetter);

  return (
    <div className={`${className} flex items-center justify-center font-black text-xs rounded-full bg-gradient-to-br ${gradientClass} border shrink-0`}>
      {firstLetter}
    </div>
  );
};
