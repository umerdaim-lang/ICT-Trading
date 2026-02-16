# Deployment Guide - Render

This guide walks through deploying the ICT Trading System to Render.

## Prerequisites

- Render.com account
- GitHub repository with the code
- Claude API key
- Domain name (optional)

## Step 1: Create PostgreSQL Database

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New +** → **PostgreSQL**
3. Configure:
   - **Name**: `ict-trading-db`
   - **Database**: `ict_trading`
   - **User**: `postgres` (or custom)
   - **Region**: Same as API service
   - **Instance Type**: Starter ($7/month) or higher
4. Click **Create Database**
5. Copy the **Database URL** - you'll need this for the backend

## Step 2: Deploy Backend API

1. Click **New +** → **Web Service**
2. Connect your GitHub repository
3. Configure:
   - **Name**: `ict-trading-api`
   - **Environment**: `Node`
   - **Region**: Choose based on your location
   - **Branch**: `main` (or your deployment branch)
   - **Build Command**:
     ```bash
     cd backend && npm install && npx prisma generate && npx prisma migrate deploy
     ```
   - **Start Command**:
     ```bash
     cd backend && node server.js
     ```
   - **Instance Type**: Starter ($7/month) or higher

4. Set **Environment Variables**:
   - `DATABASE_URL`: Paste your PostgreSQL URL from Step 1
   - `ANTHROPIC_API_KEY`: Your Claude API key
   - `PORT`: `3000`
   - `NODE_ENV`: `production`
   - `FRONTEND_URL`: (Set this after frontend is deployed)

5. Click **Create Web Service**
6. Wait for deployment to complete
7. Copy the service URL (e.g., `https://ict-trading-api.onrender.com`)

## Step 3: Deploy Frontend

1. Click **New +** → **Static Site**
2. Connect your GitHub repository
3. Configure:
   - **Name**: `ict-trading-ui`
   - **Region**: Same as backend
   - **Branch**: `main` (or your deployment branch)
   - **Build Command**:
     ```bash
     cd dashboard && npm install && npm run build
     ```
   - **Publish Directory**: `dashboard/dist`

4. Set **Environment Variables**:
   - `VITE_API_URL`: The backend API URL from Step 2 (e.g., `https://ict-trading-api.onrender.com`)

5. Click **Create Static Site**
6. Wait for deployment to complete
7. Copy the frontend URL (e.g., `https://ict-trading-ui.onrender.com`)

## Step 4: Update Backend Environment

Go back to the backend service and update:
- `FRONTEND_URL`: Paste the frontend URL from Step 3

## Step 5: Test Deployment

1. Open the frontend URL in your browser
2. You should see the dashboard
3. Try uploading test market data
4. Run analysis to ensure Claude API is working

## Monitoring

### Check Logs
- Backend: Click service → **Logs** tab
- Frontend: Click service → **Logs** tab
- Database: Click service → **Logs** tab

### Common Issues

**Database Connection Error**
- Verify `DATABASE_URL` environment variable is correct
- Check database is online in Render dashboard
- Run migrations: `npx prisma migrate deploy`

**Claude API Error**
- Verify `ANTHROPIC_API_KEY` is correct
- Check API key has sufficient quota
- Review API response in logs

**CORS Errors**
- Verify `FRONTEND_URL` is set correctly in backend
- Check frontend URL matches exactly

**Build Failures**
- Check build logs in Render dashboard
- Verify dependencies in package.json
- Ensure file paths are correct

## Performance Tuning

### Database
- Monitor database size in Render dashboard
- Add indexes for frequently queried columns
- Archive old analysis history periodically

### Backend
- Monitor API response times in logs
- Scale up instance if CPU/memory usage high
- Enable caching for market data

### Frontend
- Monitor page load times
- Check bundle size with `npm run build`
- Enable Brotli compression in Render settings

## Backup Strategy

### Database Backup
1. Render automatically creates daily backups
2. Access backups in database settings
3. Download backup if needed for analysis

### Code Backup
- Keep GitHub repository updated
- Tag releases with version numbers
- Maintain production branch separate from development

## Scaling

### When to Scale

- **Database**: Growing analysis history, slow queries
- **Backend**: High API response times, CPU usage >80%
- **Frontend**: Long page load times

### How to Scale

1. Click service → **Settings**
2. Change **Instance Type** to higher tier
3. Render automatically migrates and restarts service

## Cost Estimation

- **PostgreSQL**: $7/month (Starter)
- **Backend**: $7/month (Starter)
- **Frontend**: Free (Static sites)
- **Claude API**: Pay per token (varies)

**Total**: ~$14/month + API costs

## Continuous Deployment

### Auto-Deploy on Push

1. Services are connected to GitHub branch
2. Push to main branch → auto-deployment
3. To disable: Settings → **Auto-Deploy** → Off

### Manual Deployment

1. Service → **Manual Deploy**
2. Select branch and commit
3. Click **Deploy**

## Environment Configuration

### Development (.env.local)
```
DATABASE_URL=postgresql://localhost/ict_trading
ANTHROPIC_API_KEY=sk-ant-...
VITE_API_URL=http://localhost:3000
PORT=3000
```

### Production (Render)
```
DATABASE_URL=postgresql://user:pass@host:5432/ict_trading
ANTHROPIC_API_KEY=sk-ant-...
VITE_API_URL=https://ict-trading-api.onrender.com
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://ict-trading-ui.onrender.com
```

## Troubleshooting

### API not responding
```bash
# SSH into backend and check
render run "npm start"
```

### Database connection issues
```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

### Claude API failures
- Check API key validity
- Check account balance
- Review rate limits

## Support

For Render-specific issues:
- Check [Render Docs](https://render.com/docs)
- Contact Render Support
- Check service logs for details

For ICT Trading System issues:
- Review application logs
- Check Claude API response format
- Verify database migrations ran successfully

---

**Deployed with Render** 🚀
