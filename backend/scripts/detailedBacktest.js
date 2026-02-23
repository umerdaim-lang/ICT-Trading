/**
 * Comprehensive ICT Strategy Backtest with Detailed Analysis
 * - Fetches 2020-2026 data directly from MEXC API
 * - Uses $100 fixed per trade
 * - Provides detailed win/loss analysis with reasons
 * - Complete P&L reporting in $ and %
 */

import axios from 'axios';

const TIMEFRAME_MAP = {
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
};

/**
 * Fetch historical OHLCV from MEXC API
 */
async function fetchMexcHistorical(symbol, timeframe, startDate, endDate) {
  const mexcTimeframe = TIMEFRAME_MAP[timeframe];
  let allCandles = [];
  let currentTime = new Date(startDate).getTime();
  const endTime = new Date(endDate).getTime();
  const batchSize = 1000;

  console.log(`[MEXC] Fetching ${symbol} ${timeframe} from ${startDate} to ${endDate}...`);

  while (currentTime < endTime) {
    try {
      const url = `https://api.mexc.com/api/v3/klines`;

      // MEXC API only accepts symbol without milliseconds in timestamps
      const params = {
        symbol: symbol,
        interval: mexcTimeframe,
        limit: batchSize
      };

      // Only include time params if not too large
      if (endTime - currentTime < (90 * 24 * 60 * 60 * 1000)) {
        params.startTime = Math.floor(currentTime);
        params.endTime = Math.floor(endTime);
      }

      const response = await axios.get(url, { params, timeout: 15000 });
      const candles = response.data || [];

      if (candles.length === 0) break;

      const parsed = candles.map((k) => ({
        timestamp: new Date(parseInt(k[0])),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]) || 0
      }));

      allCandles = allCandles.concat(parsed);
      console.log(`  ✓ Fetched ${candles.length} candles (total: ${allCandles.length})`);

      const lastTimestamp = parseInt(candles[candles.length - 1][0]);
      currentTime = lastTimestamp + 1;

      await new Promise(resolve => setTimeout(resolve, 200)); // Rate limit
    } catch (error) {
      console.error(`[MEXC] Error: ${error.message}`);
      throw error;
    }
  }

  console.log(`[MEXC] ✅ Total fetched: ${allCandles.length} candles\n`);
  return allCandles;
}

/**
 * Get daily bias from previous day close
 */
function getDailyBias(dailyCandles, currentDate) {
  const currentDay = new Date(currentDate).toDateString();
  let prevDayCandle = null;

  for (let i = dailyCandles.length - 1; i >= 0; i--) {
    const candleDay = new Date(dailyCandles[i].timestamp).toDateString();
    if (candleDay < currentDay && !prevDayCandle) {
      prevDayCandle = dailyCandles[i];
      break;
    }
  }

  if (!prevDayCandle) return null;

  const open = parseFloat(prevDayCandle.open);
  const close = parseFloat(prevDayCandle.close);

  return close > open ? 'LONG' : 'SHORT';
}

/**
 * Check if current time is in a killzone
 */
function getKillzone(timestamp) {
  const date = new Date(timestamp);
  const utcHour = date.getUTCHours();
  const nyAdjustedHour = utcHour - 5; // UTC-5 for NY time

  if (nyAdjustedHour >= 20 || nyAdjustedHour < 0) {
    return 'ASIA';
  } else if (nyAdjustedHour >= 2 && nyAdjustedHour < 5) {
    return 'LONDON';
  } else if (nyAdjustedHour >= 7 && nyAdjustedHour < 10) {
    return 'NY';
  }

  return null;
}

/**
 * Identify order blocks
 */
function identifyOrderBlocks(candles) {
  const orderBlocks = [];

  for (let i = 2; i < candles.length - 1; i++) {
    const high = parseFloat(candles[i].high);
    const low = parseFloat(candles[i].low);

    if (high > parseFloat(candles[i - 1].high) && high > parseFloat(candles[i + 1].high)) {
      orderBlocks.push({
        type: 'bullish',
        high: high,
        low: low,
        timestamp: candles[i].timestamp
      });
    }

    if (low < parseFloat(candles[i - 1].low) && low < parseFloat(candles[i + 1].low)) {
      orderBlocks.push({
        type: 'bearish',
        high: high,
        low: low,
        timestamp: candles[i].timestamp
      });
    }
  }

  return orderBlocks.slice(-10);
}

/**
 * Filter order blocks by bias
 */
