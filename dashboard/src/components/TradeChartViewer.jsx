import { useState, useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

export default function TradeChartViewer({ trade }) {
  const [chartData, setChartData] = useState({ d1: [], h1: [], m5: [] });
  const [loading, setLoading] = useState(false);
  const chartRefs = useRef({ d1: null, h1: null, m5: null });

  if (!trade) {
    return (
      <div className="p-6 text-center text-gray-400">
        Select a trade to view its chart setup
      </div>
    );
  }

  const getChartSetup = (title, candles, timeframe, entryTime, entryPrice, exitPrice) => {
    if (!candles || candles.length === 0) {
      return (
        <div className="text-center p-4 bg-slate-700/50 rounded">
          <p className="text-gray-400 text-sm">No data available for {title}</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-white">{title}</h4>
          <span className="text-xs text-gray-400">{candles.length} candles</span>
        </div>

        {/* Candle Information */}
        <div className="bg-slate-700/50 rounded p-3 space-y-2 text-xs">
          {/* Find candles around entry time */}
          {(() => {
            const entryTime_ms = new Date(entryTime).getTime();
            const nearbyCandles = candles.filter(c => {
              const candleTime = new Date(c.timestamp).getTime();
              const diff = Math.abs(candleTime - entryTime_ms);
              return diff < (timeframe === 'D1' ? 86400000 * 2 : timeframe === 'H1' ? 3600000 * 2 : 300000 * 10);
            });

            if (nearbyCandles.length === 0) {
              return <p className="text-gray-400">No candles near entry time</p>;
            }

            return (
              <div className="space-y-2">
                <p className="font-bold text-gray-300">Candles Near Entry ({nearbyCandles.length}):</p>
                {nearbyCandles.slice(-3).map((candle, idx) => {
                  const isEntry = new Date(candle.timestamp).getTime() === entryTime_ms;
                  return (
                    <div
                      key={idx}
                      className={`p-2 rounded text-xs ${
                        isEntry ? 'bg-emerald-900/30 border border-emerald-500' : 'bg-slate-800'
                      }`}
                    >
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-400">
                          {new Date(candle.timestamp).toLocaleTimeString()}
                        </span>
                        <span className={candle.close > candle.open ? 'text-emerald-400' : 'text-red-400'}>
                          {candle.close > candle.open ? '▲' : '▼'} ${candle.close.toFixed(2)}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1 text-gray-400">
                        <div>
                          <span className="text-gray-500">O:</span> ${candle.open.toFixed(2)}
                        </div>
                        <div>
                          <span className="text-gray-500">H:</span> ${candle.high.toFixed(2)}
                        </div>
                        <div>
                          <span className="text-gray-500">L:</span> ${candle.low.toFixed(2)}
                        </div>
                        <div>
                          <span className="text-gray-500">Range:</span> ${(candle.high - candle.low).toFixed(2)}
                        </div>
                      </div>
                      {isEntry && <p className="text-emerald-400 mt-1 font-bold">← ENTRY</p>}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Quick Stats */}
        <div className="bg-slate-700/50 rounded p-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-gray-400">Highest</p>
            <p className="text-white font-bold">${Math.max(...candles.map(c => c.high)).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-gray-400">Lowest</p>
            <p className="text-white font-bold">${Math.min(...candles.map(c => c.low)).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-gray-400">Avg Close</p>
            <p className="text-white font-bold">
              ${(candles.reduce((s, c) => s + c.close, 0) / candles.length).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-gray-400">Period</p>
            <p className="text-white font-bold text-xs">
              {new Date(candles[0].timestamp).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Trade Header */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-white">
            Trade #{trade.id} - {trade.side === 'LONG' ? '📈' : '📉'} {trade.side}
          </h3>
          <span className={`px-3 py-1 rounded font-bold text-sm ${
            trade.isWin ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'
          }`}>
            {trade.isWin ? '✓ Win' : '✗ Loss'} • {trade.profitPercent?.toFixed(2)}%
          </span>
        </div>

        {/* Trade Details Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-gray-400">Entry</p>
            <p className="text-white font-bold">${trade.entryPrice?.toFixed(2)}</p>
            <p className="text-gray-500 text-xs">{new Date(trade.entryTime).toLocaleTimeString()}</p>
          </div>
          <div>
            <p className="text-gray-400">Exit</p>
            <p className="text-white font-bold">${trade.exitPrice?.toFixed(2)}</p>
            <p className="text-gray-500 text-xs">{new Date(trade.exitTime).toLocaleTimeString()}</p>
          </div>
          <div>
            <p className="text-gray-400">P&L</p>
            <p className={`text-white font-bold ${trade.isWin ? 'text-emerald-400' : 'text-red-400'}`}>
              {trade.isWin ? '+' : ''}{trade.profit?.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-gray-400">Quality</p>
            <p className="text-white font-bold">{trade.quality}</p>
          </div>
        </div>

        {/* Setup Info */}
        <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700 rounded space-y-2">
          <div>
            <p className="text-blue-300 text-xs font-bold">ENTRY SETUP:</p>
            <p className="text-blue-200 text-sm font-mono">{trade.entryReason}</p>
          </div>
          <div>
            <p className="text-orange-300 text-xs font-bold">EXIT REASON:</p>
            <p className="text-orange-200 text-sm">{trade.exitReason}</p>
          </div>
        </div>
      </div>

      {/* Charts Info Box */}
      <div className="bg-amber-900/20 border border-amber-700 rounded-lg p-4">
        <h4 className="font-bold text-amber-300 mb-2">📊 What Claude Was Analyzing:</h4>
        <p className="text-amber-200 text-sm mb-3">
          The data below shows the actual candlestick data Claude reviewed at the time of entry. Claude only saw historical data before the entry time (walk-forward analysis).
        </p>

        {/* D1 Chart Info */}
        <div className="mb-4">
          {getChartSetup('D1 DAILY (1-Day Candles)', chartData.d1, 'D1', trade.entryTime, trade.entryPrice, trade.exitPrice)}
        </div>

        {/* H1 Chart Info */}
        <div className="mb-4">
          {getChartSetup('H1 HOURLY (1-Hour Candles)', chartData.h1, 'H1', trade.entryTime, trade.entryPrice, trade.exitPrice)}
        </div>

        {/* M5 Chart Info */}
        <div>
          {getChartSetup('M5 (5-Minute Candles - Entry Timeframe)', chartData.m5, 'M5', trade.entryTime, trade.entryPrice, trade.exitPrice)}
        </div>
      </div>

      {/* Legend */}
      <div className="bg-slate-800/50 rounded-lg p-4 text-xs space-y-2 text-gray-400">
        <p className="font-bold text-white mb-2">Legend:</p>
        <div className="grid grid-cols-2 gap-2">
          <div>• <strong>O:</strong> Open price (candle start)</div>
          <div>• <strong>H:</strong> High price (highest point)</div>
          <div>• <strong>L:</strong> Low price (lowest point)</div>
          <div>• <strong>C:</strong> Close price (candle end)</div>
          <div>• <strong>▲</strong> = Green candle (bullish)</div>
          <div>• <strong>▼</strong> = Red candle (bearish)</div>
        </div>
        <p className="mt-3 italic">
          Note: Real chart visualization requires live data fetching. This shows the data points Claude analyzed.
        </p>
      </div>
    </div>
  );
}
