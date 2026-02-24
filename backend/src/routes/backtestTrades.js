import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

/**
 * GET /api/backtest-trades
 * Get all trades from latest backtest with 10X leverage
 */
router.get('/', (req, res) => {
  try {
    const tradesPath = path.join(process.cwd(), 'trades_data.json');

    if (!fs.existsSync(tradesPath)) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NO_DATA',
          message: 'No backtest data found. Run backtest first: node scripts/backtestWith10xLeverage.js'
        }
      });
    }

    let tradesData = JSON.parse(fs.readFileSync(tradesPath, 'utf8'));

    // Ensure trades have isWin field (calculate if missing)
    if (tradesData.trades) {
      tradesData.trades = tradesData.trades.map(trade => ({
        ...trade,
        isWin: trade.isWin !== undefined ? trade.isWin : (trade.profit > 0)
      }));
    }

    res.json({
      success: true,
      data: tradesData
    });
  } catch (error) {
    console.error('[Backtest Trades] Error:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'ERROR',
        message: error.message
      }
    });
  }
});

/**
 * GET /api/backtest-trades/summary
 * Get backtest summary statistics
 */
router.get('/summary', (req, res) => {
  try {
    const tradesPath = path.join(process.cwd(), 'trades_data.json');

    if (!fs.existsSync(tradesPath)) {
      return res.status(404).json({
        success: false,
        error: { code: 'NO_DATA', message: 'No backtest data' }
      });
    }

    let tradesData = JSON.parse(fs.readFileSync(tradesPath, 'utf8'));
    let trades = tradesData.trades || [];

    // Ensure trades have isWin field (calculate if missing)
    trades = trades.map(trade => ({
      ...trade,
      isWin: trade.isWin !== undefined ? trade.isWin : (trade.profit > 0)
    }));

    if (trades.length === 0) {
      return res.json({
        success: true,
        data: {
          symbol: tradesData.symbol,
          period: tradesData.period,
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          winRate: 0,
          totalProfit: 0,
          totalReturn: 0
        }
      });
    }

    const winning = trades.filter(t => t.isWin);
    const losing = trades.filter(t => !t.isWin);
    const totalProfit = winning.reduce((s, t) => s + t.profit, 0) + losing.reduce((s, t) => s + t.profit, 0);
    const totalReturn = (totalProfit / 1000) * 100; // $1000 trading capital

    res.json({
      success: true,
      data: {
        symbol: tradesData.symbol,
        period: tradesData.period,
        totalTrades: trades.length,
        winningTrades: winning.length,
        losingTrades: losing.length,
        winRate: (winning.length / trades.length * 100).toFixed(2),
        totalProfit: totalProfit.toFixed(2),
        totalReturn: totalReturn.toFixed(2),
        avgWin: winning.length > 0 ? (winning.reduce((s, t) => s + t.profit, 0) / winning.length).toFixed(2) : 0,
        avgLoss: losing.length > 0 ? (losing.reduce((s, t) => s + t.profit, 0) / losing.length).toFixed(2) : 0
      }
    });
  } catch (error) {
    console.error('[Backtest Summary] Error:', error.message);
    res.status(500).json({
      success: false,
      error: { code: 'ERROR', message: error.message }
    });
  }
});

/**
 * GET /api/backtest-trades/winning
 * Get only winning trades
 */
router.get('/winning', (req, res) => {
  try {
    const tradesPath = path.join(process.cwd(), 'trades_data.json');

    if (!fs.existsSync(tradesPath)) {
      return res.status(404).json({
        success: false,
        error: { code: 'NO_DATA', message: 'No backtest data' }
      });
    }

    let tradesData = JSON.parse(fs.readFileSync(tradesPath, 'utf8'));
    const trades = (tradesData.trades || []).map(trade => ({
      ...trade,
      isWin: trade.isWin !== undefined ? trade.isWin : (trade.profit > 0)
    }));
    const winning = trades.filter(t => t.isWin);

    res.json({
      success: true,
      data: {
        total: winning.length,
        trades: winning
      }
    });
  } catch (error) {
    console.error('[Backtest Winning] Error:', error.message);
    res.status(500).json({
      success: false,
      error: { code: 'ERROR', message: error.message }
    });
  }
});

/**
 * GET /api/backtest-trades/losing
 * Get only losing trades
 */
router.get('/losing', (req, res) => {
  try {
    const tradesPath = path.join(process.cwd(), 'trades_data.json');

    if (!fs.existsSync(tradesPath)) {
      return res.status(404).json({
        success: false,
        error: { code: 'NO_DATA', message: 'No backtest data' }
      });
    }

    let tradesData = JSON.parse(fs.readFileSync(tradesPath, 'utf8'));
    const trades = (tradesData.trades || []).map(trade => ({
      ...trade,
      isWin: trade.isWin !== undefined ? trade.isWin : (trade.profit > 0)
    }));
    const losing = trades.filter(t => !t.isWin);

    res.json({
      success: true,
      data: {
        total: losing.length,
        trades: losing
      }
    });
  } catch (error) {
    console.error('[Backtest Losing] Error:', error.message);
    res.status(500).json({
      success: false,
      error: { code: 'ERROR', message: error.message }
    });
  }
});

export default router;
