import express from 'express';
import prisma from '../utils/db.js';

const router = express.Router();

// GET: Active signals
router.get('/active', async (req, res) => {
  try {
    const signals = await prisma.tradingSignal.findMany({
      where: {
        status: 'ACTIVE'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      data: {
        signals,
        count: signals.length
      }
    });
  } catch (error) {
    console.error('Get signals error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_ERROR',
        message: error.message
      }
    });
  }
});

// GET: Signal by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const signal = await prisma.tradingSignal.findUnique({
      where: { id }
    });

    if (!signal) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Signal not found'
        }
      });
    }

    res.json({
      success: true,
      data: signal
    });
  } catch (error) {
    console.error('Get signal error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_ERROR',
        message: error.message
      }
    });
  }
});

// GET: Signals for symbol
router.get('/symbol/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { status = 'ACTIVE', limit = 50 } = req.query;

    const signals = await prisma.tradingSignal.findMany({
      where: {
        symbol: symbol.toUpperCase(),
        ...(status && { status })
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: parseInt(limit)
    });

    res.json({
      success: true,
      data: {
        symbol: symbol.toUpperCase(),
        signals,
        count: signals.length
      }
    });
  } catch (error) {
    console.error('Get signals error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_ERROR',
        message: error.message
      }
    });
  }
});

// PUT: Close signal
router.put('/:id/close', async (req, res) => {
  try {
    const { id } = req.params;
    const { closedPrice, outcome } = req.body;

    // Fetch signal first to get existing reason
    const existingSignal = await prisma.tradingSignal.findUnique({
      where: { id }
    });

    if (!existingSignal) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Signal not found'
        }
      });
    }

    const signal = await prisma.tradingSignal.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        ...(outcome && { reason: `${existingSignal.reason || ''} - Closed with outcome: ${outcome}` })
      }
    });

    res.json({
      success: true,
      data: signal
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Signal not found'
        }
      });
    }

    console.error('Close signal error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_ERROR',
        message: error.message
      }
    });
  }
});

// DELETE: Remove signal
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.tradingSignal.delete({
      where: { id }
    });

    res.json({
      success: true,
      data: {
        message: 'Signal deleted'
      }
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Signal not found'
        }
      });
    }

    console.error('Delete signal error:', error);
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
