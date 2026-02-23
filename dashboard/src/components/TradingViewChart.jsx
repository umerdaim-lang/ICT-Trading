import { useEffect, useRef, useState } from 'react';

export default function TradingViewChart({ symbol, timeframe, loading }) {
  const containerRef = useRef(null);
  const widgetRef = useRef(null);
  const [widgetLoaded, setWidgetLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!containerRef.current) {
      console.warn('[TradingViewChart] Container ref not available');
      return;
    }

    console.log(`[TradingViewChart] Loading ${symbol} ${timeframe}`);
    setError(null);

    // Map our timeframes to TradingView format
    const timeframeMap = {
      '1H': '60',
      '4H': '240',
      'D': 'D',
      'W': 'W'
    };

    const tvTimeframe = timeframeMap[timeframe] || '240';
    const widgetId = `tv-widget-${symbol}-${timeframe}`;

    // Function to create widget with retry logic
    const createWidget = () => {
      if (!window.TradingView) {
        console.error('[TradingViewChart] TradingView not available');
        setError('TradingView script not loaded');
        return;
      }

      console.log('[TradingViewChart] Creating widget for', symbol);

      // Clear container and create fresh div
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
        const widgetDiv = document.createElement('div');
        widgetDiv.id = widgetId;
        widgetDiv.style.width = '100%';
        widgetDiv.style.height = '100%';
        containerRef.current.appendChild(widgetDiv);

        try {
          // Create the widget with a small delay to ensure DOM is ready
          setTimeout(() => {
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
              container_id: widgetId
            });
            console.log('[TradingViewChart] ✅ Widget created successfully');
            setWidgetLoaded(true);
            setError(null);
          }, 100);
        } catch (err) {
          console.error('[TradingViewChart] Error creating widget:', err);
          setError(`Widget creation failed: ${err.message}`);
        }
      }
    };

    // Check if TradingView script is already loaded
    if (window.TradingView) {
      console.log('[TradingViewChart] TradingView already loaded, creating widget');
      createWidget();
    } else {
      // Load the TradingView script
      console.log('[TradingViewChart] Loading TradingView script from CDN');

      // Check if script already exists
      const existingScript = document.querySelector('script[src*="tradingview"]');
      if (existingScript) {
        console.log('[TradingViewChart] TradingView script tag exists, waiting for load');
        const checkInterval = setInterval(() => {
          if (window.TradingView) {
            console.log('[TradingViewChart] TradingView loaded, creating widget');
            clearInterval(checkInterval);
            createWidget();
          }
        }, 100);

        // Timeout after 5 seconds
        setTimeout(() => clearInterval(checkInterval), 5000);
      } else {
        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;
        script.crossOrigin = 'anonymous';

        script.onload = () => {
          console.log('[TradingViewChart] ✅ TradingView script loaded from CDN');
          createWidget();
        };

        script.onerror = () => {
          const errorMsg = 'Failed to load TradingView script';
          console.error('[TradingViewChart]', errorMsg);
          setError(errorMsg);
        };

        console.log('[TradingViewChart] Appending script to document');
        document.head.appendChild(script);
        widgetRef.current = script;
      }
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

  if (error) {
    return (
      <div className="w-full h-[600px] bg-red-900/20 border border-red-500/30 rounded-lg flex items-center justify-center">
        <div className="flex flex-col items-center text-center">
          <p className="text-red-400 font-medium mb-2">⚠️ Chart Loading Error</p>
          <p className="text-red-300 text-sm">{error}</p>
          <p className="text-gray-400 text-xs mt-2">Check console for details (F12)</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-lg overflow-hidden bg-slate-900">
      <div
        ref={containerRef}
        className="w-full"
        style={{ height: '600px', backgroundColor: '#1e293b' }}
      />
    </div>
  );
}
