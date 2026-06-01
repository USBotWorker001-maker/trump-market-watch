import { useState, useEffect, useRef, useCallback } from 'react'
import { extractStocksFromPosts } from './api'

const REFRESH_MS        = 60 * 60 * 1000
const STORAGE_KEY       = 'truth_social_posts'
const STOCK_STORAGE_KEY = 'trump_market_mentions'

// Push extracted stock mentions into the shared stock mentions store
function pushToStockMentions(newMentions) {
  if (!newMentions.length) return
  try {
    const existing = JSON.parse(localStorage.getItem(STOCK_STORAGE_KEY) || '[]')
    const seen = new Set(existing.map(m => `${m.ticker}-${m.date}`))
    const toAdd = newMentions.filter(m => !seen.has(`${m.ticker}-${m.date}`))
    if (!toAdd.length) return
    const merged = [...toAdd, ...existing].sort((a, b) => (a.date < b.date ? 1 : -1))
    localStorage.setItem(STOCK_STORAGE_KEY, JSON.stringify(merged))
  } catch {}
}

function loadStored() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
  catch { return [] }
}

function storeAndMerge(existing, fresh) {
  const seen = new Set(existing.map(p => p.link))
  const merged = [...existing]
  for (const p of fresh) {
    if (!seen.has(p.link)) { merged.push(p); seen.add(p.link) }
  }
  const sorted = merged.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted.slice(0, 200))) } catch {}
  return sorted
}

async function fetchPosts(isInitial = false) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type:  'rss',
      url:   'https://truthsocial.com/@realDonaldTrump.rss',
      pages: isInitial ? 3 : 1,   // fetch 3 pages on first load for history
      days:  isInitial ? 3 : null, // filter to last 3 days on initial load
    }),
  })
  const data = await res.json()
  if (!data.items?.length) return []
  return data.items.map(i => ({
    link:    i.link ?? '',
    pubDate: i.pubDate ?? '',
    content: (i.content ?? i.title ?? '').replace(/<[^>]+>/g, '').trim(),
  }))
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0)  return `${d}d ago`
  if (h > 0)  return `${h}h ago`
  if (m > 0)  return `${m}m ago`
  return 'just now'
}

function formatDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    })
  } catch { return dateStr }
}

const s = {
  root: { maxWidth: 800, margin: '0 auto', padding: '24px 24px 48px' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 20, flexWrap: 'wrap', gap: 10,
  },
  heading: {
    fontSize: 13, fontWeight: 700, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: '#6b7280', margin: 0,
  },
  meta: { fontSize: 12, color: '#9ca3af' },
  countdown: { color: '#c41230', fontWeight: 700 },
  feed: { display: 'flex', flexDirection: 'column', gap: 12 },
  card: {
    background: '#ffffff',
    border: '1px solid rgba(0,0,0,0.09)',
    borderRadius: 10,
    padding: '16px 20px',
    position: 'relative',
  },
  cardNew: {
    background: '#ffffff',
    border: '1px solid rgba(196,18,48,0.25)',
    borderLeft: '3px solid #c41230',
    borderRadius: 10,
    padding: '16px 20px',
    position: 'relative',
  },
  topRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  avatar: {
    width: 36, height: 36, borderRadius: '50%',
    background: '#c41230', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: 14, flexShrink: 0,
  },
  name: { fontWeight: 700, fontSize: 14, color: '#0a1628' },
  handle: { fontSize: 12, color: '#9ca3af' },
  dateStr: { fontSize: 12, color: '#9ca3af' },
  newTag: {
    fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
    background: 'rgba(196,18,48,0.08)', border: '1px solid rgba(196,18,48,0.2)',
    color: '#c41230', padding: '2px 8px', borderRadius: 99,
  },
  content: { fontSize: 14, color: '#1f2937', lineHeight: 1.65, wordBreak: 'break-word' },
  link: { fontSize: 12, color: '#003087', textDecoration: 'none', marginTop: 10, display: 'inline-block' },
  spinner: {
    width: 32, height: 32,
    border: '3px solid rgba(196,18,48,0.15)',
    borderTop: '3px solid #c41230',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '60px auto',
  },
  empty: { textAlign: 'center', color: '#9ca3af', padding: '60px 20px', fontSize: 14 },
  error: {
    background: 'rgba(196,18,48,0.06)', border: '1px solid rgba(196,18,48,0.2)',
    borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#c41230', marginBottom: 16,
  },
  refreshBtn: (loading) => ({
    background: '#c41230', border: 'none', color: '#fff',
    borderRadius: 6, padding: '7px 16px', cursor: loading ? 'not-allowed' : 'pointer',
    fontSize: 12, fontFamily: 'inherit', fontWeight: 700,
    letterSpacing: '0.08em', opacity: loading ? 0.6 : 1,
  }),
}

