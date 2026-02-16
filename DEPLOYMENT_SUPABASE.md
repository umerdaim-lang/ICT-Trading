# Deploy to Render + Supabase (FREE TIER)

**Cost**: $0/month (Free tier)
**Time**: ~30 minutes total

---

## Prerequisites

- [ ] Supabase account (https://supabase.com) - FREE
- [ ] Render account (https://render.com) - FREE
- [ ] GitHub repository with ICT-Trading code
- [ ] Claude API Key (https://console.anthropic.com)

---

## Step 1: Create Supabase Database (5 minutes)

### 1.1 Create Supabase Project

1. Go to https://supabase.com
2. Sign up or login
3. Click **New Project**
4. Configure:
   - **Name**: `ict-trading`
   - **Password**: Save this somewhere secure
   - **Region**: Choose closest to you
   - **Plan**: **Free** (tick the Free checkbox)
5. Click **Create new project**
6. Wait for database to initialize (~2 minutes)

### 1.2 Get Database Connection String

1. In Supabase dashboard, go to **Settings** → **Database**
2. Copy the **Connection string** (URI format)
3. It should look like:
   ```
   postgresql://postgres.xxxxx:password@db.xxxxx.supabase.co:5432/postgres
   ```
4. **Save this URL** - you'll need it in Step 3

### 1.3 Run Database Migrations

You have two options:

**Option A: Via Supabase SQL Editor (Easiest)**

1. Go to **SQL Editor** in Supabase
2. Click **New query**
3. Paste your Prisma schema as SQL
4. Execute

**Option B: Via Local Terminal (Recommended)**

```bash
# Set environment variable
$env:DATABASE_URL="your-supabase-connection-string"

# Run migrations
cd backend
npx prisma migrate deploy
```

Then push schema:
```bash
npx prisma db push
```

---

## Step 2: Prepare GitHub Repository (5 minutes)

### 2.1 Check Repository Structure

Your GitHub repo should have:
```
ICT-Trading/
├── backend/
│   ├── src/
│   ├── prisma/
│   ├── package.json
│   ├── server.js
│   └── .env.example
├── dashboard/
│   ├── src/
│   ├── package.json
│   ├── vite.config.js
│   └── .env.example
└── docker-compose.yml
```

### 2.2 Push to GitHub

```bash
# From ICT-Trading directory
git add .
git commit -m "Ready for Render deployment"
git push origin main
```

---

## Step 3: Deploy Backend to Render (10 minutes)

### 3.1 Create Web Service

1. Go to https://dashboard.render.com
2. Click **New +** → **Web Service**
3. Click **Build and deploy from a Git repository**
4. Select your GitHub repository
5. Click **Connect**

### 3.2 Configure Web Service

**Basic Settings:**
- **Name**: `ict-trading-api`
- **Environment**: `Node`
- **Region**: Choose based on your location
- **Branch**: `main`
- **Build Command**:
  ```bash
  cd backend && npm install && npx prisma generate && npx prisma migrate deploy
  ```
- **Start Command**:
  ```bash
  cd backend && node server.js
  ```
- **Plan**: **Free** (Important: this will auto-suspend after 15 minutes of inactivity)

### 3.3 Add Environment Variables

Click **Environment** and add:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Paste your Supabase connection string |
| `ANTHROPIC_API_KEY` | Your Claude API key |
| `PORT` | `3000` |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | Leave blank for now (will update after frontend deployed) |

### 3.4 Deploy

Click **Create Web Service**

⏳ Wait for deployment to complete (3-5 minutes)

Once done, copy the **backend URL** (e.g., `https://ict-trading-api.onrender.com`)

---

## Step 4: Deploy Frontend to Render (10 minutes)

### 4.1 Create Static Site

1. Go to https://dashboard.render.com
2. Click **New +** → **Static Site**
3. Select your GitHub repository
4. Click **Connect**

### 4.2 Configure Static Site

**Basic Settings:**
- **Name**: `ict-trading-ui`
- **Region**: Same as backend
- **Branch**: `main`
- **Build Command**:
  ```bash
  cd dashboard && npm install && npm run build
  ```
- **Publish Directory**: `dashboard/dist`
- **Plan**: **Free** (Static sites never sleep!)

### 4.3 Add Environment Variables

Click **Environment** and add:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | Backend URL from Step 3 (e.g., `https://ict-trading-api.onrender.com`) |

### 4.4 Deploy

Click **Create Static Site**

⏳ Wait for deployment to complete (2-3 minutes)

Once done, copy the **frontend URL** (e.g., `https://ict-trading-ui.onrender.com`)

---

## Step 5: Update Backend with Frontend URL (2 minutes)

1. Go back to **ict-trading-api** service in Render
2. Click **Settings**
3. Scroll to **Environment Variables**
4. Update `FRONTEND_URL` with your frontend URL from Step 4
5. Click **Save**
6. Service will auto-redeploy

---

## Step 6: Test Deployment (5 minutes)

### 6.1 Check Services

1. **Backend**: Visit `https://ict-trading-api.onrender.com/health`
   - Should return: `{"status":"ok","timestamp":"..."}`

2. **Frontend**: Visit `https://ict-trading-ui.onrender.com`
   - Should see the trading dashboard

### 6.2 Test Full Flow

1. Open frontend URL
2. Click **Upload Data**
3. Paste sample CSV data:
   ```
   timestamp,open,high,low,close,volume
   2024-02-17T00:00:00Z,1.0850,1.0860,1.0840,1.0855,1000000
   2024-02-17T04:00:00Z,1.0855,1.0875,1.0850,1.0870,1100000
   ```
4. Click **Upload Data**
5. Click **Run Analysis**
6. Should see ICT analysis and Claude AI recommendations

### 6.3 Check Logs if Issues

**Backend logs:**
- Render dashboard → ict-trading-api → **Logs** tab
- Look for connection errors, Claude API errors, etc.

**Frontend logs:**
- Browser DevTools (F12) → Console tab
- Look for network errors or API connection issues

---

## ⚠️ Important Notes on Free Tier

### Backend (Render Free)
- ✅ Runs for 15 minutes after last request
- ✅ Then auto-suspends (doesn't use resources)
- ✅ Auto-wakes when you access it again (takes ~30 seconds)
- ❌ Not suitable for real-time trading (spins down)
- ✅ Perfect for testing and development

### Frontend (Render Free)
- ✅ Always running (static site)
- ✅ No suspend/wake delays
- ✅ CDN cached globally
- ✅ Perfect for production

### Database (Supabase Free)
- ✅ Always running (managed service)
- ✅ 500 MB storage
- ✅ Perfect for small projects
- ⚠️ Upgrade if you hit storage limits

---

## 🔄 Workflow with Free Tier

**Typical usage:**
1. Open dashboard → Backend wakes up (30 sec wait)
2. Use application normally
3. Close tab → Backend auto-suspends after 15 min
4. Come back later → Backend wakes up again (30 sec wait)

**For continuous usage:**
- Upgrade backend to paid plan (~$7/month)
- Or set up a heartbeat service to keep backend awake

---

## 💡 Upgrading Later

If you need continuous uptime:

1. **Upgrade Backend** → Click service → Settings → Change plan from Free to Starter ($7/month)
2. **Upgrade Database** → Supabase dashboard → Settings → Change plan

No code changes needed!

---

## 🐛 Troubleshooting

### Backend won't start
```
Error: connect ECONNREFUSED DATABASE_URL
```
- Check `DATABASE_URL` is correct
- Verify Supabase database is running
- Check migrations: `npx prisma db push`

### Frontend can't connect to backend
```
Failed to fetch from /api/...
```
- Check `VITE_API_URL` environment variable
- Verify backend service is running (visit /health)
- Check browser DevTools → Network tab

### Supabase connection timeout
```
Error: timeout connecting to database
```
- Free tier Supabase may have connection limits
- Upgrade to pay-as-you-go
- Or implement connection pooling with PgBouncer

### Claude API errors
```
Error: invalid API key
```
- Verify `ANTHROPIC_API_KEY` is correct
- Check API key hasn't expired
- Ensure account has credits

---

## 📊 Cost Summary

| Service | Free Tier | Cost |
|---------|-----------|------|
| Supabase Database | Yes | $0 |
| Render Backend | Yes (sleeps after 15 min) | $0 |
| Render Frontend | Yes (always on) | $0 |
| Claude API | Pay-as-you-go | ~$0.001-0.01 per analysis |
| **TOTAL** | | **~$0/month** |

---

## 🎯 Next Steps

1. Create Supabase account
2. Create Supabase database
3. Push code to GitHub
4. Deploy backend
5. Deploy frontend
6. Test the system
7. Share the URLs with team/customers

---

## 📚 Useful Links

- Render Dashboard: https://dashboard.render.com
- Supabase Dashboard: https://app.supabase.com
- Backend Logs: https://dashboard.render.com → ict-trading-api → Logs
- Database Connection: Supabase → Settings → Database → Connection string
- Claude API: https://console.anthropic.com/keys

---

## ✅ Deployment Checklist

- [ ] Supabase account created
- [ ] Supabase database created
- [ ] Database URL copied
- [ ] Migrations run on Supabase
- [ ] Code pushed to GitHub
- [ ] Backend deployed to Render
- [ ] Backend environment variables set
- [ ] Frontend deployed to Render
- [ ] Frontend environment variables set
- [ ] Backend URL updated in frontend
- [ ] Frontend URL updated in backend
- [ ] /health endpoint working
- [ ] Frontend loads in browser
- [ ] Test data uploaded successfully
- [ ] Analysis runs successfully
- [ ] Claude AI analysis displayed

---

**Happy deploying!** 🚀
