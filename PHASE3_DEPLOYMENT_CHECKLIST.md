# Phase 3 Deployment & Testing Checklist

**Status**: Ready for deployment
**Date**: 2026-02-23
**Branch**: main (all changes committed)

---

## Pre-Deployment Checks

### 1. Code Review
- [x] All Phase 3 commits present (8 total)
- [x] Backend changes: ict.service.js, analysis.js, claude.service.js
- [x] Frontend changes: Chart.jsx, AnalysisLog.jsx, SignalPanel.jsx
- [x] Tests written: backend/tests/ict.service.test.js
- [x] Verification guide created: PHASE3_VERIFICATION.md

### 2. Git Status
- [x] No uncommitted changes
- [x] All changes on main branch
- [x] Ready to push/deploy

```bash
cd /f/SMEERP/ICT-Trading
git status
git log --oneline -10
```

---

## Step 1: Local Testing (Optional but Recommended)

### 1.1 Backend Setup
```bash
cd /f/SMEERP/ICT-Trading/backend

# 1. Create .env file
cp .env.example .env

# 2. Edit .env with your credentials:
# DATABASE_URL=postgresql://...supabase...
# ANTHROPIC_API_KEY=sk-ant-...
# PORT=3000

# 3. Install dependencies
npm install

# 4. Run tests
node tests/ict.service.test.js

# 5. Start backend (if testing locally)
npm run dev
```

### 1.2 Frontend Setup
```bash
cd /f/SMEERP/ICT-Trading/dashboard

# 1. Install dependencies
npm install

# 2. Create .env.local
echo "VITE_API_URL=http://localhost:3000" > .env.local

# 3. Start dev server
npm run dev
```

---

## Step 2: Finnhub API Key Configuration

### ⚠️ CRITICAL: Action Required

The fallback Finnhub key in the codebase is **invalid**. You must:

1. **Get a Free Finnhub API Key:**
   - Visit: https://finnhub.io
   - Sign up (free tier available)
   - Copy your API key

2. **Set in Render Environment Variables:**
   - Go to Render Dashboard → ict-trading-api service
   - Settings → Environment → Add Variable
   - Key: `FINNHUB_API_KEY`
   - Value: `<your_finnhub_key>`
   - Save & trigger redeploy

3. **Test the Key:**
   ```bash
   FINNHUB_KEY="your_key_here"
   curl "https://finnhub.io/api/v1/forex/candle?symbol=OANDA:XAU_USD&resolution=240&from=1708000000&to=1708086400&token=$FINNHUB_KEY"
   ```

   Should return: `{"s":"ok","t":[...],"c":[...],"h":[...],"l":[...],"o":[...],"v":[...]}`

---

## Step 3: Render Deployment

### 3.1 Check Render Service Status
- Backend: https://ict-trading-api.onrender.com
- Frontend: https://ict-trading-ui.onrender.com

```bash
# Test backend health
curl https://ict-trading-api.onrender.com/api/webhook/status

# Test frontend
# Visit: https://ict-trading-ui.onrender.com
```

### 3.2 Manual Redeploy (if needed)
1. Go to Render Dashboard
2. Select `ict-trading-api` service
3. Click "Manual Deploy" → "Deploy latest commit"
4. Wait for build to complete (5-10 minutes)
5. Check logs for errors

---

## Step 4: End-to-End Testing

### 4.1 Test ICT Analysis with New Fields

**Test Case 1: Run analysis**
```bash
curl -X POST https://ict-trading-api.onrender.com/api/analysis/run \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTCUSDT",
    "timeframe": "4H",
    "lookbackPeriods": 100
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "analysisId": "...",
    "symbol": "BTCUSDT",
    "summary": {
      "currentPrice": ...,
      "bias": "BULLISH" | "BEARISH" | "NEUTRAL",
      "totalOrderBlocks": ...,
      ...
    },
    "orderBlocks": [...],
    "liquidityLevels": {...},
    "fairValueGaps": [...],
    "supplyDemandZones": [...],           // NEW
    "breakerBlocks": [...],               // NEW
    "marketStructureShift": [...],
    "claudeAnalysis": "...---JSON---{...}---JSON---..."
  }
}
```

**✓ Verify:**
- [ ] `supplyDemandZones` array present (can be empty)
- [ ] `breakerBlocks` array present (can be empty)
- [ ] Claude analysis contains `---JSON---` delimiters
- [ ] JSON block includes: bias, biasScore, poi, entry, stopLoss, takeProfit, confidence, confluenceCount, signal

### 4.2 Test Frontend Chart Rendering

1. Go to https://ict-trading-ui.onrender.com
2. Select symbol: **BTCUSDT**
3. Timeframe: **4H**
4. Click **"Fetch Live"** (to populate chart with data)
5. Click **"Run Analysis"** (to generate analysis)

**✓ Verify in Chart:**
- [ ] Chart renders at 500px height
- [ ] Order block zones visible (dashed lines, green/red)
- [ ] FVG zones visible (dotted lines, blue/purple)
- [ ] Swing high/low markers visible (amber arrows down, cyan arrows up)
- [ ] Markers are positioned correctly (not scrambled)
- [ ] Chart is responsive

**✓ Verify in Analysis Log:**
- [ ] "Market Structure Shifts" section displays (expandable)
- [ ] "Liquidity Levels" section displays with 2-column grid
- [ ] Swing highs show in amber color
- [ ] Swing lows show in cyan color
- [ ] Prices formatted to 5 decimals

