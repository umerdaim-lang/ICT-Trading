import { useEffect, useRef, useState } from 'react';

export default function TradingViewChart({ symbol, timeframe, loading }) {
  const containerRef = useRef(null);
  const [widgetLoaded, setWidgetLoaded] = useState(false);

  useEffect(() => {
    if (!containerRef.current) {
      console.warn('[TradingViewChart] Container ref not available');
      return;
    }

    console.log(`[TradingViewChart] Loading ${symbol} ${timeframe}`);

    // Map our timeframes to TradingView format
    const timeframeMap = {
      '1H': '60',
      '4H': '240',
      'D': 'D',
      'W': 'W'
    };

    const tvTimeframe = timeframeMap[timeframe] || '240';

    // Function to create widget
    const createWidget = () => {
      if (!window.TradingView) {
        console.error('[TradingViewChart] TradingView not available');
        return;
      }

      console.log('[TradingViewChart] Creating widget for', symbol);

      // Clear container
      containerRef.current.innerHTML = '<div id="tradingview-widget"></div>';

      try {
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
        setWidgetLoaded(true);
      } catch (error) {
        console.error('[TradingViewChart] Error creating widget:', error);
      }
    };

    // Check if TradingView script is already loaded
    if (window.TradingView) {
      console.log('[TradingViewChart] TradingView already loaded');
      createWidget();
    } else {
      // Load the TradingView script
      console.log('[TradingViewChart] Loading TradingView script');
      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      script.onload = () => {
        console.log('[TradingViewChart] TradingView script loaded');
        createWidget();
      };
      script.onerror = () => {
        console.error('[TradingViewChart] Failed to load TradingView script');
      };
      document.body.appendChild(script);
    }

    return () => {
      setWidgetLoaded(false);
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
