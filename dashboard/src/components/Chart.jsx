import { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

export default function ChartComponent({ data, analysis, loading }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    console.log('[Chart] useEffect triggered - data:', data?.length, 'loading:', loading, 'containerRef:', !!chartContainerRef.current);

    if (!chartContainerRef.current) {
      console.warn('[Chart] Container ref not available yet');
      return;
    }

    if (data.length === 0) {
      console.warn('[Chart] No data to display yet');
      return;
    }

    // Get container width and ensure it's valid
    let width = chartContainerRef.current.clientWidth;

    // If width is 0 (not yet laid out), use a default or skip
    if (width === 0) {
      width = 800; // Fallback width
    }

    try {
      console.log('[Chart] Creating chart with width:', width, 'height: 500');
      const chart = createChart(chartContainerRef.current, {
        layout: {
          textColor: '#d1d5db',
          background: { type: 'solid', color: '#1e293b' }
        },
        timeScale: { timeVisible: true, secondsVisible: false },
        width: width,
        height: 500,
      });
      console.log('[Chart] Chart created successfully');

      const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#10b981',
        downColor: '#ef4444',
        borderUpColor: '#10b981',
        borderDownColor: '#ef4444',
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
      });
      console.log('[Chart] Candlestick series added');

      // Format candle data for lightweight-charts
      console.log('[Chart] Formatting', data.length, 'candles...');
      const formattedData = data.map((candle, idx) => {
        const time = new Date(candle.timestamp).getTime() / 1000;
        const formatted = {
          time,
          open: parseFloat(candle.open),
          high: parseFloat(candle.high),
          low: parseFloat(candle.low),
          close: parseFloat(candle.close)
        };
        if (idx < 2 || idx === data.length - 1) {
          console.log(`  [Chart] Candle ${idx}:`, formatted);
        }
        return formatted;
      }).sort((a, b) => a.time - b.time);

      console.log('[Chart] Formatted data count:', formattedData.length);

      if (formattedData.length === 0) {
        console.warn('[Chart] No valid candle data to display');
        return;
      }

      console.log('[Chart] Setting data on candlestick series...');
      candlestickSeries.setData(formattedData);
      console.log('[Chart] Data set successfully');

      // --- Order Block Zones: two price lines per block (top and bottom) ---
      if (analysis?.orderBlocks && analysis.orderBlocks.length > 0) {
        analysis.orderBlocks.slice(-8).forEach((block, idx) => {
          const isBullish = block.type === 'bullish';
          const color = isBullish ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)';
          const label = isBullish ? `OB Bull` : `OB Bear`;

          // Top line of the OB zone
          candlestickSeries.createPriceLine({
            price: parseFloat(block.high),
            color,
            lineWidth: 1,
            lineStyle: 2,  // Dashed
            axisLabelVisible: false,
            title: label,
          });

          // Bottom line of the OB zone
          candlestickSeries.createPriceLine({
            price: parseFloat(block.low),
            color,
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: false,
            title: '',
          });
        });
      }

      // --- FVG Zones: two price lines per gap ---
      if (analysis?.fairValueGaps && analysis.fairValueGaps.length > 0) {
        analysis.fairValueGaps.slice(-6).forEach((fvg) => {
          const isBullish = fvg.type === 'bullish';
          const color = isBullish ? 'rgba(59, 130, 246, 0.7)' : 'rgba(168, 85, 247, 0.7)';
          const label = isBullish ? 'FVG Bull' : 'FVG Bear';

          candlestickSeries.createPriceLine({
            price: parseFloat(fvg.top),
            color,
            lineWidth: 1,
            lineStyle: 3,  // Dotted
            axisLabelVisible: false,
            title: label,
          });
          candlestickSeries.createPriceLine({
            price: parseFloat(fvg.bottom),
            color,
            lineWidth: 1,
            lineStyle: 3,
            axisLabelVisible: false,
            title: '',
          });
        });
      }

      // --- Swing High/Low Markers ---
      if (analysis?.liquidityLevels) {
        const markers = [];

        (analysis.liquidityLevels.highs || []).slice(-5).forEach(sh => {
          const time = new Date(sh.timestamp).getTime() / 1000;
          if (!isNaN(time)) {
            markers.push({
              time,
              position: 'aboveBar',
              color: '#f59e0b',
              shape: 'arrowDown',
              text: 'SH',
              size: 1
            });
          }
        });

        (analysis.liquidityLevels.lows || []).slice(-5).forEach(sl => {
          const time = new Date(sl.timestamp).getTime() / 1000;
          if (!isNaN(time)) {
            markers.push({
              time,
              position: 'belowBar',
              color: '#06b6d4',
              shape: 'arrowUp',
              text: 'SL',
              size: 1
            });
          }
        });

        // setMarkers requires markers sorted by time
        markers.sort((a, b) => a.time - b.time);
        if (markers.length > 0) {
          candlestickSeries.setMarkers(markers);
        }
      }

      console.log('[Chart] Fitting content to view...');
      chart.timeScale().fitContent();
      console.log('[Chart] Chart rendering complete!');
      chartRef.current = chart;

      const handleResize = () => {
        if (chartContainerRef.current) {
          const newWidth = chartContainerRef.current.clientWidth;
          console.log('[Chart] Resizing chart to width:', newWidth);
          chart.applyOptions({ width: newWidth });
        }
      };
      window.addEventListener('resize', handleResize);

      return () => {
        console.log('[Chart] Cleaning up chart...');
        window.removeEventListener('resize', handleResize);
        chart.remove();
      };
    } catch (error) {
      console.error('[Chart] ❌ ERROR rendering chart:', error);
      console.error('[Chart] Error stack:', error.stack);
      console.error('[Chart] Error name:', error.name);
      console.error('[Chart] Error message:', error.message);
    }
  }, [data, analysis]);

  if (loading) {
    console.log('[Chart] Rendering loading state...');
    return (
      <div className="w-full h-[500px] bg-slate-700/50 rounded-lg flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="text-gray-400">Loading chart...</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    console.log('[Chart] Rendering empty state - no data');
    return (
      <div className="w-full h-[500px] bg-slate-700/50 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">No market data loaded</p>
          <p className="text-gray-500 text-sm mt-2">Upload market data or Fetch Live to view chart</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={chartContainerRef}
      className="w-full h-[500px] rounded-lg overflow-hidden"
    />
  );
}
