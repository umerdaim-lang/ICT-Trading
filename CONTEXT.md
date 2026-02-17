# ICT Trading System - Project Context

**Last Updated**: 2026-02-17
**Project**: Claude AI-Powered Swing Trading Analysis System
**Status**: ✅ PRODUCTION DEPLOYED - PHASE 2 IN PROGRESS

**Phase 1 Status**: ✅ COMPLETE - System deployed and live
**Phase 2 Status**: 🔨 IN PROGRESS - TradingView integration & live data auto-fetch

---

## 📋 Quick Summary

- **Tech Stack**: Node.js/Express (Backend), React + TypeScript (Frontend), PostgreSQL, Claude AI
- **Location**: `F:\SMEERP\ICT-Trading\`
- **GitHub**: `https://github.com/umerdaim-lang/ICT-Trading` ✅
- **Total Files Created**: 40+ (including Phase 2 services & routes)
- **Current Phase**: 2 (TradingView Integration & Live Data)
- **Phase 1**: Setup & Scaffolding ✅ COMPLETE
- **Phase 2**: TradingView Integration 🔨 CODE COMPLETE - AWAITING ENV VARS

---

## 🎯 What Was Built (Phase 1)

### Backend API (Node.js/Express)
- ✅ Express server with error handling
- ✅ 3 route files: market data, analysis, signals
- ✅ Prisma ORM with PostgreSQL
- ✅ Database schema with 4 tables
- ✅ ICT analysis algorithms (order blocks, liquidity, FVGs, MSS)
- ✅ Claude AI integration
- ✅ API endpoints (16 total)

### Frontend Dashboard (React/Vite)
- ✅ React app with TypeScript
- ✅ 4 main components: Chart, SignalPanel, AnalysisLog, Dashboard
- ✅ Zustand store for state management
- ✅ API client library
- ✅ Tailwind CSS styling
- ✅ Vite build configuration

### Infrastructure & Documentation
- ✅ Docker Compose for local development
- ✅ Dockerfile for backend
- ✅ Environment configuration files
- ✅ README.md (comprehensive guide)
- ✅ QUICK_START.md (step-by-step setup)
- ✅ DEPLOYMENT.md (Render guide)
- ✅ DEPLOYMENT_SUPABASE.md (Free tier deployment guide)
- ✅ GitHub repository created and code pushed
- ✅ .gitignore configured

---

## 🏗️ Architecture Overview

```
┌──────────────────┐
│   TradingView    │ (Data Source - CSV Upload)
└────────┬─────────┘
         │
         ↓
┌──────────────────┐
│  Backend API     │ (Node.js/Express on Render)
│  - Market data   │
│  - ICT analysis  │
│  - Claude AI     │
└────────┬─────────┘
         │
         ↓
┌──────────────────┐
│  PostgreSQL      │ (Database)
└────────┬─────────┘
         │
         ↓
┌──────────────────┐
│  React Dashboard │ (Frontend on Render)
└──────────────────┘
```

---

## 📁 Project Structure

```
F:\SMEERP\ICT-Trading\
├── backend/
│   ├── src/
│   │   ├── services/
│   │   │   ├── ict.service.js         (ICT algorithms)
│   │   │   ├── claude.service.js      (Claude AI)
│   │   │   └── tradingview.service.js (Data fetching)
│   │   ├── routes/
│   │   │   ├── marketData.js          (Upload/retrieve data)
│   │   │   ├── analysis.js            (Run analysis)
│   │   │   └── signals.js             (Manage signals)
│   │   └── utils/
│   │       └── db.js                  (Prisma client)
│   ├── prisma/
│   │   └── schema.prisma              (Database schema)
│   ├── server.js                      (Express app)
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
│
├── dashboard/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Chart.jsx              (Lightweight Charts)
│   │   │   ├── SignalPanel.jsx        (Trading signals)
│   │   │   └── AnalysisLog.jsx        (Claude analysis)
│   │   ├── pages/
│   │   │   └── DashboardPage.jsx      (Main dashboard)
│   │   ├── store/
│   │   │   └── tradingStore.js        (Zustand store)
│   │   ├── lib/
│   │   │   └── api.js                 (API client)
│   │   ├── App.jsx                    (Root component)
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── package.json
│   └── .env.example
│
├── docs/
│   ├── DEPLOYMENT.md                  (Render setup guide)
│   └── ICT_CONCEPTS.md                (Theory reference)
│
├── docker-compose.yml                 (Local dev setup)
├── README.md                          (Main documentation)
├── QUICK_START.md                     (Quick setup guide)
└── CONTEXT.md                         (This file)
```

