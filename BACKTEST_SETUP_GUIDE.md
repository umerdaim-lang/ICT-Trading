# ICT Trading - Professional Strategy Backtest Setup Guide

## Overview

The ICT Trading system now includes a **Professional Strategy Backtester** that enforces all the trading rules you specified:

✅ D1 Bias Detection (previous close color)
✅ H1 PD Array Filtering (order blocks & fair value gaps aligned with bias)
✅ M5 Orderflow Confirmation (killzone enforcement)
✅ Killzone Trading (Asia/London/NY sessions only)
✅ Signal Quality Rating (A+/A/B grades with position sizing)
✅ Complete Rule Compliance Tracking

---

## Strategy Rules Summary

| Rule | Details |
|------|---------|
| **D1 Bias** | Previous day's close (Green=LONG, Red=SHORT) |
| **H1 Levels** | PD arrays (Order Blocks, FVGs) aligned with bias only |
| **M5 Execution** | Orderflow flip confirmation via Claude AI |
| **Killzone** | Asia (8pm-12am NY), London (2am-5am), NY (7am-10am) |
| **Risk Management** | A+ (3%), A (2%), B (0.5%) position sizing |
| **Targets** | 2R fixed, 75% close at 2R/3R (on backtest: 5% TP for longs) |

---

## Setup Steps

### Step 1: Configure Database (Choose One)

#### Option A: Supabase (Recommended - Free)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project**
3. Create project:
   - Name: `ict-trading`
   - Password: Save securely
   - Region: Closest to you
   - Plan: **Free**
4. Wait for initialization (~2 minutes)
5. Go to **Settings** → **Database** → Copy **Connection String (URI)**
6. Create `.env` file in `backend/` directory:

```bash
DATABASE_URL="postgresql://postgres.xxxxx:password@db.xxxxx.supabase.co:5432/postgres"
ANTHROPIC_API_KEY="your-claude-api-key"
FINNHUB_API_KEY="your-finnhub-key"
WEBHOOK_SECRET="your-secret"
PORT=3000
NODE_ENV=development
```

#### Option B: Local PostgreSQL

