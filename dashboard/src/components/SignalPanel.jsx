import { useState, useEffect } from 'react';
import { signalsApi } from '../lib/api';
import { useTradingStore } from '../store/tradingStore';

export default function SignalPanel({ analysisData, loading }) {
  const [signals, setSignals] = useState([]);
  const [loadingSignals, setLoadingSignals] = useState(false);
  const symbol = useTradingStore(state => state.symbol);

  useEffect(() => {
    if (analysisData && symbol) {
      loadSignals();
    }
  }, [analysisData, symbol]);

  const loadSignals = async () => {
    setLoadingSignals(true);
    try {
      const res = await signalsApi.getBySymbol(symbol, 'ACTIVE');
      setSignals(res.data.signals || []);
    } catch (error) {
      console.error('Failed to load signals:', error);
    }
    setLoadingSignals(false);
  };

  const handleCloseSignal = async (signalId) => {
    try {
      await signalsApi.close(signalId);
      await loadSignals();
    } catch (error) {
      console.error('Failed to close signal:', error);
    }
  };

  if (loading || loadingSignals) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-20 bg-slate-700 rounded mb-4"></div>
          <div className="h-20 bg-slate-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-4">
        Active Signals {symbol && `— ${symbol}`}
      </h2>

      {signals.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-400">No active signals</p>
          <p className="text-gray-500 text-sm mt-2">Run analysis to generate signals</p>
        </div>
      ) : (
        <div className="space-y-4">
          {signals.map(signal => (
            <div
              key={signal.id}
              className={`p-4 rounded-lg border-l-4 ${
                signal.signalType === 'BUY'
                  ? 'bg-green-900/20 border-green-500'
                  : 'bg-red-900/20 border-red-500'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-white">
                    {signal.signalType} {signal.symbol}
                  </h3>
                  <p className="text-sm text-gray-400 mt-1">{signal.timeframe}</p>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-medium ${
                  signal.confidence === 'HIGH'
                    ? 'bg-green-900/50 text-green-200'
                    : signal.confidence === 'MEDIUM'
                    ? 'bg-yellow-900/50 text-yellow-200'
                    : 'bg-gray-900/50 text-gray-300'
                }`}>
                  {signal.confidence}
                </div>
              </div>

              <div className="space-y-2 mb-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Entry:</span>
                  <span className="text-white font-mono">
                    {parseFloat(signal.entryPrice).toFixed(5)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Stop Loss:</span>
                  <span className="text-white font-mono">
                    {parseFloat(signal.stopLoss).toFixed(5)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Take Profit:</span>
                  <span className="text-white font-mono">
                    {parseFloat(signal.takeProfit).toFixed(5)}
                  </span>
                </div>
                {signal.riskReward && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">R:R:</span>
                    <span className="text-white font-mono">
                      1:{signal.riskReward.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {signal.reason && (
                <p className="text-xs text-gray-400 mb-4 p-2 bg-slate-900/50 rounded">
                  {signal.reason}
                </p>
              )}

              <button
                onClick={() => handleCloseSignal(signal.id)}
                className="w-full px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-gray-300 rounded transition-colors"
              >
                Close Signal
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
