import axios from 'axios';
import prisma from '../src/utils/db.js';

const TIMEFRAME_MAP = {
  mexc: {
    '1M': '1m',
    '5M': '5m',
    '15M': '15m',
    '30M': '30m',
    '1H': '1h',
    '4H': '4h',
    'D': '1d',
    'W': '1w',
    'M': '1M',
    'Y': '1y'
  }
};

/**
 * Calculate number of candles between dates
 */
function getCandelCountBetweenDates(startDate, endDate, timeframeMinutes) {
  const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
  return Math.floor(diff / (timeframeMinutes * 60 * 1000));
}

/**
 * Get minutes for a timeframe
 */
function getTimeframeMinutes(tf) {
  const map = { '1M': 1, '5M': 5, '15M': 15, '30M': 30, '1H': 60, '4H': 240, 'D': 1440, 'W': 10080, 'M': 44640, 'Y': 525960 };
  return map[tf.toUpperCase()] || 1440;
}

/**
 * Fetch historical OHLCV from MEXC API with time-based pagination
 */
async function fetchMexcHistorical(symbol, timeframe, startDate, endDate) {
  const upperSymbol = symbol.toUpperCase();
  const mexcTimeframe = TIMEFRAME_MAP.mexc[timeframe.toUpperCase()];

  if (!mexcTimeframe) {
    throw new Error(`Unsupported timeframe: ${timeframe}`);
  }

  let allCandles = [];
  let currentTime = new Date(startDate).getTime();
  const endTime = new Date(endDate).getTime();
  const batchSize = 1000; // MEXC max is 1000 per request

  console.log(`[MEXC] Fetching ${upperSymbol} ${timeframe} from ${startDate} to ${endDate}...`);

  while (currentTime < endTime) {
    try {
      const url = `https://api.mexc.com/api/v3/klines`;
      const params = {
        symbol: upperSymbol,
        interval: mexcTimeframe,
        startTime: currentTime,
        endTime: endTime,
        limit: batchSize
      };

      const response = await axios.get(url, { params, timeout: 10000 });
      const candles = response.data || [];

      if (candles.length === 0) break;

      // Parse candles
      const parsed = candles.map((k) => ({
        symbol: upperSymbol,
        timeframe: timeframe.toUpperCase(),
        timestamp: new Date(parseInt(k[0])),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]) || 0
      }));

      allCandles = allCandles.concat(parsed);
      console.log(`  ✓ Fetched ${candles.length} candles (total: ${allCandles.length})`);

      // Move to next batch
      const lastTimestamp = parseInt(candles[candles.length - 1][0]);
      currentTime = lastTimestamp + 1;

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`[MEXC] Error during fetch: ${error.message}`);
      throw error;
    }
  }

  console.log(`[MEXC] ✅ Total fetched: ${allCandles.length} candles`);
  return allCandles;
}

/**
 * Save candles to database
 */
async function saveCandlesToDatabase(candles) {
  if (candles.length === 0) return;

  console.log(`[DB] Saving ${candles.length} candles to database...`);

  // Upsert in batches
  const batchSize = 100;
  for (let i = 0; i < candles.length; i += batchSize) {
    const batch = candles.slice(i, i + batchSize);

    await Promise.all(batch.map(candle =>
      prisma.marketData.upsert({
        where: {
          symbol_timeframe_timestamp: {
            symbol: candle.symbol,
            timeframe: candle.timeframe,
            timestamp: candle.timestamp
          }
        },
        update: candle,
        create: candle
      })
    ));

    console.log(`  ✓ Saved batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(candles.length / batchSize)}`);
  }

  console.log(`[DB] ✅ All candles saved`);
}

/**
 * Main function
 */
async function main() {
  try {
    const symbol = 'BTCUSDT';
    const startDate = '2020-01-01';
    const endDate = '2024-12-31';

    console.log(`\n🚀 Fetching historical data for ${symbol}\n`);

    // Fetch D1, H1, M5 timeframes
    const timeframes = ['D', '1H', '5M'];

    for (const tf of timeframes) {
      console.log(`\n📊 Timeframe: ${tf}`);
      const candles = await fetchMexcHistorical(symbol, tf, startDate, endDate);
      await saveCandlesToDatabase(candles);
    }

    // Also fetch for DOGEUSDT
    console.log(`\n\n📊 Now fetching DOGEUSDT...\n`);
    const dogeStartDate = '2020-01-01';
    const dogeEndDate = '2024-12-31';

    for (const tf of timeframes) {
      console.log(`\n📊 Timeframe: ${tf}`);
      const candles = await fetchMexcHistorical('DOGEUSDT', tf, dogeStartDate, dogeEndDate);
      await saveCandlesToDatabase(candles);
    }

    console.log(`\n✅ Data fetch and save complete!\n`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
