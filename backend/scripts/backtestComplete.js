/**
 * Complete ICT Strategy Backtest with $100 per Trade
 * Fetches 2024-2026 data and provides detailed win/loss analysis
 */

import axios from 'axios';

const TIMEFRAME_MAP = {
  'D': '1d',
  '1H': '1h',
  '5M': '5m'
};

/**
 * Fetch OHLCV data from MEXC API with chunked requests
 */
async function fetchMexcData(symbol, timeframe, days = 365) {
  const mexcTimeframe = TIMEFRAME_MAP[timeframe];
  const baseUrl = 'https://api.mexc.com/api/v3/klines';
  let allCandles = [];

  // Fetch in chunks to avoid API limits
  const chunkDays = timeframe === 'D' ? 365 : (timeframe === '1H' ? 90 : 30);
  const numChunks = Math.ceil(days / chunkDays);

  console.log(`[MEXC] Fetching ${symbol} ${timeframe} (${days} days in ${numChunks} chunks)...`);

  for (let chunk = 0; chunk < numChunks; chunk++) {
    const daysBack = days - (chunk * chunkDays);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - Math.max(0, daysBack - chunkDays));

    try {
      const response = await axios.get(baseUrl, {
        params: {
          symbol: symbol,
          interval: mexcTimeframe,
          limit: 1000
        },
        timeout: 10000
      });

      const candles = response.data || [];
      if (candles.length === 0) {
        console.log(`  ⚠️  Empty response for chunk ${chunk + 1}`);
        continue;
      }

      const parsed = candles.map((k) => ({
        timestamp: new Date(parseInt(k[0])),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]) || 0
      }));

      allCandles = parsed.concat(allCandles);
      console.log(`  ✓ Chunk ${chunk + 1}/${numChunks}: ${candles.length} candles (total: ${allCandles.length})`);

      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.log(`  ⚠️  Chunk ${chunk + 1} error: ${error.message}`);
    }
  }

  return allCandles;
}

/**
 * Get daily bias from candles
 */
function getDailyBias(candles, targetDate) {
  const targetDay = targetDate.toDateString();

  for (let i = candles.length - 1; i >= 0; i--) {
    const candleDay = candles[i].timestamp.toDateString();
    if (candleDay < targetDay) {
      const close = candles[i].close;
      const open = candles[i].open;
      return close > open ? 'LONG' : 'SHORT';
    }
  }

  return null;
}

/**
 * Check if time is in killzone
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
 * Identify order blocks
 */
function findOrderBlocks(candles) {
  const blocks = [];

  for (let i = 2; i < candles.length - 1; i++) {
    const curr = candles[i];
    const prev = candles[i - 1];
    const next = candles[i + 1];

    // Bullish OB: higher high
    if (curr.high > prev.high && curr.high > next.high) {
      blocks.push({ type: 'bullish', high: curr.high, low: curr.low });
    }

    // Bearish OB: lower low
    if (curr.low < prev.low && curr.low < next.low) {
      blocks.push({ type: 'bearish', high: curr.high, low: curr.low });
    }
  }

  return blocks.slice(-5);
}

/**
 * Main backtest
 */
