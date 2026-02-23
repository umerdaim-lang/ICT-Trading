import express from 'express';
import prisma from '../utils/db.js';
import { analyzeAllICTConcepts } from '../services/ict.service.js';
import { analyzeMarketDataWithClaude, extractSignalFromAnalysis } from '../services/claude.service.js';

const router = express.Router();

// POST: Run ICT analysis
router.post('/run', async (req, res) => {
  try {
    const { symbol, timeframe, lookbackPeriods = 100 } = req.body;

    if (!symbol || !timeframe) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'symbol and timeframe are required'
        }
      });
    }

    // Get market data
    const candles = await prisma.marketData.findMany({
      where: {
        symbol: symbol.toUpperCase(),
        timeframe: timeframe.toUpperCase()
      },
      orderBy: {
        timestamp: 'asc'
      },
      take: -(lookbackPeriods) // Negative take = get last N records
    });

    if (candles.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NO_DATA',
          message: `No market data found for ${symbol} ${timeframe}`
        }
      });
    }

    // Run ICT analysis
    console.log(`[Analysis] Running ICT analysis on ${candles.length} candles for ${symbol} ${timeframe}`);
    const ictResults = analyzeAllICTConcepts(candles);
    console.log(`[Analysis] ✅ ICT analysis complete. Got ${ictResults.orderBlocks?.length || 0} order blocks`);

    // Get Claude analysis
    console.log(`[Analysis] Calling Claude API for market analysis...`);
    const claudeAnalysis = await analyzeMarketDataWithClaude(
      {
        symbol: symbol.toUpperCase(),
        timeframe,
        currentPrice: candles[candles.length - 1].close,
        timestamp: candles[candles.length - 1].timestamp
      },
      ictResults
    );

    // Store analysis in database
    console.log(`[Analysis] ✅ Claude analysis complete. Storing in database...`);
    const analysis = await prisma.ictAnalysis.create({
      data: {
        symbol: symbol.toUpperCase(),
        timeframe,
        orderBlocks: ictResults.orderBlocks,
        liquidityLevels: ictResults.liquidityLevels,
        fairValueGaps: ictResults.fvgs,
        supplyDemandZones: ictResults.supplyDemandZones,
        breakerBlocks: ictResults.breakerBlocks,
        marketStructureShift: ictResults.mss,
        claudeAnalysis
      }
    });

    res.json({
      success: true,
      data: {
        analysisId: analysis.id,
        symbol: symbol.toUpperCase(),
        timeframe,
        summary: ictResults.summary,
        orderBlocks: ictResults.orderBlocks,
        liquidityLevels: ictResults.liquidityLevels,
        fairValueGaps: ictResults.fvgs,
        supplyDemandZones: ictResults.supplyDemandZones,
        breakerBlocks: ictResults.breakerBlocks,
        marketStructureShift: ictResults.mss,
        claudeAnalysis
      }
    });
  } catch (error) {
    console.error('[Analysis] ❌ ERROR:', error.message);
    console.error('[Analysis] Stack:', error.stack);
    console.error('[Analysis] Full error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ANALYSIS_ERROR',
        message: error.message,
        details: error.stack
      }
    });
  }
});

// GET: Latest analysis for symbol
router.get('/:symbol/latest', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { timeframe = '4H' } = req.query;

    const analysis = await prisma.ictAnalysis.findFirst({
      where: {
        symbol: symbol.toUpperCase(),
        timeframe: timeframe.toUpperCase()
      },
      orderBy: {
        analysisTimestamp: 'desc'
      }
    });

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NO_ANALYSIS',
          message: `No analysis found for ${symbol} ${timeframe}`
        }
      });
    }

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('Get analysis error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_ERROR',
        message: error.message
      }
    });
  }
});

// GET: Analysis history
router.get('/history', async (req, res) => {
  try {
    const { symbol, limit = 20, offset = 0 } = req.query;

    const where = symbol ? { symbol: symbol.toUpperCase() } : {};

    const analyses = await prisma.ictAnalysis.findMany({
      where,
      orderBy: {
        analysisTimestamp: 'desc'
      },
      skip: parseInt(offset),
      take: parseInt(limit)
    });

    res.json({
      success: true,
      data: {
        analyses,
        count: analyses.length
      }
    });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'HISTORY_ERROR',
        message: error.message
      }
    });
  }
});

// POST: Extract signal from analysis
router.post('/:analysisId/extract-signal', async (req, res) => {
  try {
    const { analysisId } = req.params;

    const analysis = await prisma.ictAnalysis.findUnique({
      where: { id: analysisId }
    });

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Analysis not found'
        }
      });
    }

    // Extract signal from Claude analysis
    const signalData = await extractSignalFromAnalysis(analysis.claudeAnalysis);

    // If signal exists, create trading signal record
    let signal = null;
    if (signalData.signal) {
      signal = await prisma.tradingSignal.create({
        data: {
          symbol: analysis.symbol,
          timeframe: analysis.timeframe,
          signalType: signalData.signal,
          entryPrice: signalData.entryPrice,
          stopLoss: signalData.stopLoss,
          takeProfit: signalData.takeProfit,
          riskReward: signalData.riskReward || null,
          reason: signalData.reason,
          confidence: signalData.confidence
        }
      });
    }

    res.json({
      success: true,
      data: {
        signal,
        extraction: signalData
      }
    });
  } catch (error) {
    console.error('[SignalExtraction] ❌ ERROR:', error.message);
    console.error('[SignalExtraction] Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: {
        code: 'EXTRACTION_ERROR',
        message: error.message,
        details: error.stack
      }
    });
  }
});

export default router;
