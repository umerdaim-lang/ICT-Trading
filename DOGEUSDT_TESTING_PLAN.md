# DOGEUSDT Testing Plan - Phase 3 Verification

**Date**: 2026-02-23
**Symbol**: DOGEUSDT (Dogecoin)
**Timeframe**: 4H (4-hour candles)
**Status**: 🟢 Services Live & Deployed

---

## 🚀 Quick Start Testing

### Step 1: Open Frontend
```
URL: https://ict-trading-ui.onrender.com
```

### Step 2: Select DOGEUSDT Symbol
1. Look for **Market Selector** dropdown
2. Select: **DOGEUSDT**
3. Timeframe: **4H** (default)

### Step 3: Fetch Live Data
1. Click **"Fetch Live"** button
2. Wait for data to load (30-60 seconds)
3. Verify chart displays candles

### Step 4: Run ICT Analysis
1. Click **"Run Analysis"** button
2. Backend will:
   - Calculate Order Blocks
   - Identify Liquidity Levels
   - Find Fair Value Gaps
   - Detect Supply/Demand Zones ✅ NEW
   - Identify Breaker Blocks ✅ NEW
   - Run Claude AI analysis
   - Generate trading signals

### Step 5: Verify Phase 3 Features

---

## ✅ Verification Checklist

### A. Chart Visualization

**Order Blocks (Dashed Lines)**
- [ ] Green dashed lines visible (bullish order blocks)
- [ ] Red dashed lines visible (bearish order blocks)
- [ ] Lines appear at correct price levels
- [ ] Up to 8 most recent blocks shown

**Fair Value Gaps (Dotted Lines)**
- [ ] Blue dotted lines visible (bullish FVGs)
- [ ] Purple dotted lines visible (bearish FVGs)
- [ ] Two lines per gap (top + bottom)
- [ ] Up to 6 most recent gaps shown

**Swing High/Low Markers (Arrows)**
- [ ] Amber arrows pointing DOWN visible (swing highs - SH)
- [ ] Cyan arrows pointing UP visible (swing lows - SL)
- [ ] Markers positioned correctly on chart
- [ ] Up to 5 of each shown

**Chart Height & Responsiveness**
- [ ] Chart is 500px tall (not 400px)
- [ ] Chart resizes on window resize
- [ ] No overlapping elements

---

### B. Analysis Sections

**Summary Section**
- [ ] Current Price displays correctly
- [ ] Bias shows (BULLISH/BEARISH/NEUTRAL)
- [ ] Total counts for blocks, levels, gaps display

**Order Blocks Section**
- [ ] Expands/collapses (click title)
- [ ] Shows last 5 blocks
- [ ] Type badge (BULLISH/BEARISH) shows correct color
- [ ] High/Low prices display (5 decimals)

**Fair Value Gaps Section**
- [ ] Shows last 3 FVGs
- [ ] Top and bottom prices display
- [ ] Gap size shows

**Market Structure Shifts (MSS) - NEW ✅**
- [ ] Section visible and expands/collapses
- [ ] Shows last 4 MSS events
- [ ] Type badge shows (BULLISH/BEARISH)
- [ ] Break level displays correctly
- [ ] Description shows

**Liquidity Levels - NEW ✅**
- [ ] Section visible with 2-column grid
- [ ] Left column: "Swing Highs (BSL)" header
- [ ] Right column: "Swing Lows (SSL)" header
- [ ] Swing highs show in amber color
- [ ] Swing lows show in cyan color
- [ ] Last 3 of each displayed
- [ ] Prices formatted to 5 decimals

**Claude Analysis Section**
- [ ] Full narrative text displays
- [ ] Contains "---JSON---" block
- [ ] JSON block has structured data:
  - [ ] bias (BULLISH/BEARISH/NEUTRAL)
  - [ ] biasScore (1-10)
  - [ ] priceContext (premium/discount/equilibrium)
  - [ ] poi (point of interest with type, high, low)
  - [ ] entry, stopLoss, takeProfit prices
  - [ ] confidence (HIGH/MEDIUM/LOW)
  - [ ] confluenceCount (number)
  - [ ] signal (BUY/SELL/null)
  - [ ] reason (text)

---

### C. Signal Panel

**Signal Display**
- [ ] Heading shows: "Active Signals — DOGEUSDT"
- [ ] If signals exist, they display with:
  - [ ] BUY or SELL type (colored correctly)
  - [ ] Entry price
  - [ ] Stop Loss price
  - [ ] Take Profit price
  - [ ] Risk/Reward ratio
  - [ ] Confidence level badge
  - [ ] Reason text
- [ ] "Close Signal" button present

**Symbol Filtering Test**
1. Note current signals count
2. Switch symbol to ETHUSDT
3. [ ] Signal panel reloads
4. [ ] Heading changes to "Active Signals — ETHUSDT"
5. [ ] Signal list updates (may be empty)
6. Switch back to DOGEUSDT
7. [ ] Original signals reappear
8. [ ] Heading shows "Active Signals — DOGEUSDT"

