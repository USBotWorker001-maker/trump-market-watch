// ─── CONFIG ────────────────────────────────────────────────────────────────
export const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY ?? ''
export const FINNHUB_KEY   = import.meta.env.VITE_FINNHUB_API_KEY   ?? ''

const STORAGE_KEY = 'trump_market_mentions'

// ─── DATE HELPERS ──────────────────────────────────────────────────────────
export function getPastDates(numDays) {
  return Array.from({ length: numDays }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - i)
    return d.toISOString().split('T')[0]
  })
}

// ─── LOCAL STORAGE ─────────────────────────────────────────────────────────
function loadStored() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
  catch { return [] }
}

function mergeAndStore(existing, fresh) {
  const seen = new Set(existing.map(m => `${m.ticker}-${m.date}`))
  const merged = [...existing]
  for (const m of fresh) {
    const key = `${m.ticker}-${m.date}`
    if (!seen.has(key)) { merged.push(m); seen.add(key) }
  }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)) } catch {}
  return merged.sort((a, b) => (a.date < b.date ? 1 : -1))
}

// ─── TRUMP MENTION FETCH (TODAY ONLY) ──────────────────────────────────────
async function fetchTodayMentions() {
  const today = new Date().toISOString().split('T')[0]
  const prompt = `Search the web for Trump stock mentions today ${today}. Include: direct mentions in speeches/Truth Social/interviews, admin actions (tariffs, CHIPS grants, contracts, equity stakes) targeting specific public companies. Return ONLY a JSON array, no markdown:
[{"date":"${today} HH:MM","ticker":"TSLA","company":"Tesla","context":"what Trump said/did","sentiment":"bullish","sentimentReason":"why bullish/bearish","source":"url"}]
sentiment: bullish=stock goes up, bearish=stock goes down, neutral=no clear impact. If none found return []. Real events only.`

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
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
  const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('')
  const clean = text.replace(/```json|```/g, '').trim()
  const match = clean.match(/\[[\s\S]*?\]/)
  const results = match ? JSON.parse(match[0]) : []
  return results.map(r => ({ ...r, isHistorical: false }))
}

export async function fetchAllMentions() {
  const todayStr = new Date().toISOString().split('T')[0]
  const stored = loadStored()
  const historical = stored
    .filter(m => !m.date?.startsWith(todayStr))
    .map(m => ({ ...m, isHistorical: true }))
  const todayFresh = await fetchTodayMentions()
  return mergeAndStore(historical, todayFresh)
}

// ─── STOCK PRICE FETCH ─────────────────────────────────────────────────────
export async function fetchStockPrice(ticker) {
  if (!FINNHUB_KEY) return { price: null, change: null, changePct: null }
  try {
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_KEY}`)
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