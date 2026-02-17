import axios from 'axios';
import prisma from '../utils/db.js';

// Crypto symbols that use Binance API
const CRYPTO_SYMBOLS = new Set([
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'MATICUSDT', 'LINKUSDT'
]);

// Timeframe mapping
const TIMEFRAME_MAP = {
  binance: {
    '1H': '1h',
    '4H': '4h',
    'D': '1d',
    'W': '1w'
  },
  finnhub: {
    '1H': '60',
    '4H': '240',
    'D': 'D',
    'W': 'W'
  }
};

// Finnhub symbol mapping for metals
const FINNHUB_SYMBOL_MAP = {
  'XAUUSD': 'OANDA:XAU_USD',
  'XAGUSD': 'OANDA:XAG_USD'
};

/**
 * Fetch OHLCV candles from Binance REST API
 * @param {string} symbol - Trading symbol (e.g., 'BTCUSDT')
 * @param {string} timeframe - '1H', '4H', 'D', 'W'
 * @param {number} limit - Number of candles to fetch (default 100)
 * @returns {Promise<Array>} Array of normalized candle objects
 */
export async function fetchBinanceKlines(symbol, timeframe, limit = 100) {
  try {
    const interval = TIMEFRAME_MAP.binance[timeframe.toUpperCase()];
    if (!interval) {
      throw new Error(`Unsupported timeframe: ${timeframe}`);
    }

    const url = 'https://api.binance.com/api/v3/klines';
    const params = {
      symbol: symbol.toUpperCase(),
      interval: interval,
      limit: Math.min(limit, 1000) // Binance max is 1000
    };

    const response = await axios.get(url, { params });

    // Binance returns array of arrays: [openTime, open, high, low, close, volume, closeTime, ...]
    const candles = response.data.map((k) => ({
      symbol: symbol.toUpperCase(),
      timeframe: timeframe.toUpperCase(),
      timestamp: new Date(parseInt(k[0])),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5])
    }));

    return candles;
  } catch (error) {
    console.error(`[Binance] Error fetching ${symbol} ${timeframe}:`, error.message);
    throw new Error(`Binance fetch failed: ${error.message}`);
  }
}

/**
 * Fetch OHLCV candles from Finnhub Forex/Commodity API
 * @param {string} symbol - Trading symbol (e.g., 'XAUUSD', 'XAGUSD')
 * @param {string} timeframe - '1H', '4H', 'D', 'W'
 * @param {number} count - Number of candles to fetch (default 100)
 * @returns {Promise<Array>} Array of normalized candle objects
 */
export async function fetchFinnhubCandles(symbol, timeframe, count = 100) {
  try {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) {
      throw new Error('FINNHUB_API_KEY environment variable not set');
    }

    const finnhubSymbol = FINNHUB_SYMBOL_MAP[symbol.toUpperCase()];
    if (!finnhubSymbol) {
      throw new Error(`Unsupported Finnhub symbol: ${symbol}`);
    }

    const resolution = TIMEFRAME_MAP.finnhub[timeframe.toUpperCase()];
    if (!resolution) {
      throw new Error(`Unsupported timeframe: ${timeframe}`);
    }

    // Calculate time range for the request
    const now = Math.floor(Date.now() / 1000);
    let intervalSeconds;
    switch (resolution) {
      case '60':
        intervalSeconds = 3600;
        break;
      case '240':
        intervalSeconds = 14400;
        break;
      case 'D':
        intervalSeconds = 86400;
        break;
      case 'W':
        intervalSeconds = 604800;
        break;
      default:
        intervalSeconds = 3600;
    }

    const from = now - intervalSeconds * count;
    const to = now;

    const url = 'https://finnhub.io/api/v1/forex/candle';
    const params = {
      symbol: finnhubSymbol,
      resolution: resolution,
      from: from,
      to: to,
      token: apiKey
    };

    const response = await axios.get(url, { params });

    // Check if response indicates success
    if (response.data.s !== 'ok') {
      if (response.data.s === 'no_data') {
        console.warn(`[Finnhub] No data for ${symbol} ${timeframe}`);
        return [];
      }
      throw new Error(`Finnhub API returned status: ${response.data.s}`);
    }

    // Finnhub returns parallel arrays: {t: [...timestamps], o: [...opens], h, l, c, v}
    const { t, o, h, l, c, v } = response.data;
    const candles = t.map((timestamp, i) => ({
      symbol: symbol.toUpperCase(),
      timeframe: timeframe.toUpperCase(),
      timestamp: new Date(timestamp * 1000),
      open: o[i],
      high: h[i],
      low: l[i],
      close: c[i],
      volume: v[i] || 0
    }));

    return candles;
  } catch (error) {
    console.error(`[Finnhub] Error fetching ${symbol} ${timeframe}:`, error.message);
    throw new Error(`Finnhub fetch failed: ${error.message}`);
  }
}

/**
 * Main entry point - routes to appropriate API based on symbol
 * @param {string} symbol - Trading symbol
 * @param {string} timeframe - '1H', '4H', 'D', 'W'
 * @param {number} limit - Number of candles
 * @returns {Promise<Array>} Array of normalized candle objects
 */
export async function fetchLiveCandles(symbol, timeframe, limit = 100) {
  const upperSymbol = symbol.toUpperCase();

  // Route to appropriate API
  if (CRYPTO_SYMBOLS.has(upperSymbol)) {
    return fetchBinanceKlines(symbol, timeframe, limit);
  } else if (FINNHUB_SYMBOL_MAP[upperSymbol]) {
    return fetchFinnhubCandles(symbol, timeframe, limit);
  } else {
    throw new Error(
      `Unknown symbol: ${symbol}. Supported crypto: ${Array.from(CRYPTO_SYMBOLS).join(', ')}. Supported metals: ${Object.keys(FINNHUB_SYMBOL_MAP).join(', ')}`
    );
  }
}

/**
 * Save candles to database efficiently using createMany with skipDuplicates
 * @param {Array} candles - Array of candle objects to save
 * @param {object} prismaClient - Prisma client instance
 * @returns {Promise<object>} Result with count of created records
 */
export async function saveCandles(candles, prismaClient = prisma) {
  if (!candles || candles.length === 0) {
    return { count: 0 };
  }

  try {
    const result = await prismaClient.marketData.createMany({
      data: candles,
      skipDuplicates: true // Ignore unique constraint violations
    });

    return result;
  } catch (error) {
    console.error('[saveCandles] Database error:', error.message);
    throw new Error(`Failed to save candles: ${error.message}`);
  }
}

/**
 * Fetch and save candles in one operation
 * @param {string} symbol - Trading symbol
 * @param {string} timeframe - '1H', '4H', 'D', 'W'
 * @param {number} limit - Number of candles
 * @returns {Promise<object>} Result with fetched and saved counts and source
 */
export async function fetchAndSaveCandles(symbol, timeframe, limit = 100) {
  const upperSymbol = symbol.toUpperCase();
  const source = CRYPTO_SYMBOLS.has(upperSymbol) ? 'binance' : 'finnhub';

  // Fetch from appropriate source
  const candles = await fetchLiveCandles(symbol, timeframe, limit);

  // Save to database
  const result = await saveCandles(candles);

  return {
    symbol: upperSymbol,
    timeframe: timeframe.toUpperCase(),
    source,
    candlesFetched: candles.length,
    candlesSaved: result.count
  };
}
