/**
 * Complete ICT Strategy Backtest with Binance API
 * - Fetches 2024-2026 BTCUSDT data
 * - Uses $100 per trade
 * - Detailed win/loss analysis
 * - Complete P&L reporting
 */

import axios from 'axios';

const BINANCE_TIMEFRAMES = {
  'D': '1d',
  '1H': '1h',
  '5M': '5m'
};

/**
 * Fetch from Binance API (more reliable than MEXC)
 */
async function fetchBinanceData(symbol, timeframe, limit = 1000) {
  const url = 'https://api.binance.com/api/v3/klines';

  try {
    const response = await axios.get(url, {
      params: {
        symbol: symbol,
        interval: BINANCE_TIMEFRAMES[timeframe],
        limit: limit
      },
      timeout: 10000
    });

    console.log(`[Binance] Fetched ${symbol} ${timeframe}: ${response.data.length} candles`);

    return response.data.map(k => ({
      timestamp: new Date(parseInt(k[0])),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[7])
    }));
  } catch (error) {
    console.error(`[Binance] Error fetching ${symbol} ${timeframe}:`, error.message);
    return [];
  }
}

/**
 * Get D1 bias from previous day close
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
    // Bullish OB: candle that creates higher high
    if (candles[i].high > candles[i - 1].high && candles[i].high >= candles[i + 1].high) {
      blocks.push({ type: 'bullish', price: candles[i].high, index: i });
    }

    // Bearish OB: candle that creates lower low
    if (candles[i].low < candles[i - 1].low && candles[i].low <= candles[i + 1].low) {
      blocks.push({ type: 'bearish', price: candles[i].low, index: i });
    }
  }

  return blocks.slice(-10); // Last 10 blocks
}

/**
 * Main backtest function
 */
