import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Market Data API
export const marketDataApi = {
  upload: (symbol, timeframe, data) =>
    api.post('/api/market-data/upload', { symbol, timeframe, data }),

  get: (symbol, timeframe, limit = 100) =>
    api.get(`/api/market-data/${symbol}/${timeframe}`, { params: { limit } }),

  delete: (symbol) =>
    api.delete(`/api/market-data/${symbol}`)
};

// Analysis API
export const analysisApi = {
  run: (symbol, timeframe, lookbackPeriods = 100) =>
    api.post('/api/analysis/run', { symbol, timeframe, lookbackPeriods }),

  latest: (symbol, timeframe = '4H') =>
    api.get(`/api/analysis/${symbol}/latest`, { params: { timeframe } }),

  history: (symbol = null, limit = 20, offset = 0) =>
    api.get('/api/analysis/history', { params: { symbol, limit, offset } }),

  extractSignal: (analysisId) =>
    api.post(`/api/analysis/${analysisId}/extract-signal`)
};

// Signals API
export const signalsApi = {
  getActive: () =>
    api.get('/api/signals/active'),

  getById: (id) =>
    api.get(`/api/signals/${id}`),

  getBySymbol: (symbol, status = 'ACTIVE', limit = 50) =>
    api.get(`/api/signals/symbol/${symbol}`, { params: { status, limit } }),

  close: (id, closedPrice = null, outcome = null) =>
    api.put(`/api/signals/${id}/close`, { closedPrice, outcome }),

  delete: (id) =>
    api.delete(`/api/signals/${id}`)
};

export default api;
