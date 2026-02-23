/**
 * Standalone ICT Strategy Backtest Demo
 * This demonstrates the professional ICT strategy without requiring database setup
 * Uses realistic OHLCV data for BTCUSDT from 2024
 */

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
  const noonUTC = utcHour + (date.getUTCMinutes() / 60);
  const nyAdjustedHour = noonUTC - 5;

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
 * Identify order blocks (bullish and bearish)
 */
function identifyOrderBlocks(candles) {
  const orderBlocks = [];

  for (let i = 2; i < candles.length - 1; i++) {
    const prev = parseFloat(candles[i - 1].close);
    const curr = parseFloat(candles[i].close);
    const next = parseFloat(candles[i + 1].close);
    const high = parseFloat(candles[i].high);
    const low = parseFloat(candles[i].low);

    // Bullish order block: higher high than previous and next candles
    if (high > parseFloat(candles[i - 1].high) && high > parseFloat(candles[i + 1].high)) {
      orderBlocks.push({
        type: 'bullish',
        high: high,
        low: low,
        timestamp: candles[i].timestamp
      });
    }

    // Bearish order block: lower low than previous and next candles
    if (low < parseFloat(candles[i - 1].low) && low < parseFloat(candles[i + 1].low)) {
      orderBlocks.push({
        type: 'bearish',
        high: high,
        low: low,
        timestamp: candles[i].timestamp
      });
    }
  }

  return orderBlocks.slice(-10); // Return last 10
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
 * Simple mock signal generator
 */
function generateMockSignal(currentPrice, bias) {
  if (bias === 'LONG') {
    return {
      signal: 'BUY',
      bias: 'BULLISH',
      confidence: 75 + Math.random() * 20,
      stopLoss: currentPrice * 0.98,
      takeProfit: currentPrice * 1.05,
      riskReward: 2.5
    };
  } else {
    return {
      signal: 'SELL',
      bias: 'BEARISH',
      confidence: 75 + Math.random() * 20,
      stopLoss: currentPrice * 1.02,
      takeProfit: currentPrice * 0.95,
      riskReward: 2.5
    };
  }
}

/**
 * Rate signal quality
 */
function rateSignalQuality(signal, validBlockCount) {
  let score = 0;

  if (validBlockCount >= 3) score += 3;
  else if (validBlockCount === 2) score += 2;
  else if (validBlockCount === 1) score += 1;

  if (signal.confidence >= 80) score += 2;
  else if (signal.confidence >= 60) score += 1;

  if (signal.riskReward >= 2) score += 2;

  if (score >= 6) return 'A+';
  else if (score >= 4) return 'A';
  else if (score >= 2) return 'B';
  else return 'C';
}

/**
 * Get position size based on quality
 */
function getPositionSize(quality, accountBalance, riskPerUnit) {
  let riskPercent = 0;

  if (quality === 'A+') riskPercent = 0.03;
  else if (quality === 'A') riskPercent = 0.02;
  else if (quality === 'B') riskPercent = 0.005;
  else return 0;

  return (accountBalance * riskPercent) / riskPerUnit;
}

/**
 * Generate realistic OHLCV data for demo
 */
function generateMockCandles(startPrice, numCandles, timeframeMinutes = 1440) {
  const candles = [];
  let currentPrice = startPrice;
  const baseTime = new Date('2024-01-01');

  for (let i = 0; i < numCandles; i++) {
    const timestamp = new Date(baseTime.getTime() + i * timeframeMinutes * 60 * 1000);

    // Random walk for price
    const change = (Math.random() - 0.5) * (currentPrice * 0.02);
    const newPrice = currentPrice + change;

    const open = currentPrice;
    const close = newPrice;
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    const volume = Math.random() * 1000000;

    candles.push({
      timestamp,
      open: open.toFixed(8),
      high: high.toFixed(8),
      low: low.toFixed(8),
      close: close.toFixed(8),
      volume: volume.toFixed(2)
    });

    currentPrice = close;
  }

  return candles;
}

/**
 * Run the professional ICT strategy backtest (demo)
 */
async function runStrategyBacktestDemo() {
  console.log('\n🚀 Professional ICT Strategy Backtest Demo\n');
  console.log('='.repeat(80));

  // Generate mock data (smaller dataset for faster demo)
  const initialPrice = 45000;
  const numDays = 90; // 90 days instead of 365 for faster demo
  const numHours = numDays * 24;
  const numMinutes = numDays * 24 * 12; // 12 x 5M per hour

  console.log('\n📊 Generating mock OHLCV data...');
  console.log(`  • Daily candles: ${numDays}`);
  console.log(`  • Hourly candles: ${numHours}`);
  console.log(`  • 5-minute candles: ${numMinutes}`);

  const dailyCandles = generateMockCandles(initialPrice, numDays, 1440);
  const h1Candles = generateMockCandles(initialPrice, numHours, 60);
  const m5Candles = generateMockCandles(initialPrice, numMinutes, 5);

  console.log(`\n✅ Generated ${numMinutes} 5M candles for backtesting\n`);

  // Backtest parameters
  const initialCapital = 10000;
  let accountBalance = initialCapital;
  let equity = initialCapital;
  let trades = [];
  let activeTrade = null;
  let maxDrawdown = 0;
  let peakEquity = initialCapital;
  let ruleViolations = 0;
  let tradeCount = 0;

  // Process M5 candles
  console.log('⚙️  Running backtest (processing 5M candles)...\n');

  let signalsProcessed = 0;
  let tradesExecuted = 0;

  for (let i = 100; i < m5Candles.length; i++) {
    const currentCandle = m5Candles[i];
    const currentPrice = parseFloat(currentCandle.close);
    const candleTime = new Date(currentCandle.timestamp);

    // Check killzone
    const killzone = getKillzone(candleTime);
    if (!killzone) continue;

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

    // Generate signal
    const signal = generateMockSignal(currentPrice, dailyBias);

    // Check signal alignment
    const signalBias = signal.bias === 'BULLISH' ? 'LONG' : 'SHORT';
    if (signalBias !== dailyBias) {
      ruleViolations++;
      continue;
    }

    // Rate quality
    const quality = rateSignalQuality(signal, filteredOBs.length);
    if (quality === 'C') continue;

    tradeCount++;

    // Close existing trade
    if (activeTrade) {
      const tradeProfit = activeTrade.side === 'LONG'
        ? (currentPrice - activeTrade.entryPrice) * activeTrade.quantity
        : (activeTrade.entryPrice - currentPrice) * activeTrade.quantity;

      accountBalance += tradeProfit;
      equity = accountBalance;

      trades.push({
        side: activeTrade.side,
        quality: activeTrade.quality,
        entryPrice: activeTrade.entryPrice,
        exitPrice: currentPrice,
        exitTime: candleTime,
        profit: tradeProfit,
        returnPercent: (tradeProfit / (activeTrade.entryPrice * activeTrade.quantity)) * 100
      });

      activeTrade = null;
    }

    // Enter new trade
    if (signal.signal === 'BUY' && dailyBias === 'LONG') {
      const riskPerUnit = Math.abs(currentPrice - parseFloat(signal.stopLoss));
      const positionSize = getPositionSize(quality, accountBalance, riskPerUnit);

      if (positionSize > 0 && accountBalance >= currentPrice * positionSize) {
        activeTrade = {
          side: 'LONG',
          entryPrice: currentPrice,
          entryTime: candleTime,
          stopLoss: parseFloat(signal.stopLoss),
          takeProfit: parseFloat(signal.takeProfit),
          quantity: positionSize,
          quality,
          killzone,
          dailyBias
        };

        accountBalance -= currentPrice * positionSize;
        tradesExecuted++;
      }
    } else if (signal.signal === 'SELL' && dailyBias === 'SHORT') {
      const riskPerUnit = Math.abs(parseFloat(signal.stopLoss) - currentPrice);
      const positionSize = getPositionSize(quality, accountBalance, riskPerUnit);

      if (positionSize > 0 && accountBalance >= currentPrice * positionSize) {
        activeTrade = {
          side: 'SHORT',
          entryPrice: currentPrice,
          entryTime: candleTime,
          stopLoss: parseFloat(signal.stopLoss),
          takeProfit: parseFloat(signal.takeProfit),
          quantity: positionSize,
          quality,
          killzone,
          dailyBias
        };

        accountBalance -= currentPrice * positionSize;
        tradesExecuted++;
      }
    }

    // Check stop loss / take profit
    if (activeTrade) {
      if (activeTrade.side === 'LONG') {
        if (currentPrice <= activeTrade.stopLoss) {
          const profit = (currentPrice - activeTrade.entryPrice) * activeTrade.quantity;
          accountBalance += profit;
          equity = accountBalance;
          trades.push({
            ...activeTrade,
            exitPrice: currentPrice,
            exitTime: candleTime,
            profit,
            exitReason: 'STOP_LOSS'
          });
          activeTrade = null;
        } else if (currentPrice >= activeTrade.takeProfit) {
          const profit = (currentPrice - activeTrade.entryPrice) * activeTrade.quantity;
          accountBalance += profit;
          equity = accountBalance;
          trades.push({
            ...activeTrade,
            exitPrice: currentPrice,
            exitTime: candleTime,
            profit,
            exitReason: 'TAKE_PROFIT'
          });
          activeTrade = null;
        } else {
          const unrealizedProfit = (currentPrice - activeTrade.entryPrice) * activeTrade.quantity;
          equity = accountBalance + unrealizedProfit;
        }
      }
    }

    // Track drawdown
    if (equity > peakEquity) peakEquity = equity;
    const drawdown = ((peakEquity - equity) / peakEquity) * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;

    // Progress
    if (i % 1000 === 0) {
      console.log(`  ✓ Processed ${i}/${m5Candles.length} candles (${trades.length} trades)`);
    }
  }

  // Close final trade
  if (activeTrade) {
    const finalPrice = parseFloat(m5Candles[m5Candles.length - 1].close);
    const profit = activeTrade.side === 'LONG'
      ? (finalPrice - activeTrade.entryPrice) * activeTrade.quantity
      : (activeTrade.entryPrice - finalPrice) * activeTrade.quantity;

    accountBalance += profit;
    trades.push({
      ...activeTrade,
      exitPrice: finalPrice,
      profit,
      exitReason: 'END_OF_PERIOD'
    });
  }

  // Calculate statistics
  const winningTrades = trades.filter(t => t.profit > 0);
  const losingTrades = trades.filter(t => t.profit <= 0);
  const totalProfit = accountBalance - initialCapital;
  const totalReturn = (totalProfit / initialCapital) * 100;

  // Display results
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 BACKTEST RESULTS (Professional ICT Strategy - Demo)\n');

  console.log('📈 SUMMARY STATISTICS:');
  console.log(`  Initial Capital:    $${initialCapital.toFixed(2)}`);
  console.log(`  Final Balance:      $${accountBalance.toFixed(2)}`);
  console.log(`  Total Profit/Loss:  $${totalProfit.toFixed(2)}`);
  console.log(`  Total Return:       ${totalReturn.toFixed(2)}%`);
  console.log(`  Max Drawdown:       ${maxDrawdown.toFixed(2)}%`);
  console.log(`  Win Rate:           ${trades.length > 0 ? (winningTrades.length / trades.length * 100).toFixed(2) : 0}%`);

  console.log(`\n📊 TRADES BREAKDOWN:`);
  console.log(`  Total Trades:       ${trades.length}`);
  console.log(`  Winning Trades:     ${winningTrades.length}`);
  console.log(`  Losing Trades:      ${losingTrades.length}`);
  const avgWin = winningTrades.length > 0 ? winningTrades.reduce((s, t) => s + t.profit, 0) / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? losingTrades.reduce((s, t) => s + t.profit, 0) / losingTrades.length : 0;
  console.log(`  Avg Win:            $${avgWin.toFixed(2)}`);
  console.log(`  Avg Loss:           $${avgLoss.toFixed(2)}`);

  const aPlus = trades.filter(t => t.quality === 'A+').length;
  const a = trades.filter(t => t.quality === 'A').length;
  const b = trades.filter(t => t.quality === 'B').length;
  console.log(`\n⭐ SIGNAL QUALITY BREAKDOWN:`);
  console.log(`  A+ Trades:          ${aPlus}`);
  console.log(`  A  Trades:          ${a}`);
  console.log(`  B  Trades:          ${b}`);

  console.log(`\n✅ RULE COMPLIANCE:`);
  console.log(`  Signals Processed:  ${signalsProcessed}`);
  console.log(`  Signals Generated:  ${tradeCount}`);
  console.log(`  Rule Violations:    ${ruleViolations}`);
  console.log(`  Compliance Rate:    ${((tradeCount / Math.max(signalsProcessed, 1)) * 100).toFixed(2)}%`);

  if (trades.length > 0) {
    console.log(`\n📋 RECENT TRADES (Last 5):`);
    const recent = trades.slice(-5);
    recent.forEach((trade, idx) => {
      console.log(`\n  Trade ${idx + 1}:`);
      console.log(`    Side:           ${trade.side}`);
      console.log(`    Quality:        ${trade.quality}`);
      console.log(`    Entry:          $${trade.entryPrice.toFixed(8)}`);
      console.log(`    Exit:           $${trade.exitPrice?.toFixed(8) || 'N/A'}`);
      console.log(`    Profit/Loss:    $${trade.profit?.toFixed(2) || 'N/A'}`);
      console.log(`    Return:         ${trade.returnPercent?.toFixed(2) || 'N/A'}%`);
      console.log(`    Reason:         ${trade.exitReason || 'N/A'}`);
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n✅ Backtest complete! This demo uses synthetic data.');
  console.log('\n📝 To run with real data:');
  console.log('   1. Set up database (PostgreSQL with Supabase or local)');
  console.log('   2. Configure DATABASE_URL in .env');
  console.log('   3. Run: npm run prisma:migrate');
  console.log('   4. Run: node scripts/fetchHistoricalData.js');
  console.log('   5. Run: node scripts/runBacktest.js\n');
}

// Run demo
runStrategyBacktestDemo().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
