// ─── CONFIG ────────────────────────────────────────────────────────────────
// Set your keys in .env:
//   VITE_ANTHROPIC_API_KEY=sk-ant-...
//   VITE_FINNHUB_API_KEY=your_key_here
export const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY ?? ''
export const FINNHUB_KEY   = import.meta.env.VITE_FINNHUB_API_KEY   ?? ''

// ─── DATE HELPERS ──────────────────────────────────────────────────────────
export function getPastDates(numDays) {
  return Array.from({ length: numDays }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - i)
    return d.toISOString().split('T')[0]
  })
}

// ─── TRUMP MENTION FETCH ───────────────────────────────────────────────────
async function fetchMentionsForDate(dateStr, isToday) {
  const rangeLabel = isToday ? `today (${dateStr})` : `on ${dateStr}`
  const prompt = `Search the web for any statements, Truth Social posts, tweets, speeches, press briefings, or interviews from President Donald Trump ${rangeLabel} where he mentions, references, promotes, criticizes, or talks about any specific publicly traded stock, company, or financial asset.

For each mention found, analyze the sentiment of what Trump said toward that stock or company. Determine whether his statement is BULLISH (positive, supportive, praising, predicting growth, endorsing) or BEARISH (negative, critical, threatening, predicting decline, attacking) toward the stock price.

Return ONLY a JSON array (no markdown, no explanation, no code fences) with objects exactly like:
[
  {
    "date": "YYYY-MM-DD HH:MM",
    "ticker": "TSLA",
    "company": "Tesla",
    "context": "Brief quote or paraphrase of what Trump said",
    "sentiment": "bullish",
    "sentimentReason": "One sentence explaining why this is bullish or bearish",
    "source": "URL or source name"
  }
]

Rules for sentiment:
- "bullish" = Trump said something that would likely cause the stock to go UP (praise, endorsement, partnership, tariff exemption, contract award, favorable policy)
- "bearish" = Trump said something that would likely cause the stock to go DOWN (criticism, threat, sanctions, tariff imposition, investigation, attack)
- "neutral" = purely informational with no clear directional impact

The date field must fall on ${dateStr}. If no mentions are found, return: []
Be precise. Only include real, verifiable mentions. Do not hallucinate.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `API error ${response.status}`)
  }

  const data = await response.json()
  const text = data.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
  const clean = text.replace(/```json|```/g, '').trim()
  const match = clean.match(/\[[\s\S]*?\]/)
  const results = match ? JSON.parse(match[0]) : []
  return results.map((r) => ({ ...r, isHistorical: !isToday }))
}

export async function fetchAllMentions() {
  const dates = getPastDates(4)
  const results = await Promise.all(
    dates.map((d, i) => fetchMentionsForDate(d, i === 0).catch(() => []))
  )
  const seen = new Set()
  return results
    .flat()
    .filter((m) => {
      const key = `${m.ticker}-${m.date}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}

// ─── STOCK PRICE FETCH ─────────────────────────────────────────────────────
export async function fetchStockPrice(ticker) {
  if (!FINNHUB_KEY) return { price: null, change: null, changePct: null }
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_KEY}`
    )
    const d = await res.json()
    return { price: d.c ?? null, change: d.d ?? null, changePct: d.dp ?? null }
  } catch {
    return { price: null, change: null, changePct: null }
  }
}

// ─── FORMATTING ────────────────────────────────────────────────────────────
export function formatCountdown(ms) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}
