# ICT Trading System - Quick Start

## What Was Built

A complete **ICT Swing Trading Analysis System** with:
- ✅ Backend API (Node.js/Express)
- ✅ React Dashboard (Vite)
- ✅ PostgreSQL Database Schema
- ✅ Claude AI Integration
- ✅ ICT Analysis Engine
- ✅ Trading Signals Management
- ✅ Docker support
- ✅ Render deployment guide

## Folder Structure

```
F:\SMEERP\
├── AP\                          (Your existing ERP)
└── ICT-Trading\                 (New trading system)
    ├── backend/                 (Node.js API)
    │   ├── src/
    │   │   ├── services/       (ICT + Claude)
    │   │   └── routes/         (API endpoints)
    │   ├── prisma/             (Database schema)
    │   └── server.js           (Express app)
    │
    ├── dashboard/              (React app)
    │   ├── src/
    │   │   ├── components/
    │   │   ├── pages/
    │   │   └── store/
    │   └── vite.config.js
    │
    ├── docs/
    │   └── DEPLOYMENT.md        (Render guide)
    │
    ├── docker-compose.yml       (Local dev)
    └── README.md
```

## Option 1: Run Locally (Recommended for Development)

### Requirements
- Node.js 20+ LTS
- PostgreSQL 14+
- Claude API Key

### Setup (5 minutes)

#### Backend
```bash
cd backend
npm install

# Create .env
cp .env.example .env

# Edit .env:
# - DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ict_trading
# - ANTHROPIC_API_KEY=sk-ant-YOUR_KEY

# Run migrations and start
npx prisma migrate deploy
npm run dev
```

Backend will run on `http://localhost:3000`

#### Frontend
```bash
cd dashboard
npm install

# Copy .env (optional, it defaults to localhost:3000)
cp .env.example .env

# Start dev server
npm run dev
```

Frontend will run on `http://localhost:5173`

#### Access Dashboard
Open: **http://localhost:5173**

---

## Option 2: Docker (Recommended for Testing)

### Requirements
- Docker & Docker Compose
- Claude API Key

### Setup (3 minutes)

```bash
# From ICT-Trading root
docker-compose up -d
```

This starts:
- PostgreSQL on `localhost:5432`
- Backend API on `localhost:3000`
- (Run frontend separately with `cd dashboard && npm run dev`)

---

## Option 3: Deploy to Render (Production)

See **[DEPLOYMENT.md](./docs/DEPLOYMENT.md)** for step-by-step guide

**Cost**: ~$14/month + Claude API fees

---

## Using the Dashboard

### 1. Upload Market Data

```
CSV Format:
timestamp,open,high,low,close,volume
2024-02-17T00:00:00Z,1.0850,1.0860,1.0840,1.0855,1000000
2024-02-17T04:00:00Z,1.0855,1.0875,1.0850,1.0870,1100000
```

- Click **Upload Data**
- Paste your CSV data
- Click **Upload Data** button

### 2. Run Analysis

- Select **Symbol** (e.g., EURUSD)
- Select **Timeframe** (1H, 4H, D, W)
- Click **Run Analysis**

### 3. View Results

Dashboard shows:
- **Chart**: Candlestick visualization
- **Active Signals**: Buy/Sell recommendations with entry/exit levels
- **Claude Analysis**: AI-powered detailed market analysis
- **ICT Concepts**: Order blocks, liquidity levels, FVGs, MSS

---

## Current Implementation Status

### ✅ Completed (Phase 1)
- [x] Project folder structure
- [x] Backend server setup
- [x] Database schema (Prisma)
- [x] ICT analysis algorithms (order blocks, liquidity, FVGs, MSS)
- [x] Claude API integration
- [x] API endpoints (market data, analysis, signals)
- [x] React dashboard with basic components
- [x] Docker & deployment guides
- [x] Documentation

### 📋 Next Steps (Phase 2-5)

