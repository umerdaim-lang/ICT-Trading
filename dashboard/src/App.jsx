import { useState, useEffect } from 'react';
import { marketDataApi, analysisApi, signalsApi } from './lib/api';
import { useTradingStore } from './store/tradingStore';
import DashboardPage from './pages/DashboardPage';
import './index.css';

function App() {
  const {
    symbol,
    timeframe,
    setMarketData,
    setAnalysis,
    setActiveSignals,
    setLoading,
    setError
  } = useTradingStore();

  const [chartData, setChartData] = useState([]);
  const [analysisData, setAnalysisData] = useState(null);

  useEffect(() => {
    loadData();
  }, [symbol, timeframe]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load market data
      const marketRes = await marketDataApi.get(symbol, timeframe, 100);
      const candles = marketRes.data.data.candles || [];
      setChartData(candles);
      setMarketData(candles);

      // Load latest analysis
      const analysisRes = await analysisApi.latest(symbol, timeframe);
      setAnalysisData(analysisRes.data.data);
      setAnalysis(analysisRes.data.data);

      // Load active signals
      const signalsRes = await signalsApi.getBySymbol(symbol, 'ACTIVE');
      setActiveSignals(signalsRes.data.data.signals || []);

      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setError(error.message);
      setLoading(false);
    }
  };

  const handleRunAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await analysisApi.run(symbol, timeframe, 100);
      setAnalysisData(res.data.data);
      setAnalysis(res.data.data);

      // Extract signal
      if (res.data.data.analysisId) {
        await analysisApi.extractSignal(res.data.data.analysisId);
      }

      // Reload active signals
      const signalsRes = await signalsApi.getBySymbol(symbol, 'ACTIVE');
      setActiveSignals(signalsRes.data.data.signals || []);

      setLoading(false);
    } catch (error) {
      console.error('Analysis error:', error);
      setError(error.message);
      setLoading(false);
    }
  };

  const handleUploadData = async (csvData) => {
    try {
      setLoading(true);
      setError(null);

      // Parse CSV data
      const lines = csvData.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());

      const data = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        return {
          timestamp: values[0],
          open: values[1],
          high: values[2],
          low: values[3],
          close: values[4],
          volume: values[5]
        };
      });

      await marketDataApi.upload(symbol, timeframe, data);
      await loadData();

      setLoading(false);
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <DashboardPage
        chartData={chartData}
        analysisData={analysisData}
        onRunAnalysis={handleRunAnalysis}
        onUploadData={handleUploadData}
      />
    </div>
  );
}

export default App;
