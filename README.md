# ICT Swing Trading Analysis System

A comprehensive trading analysis platform powered by Claude AI and built with React + Node.js. This system analyzes financial markets using Inner Circle Trader (ICT) concepts to identify swing trading opportunities.

## Features

- **ICT Analysis** - Detects order blocks, liquidity levels, fair value gaps, and market structure shifts
- **Claude AI Integration** - Provides expert trading analysis and signal recommendations
- **Real-time Dashboard** - Beautiful React UI for chart visualization and signal management
- **REST API** - Complete API for market data, analysis, and trading signals
- **PostgreSQL Database** - Persistent storage for market data and analysis history

## Quick Start

### Prerequisites

- Node.js 20+ LTS
- PostgreSQL 14+
- Claude API Key (from Anthropic)

### Installation

#### 1. Backend Setup

```bash
cd backend
npm install

# Create .env file
cp .env.example .env

# Update .env with your credentials
# - DATABASE_URL=postgresql://user:password@localhost:5432/ict_trading
# - ANTHROPIC_API_KEY=sk-ant-...

# Run Prisma migrations
npx prisma migrate deploy

# Start the server
npm run dev
```

Backend runs on `http://localhost:3000`

#### 2. Frontend Setup

```bash
cd dashboard
npm install

# Create .env file (optional, defaults to http://localhost:3000)
echo "VITE_API_URL=http://localhost:3000" > .env

# Start dev server
npm run dev
```

Frontend runs on `http://localhost:5173`

### Usage

1. **Open Dashboard**: Navigate to `http://localhost:5173`
2. **Upload Market Data**: Use the "Upload Data" button to paste CSV data
3. **Select Symbol & Timeframe**: Choose your trading pair and timeframe
4. **Run Analysis**: Click "Run Analysis" to execute ICT analysis
5. **View Signals**: Active trading signals appear in the right panel

## API Endpoints

### Market Data
- `POST /api/market-data/upload` - Upload OHLC data
- `GET /api/market-data/:symbol/:timeframe` - Get market data
- `DELETE /api/market-data/:symbol` - Delete market data

### Analysis
- `POST /api/analysis/run` - Run ICT analysis
- `GET /api/analysis/:symbol/latest` - Get latest analysis
- `GET /api/analysis/history` - Get analysis history
- `POST /api/analysis/:analysisId/extract-signal` - Extract signal from analysis

### Signals
- `GET /api/signals/active` - Get active signals
- `GET /api/signals/:id` - Get signal by ID
- `GET /api/signals/symbol/:symbol` - Get signals for symbol
- `PUT /api/signals/:id/close` - Close signal
- `DELETE /api/signals/:id` - Delete signal

## Market Data Format

CSV format for uploading data:
```
timestamp,open,high,low,close,volume
2024-02-17T00:00:00Z,1.0850,1.0860,1.0840,1.0855,1000000
2024-02-17T04:00:00Z,1.0855,1.0875,1.0850,1.0870,1100000
```

## ICT Concepts Implemented

- **Order Blocks** - Zones where institutions accumulated/distributed
- **Liquidity Levels** - Recent swing highs and lows
- **Fair Value Gaps (FVG)** - Price gaps between candles
- **Market Structure Shift (MSS)** - Changes in directional bias
- **CISD** - Change in State of Delivery
- **Supply/Demand Zones** - Areas of concentration

## Architecture

```
┌─────────────────┐
│  TradingView    │ (Data Source)
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Backend API    │ (Node.js/Express)
│  - Market Data  │
│  - ICT Analysis │
│  - Claude AI    │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  PostgreSQL     │ (Database)
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  React App      │ (Dashboard)
└─────────────────┘
```

## Development

### Backend Structure
```
backend/
├── src/
│   ├── services/       # Business logic (ICT, Claude)
│   ├── routes/         # API endpoints
│   ├── models/         # Database models
│   └── utils/          # Helper functions
├── prisma/
│   └── schema.prisma   # Database schema
├── server.js           # Express app
└── package.json
```

### Frontend Structure
```
dashboard/
├── src/
│   ├── components/     # React components
│   ├── pages/          # Page components
│   ├── store/          # Zustand store
│   ├── lib/            # API client
│   └── App.jsx         # Main app
├── index.html
└── vite.config.js
```

## Database Schema

### market_data
Stores OHLC candle data

### ict_analysis
Stores analysis results (order blocks, FVGs, MSS, etc.)

### trading_signals
Active and closed trading signals

### analysis_history
Historical analysis records for learning

## Deployment to Render

### Create Services

1. **PostgreSQL Database**
   ```
   Name: ict-trading-db
   Plan: Starter ($7/month)
   ```

2. **Backend Web Service**
   ```
   Name: ict-trading-api
   Runtime: Node
   Build: cd backend && npm install && npx prisma migrate deploy
   Start: cd backend && node server.js
   Environment: DATABASE_URL, ANTHROPIC_API_KEY, PORT, FRONTEND_URL
   ```

3. **Frontend Static Site**
   ```
   Name: ict-trading-ui
   Build: cd dashboard && npm install && npm run build
   Publish Directory: dashboard/dist
   Environment: VITE_API_URL
   ```

## Testing

### Backend
```bash
cd backend
npm run dev

# Test with curl
curl -X POST http://localhost:3000/api/market-data/upload \
  -H "Content-Type: application/json" \
  -d '{"symbol":"EURUSD","timeframe":"4H","data":[...]}'
```

### Frontend
```bash
cd dashboard
npm run dev

# Open http://localhost:5173
```

## Next Steps for Algorithm Refinement

1. Test on historical data
2. Refine ICT concept detection
3. Adjust confidence scoring
4. Fine-tune entry/exit rules
5. Add more indicators (CISD, breaker blocks, mitigation blocks)

## Security

- API keys stored in environment variables
- Database credentials never in code
- CORS configured for frontend domain
- Input validation on all endpoints
- Rate limiting on Claude API calls

## License

MIT

## Support

For issues or questions:
1. Check API logs: `docker logs ict-trading-api`
2. Check database: `npx prisma studio`
3. Review Claude responses in analysis data
4. Check frontend console for errors

---

**Built with Claude AI** 🤖