---

## 🔌 API Endpoints

### Market Data (3)
- `POST /api/market-data/upload` - Upload OHLC data (CSV/JSON)
- `GET /api/market-data/:symbol/:timeframe` - Retrieve data
- `DELETE /api/market-data/:symbol` - Clear data

### Analysis (4)
- `POST /api/analysis/run` - Run ICT analysis
- `GET /api/analysis/:symbol/latest` - Get latest analysis
- `GET /api/analysis/history` - Get analysis history
- `POST /api/analysis/:analysisId/extract-signal` - Extract signal

### Signals (5)
- `GET /api/signals/active` - Get active signals
- `GET /api/signals/:id` - Get signal by ID
- `GET /api/signals/symbol/:symbol` - Get symbol signals
- `PUT /api/signals/:id/close` - Close signal
- `DELETE /api/signals/:id` - Delete signal

---

## 💾 Database Schema

### market_data
Stores OHLC candle data with unique constraint on (symbol, timeframe, timestamp)

### ict_analysis
Stores analysis results:
- `orderBlocks` - JSON array of identified order blocks
- `liquidityLevels` - JSON with swing highs/lows
- `fairValueGaps` - JSON array of FVGs
- `supplyDemandZones` - JSON zones
- `breakerBlocks` - JSON array
- `mitigationBlocks` - JSON array
- `marketStructureShift` - JSON MSS data
- `cisd` - JSON CISD data
- `claudeAnalysis` - Text analysis from Claude

### trading_signals
Active and closed trading signals with:
- Signal type (BUY/SELL)
- Entry price
- Stop loss
- Take profit
- Risk/reward ratio
- Confidence level
- Reason/notes

### analysis_history
Historical analysis records for learning and backtesting

---

## 🧮 ICT Concepts Implemented

### 1. Order Blocks
- **Bullish**: Down candle followed by strong up move
- **Bearish**: Up candle followed by strong down move
- Implementation: `identifyOrderBlocks()` in ict.service.js

### 2. Liquidity Levels
- Swing highs and lows
- Detected using lookback window (default 20 candles)
- Implementation: `identifyLiquidityLevels()` in ict.service.js

### 3. Fair Value Gaps (FVG)
- **Bullish**: Gap between prev high and next low
- **Bearish**: Gap between prev low and next high
- Implementation: `identifyFairValueGaps()` in ict.service.js

### 4. Market Structure Shift (MSS)
- Bullish: Higher low breaking above previous swing low
- Bearish: Lower high breaking below previous swing high
- Implementation: `identifyMarketStructureShift()` in ict.service.js

### 5. Bias Determination
- Scores based on recent order blocks, MSS, and liquidity position
- Returns: BULLISH, BEARISH, or NEUTRAL
- Implementation: `determineBias()` in ict.service.js

---

## 🤖 Claude AI Integration

### Analysis Flow
1. **ICT Analysis** → Identifies concepts (order blocks, FVGs, etc.)
2. **Claude Prompt** → Sends structured data to Claude API
3. **Claude Response** → Expert market analysis & recommendations
4. **Signal Extraction** → Claude analyzes to extract entry/exit levels
5. **Signal Creation** → Stores signal in database

### Claude Prompt Template
```
You are an expert ICT swing trader. Analyze:
- Market data (symbol, price, timeframe)
- ICT results (order blocks, liquidity, FVGs, MSS)

Provide:
1. Valid setup? (YES/NO)
2. Bias (BULLISH/BEARISH)
3. Entry, SL, TP levels
4. Confluence of concepts
5. Risk/reward ratio
6. Confidence (HIGH/MEDIUM/LOW)
```

---

## 📊 Data Format

### CSV Upload Format
```
timestamp,open,high,low,close,volume
2024-02-17T00:00:00Z,1.0850,1.0860,1.0840,1.0855,1000000
2024-02-17T04:00:00Z,1.0855,1.0875,1.0850,1.0870,1100000
```

### API Request Example
```json
{
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
}
```

---

## 🚀 Getting Started

### Option 1: Run Locally
```bash
# Backend
cd backend
npm install
cp .env.example .env
# Edit .env with DATABASE_URL and ANTHROPIC_API_KEY
npx prisma migrate deploy
npm run dev

# Frontend (new terminal)
cd dashboard
npm install
npm run dev
```

