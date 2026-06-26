import { useState, useMemo } from "react";
import { usePortfolio } from "../context/PortfolioContext";
import { PieChart, Briefcase, Plus, TrendingUp, TrendingDown, DollarSign, Trash2, Edit2, X, Loader2 } from "lucide-react";
import { StockLogo } from "../components/StockLogo";
import { formatPrice } from "../utils/format";
import { Skeleton } from "../components/Skeleton";

export const Portfolio = () => {
  const { portfolio, loading, addHolding, updateHolding, removeHolding } = usePortfolio();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formTicker, setFormTicker] = useState("");
  const [formShares, setFormShares] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const openAddModal = () => {
    setIsEditMode(false);
    setFormTicker("");
    setFormShares("");
    setFormPrice("");
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setIsEditMode(true);
    setFormTicker(item.ticker);
    setFormShares(item.shares.toString());
    setFormPrice(item.average_price.toString());
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formTicker || !formShares || !formPrice) return;
    
    setSubmitting(true);
    try {
      if (isEditMode) {
        await updateHolding(formTicker.toUpperCase(), parseFloat(formShares), parseFloat(formPrice));
      } else {
        await addHolding(formTicker.toUpperCase(), parseFloat(formShares), parseFloat(formPrice));
      }
      closeModal();
    } catch (err) {
      // Error handled by context toast
      console.debug(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (ticker) => {
    if (window.confirm(`Are you sure you want to remove ${ticker} from your portfolio?`)) {
      await removeHolding(ticker);
    }
  };

  // Compute portfolio totals
  const totals = useMemo(() => {
    let value = 0;
    let cost = 0;

    portfolio.forEach(item => {
      // Use current price if available, fallback to average price so value doesn't drop to 0 erroneously
      const priceToUse = item.current_price || item.average_price;
      value += (priceToUse * item.shares);
      cost += (item.average_price * item.shares);
    });

    const gainLoss = value - cost;
    const gainLossPercent = cost > 0 ? (gainLoss / cost) * 100 : 0;

    return { value, cost, gainLoss, gainLossPercent };
  }, [portfolio]);

  const isProfit = totals.gainLoss >= 0;

  return (
    <div className="space-y-6 w-full max-w-none px-4 lg:px-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-2">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-blue-500" /> My Portfolio
          </h1>
          <p className="text-xs text-gray-400 mt-1 font-medium">Track your holdings and analyze profit/loss in real-time.</p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/20 active:scale-95"
        >
          <Plus className="w-4 h-4" /> Add Position
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {/* Total Value */}
        <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute -top-10 -right-10 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-colors" />
          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-gray-400" /> Total Value
          </p>
          {loading ? (
            <Skeleton className="w-32 h-8 mt-2" />
          ) : (
            <h2 className="text-3xl font-black text-white">{formatPrice(totals.value)}</h2>
          )}
        </div>

        {/* Total Return */}
        <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
          <div className={`absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl transition-colors ${isProfit ? 'bg-emerald-500/10 group-hover:bg-emerald-500/20' : 'bg-red-500/10 group-hover:bg-red-500/20'}`} />
          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
            {isProfit ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : <TrendingDown className="w-4 h-4 text-red-500" />} 
            Total Return
          </p>
          {loading ? (
            <Skeleton className="w-24 h-8 mt-2" />
          ) : (
            <div className="flex items-baseline gap-3">
              <h2 className={`text-3xl font-black ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                {isProfit ? '+' : ''}{formatPrice(totals.gainLoss)}
              </h2>
              <span className={`text-sm font-bold px-2 py-1 rounded-md ${isProfit ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                {isProfit ? '+' : ''}{totals.gainLossPercent.toFixed(2)}%
              </span>
            </div>
          )}
        </div>

        {/* Total Cost Basis */}
        <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute -top-10 -right-10 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-colors" />
          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-gray-400" /> Cost Basis
          </p>
          {loading ? (
            <Skeleton className="w-32 h-8 mt-2" />
          ) : (
            <h2 className="text-3xl font-black text-gray-300">{formatPrice(totals.cost)}</h2>
          )}
        </div>
      </div>

      {/* Holdings Table */}
      <div className="glass-card rounded-2xl overflow-hidden animate-fade-in-up delay-2">
        <div className="p-5 border-b border-[#242D3D]/50 flex items-center justify-between">
          <h3 className="font-bold text-gray-200 text-sm tracking-wide uppercase">Your Holdings</h3>
          <span className="text-xs text-gray-500 font-bold bg-[#0B0F19] px-3 py-1 rounded-full border border-[#242D3D]">
            {portfolio.length} Assets
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0B0F19]/50 text-gray-400 text-[10px] uppercase tracking-widest font-bold">
                <th className="p-4 pl-6 whitespace-nowrap">Asset</th>
                <th className="p-4 whitespace-nowrap">Shares</th>
                <th className="p-4 whitespace-nowrap">Avg Cost</th>
                <th className="p-4 whitespace-nowrap">Current Price</th>
                <th className="p-4 whitespace-nowrap">Total Value</th>
                <th className="p-4 whitespace-nowrap">Total Return</th>
                <th className="p-4 pr-6 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#242D3D]/30 text-sm">
              {loading ? (
                Array.from({ length: 3 }).map((_, idx) => (
                  <tr key={idx}>
                    <td className="p-4 pl-6"><Skeleton className="w-24 h-8" /></td>
                    <td className="p-4"><Skeleton className="w-12 h-5" /></td>
                    <td className="p-4"><Skeleton className="w-16 h-5" /></td>
                    <td className="p-4"><Skeleton className="w-16 h-5" /></td>
                    <td className="p-4"><Skeleton className="w-20 h-5" /></td>
                    <td className="p-4"><Skeleton className="w-20 h-5" /></td>
                    <td className="p-4 pr-6"><Skeleton className="w-16 h-8 ml-auto" /></td>
                  </tr>
                ))
              ) : portfolio.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-12 text-center text-gray-500">
                    <Briefcase className="w-12 h-12 text-gray-600 mx-auto mb-3 opacity-50" />
                    <p className="text-sm font-medium text-gray-400">Your portfolio is empty.</p>
                    <p className="text-xs mt-1">Click "Add Position" to start tracking your holdings.</p>
                  </td>
                </tr>
              ) : (
                portfolio.map((item) => {
                  const isItemProfit = item.total_gain_loss >= 0;
                  return (
                    <tr key={item.id} className="hover:bg-[#10141D]/50 transition-colors group">
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <StockLogo ticker={item.ticker} className="w-8 h-8 shrink-0 text-[10px]" />
                          <span className="font-black text-white tracking-wide">{item.ticker}</span>
                        </div>
                      </td>
                      <td className="p-4 font-medium text-gray-300">{item.shares}</td>
                      <td className="p-4 font-medium text-gray-400">{formatPrice(item.average_price)}</td>
                      <td className="p-4 font-medium text-gray-300">
                        {item.current_price ? formatPrice(item.current_price) : <span className="text-gray-500 text-xs italic">N/A</span>}
                      </td>
                      <td className="p-4 font-bold text-white">
                        {item.total_value ? formatPrice(item.total_value) : formatPrice(item.average_price * item.shares)}
                      </td>
                      <td className="p-4">
                        {item.total_gain_loss != null ? (
                          <div className={`flex items-center gap-2 font-bold ${isItemProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isItemProfit ? '+' : ''}{formatPrice(item.total_gain_loss)}
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/20">
                              {isItemProfit ? '+' : ''}{item.total_gain_loss_percent.toFixed(2)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-500 text-xs italic">Pending</span>
                        )}
                      </td>
                      <td className="p-4 pr-6 text-right space-x-2">
                        <button
                          onClick={() => openEditModal(item)}
                          className="p-2 rounded-lg text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                          title="Edit Position"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRemove(item.ticker)}
                          className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Remove Position"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />
          
          {/* Modal Content */}
          <div className="auth-glass-card rounded-2xl w-full max-w-md relative z-10 p-6 sm:p-8 animate-fade-in-up shadow-2xl border border-[#242D3D]/50">
            <button 
              onClick={closeModal}
              className="absolute top-4 right-4 p-2 text-gray-500 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-xl font-black text-white mb-6 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-blue-500" />
              {isEditMode ? "Edit Position" : "Add New Position"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Ticker Symbol</label>
                <input
                  type="text"
                  required
                  disabled={isEditMode}
                  value={formTicker}
                  onChange={(e) => setFormTicker(e.target.value.toUpperCase())}
                  placeholder="e.g. AAPL"
                  className="w-full bg-[#0B0F19]/80 border border-[#242D3D] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Number of Shares</label>
                <input
                  type="number"
                  required
                  min="0.0001"
                  step="any"
                  value={formShares}
                  onChange={(e) => setFormShares(e.target.value)}
                  placeholder="e.g. 10.5"
                  className="w-full bg-[#0B0F19]/80 border border-[#242D3D] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Average Cost Per Share ($)</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="any"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  placeholder="e.g. 150.25"
                  className="w-full bg-[#0B0F19]/80 border border-[#242D3D] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-bold text-xs uppercase tracking-wider py-3.5 rounded-xl shadow-lg transition-all active:scale-[0.98] mt-4 flex justify-center items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isEditMode ? "Update Position" : "Save Position"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
