import express from 'express';
import { runBacktest, calculateSharpeRatio } from '../services/backtest.service.js';

const router = express.Router();

/**
 * POST /api/backtest/run
 * Run a backtest on historical data
 *
 * Request body:
 * {
 *   symbol: "BTCUSDT",
 *   timeframe: "1H",
 *   startDate: "2024-01-01",
 *   endDate: "2024-12-31",
 *   initialCapital: 10000,
 *   riskPerTrade: 2,
 *   slippage: 0.1
 * }
 */
router.post('/run', async (req, res) => {
  try {
    const { symbol, timeframe, startDate, endDate, initialCapital = 10000, riskPerTrade = 2, slippage = 0.1 } = req.body;

    // Validate inputs
    if (!symbol || !timeframe || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Required fields: symbol, timeframe, startDate, endDate'
        }
      });
    }

    // Validate date format
    try {
      new Date(startDate);
      new Date(endDate);
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DATE',
          message: 'Dates must be in ISO format (YYYY-MM-DD)'
        }
      });
    }

    console.log(`[Backtest API] Running backtest for ${symbol} ${timeframe} from ${startDate} to ${endDate}`);

    // Run backtest
    const results = await runBacktest(symbol, timeframe, startDate, endDate, {
      initialCapital,
      riskPerTrade,
      slippage
    });

    // Calculate Sharpe Ratio
    const sharpeRatio = calculateSharpeRatio(results.equityCurve);

    res.json({
      success: true,
      data: {
        ...results,
        summary: {
          ...results.summary,
          sharpeRatio: sharpeRatio.toFixed(2)
        }
      }
    });
  } catch (error) {
    console.error('[Backtest API] Error:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'BACKTEST_ERROR',
        message: error.message
      }
    });
  }
});

/**
 * GET /api/backtest/stats/:symbol/:timeframe
 * Get backtest statistics for a symbol/timeframe
 */
router.get('/stats/:symbol/:timeframe', async (req, res) => {
  try {
    const { symbol, timeframe } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Required query parameters: startDate, endDate'
        }
      });
    }

    const results = await runBacktest(symbol, timeframe, startDate, endDate);
    const sharpeRatio = calculateSharpeRatio(results.equityCurve);

    res.json({
      success: true,
      data: {
        summary: {
          ...results.summary,
          sharpeRatio: sharpeRatio.toFixed(2)
        },
        trades: results.trades
      }
    });
  } catch (error) {
    console.error('[Backtest Stats API] Error:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'BACKTEST_ERROR',
        message: error.message
      }
    });
  }
});

export default router;
