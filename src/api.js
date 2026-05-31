// ─── CONFIG ────────────────────────────────────────────────────────────────
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
  const prompt = `Search the web thoroughly for ANY of the following ${rangeLabel} that involve President Donald Trump and specific publicly traded stocks or companies:

1. DIRECT MENTIONS — Trump personally names, praises, criticizes, or references a stock/company in a Truth Social post, tweet, speech, press briefing, interview, or press conference.

2. ADMINISTRATION ACTIONS — The Trump administration (including the White House, Cabinet departments like Commerce, Treasury, DOD, DOE) announces a policy, award, investment, tariff, sanction, contract, CHIPS Act grant, equity stake, or executive order that directly and significantly affects a specific publicly traded company.

3. INDIRECT MARKET-MOVING STATEMENTS — Trump or his administration makes a statement that clearly targets a specific company even without naming the stock ticker (e.g., calling out a CEO by name, announcing a government investment in a company, awarding a federal contract).

For each event found, analyze the sentiment toward that stock. Determine whether it is BULLISH or BEARISH for the stock price.

Return ONLY a JSON array (no markdown, no explanation, no code fences) with objects exactly like:
[
  {
    "date": "YYYY-MM-DD HH:MM",
    "ticker": "IBM",
    "company": "International Business Machines",
    "context": "Brief quote or paraphrase of what Trump or his administration said/did",
    "sentiment": "bullish",
    "sentimentReason": "One sentence explaining why this is bullish or bearish for the stock",
    "source": "URL or source name"
  }
]

Sentiment rules:
- "bullish" = likely causes stock to go UP (praise, endorsement, government investment, contract award, tariff exemption, favorable policy, equity stake)
- "bearish" = likely causes stock to go DOWN (criticism, threat, tariff imposition, sanctions, investigation, attack, contract cancellation)
- "neutral" = purely informational with no clear directional price impact

The date field must fall on ${dateStr}. If nothing is found, return: []
Be precise. Only include real, verifiable events. Do not hallucinate.`

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
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