import express from 'express';
import { runStrategyBacktest } from '../services/strategyBacktest.service.js';

const router = express.Router();

/**
 * POST /api/strategy-backtest/run
 * Run backtest with professional ICT strategy rules
 *
 * Request body:
 * {
 *   symbol: "BTCUSDT",
 *   timeframe: "5M",
 *   startDate: "2024-01-01",
 *   endDate: "2024-12-31",
 *   initialCapital: 10000
 * }
 */
router.post('/run', async (req, res) => {
  try {
    const { symbol, timeframe = '5M', startDate, endDate, initialCapital = 10000 } = req.body;

    // Validate inputs
    if (!symbol || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Required fields: symbol, startDate, endDate'
        }
      });
    }

    console.log(`[Strategy Backtest API] Running professional ICT strategy for ${symbol} ${timeframe}`);

    const results = await runStrategyBacktest(symbol, timeframe, startDate, endDate, {
      initialCapital
    });

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('[Strategy Backtest API] Error:', error.message);
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
