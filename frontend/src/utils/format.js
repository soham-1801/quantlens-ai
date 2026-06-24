export const getCurrencyCode = (currency, ticker) => {
  if (currency === "INR" || (ticker && (ticker.endsWith(".NS") || ticker.endsWith(".BO")))) {
    return "INR";
  }
  return "USD";
};

export const getCurrencySymbol = (currency, ticker) => {
  const code = getCurrencyCode(currency, ticker);
  return code === "INR" ? "₹" : "$";
};

export const formatPrice = (val, currency, ticker) => {
  if (val == null || !Number.isFinite(val)) return "N/A";
  const code = getCurrencyCode(currency, ticker);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
};

export const formatMarketCap = (val, currency, ticker) => {
  if (val == null || !Number.isFinite(val)) return "N/A";
  const code = getCurrencyCode(currency, ticker);
  
  if (val >= 1e6) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      notation: "compact",
      compactDisplay: "short",
      maximumFractionDigits: 2,
    }).format(val);
  }
  
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(val);
};

export const getUSDEquivalent = (val, currency, ticker) => {
  if (val == null) return null;
  const code = getCurrencyCode(currency, ticker);
  if (code === "INR") {
    return val / 83.5;
  }
  return val;
};
