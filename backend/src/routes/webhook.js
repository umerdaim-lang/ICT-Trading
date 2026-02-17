import express from 'express';
import prisma from '../utils/db.js';
import { analyzeAllICTConcepts } from '../services/ict.service.js';
import {
  analyzeMarketDataWithClaude,
  extractSignalFromAnalysis
} from '../services/claude.service.js';

const router = express.Router();

// In-memory tracking for webhook status (resets on service restart)
let lastReceivedAt = null;
let webhooksProcessed = 0;

// TradingView interval to internal timeframe mapping
const INTERVAL_MAP = {
  '60': '1H',
  '240': '4H',
  'D': 'D',
  '1D': 'D',
  'W': 'W',
  '1W': 'W'
};

/**
 * POST /api/webhook/tradingview
 * Receive alerts from TradingView and trigger ICT analysis
 *
 * Expected payload:
 * {
 *   "secret": "YOUR_WEBHOOK_SECRET",
 *   "symbol": "BTCUSDT",
 *   "timeframe": "240",
 *   "price": 45230.50,
 *   "open": 45100.00,
 *   "high": 45350.00,
 *   "low": 45000.00,
 *   "close": 45230.50,
 *   "volume": 1000000,
 *   "time": "2024-02-17T12:00:00Z"
 * }
 */
router.post('/tradingview', async (req, res) => {
  try {
    // Step 1: Validate webhook secret
    const secret = req.body?.secret;
    if (!secret || secret !== process.env.WEBHOOK_SECRET) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid webhook secret'
        }
      });
    }

    // Step 2: Validate and parse required fields
    const { symbol, timeframe, open, high, low, close, volume, time } =
      req.body;

    if (!symbol || !timeframe || !close) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PAYLOAD',
          message: 'Required fields: symbol, timeframe, close'
        }
      });
    }

    // Step 3: Map TradingView timeframe to internal format
    const internalTimeframe = INTERVAL_MAP[timeframe];
    if (!internalTimeframe) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TIMEFRAME',
          message: `Unknown timeframe: ${timeframe}. Supported: 60, 240, D, W`
        }
      });
    }

    // Step 4: Build and upsert candle record
    const candle = {
      symbol: symbol.toUpperCase(),
      timeframe: internalTimeframe,
      timestamp: new Date(time || Date.now()),
      open: parseFloat(open) || parseFloat(close),
      high: parseFloat(high) || parseFloat(close),
      low: parseFloat(low) || parseFloat(close),
      close: parseFloat(close),
      volume: parseFloat(volume) || 0
    };

    await prisma.marketData.upsert({
      where: {
        symbol_timeframe_timestamp: {
          symbol: candle.symbol,
          timeframe: candle.timeframe,
          timestamp: candle.timestamp
        }
      },
      update: candle,
      create: candle
    });

    // Step 5: Fetch last 100 candles for this symbol+timeframe
    const candles = await prisma.marketData.findMany({
      where: {
        symbol: candle.symbol,
        timeframe: candle.timeframe
      },
      orderBy: {
        timestamp: 'asc'
      },
      take: 100
    });

    // Step 6: Guard against insufficient data
    if (candles.length < 10) {
      lastReceivedAt = new Date().toISOString();
      webhooksProcessed++;

      return res.status(200).json({
        success: true,
        data: {
          status: 'candle_saved',
          analysisSkipped: true,
          reason: `Insufficient data (${candles.length} candles, need min 10)`,
          symbol: candle.symbol,
          timeframe: candle.timeframe
        }
      });
    }

    // Step 7: Run ICT analysis
    const ictResults = analyzeAllICTConcepts(candles);

    // Step 8: Run Claude analysis
    const claudeAnalysis = await analyzeMarketDataWithClaude(
      {
        symbol: candle.symbol,
        timeframe: candle.timeframe,
        currentPrice: parseFloat(close)
      },
      ictResults
    );

    // Step 9: Store analysis in database
    const analysis = await prisma.ictAnalysis.create({
      data: {
        symbol: candle.symbol,
        timeframe: candle.timeframe,
        orderBlocks: ictResults.orderBlocks,
        liquidityLevels: ictResults.liquidityLevels,
        fairValueGaps: ictResults.fvgs,
        marketStructureShift: ictResults.mss,
        claudeAnalysis: claudeAnalysis
      }
    });

    // Step 10: Update webhook status and respond
    lastReceivedAt = new Date().toISOString();
    webhooksProcessed++;

    res.status(200).json({
      success: true,
      data: {
        status: 'analysis_complete',
        analysisId: analysis.id,
        symbol: candle.symbol,
        timeframe: candle.timeframe,
        currentPrice: parseFloat(close),
        bias: ictResults.bias,
        orderBlocksFound: ictResults.orderBlocks?.length || 0,
        liquidityLevelsFound:
          (ictResults.liquidityLevels?.highs?.length || 0) +
          (ictResults.liquidityLevels?.lows?.length || 0),
        fvgsFound: ictResults.fvgs?.length || 0,
        webhookSource: 'tradingview'
      }
    });
  } catch (error) {
    console.error('[Webhook] Error processing TradingView alert:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'WEBHOOK_ERROR',
        message: error.message
      }
    });
  }
});

/**
 * GET /api/webhook/status
 * Returns webhook processing statistics
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      lastReceivedAt,
      webhooksProcessed,
      status: webhooksProcessed > 0 ? 'active' : 'waiting'
    }
  });
});

export default router;
