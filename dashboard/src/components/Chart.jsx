import { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

export default function ChartComponent({ data, analysis, loading }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    // Get container width and ensure it's valid
    let width = chartContainerRef.current.clientWidth;

    // If width is 0 (not yet laid out), use a default or skip
    if (width === 0) {
      width = 800; // Fallback width
    }

    try {
      const chart = createChart(chartContainerRef.current, {
        layout: {
          textColor: '#d1d5db',
          background: { type: 'solid', color: '#1e293b' }
        },
        timeScale: { timeVisible: true, secondsVisible: false },
        width: width,
        height: 500,
      });

      const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#10b981',
        downColor: '#ef4444',
        borderUpColor: '#10b981',
        borderDownColor: '#ef4444',
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
      });

      // Format candle data for lightweight-charts
      const formattedData = data.map(candle => {
        const time = new Date(candle.timestamp).getTime() / 1000;
        return {
          time,
          open: parseFloat(candle.open),
          high: parseFloat(candle.high),
          low: parseFloat(candle.low),
          close: parseFloat(candle.close)
        };
      }).sort((a, b) => a.time - b.time);

      if (formattedData.length === 0) {
        console.warn('[Chart] No valid candle data to display');
        return;
      }

      candlestickSeries.setData(formattedData);

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

      chart.timeScale().fitContent();
      chartRef.current = chart;

      const handleResize = () => {
        if (chartContainerRef.current) {
          chart.applyOptions({ width: chartContainerRef.current.clientWidth });
        }
      };
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        chart.remove();
      };
    } catch (error) {
      console.error('[Chart] Error rendering chart:', error);
    }
  }, [data, analysis]);

  if (loading) {
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
