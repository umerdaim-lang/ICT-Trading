import prisma from '../utils/db.js';
import { analyzeAllICTConcepts } from './ict.service.js';
import { analyzeMarketDataWithClaude, extractSignalFromAnalysis } from './claude.service.js';

/**
 * Professional ICT Strategy Backtester
 *
 * Rules:
 * 1. D1 Bias = Daily direction (previous close color)
 * 2. H1 Levels = PD arrays aligned with bias only
 * 3. M5 Execution = Orderflow flip confirmation
 * 4. Killzone = Asia/London/NY session only
 * 5. Risk Management = A+/B rating with proper sizing (1-3% / 0.5%)
 * 6. Targets = 2R fixed, 75% at 2R/3R
 */

/**
 * Get daily bias from previous day close
 * @param {array} dailyCandles - Daily candles
 * @param {date} currentDate - Current date to check
 * @returns {string} 'LONG' or 'SHORT'
 */
function getDailyBias(dailyCandles, currentDate) {
  // Find previous day's candle
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

  // Green candle = LONG bias, Red candle = SHORT bias
  return close > open ? 'LONG' : 'SHORT';
}

/**
 * Check if current time is in a killzone
 * @param {date} timestamp - Current timestamp
 * @returns {string|null} 'ASIA'|'LONDON'|'NY'|null
 */
function getKillzone(timestamp) {
  const date = new Date(timestamp);
  const nyHour = date.getUTCHours() + (date.getUTCMinutes() / 60); // Convert UTC to NY time (UTC-5)

  // NY times: 8pm = 1am UTC, 12am = 5am UTC, 2am = 7am UTC, 5am = 10am UTC, 7am = 12pm UTC, 10am = 3pm UTC
  // Killzones in NY time:
  // Asia: 8pm-12am = 1am-5am UTC
  // London: 2am-5am = 7am-10am UTC
  // NY: 7am-10am = 12pm-3pm UTC

  const noonUTC = date.getUTCHours() + (date.getUTCMinutes() / 60);

  // Convert UTC to NY (EST/EDT = UTC-5)
  const nyAdjustedHour = noonUTC - 5;

  if (nyAdjustedHour >= 20 || nyAdjustedHour < 0) {
    // 8pm-12am (wraps to next day)
    return 'ASIA';
  } else if (nyAdjustedHour >= 2 && nyAdjustedHour < 5) {
    // 2am-5am
    return 'LONDON';
  } else if (nyAdjustedHour >= 7 && nyAdjustedHour < 10) {
    // 7am-10am
    return 'NY';
  }

  return null;
}

/**
 * Filter PD arrays by bias (only return aligned arrays)
 * @param {array} orderBlocks - All order blocks
 * @param {array} fvgs - All fair value gaps
 * @param {string} bias - 'LONG' or 'SHORT'
 * @returns {object} { orderBlocks, fvgs }
 */
function filterPDArraysByBias(orderBlocks, fvgs, bias) {
  const filtered = {
    orderBlocks: [],
    fvgs: []
  };

  if (bias === 'LONG') {
    // For LONG bias: only include BULLISH order blocks and FVGs
    filtered.orderBlocks = orderBlocks.filter(ob => ob.type === 'bullish');
    filtered.fvgs = fvgs.filter(f => f.type === 'bullish');
  } else if (bias === 'SHORT') {
    // For SHORT bias: only include BEARISH order blocks and FVGs
    filtered.orderBlocks = orderBlocks.filter(ob => ob.type === 'bearish');
    filtered.fvgs = fvgs.filter(f => f.type === 'bearish');
  }

  return filtered;
}

/**
 * Rate signal quality based on confluence
 * @param {object} signal - Signal from Claude
 * @param {array} validPDArrays - Aligned PD arrays
 * @returns {string} 'A+' | 'A' | 'B' | 'C'
 */
function rateSignalQuality(signal, validPDArrays) {
  if (!signal) return 'C';

  let score = 0;

  // Confluence points
  if (validPDArrays && validPDArrays.length >= 3) score += 3; // Multiple PD arrays
  else if (validPDArrays && validPDArrays.length === 2) score += 2;
  else if (validPDArrays && validPDArrays.length === 1) score += 1;

  // Confidence from Claude
  if (signal.confidence >= 80) score += 2;
  else if (signal.confidence >= 60) score += 1;

  // Risk/reward ratio
  if (signal.riskReward >= 2) score += 2;
  else if (signal.riskReward >= 1.5) score += 1;

  // Final rating
  if (score >= 6) return 'A+';
  else if (score >= 4) return 'A';
  else if (score >= 2) return 'B';
  else return 'C';
}

/**
 * Get position size based on signal quality
 * @param {string} quality - 'A+' | 'A' | 'B' | 'C'
 * @param {number} riskAmount - Amount willing to risk
 * @param {number} riskPerUnit - Risk per unit of position
 * @returns {number} Position size
 */