1. Install PostgreSQL from [postgresql.org](https://www.postgresql.org/download/)
2. Create database:
   ```bash
   createdb ict_trading
   ```
3. Create `.env`:
   ```bash
   DATABASE_URL="postgresql://postgres:password@localhost:5432/ict_trading"
   ```

### Step 2: Initialize Database Schema

```bash
cd backend

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate
```

### Step 3: Fetch Historical Data (2020-2024)

```bash
# Fetch D1, H1, M5 candles for BTCUSDT and DOGEUSDT
node scripts/fetchHistoricalData.js
```

**What this does:**
- Fetches 2020-01-01 to 2024-12-31 for BTCUSDT
- Fetches 2020-01-01 to 2024-12-31 for DOGEUSDT
- Timeframes: Daily (D), Hourly (1H), 5-minute (5M)
- Uses MEXC API (public, no auth required)
- Stores in database automatically

**Expected output:**
```
✓ BTCUSDT D: 1826 candles
✓ BTCUSDT 1H: 43,824 candles
✓ BTCUSDT 5M: 525,120 candles

✓ DOGEUSDT D: 1826 candles
✓ DOGEUSDT 1H: 43,824 candles
✓ DOGEUSDT 5M: 525,120 candles
```

**Estimated time:** 20-30 minutes (API rate limits)

### Step 4: Run Professional Strategy Backtest

```bash
# Run backtest for BTCUSDT with 2020-2024 data
node scripts/runBacktest.js
```

**Output includes:**
```
📊 BACKTEST RESULTS
  • Initial Capital: $10,000
  • Final Balance: $X,XXX
  • Total Return: XX.XX%
  • Max Drawdown: XX.XX%
  • Win Rate: XX.XX%

  • Total Trades: XXX
  • Winning Trades: XX
  • Losing Trades: XX

  • A+ Trades: XX
  • A Trades: XX
  • B Trades: XX

  • Rule Compliance: XX.XX%
```

---

## API Endpoints

### Run Backtest (Generic)

```bash
POST /api/backtest/run
Content-Type: application/json

{
  "symbol": "BTCUSDT",
  "timeframe": "1H",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "initialCapital": 10000,
  "riskPerTrade": 2,
  "slippage": 0.1
}
```

### Run Strategy Backtest (Professional ICT)

```bash
POST /api/strategy-backtest/run
Content-Type: application/json

{
  "symbol": "BTCUSDT",
  "timeframe": "5M",
  "startDate": "2020-01-01",
  "endDate": "2024-12-31",
  "initialCapital": 10000
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "symbol": "BTCUSDT",
    "strategy": "Professional ICT Strategy",
    "summary": {
      "initialCapital": 10000,
      "finalBalance": 15234.56,
      "totalProfit": 5234.56,
      "totalReturn": 52.35,
      "maxDrawdown": "24.12",
      "winRate": "65.43"
    },
    "trades": {
      "total": 156,
      "winning": 102,
      "losing": 54,
      "avgWin": 85.23,
      "avgLoss": -32.15
    },
    "qualityBreakdown": {
      "aPlus": 45,
      "a": 67,
      "b": 44
    },
    "ruleCompliance": {
      "totalSignalsGenerated": 1243,
      "ruleViolations": 18,
      "complianceRate": 98.55
    }
  }
}
```

---

## Backtest Analysis Guide

### Key Metrics to Look For

| Metric | Target | Notes |
|--------|--------|-------|
| **Total Return** | > 10% | Over 5 years of data |
| **Win Rate** | > 50% | Higher is better |
| **Profit Factor** | > 1.5 | Total wins / total losses |
| **Max Drawdown** | < 30% | Risk tolerance |
| **A+/A Ratio** | > 60% | High-quality trades |
| **Compliance** | > 95% | Rule enforcement |

### Interpreting Results

**Positive Signs:**
- Return > 50% over 5 years
- Win rate > 55%
- A+/A trades > 65% of total
- Max drawdown < 25%
- Compliance > 95%

**Areas for Improvement:**
- Low win rate (<50%) = tune entry rules
- Low A+/A ratio (<60%) = confluence detection needs work
- High violations = bias filter too strict
- High drawdown = position sizing too aggressive

---

## Troubleshooting

### "DATABASE_URL not found"
```bash
# Create .env file in backend directory with:
DATABASE_URL="your-database-url"
```

### "No market data found"
```bash
# Run data fetch script:
node scripts/fetchHistoricalData.js

# Check database:
npm run prisma:studio  # View data in browser UI
```

### Slow fetch speed
- MEXC API rate limit: ~200 requests/minute
- Expected time for full 2020-2024: 20-30 minutes
- Can reduce date range for testing

### Backtest shows 0 trades
- Killzone may be too restrictive (only 3 hours/day)
- Bias filter may not match generated signals
- Try analyzing with `/api/analysis/run` first

---

## Demo Script

For quick testing without database setup:

```bash
node scripts/testStrategyDemo.js
```

This runs a complete backtest with 90 days of synthetic data and shows:
- Signal processing efficiency (98%+ compliance)
- Killzone enforcement
- Bias filtering
- Trade statistics

Great for validating the strategy logic before running real data.

---

## Next Steps

1. **Immediate:** Run demo script to verify strategy logic
2. **Short-term:** Set up Supabase database
3. **Medium-term:** Fetch 2020-2024 data for BTCUSDT/DOGEUSDT
4. **Long-term:** Analyze results and tune entry/exit rules
5. **Production:** Deploy on Render with live data feed

---

## Real-Time Integration

After backtesting, enable live trading signals:

```bash
# In dashboard, real-time signals use:
GET /api/signals?symbol=BTCUSDT&status=ACTIVE

# TradingView webhook (already configured)
POST /api/webhook/tradingview
```

See `README_DEPLOYMENT.md` for live trading setup.

---

## Support

For issues with:
- **Database setup:** Check Supabase/PostgreSQL docs
- **MEXC API:** See https://mexc.com/api
- **Backtest logic:** Review `backend/src/services/strategyBacktest.service.js`
- **Claude integration:** Check `ANTHROPIC_API_KEY` in `.env`