export default function TruthSocialFeed() {
  const [posts, setPosts]           = useState(() => loadStored())
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [newLinks, setNewLinks]     = useState(new Set())
  const prevLinks                   = useRef(new Set(loadStored().map(p => p.link)))
  const intervalRef                 = useRef(null)
  const timeoutRef                  = useRef(null)

  const refresh = useCallback(async (isInitial = false) => {
    setLoading(true)
    setError(null)
    try {
      const fresh = await fetchPosts(isInitial)
      const brandNew = fresh.filter(p => !prevLinks.current.has(p.link))
      setNewLinks(new Set(brandNew.map(p => p.link)))
      prevLinks.current = new Set(fresh.map(p => p.link))
      setPosts(prev => storeAndMerge(prev, fresh))

      // Run Claude extraction on new posts — push any found tickers to Stock Mentions tab
      if (brandNew.length > 0) {
        extractStocksFromPosts(brandNew)
          .then(pushToStockMentions)
          .catch(() => {})
      }
      setLastUpdated(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const stored = loadStored()
    refresh(stored.length === 0)
    const msUntilNextHour = () => {
      const now = new Date(), next = new Date(now)
      next.setHours(now.getHours() + 1, 0, 0, 0)
      return next - now
    }
    timeoutRef.current = setTimeout(() => {
      refresh(false)
      intervalRef.current = setInterval(() => refresh(false), REFRESH_MS)
    }, msUntilNextHour())
    return () => {
      clearTimeout(timeoutRef.current)
      clearInterval(intervalRef.current)
    }
  }, [refresh])

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div>
          <p style={s.heading}>Truth Social — @realDonaldTrump</p>
          {lastUpdated && (
            <p style={s.meta}>
              Updated {lastUpdated.toLocaleTimeString()} · Updates at the top of the hour · {posts.length} posts
            </p>
          )}
        </div>
        <button style={s.refreshBtn(loading)} onClick={refresh} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh Now'}
        </button>
      </div>

      {error && <div style={s.error}>Error: {error}</div>}

      {loading && posts.length === 0 ? (
        <div style={s.spinner} />
      ) : posts.length === 0 ? (
        <div style={s.empty}>No posts found.</div>
      ) : (
        <div style={s.feed}>
          {posts.map((post) => {
            const isNew = newLinks.has(post.link)
            return (
              <div key={post.link} style={isNew ? s.cardNew : s.card}>
                <div style={s.topRow}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={s.avatar}>DT</div>
                    <div>
                      <div style={s.name}>Donald J. Trump</div>
                      <div style={s.handle}>@realDonaldTrump</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isNew && <span style={s.newTag}>NEW</span>}
                    <span style={s.dateStr}>{formatDate(post.pubDate)}</span>
                  </div>
                </div>
                <div style={s.content}>{post.content}</div>
                {post.link && (
                  <a href={post.link} target="_blank" rel="noreferrer" style={s.link}>
                    View on Truth Social
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