---

### D. Backend API Testing

**Test Analysis Endpoint**
```bash
curl -X POST https://ict-trading-api.onrender.com/api/analysis/run \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "DOGEUSDT",
    "timeframe": "4H",
    "lookbackPeriods": 100
  }'
```

**Expected Response Includes:**
- [ ] `supplyDemandZones` field (array)
- [ ] `breakerBlocks` field (array)
- [ ] `claudeAnalysis` with `---JSON---` block
- [ ] All other ICT analysis fields

**Supply/Demand Zones Example:**
```json
{
  "type": "supply" or "demand",
  "high": 0.425,
  "low": 0.420,
  "strength": 1.8
}
```

**Breaker Blocks Example:**
```json
{
  "type": "bullish_breaker" or "bearish_breaker",
  "high": 0.430,
  "low": 0.415,
  "originalTimestamp": "2026-02-20T...",
  "brokenAt": "2026-02-21T..."
}
```

---

### E. TradingView Integration

**Webhook Status**
```bash
curl https://ict-trading-api.onrender.com/api/webhook/status
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "webhooksProcessed": 0,
    "lastReceivedAt": null,
    "status": "waiting"
  }
}
```

---

## 📊 Test Data Points

### DOGEUSDT Typical Values
- **Current Price**: $0.42-0.44 (varies)
- **24H Range**: ~$0.40-0.45
- **Volatility**: Moderate
- **Available Data**: 100+ 4H candles

### Expected Analysis Results
- **Order Blocks**: 3-5 recent blocks
- **Liquidity Levels**: 2-4 swing highs/lows
- **FVGs**: 1-3 recent gaps
- **Supply/Demand**: 1-2 zones (if available)
- **Breaker Blocks**: 0-2 broken blocks
- **MSS**: 1-2 structure shifts

---

## 🎯 Success Criteria

✅ **Phase 3 Testing is SUCCESSFUL when:**

1. **Chart renders** all ICT visualizations (OBs, FVGs, markers)
2. **MSS section** displays with event details
3. **Liquidity section** shows swing highs/lows in correct colors
4. **Signals filter** by symbol correctly
5. **Claude analysis** includes structured JSON
6. **Supply/Demand zones** appear in API response
7. **Breaker blocks** appear in API response
8. **Backend API** returns 200 status with all fields

---

## 🐛 Troubleshooting

### Issue: Chart doesn't show overlays
**Solution:**
1. Check browser console for errors (F12)
2. Verify data loaded (check candles in chart)
3. Run analysis again
4. Hard refresh (Ctrl+Shift+R)

### Issue: MSS or Liquidity sections missing
**Solution:**
1. Analysis data may not have these features
2. Try different symbol (BTCUSDT usually has more)
3. Check Claude analysis for session context
4. Verify backend response includes fields

### Issue: Signal panel shows wrong symbol
**Solution:**
1. Click symbol dropdown again
2. Make sure symbol changes in heading
3. Check if signals exist for that symbol
4. Try switching symbols twice

### Issue: Backend returns 500 error
**Solution:**
1. Check Render logs (dashboard.render.com)
2. Verify database connection
3. Verify Claude API key set in env vars
4. Check error message in response

---

## 📋 Testing Workflow

```
1. Open Frontend
   ↓
2. Select DOGEUSDT
   ↓
3. Fetch Live Data (wait 30s)
   ↓
4. Run Analysis (wait 30s)
   ↓
5. Verify Chart Overlays
   ↓
6. Check Analysis Sections
   ↓
7. Test Symbol Filtering
   ↓
8. Test API Endpoint
   ↓
9. Verify All Checkboxes
   ↓
10. ✅ DONE!
```

---

## 📈 Test Results Log

**Date**: 2026-02-23
**Tester**: You
**Symbol**: DOGEUSDT
**Timeframe**: 4H

### Results

- [ ] Chart overlays: PASS / FAIL
- [ ] MSS section: PASS / FAIL
- [ ] Liquidity section: PASS / FAIL
- [ ] Signal filtering: PASS / FAIL
- [ ] API response: PASS / FAIL
- [ ] Claude JSON: PASS / FAIL

**Overall**: PASS / FAIL

---

## 🎬 Next Steps After Testing

If all tests PASS:
1. ✅ Phase 3 deployment successful
2. ✅ Ready for production use
3. Next: Monitor for 24 hours
4. Next: Plan Phase 4 features

If any test FAILS:
1. ❌ Note which test failed
2. Check error in browser console (F12)
3. Review API response
4. Provide details for debugging

---

**Last Updated**: 2026-02-23
**Status**: Ready to Test
**Services**: Live and Running
