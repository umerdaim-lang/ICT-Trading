import express from 'express';
import prisma from '../utils/db.js';
import { fetchLiveCandles } from '../services/dataFetch.service.js';

const router = express.Router();

// POST: Upload market data
router.post('/upload', async (req, res) => {
  try {
    const { symbol, timeframe, data } = req.body;

    if (!symbol || !timeframe || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'symbol, timeframe, and data array are required'
        }
      });
    }

    // Validate data structure
    const validData = data.map(item => {
      if (!item.timestamp || !item.open || !item.high || !item.low || !item.close) {
        throw new Error('Each candle must have timestamp, open, high, low, close');
      }
      return {
        symbol: symbol.toUpperCase(),
        timeframe: timeframe.toUpperCase(),
        timestamp: new Date(item.timestamp),
        open: parseFloat(item.open),
        high: parseFloat(item.high),
        low: parseFloat(item.low),
        close: parseFloat(item.close),
        volume: item.volume ? parseFloat(item.volume) : null
      };
    });

    // Create or update market data (bulk insert with skipDuplicates)
    const result = await prisma.marketData.createMany({
      data: validData,
      skipDuplicates: true // Ignore unique constraint violations
    });

    res.json({
      success: true,
      data: {
        symbol,
        timeframe,
        candlesUploaded: result.count
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(400).json({
      success: false,
      error: {
        code: 'UPLOAD_ERROR',
        message: error.message
      }
    });
  }
});

// GET: Fetch live market data from Binance or Finnhub
router.get('/live/:symbol/:timeframe', async (req, res) => {
  try {
    const { symbol, timeframe } = req.params;
    const { limit = 100 } = req.query;

    if (!symbol || !timeframe) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'symbol and timeframe are required'
        }
      });
    }

    // Clamp limit to max 500
    const parsedLimit = Math.min(parseInt(limit) || 100, 500);

    // Fetch live candles from appropriate data source
    const candles = await fetchLiveCandles(symbol, timeframe, parsedLimit);

    // Save to database
    const result = await prisma.marketData.createMany({
      data: candles,
      skipDuplicates: true
    });

    // Determine source
    const source = symbol.toUpperCase().includes('USDT') || symbol.toUpperCase().match(/^(BTC|ETH|BNB|SOL|XRP|ADA|DOGE|AVAX|MATIC|LINK)USDT/) ? 'binance' : 'finnhub';

    res.json({
      success: true,
      data: {
        symbol: symbol.toUpperCase(),
        timeframe: timeframe.toUpperCase(),
        source,
        candlesFetched: candles.length,
        candlesSaved: result.count
      }
    });
  } catch (error) {
    console.error('Live fetch error:', error);
    res.status(error.message.includes('Unknown symbol') ? 400 : 502).json({
      success: false,
      error: {
        code: error.message.includes('Unknown symbol') ? 'INVALID_SYMBOL' : 'FETCH_ERROR',
        message: error.message
      }
    });
  }
});

// GET: Retrieve market data
router.get('/:symbol/:timeframe', async (req, res) => {
  try {
    const { symbol, timeframe } = req.params;
    const { limit = 100 } = req.query;

    const data = await prisma.marketData.findMany({
      where: {
        symbol: symbol.toUpperCase(),
        timeframe: timeframe.toUpperCase()
      },
      orderBy: {
        timestamp: 'asc'
      },
      take: parseInt(limit) || 100
    });

    res.json({
      success: true,
      data: {
        symbol: symbol.toUpperCase(),
        timeframe: timeframe.toUpperCase(),
        candles: data,
        count: data.length
      }
    });
  } catch (error) {
    console.error('Get market data error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_ERROR',
        message: error.message
      }
    });
  }
});

// DELETE: Clear market data for a symbol
router.delete('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;

    const deleted = await prisma.marketData.deleteMany({
      where: {
        symbol: symbol.toUpperCase()
      }
    });

    res.json({
      success: true,
      data: {
        symbol: symbol.toUpperCase(),
        recordsDeleted: deleted.count
      }
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_ERROR',
        message: error.message
      }
    });
  }
});

export default router;
