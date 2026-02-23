import axios from 'axios';
import prisma from '../utils/db.js';

// Crypto symbols that use MEXC API (primary) with CoinGecko fallback
const CRYPTO_SYMBOLS = new Set([
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'MATICUSDT', 'LINKUSDT'
]);

// MEXC symbol mapping (same as base symbols)
const MEXC_SYMBOL_MAP = {
  'BTCUSDT': 'BTCUSDT',
  'ETHUSDT': 'ETHUSDT',
  'BNBUSDT': 'BNBUSDT',
  'SOLUSDT': 'SOLUSDT',
  'XRPUSDT': 'XRPUSDT',
  'ADAUSDT': 'ADAUSDT',
  'DOGEUSDT': 'DOGEUSDT',
  'AVAXUSDT': 'AVAXUSDT',
  'MATICUSDT': 'MATICUSDT',
  'LINKUSDT': 'LINKUSDT'
};

// CoinGecko coin ID mapping (fallback)
const COINGECKO_SYMBOL_MAP = {
  'BTCUSDT': 'bitcoin',
  'ETHUSDT': 'ethereum',
  'BNBUSDT': 'binancecoin',
  'SOLUSDT': 'solana',
  'XRPUSDT': 'ripple',
  'ADAUSDT': 'cardano',
  'DOGEUSDT': 'dogecoin',
  'AVAXUSDT': 'avalanche-2',
  'MATICUSDT': 'matic-network',
  'LINKUSDT': 'chainlink'
};

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

// Finnhub symbol mapping for metals and forex
const FINNHUB_SYMBOL_MAP = {
  'XAUUSD': 'OANDA:XAU_USD',
  'XAGUSD': 'OANDA:XAG_USD'
};

/**
 * Fetch OHLCV candles from MEXC API (primary crypto source)
 * @param {string} symbol - Trading symbol (e.g., 'BTCUSDT')
 * @param {string} timeframe - '1H', '4H', 'D', 'W'
 * @param {number} limit - Number of candles to fetch (default 100)
 * @returns {Promise<Array>} Array of normalized candle objects
 */
export async function fetchMexcCandles(symbol, timeframe, limit = 100) {
  try {
    const upperSymbol = symbol.toUpperCase();
    const mexcSymbol = MEXC_SYMBOL_MAP[upperSymbol];
    if (!mexcSymbol) {
      throw new Error(`Unsupported symbol for MEXC: ${symbol}`);
    }

    // Map timeframes to MEXC interval values
    const mexcTimeframe = {
      '1H': '1h',
      '4H': '4h',
      'D': '1d',
      'W': '1w'
    }[timeframe.toUpperCase()];

    if (!mexcTimeframe) {
      throw new Error(`Unsupported timeframe: ${timeframe}`);
    }

    const accessKey = process.env.MEXC_ACCESS_KEY || 'mx0vglrLturYEqI0ec';
    const apiKey = process.env.MEXC_API_KEY || '82d082d1889441b38acbc866ea652412';

    if (!accessKey || !apiKey) {
      throw new Error('MEXC credentials not available');
    }

    const url = `https://api.mexc.com/api/v3/klines`;
    const params = {
      symbol: mexcSymbol,
      interval: mexcTimeframe,
      limit: Math.min(limit, 1000) // MEXC max 1000 candles per request
    };

    const response = await axios.get(url, {
      params,
      headers: {
        'X-MEXC-APIKEY': accessKey
      }
    });

    // MEXC returns array of [timestamp, open, high, low, close, volume, ...]
    const candles = (response.data || []).map((k) => ({
      symbol: upperSymbol,
      timeframe: timeframe.toUpperCase(),
      timestamp: new Date(parseInt(k[0])),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]) || 0
    }));

    return candles;
  } catch (error) {
    console.error(`[MEXC] Error fetching ${symbol} ${timeframe}:`, error.message);
    throw new Error(`MEXC fetch failed: ${error.message}`);
  }
}

