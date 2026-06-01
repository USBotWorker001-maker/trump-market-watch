// ─── CONFIG ────────────────────────────────────────────────────────────────
export const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY ?? ''
export const FINNHUB_KEY   = import.meta.env.VITE_FINNHUB_API_KEY   ?? ''
export const NEWSAPI_KEY   = import.meta.env.VITE_NEWSAPI_KEY ?? ''

const STORAGE_KEY   = 'trump_market_mentions'
const NEWS_HASH_KEY = 'trump_news_hash'

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

// ─── SOURCE 1: NEWSAPI (3 parallel queries) ────────────────────────────────
async function fetchNewsAPI() {
  const today = new Date().toISOString().split('T')[0]
  const queries = [
    'Trump+stock+OR+Trump+shares+OR+Trump+company',
    'Trump+tariff+OR+Trump+trade+deal+OR+Trump+sanctions',
    'Trump+praises+OR+Trump+criticizes+OR+Trump+announces+billion',
  ]

  const results = await Promise.allSettled(
    queries.map(q =>
      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'news', query: q, from: today }),
      }).then(r => r.json())
    )
  )

  const seen = new Set()
  const lines = []
  for (const r of results) {
    if (r.status !== 'fulfilled' || !r.value.articles) continue
    for (const a of r.value.articles) {
      if (seen.has(a.url)) continue
      seen.add(a.url)
      lines.push(`[NewsAPI ${(a.publishedAt ?? '').slice(11, 16)}] ${a.title}. ${(a.description ?? '').slice(0, 80)} <${a.url}>`)
    }
  }
  return lines.join('\n')
}

// ─── SOURCE 2: TRUTH SOCIAL RSS ───────────────────────────────────────────
async function fetchTruthSocial() {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'rss', url: 'https://truthsocial.com/@realDonaldTrump.rss' }),
    })
    const data = await res.json()
    if (!data.items?.length) return ''
    return data.items
      .slice(0, 20)
      .map(i => `[TruthSocial ${(i.pubDate ?? '').slice(0, 16)}] ${(i.content ?? i.title ?? '').slice(0, 200)} <${i.link ?? ''}>`)
      .join('\n')
  } catch { return '' }
}

// ─── SOURCE 3: WHITE HOUSE BRIEFING ROOM RSS ──────────────────────────────
async function fetchWhiteHouse() {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'rss', url: 'https://www.whitehouse.gov/feed/' }),
    })
    const data = await res.json()
    if (!data.items?.length) return ''
    return data.items
      .slice(0, 15)
      .map(i => `[WhiteHouse ${(i.pubDate ?? '').slice(0, 16)}] ${i.title ?? ''}. ${(i.content ?? i.description ?? '').slice(0, 120)} <${i.link ?? ''}>`)
      .join('\n')
  } catch { return '' }
}

// ─── AGGREGATE ALL SOURCES ────────────────────────────────────────────────
async function fetchAllSources() {
  const [newsapi, truthsocial, whitehouse] = await Promise.allSettled([
    fetchNewsAPI(),
    fetchTruthSocial(),
    fetchWhiteHouse(),
  ])
  return [
    newsapi.value     ?? '',
    truthsocial.value ?? '',
    whitehouse.value  ?? '',
  ].filter(Boolean).join('\n')
}

// ─── CLAUDE ANALYSIS ───────────────────────────────────────────────────────
async function analyzeWithClaude(articleString) {
  if (!articleString) return []
  const today = new Date().toISOString().split('T')[0]

  const prompt = `Extract Trump stock mentions. Return JSON array only, [] if none.
Schema: {date:"${today} HH:MM",ticker,company,context,sentiment:"bullish|bearish|neutral",sentimentReason,source}

${articleString}`

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 500,
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
  const stored   = loadStored()
  const historical = stored
    .filter(m => !m.date?.startsWith(todayStr))
    .map(m => ({ ...m, isHistorical: true }))

  const articleString = await fetchAllSources()

  // Skip Claude call if all sources unchanged since last refresh
  const newHash  = articleString.slice(0, 120)
  const lastHash = sessionStorage.getItem(NEWS_HASH_KEY)
  if (newHash && newHash === lastHash) {
    return mergeAndStore(historical, [])
  }
  if (newHash) sessionStorage.setItem(NEWS_HASH_KEY, newHash)

  const todayFresh = await analyzeWithClaude(articleString)
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