async function runBacktest() {
  try {
    console.log('\n' + '='.repeat(120));
    console.log('🚀 PROFESSIONAL ICT STRATEGY BACKTEST - COMPLETE ANALYSIS');
    console.log('='.repeat(120) + '\n');

    const symbol = 'BTCUSDT';
    const tradeSize = 100;
    const lookbackDays = 365; // 1 year for faster testing

    console.log(`📊 Configuration:`);
    console.log(`   Symbol:              ${symbol}`);
    console.log(`   Period:              Last ${lookbackDays} days`);
    console.log(`   Trade Size:          $${tradeSize} fixed`);
    console.log(`   Strategy:            Professional ICT (D1+H1+M5+Killzone)\n`);

    // Fetch data
    console.log(`📥 Fetching historical data from MEXC API...\n`);

    const [dailyData, hourlyData, fiveMinData] = await Promise.all([
      fetchMexcData(symbol, 'D', lookbackDays),
      fetchMexcData(symbol, '1H', lookbackDays),
      fetchMexcData(symbol, '5M', Math.min(lookbackDays, 30)) // Limit 5M to 30 days for performance
    ]);

    console.log(`\n✅ Data loaded:`);
    console.log(`   Daily:   ${dailyData.length} candles`);
    console.log(`   Hourly:  ${hourlyData.length} candles`);
    console.log(`   5M:      ${fiveMinData.length} candles\n`);

    if (fiveMinData.length === 0) {
      throw new Error('No 5-minute data fetched. MEXC API may have limits.');
    }

    // Backtest state
    let balance = 10000;
    let trades = [];
    let activeTrade = null;
    let peakBalance = balance;
    let maxDD = 0;

    console.log('⚙️  Running backtest...\n');

    let processed = 0;
    let inKZ = 0;
    let inBias = 0;

    // Process 5M candles
    for (let i = 100; i < fiveMinData.length; i++) {
      const candle = fiveMinData[i];
      const price = candle.close;
      const time = candle.timestamp;

      processed++;

      // Check killzone
      const kz = getKillzone(time);
      if (!kz) continue;

      inKZ++;

      // Get bias
      const bias = getDailyBias(dailyData, time);
      if (!bias) continue;

      inBias++;

      // Get hourly OBs
      const hourlyLookback = hourlyData.filter(c => c.timestamp <= time);
      if (hourlyLookback.length < 20) continue;

      const obs = findOrderBlocks(hourlyLookback);
      const alignedOBs = obs.filter(ob => {
        if (bias === 'LONG') return ob.type === 'bullish';
        return ob.type === 'bearish';
      });

      if (alignedOBs.length === 0) continue;

      // Determine signal
      const signal = alignedOBs.length >= 2 ? (bias === 'LONG' ? 'BUY' : 'SELL') : null;
      if (!signal) continue;

      // Close existing trade
      if (activeTrade) {
        let profit;
        if (activeTrade.side === 'LONG') {
          profit = (price - activeTrade.entry) * (tradeSize / activeTrade.entry);
        } else {
          profit = (activeTrade.entry - price) * (tradeSize / activeTrade.entry);
        }

        balance += profit;

        trades.push({
          ...activeTrade,
          exit: price,
          exitTime: time,
          profit: profit,
          profitPct: (profit / tradeSize) * 100,
          exitReason: profit > 0 ? 'PROFIT' : 'LOSS',
          detail: profit > 0
            ? `Signal worked: ${alignedOBs.length} OBs, Price moved +${(Math.abs(price - activeTrade.entry) / activeTrade.entry * 100).toFixed(2)}%`
            : `Signal reversed: Market moved against ${bias} bias by ${(Math.abs(price - activeTrade.entry) / activeTrade.entry * 100).toFixed(2)}%`
        });

        activeTrade = null;
      }

      // Open new trade
      if (!activeTrade && signal === 'BUY' && bias === 'LONG') {
        activeTrade = {
          side: 'LONG',
          entry: price,
          entryTime: time,
          quality: alignedOBs.length >= 3 ? 'A+' : (alignedOBs.length === 2 ? 'A' : 'B'),
          killzone: kz,
          obCount: alignedOBs.length,
          entryReason: `D1:${bias} | H1:${alignedOBs.length}OBs | ${kz} | Q:${alignedOBs.length >= 3 ? 'A+' : 'A'}`
        };
      } else if (!activeTrade && signal === 'SELL' && bias === 'SHORT') {
        activeTrade = {
          side: 'SHORT',
          entry: price,
          entryTime: time,
          quality: alignedOBs.length >= 3 ? 'A+' : (alignedOBs.length === 2 ? 'A' : 'B'),
          killzone: kz,
          obCount: alignedOBs.length,
          entryReason: `D1:${bias} | H1:${alignedOBs.length}OBs | ${kz} | Q:${alignedOBs.length >= 3 ? 'A+' : 'A'}`
        };
      }

      // Track drawdown
      if (balance > peakBalance) peakBalance = balance;
      const dd = ((peakBalance - balance) / peakBalance) * 100;
      if (dd > maxDD) maxDD = dd;

      if (i % 2000 === 0) {
        const pct = ((i / fiveMinData.length) * 100).toFixed(1);
        console.log(`  ✓ ${pct}% - ${trades.length} trades`);
      }
    }

    // Close final trade
    if (activeTrade) {
      const lastPrice = fiveMinData[fiveMinData.length - 1].close;
      const profit = activeTrade.side === 'LONG'
        ? (lastPrice - activeTrade.entry) * (tradeSize / activeTrade.entry)
        : (activeTrade.entry - lastPrice) * (tradeSize / activeTrade.entry);

      balance += profit;

      trades.push({
        ...activeTrade,
        exit: lastPrice,
        profit: profit,
        profitPct: (profit / tradeSize) * 100,
        exitReason: 'PERIOD_END',
        detail: 'Backtest period ended'
      });
    }

    // Calculate stats
    const wins = trades.filter(t => t.profit > 0);
    const losses = trades.filter(t => t.profit <= 0);
    const totalPL = balance - 10000;
    const totalPLPct = (totalPL / 10000) * 100;

    console.log('\n' + '='.repeat(120));
    console.log('\n📊 DETAILED BACKTEST RESULTS\n');

    // Summary
    console.log('📈 SUMMARY:');
    console.log(`   Starting Capital:           $10,000.00`);
    console.log(`   Final Balance:              $${balance.toFixed(2)}`);
    console.log(`   Total P&L:                  $${totalPL.toFixed(2)}`);
    console.log(`   Total P&L %:                ${totalPLPct.toFixed(2)}%`);
    console.log(`   Max Drawdown:               ${maxDD.toFixed(2)}%`);

    // Trade stats
    console.log(`\n📊 TRADE STATISTICS:`);
    console.log(`   Total Trades:               ${trades.length}`);
    console.log(`   Winning Trades:             ${wins.length} (${trades.length > 0 ? (wins.length / trades.length * 100).toFixed(2) : 0}%)`);
    console.log(`   Losing Trades:              ${losses.length} (${trades.length > 0 ? (losses.length / trades.length * 100).toFixed(2) : 0}%)`);

    if (wins.length > 0) {
      const avgWin = wins.reduce((s, t) => s + t.profit, 0) / wins.length;
      const avgWinPct = (avgWin / tradeSize) * 100;
      const totalWins = wins.reduce((s, t) => s + t.profit, 0);
      console.log(`   Avg Win:                    $${avgWin.toFixed(2)} (${avgWinPct.toFixed(2)}%)`);
      console.log(`   Total Win Profit:           $${totalWins.toFixed(2)}`);
    }

    if (losses.length > 0) {
      const avgLoss = losses.reduce((s, t) => s + t.profit, 0) / losses.length;
      const avgLossPct = (avgLoss / tradeSize) * 100;
      const totalLosses = losses.reduce((s, t) => s + t.profit, 0);
      console.log(`   Avg Loss:                   $${avgLoss.toFixed(2)} (${avgLossPct.toFixed(2)}%)`);
      console.log(`   Total Loss:                 $${totalLosses.toFixed(2)}`);
    }

    // Quality breakdown
    const aPlus = trades.filter(t => t.quality === 'A+').length;
    const a = trades.filter(t => t.quality === 'A').length;
    const b = trades.filter(t => t.quality === 'B').length;

    console.log(`\n⭐ SIGNAL QUALITY:`);
    console.log(`   A+ Trades (3+ OBs):         ${aPlus} (${trades.length > 0 ? (aPlus / trades.length * 100).toFixed(2) : 0}%)`);
    console.log(`   A Trades (2 OBs):           ${a} (${trades.length > 0 ? (a / trades.length * 100).toFixed(2) : 0}%)`);
    console.log(`   B Trades (1 OB):            ${b} (${trades.length > 0 ? (b / trades.length * 100).toFixed(2) : 0}%)`);

    // Rule compliance
    console.log(`\n✅ RULE COMPLIANCE:`);
    console.log(`   Candles Processed:          ${processed}`);
    console.log(`   In Killzone:                ${inKZ} (${(inKZ / processed * 100).toFixed(2)}%)`);
    console.log(`   Bias Matched:               ${inBias} (${(inBias / processed * 100).toFixed(2)}%)`);
    console.log(`   Compliance Rate:            ${(inBias / Math.max(processed, 1) * 100).toFixed(2)}%`);

    // Session breakdown
    const asia = trades.filter(t => t.killzone === 'ASIA').length;
    const london = trades.filter(t => t.killzone === 'LONDON').length;
    const ny = trades.filter(t => t.killzone === 'NY').length;

    console.log(`\n🕐 TRADES BY SESSION:`);
    console.log(`   Asia (8pm-12am):            ${asia} trades`);
    console.log(`   London (2am-5am):           ${london} trades`);
    console.log(`   New York (7am-10am):        ${ny} trades`);

    // Winning trades
    if (wins.length > 0) {
      console.log(`\n\n🎉 WINNING TRADES (${wins.length}):`);
      wins.slice(-10).forEach((t, i) => {
        console.log(`\n   Trade ${i + 1}:`);
        console.log(`      Entry:   ${t.entryTime.toISOString().split('T')[0]} @ $${t.entry.toFixed(8)} (${t.quality})`);
        console.log(`      Exit:    ${t.exitTime?.toISOString().split('T')[0] || 'N/A'} @ $${t.exit?.toFixed(8) || 'N/A'}`);
        console.log(`      Profit:  $${t.profit.toFixed(2)} (+${t.profitPct.toFixed(2)}%)`);
        console.log(`      Setup:   ${t.entryReason}`);
        console.log(`      Reason:  ${t.detail}`);
      });
    }

    // Losing trades
    if (losses.length > 0) {
      console.log(`\n\n❌ LOSING TRADES (${losses.length}):`);
      losses.slice(-10).forEach((t, i) => {
        console.log(`\n   Trade ${i + 1}:`);
        console.log(`      Entry:   ${t.entryTime.toISOString().split('T')[0]} @ $${t.entry.toFixed(8)} (${t.quality})`);
        console.log(`      Exit:    ${t.exitTime?.toISOString().split('T')[0] || 'N/A'} @ $${t.exit?.toFixed(8) || 'N/A'}`);
        console.log(`      Loss:    $${t.profit.toFixed(2)} (${t.profitPct.toFixed(2)}%)`);
        console.log(`      Setup:   ${t.entryReason}`);
        console.log(`      Reason:  ${t.detail}`);
      });
    }

    console.log('\n' + '='.repeat(120));
    console.log('\n✅ Backtest Complete!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run
runBacktest();