/**
 * Fetch OHLCV candles from CoinGecko API (fallback, free, cloud-friendly)
 * @param {string} symbol - Trading symbol (e.g., 'BTCUSDT')
 * @param {string} timeframe - '1H', '4H', 'D', 'W'
 * @param {number} limit - Number of candles to fetch (default 100)
 * @returns {Promise<Array>} Array of normalized candle objects
 */
export async function fetchCoinGeckoCandles(symbol, timeframe, limit = 100) {
  try {
    const upperSymbol = symbol.toUpperCase();
    const coinId = COINGECKO_SYMBOL_MAP[upperSymbol];
    if (!coinId) {
      throw new Error(`Unsupported symbol for CoinGecko: ${symbol}`);
    }

    // CoinGecko free API has limited historical data
    // Map timeframes to approximate day ranges
    let days = '1'; // Default: 1 day
    switch (timeframe.toUpperCase()) {
      case '1H':
        days = '1'; // 1 day for hourly
        break;
      case '4H':
        days = '7'; // 7 days for 4H
        break;
      case 'D':
        days = '90'; // 90 days for daily
        break;
      case 'W':
        days = '365'; // 365 days for weekly
        break;
      default:
        days = '7';
    }

    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc`;
    const params = {
      vs_currency: 'usd',
      days: days
    };

    const response = await axios.get(url, { params });

    // CoinGecko returns array of [timestamp, open, high, low, close]
    // Filter to get roughly the requested limit
    let candlesData = response.data || [];
    if (candlesData.length > limit) {
      candlesData = candlesData.slice(-limit); // Get last N candles
    }

    const candles = candlesData.map((k) => ({
      symbol: upperSymbol,
      timeframe: timeframe.toUpperCase(),
      timestamp: new Date(parseInt(k[0])),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: 0 // CoinGecko free API doesn't provide volume in OHLC endpoint
    }));

    return candles;
  } catch (error) {
    console.error(`[CoinGecko] Error fetching ${symbol} ${timeframe}:`, error.message);
    throw new Error(`CoinGecko fetch failed: ${error.message}`);
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
    // Get API key from environment or use fallback (for development)
    const apiKey = process.env.FINNHUB_API_KEY || 'd6a32epr01qsjlb9i6cgd6a32epr01qsjlb9i6d0';
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
 * Uses MEXC for crypto (primary), falls back to CoinGecko if needed
 * @param {string} symbol - Trading symbol
 * @param {string} timeframe - '1H', '4H', 'D', 'W'
 * @param {number} limit - Number of candles
 * @returns {Promise<Array>} Array of normalized candle objects
 */
export async function fetchLiveCandles(symbol, timeframe, limit = 100) {
  const upperSymbol = symbol.toUpperCase();

  // Route to appropriate API
  if (CRYPTO_SYMBOLS.has(upperSymbol)) {
    // Try MEXC first (better rate limits)
    try {
      console.log(`[fetchLiveCandles] Attempting MEXC for ${upperSymbol}...`);
      const candles = await fetchMexcCandles(symbol, timeframe, limit);
      console.log(`[fetchLiveCandles] ✅ MEXC successful for ${upperSymbol}`);
      return candles;
    } catch (mexcError) {
      console.warn(`[fetchLiveCandles] MEXC failed: ${mexcError.message}. Trying CoinGecko fallback...`);
      try {
        const candles = await fetchCoinGeckoCandles(symbol, timeframe, limit);
        console.log(`[fetchLiveCandles] ✅ CoinGecko fallback successful for ${upperSymbol}`);
        return candles;
      } catch (cgError) {
        console.error(`[fetchLiveCandles] Both MEXC and CoinGecko failed for ${upperSymbol}`);
        throw new Error(`Failed to fetch ${upperSymbol}: MEXC - ${mexcError.message}, CoinGecko - ${cgError.message}`);
      }
    }
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
  let source = 'unknown';

  if (CRYPTO_SYMBOLS.has(upperSymbol)) {
    source = 'mexc (primary) or coingecko (fallback)';
  } else if (Object.keys(FINNHUB_SYMBOL_MAP).includes(upperSymbol)) {
    source = 'finnhub';
  }

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
