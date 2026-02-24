import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import 'express-async-errors';

// Routes
import marketDataRoutes from './src/routes/marketData.js';
import analysisRoutes from './src/routes/analysis.js';
import signalsRoutes from './src/routes/signals.js';
import webhookRoutes from './src/routes/webhook.js';
import backtestRoutes from './src/routes/backtest.js';
import strategyBacktestRoutes from './src/routes/strategyBacktest.js';
import backtestTradesRoutes from './src/routes/backtestTrades.js';

// Services
import { startScheduler } from './src/services/scheduler.service.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - CORS configuration for development and production
const allowedOrigins = [
  'http://localhost:5173',      // Local development
  'https://ict-trading-ui.onrender.com',  // Production frontend
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/market-data', marketDataRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/signals', signalsRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/backtest', backtestRoutes);
app.use('/api/strategy-backtest', strategyBacktestRoutes);
app.use('/api/backtest-trades', backtestTradesRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: message
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 ICT Trading API running on http://localhost:${PORT}`);
  console.log(`📊 Frontend: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);

  // Start the data fetch scheduler
  startScheduler();
});
