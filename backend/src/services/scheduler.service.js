import cron from 'node-cron';
import { fetchAndSaveCandles } from './dataFetch.service.js';
import prisma from '../utils/db.js';

// Configuration for auto-fetched symbols
// Format: { symbol, timeframe, limit }
const ACTIVE_SYMBOLS = [
  { symbol: 'BTCUSDT', timeframe: '4H', limit: 100 },
  { symbol: 'ETHUSDT', timeframe: '4H', limit: 100 },
  { symbol: 'XAUUSD', timeframe: '4H', limit: 100 },
  { symbol: 'XAGUSD', timeframe: '4H', limit: 100 }
];

/**
 * Run the fetch job for all active symbols
 * Each symbol fetch is wrapped in its own try/catch to prevent one failure from blocking others
 */
async function runFetchJob() {
  console.log(`[Scheduler] Running fetch job at ${new Date().toISOString()}`);

  for (const config of ACTIVE_SYMBOLS) {
    try {
      const result = await fetchAndSaveCandles(
        config.symbol,
        config.timeframe,
        config.limit
      );

      console.log(
        `[Scheduler] ${result.symbol} ${result.timeframe}: fetched ${result.candlesFetched}, saved ${result.candlesSaved} from ${result.source}`
      );

      // Rate limiting for Finnhub (max 30 calls/sec, so 1100ms between requests is safe)
      if (result.source === 'finnhub') {
        await new Promise((resolve) => setTimeout(resolve, 1100));
      }
    } catch (error) {
      console.error(
        `[Scheduler] Failed for ${config.symbol} ${config.timeframe}:`,
        error.message
      );
      // Continue to next symbol instead of breaking
    }
  }

  console.log('[Scheduler] Fetch job completed');
}

/**
 * Initialize and start the scheduler
 * Runs immediately once, then every 15 minutes
 */
export function startScheduler() {
  console.log('[Scheduler] Started - will run every 15 minutes');

  // Run immediately on startup
  runFetchJob().catch((error) => {
    console.error('[Scheduler] Initial run failed:', error.message);
  });

  // Schedule recurring job: every 15 minutes (*/15 * * * *)
  cron.schedule('*/15 * * * *', () => {
    runFetchJob().catch((error) => {
      console.error('[Scheduler] Scheduled run failed:', error.message);
    });
  });
}

/**
 * Get the active symbols configuration (for reference or dynamic updates in future)
 * @returns {Array} Active symbols array
 */
export function getActiveSymbols() {
  return ACTIVE_SYMBOLS;
}

/**
 * Add a symbol to active monitoring (for future dynamic updates)
 * @param {string} symbol - Symbol to add
 * @param {string} timeframe - Timeframe for monitoring
 * @param {number} limit - Candle limit to fetch
 */
export function addActiveSymbol(symbol, timeframe = '4H', limit = 100) {
  const exists = ACTIVE_SYMBOLS.find(
    (s) => s.symbol.toUpperCase() === symbol.toUpperCase()
  );
  if (!exists) {
    ACTIVE_SYMBOLS.push({
      symbol: symbol.toUpperCase(),
      timeframe: timeframe.toUpperCase(),
      limit
    });
    console.log(`[Scheduler] Added ${symbol} to active symbols`);
  }
}

/**
 * Remove a symbol from active monitoring
 * @param {string} symbol - Symbol to remove
 */
export function removeActiveSymbol(symbol) {
  const index = ACTIVE_SYMBOLS.findIndex(
    (s) => s.symbol.toUpperCase() === symbol.toUpperCase()
  );
  if (index !== -1) {
    ACTIVE_SYMBOLS.splice(index, 1);
    console.log(`[Scheduler] Removed ${symbol} from active symbols`);
  }
}
