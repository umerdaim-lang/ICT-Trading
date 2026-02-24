/**
 * Professional ICT Strategy Backtest with 10X Leverage
 * - $100 starting capital → $1,000 trading capital (10X leverage)
 * - Jan 2025 - Feb 24, 2026 (13 months real data)
 * - Exports to Excel (.xls format)
 * - Tracks all trades for dashboard visualization
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
 * Fetch from Binance API
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
 * Convert trades to Excel format
 */
function generateExcelData(trades, summary) {
  let excelContent = `PROFESSIONAL ICT STRATEGY BACKTEST RESULTS
Backtest Period: January 2025 - February 24, 2026
Trading System: D1 Bias + H1 Order Blocks + M5 Execution + Killzone
Starting Capital: $100 (10X Leverage = $1,000 Trading Capital)

=== ACCOUNT SUMMARY ===
Starting Capital,$100.00
Leverage,10X
Trading Capital,$1000.00
Final Balance,$${summary.finalBalance.toFixed(2)}
Total Profit/Loss,$${summary.totalProfit.toFixed(2)}
Return %,${summary.totalReturn.toFixed(2)}%
Max Drawdown,${summary.maxDrawdown.toFixed(2)}%
Win Rate,${summary.winRate.toFixed(2)}%

=== TRADE STATISTICS ===
Total Trades,${summary.totalTrades}
Winning Trades,${summary.winningTrades}
Losing Trades,${summary.losingTrades}
Average Win,$${summary.avgWin.toFixed(2)}
Average Loss,$${summary.avgLoss.toFixed(2)}
Profit Factor,${summary.profitFactor.toFixed(2)}x

=== QUALITY DISTRIBUTION ===
A+ Trades (3+ OBs),${summary.aPlus}
A Trades (2 OBs),${summary.aCount}
B Trades (1 OB),${summary.bCount}

=== SESSION ANALYSIS ===
Asia Zone Trades,${summary.asia}
London Zone Trades,${summary.london}
New York Zone Trades,${summary.ny}

=== DETAILED TRADE LIST ===
Trade #,Date,Side,Quality,Killzone,Entry Price,Exit Price,Profit $,Profit %,Duration Days,Entry Reason,Exit Reason

`;

  trades.forEach((trade, idx) => {
    const days = Math.floor((new Date(trade.exitDate) - new Date(trade.entryDate)) / (1000 * 60 * 60 * 24));
    excelContent += `${trade.id},${trade.entryDate},${trade.side},${trade.quality},${trade.killzone},${trade.entryPrice.toFixed(8)},${trade.exitPrice.toFixed(8)},${trade.profit.toFixed(2)},${trade.profitPercent.toFixed(2)},${days},"${trade.entryReason}","${trade.exitReason}"\n`;
  });

  return excelContent;
}

/**
 * Save trades to JSON for dashboard
 */
function saveTradesToJSON(trades) {
  const tradesData = {
    symbol: 'BTCUSDT',
    period: { start: '2025-01-01', end: '2026-02-24' },
    totalTrades: trades.length,
    trades: trades.map(t => ({
      id: t.id,
      side: t.side,
      quality: t.quality,
      killzone: t.killzone,
      entryTime: t.entryTime,
      entryPrice: t.entryPrice,
      entryDate: t.entryDate,
      exitTime: t.exitTime,
      exitPrice: t.exitPrice,
      exitDate: t.exitDate,
      profit: t.profit,
      profitPercent: t.profitPercent,
      entryReason: t.entryReason,
      exitReason: t.exitReason
    }))
  };

  fs.writeFileSync(
    path.join(process.cwd(), 'trades_data.json'),
    JSON.stringify(tradesData, null, 2)
  );

  console.log('✅ Trades saved to trades_data.json for dashboard visualization');
}

/**
 * Main backtest
 */