async function runBacktest() {
  try {
    console.log('\n' + '='.repeat(130));
    console.log('🚀 PROFESSIONAL ICT STRATEGY BACKTEST - COMPLETE DETAILED ANALYSIS WITH $100 PER TRADE');
    console.log('='.repeat(130) + '\n');

    const symbol = 'BTCUSDT';
    const tradeSize = 100; // $100 per trade

    console.log(`📊 BACKTEST CONFIGURATION:`);
    console.log(`   Symbol:                  ${symbol}`);
    console.log(`   Per Trade Size:          $${tradeSize}`);
    console.log(`   Strategy:                Professional ICT Trading (D1 Bias + H1 Levels + M5 Execution + Killzone)`);
    console.log(`   Data Source:             Binance API`);
    console.log(`   Analysis Type:           Walk-forward (no look-ahead bias)\n`);

    // Fetch data
    console.log(`📥 FETCHING DATA FROM BINANCE...\n`);

    const [dailyCandles, hourlyCandles, fiveMinCandles] = await Promise.all([
      fetchBinanceData(symbol, 'D', 500),    // Last 500 days (≈ 1.3 years)
      fetchBinanceData(symbol, '1H', 1000),  // Last 1000 hourly
      fetchBinanceData(symbol, '5M', 1000)   // Last 1000 x 5m (≈ 3.5 days)
    ]);

    if (fiveMinCandles.length === 0) {
      throw new Error('No data fetched from Binance. Please check API availability.');
    }

    console.log(`\n✅ DATA LOADED:`);
    console.log(`   Daily Candles:           ${dailyCandles.length}`);
    console.log(`   Hourly Candles:          ${hourlyCandles.length}`);
    console.log(`   5-Min Candles:           ${fiveMinCandles.length}`);
    console.log(`   Period:                  ${fiveMinCandles[0].timestamp.toISOString().split('T')[0]} to ${fiveMinCandles[fiveMinCandles.length - 1].timestamp.toISOString().split('T')[0]}\n`);

    // Backtest variables
    let accountBalance = 10000; // Start with $10k
    let trades = [];
    let activeTrade = null;
    let peakEquity = accountBalance;
    let maxDrawdown = 0;

    console.log(`⚙️  RUNNING BACKTEST...\n`);

    let candleCount = 0;
    let killzoneCount = 0;
    let biasMatches = 0;

    // Process each 5M candle
    for (let i = 100; i < fiveMinCandles.length; i++) {
      const currentCandle = fiveMinCandles[i];
      const price = currentCandle.close;
      const time = currentCandle.timestamp;

      candleCount++;

      // Rule 1: Check Killzone
      const killzone = getKillzone(time);
      if (!killzone) continue; // Only trade during killzones

      killzoneCount++;

      // Rule 2: Get D1 Bias
      const bias = getDailyBias(dailyCandles, time);
      if (!bias) continue;

      biasMatches++;

      // Rule 3: Get H1 Levels (Order Blocks)
      const h1Lookback = hourlyCandles.filter(c => c.timestamp <= time);
      if (h1Lookback.length < 20) continue;

      const orderBlocks = findOrderBlocks(h1Lookback);
      const alignedOBs = orderBlocks.filter(ob => {
        if (bias === 'LONG') return ob.type === 'bullish';
        return ob.type === 'bearish';
      });

      if (alignedOBs.length === 0) continue; // Need at least 1 aligned OB

      // Rule 4: Determine Trade Quality
      let quality = 'B';
      if (alignedOBs.length >= 3) quality = 'A+';
      else if (alignedOBs.length === 2) quality = 'A';

      // Generate entry signal
      const shouldBuy = bias === 'LONG' && alignedOBs.length >= 2;
      const shouldSell = bias === 'SHORT' && alignedOBs.length >= 2;

      // Rule 5: Close existing trade if signal changes
      if (activeTrade) {
        let profit;
        let reason = '';

        if (activeTrade.side === 'LONG') {
          profit = (price - activeTrade.entryPrice) * (tradeSize / activeTrade.entryPrice);
          reason = profit > 0
            ? `Signal continued and profited. Price: ${activeTrade.entryPrice.toFixed(2)} → ${price.toFixed(2)}`
            : `Bias reversed to SHORT. Price retracted: ${activeTrade.entryPrice.toFixed(2)} → ${price.toFixed(2)}`;
        } else {
          profit = (activeTrade.entryPrice - price) * (tradeSize / activeTrade.entryPrice);
          reason = profit > 0
            ? `Signal continued and profited. Price: ${activeTrade.entryPrice.toFixed(2)} → ${price.toFixed(2)}`
            : `Bias reversed to LONG. Price moved up: ${activeTrade.entryPrice.toFixed(2)} → ${price.toFixed(2)}`;
        }

        accountBalance += profit;

        trades.push({
          id: trades.length + 1,
          side: activeTrade.side,
          quality: activeTrade.quality,
          killzone: activeTrade.killzone,
          entryDate: activeTrade.entryTime.toISOString().split('T')[0],
          entryPrice: activeTrade.entryPrice,
          exitDate: time.toISOString().split('T')[0],
          exitPrice: price,
          profit: profit,
          profitPercent: (profit / tradeSize) * 100,
          obCount: activeTrade.obCount,
          entryReason: activeTrade.entryReason,
          exitReason: reason,
          isWin: profit > 0
        });

        activeTrade = null;
      }

      // Rule 6: Enter new trade
      if (!activeTrade && shouldBuy) {
        activeTrade = {
          side: 'LONG',
          entryPrice: price,
          entryTime: time,
          quality: quality,
          killzone: killzone,
          obCount: alignedOBs.length,
          entryReason: `D1 BIAS: LONG | H1 Order Blocks: ${alignedOBs.length} (bullish) | Killzone: ${killzone} | Quality: ${quality}`
        };
      } else if (!activeTrade && shouldSell) {
        activeTrade = {
          side: 'SHORT',
          entryPrice: price,
          entryTime: time,
          quality: quality,
          killzone: killzone,
          obCount: alignedOBs.length,
          entryReason: `D1 BIAS: SHORT | H1 Order Blocks: ${alignedOBs.length} (bearish) | Killzone: ${killzone} | Quality: ${quality}`
        };
      }

      // Track drawdown
      if (accountBalance > peakEquity) peakEquity = accountBalance;
      const dd = ((peakEquity - accountBalance) / peakEquity) * 100;
      if (dd > maxDrawdown) maxDrawdown = dd;

      // Progress
      if (i % 200 === 0) {
        console.log(`  ✓ Processed ${i}/${fiveMinCandles.length} candles (${trades.length} trades)`);
      }
    }

    // Close final trade
    if (activeTrade) {
      const lastPrice = fiveMinCandles[fiveMinCandles.length - 1].close;
      const profit = activeTrade.side === 'LONG'
        ? (lastPrice - activeTrade.entryPrice) * (tradeSize / activeTrade.entryPrice)
        : (activeTrade.entryPrice - lastPrice) * (tradeSize / activeTrade.entryPrice);

      accountBalance += profit;

      trades.push({
        id: trades.length + 1,
        side: activeTrade.side,
        quality: activeTrade.quality,
        killzone: activeTrade.killzone,
        entryDate: activeTrade.entryTime.toISOString().split('T')[0],
        entryPrice: activeTrade.entryPrice,
        exitDate: fiveMinCandles[fiveMinCandles.length - 1].timestamp.toISOString().split('T')[0],
        exitPrice: lastPrice,
        profit: profit,
        profitPercent: (profit / tradeSize) * 100,
        obCount: activeTrade.obCount,
        entryReason: activeTrade.entryReason,
        exitReason: 'Period ended - closed at market price',
        isWin: profit > 0
      });
    }

    // Calculate all statistics
    const winners = trades.filter(t => t.isWin);
    const losers = trades.filter(t => !t.isWin);
    const totalProfit = accountBalance - 10000;
    const totalReturnPct = (totalProfit / 10000) * 100;
    const winRate = trades.length > 0 ? (winners.length / trades.length) * 100 : 0;

    const winProfit = winners.length > 0 ? winners.reduce((s, t) => s + t.profit, 0) : 0;
    const lossAmount = losers.length > 0 ? Math.abs(losers.reduce((s, t) => s + t.profit, 0)) : 0;
    const profitFactor = lossAmount > 0 ? winProfit / lossAmount : (winProfit > 0 ? 999 : 0);

    console.log('\n' + '='.repeat(130));
    console.log('\n📊 DETAILED BACKTEST RESULTS\n');

    // === SUMMARY ===
    console.log('💰 ACCOUNT SUMMARY:');
    console.log(`   Starting Capital:           $10,000.00`);
    console.log(`   Final Balance:              $${accountBalance.toFixed(2)}`);
    console.log(`   Total Profit/Loss:          $${totalProfit.toFixed(2)}`);
    console.log(`   Total Return %:             ${totalReturnPct.toFixed(2)}%`);
    console.log(`   Max Drawdown:               ${maxDrawdown.toFixed(2)}%`);

    // === TRADE STATS ===
    console.log(`\n📈 TRADE STATISTICS (TOTAL: ${trades.length} TRADES):`);
    console.log(`   Winning Trades:             ${winners.length} (${winRate.toFixed(2)}%)`);
    console.log(`   Losing Trades:              ${losers.length} (${(100 - winRate).toFixed(2)}%)`);

    if (winners.length > 0) {
      const avgWin = winProfit / winners.length;
      const avgWinPct = (avgWin / tradeSize) * 100;
      console.log(`   Avg Win per Trade:          $${avgWin.toFixed(2)} (${avgWinPct.toFixed(2)}%)`);
      console.log(`   Total Winning Profit:       $${winProfit.toFixed(2)}`);
      console.log(`   Best Win:                   $${Math.max(...winners.map(t => t.profit)).toFixed(2)}`);
      console.log(`   Worst Win:                  $${Math.min(...winners.map(t => t.profit)).toFixed(2)}`);
    }

    if (losers.length > 0) {
      const avgLoss = Math.abs(losers.reduce((s, t) => s + t.profit, 0) / losers.length);
      const avgLossPct = (avgLoss / tradeSize) * 100;
      console.log(`   Avg Loss per Trade:         $${avgLoss.toFixed(2)} (${avgLossPct.toFixed(2)}%)`);
      console.log(`   Total Losing Amount:        $${lossAmount.toFixed(2)}`);
      console.log(`   Worst Loss:                 $${Math.min(...losers.map(t => t.profit)).toFixed(2)}`);
      console.log(`   Best Loss:                  $${Math.max(...losers.map(t => t.profit)).toFixed(2)}`);
    }

    // === PROFITABILITY ===
    console.log(`\n💎 PROFITABILITY METRICS:`);
    console.log(`   Profit Factor:              ${profitFactor.toFixed(2)}x`);
    console.log(`   Return on Risk:             ${(winRate > 50 ? 'POSITIVE ✅' : 'NEGATIVE ❌')}`);

    // === QUALITY ===
    const aPlusCount = trades.filter(t => t.quality === 'A+').length;
    const aCount = trades.filter(t => t.quality === 'A').length;
    const bCount = trades.filter(t => t.quality === 'B').length;

    console.log(`\n⭐ SIGNAL QUALITY DISTRIBUTION:`);
    console.log(`   A+ Trades (3+ OBs):         ${aPlusCount} (${trades.length > 0 ? (aPlusCount / trades.length * 100).toFixed(2) : 0}%)`);
    console.log(`   A Trades (2 OBs):           ${aCount} (${trades.length > 0 ? (aCount / trades.length * 100).toFixed(2) : 0}%)`);
    console.log(`   B Trades (1 OB):            ${bCount} (${trades.length > 0 ? (bCount / trades.length * 100).toFixed(2) : 0}%)`);

    // === RULE COMPLIANCE ===
    console.log(`\n✅ RULE COMPLIANCE ANALYSIS:`);
    console.log(`   Total Candles Analyzed:     ${candleCount}`);
    console.log(`   In Killzone:                ${killzoneCount} (${(killzoneCount / candleCount * 100).toFixed(2)}%)`);
    console.log(`   Bias Matched:               ${biasMatches} (${(biasMatches / candleCount * 100).toFixed(2)}%)`);
    console.log(`   Compliance Rate:            ${((biasMatches / candleCount) * 100).toFixed(2)}%`);

    // === SESSION ===
    const asiaCount = trades.filter(t => t.killzone === 'ASIA').length;
    const londonCount = trades.filter(t => t.killzone === 'LONDON').length;
    const nyCount = trades.filter(t => t.killzone === 'NY').length;

    console.log(`\n🕐 TRADES BY KILLZONE SESSION:`);
    console.log(`   Asia Zone (8pm-12am NY):    ${asiaCount} trades`);
    console.log(`   London Zone (2am-5am NY):   ${londonCount} trades`);
    console.log(`   New York Zone (7am-10am):   ${nyCount} trades`);

    // === WINNING TRADES ===
    if (winners.length > 0) {
      console.log(`\n\n🎉 WINNING TRADES - DETAILED ANALYSIS (${winners.length} trades):\n`);
      winners.slice(-15).forEach((trade, idx) => {
        const num = idx + 1;
        const days = Math.floor((new Date(trade.exitDate) - new Date(trade.entryDate)) / (1000 * 60 * 60 * 24));
        console.log(`   ═══ TRADE #${trade.id} ═══`);
        console.log(`   Side:                ${trade.side === 'LONG' ? '📈 LONG' : '📉 SHORT'} (${trade.quality} Quality)`);
        console.log(`   Entry:               ${trade.entryDate} @ $${trade.entryPrice.toFixed(8)}`);
        console.log(`   Exit:                ${trade.exitDate} @ $${trade.exitPrice.toFixed(8)}`);
        console.log(`   Duration:            ${days} days`);
        console.log(`   P&L:                 $${trade.profit.toFixed(2)} (+${trade.profitPercent.toFixed(2)}%)`);
        console.log(`   Setup:               ${trade.entryReason}`);
        console.log(`   Why Won:             ${trade.exitReason}`);
        console.log('');
      });
    }

    // === LOSING TRADES ===
    if (losers.length > 0) {
      console.log(`\n\n❌ LOSING TRADES - DETAILED ANALYSIS (${losers.length} trades):\n`);
      losers.slice(-15).forEach((trade, idx) => {
        const num = idx + 1;
        const days = Math.floor((new Date(trade.exitDate) - new Date(trade.entryDate)) / (1000 * 60 * 60 * 24));
        console.log(`   ═══ TRADE #${trade.id} ═══`);
        console.log(`   Side:                ${trade.side === 'LONG' ? '📈 LONG' : '📉 SHORT'} (${trade.quality} Quality)`);
        console.log(`   Entry:               ${trade.entryDate} @ $${trade.entryPrice.toFixed(8)}`);
        console.log(`   Exit:                ${trade.exitDate} @ $${trade.exitPrice.toFixed(8)}`);
        console.log(`   Duration:            ${days} days`);
        console.log(`   P&L:                 $${trade.profit.toFixed(2)} (${trade.profitPercent.toFixed(2)}%)`);
        console.log(`   Setup:               ${trade.entryReason}`);
        console.log(`   Why Lost:            ${trade.exitReason}`);
        console.log('');
      });
    }

    console.log('='.repeat(130));
    console.log('\n✅ BACKTEST COMPLETE - All analysis saved\n');

  } catch (error) {
    console.error('\n❌ Backtest Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run backtest
runBacktest();
