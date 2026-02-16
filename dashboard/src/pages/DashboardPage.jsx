import { useState } from 'react';
import { useTradingStore } from '../store/tradingStore';
import ChartComponent from '../components/Chart';
import SignalPanel from '../components/SignalPanel';
import AnalysisLog from '../components/AnalysisLog';

export default function DashboardPage({
  chartData,
  analysisData,
  onRunAnalysis,
  onUploadData
}) {
  const {
    symbol,
    timeframe,
    setSymbol,
    setTimeframe,
    loading,
    error,
    clearError
  } = useTradingStore();

  const [uploadMode, setUploadMode] = useState(false);
  const [csvInput, setCsvInput] = useState('');

  const handleUpload = async () => {
    if (!csvInput.trim()) {
      alert('Please paste CSV data');
      return;
    }
    await onUploadData(csvInput);
    setCsvInput('');
    setUploadMode(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">ICT Swing Trading Analysis</h1>
        <p className="text-gray-400">Claude AI powered swing trade signals using ICT concepts</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg flex justify-between items-center">
          <span className="text-red-200">{error}</span>
          <button
            onClick={clearError}
            className="text-red-400 hover:text-red-300"
          >
            ✕
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {/* Symbol Input */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Symbol</label>
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="EURUSD"
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Timeframe Select */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Timeframe</label>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
          >
            <option>1H</option>
            <option>4H</option>
            <option>D</option>
            <option>W</option>
          </select>
        </div>

        {/* Run Analysis Button */}
        <div className="flex items-end">
          <button
            onClick={onRunAnalysis}
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors"
          >
            {loading ? 'Analyzing...' : 'Run Analysis'}
          </button>
        </div>

        {/* Upload Data Button */}
        <div className="flex items-end">
          <button
            onClick={() => setUploadMode(!uploadMode)}
            className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
          >
            {uploadMode ? 'Cancel' : 'Upload Data'}
          </button>
        </div>
      </div>

      {/* Upload Area */}
      {uploadMode && (
        <div className="mb-8 p-6 bg-slate-700/50 border border-slate-600 rounded-lg">
          <h3 className="text-lg font-medium text-white mb-4">Upload Market Data (CSV)</h3>
          <p className="text-gray-400 text-sm mb-4">
            Format: timestamp,open,high,low,close,volume
          </p>
          <textarea
            value={csvInput}
            onChange={(e) => setCsvInput(e.target.value)}
            placeholder="2024-02-17T00:00:00Z,1.0850,1.0860,1.0840,1.0855,1000000"
            className="w-full h-32 px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-gray-500 font-mono text-sm focus:outline-none focus:border-blue-500 mb-4"
          />
          <button
            onClick={handleUpload}
            disabled={loading}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors"
          >
            {loading ? 'Uploading...' : 'Upload Data'}
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Area */}
        <div className="lg:col-span-2">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">{symbol} {timeframe}</h2>
            <ChartComponent
              data={chartData}
              analysis={analysisData}
              loading={loading}
            />
          </div>

          {/* Analysis Log */}
          {analysisData && (
            <div className="mt-6 bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-4">Claude Analysis</h2>
              <AnalysisLog analysis={analysisData} />
            </div>
          )}
        </div>

        {/* Signals Panel */}
        <div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 sticky top-6">
            <SignalPanel analysisData={analysisData} loading={loading} />
          </div>
        </div>
      </div>
    </div>
  );
}
