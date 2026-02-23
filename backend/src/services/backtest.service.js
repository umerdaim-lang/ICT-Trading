import prisma from '../utils/db.js';
import { analyzeAllICTConcepts } from './ict.service.js';
import { analyzeMarketDataWithClaude, extractSignalFromAnalysis } from './claude.service.js';

/**
 * Run backtesting on historical market data using WALK-FORWARD ANALYSIS
 *
 * IMPORTANT: This implements proper walk-forward testing to avoid look-ahead bias.
 * For each candle at index i, Claude only analyzes data from candles 0 to i-1
 * (historical data). It NEVER sees future candles (i+1 onwards).
 * This ensures realistic backtest results that match real trading conditions.
 *
 * @param {string} symbol - Trading symbol (e.g., 'BTCUSDT')
 * @param {string} timeframe - Timeframe (e.g., '1H', '4H', 'D')
 * @param {string} startDate - Start date (ISO format)
 * @param {string} endDate - End date (ISO format)
 * @param {object} options - Backtesting options
 *   - initialCapital: Starting capital (default: 10000)
 *   - riskPerTrade: Risk per trade in % (default: 2)
 *   - slippage: Slippage in % (default: 0.1)
 * @returns {Promise<object>} Backtest results with statistics
 */
export async function runBacktest(symbol, timeframe, startDate, endDate, options = {}) {
  try {
    const {
      initialCapital = 10000,
      riskPerTrade = 2,
      slippage = 0.1
    } = options;

    // Fetch all historical data for the period
    console.log(`[Backtest] Fetching ${symbol} ${timeframe} data from ${startDate} to ${endDate}`);

    const candles = await prisma.marketData.findMany({
      where: {
        symbol: symbol.toUpperCase(),
        timeframe: timeframe.toUpperCase(),
        timestamp: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      },
      orderBy: {
        timestamp: 'asc'
      }
    });

    if (candles.length === 0) {
      throw new Error(`No market data found for ${symbol} ${timeframe} in period ${startDate} to ${endDate}`);
    }

    console.log(`[Backtest] ✅ Loaded ${candles.length} candles`);

    // Initialize backtesting state
    let accountBalance = initialCapital;
    let equity = initialCapital;
    let trades = [];
    let equityCurve = [{ timestamp: candles[0].timestamp, equity, balance: accountBalance }];
    let activeTrade = null;
    let maxDrawdown = 0;
    let peakEquity = initialCapital;

    // Process each candle
    console.log(`[Backtest] Starting simulation with ${initialCapital} capital...`);

    for (let i = 100; i < candles.length; i++) {
      // Walk-forward approach: only use historical data up to current candle
      // Do NOT include future candles - this ensures realistic analysis
      const lookbackCandles = candles.slice(Math.max(0, i - 100), i);
      const currentCandle = candles[i];
      const currentPrice = parseFloat(currentCandle.close);

      console.log(`[Backtest] Candle ${i}/${candles.length}: ${currentCandle.timestamp} @ ${currentPrice} (using ${lookbackCandles.length} historical candles)`);

      // Run ICT analysis on lookback period
      const ictResults = analyzeAllICTConcepts(lookbackCandles);

      // Generate Claude signal
      let signal = null;
      try {
        const claudeAnalysis = await analyzeMarketDataWithClaude(
          {
            symbol: symbol.toUpperCase(),
            timeframe,
            currentPrice,
            timestamp: currentCandle.timestamp
          },
          ictResults
        );
        signal = extractSignalFromAnalysis(claudeAnalysis);
      } catch (err) {
        console.warn(`[Backtest] Claude analysis failed at candle ${i}: ${err.message}`);
      }

      // Check if active trade should be closed
      if (activeTrade) {
        const tradeProfit = currentPrice - activeTrade.entryPrice;
        const tradeReturnPercent = (tradeProfit / activeTrade.entryPrice) * 100;

        // Close on stop loss
        if (currentPrice <= activeTrade.stopLoss) {
          console.log(`[Backtest] Closed trade (SL) at ${currentPrice}, Entry: ${activeTrade.entryPrice}`);
          const exitProfit = activeTrade.quantity * (currentPrice - activeTrade.entryPrice);
          accountBalance += exitProfit;
          equity = accountBalance;

          trades.push({
            entryTime: activeTrade.entryTime,
            exitTime: currentCandle.timestamp,
            entryPrice: activeTrade.entryPrice,
            exitPrice: currentPrice,
            quantity: activeTrade.quantity,
            profit: exitProfit,
            returnPercent: tradeReturnPercent,
            type: 'stop_loss'
          });

          activeTrade = null;
        }
        // Close on take profit
        else if (currentPrice >= activeTrade.takeProfit) {
          console.log(`[Backtest] Closed trade (TP) at ${currentPrice}, Entry: ${activeTrade.entryPrice}`);
          const exitProfit = activeTrade.quantity * (currentPrice - activeTrade.entryPrice);
          accountBalance += exitProfit;
          equity = accountBalance;

          trades.push({
            entryTime: activeTrade.entryTime,
            exitTime: currentCandle.timestamp,
            entryPrice: activeTrade.entryPrice,
            exitPrice: currentPrice,
            quantity: activeTrade.quantity,
            profit: exitProfit,
            returnPercent: tradeReturnPercent,
            type: 'take_profit'
          });

          activeTrade = null;
        }
        // Update equity with unrealized P&L
        else {
          equity = accountBalance + (activeTrade.quantity * tradeProfit);
        }
      }

      // Check for new trade signal
      if (!activeTrade && signal && signal.bias) {
        if ((signal.bias === 'BULLISH' || signal.bias === 'bullish') && signal.signal === 'BUY') {
          // Calculate position size based on risk
          const entryPrice = currentPrice * (1 + slippage / 100);
          const riskAmount = (accountBalance * riskPerTrade) / 100;
          const stopLoss = parseFloat(signal.stopLoss) || currentPrice * 0.98;
          const riskPerUnit = entryPrice - stopLoss;

          if (riskPerUnit > 0) {
            const quantity = riskAmount / riskPerUnit;

            if (accountBalance >= entryPrice * quantity) {
              console.log(`[Backtest] Opened BUY at ${entryPrice}, SL: ${stopLoss}, TP: ${signal.takeProfit}`);

              activeTrade = {
                entryPrice,
                stopLoss,
                takeProfit: parseFloat(signal.takeProfit) || currentPrice * 1.02,
                quantity,
                entryTime: currentCandle.timestamp,
                side: 'BUY'
              };

              accountBalance -= entryPrice * quantity;
            }
          }
        } else if ((signal.bias === 'BEARISH' || signal.bias === 'bearish') && signal.signal === 'SELL') {
          // Short trade logic
          const entryPrice = currentPrice * (1 - slippage / 100);
          const riskAmount = (accountBalance * riskPerTrade) / 100;
          const stopLoss = parseFloat(signal.stopLoss) || currentPrice * 1.02;
          const riskPerUnit = stopLoss - entryPrice;

          if (riskPerUnit > 0) {
            const quantity = riskAmount / riskPerUnit;

            if (accountBalance >= entryPrice * quantity) {
              console.log(`[Backtest] Opened SELL at ${entryPrice}, SL: ${stopLoss}, TP: ${signal.takeProfit}`);

              activeTrade = {
                entryPrice,
                stopLoss,
                takeProfit: parseFloat(signal.takeProfit) || currentPrice * 0.98,
                quantity,
                entryTime: currentCandle.timestamp,
                side: 'SELL'
              };

              accountBalance -= entryPrice * quantity;
            }
          }
        }
      }

      // Track drawdown
      if (equity > peakEquity) {
        peakEquity = equity;
      }
      const drawdown = ((peakEquity - equity) / peakEquity) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }

      // Record equity at each candle
      equityCurve.push({
        timestamp: currentCandle.timestamp,
        equity,
        balance: accountBalance
      });
    }

    // Close any open trade at end of period
    if (activeTrade) {
      const lastPrice = parseFloat(candles[candles.length - 1].close);
      const exitProfit = activeTrade.quantity * (lastPrice - activeTrade.entryPrice);
      accountBalance += exitProfit;
      equity = accountBalance;

      trades.push({
        entryTime: activeTrade.entryTime,
        exitTime: candles[candles.length - 1].timestamp,
        entryPrice: activeTrade.entryPrice,
        exitPrice: lastPrice,
        quantity: activeTrade.quantity,
        profit: exitProfit,
        returnPercent: ((lastPrice - activeTrade.entryPrice) / activeTrade.entryPrice) * 100,
        type: 'end_of_period'
      });
    }

    // Calculate statistics
    const totalProfit = accountBalance - initialCapital;
    const totalReturn = (totalProfit / initialCapital) * 100;
    const winningTrades = trades.filter(t => t.profit > 0);
    const losingTrades = trades.filter(t => t.profit <= 0);
    const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;
    const avgWin = winningTrades.length > 0 ? winningTrades.reduce((sum, t) => sum + t.profit, 0) / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? losingTrades.reduce((sum, t) => sum + t.profit, 0) / losingTrades.length : 0;
    const profitFactor = Math.abs(avgLoss) > 0 ? Math.abs(avgWin * winningTrades.length) / Math.abs(avgLoss * losingTrades.length) : 0;

    console.log(`[Backtest] ✅ Completed. Total trades: ${trades.length}, Win rate: ${winRate.toFixed(2)}%, Total return: ${totalReturn.toFixed(2)}%`);

    return {
      symbol: symbol.toUpperCase(),
      timeframe,
      period: {
        startDate,
        endDate
      },
      summary: {
        initialCapital,
        finalBalance: accountBalance,
        totalProfit,
        totalReturn,
        maxDrawdown: maxDrawdown.toFixed(2),
        winRate: winRate.toFixed(2),
        profitFactor: profitFactor.toFixed(2)
      },
      trades: {
        total: trades.length,
        winning: winningTrades.length,
        losing: losingTrades.length,
        avgWin: avgWin.toFixed(2),
        avgLoss: avgLoss.toFixed(2)
      },
      trades: trades,
      equityCurve: equityCurve
    };
  } catch (error) {
    console.error('[Backtest] Error:', error.message);
    throw error;
  }
}

/**
 * Calculate Sharpe Ratio from equity curve
 * @param {array} equityCurve - Equity curve data
 * @param {number} riskFreeRate - Annual risk-free rate (default: 0.02)
 * @returns {number} Sharpe ratio
 */
export function calculateSharpeRatio(equityCurve, riskFreeRate = 0.02) {
  if (equityCurve.length < 2) return 0;

  // Calculate daily returns
  const returns = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const ret = (equityCurve[i].equity - equityCurve[i - 1].equity) / equityCurve[i - 1].equity;
    returns.push(ret);
  }

  if (returns.length === 0) return 0;

  // Calculate mean return
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;

  // Calculate standard deviation
  const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  // Calculate Sharpe Ratio
  const dailyRiskFreeRate = riskFreeRate / 252; // 252 trading days
  const sharpeRatio = (meanReturn - dailyRiskFreeRate) / stdDev * Math.sqrt(252);

  return sharpeRatio;
}