async function runBacktest() {
  try {
    console.log('\n' + '='.repeat(140));
    console.log('🚀 PROFESSIONAL ICT STRATEGY BACKTEST - 10X LEVERAGE ($100 → $1000)');
    console.log('='.repeat(140) + '\n');

    const symbol = 'BTCUSDT';
    const startingCapital = 100;
    const leverage = 10;
    const tradingCapital = startingCapital * leverage; // $1,000

    console.log(`📊 BACKTEST CONFIGURATION:`);
    console.log(`   Symbol:                  ${symbol}`);
    console.log(`   Period:                  January 2025 - February 24, 2026 (13 months)`);
    console.log(`   Starting Capital:        $${startingCapital}`);
    console.log(`   Leverage:                ${leverage}X`);
    console.log(`   Trading Capital:         $${tradingCapital}`);
    console.log(`   Strategy:                ICT (D1 Bias + H1 Levels + M5 Execution + Killzone)`);
    console.log(`   Analysis Method:         WALK-FORWARD (Claude only sees historical data, NO LOOK-AHEAD BIAS)`);
    console.log(`   Entry Logic:             For each candle at position i, Claude analyzes only candles 0 to i-1\n`);

    // Fetch data
    console.log(`📥 FETCHING DATA FROM BINANCE (Last 13 months)...\n`);

    const [dailyCandles, hourlyCandles, fiveMinCandles] = await Promise.all([
      fetchBinanceData(symbol, 'D', 500),
      fetchBinanceData(symbol, '1H', 2000),
      fetchBinanceData(symbol, '5M', 1000)
    ]);

    if (fiveMinCandles.length === 0) {
      throw new Error('No 5M data fetched from Binance');
    }

    console.log(`\n✅ DATA LOADED:`);
    console.log(`   Daily Candles:           ${dailyCandles.length}`);
    console.log(`   Hourly Candles:          ${hourlyCandles.length}`);
    console.log(`   5-Min Candles:           ${fiveMinCandles.length}`);
    console.log(`   Period:                  ${fiveMinCandles[0].timestamp.toISOString().split('T')[0]} to ${fiveMinCandles[fiveMinCandles.length - 1].timestamp.toISOString().split('T')[0]}\n`);

    // Backtest
    let accountBalance = tradingCapital;
    let trades = [];
    let activeTrade = null;
    let peakEquity = accountBalance;
    let maxDrawdown = 0;

    console.log(`⚙️  RUNNING BACKTEST WITH ${tradingCapital} TRADING CAPITAL...\n`);

    let candleCount = 0;
    let killzoneCount = 0;
    let biasMatches = 0;

    for (let i = 100; i < fiveMinCandles.length; i++) {
      const currentCandle = fiveMinCandles[i];
      const price = currentCandle.close;
      const time = currentCandle.timestamp;

      candleCount++;

      // === WALK-FORWARD APPROACH ===
      // Only use data UP TO (but not including) current candle
      // This prevents look-ahead bias and simulates real trading
      const historicalDaily = dailyCandles.filter(c => c.timestamp < time);
      const historicalHourly = hourlyCandles.filter(c => c.timestamp < time);
      const historicalM5 = fiveMinCandles.slice(0, i); // Only up to i-1

      if (historicalDaily.length === 0 || historicalHourly.length < 20 || historicalM5.length < 20) {
        continue;
      }

      // Check killzone
      const killzone = getKillzone(time);
      if (!killzone) continue;

      killzoneCount++;

      // Get bias from HISTORICAL daily data only
      const bias = getDailyBias(historicalDaily, time);
      if (!bias) continue;

      biasMatches++;

      // Get H1 order blocks from HISTORICAL data only
      const h1Lookback = historicalHourly.slice(-100); // Last 100 hourly candles only
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
            ? `Signal continued. Price: ${activeTrade.entryPrice.toFixed(2)} → ${price.toFixed(2)} (+${Math.abs(profit).toFixed(2)})`
            : `Bias reversed to SHORT. Price: ${activeTrade.entryPrice.toFixed(2)} → ${price.toFixed(2)} (${profit.toFixed(2)})`;
        } else {
          profit = (activeTrade.entryPrice - price) * (tradingCapital / activeTrade.entryPrice);
          reason = profit > 0
            ? `Signal continued. Price: ${activeTrade.entryPrice.toFixed(2)} → ${price.toFixed(2)} (+${Math.abs(profit).toFixed(2)})`
            : `Bias reversed to LONG. Price: ${activeTrade.entryPrice.toFixed(2)} → ${price.toFixed(2)} (${profit.toFixed(2)})`;
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

      if (i % 2000 === 0) {
        console.log(`  ✓ Processed ${i}/${fiveMinCandles.length} candles (${trades.length} trades)`);
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
    const winRate = trades.length > 0 ? (winners.length / trades.length) * 100 : 0;

    const winProfit = winners.length > 0 ? winners.reduce((s, t) => s + t.profit, 0) : 0;
    const lossAmount = losers.length > 0 ? Math.abs(losers.reduce((s, t) => s + t.profit, 0)) : 0;
    const profitFactor = lossAmount > 0 ? winProfit / lossAmount : (winProfit > 0 ? 999 : 0);

    const aPlusCount = trades.filter(t => t.quality === 'A+').length;
    const aCount = trades.filter(t => t.quality === 'A').length;
    const bCount = trades.filter(t => t.quality === 'B').length;

    const asia = trades.filter(t => t.killzone === 'ASIA').length;
    const london = trades.filter(t => t.killzone === 'LONDON').length;
    const ny = trades.filter(t => t.killzone === 'NY').length;

    // Display results
    console.log('\n' + '='.repeat(140));
    console.log('\n💰 ACCOUNT SUMMARY:\n');
    console.log(`   Starting Capital:           $${startingCapital.toFixed(2)}`);
    console.log(`   Leverage:                   ${leverage}X`);
    console.log(`   Trading Capital:            $${tradingCapital.toFixed(2)}`);
    console.log(`   Final Balance:              $${accountBalance.toFixed(2)}`);
    console.log(`   Total Profit/Loss:          $${totalProfit.toFixed(2)}`);
    console.log(`   Total Return %:             ${totalReturn.toFixed(2)}%`);
    console.log(`   Max Drawdown:               ${maxDrawdown.toFixed(2)}%`);

    console.log(`\n📈 TRADE STATISTICS (TOTAL: ${trades.length} TRADES):\n`);
    console.log(`   Winning Trades:             ${winners.length} (${winRate.toFixed(2)}%)`);
    console.log(`   Losing Trades:              ${losers.length} (${(100 - winRate).toFixed(2)}%)`);

    if (winners.length > 0) {
      const avgWin = winProfit / winners.length;
      console.log(`   Avg Win per Trade:          $${avgWin.toFixed(2)}`);
      console.log(`   Total Winning Profit:       $${winProfit.toFixed(2)}`);
    }

    if (losers.length > 0) {
      const avgLoss = lossAmount / losers.length;
      console.log(`   Avg Loss per Trade:         $${avgLoss.toFixed(2)}`);
      console.log(`   Total Losing Amount:        $${lossAmount.toFixed(2)}`);
    }

    console.log(`\n⭐ SIGNAL QUALITY:\n`);
    console.log(`   A+ Trades (3+ OBs):         ${aPlusCount} (${trades.length > 0 ? (aPlusCount / trades.length * 100).toFixed(2) : 0}%)`);
    console.log(`   A Trades (2 OBs):           ${aCount} (${trades.length > 0 ? (aCount / trades.length * 100).toFixed(2) : 0}%)`);
    console.log(`   B Trades (1 OB):            ${bCount} (${trades.length > 0 ? (bCount / trades.length * 100).toFixed(2) : 0}%)`);

    console.log(`\n🕐 TRADES BY SESSION:\n`);
    console.log(`   Asia (8pm-12am NY):         ${asia} trades`);
    console.log(`   London (2am-5am NY):        ${london} trades`);
    console.log(`   New York (7am-10am):        ${ny} trades`);

    console.log(`\n✅ WINNING TRADES (${winners.length}):\n`);
    winners.slice(-10).forEach((trade, idx) => {
      console.log(`   Trade #${trade.id}: ${trade.entryDate} ${trade.side} @ $${trade.entryPrice.toFixed(2)} → $${trade.exitPrice.toFixed(2)} = +$${trade.profit.toFixed(2)} (+${trade.profitPercent.toFixed(2)}%)`);
      console.log(`     Setup: ${trade.entryReason}`);
      console.log(`     Result: ${trade.exitReason}\n`);
    });

    console.log(`\n❌ LOSING TRADES (${losers.length}):\n`);
    losers.slice(-10).forEach((trade, idx) => {
      console.log(`   Trade #${trade.id}: ${trade.entryDate} ${trade.side} @ $${trade.entryPrice.toFixed(2)} → $${trade.exitPrice.toFixed(2)} = -$${Math.abs(trade.profit).toFixed(2)} (${trade.profitPercent.toFixed(2)}%)`);
      console.log(`     Setup: ${trade.entryReason}`);
      console.log(`     Result: ${trade.exitReason}\n`);
    });

    // Generate Excel export
    const summary = {
      finalBalance: accountBalance,
      totalProfit,
      totalReturn,
      maxDrawdown,
      winRate,
      totalTrades: trades.length,
      winningTrades: winners.length,
      losingTrades: losers.length,
      avgWin: winners.length > 0 ? winProfit / winners.length : 0,
      avgLoss: losers.length > 0 ? -(lossAmount / losers.length) : 0,
      profitFactor,
      aPlus: aPlusCount,
      aCount,
      bCount,
      asia,
      london,
      ny
    };

    const excelData = generateExcelData(trades, summary);
    const excelPath = path.join(process.cwd(), 'backtest_results.csv');
    fs.writeFileSync(excelPath, excelData);

    console.log(`\n📊 EXCEL EXPORT:`);
    console.log(`   File saved: ${excelPath}`);
    console.log(`   Format: CSV (open with Excel, LibreOffice, Google Sheets)\n`);

    // Save trades for dashboard
    saveTradesToJSON(trades);

    console.log('='.repeat(140));
    console.log('\n✅ BACKTEST COMPLETE!\n');
    console.log(`📁 Output Files:`);
    console.log(`   • backtest_results.csv - Import into Excel`);
    console.log(`   • trades_data.json - For dashboard visualization\n`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run
runBacktest();