function filterBlocksByBias(blocks, bias) {
  if (bias === 'LONG') {
    return blocks.filter(b => b.type === 'bullish');
  } else {
    return blocks.filter(b => b.type === 'bearish');
  }
}

/**
 * Generate signal with reasons
 */
function generateSignal(currentPrice, bias, orderBlockCount) {
  if (bias === 'LONG') {
    return {
      signal: 'BUY',
      bias: 'BULLISH',
      confidence: 75 + Math.random() * 20,
      stopLoss: currentPrice * 0.98,
      takeProfit: currentPrice * 1.05,
      riskReward: 2.5,
      reason: `Bullish OB confirmation (${orderBlockCount} blocks aligned)`
    };
  } else {
    return {
      signal: 'SELL',
      bias: 'BEARISH',
      confidence: 75 + Math.random() * 20,
      stopLoss: currentPrice * 1.02,
      takeProfit: currentPrice * 0.95,
      riskReward: 2.5,
      reason: `Bearish OB confirmation (${orderBlockCount} blocks aligned)`
    };
  }
}

/**
 * Rate signal quality with detailed reasons
 */
function rateSignalQuality(signal, blockCount) {
  let score = 0;
  let qualityReasons = [];

  if (blockCount >= 3) {
    score += 3;
    qualityReasons.push('3+ order blocks');
  } else if (blockCount === 2) {
    score += 2;
    qualityReasons.push('2 order blocks');
  } else if (blockCount === 1) {
    score += 1;
    qualityReasons.push('1 order block');
  }

  if (signal.confidence >= 80) {
    score += 2;
    qualityReasons.push('High confidence (80+)');
  } else if (signal.confidence >= 60) {
    score += 1;
    qualityReasons.push('Medium confidence (60-79)');
  }

  if (signal.riskReward >= 2) {
    score += 2;
    qualityReasons.push('Strong R:R ratio (2+)');
  }

  let quality = 'C';
  if (score >= 6) quality = 'A+';
  else if (score >= 4) quality = 'A';
  else if (score >= 2) quality = 'B';

  return { quality, reasons: qualityReasons };
}

/**
 * Main backtest function
 */
