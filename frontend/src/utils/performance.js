const findClosestPoint = (history, targetDate) => {
  if (!history?.length) return null;
  const target = targetDate.getTime();
  let closest = history[0];
  let minDiff = Math.abs(new Date(closest.date).getTime() - target);

  for (const point of history) {
    const diff = Math.abs(new Date(point.date).getTime() - target);
    if (diff < minDiff) {
      minDiff = diff;
      closest = point;
    }
  }

  return closest;
};

const calcReturn = (current, startPrice) => {
  if (current == null || startPrice == null || startPrice <= 0) return null;
  return ((current - startPrice) / startPrice) * 100;
};

export const computePerformanceReturns = (history) => {
  if (!history?.length) {
    return { oneMonth: null, ytd: null, fiftyTwoWeek: null };
  }

  const sorted = [...history].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const latest = sorted[sorted.length - 1];
  const current = latest.close;
  const currentDate = new Date(latest.date);

  const oneMonthDate = new Date(currentDate);
  oneMonthDate.setMonth(oneMonthDate.getMonth() - 1);
  const oneMonthPoint = findClosestPoint(sorted, oneMonthDate);

  const ytdPoint =
    sorted.find((p) => new Date(p.date).getFullYear() === currentDate.getFullYear()) ||
    sorted[0];

  const fiftyTwoWeekPoint = sorted[0];

  return {
    oneMonth: calcReturn(current, oneMonthPoint?.close),
    ytd: calcReturn(current, ytdPoint?.close),
    fiftyTwoWeek: calcReturn(current, fiftyTwoWeekPoint?.close),
  };
};

export const formatReturn = (value) => {
  if (value === null || value === undefined) return "N/A";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
};
