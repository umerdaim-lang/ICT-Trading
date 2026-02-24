import DetailedTradesReport from '../components/DetailedTradesReport';

export default function DetailedTradesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Back Navigation */}
        <div className="mb-6">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
          >
            <span>←</span>
            <span>Back to Dashboard</span>
          </a>
        </div>

        {/* Main Content */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8">
          <DetailedTradesReport />
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>All 417 backtest trades from January 1, 2025 - February 24, 2026</p>
          <p className="mt-2">Walk-forward analysis with no look-ahead bias | $100 capital × 10X leverage</p>
        </div>
      </div>
    </div>
  );
}
