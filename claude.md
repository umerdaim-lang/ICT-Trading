# Claude Code Guidelines for SMEERP Projects

## Project Overview

This repository contains **TWO SEPARATE PROJECTS** that must be kept completely isolated:

### 1. AutoPartsERP (AP) - Main ERP System
- **Location:** `F:\SMEERP\AP\`
- **Purpose:** Enterprise Resource Planning system for auto parts management
- **Status:** Deployed on Render (production)
- **Customers:** 4 customer instances deployed

### 2. ICT Trading - Swing Trading Analysis System
- **Location:** `F:\SMEERP\ICT-Trading\`
- **Purpose:** Claude AI powered swing trade signal generation using ICT concepts
- **Status:** Phase 2 complete - Live data integration working
- **Deployment:** Render backend + frontend

---

## CRITICAL GUIDELINES

### ⚠️ Project Context Separation
**RULE: Never mix contexts between AP and ICT-Trading projects**

When switching projects:
1. Read this `claude.md` file to refresh context
2. Check the project-specific `CONTEXT.md` file (if exists)
3. Review recent commits in the specific project
4. Always verify you're in the correct directory before making changes

### 🔐 API Keys & Secrets - NEVER Hardcode
**Store ALL sensitive data in environment variables only:**
- ❌ DO NOT hardcode API keys in source code
- ❌ DO NOT commit .env files
- ✅ DO use environment variables on Render
- ✅ DO use `.env.example` files with placeholder values

**Current API Keys:**
- Render API: (rotate if exposed)
- Finnhub API: Set in Render env vars `FINNHUB_API_KEY`
- Webhook Secret: Set in Render env vars `WEBHOOK_SECRET`
- Claude API: Set in Render env vars `ANTHROPIC_API_KEY`

---

## AutoPartsERP (AP) Project

### Technology Stack
- **Backend:** C# .NET 8.0 (Docker)
- **Frontend:** React + TypeScript (Docker)
- **Database:** Supabase PostgreSQL
- **Deployment:** Render (Docker containers)
- **ORM:** Entity Framework Core
- **Authentication:** Custom user/role system

### Current Status
- ✅ Core ERP modules working
- ✅ Stock rectification/adjustment features enabled
- ✅ Permission-based access control implemented
- ✅ 4 customer instances deployed

### Known Issues
- Stock adjustment permission visibility fixed (requires proper seeding)
- Ensure SeedController grants appropriate permissions during initialization

### Important Files
- `AutoPartsERP/src/AutoPartsERP.Api/appsettings.json` - Configuration
- `AutoPartsERP/src/AutoPartsERP.Domain/Entities/` - Domain models
- `ReactUI/app/src/pages/` - Frontend pages
- Database migrations in EF Core

### Deployment Info
- **Branch:** `FBR-Integration`
- **Render Services:**
  - `SMEERP` (backend)
  - `smeerp-ui-docker` (frontend)
  - Plus 4 customer-specific instances
- **Database:** Supabase PostgreSQL (session pooler connection)

---

## ICT Trading Project

### Technology Stack
- **Backend:** Node.js 20 LTS + Express
- **Frontend:** React 18 + Vite + TypeScript
- **Database:** Supabase PostgreSQL (same Render instance)
- **Charts:** Lightweight Charts (TradingView library)
- **State:** Zustand
- **AI:** Anthropic Claude API

### Supported Symbols

**Crypto (via CoinGecko API):**
- BTCUSDT, ETHUSDT, BNBUSDT, SOLUSDT, XRPUSDT
- ADAUSDT, DOGEUSDT, AVAXUSDT, MATICUSDT, LINKUSDT

**Metals & Forex (via Finnhub API):**
- XAUUSD (Gold)
- XAGUSD (Silver)
- EURUSD (requires paid Finnhub plan for forex access)

**Note:** CoinGecko free tier has rate limits (429 errors). Wait 30-60 seconds and retry.

### Phase 2 Features (Completed)
- ✅ Live data auto-fetch from CoinGecko (crypto) & Finnhub (metals)
- ✅ 15-minute background scheduler (node-cron)
- ✅ TradingView webhook integration
- ✅ Frontend UI with market selector and live status indicator
- ✅ Auto-refresh polling (60 seconds when enabled)
- ✅ Webhook status polling (30 seconds)

### Current Architecture

```
Frontend (React Vite)
  ↓ API calls via Axios
Backend (Node.js Express)
  ├─ Live data fetch (CoinGecko/Finnhub)
  ├─ Background scheduler (every 15 min)
  ├─ TradingView webhooks
  └─ Claude AI analysis
  ↓
Database (Supabase PostgreSQL)
  ├─ market_data table
  ├─ ict_analysis table
  └─ trading_signals table
```

### Deployment Info
- **Branch:** `main`
- **Render Services:**
  - `ict-trading-api` (backend)
  - `ict-trading-ui` (frontend)
- **Environment Variables:**
  - `FRONTEND_URL=https://ict-trading-ui.onrender.com`
  - `FINNHUB_API_KEY=<user_provided_key>`
  - `WEBHOOK_SECRET=<generated_secret>`
  - `DATABASE_URL=<supabase_connection_string>`
  - `ANTHROPIC_API_KEY=<claude_api_key>`