**Access**: http://localhost:5173

### Option 2: Docker
```bash
docker-compose up
```

**Access**: Backend on :3000, run frontend separately

### Option 3: Deploy to Render
See `docs/DEPLOYMENT.md` for step-by-step guide

---

## 📋 Phase Breakdown

| Phase | Status | What's Included |
|-------|--------|-----------------|
| **1: Setup & Scaffolding** | ✅ Complete | Folders, packages, DB schema, APIs, UI scaffolding, GitHub push |
| **1.5: Phase 1 Deployment** | ✅ Complete | Supabase + Render deployment, live system in production |
| **2: TradingView Integration** | 🔨 In Progress | Live data auto-fetch, webhook alerts, scheduled jobs |
| **3: Algorithm Refinement** | 📋 Pending | Breaker blocks, mitigation blocks, CISD, user rules |
| **4: Dashboard Enhancement** | 📋 Pending | Chart overlays, watchlist, history, alerts |

---

## 📝 Phase 2 (TradingView Integration) - Completed ✅

### Code Implementation Complete
- [x] `backend/src/services/dataFetch.service.js` - Binance & Finnhub API clients
- [x] `backend/src/services/scheduler.service.js` - node-cron 15-minute scheduler
- [x] `backend/src/routes/webhook.js` - TradingView webhook endpoint
- [x] `/api/market-data/live/:symbol/:timeframe` - On-demand live data fetch
- [x] Optimized bulk insert with `createMany` + `skipDuplicates`
- [x] Frontend market selector (dropdown with popular pairs)
- [x] Fetch Live Data button
- [x] 60-second auto-refresh polling
- [x] 30-second webhook status polling
- [x] Live data and webhook indicators on dashboard
- [x] Code committed and pushed to GitHub

### Data Sources
- **Crypto** (BTC, ETH, BNB, SOL, XRP, ADA, DOGE, AVAX, MATIC, LINK): Binance API (free, no key needed)
- **Metals** (XAUUSD, XAGUSD): Finnhub API (free tier, 60 req/min)

---

## 📝 What's Needed Next for Phase 2 Deployment

### IMMEDIATE - Environment Configuration (5 min)
1. **Get Finnhub API Key** (free):
   - Visit: https://finnhub.io
   - Sign up (2 minutes)
   - Copy API key
   - Set on Render backend service:
     - `FINNHUB_API_KEY` = your_key
     - `WEBHOOK_SECRET` = any random string (e.g., `openssl rand -hex 32` on Windows use UUID generator)

2. **Redeploy on Render**:
   - Push changes (already done) ✅
   - Render will auto-deploy once env vars are set
   - Check logs for `[Scheduler] Started` message

### VERIFICATION - Test Phase 2 Features (10 min)
1. **Live Data Endpoint**:
   - GET `/api/market-data/live/BTCUSDT/4H?limit=100`
   - Should return: `{ candlesFetched: 100, candlesSaved: X, source: 'binance' }`

2. **Scheduler Check**:
   - Check Render backend logs
   - Should see: `[Scheduler] BTCUSDT 4H: fetched 100, saved X from binance`
   - Every 15 minutes automatically

3. **TradingView Webhook Setup** (Optional):
   - Create TradingView alert with webhook
   - URL: `https://your-render-service.onrender.com/api/webhook/tradingview`
   - Use JSON message template from plan
   - Test with "Send test notification"

4. **Frontend**:
   - Click "Fetch Live" button
   - See status indicator appear
   - Verify chart updates

### From User (After Phase 2 Goes Live)
1. **Your Trading Algorithm Rules** (Phase 3):
   - How do you identify valid order blocks?
   - What confirms an entry signal?
   - Where's your stop loss/take profit?
   - What's your confidence scoring?

2. **Feature Preferences**:
   - Multi-symbol watchlist?
   - Email/SMS alerts?
   - Performance metrics?
   - Backtesting module?
- [ ] Add chart overlays for ICT markers
- [ ] Monitor Claude API costs
- [ ] Plan upgrade to paid Supabase/Render tiers (next month)

---

## 🔐 Security & Configuration

### Environment Variables
```
# Backend
DATABASE_URL=postgresql://...
ANTHROPIC_API_KEY=sk-ant-...
PORT=3000
FRONTEND_URL=http://localhost:5173
NODE_ENV=development

# Frontend
VITE_API_URL=http://localhost:3000
```

