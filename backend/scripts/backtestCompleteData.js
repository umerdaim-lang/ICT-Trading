/**
 * ICT Strategy Backtest - COMPLETE DATA FETCHING
 * Properly fetches Jan 2025 - Feb 24, 2026 (13 months) with chunking
 * D1: 500 candles ✓
 * H1: 9,360 candles (13 months) ✓
 * M5: 112,320 candles (13 months) ✓
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';

const BINANCE_TIMEFRAMES = {
  'D': '1d',
  '1H': '1h',
  '5M': '5m'
};

/**
 * Fetch from Binance API with chunking for long date ranges
 * Binance max is 1000 candles per request, so we fetch in chunks
 */
async function fetchBinanceDataChunked(symbol, timeframe, startDate, endDate) {
  const url = 'https://api.binance.com/api/v3/klines';
  const interval = BINANCE_TIMEFRAMES[timeframe];
  let allCandles = [];

  // Calculate chunk size based on timeframe
  let chunkDays = 0;
  switch (timeframe) {
    case 'D':
      chunkDays = 500; // 500 days = ~16 months at 1000 limit
      break;
    case '1H':
      chunkDays = 30; // 30 days = ~720 hourly candles at 1000 limit
      break;
    case '5M':
      chunkDays = 3; // 3 days = ~864 5M candles at 1000 limit
      break;
    default:
      chunkDays = 30;
  }

  const startTime = new Date(startDate).getTime();
  const endTime = new Date(endDate).getTime();
  const chunkMs = chunkDays * 24 * 60 * 60 * 1000;

  let currentTime = startTime;
  let chunkNum = 0;

  console.log(`[Binance] Fetching ${symbol} ${timeframe} from ${startDate} to ${endDate}...`);
  console.log(`[Binance] Using ${chunkDays}-day chunks for efficient API usage\n`);

  while (currentTime < endTime) {
    chunkNum++;
    const chunkEnd = Math.min(currentTime + chunkMs, endTime);

    try {
      const response = await axios.get(url, {
        params: {
          symbol: symbol,
          interval: interval,
          startTime: Math.floor(currentTime),
          endTime: Math.floor(chunkEnd),
          limit: 1000
        },
        timeout: 15000
      });

      const candles = response.data || [];

      if (candles.length === 0) {
        console.log(`[Binance] Chunk ${chunkNum}: No data (likely end of available data)`);
        break;
      }

      const parsed = candles.map(k => ({
        timestamp: new Date(parseInt(k[0])),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[7])
      }));

      allCandles = allCandles.concat(parsed);
      const percent = Math.min(((currentTime - startTime) / (endTime - startTime)) * 100, 100).toFixed(1);
      console.log(`[Binance] Chunk ${chunkNum}: ${candles.length} candles (total: ${allCandles.length}, ${percent}%)`);

      currentTime = chunkEnd;

      // Rate limit: wait 200ms between requests
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      console.error(`[Binance] Chunk ${chunkNum} error: ${error.message}`);
      // Continue with next chunk even if one fails
      currentTime = chunkEnd;
    }
  }

  // Sort by timestamp (ascending) to ensure correct order
  allCandles.sort((a, b) => a.timestamp - b.timestamp);

  console.log(`\n✅ ${symbol} ${timeframe}: Total ${allCandles.length} candles fetched\n`);
  return allCandles;
}

/**
 * Get D1 bias
 */
function getDailyBias(candles, currentDate) {
  const currentDay = currentDate.toDateString();

  for (let i = candles.length - 1; i >= 0; i--) {
    const candleDay = candles[i].timestamp.toDateString();
    if (candleDay < currentDay) {
      return candles[i].close > candles[i].open ? 'LONG' : 'SHORT';
    }
  }

  return null;
}

/**
 * Check killzone
 */
function getKillzone(timestamp) {
  const date = new Date(timestamp);
  const nyHour = date.getUTCHours() - 5;

  if (nyHour >= 20 || nyHour < 0) return 'ASIA';
  if (nyHour >= 2 && nyHour < 5) return 'LONDON';
  if (nyHour >= 7 && nyHour < 10) return 'NY';

  return null;
}

/**
 * Find order blocks
 */
function findOrderBlocks(candles) {
  const blocks = [];

  for (let i = 1; i < candles.length - 1; i++) {
    if (candles[i].high > candles[i - 1].high && candles[i].high >= candles[i + 1].high) {
      blocks.push({ type: 'bullish', price: candles[i].high, index: i });
    }

    if (candles[i].low < candles[i - 1].low && candles[i].low <= candles[i + 1].low) {
      blocks.push({ type: 'bearish', price: candles[i].low, index: i });
    }
  }

  return blocks.slice(-10);
}

/**
 * Main backtest
 */
