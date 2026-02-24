import { useState, useEffect } from 'react';

export default function BacktestTradesPanel({ onTradesLoaded, trades, summary, loading }) {
  const [expanded, setExpanded] = useState(false);
  const [filterType, setFilterType] = useState('all'); // all, winning, losing

  const filteredTrades = () => {
    if (!trades) return [];
    if (filterType === 'winning') return trades.filter(t => t.isWin);
    if (filterType === 'losing') return trades.filter(t => !t.isWin);
    return trades;
  };

  const displayTrades = filteredTrades();

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">Backtest Results</h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-400 hover:text-white transition-colors"
        >
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          <div className="bg-slate-700/50 rounded p-2">
            <p className="text-gray-400">Total Trades</p>
            <p className="text-white font-bold">{summary.totalTrades}</p>
          </div>
          <div className="bg-slate-700/50 rounded p-2">
            <p className="text-gray-400">Win Rate</p>
            <p className={`font-bold ${summary.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
              {summary.winRate}%
            </p>
          </div>
          <div className="bg-slate-700/50 rounded p-2">
            <p className="text-gray-400">P&L ($)</p>
            <p className={`font-bold ${parseFloat(summary.totalProfit) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              ${summary.totalProfit}
            </p>
          </div>
          <div className="bg-slate-700/50 rounded p-2">
            <p className="text-gray-400">Return (%)</p>
            <p className={`font-bold ${parseFloat(summary.totalReturn) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {summary.totalReturn}%
            </p>
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="space-y-2 mb-4">
        <button
          onClick={onTradesLoaded}
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors text-sm"
        >
          {loading ? 'Loading Trades...' : 'Load Backtest Trades'}
        </button>
        <a
          href="#detailed-trades"
          className="w-full block px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors text-sm text-center"
        >
          📊 View All 417 Trades
        </a>
      </div>

      {/* Expanded Content */}
      {expanded && trades && trades.length > 0 && (
        <div>
          {/* Filter Tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                filterType === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              All ({trades.length})
            </button>
            <button
              onClick={() => setFilterType('winning')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                filterType === 'winning'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              Wins ({trades.filter(t => t.isWin).length})
            </button>
            <button
              onClick={() => setFilterType('losing')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                filterType === 'losing'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              Losses ({trades.filter(t => !t.isWin).length})
            </button>
          </div>

          {/* Trades List */}
          <div className="max-h-96 overflow-y-auto space-y-2">
            {displayTrades.slice(0, 20).map((trade, idx) => (
              <div
                key={idx}
                className={`p-3 rounded text-xs border ${
                  trade.isWin
                    ? 'bg-emerald-900/30 border-emerald-500/50'
                    : 'bg-red-900/30 border-red-500/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-white">
                    {trade.side === 'LONG' ? '📈' : '📉'} Trade #{trade.id}
                  </span>
                  <span className={`font-bold ${trade.isWin ? 'text-emerald-400' : 'text-red-400'}`}>
                    {trade.isWin ? '+' : ''}{trade.profitPercent?.toFixed(2) || '0'}%
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-gray-300">
                  <div>
                    <span className="text-gray-500">Entry:</span>
                    <p className="text-white">${trade.entryPrice?.toFixed(2) || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Exit:</span>
                    <p className="text-white">${trade.exitPrice?.toFixed(2) || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Date:</span>
                    <p className="text-white text-xs">{trade.entryDate}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Quality:</span>
                    <p className="text-white font-bold">{trade.quality || 'N/A'}</p>
                  </div>
                </div>
                {trade.exitReason && (
                  <p className="text-gray-400 mt-2 italic">{trade.exitReason}</p>
                )}
              </div>
            ))}
          </div>

          {displayTrades.length > 20 && (
            <p className="text-gray-500 text-xs text-center mt-2">
              Showing 20 of {displayTrades.length} trades
            </p>
          )}
        </div>
      )}

      {!expanded && trades && trades.length > 0 && (
        <p className="text-gray-400 text-xs">Click to expand and view {trades.length} trades</p>
      )}

      {!trades && !loading && (
        <p className="text-gray-400 text-xs">Load backtest trades to view details</p>
      )}
    </div>
  );
}