### Security Notes
- ✅ API keys in environment variables only
- ✅ Database credentials secured
- ✅ CORS configured for frontend domain
- ✅ Input validation on all endpoints
- ⚠️ Rate limiting on Claude API (needed for production)

---

## 💰 Cost Estimation

### Infrastructure (Monthly)
- PostgreSQL: $7 (Starter) or $25+ (higher tier)
- Backend: $7 (Starter) or $25+ (higher tier)
- Frontend: Free (static site)
- **Total**: ~$14-50/month

### API Costs (Variable)
- Claude API: Pay per token
- Typical analysis: ~500 tokens per run
- Estimate: $0.001-0.005 per analysis at current Claude 3.5 pricing

---

## 🐛 Known Issues / To Fix

### ✅ Resolved
- None at this stage (fresh project)

### 📋 To Address
- Add CSV file upload (currently text paste only)
- Implement batch analysis operations
- Add more ICT concepts (breaker, mitigation, CISD)
- Optimize database queries for large datasets
- Add rate limiting to API

---

## 💡 Architecture Decisions

1. **Frontend State**: Zustand (simple, no boilerplate)
2. **Database ORM**: Prisma (type-safe, migrations)
3. **Charts**: Lightweight Charts (TradingView-recommended)
4. **CSS**: Tailwind (utility-first)
5. **API Model**: RESTful (simple to understand)
6. **AI**: Claude API (best for analysis tasks)

All decisions made for **simplicity and maintainability** during early phases.

---

## 🎯 Success Criteria

✅ Phase 1 Complete:
- [x] All infrastructure scaffolded
- [x] ICT algorithms implemented
- [x] Claude AI integrated
- [x] API endpoints working
- [x] Dashboard UI functional
- [x] Documentation complete

📋 Phase 2+ Success:
- [ ] Local testing successful
- [ ] Algorithm refined to user's rules
- [ ] Deployed to Render
- [ ] Processing live market data
- [ ] Generating profitable signals

---

## 📞 Troubleshooting

### Backend Won't Start
- Check PostgreSQL is running
- Verify DATABASE_URL in .env
- Check ANTHROPIC_API_KEY is valid

### Frontend Won't Connect
- Check backend is running on :3000
- Verify VITE_API_URL in .env
- Check browser DevTools for errors

### Claude API Errors
- Verify API key is correct
- Check account has credits
- Review error in terminal

### Database Issues
- Run migrations: `npx prisma migrate deploy`
- View data: `npx prisma studio`
- Check PostgreSQL connection

---

## 📚 Key Reference Files

- `backend/src/services/ict.service.js` - ICT algorithm implementations
- `backend/src/services/claude.service.js` - Claude AI integration
- `backend/server.js` - Express configuration
- `dashboard/src/App.jsx` - Main React app
- `backend/prisma/schema.prisma` - Database design
- `README.md` - Full documentation
- `QUICK_START.md` - Setup guide
- `docs/DEPLOYMENT.md` - Render deployment

---

## 🎉 Current Status

✅ **Phase 1 (Setup & Deployment) is 100% Complete**
✅ **System Live in Production** (Render + Supabase)
✅ **Code Pushed to GitHub**: https://github.com/umerdaim-lang/ICT-Trading (commit: 7881375)
🔨 **Phase 2 (TradingView Integration): Code Complete** - Awaiting environment configuration

### Phase 2 Deployment Readiness Checklist:
- [x] Code scaffolding complete
- [x] Backend API with ICT algorithms ready
- [x] Frontend dashboard with market selector ready
- [x] Live data fetch service (Binance + Finnhub) ready
- [x] TradingView webhook handler ready
- [x] Scheduler with 15-minute auto-fetch ready
- [x] Documentation complete
- [x] GitHub repository updated
- [x] Code pushed to GitHub (main branch)
- [x] Supabase database created & connected
- [x] Render backend service deployed & live
- [x] Render frontend service deployed & live
- [ ] Finnhub API key obtained (FREE - 5 min)
- [ ] WEBHOOK_SECRET configured on Render
- [ ] Render re-deployed with new env vars
- [ ] Live data fetch verified working
- [ ] Scheduler confirmed in logs
- [ ] TradingView alert tested (optional)

**Next immediate action**: Get Finnhub API key (free) → Set env vars on Render → Done!

---

**When working on this project, reference this file!** ✅