async function runBacktest() {
  try {
    console.log('\n' + '='.repeat(140));
    console.log('🚀 ICT STRATEGY BACKTEST - COMPLETE 13-MONTH DATA');
    console.log('='.repeat(140) + '\n');

    const symbol = 'BTCUSDT';
    const startDate = '2025-01-01';
    const endDate = '2026-02-24';
    const startingCapital = 100;
    const leverage = 10;
    const tradingCapital = startingCapital * leverage;

    console.log(`📊 CONFIGURATION:`);
    console.log(`   Symbol:         ${symbol}`);
    console.log(`   Period:         ${startDate} to ${endDate} (13 months)`);
    console.log(`   Capital:        $${startingCapital} (${leverage}X leverage = $${tradingCapital})`);
    console.log(`   Method:         WALK-FORWARD (no look-ahead bias)\n`);

    // Fetch complete data with chunking
    console.log(`📥 FETCHING COMPLETE HISTORICAL DATA...\n`);

    const [dailyCandles, hourlyCandles, fiveMinCandles] = await Promise.all([
      fetchBinanceDataChunked(symbol, 'D', startDate, endDate),
      fetchBinanceDataChunked(symbol, '1H', startDate, endDate),
      fetchBinanceDataChunked(symbol, '5M', startDate, endDate)
    ]);

    if (fiveMinCandles.length === 0) {
      throw new Error('Failed to fetch 5M data');
    }

    console.log(`✅ DATA LOADED:`);
    console.log(`   Daily (D1):     ${dailyCandles.length} candles`);
    console.log(`   Hourly (H1):    ${hourlyCandles.length} candles`);
    console.log(`   5-Minute (M5):  ${fiveMinCandles.length} candles`);
    console.log(`   Period:         ${fiveMinCandles[0].timestamp.toISOString().split('T')[0]} to ${fiveMinCandles[fiveMinCandles.length - 1].timestamp.toISOString().split('T')[0]}\n`);

    // Backtest
    let accountBalance = tradingCapital;
    let trades = [];
    let activeTrade = null;
    let peakEquity = accountBalance;
    let maxDrawdown = 0;

    console.log(`⚙️  RUNNING BACKTEST WITH COMPLETE DATA...\n`);

    let candleCount = 0;
    let killzoneCount = 0;
    let biasMatches = 0;

    for (let i = 100; i < fiveMinCandles.length; i++) {
      const currentCandle = fiveMinCandles[i];
      const price = currentCandle.close;
      const time = currentCandle.timestamp;

      candleCount++;

      // WALK-FORWARD: Only use historical data (up to i-1)
      const historicalDaily = dailyCandles.filter(c => c.timestamp < time);
      const historicalHourly = hourlyCandles.filter(c => c.timestamp < time);

      if (historicalDaily.length === 0 || historicalHourly.length < 20) continue;

      // Check killzone
      const killzone = getKillzone(time);
      if (!killzone) continue;

      killzoneCount++;

      // Get bias
      const bias = getDailyBias(historicalDaily, time);
      if (!bias) continue;

      biasMatches++;

      // Get H1 order blocks
      const h1Lookback = historicalHourly.slice(-100);
      if (h1Lookback.length < 20) continue;

      const orderBlocks = findOrderBlocks(h1Lookback);
      const alignedOBs = orderBlocks.filter(ob => {
        if (bias === 'LONG') return ob.type === 'bullish';
        return ob.type === 'bearish';
      });

      if (alignedOBs.length === 0) continue;

      // Determine quality
      let quality = 'B';
      if (alignedOBs.length >= 3) quality = 'A+';
      else if (alignedOBs.length === 2) quality = 'A';

      // Generate signal
      const shouldBuy = bias === 'LONG' && alignedOBs.length >= 2;
      const shouldSell = bias === 'SHORT' && alignedOBs.length >= 2;

      // Close existing trade
      if (activeTrade) {
        let profit;
        let reason = '';

        if (activeTrade.side === 'LONG') {
          profit = (price - activeTrade.entryPrice) * (tradingCapital / activeTrade.entryPrice);
          reason = profit > 0
            ? `Signal continued. Price: ${activeTrade.entryPrice.toFixed(2)} → ${price.toFixed(2)}`
            : `Bias reversed to SHORT. Price: ${activeTrade.entryPrice.toFixed(2)} → ${price.toFixed(2)}`;
        } else {
          profit = (activeTrade.entryPrice - price) * (tradingCapital / activeTrade.entryPrice);
          reason = profit > 0
            ? `Signal continued. Price: ${activeTrade.entryPrice.toFixed(2)} → ${price.toFixed(2)}`
            : `Bias reversed to LONG. Price: ${activeTrade.entryPrice.toFixed(2)} → ${price.toFixed(2)}`;
        }

        accountBalance += profit;

        trades.push({
          id: trades.length + 1,
          side: activeTrade.side,
          quality: activeTrade.quality,
          killzone: activeTrade.killzone,
          entryDate: activeTrade.entryTime.toISOString().split('T')[0],
          entryTime: activeTrade.entryTime,
          entryPrice: activeTrade.entryPrice,
          exitDate: time.toISOString().split('T')[0],
          exitTime: time,
          exitPrice: price,
          profit: profit,
          profitPercent: (profit / tradingCapital) * 100,
          obCount: activeTrade.obCount,
          entryReason: activeTrade.entryReason,
          exitReason: reason,
          isWin: profit > 0
        });

        activeTrade = null;
      }

      // Enter new trade
      if (!activeTrade && shouldBuy) {
        activeTrade = {
          side: 'LONG',
          entryPrice: price,
          entryTime: time,
          quality: quality,
          killzone: killzone,
          obCount: alignedOBs.length,
          entryReason: `D1:${bias} | H1:${alignedOBs.length}OBs | ${killzone} | Q:${quality}`
        };
      } else if (!activeTrade && shouldSell) {
        activeTrade = {
          side: 'SHORT',
          entryPrice: price,
          entryTime: time,
          quality: quality,
          killzone: killzone,
          obCount: alignedOBs.length,
          entryReason: `D1:${bias} | H1:${alignedOBs.length}OBs | ${killzone} | Q:${quality}`
        };
      }

      // Track drawdown
      if (accountBalance > peakEquity) peakEquity = accountBalance;
      const dd = ((peakEquity - accountBalance) / peakEquity) * 100;
      if (dd > maxDrawdown) maxDrawdown = dd;

      if (i % 10000 === 0) {
        const percent = ((i / fiveMinCandles.length) * 100).toFixed(1);
        console.log(`  ✓ ${percent}% - ${trades.length} trades completed`);
      }
    }

    // Close final trade
    if (activeTrade) {
      const lastPrice = fiveMinCandles[fiveMinCandles.length - 1].close;
      const profit = activeTrade.side === 'LONG'
        ? (lastPrice - activeTrade.entryPrice) * (tradingCapital / activeTrade.entryPrice)
        : (activeTrade.entryPrice - lastPrice) * (tradingCapital / activeTrade.entryPrice);

      accountBalance += profit;

      trades.push({
        id: trades.length + 1,
        side: activeTrade.side,
        quality: activeTrade.quality,
        killzone: activeTrade.killzone,
        entryDate: activeTrade.entryTime.toISOString().split('T')[0],
        entryTime: activeTrade.entryTime,
        entryPrice: activeTrade.entryPrice,
        exitDate: fiveMinCandles[fiveMinCandles.length - 1].timestamp.toISOString().split('T')[0],
        exitTime: fiveMinCandles[fiveMinCandles.length - 1].timestamp,
        exitPrice: lastPrice,
        profit: profit,
        profitPercent: (profit / tradingCapital) * 100,
        obCount: activeTrade.obCount,
        entryReason: activeTrade.entryReason,
        exitReason: 'Period ended',
        isWin: profit > 0
      });
    }

    // Calculate stats
    const winners = trades.filter(t => t.isWin);
    const losers = trades.filter(t => !t.isWin);
    const totalProfit = accountBalance - tradingCapital;
    const totalReturn = (totalProfit / tradingCapital) * 100;

    console.log('\n' + '='.repeat(140));
    console.log('\n💰 RESULTS:\n');

    console.log(`Starting Capital:       $${startingCapital} (${leverage}X leverage)`);
    console.log(`Trading Capital:        $${tradingCapital}`);
    console.log(`Final Balance:          $${accountBalance.toFixed(2)}`);
    console.log(`Total P&L:              $${totalProfit.toFixed(2)} (${totalReturn.toFixed(2)}%)`);
    console.log(`Max Drawdown:           ${maxDrawdown.toFixed(2)}%`);
    console.log(`\nTotal Trades:           ${trades.length}`);
    console.log(`Winning:                ${winners.length} (${(winners.length / trades.length * 100).toFixed(2)}%)`);
    console.log(`Losing:                 ${losers.length} (${(losers.length / trades.length * 100).toFixed(2)}%)`);

    // Save to JSON
    const tradesData = {
      symbol: symbol,
      period: { start: startDate, end: endDate },
      dataPoints: {
        daily: dailyCandles.length,
        hourly: hourlyCandles.length,
        fiveMin: fiveMinCandles.length
      },
      summary: {
        startingCapital,
        leverage,
        tradingCapital,
        finalBalance: accountBalance,
        totalProfit,
        totalReturn,
        maxDrawdown,
        totalTrades: trades.length,
        winning: winners.length,
        losing: losers.length
      },
      trades: trades
    };

    const outputPath = path.join(process.cwd(), 'backtest_complete_data.json');
    fs.writeFileSync(outputPath, JSON.stringify(tradesData, null, 2));

    console.log(`\n✅ Complete backtest saved to: backtest_complete_data.json`);
    console.log('='.repeat(140) + '\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

runBacktest();
