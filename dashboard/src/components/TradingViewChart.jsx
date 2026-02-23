import { useEffect, useRef } from 'react';

export default function TradingViewChart({ symbol, timeframe, loading }) {
  const containerRef = useRef(null);
  const scriptRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    console.log(`[TradingViewChart] Loading ${symbol} ${timeframe}`);

    // Map our timeframes to TradingView format
    const timeframeMap = {
      '1H': '60',
      '4H': '240',
      'D': 'D',
      'W': 'W'
    };

    const tvTimeframe = timeframeMap[timeframe] || '240';

    // Clear existing content
    containerRef.current.innerHTML = '';

    // Create the TradingView widget script
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      console.log('[TradingViewChart] TradingView script loaded');

      if (window.TradingView) {
        console.log('[TradingViewChart] Creating widget for', symbol);
        new window.TradingView.widget({
          autosize: true,
          symbol: `BINANCE:${symbol}`,
          interval: tvTimeframe,
          timezone: 'UTC',
          theme: 'dark',
          style: '1',
          locale: 'en',
          enable_publishing: false,
          withdateranges: true,
          hide_side_toolbar: false,
          allow_symbol_change: true,
          container_id: 'tradingview-widget'
        });
        console.log('[TradingViewChart] ✅ Widget created successfully');
      }
    };

    if (containerRef.current) {
      containerRef.current.appendChild(script);
      scriptRef.current = script;
    }

    return () => {
      if (scriptRef.current && containerRef.current) {
        try {
          containerRef.current.removeChild(scriptRef.current);
        } catch (e) {
          console.warn('[TradingViewChart] Error cleaning up script:', e);
        }
      }
    };
  }, [symbol, timeframe]);

  if (loading) {
    return (
      <div className="w-full h-[600px] bg-slate-700/50 rounded-lg flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="text-gray-400">Loading TradingView chart...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-lg overflow-hidden bg-slate-900">
      <div
        ref={containerRef}
        id="tradingview-widget"
        className="w-full"
        style={{ height: '600px' }}
      />
    </div>
  );
}