function getPositionSize(quality, riskAmount, riskPerUnit) {
  let riskPercent = 0;

  if (quality === 'A+') {
    riskPercent = 0.03; // 3% risk for A+ setups
  } else if (quality === 'A') {
    riskPercent = 0.02; // 2% risk for A setups
  } else if (quality === 'B') {
    riskPercent = 0.005; // 0.5% risk for B setups
  } else {
    return 0; // Don't trade C quality or below 0.5%
  }

  return riskAmount * riskPercent / riskPerUnit;
}

/**
 * Run backtesting with ICT Strategy Rules
 */
export async function runStrategyBacktest(symbol, timeframe, startDate, endDate, options = {}) {
  try {
    const { initialCapital = 10000 } = options;

    console.log(`[Strategy Backtest] Running professional ICT strategy for ${symbol} ${timeframe}`);

    // Fetch daily, hourly, and minute candles
    const [dailyCandles, h1Candles, m5Candles] = await Promise.all([
      prisma.marketData.findMany({
        where: { symbol: symbol.toUpperCase(), timeframe: 'D', timestamp: { gte: new Date(startDate), lte: new Date(endDate) } },
        orderBy: { timestamp: 'asc' }
      }),
      prisma.marketData.findMany({
        where: { symbol: symbol.toUpperCase(), timeframe: '1H', timestamp: { gte: new Date(startDate), lte: new Date(endDate) } },
        orderBy: { timestamp: 'asc' }
      }),
      prisma.marketData.findMany({
        where: { symbol: symbol.toUpperCase(), timeframe: '5M', timestamp: { gte: new Date(startDate), lte: new Date(endDate) } },
        orderBy: { timestamp: 'asc' }
      })
    ]);

    if (m5Candles.length === 0) {
      throw new Error(`No market data found for ${symbol} on M5 timeframe`);
    }

    console.log(`[Strategy Backtest] Loaded D1: ${dailyCandles.length}, H1: ${h1Candles.length}, M5: ${m5Candles.length} candles`);

    // Initialize backtesting state
    let accountBalance = initialCapital;
    let equity = initialCapital;
    let trades = [];
    let activeTrade = null;
    let maxDrawdown = 0;
    let peakEquity = initialCapital;
    let ruleViolations = 0;
    let tradeCount = 0;

    // Process M5 candles
    for (let i = 100; i < m5Candles.length; i++) {
      const currentCandle = m5Candles[i];
      const currentPrice = parseFloat(currentCandle.close);
      const candleTime = new Date(currentCandle.timestamp);

      // Check killzone
      const killzone = getKillzone(candleTime);
      if (!killzone) continue; // Skip if not in killzone

      // Get daily bias
      const dailyBias = getDailyBias(dailyCandles, candleTime);
      if (!dailyBias) continue; // Skip if can't determine bias

      // Get lookback data (only historical)
      const lookbackH1 = h1Candles.filter(c => new Date(c.timestamp) <= candleTime);
      const lookbackM5 = m5Candles.slice(Math.max(0, i - 100), i);

      if (lookbackH1.length < 20) continue;

      // Run ICT analysis on H1
      const ictH1 = analyzeAllICTConcepts(lookbackH1);

      // Filter PD arrays by bias
      const filteredPD = filterPDArraysByBias(
        ictH1.orderBlocks || [],
        ictH1.fvgs || [],
        dailyBias
      );

      // Check M5 orderflow (state change)
      const validPDCount = (filteredPD.orderBlocks?.length || 0) + (filteredPD.fvgs?.length || 0);
      if (validPDCount === 0) continue; // No valid PD arrays

      // Generate signal
      let signal = null;
      try {
        const claudeAnalysis = await analyzeMarketDataWithClaude(
          {
            symbol: symbol.toUpperCase(),
            timeframe: '5M',
            currentPrice,
            timestamp: candleTime
          },
          { ...analyzeAllICTConcepts(lookbackM5), validPDArrays: filteredPD }
        );
        signal = extractSignalFromAnalysis(claudeAnalysis);
      } catch (err) {
        console.warn(`[Strategy Backtest] Claude analysis failed: ${err.message}`);
        continue;
      }

      // Check signal alignment with bias
      if (!signal) continue;

      const signalBias = signal.bias === 'BULLISH' || signal.bias === 'bullish' ? 'LONG' : 'SHORT';
      if (signalBias !== dailyBias) {
        ruleViolations++;
        continue; // Skip counter-trend trades
      }

      // Rate signal quality
      const quality = rateSignalQuality(signal, filteredPD);

      // Check position size (don't trade below 0.5%)
      if (quality === 'C') continue;

      // Close existing trade if exists
      if (activeTrade) {
        const tradeProfit = activeTrade.side === 'LONG'
          ? (currentPrice - activeTrade.entryPrice) * activeTrade.quantity
          : (activeTrade.entryPrice - currentPrice) * activeTrade.quantity;

        accountBalance += tradeProfit;
        equity = accountBalance;

        trades.push({
          ...activeTrade,
          exitPrice: currentPrice,
          exitTime: candleTime,
          profit: tradeProfit,
          returnPercent: (tradeProfit / (activeTrade.entryPrice * activeTrade.quantity)) * 100
        });

        activeTrade = null;
      }

      // Enter new trade
      if (signal.signal === 'BUY' && dailyBias === 'LONG') {
        const riskPerUnit = parseFloat(signal.stopLoss) ? Math.abs(currentPrice - parseFloat(signal.stopLoss)) : currentPrice * 0.01;
        const positionSize = getPositionSize(quality, accountBalance, riskPerUnit);

        if (positionSize > 0 && accountBalance >= currentPrice * positionSize) {
          activeTrade = {
            side: 'LONG',
            entryPrice: currentPrice,
            entryTime: candleTime,
            stopLoss: parseFloat(signal.stopLoss) || currentPrice * 0.98,
            takeProfit: parseFloat(signal.takeProfit) || currentPrice * 1.05,
            quantity: positionSize,
            quality,
            killzone,
            dailyBias,
            validPDCount
          };

          accountBalance -= currentPrice * positionSize;
          tradeCount++;
        }
      } else if (signal.signal === 'SELL' && dailyBias === 'SHORT') {
        const riskPerUnit = parseFloat(signal.stopLoss) ? Math.abs(parseFloat(signal.stopLoss) - currentPrice) : currentPrice * 0.01;
        const positionSize = getPositionSize(quality, accountBalance, riskPerUnit);

        if (positionSize > 0 && accountBalance >= currentPrice * positionSize) {
          activeTrade = {
            side: 'SHORT',
            entryPrice: currentPrice,
            entryTime: candleTime,
            stopLoss: parseFloat(signal.stopLoss) || currentPrice * 1.02,
            takeProfit: parseFloat(signal.takeProfit) || currentPrice * 0.95,
            quantity: positionSize,
            quality,
            killzone,
            dailyBias,
            validPDCount
          };

          accountBalance -= currentPrice * positionSize;
          tradeCount++;
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
              returnPercent: (profit / (activeTrade.entryPrice * activeTrade.quantity)) * 100,
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
              returnPercent: (profit / (activeTrade.entryPrice * activeTrade.quantity)) * 100,
              exitReason: 'TAKE_PROFIT'
            });
            activeTrade = null;
          }
        } else if (activeTrade.side === 'SHORT') {
          if (currentPrice >= activeTrade.stopLoss) {
            const profit = (activeTrade.entryPrice - currentPrice) * activeTrade.quantity;
            accountBalance += profit;
            equity = accountBalance;
            trades.push({
              ...activeTrade,
              exitPrice: currentPrice,
              exitTime: candleTime,
              profit,
              returnPercent: (profit / (activeTrade.entryPrice * activeTrade.quantity)) * 100,
              exitReason: 'STOP_LOSS'
            });
            activeTrade = null;
          } else if (currentPrice <= activeTrade.takeProfit) {
            const profit = (activeTrade.entryPrice - currentPrice) * activeTrade.quantity;
            accountBalance += profit;
            equity = accountBalance;
            trades.push({
              ...activeTrade,
              exitPrice: currentPrice,
              exitTime: candleTime,
              profit,
              returnPercent: (profit / (activeTrade.entryPrice * activeTrade.quantity)) * 100,
              exitReason: 'TAKE_PROFIT'
            });
            activeTrade = null;
          } else {
            const unrealizedProfit = (activeTrade.entryPrice - currentPrice) * activeTrade.quantity;
            equity = accountBalance + unrealizedProfit;
          }
        }
      }

      // Track drawdown
      if (equity > peakEquity) peakEquity = equity;
      const drawdown = ((peakEquity - equity) / peakEquity) * 100;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
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
        exitTime: m5Candles[m5Candles.length - 1].timestamp,
        profit,
        exitReason: 'END_OF_PERIOD'
      });
    }

    // Calculate statistics
    const winningTrades = trades.filter(t => t.profit > 0);
    const losingTrades = trades.filter(t => t.profit <= 0);

    return {
      symbol: symbol.toUpperCase(),
      strategy: 'Professional ICT Strategy',
      period: { startDate, endDate },
      summary: {
        initialCapital,
        finalBalance: accountBalance,
        totalProfit: accountBalance - initialCapital,
        totalReturn: ((accountBalance - initialCapital) / initialCapital) * 100,
        maxDrawdown: maxDrawdown.toFixed(2),
        winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0
      },
      trades: {
        total: trades.length,
        winning: winningTrades.length,
        losing: losingTrades.length,
        avgWin: winningTrades.length > 0 ? winningTrades.reduce((sum, t) => sum + t.profit, 0) / winningTrades.length : 0,
        avgLoss: losingTrades.length > 0 ? losingTrades.reduce((sum, t) => sum + t.profit, 0) / losingTrades.length : 0
      },
      qualityBreakdown: {
        aPlus: trades.filter(t => t.quality === 'A+').length,
        a: trades.filter(t => t.quality === 'A').length,
        b: trades.filter(t => t.quality === 'B').length
      },
      ruleCompliance: {
        totalSignalsGenerated: tradeCount,
        ruleViolations,
        complianceRate: ((tradeCount - ruleViolations) / Math.max(tradeCount, 1)) * 100
      },
      trades: trades.slice(-50) // Return last 50 trades
    };
  } catch (error) {
    console.error('[Strategy Backtest] Error:', error.message);
    throw error;
  }
}
