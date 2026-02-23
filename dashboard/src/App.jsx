import { useState, useEffect, useRef } from 'react';
import { marketDataApi, analysisApi, signalsApi, webhookApi } from './lib/api';
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
    setError,
    liveDataEnabled,
    liveDataSource,
    lastLiveFetch,
    webhookLastReceived,
    setLiveDataEnabled,
    setLiveDataSource,
    setLastLiveFetch,
    setWebhookLastReceived
  } = useTradingStore();

  const [chartData, setChartData] = useState([]);
  const [analysisData, setAnalysisData] = useState(null);
  const livePollingRef = useRef(null);

  useEffect(() => {
    loadData();
  }, [symbol, timeframe]);

  // Auto-refresh polling when live data is enabled (60 seconds)
  useEffect(() => {
    if (!liveDataEnabled) {
      if (livePollingRef.current) {
        clearInterval(livePollingRef.current);
        livePollingRef.current = null;
      }
      return;
    }

    const intervalId = setInterval(async () => {
      try {
        await marketDataApi.fetchLive(symbol, timeframe, 20); // Only last 20 for refresh
        setLastLiveFetch(new Date().toISOString());
        await loadData();
      } catch (err) {
        console.warn('[AutoRefresh] Failed:', err.message);
        // Do not set error state for background polling failures
      }
    }, 60000); // 60 seconds

    livePollingRef.current = intervalId;

    return () => {
      if (livePollingRef.current) {
        clearInterval(livePollingRef.current);
      }
    };
  }, [liveDataEnabled, symbol, timeframe]);

  // Webhook status polling (30 seconds)
  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const res = await webhookApi.status();
        if (res.data.data?.lastReceivedAt) {
          setWebhookLastReceived(res.data.data.lastReceivedAt);
        }
      } catch (err) {
        // Silent fail - webhook status is non-critical
        console.debug('[WebhookStatus] Failed:', err.message);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(intervalId);
  }, []);

  const loadData = async () => {
    try {
      console.log('[App] loadData() called for', symbol, timeframe);
      setLoading(true);
      setError(null);

      // Load market data
      console.log('[App] Fetching market data...');
      const marketRes = await marketDataApi.get(symbol, timeframe, 100);
      const candles = marketRes.data.data.candles || [];
      console.log('[App] ✅ Loaded', candles.length, 'candles');
      console.log('[App] First candle:', candles[0]);
      console.log('[App] Last candle:', candles[candles.length - 1]);
      setChartData(candles);
      setMarketData(candles);

      // Load latest analysis (404 is normal if no analysis exists yet)
      try {
        const analysisRes = await analysisApi.latest(symbol, timeframe);
        setAnalysisData(analysisRes.data.data);
        setAnalysis(analysisRes.data.data);
      } catch (analysisError) {
        // 404 = No analysis data yet (normal), don't show as error
        if (analysisError.response?.status !== 404) {
          throw analysisError;
        }
        setAnalysisData(null);
        setAnalysis(null);
      }

      // Load active signals
      try {
        const signalsRes = await signalsApi.getBySymbol(symbol, 'ACTIVE');
        setActiveSignals(signalsRes.data.data.signals || []);
      } catch (signalsError) {
        // 404 = No signals yet (normal), don't show as error
        if (signalsError.response?.status !== 404) {
          throw signalsError;
        }
        setActiveSignals([]);
      }

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

  const handleFetchLive = async () => {
    try {
      console.log('[App] handleFetchLive() called for', symbol, timeframe);
      setLoading(true);
      setError(null);
      console.log('[App] Fetching live data from API...');
      const res = await marketDataApi.fetchLive(symbol, timeframe, 100);
      console.log('[App] ✅ Live fetch response:', res.data.data);
      const { source, candlesFetched } = res.data.data;
      console.log('[App] Source:', source, 'Fetched:', candlesFetched, 'candles');
      setLiveDataSource(source);
      setLastLiveFetch(new Date().toISOString());
      setLiveDataEnabled(true);
      // Reload chart data after saving
      console.log('[App] Reloading chart data...');
      await loadData();
      console.log('[App] ✅ Fetch Live completed successfully');
      setLoading(false);
    } catch (error) {
      console.error('[App] ❌ Live fetch error:', error);
      console.error('[App] Error details:', error.response?.data);
      setError(`Live fetch failed: ${error.response?.data?.error?.message || error.message}`);
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
        onFetchLive={handleFetchLive}
        liveStatus={{
          enabled: liveDataEnabled,
          source: liveDataSource,
          lastFetch: lastLiveFetch,
          webhookLastReceived
        }}
      />
    </div>
  );
}

export default App;