**Phase 2: Backend Enhancement**
- [ ] Implement upload CSV file handling (drag & drop)
- [ ] Add more ICT concepts (breaker blocks, mitigation blocks, CISD)
- [ ] Optimize query performance

**Phase 3: Algorithm Refinement** (Collaborative)
- [ ] Test order block detection on historical data
- [ ] Refine liquidity level identification
- [ ] Define entry/exit rules based on your trading style
- [ ] Adjust confidence scoring

**Phase 4: Frontend Enhancement**
- [ ] Add chart overlays for ICT markers (order blocks, FVGs)
- [ ] Improve signal visualization
- [ ] Add analysis history page
- [ ] Multi-symbol watchlist

**Phase 5: Deployment & Testing**
- [ ] Deploy to Render (your 4 customers if needed)
- [ ] Load test with real market data
- [ ] Monitor performance
- [ ] Gather user feedback

---

## Next: Define Entry/Exit Algorithm

Currently we have basic ICT concept detection. To make it production-ready, we need to:

1. **Define Your Trading Rules**:
   - When is an order block valid?
   - How do you confirm order block with FVG?
   - What's your entry trigger?
   - What's your stop loss placement?
   - What's your profit target?

2. **Example Algorithm**:
   ```
   IF order_block EXIST (bullish)
     AND liquidity_level_sweep OCCUR
     AND FVG_present BELOW price
     AND MSS_confirmed (bullish)
   THEN
     Entry = Order block low
     SL = Support below
     TP = Next liquidity high
     Confidence = HIGH
   ```

3. **Let me know your specific rules**, and I'll implement them!

---

## API Testing with Curl

### Upload Market Data
```bash
curl -X POST http://localhost:3000/api/market-data/upload \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "EURUSD",
    "timeframe": "4H",
    "data": [
      {
        "timestamp": "2024-02-17T00:00:00Z",
        "open": 1.0850,
        "high": 1.0860,
        "low": 1.0840,
        "close": 1.0855,
        "volume": 1000000
      }
    ]
  }'
```

### Run Analysis
```bash
curl -X POST http://localhost:3000/api/analysis/run \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "EURUSD",
    "timeframe": "4H",
    "lookbackPeriods": 100
  }'
```

### Get Active Signals
```bash
curl http://localhost:3000/api/signals/active
```

---

## Troubleshooting

**Backend won't start**
- Check PostgreSQL is running
- Verify DATABASE_URL in .env
- Check ANTHROPIC_API_KEY is set

**Frontend won't connect**
- Check backend is running on :3000
- Check VITE_API_URL is correct
- Check CORS error in browser console

**Claude API errors**
- Verify API key is correct
- Check account has credits
- Review error message in logs

**Database errors**
- Run migrations: `npx prisma migrate deploy`
- Check database credentials
- View data: `npx prisma studio`

---

## What to Do Now

### Option A: Run Locally & Test
```bash
# Terminal 1: Backend
cd backend && npm install && npm run dev

# Terminal 2: Frontend
cd dashboard && npm install && npm run dev

# Terminal 3: Upload test data and run analysis
```

### Option B: Deploy to Render
Follow **[DEPLOYMENT.md](./docs/DEPLOYMENT.md)**

### Option C: Define Your Trading Algorithm
Provide your specific entry/exit rules so I can implement them!

---

## Files You Can Edit

- **Backend Logic**: `backend/src/services/ict.service.js`
- **Claude Prompt**: `backend/src/services/claude.service.js`
- **API Endpoints**: `backend/src/routes/*.js`
- **Dashboard UI**: `dashboard/src/components/*.jsx`
- **Database Schema**: `backend/prisma/schema.prisma`

---

## Need Help?

1. Check error logs in console
2. Review API response in browser DevTools
3. Check database with: `npx prisma studio`
4. Review Render logs if deployed

---

**Next Phase Awaits Your Input! 🚀**

What would you like to do first?
1. Run it locally and test?
2. Deploy to Render?
3. Refine the ICT algorithm with your trading rules?