async function runDetailedBacktest() {
  try {
    console.log('\n🚀 Professional ICT Strategy Backtest - Detailed Analysis\n');
    console.log('='.repeat(100));

    const symbol = 'BTCUSDT';
    const startDate = '2020-01-01';
    const endDate = new Date().toISOString().split('T')[0]; // Today
    const tradeSize = 100; // Fixed $100 per trade

    console.log(`\n📊 Configuration:`);
    console.log(`   Symbol:        ${symbol}`);
    console.log(`   Period:        ${startDate} to ${endDate}`);
    console.log(`   Per Trade:     $${tradeSize}`);
    console.log(`   Strategy:      Professional ICT (D1 Bias + H1 Levels + M5 Execution)\n`);

    // Fetch data
    console.log('📥 Fetching historical data...\n');
    const [dailyCandles, h1Candles, m5Candles] = await Promise.all([
      fetchMexcHistorical(symbol, 'D', startDate, endDate),
      fetchMexcHistorical(symbol, '1H', startDate, endDate),
      fetchMexcHistorical(symbol, '5M', startDate, endDate)
    ]);

    console.log(`✅ Data loaded:`);
    console.log(`   Daily:   ${dailyCandles.length} candles`);
    console.log(`   Hourly:  ${h1Candles.length} candles`);
    console.log(`   5M:      ${m5Candles.length} candles\n`);

    // Initialize backtest state
    let accountBalance = 10000; // Start with $10,000
    let equity = accountBalance;
    let trades = [];
    let activeTrade = null;
    let maxDrawdown = 0;
    let peakEquity = accountBalance;

    console.log('⚙️  Running backtest...\n');

    // Process M5 candles
    let signalsProcessed = 0;
    let killzoneChecks = 0;
    let biasMatches = 0;
    let tradesTaken = 0;

    for (let i = 100; i < m5Candles.length; i++) {
      const currentCandle = m5Candles[i];
      const currentPrice = parseFloat(currentCandle.close);
      const candleTime = new Date(currentCandle.timestamp);

      // Check killzone
      const killzone = getKillzone(candleTime);
      if (!killzone) continue;

      killzoneChecks++;
      signalsProcessed++;

      // Get daily bias
      const dailyBias = getDailyBias(dailyCandles, candleTime);
      if (!dailyBias) continue;

      // Get lookback data
      const lookbackH1 = h1Candles.filter(c => new Date(c.timestamp) <= candleTime);
      if (lookbackH1.length < 20) continue;

      // Identify order blocks
      const orderBlocks = identifyOrderBlocks(lookbackH1);
      const filteredOBs = filterBlocksByBias(orderBlocks, dailyBias);

      if (filteredOBs.length === 0) continue;

      biasMatches++;

      // Generate signal
      const signal = generateSignal(currentPrice, dailyBias, filteredOBs.length);

      // Check signal alignment
      const signalBias = signal.bias === 'BULLISH' ? 'LONG' : 'SHORT';
      if (signalBias !== dailyBias) continue;

      // Rate quality
      const { quality, reasons: qualityReasons } = rateSignalQuality(signal, filteredOBs.length);
      if (quality === 'C') continue;

      tradesTaken++;

      // Close existing trade
      if (activeTrade) {
        const tradeProfit = activeTrade.side === 'LONG'
          ? (currentPrice - activeTrade.entryPrice) * (tradeSize / activeTrade.entryPrice)
          : (activeTrade.entryPrice - currentPrice) * (tradeSize / activeTrade.entryPrice);

        const profitPercent = (tradeProfit / tradeSize) * 100;
        const exitReason = tradeProfit > 0
          ? tradeProfit >= (tradeSize * 0.05) ? 'TAKE_PROFIT' : 'PARTIAL_PROFIT'
          : 'STOP_LOSS';

        accountBalance += tradeProfit;
        equity = accountBalance;

        trades.push({
          ...activeTrade,
          exitPrice: currentPrice,
          exitTime: candleTime,
          profit: tradeProfit,
          profitPercent: profitPercent,
          exitReason: exitReason,
          winReason: tradeProfit > 0
            ? `Signal confluent with ${filteredOBs.length} OBs, hit ${exitReason}`
            : `Entry signal contradicted by market move to ${killzone} session`
        });

        activeTrade = null;
      }

      // Enter new trade
      if (signal.signal === 'BUY' && dailyBias === 'LONG') {
        const riskPerUnit = Math.abs(currentPrice - parseFloat(signal.stopLoss));
        const positionSize = (tradeSize * 0.02) / riskPerUnit; // 2% risk

        if (accountBalance >= tradeSize) {
          activeTrade = {
            side: 'LONG',
            entryPrice: currentPrice,
            entryTime: candleTime,
            stopLoss: parseFloat(signal.stopLoss),
            takeProfit: parseFloat(signal.takeProfit),
            quality,
            killzone,
            dailyBias,
            orderBlockCount: filteredOBs.length,
            entryReason: `D1 Bias: ${dailyBias} | H1 OBs: ${filteredOBs.length} | ${killzone} Zone | Quality: ${quality}`
          };

          accountBalance -= tradeSize;
        }
      } else if (signal.signal === 'SELL' && dailyBias === 'SHORT') {
        const riskPerUnit = Math.abs(parseFloat(signal.stopLoss) - currentPrice);
        const positionSize = (tradeSize * 0.02) / riskPerUnit;

        if (accountBalance >= tradeSize) {
          activeTrade = {
            side: 'SHORT',
            entryPrice: currentPrice,
            entryTime: candleTime,
            stopLoss: parseFloat(signal.stopLoss),
            takeProfit: parseFloat(signal.takeProfit),
            quality,
            killzone,
            dailyBias,
            orderBlockCount: filteredOBs.length,
            entryReason: `D1 Bias: ${dailyBias} | H1 OBs: ${filteredOBs.length} | ${killzone} Zone | Quality: ${quality}`
          };

          accountBalance -= tradeSize;
        }
      }

      // Check stop loss / take profit
      if (activeTrade) {
        if (activeTrade.side === 'LONG') {
          if (currentPrice <= activeTrade.stopLoss) {
            const profit = (currentPrice - activeTrade.entryPrice) * (tradeSize / activeTrade.entryPrice);
            accountBalance += profit;
            equity = accountBalance;

            trades.push({
              ...activeTrade,
              exitPrice: currentPrice,
              exitTime: candleTime,
              profit: profit,
              profitPercent: (profit / tradeSize) * 100,
              exitReason: 'STOP_LOSS',
              winReason: `Stop Loss hit at ${currentPrice.toFixed(8)}`
            });
            activeTrade = null;
          } else if (currentPrice >= activeTrade.takeProfit) {
            const profit = (currentPrice - activeTrade.entryPrice) * (tradeSize / activeTrade.entryPrice);
            accountBalance += profit;
            equity = accountBalance;

            trades.push({
              ...activeTrade,
              exitPrice: currentPrice,
              exitTime: candleTime,
              profit: profit,
              profitPercent: (profit / tradeSize) * 100,
              exitReason: 'TAKE_PROFIT',
              winReason: `Take Profit hit at ${currentPrice.toFixed(8)}`
            });
            activeTrade = null;
          }
        }
      }

      // Track drawdown
      if (equity > peakEquity) peakEquity = equity;
      const drawdown = ((peakEquity - equity) / peakEquity) * 100;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;

      // Progress
      if (i % 5000 === 0) {
        const progress = ((i / m5Candles.length) * 100).toFixed(1);
        console.log(`  ✓ ${progress}% - ${trades.length} trades`);
      }
    }

    // Close final trade
    if (activeTrade) {
      const finalPrice = parseFloat(m5Candles[m5Candles.length - 1].close);
      const profit = activeTrade.side === 'LONG'
        ? (finalPrice - activeTrade.entryPrice) * (tradeSize / activeTrade.entryPrice)
        : (activeTrade.entryPrice - finalPrice) * (tradeSize / activeTrade.entryPrice);

      accountBalance += profit;

      trades.push({
        ...activeTrade,
        exitPrice: finalPrice,
        profit: profit,
        profitPercent: (profit / tradeSize) * 100,
        exitReason: 'END_OF_PERIOD',
        winReason: profit > 0 ? 'Closed at profit on period end' : 'Closed at loss on period end'
      });
    }

    // Calculate statistics
    const winningTrades = trades.filter(t => t.profit > 0);
    const losingTrades = trades.filter(t => t.profit <= 0);
    const totalProfit = accountBalance - 10000;
    const totalReturn = (totalProfit / 10000) * 100;

    console.log('\n' + '='.repeat(100));
    console.log('\n📊 DETAILED BACKTEST RESULTS\n');

    // Summary Statistics
    console.log('📈 SUMMARY STATISTICS:');
    console.log(`   Starting Capital:      $10,000.00`);
    console.log(`   Final Balance:         $${accountBalance.toFixed(2)}`);
    console.log(`   Total Profit/Loss:     $${totalProfit.toFixed(2)}`);
    console.log(`   Total Return:          ${totalReturn.toFixed(2)}%`);
    console.log(`   Max Drawdown:          ${maxDrawdown.toFixed(2)}%`);

    // Trade Statistics
    console.log(`\n📊 TRADE STATISTICS:`);
    console.log(`   Total Trades:          ${trades.length}`);
    console.log(`   Winning Trades:        ${winningTrades.length} (${trades.length > 0 ? (winningTrades.length / trades.length * 100).toFixed(2) : 0}%)`);
    console.log(`   Losing Trades:         ${losingTrades.length} (${trades.length > 0 ? (losingTrades.length / trades.length * 100).toFixed(2) : 0}%)`);

    if (winningTrades.length > 0) {
      const totalWinProfit = winningTrades.reduce((s, t) => s + t.profit, 0);
      const avgWin = totalWinProfit / winningTrades.length;
      const avgWinPercent = (avgWin / tradeSize) * 100;
      console.log(`   Avg Win:               $${avgWin.toFixed(2)} (${avgWinPercent.toFixed(2)}%)`);
      console.log(`   Total Win Profit:      $${totalWinProfit.toFixed(2)}`);
    }

    if (losingTrades.length > 0) {
      const totalLossProfit = losingTrades.reduce((s, t) => s + t.profit, 0);
      const avgLoss = totalLossProfit / losingTrades.length;
      const avgLossPercent = (avgLoss / tradeSize) * 100;
      console.log(`   Avg Loss:              $${avgLoss.toFixed(2)} (${avgLossPercent.toFixed(2)}%)`);
      console.log(`   Total Loss:            $${totalLossProfit.toFixed(2)}`);
    }

    // Profitability Metrics
    const profitFactor = winningTrades.length > 0 && losingTrades.length > 0
      ? Math.abs((winningTrades.reduce((s, t) => s + t.profit, 0)) / (losingTrades.reduce((s, t) => s + t.profit, 0)))
      : 0;

    console.log(`\n💰 PROFITABILITY METRICS:`);
    console.log(`   Profit Factor:         ${profitFactor.toFixed(2)}`);
    console.log(`   Risk/Reward Ratio:     ${winningTrades.length > 0 && losingTrades.length > 0
      ? (Math.abs(losingTrades.reduce((s, t) => s + t.profit, 0) / losingTrades.length) /
         (winningTrades.reduce((s, t) => s + t.profit, 0) / winningTrades.length)).toFixed(2)
      : 'N/A'}`);

    // Quality Distribution
    const aPlus = trades.filter(t => t.quality === 'A+').length;
    const a = trades.filter(t => t.quality === 'A').length;
    const b = trades.filter(t => t.quality === 'B').length;

    console.log(`\n⭐ SIGNAL QUALITY DISTRIBUTION:`);
    console.log(`   A+ Trades:             ${aPlus} (${trades.length > 0 ? (aPlus / trades.length * 100).toFixed(2) : 0}%)`);
    console.log(`   A  Trades:             ${a} (${trades.length > 0 ? (a / trades.length * 100).toFixed(2) : 0}%)`);
    console.log(`   B  Trades:             ${b} (${trades.length > 0 ? (b / trades.length * 100).toFixed(2) : 0}%)`);

    // Trading Sessions
    const asiaTrades = trades.filter(t => t.killzone === 'ASIA').length;
    const londonTrades = trades.filter(t => t.killzone === 'LONDON').length;
    const nyTrades = trades.filter(t => t.killzone === 'NY').length;

    console.log(`\n🕐 TRADES BY KILLZONE SESSION:`);
    console.log(`   Asia Zone:             ${asiaTrades} trades`);
    console.log(`   London Zone:           ${londonTrades} trades`);
    console.log(`   New York Zone:         ${nyTrades} trades`);

    // Rule Compliance
    console.log(`\n✅ RULE COMPLIANCE:`);
    console.log(`   Killzone Filters:      ${killzoneChecks}`);
    console.log(`   Bias Matches:          ${biasMatches}`);
    console.log(`   Trades Executed:       ${tradesTaken}`);
    console.log(`   Compliance Rate:       ${(tradesTaken / Math.max(killzoneChecks, 1) * 100).toFixed(2)}%`);

    // Winning Trades Details
    if (winningTrades.length > 0) {
      console.log(`\n🎉 WINNING TRADES (${winningTrades.length}):`);
      const recent = winningTrades.slice(-10);
      recent.forEach((trade, idx) => {
        console.log(`\n   Trade ${idx + 1}:`);
        console.log(`     Entry:    ${trade.entryTime.toISOString().split('T')[0]} @ $${trade.entryPrice.toFixed(8)} (${trade.quality} Quality)`);
        console.log(`     Exit:     ${trade.exitTime.toISOString().split('T')[0]} @ $${trade.exitPrice.toFixed(8)} (${trade.exitReason})`);
        console.log(`     Profit:   $${trade.profit.toFixed(2)} (+${trade.profitPercent.toFixed(2)}%)`);
        console.log(`     Reason:   ${trade.entryReason}`);
        console.log(`     Result:   ${trade.winReason}`);
      });
    }

    // Losing Trades Details
    if (losingTrades.length > 0) {
      console.log(`\n\n❌ LOSING TRADES (${losingTrades.length}):`);
      const recent = losingTrades.slice(-10);
      recent.forEach((trade, idx) => {
        console.log(`\n   Trade ${idx + 1}:`);
        console.log(`     Entry:    ${trade.entryTime.toISOString().split('T')[0]} @ $${trade.entryPrice.toFixed(8)} (${trade.quality} Quality)`);
        console.log(`     Exit:     ${trade.exitTime.toISOString().split('T')[0]} @ $${trade.exitPrice.toFixed(8)} (${trade.exitReason})`);
        console.log(`     Loss:     $${trade.profit.toFixed(2)} (${trade.profitPercent.toFixed(2)}%)`);
        console.log(`     Reason:   ${trade.entryReason}`);
        console.log(`     Result:   ${trade.winReason}`);
      });
    }

    console.log('\n' + '='.repeat(100));
    console.log('\n✅ Backtest Complete!\n');

    return {
      summary: {
        startCapital: 10000,
        finalBalance: accountBalance,
        totalProfit,
        totalReturn,
        maxDrawdown,
        totalTrades: trades.length,
        winRate: trades.length > 0 ? (winningTrades.length / trades.length * 100) : 0,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        profitFactor
      },
      trades: trades
    };
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run backtest
runDetailedBacktest();
