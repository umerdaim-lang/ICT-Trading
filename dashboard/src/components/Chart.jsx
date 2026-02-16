import { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

export default function ChartComponent({ data, analysis, loading }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        textColor: '#d1d5db',
        background: { type: 'solid', color: '#1e293b' }
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    // Format candle data
    const formattedData = data.map(candle => ({
      time: new Date(candle.timestamp).getTime() / 1000,
      open: parseFloat(candle.open),
      high: parseFloat(candle.high),
      low: parseFloat(candle.low),
      close: parseFloat(candle.close)
    }));

    candlestickSeries.setData(formattedData);

    // Add order block overlays if analysis exists
    if (analysis?.orderBlocks && analysis.orderBlocks.length > 0) {
      const orderBlockSeries = chart.addLineSeries({
        color: 'rgba(59, 130, 246, 0.3)',
        visible: false
      });

      analysis.orderBlocks.forEach(block => {
        // Add markers or shapes for order blocks (basic implementation)
      });
    }

    // Fit content
    chart.timeScale().fitContent();

    chartRef.current = chart;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data, analysis]);

  if (loading) {
    return (
      <div className="w-full h-96 bg-slate-700/50 rounded-lg flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="text-gray-400">Loading chart...</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="w-full h-96 bg-slate-700/50 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">No market data loaded</p>
          <p className="text-gray-500 text-sm mt-2">Upload market data to view chart</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={chartContainerRef}
      className="w-full h-96 rounded-lg overflow-hidden"
    />
  );
}