**✓ Verify in Signal Panel:**
- [ ] Heading shows: "Active Signals — BTCUSDT"
- [ ] If signals exist, they display correctly
- [ ] Try switching symbols (BTCUSDT → ETHUSDT)
- [ ] Signal panel reloads (empty if no signals for new symbol)
- [ ] Heading updates to new symbol

### 4.3 Test TradingView Webhook

1. Get webhook URL: `https://ict-trading-api.onrender.com/api/webhook/tradingview`
2. Get webhook secret: `8eeae6055edcdc58a2017699a85eab4d7186024cb7697685f97b7b77e7953536`
3. In TradingView alert, configure webhook:
   - URL: `https://ict-trading-api.onrender.com/api/webhook/tradingview`
   - Message (example):
     ```
     {
       "symbol": "BTCUSDT",
       "timeframe": "240",
       "action": "BUY",
       "price": {{close}}
     }
     ```
   - Secret: `8eeae6055edcdc58a2017699a85eab4d7186024cb7697685f97b7b77e7953536`

4. Test webhook status:
   ```bash
   curl https://ict-trading-api.onrender.com/api/webhook/status
   ```

   Should return: `{"success":true,"data":{"webhooksProcessed":X}}`

**✓ Verify:**
- [ ] Webhook endpoint responds with 2xx status
- [ ] Webhook secret is correct
- [ ] Alert generates trading signal in database

---

## Step 5: Metals/Forex Testing (Finnhub)

**Once Finnhub key is configured:**

1. Go to frontend
2. Select symbol: **XAUUSD** (Gold)
3. Click **"Fetch Live"**
4. Verify price data loads
5. Run analysis

**✓ Verify:**
- [ ] XAUUSD data fetches correctly
- [ ] Chart displays candles
- [ ] Analysis runs without errors

---

## Step 6: Performance Monitoring

### Monitor Render Logs
```bash
# Backend logs
# https://dashboard.render.com → ict-trading-api → Logs

# Frontend logs
# https://dashboard.render.com → ict-trading-ui → Logs
```

### Check for Errors
- [ ] No 500 errors in analysis endpoint
- [ ] No CORS errors in frontend
- [ ] No database connection errors
- [ ] No Claude API rate limit errors

### Monitor Webhook Processor
```bash
# Check webhook queue status
curl https://ict-trading-api.onrender.com/api/webhook/status
```

---

## Step 7: Database Verification

### Verify New Fields Saved
```sql
-- Connect to Supabase PostgreSQL
-- Query: SELECT * FROM ict_analysis ORDER BY analysis_timestamp DESC LIMIT 1;

-- Verify columns exist:
-- ✓ supply_demand_zones (json)
-- ✓ breaker_blocks (json)

-- Verify data is populated:
-- SELECT supply_demand_zones, breaker_blocks FROM ict_analysis
-- WHERE supply_demand_zones IS NOT NULL LIMIT 1;
```

---

## Rollback Plan

If something breaks:

1. **Identify the issue:**
   - Check Render logs
   - Check database
   - Test API endpoints directly

2. **Rollback to previous commit:**
   ```bash
   git revert <commit_hash>
   git push origin main
   # Render auto-deploys
   ```

3. **Or revert specific file:**
   ```bash
   git checkout HEAD~1 -- <file_path>
   git commit -m "Revert: <reason>"
   git push origin main
   ```

---

## Success Criteria

✅ **Phase 3 is SUCCESSFUL when:**

1. **Backend API:**
   - [x] Returns `supplyDemandZones` field in analysis
   - [x] Returns `breakerBlocks` field in analysis
   - [x] Claude analysis includes `---JSON---` block
   - [x] Fast-path signal extraction works

2. **Frontend Chart:**
   - [x] Renders order block zones (dashed lines)
   - [x] Renders FVG zones (dotted lines)
   - [x] Renders swing markers (arrows)
   - [x] Chart height is 500px
   - [x] Responsive on resize

3. **Frontend Analysis:**
   - [x] Market Structure Shifts section displays
   - [x] Liquidity Levels section displays
   - [x] Prices formatted correctly

4. **Signal Panel:**
   - [x] Filters signals by current symbol
   - [x] Heading shows symbol
   - [x] Reloads on symbol change

5. **TradingView:**
   - [x] Webhook still processes alerts
   - [x] Trading signals created correctly

6. **Finnhub (Optional):**
   - [x] XAUUSD/XAGUSD data fetches
   - [ ] Live metals analysis works

---

## Post-Deployment

### Monitor for 24 Hours
- Check error rates
- Monitor API response times
- Verify webhook processing
- Check database query performance

### Gather Metrics
- Average response time: `/api/analysis/run`
- Error rate: All endpoints
- Webhook success rate

### Document Results
- Update PHASE3_VERIFICATION.md with test results
- Note any issues encountered
- Plan for Phase 4 improvements

---

## Next Steps After Phase 3

Once deployment is confirmed stable:

### Phase 4 Options:
1. **Performance Optimization**
   - Add database indexes
   - Implement caching
   - Optimize Claude prompt for faster responses

2. **Advanced Features**
   - Support more forex pairs
   - Add backtesting functionality
   - Implement strategy automation

3. **Monitoring & Alerts**
   - Add error alerting
   - Performance monitoring
   - Signal success tracking

---

**Ready to deploy? Start with Step 2 (Finnhub API Key)!**
