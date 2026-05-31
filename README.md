# 🦅 Trump Market Watch

Real-time dashboard that uses Claude AI + web search to detect every time President Trump mentions a stock — with live prices, historical data, and browser notifications.

---

## Features

- 🔍 AI-powered web search scans Truth Social, speeches, press briefings every hour
- 📋 Table: date/time, ticker, company, what Trump said, live price, % change, source link
- 📅 Last 4 days of historical data loaded on startup
- 🔔 Browser push notifications for new mentions
- ⏱️ Auto-refreshes every 60 minutes with live countdown

---

## Quick Start (Local)

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/trump-market-watch.git
cd trump-market-watch
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in:

```
VITE_ANTHROPIC_API_KEY=sk-ant-...        # Required — get from console.anthropic.com
VITE_FINNHUB_API_KEY=your_key_here       # Optional — free at finnhub.io
```

### 3. Run locally

```bash
npm run dev
```

Open http://localhost:5173

---

## Deploy to Vercel (Recommended)

Vercel gives you a live public URL in ~60 seconds for free.

### Option A: Via Vercel CLI

```bash
npm install -g vercel
vercel
```

Follow the prompts. When asked about environment variables, add both keys.

### Option B: Via GitHub + Vercel Dashboard

1. Push this repo to GitHub:
   ```bash
   git init
   git add .
   git commit -m "initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/trump-market-watch.git
   git push -u origin main
   ```

2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your repo

3. In **Environment Variables**, add:
   - `VITE_ANTHROPIC_API_KEY` = your Anthropic key
   - `VITE_FINNHUB_API_KEY` = your Finnhub key

4. Click **Deploy**. Done. You get a URL like `trump-market-watch.vercel.app`.

> **Auto-deploy:** Every time you push to `main`, Vercel rebuilds automatically.

---

## API Keys

| Key | Where to get | Cost |
|-----|-------------|------|
| `VITE_ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) | Pay-per-use (~$0.01–0.05/refresh) |
| `VITE_FINNHUB_API_KEY` | [finnhub.io](https://finnhub.io) | Free tier (60 calls/min) |

---

## Project Structure

```
trump-market-watch/
├── src/
│   ├── main.jsx              # React entry point
│   ├── App.jsx               # Root component
│   ├── TrumpStockTracker.jsx # Main dashboard UI
│   ├── api.js                # API helpers (Anthropic + Finnhub)
│   └── index.css             # Global styles + keyframes
├── public/
│   └── eagle.svg             # Favicon
├── .env.example              # Copy to .env and fill in keys
├── .gitignore                # Keeps .env out of git
├── vercel.json               # Vercel deployment config
├── vite.config.js            # Vite config
└── package.json
```

---

## Cost Estimate

Each hourly refresh fires 4 parallel Claude API calls (one per day). At Sonnet pricing (~$3/M input tokens, ~$15/M output tokens), a full day of hourly refreshes costs roughly **$0.50–$2.00/day** depending on how many mentions are found.

---

## Notes

- Stock prices shown are **current** (real-time from Finnhub), not the price at time of Trump's statement
- The dashboard requires the browser tab to be open for the hourly refresh to fire
- For true 24/7 background polling, a backend cron job would be needed
