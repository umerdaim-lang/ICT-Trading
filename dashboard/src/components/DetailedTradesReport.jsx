import { useState, useEffect } from 'react';
import React from 'react';
import { backtestApi } from '../lib/api';

export default function DetailedTradesReport() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('id');
  const [searchId, setSearchId] = useState('');
  const [expandedTradeId, setExpandedTradeId] = useState(null);

  useEffect(() => {
    fetchTrades();
  }, []);

  const fetchTrades = async () => {
    try {
      setLoading(true);
      const res = await backtestApi.getTrades();
      if (res.data?.success) {
        const tradesData = (res.data.data?.trades || []).map(trade => ({
          ...trade,
          isWin: trade.isWin !== undefined ? trade.isWin : (trade.profit > 0)
        }));
        setTrades(tradesData);
      }
    } catch (error) {
      console.error('Error fetching trades:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredTrades = () => {
    let filtered = trades;

    // Filter by type
    if (filterType === 'winning') {
      filtered = filtered.filter(t => t.isWin);
    } else if (filterType === 'losing') {
      filtered = filtered.filter(t => !t.isWin);
    }

    // Filter by ID search
    if (searchId) {
      filtered = filtered.filter(t => t.id.toString().includes(searchId));
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'id':
          return a.id - b.id;
        case 'profit':
          return b.profit - a.profit;
        case 'date':
          return new Date(b.entryTime) - new Date(a.entryTime);
        default:
          return a.id - b.id;
      }
    });

    return filtered;
  };

  const filteredTrades = getFilteredTrades();
  const displayTrades = filteredTrades;

  if (loading) {
    return (
      <div className="w-full h-96 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading all trades...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">All Backtest Trades - Detailed Report</h1>
        <p className="text-gray-400">Complete analysis of all {trades.length} trades with setup details</p>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Filter Type */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Filter</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
          >
            <option value="all">All Trades ({trades.length})</option>
            <option value="winning">Winning ({trades.filter(t => t.isWin).length})</option>
            <option value="losing">Losing ({trades.filter(t => !t.isWin).length})</option>
          </select>
        </div>

        {/* Sort */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Sort By</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
          >
            <option value="id">Trade ID</option>
            <option value="date">Entry Date</option>
            <option value="profit">Profit</option>
          </select>
        </div>

        {/* Search */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-300 mb-2">Search Trade ID</label>
          <input
            type="text"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            placeholder="Enter trade number (e.g., 1, 42, 100)"
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-gray-500 text-sm"
          />
        </div>
      </div>

      {/* Trades Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 border-b border-slate-700 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left text-gray-300">ID</th>
              <th className="px-4 py-3 text-left text-gray-300">Side</th>
              <th className="px-4 py-3 text-left text-gray-300">Quality</th>
              <th className="px-4 py-3 text-left text-gray-300">Killzone</th>
              <th className="px-4 py-3 text-left text-gray-300">Entry Time</th>
              <th className="px-4 py-3 text-right text-gray-300">Entry Price</th>
              <th className="px-4 py-3 text-right text-gray-300">Exit Price</th>
              <th className="px-4 py-3 text-right text-gray-300">P&L</th>
              <th className="px-4 py-3 text-right text-gray-300">%</th>
              <th className="px-4 py-3 text-left text-gray-300">Entry Setup</th>
              <th className="px-4 py-3 text-left text-gray-300">Exit Reason</th>
            </tr>
          </thead>
          <tbody>
            {displayTrades.map((trade, idx) => (
              <React.Fragment key={idx}>
                <tr
                  onClick={() => setExpandedTradeId(expandedTradeId === trade.id ? null : trade.id)}
                  className={`border-b border-slate-700 hover:bg-slate-800/50 transition-colors cursor-pointer ${
                    trade.isWin ? 'bg-emerald-900/10' : 'bg-red-900/10'
                  }`}
                >
                {/* ID + Expand */}
                <td className="px-4 py-3 font-bold text-white flex items-center gap-2">
                  <span className="text-gray-400">
                    {expandedTradeId === trade.id ? '▼' : '▶'}
                  </span>
                  {trade.id}
                </td>

                {/* Side */}
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    trade.side === 'LONG'
                      ? 'bg-emerald-900/50 text-emerald-300'
                      : 'bg-red-900/50 text-red-300'
                  }`}>
                    {trade.side === 'LONG' ? '📈 LONG' : '📉 SHORT'}
                  </span>
                </td>

                {/* Quality */}
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    trade.quality === 'A+' ? 'bg-purple-900/50 text-purple-300'
                    : trade.quality === 'A' ? 'bg-blue-900/50 text-blue-300'
                    : 'bg-gray-900/50 text-gray-300'
                  }`}>
                    {trade.quality}
                  </span>
                </td>

                {/* Killzone */}
                <td className="px-4 py-3 text-gray-300 text-xs">{trade.killzone}</td>

                {/* Entry Time */}
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {new Date(trade.entryTime).toLocaleString()}
                </td>

                {/* Entry Price */}
                <td className="px-4 py-3 text-right font-mono text-white">
                  ${trade.entryPrice?.toFixed(2)}
                </td>

                {/* Exit Price */}
                <td className="px-4 py-3 text-right font-mono text-white">
                  ${trade.exitPrice?.toFixed(2)}
                </td>

                {/* P&L $ */}
                <td className={`px-4 py-3 text-right font-bold font-mono ${
                  trade.isWin ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {trade.isWin ? '+' : ''}{trade.profit?.toFixed(2)}
                </td>

                {/* P&L % */}
                <td className={`px-4 py-3 text-right font-bold ${
                  trade.isWin ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {trade.isWin ? '+' : ''}{trade.profitPercent?.toFixed(2)}%
                </td>

                {/* Entry Setup */}
                <td className="px-4 py-3 text-xs text-gray-400 max-w-xs">
                  <div className="break-words">
                    {trade.entryReason}
                  </div>
                </td>

                {/* Exit Reason */}
                <td className="px-4 py-3 text-xs text-gray-400 max-w-xs">
                  <div className="break-words">
                    {trade.exitReason}
                  </div>
                </td>
              </tr>

              {/* Expanded Row - Trade Charts */}
              {expandedTradeId === trade.id && (
                <tr className="bg-slate-900/50 border-b border-slate-700">
                  <td colSpan="11" className="px-4 py-6">
                    <div className="space-y-6">
                      {/* Trade Header */}
                      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                        <h4 className="text-lg font-bold text-white mb-3">
                          Trade #{trade.id} Chart Analysis
                        </h4>

                        {/* Setup Breakdown */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div className="bg-blue-900/20 border border-blue-700 rounded p-3">
                            <p className="text-blue-300 text-xs font-bold mb-1">ENTRY SETUP</p>
                            <p className="text-blue-200 font-mono text-sm break-words">{trade.entryReason}</p>
                          </div>
                          <div className="bg-orange-900/20 border border-orange-700 rounded p-3">
                            <p className="text-orange-300 text-xs font-bold mb-1">EXIT REASON</p>
                            <p className="text-orange-200 text-sm">{trade.exitReason}</p>
                          </div>
                        </div>

                        {/* Price & Time Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div className="bg-slate-700/50 rounded p-2">
                            <p className="text-gray-400 text-xs">Entry Time</p>
                            <p className="text-white font-bold text-xs">{new Date(trade.entryTime).toLocaleTimeString()}</p>
                          </div>
                          <div className="bg-slate-700/50 rounded p-2">
                            <p className="text-gray-400 text-xs">Entry Price</p>
                            <p className="text-white font-bold">${trade.entryPrice?.toFixed(2)}</p>
                          </div>
                          <div className="bg-slate-700/50 rounded p-2">
                            <p className="text-gray-400 text-xs">Exit Price</p>
                            <p className="text-white font-bold">${trade.exitPrice?.toFixed(2)}</p>
                          </div>
                          <div className={`rounded p-2 ${trade.isWin ? 'bg-emerald-900/30' : 'bg-red-900/30'}`}>
                            <p className={`text-xs ${trade.isWin ? 'text-emerald-400' : 'text-red-400'}`}>P&L</p>
                            <p className={`font-bold ${trade.isWin ? 'text-emerald-400' : 'text-red-400'}`}>
                              {trade.isWin ? '+' : ''}{trade.profit?.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Chart Data Explanation */}
                      <div className="bg-amber-900/20 border border-amber-700 rounded-lg p-4">
                        <h5 className="font-bold text-amber-300 mb-3">📊 What Claude Was Analyzing:</h5>

                        <div className="space-y-4">
                          {/* D1 Explanation */}
                          <div className="bg-slate-800/50 rounded p-3 border-l-4 border-purple-500">
                            <p className="text-purple-300 font-bold text-sm mb-2">D1 (Daily Chart)</p>
                            <div className="text-xs text-gray-300 space-y-1">
                              <p>• <strong>Purpose:</strong> Determines trading bias (LONG vs SHORT)</p>
                              <p>• <strong>Claude looked at:</strong> Previous day's candle close vs open</p>
                              <p>• <strong>Decision:</strong> {trade.entryReason.includes('D1:LONG') ? '📈 LONG (previous day closed green)' : '📉 SHORT (previous day closed red)'}</p>
                              <p>• <strong>Setup:</strong> {trade.entryReason.split('|')[0].trim()}</p>
                            </div>
                          </div>

                          {/* H1 Explanation */}
                          <div className="bg-slate-800/50 rounded p-3 border-l-4 border-blue-500">
                            <p className="text-blue-300 font-bold text-sm mb-2">H1 (Hourly Chart - Order Blocks)</p>
                            <div className="text-xs text-gray-300 space-y-1">
                              <p>• <strong>Purpose:</strong> Find confluence zones (order blocks)</p>
                              <p>• <strong>Claude looked at:</strong> Last 100 hourly candles (~4 days)</p>
                              <p>• <strong>Analysis:</strong> {trade.entryReason.includes('H1:') ? trade.entryReason.split('|')[1].trim() : 'Order blocks identified'}</p>
                              <p>• <strong>Quality:</strong> More blocks = stronger setup</p>
                              <p>• <strong>Decision:</strong> {trade.quality === 'A+' ? '🌟 A+ (3+ blocks)' : trade.quality === 'A' ? '⭐ A (2 blocks)' : '⚡ B (1 block)'}</p>
                            </div>
                          </div>

                          {/* M5 Explanation */}
                          <div className="bg-slate-800/50 rounded p-3 border-l-4 border-green-500">
                            <p className="text-green-300 font-bold text-sm mb-2">M5 (5-Minute Chart - Entry Point)</p>
                            <div className="text-xs text-gray-300 space-y-1">
                              <p>• <strong>Purpose:</strong> Precise entry timing</p>
                              <p>• <strong>Claude looked at:</strong> Candles around entry time</p>
                              <p>• <strong>Entry:</strong> {new Date(trade.entryTime).toLocaleTimeString()} at ${trade.entryPrice?.toFixed(2)}</p>
                              <p>• <strong>Direction:</strong> {trade.side === 'LONG' ? '📈 Entered LONG (buying)' : '📉 Entered SHORT (selling)'}</p>
                              <p>• <strong>Outcome:</strong> Price moved to ${trade.exitPrice?.toFixed(2)} ({trade.isWin ? 'profitable ✓' : 'loss ✗'})</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Educational Note */}
                      <div className="bg-slate-700/50 rounded p-3 text-xs text-gray-400">
                        <p className="mb-2">
                          <strong>How This Trade Worked:</strong> Claude uses a 3-timeframe analysis:
                        </p>
                        <ol className="list-decimal list-inside space-y-1 ml-2">
                          <li>D1 (Daily) = Determines direction and bias</li>
                          <li>H1 (Hourly) = Validates with order block confluence</li>
                          <li>M5 (5-Minute) = Executes entry at precise time</li>
                        </ol>
                        <p className="mt-2">
                          When all three align, you get your trade signal. The more factors align, the higher the quality (A+ &gt; A &gt; B).
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Stats */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-slate-800/50 rounded p-4 border border-slate-700">
          <p className="text-gray-400 text-sm">Showing</p>
          <p className="text-2xl font-bold text-white">{displayTrades.length}</p>
          <p className="text-gray-400 text-xs">of {trades.length} trades</p>
        </div>

        <div className="bg-emerald-900/30 rounded p-4 border border-emerald-700">
          <p className="text-gray-400 text-sm">Wins</p>
          <p className="text-2xl font-bold text-emerald-400">
            {displayTrades.filter(t => t.isWin).length}
          </p>
          <p className="text-emerald-400 text-xs">
            {(displayTrades.filter(t => t.isWin).length / displayTrades.length * 100).toFixed(1)}%
          </p>
        </div>

        <div className="bg-red-900/30 rounded p-4 border border-red-700">
          <p className="text-gray-400 text-sm">Losses</p>
          <p className="text-2xl font-bold text-red-400">
            {displayTrades.filter(t => !t.isWin).length}
          </p>
          <p className="text-red-400 text-xs">
            {(displayTrades.filter(t => !t.isWin).length / displayTrades.length * 100).toFixed(1)}%
          </p>
        </div>

        <div className="bg-slate-800/50 rounded p-4 border border-slate-700">
          <p className="text-gray-400 text-sm">Total P&L</p>
          <p className={`text-2xl font-bold ${
            displayTrades.reduce((s, t) => s + (t.profit || 0), 0) >= 0
              ? 'text-emerald-400'
              : 'text-red-400'
          }`}>
            ${displayTrades.reduce((s, t) => s + (t.profit || 0), 0).toFixed(2)}
          </p>
        </div>

        <div className="bg-slate-800/50 rounded p-4 border border-slate-700">
          <p className="text-gray-400 text-sm">Avg Trade</p>
          <p className={`text-2xl font-bold ${
            displayTrades.reduce((s, t) => s + (t.profit || 0), 0) / displayTrades.length >= 0
              ? 'text-emerald-400'
              : 'text-red-400'
          }`}>
            ${(displayTrades.reduce((s, t) => s + (t.profit || 0), 0) / displayTrades.length).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-8 p-4 bg-blue-900/30 border border-blue-700 rounded">
        <p className="text-blue-300 text-sm">
          <strong>📊 Entry Setup Explanation:</strong> Shows the ICT setup that triggered the trade entry
        </p>
        <ul className="text-blue-300 text-xs mt-2 space-y-1 ml-4">
          <li>• <strong>D1:LONG/SHORT</strong> = Daily bias direction</li>
          <li>• <strong>H1:5OBs</strong> = Number of order blocks on 1H chart (higher = stronger)</li>
          <li>• <strong>NY/LONDON/ASIA</strong> = Killzone session</li>
          <li>• <strong>Q:A+/A/B</strong> = Signal quality rating</li>
        </ul>
      </div>
    </div>
  );
}
