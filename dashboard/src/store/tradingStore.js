import { create } from 'zustand';

export const useTradingStore = create((set) => ({
  // State
  symbol: 'EURUSD',
  timeframe: '4H',
  marketData: [],
  analysis: null,
  signals: [],
  activeSignals: [],
  loading: false,
  error: null,

  // Live data state
  liveDataEnabled: false,
  liveDataSource: null, // 'binance' | 'finnhub' | null
  lastLiveFetch: null, // ISO string timestamp
  webhookLastReceived: null, // ISO string timestamp

  // Actions
  setSymbol: (symbol) => set({ symbol }),
  setTimeframe: (timeframe) => set({ timeframe }),
  setMarketData: (data) => set({ marketData: data }),
  setAnalysis: (analysis) => set({ analysis }),
  setSignals: (signals) => set({ signals }),
  setActiveSignals: (signals) => set({ activeSignals: signals }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  // Live data actions
  setLiveDataEnabled: (enabled) => set({ liveDataEnabled: enabled }),
  setLiveDataSource: (source) => set({ liveDataSource: source }),
  setLastLiveFetch: (ts) => set({ lastLiveFetch: ts }),
  setWebhookLastReceived: (ts) => set({ webhookLastReceived: ts }),

  // Combined actions
  loadMarketData: async (symbol, timeframe) => {
    set({ loading: true, error: null });
    try {
      // This will be called by components
      set({ loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  runAnalysis: async (symbol, timeframe) => {
    set({ loading: true, error: null });
    try {
      // This will be called by components
      set({ loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  clearError: () => set({ error: null })
}));