### CORS Configuration
- Allowed origins: `http://localhost:5173` (dev) + `https://ict-trading-ui.onrender.com` (prod)
- Uses function-based origin checking in Express

### ICT Concepts Implemented
- Order blocks (bullish/bearish)
- Liquidity levels (swing highs/lows)
- Fair value gaps (FVG)
- Market structure shifts (MSS)
- Supply/demand zones
- Claude AI analysis integration

---

## Development Guidelines

### Before Making Changes
1. **Identify the project:** AP or ICT-Trading?
2. **Read the specific context:** Check project's CONTEXT.md
3. **Review recent commits:** `git log --oneline -10`
4. **Check current branch:** `git status`
5. **Never mix files** from different projects

### When Writing Code
- Follow existing patterns in the codebase
- Keep security in mind (no hardcoded secrets)
- Test locally before deploying
- Write clear commit messages
- Only make changes requested (avoid over-engineering)

### Git Workflow
```bash
# Always on correct branch
git status

# Make changes to specific files
git add <specific_files>  # NOT git add .

# Create descriptive commit
git commit -m "Fix: [what] + [why]"

# Push to remote
git push origin <branch_name>

# Render auto-deploys from main/FBR-Integration
```

### Deployment Process
1. Make changes locally
2. Commit and push to GitHub
3. Render auto-deploys (check dashboard for status)
4. Test on production URL
5. Monitor logs via Render dashboard

---

## Environment Variables

### AP Project (Backend)
```
DATABASE_URL=postgresql://...supabase...
ANTHROPIC_API_KEY=sk-ant-...
FRONTEND_URL=<deployment_url>
```

### ICT Trading (Backend)
```
DATABASE_URL=postgresql://...supabase...
FRONTEND_URL=https://ict-trading-ui.onrender.com
FINNHUB_API_KEY=<key_from_finnhub.io>
WEBHOOK_SECRET=<random_string>
ANTHROPIC_API_KEY=sk-ant-...
PORT=3000
NODE_ENV=production
```

### ICT Trading (Frontend)
```
VITE_API_URL=https://ict-trading-api.onrender.com
```

---

## Important Contacts & Resources

### Render Deployment
- Dashboard: https://dashboard.render.com
- Render API: Used for environment variables & deployments
- Status page: Check if Render is experiencing issues

### GitHub Repository
- ICT Trading: https://github.com/umerdaim-lang/ICT-Trading
- SMEERP (AP): https://github.com/umerdaim-lang/SMEERP

### External APIs
- **CoinGecko:** https://api.coingecko.com (free, no key needed, rate-limited)
- **Finnhub:** https://finnhub.io (free tier with limitations on forex)
- **Anthropic Claude:** https://console.anthropic.com

### Database
- **Supabase:** https://supabase.com
- Connection string in environment variables
- Session pooler endpoint for connections

---

## Troubleshooting

### Issue: "Network Error" on API calls
**Solution:** Check CORS headers
- Verify `FRONTEND_URL` is set correctly on Render backend
- Check browser console for actual error message
- Test endpoint directly: `curl -H "Origin: <frontend_url>" <api_endpoint>`

### Issue: CoinGecko 429 Rate Limit
**Solution:** Wait 30-60 seconds and retry
- Free tier has strict limits
- Try different symbol to clear rate limit
- Future: Add retry logic with exponential backoff

### Issue: Environment variables not loading
**Solution:**
1. Set variables via Render dashboard
2. Trigger manual redeploy via Render API or dashboard
3. Verify with `curl <health_endpoint>`

### Issue: Database connection errors
**Solution:**
1. Check DATABASE_URL is set correctly
2. Verify Supabase credentials
3. Test connection string directly
4. Check for expired/revoked credentials

---

## Future Improvements

### ICT Trading
- [ ] Add retry logic with exponential backoff for API calls
- [ ] Implement response caching to reduce API calls
- [ ] Add more forex pairs when Finnhub access improved
- [ ] Performance optimizations for historical data processing
- [ ] Enhanced error messages in frontend

### AP Project
- [ ] Review and optimize database queries
- [ ] Add comprehensive audit logging
- [ ] Implement advanced reporting features
- [ ] Performance testing and optimization

---

## Quick Reference

### Check Project Status
```bash
# API health check
curl https://ict-trading-api.onrender.com/health
curl https://ict-trading-ui.onrender.com/health

# Database connection
# Check Supabase dashboard for recent activity
```

### Deploy Changes
```bash
cd <project_root>
git status
git add <files>
git commit -m "message"
git push origin <branch>
# Render auto-deploys in 1-5 minutes
```

### View Logs
- Frontend logs: Render dashboard → Service → Logs
- Backend logs: Render dashboard → Service → Logs
- Database: Supabase dashboard → Logs

---

## Last Updated
- **Date:** 2026-02-17
- **Phase 2 Status:** ✅ Complete (Live data integration working)
- **Next Focus:** Return to AP project work after Phase 2 verification

---

## Notes for Future Claude Sessions

1. This file should be your first reference when resuming work
2. Always check project-specific CONTEXT.md files
3. Never hardcode secrets - use environment variables
4. Test on localhost before deploying to Render
5. When in doubt about which project - check directory path
6. Read recent git history to understand current state
7. All API keys should be rotated if exposed in conversation history
8. CoinGecko rate limits are normal - have users retry after 30-60 seconds
