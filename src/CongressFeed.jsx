import { useState, useEffect, useRef, useCallback } from 'react'

const REFRESH_MS   = 60 * 60 * 1000
const STORAGE_KEY  = 'congress_trades'
const FETCHED_AT_KEY = 'congress_fetched_at'

function getStoredFetchedAt() {
  try { return localStorage.getItem(FETCHED_AT_KEY) ?? null } catch { return null }
}

// ─── TRUMP ALLIES — curated list of MAGA-aligned members ─────────────────
const TRUMP_ALLIES = new Set([
  // Senate
  'Tommy Tuberville', 'Markwayne Mullin', 'Rick Scott', 'Rand Paul',
  'Ted Cruz', 'Josh Hawley', 'Mike Lee', 'Ron Johnson', 'Bill Hagerty',
  'Roger Marshall', 'John Kennedy', 'Marsha Blackburn', 'Lindsey Graham',
  'Marco Rubio', 'JD Vance', 'Katie Britt', 'Eric Schmitt', 'Pete Ricketts',
  'Cynthia Lummis', 'Kevin Cramer', 'Steve Daines', 'Chuck Grassley',
  // House
  'Matt Gaetz', 'Marjorie Taylor Greene', 'Jim Jordan', 'Lauren Boebert',
  'Paul Gosar', 'Andy Biggs', 'Scott Perry', 'Byron Donalds', 'Anna Paulina Luna',
  'Mike Collins', 'Clay Higgins', 'Jeff Duncan', 'Barry Moore', 'Bob Good',
  'Chip Roy', 'Thomas Massie', 'Troy Nehls', 'Randy Weber', 'Greg Steube',
  'Bill Posey', 'Michael Cloud', 'Wesley Hunt', 'Brian Babin', 'Pete Sessions',
  'Ronny Jackson', 'Pat Fallon', 'Morgan Luttrell', 'Michael Burgess',
  'Michael McCaul', 'Michael Guest', 'Trent Kelly', 'Steven Palazzo',
  'Mike Bost', 'Mary Miller', 'Mike Johnson', 'Steve Scalise', 'Elise Stefanik',
  'Tom Emmer', 'Gary Palmer', 'Robert Aderholt', 'Mo Brooks', 'Barry Loudermilk',
  'Rick Allen', 'Andrew Clyde', 'Doug Collins', 'Buddy Carter',
])

function loadStored() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
  catch { return [] }
}

function storeAndMerge(existing, fresh) {
  const seen = new Set(existing.map(t => t.id))
  const merged = [...existing]
  for (const t of fresh) {
    if (!seen.has(t.id)) { merged.push(t); seen.add(t.id) }
  }
  const sorted = merged.sort((a, b) => new Date(b.transactionDate) - new Date(a.transactionDate))
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted.slice(0, 500))) } catch {}
  return sorted
}

function formatDate(str) {
  try {
    return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return str }
}

function amountColor(amount) {
  if (!amount) return '#6b7280'
  const n = parseInt(amount.replace(/\D/g, ''), 10)
  if (n >= 1000000) return '#c41230'
  if (n >= 250000)  return '#d97706'
  return '#0a1628'
}

const AMOUNT_RANGES = {
  '$1,001 - $15,000':         '$1K–$15K',
  '$15,001 - $50,000':        '$15K–$50K',
  '$50,001 - $100,000':       '$50K–$100K',
  '$100,001 - $250,000':      '$100K–$250K',
  '$250,001 - $500,000':      '$250K–$500K',
  '$500,001 - $1,000,000':    '$500K–$1M',
  '$1,000,001 - $5,000,000':  '$1M–$5M',
  '$5,000,001 - $25,000,000': '$5M–$25M',
  'Over $25,000,000':         '$25M+',
}

function shortAmount(raw) {
  return AMOUNT_RANGES[raw] ?? raw ?? '—'
}

const s = {
  root:  { maxWidth: 1200, margin: '0 auto', padding: '24px 24px 48px' },
  topBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16, flexWrap: 'wrap', gap: 10,
  },
  heading: {
    fontSize: 13, fontWeight: 700, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: '#6b7280', margin: 0,
  },
  meta:      { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  countdown: { color: '#c41230', fontWeight: 700 },
  controls:  { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  select: {
    background: '#fff', border: '1px solid rgba(0,0,0,0.15)',
    color: '#0a1628', borderRadius: 6, padding: '7px 28px 7px 10px',
    fontSize: 12, fontFamily: "'IBM Plex Sans', sans-serif",
    cursor: 'pointer', outline: 'none', appearance: 'none', WebkitAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236b7280' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
  },
  refreshBtn: (loading) => ({
    background: '#c41230', border: 'none', color: '#fff',
    borderRadius: 6, padding: '7px 16px',
    cursor: loading ? 'not-allowed' : 'pointer',
    fontSize: 12, fontFamily: 'inherit', fontWeight: 700,
    letterSpacing: '0.08em', opacity: loading ? 0.6 : 1,
  }),
  notice: {
    background: 'rgba(0,48,135,0.05)', border: '1px solid rgba(0,48,135,0.15)',
    borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#003087',
    marginBottom: 16,
  },
  error: {
    background: 'rgba(196,18,48,0.06)', border: '1px solid rgba(196,18,48,0.2)',
    borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#c41230', marginBottom: 16,
  },
  table: {
    width: '100%', borderCollapse: 'collapse',
    background: '#fff', borderRadius: 12, overflow: 'hidden',
    border: '1px solid rgba(0,0,0,0.09)',
  },
  th: {
    background: '#f1f5f9', padding: '11px 14px', textAlign: 'left',
    fontSize: 10, fontWeight: 700, color: '#64748b',
    letterSpacing: '0.14em', textTransform: 'uppercase',
    borderBottom: '1px solid rgba(0,0,0,0.08)',
    fontFamily: "'IBM Plex Sans', sans-serif", whiteSpace: 'nowrap',
  },
  tr: (i) => ({
    background: i % 2 === 0 ? 'rgba(0,0,0,0.015)' : 'transparent',
    borderBottom: '1px solid rgba(0,0,0,0.05)',
    transition: 'background 0.15s',
  }),
  td: { padding: '12px 14px', fontSize: 13, color: '#374151', verticalAlign: 'middle' },
  ticker: {
    background: 'rgba(196,18,48,0.07)', border: '1px solid rgba(196,18,48,0.22)',
    color: '#c41230', padding: '2px 8px', borderRadius: 5,
    fontWeight: 800, fontSize: 12, letterSpacing: '0.06em',
    fontFamily: 'monospace', display: 'inline-block',
  },
  buyBadge: {
    background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.28)',
    color: '#16a34a', padding: '2px 8px', borderRadius: 5,
    fontSize: 11, fontWeight: 700, display: 'inline-block',
  },
  sellBadge: {
    background: 'rgba(196,18,48,0.07)', border: '1px solid rgba(196,18,48,0.22)',
    color: '#c41230', padding: '2px 8px', borderRadius: 5,
    fontSize: 11, fontWeight: 700, display: 'inline-block',
  },
  spinner: {
    width: 32, height: 32,
    border: '3px solid rgba(196,18,48,0.15)', borderTop: '3px solid #c41230',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    margin: '60px auto',
  },
  empty:  { textAlign: 'center', color: '#9ca3af', padding: '60px 20px', fontSize: 14 },
  lagNote: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
}

export default function CongressFeed() {
  const [trades, setTrades]         = useState(() => loadStored())
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [lastUpdated, setLastUpdated] = useState(() => {
    const t = getStoredFetchedAt(); return t ? new Date(t) : null
  })
  const [filterType, setFilterType] = useState('')
  const [filterName, setFilterName] = useState('')
  const intervalRef                 = useRef(null)
  const timeoutRef                  = useRef(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'congress' }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setTrades(prev => storeAndMerge(prev, data.trades ?? []))
      const now = new Date()
      setLastUpdated(now)
      try { localStorage.setItem(FETCHED_AT_KEY, now.toISOString()) } catch {}
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (trades.length === 0) refresh()
    const msUntilNextHour = () => {
      const now = new Date(), next = new Date(now)
      next.setHours(now.getHours() + 1, 0, 0, 0)
      return next - now
    }
    timeoutRef.current = setTimeout(() => {
      refresh()
      intervalRef.current = setInterval(refresh, REFRESH_MS)
    }, msUntilNextHour())
    return () => {
      clearTimeout(timeoutRef.current)
      clearInterval(intervalRef.current)
    }
  }, [refresh])

  const uniqueNames = [...new Set(trades.map(t => t.representative))].sort()

  const filtered = trades.filter(t => {
    if (filterType && !t.type?.toLowerCase().includes(filterType)) return false
    if (filterName && t.representative !== filterName) return false
    return true
  })

  return (
    <div style={s.root}>
      <div style={s.topBar}>
        <div>
          <p style={s.heading}>Congressional Trades — Trump Allies</p>
          {lastUpdated && (
            <p style={s.meta}>
              Updated {lastUpdated.toLocaleTimeString()} · Updates at the top of the hour · {filtered.length} trades
            </p>
          )}
          <p style={s.lagNote}>STOCK Act disclosures required within 30–45 days of trade</p>
        </div>
        <div style={s.controls}>
          <select style={s.select} value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">All Types</option>
            <option value="purchase">Purchase</option>
            <option value="sale">Sale</option>
          </select>
          <select style={s.select} value={filterName} onChange={e => setFilterName(e.target.value)}>
            <option value="">All Members</option>
            {uniqueNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          {(filterType || filterName) && (
            <button style={{ ...s.refreshBtn(false), background: 'transparent', color: '#9ca3af', border: '1px solid rgba(0,0,0,0.15)' }}
              onClick={() => { setFilterType(''); setFilterName('') }}>
              Clear
            </button>
          )}
          <button style={s.refreshBtn(loading)} onClick={refresh} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh Now'}
          </button>
        </div>
      </div>

      <div style={s.notice}>
        Showing STOCK Act disclosures from Trump-allied House and Senate members. Data sourced from official congressional disclosure records.
      </div>

      {error && <div style={s.error}>Error: {error}</div>}

      {loading && trades.length === 0 ? (
        <div style={s.spinner} />
      ) : filtered.length === 0 ? (
        <div style={s.empty}>No trades found.</div>
      ) : (
        <table style={s.table}>
          <thead>
            <tr>
              {['Disclosed', 'Traded', 'Member', 'Chamber', 'Ticker', 'Company', 'Type', 'Amount'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t, i) => (
              <tr key={t.id} style={s.tr(i)}>
                <td style={s.td}>{formatDate(t.disclosureDate)}</td>
                <td style={s.td}>{formatDate(t.transactionDate)}</td>
                <td style={{ ...s.td, fontWeight: 700, color: '#0a1628', whiteSpace: 'nowrap' }}>{t.representative}</td>
                <td style={{ ...s.td, fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t.chamber}</td>
                <td style={s.td}>
                  {t.ticker && t.ticker !== '--'
                    ? <span style={s.ticker}>${t.ticker}</span>
                    : <span style={{ color: '#9ca3af' }}>—</span>}
                </td>
                <td style={{ ...s.td, maxWidth: 200, color: '#374151' }}>{t.asset ?? '—'}</td>
                <td style={s.td}>
                  <span style={t.type?.toLowerCase().includes('purchase') ? s.buyBadge : s.sellBadge}>
                    {t.type?.toLowerCase().includes('purchase') ? 'Buy' : 'Sell'}
                  </span>
                </td>
                <td style={{ ...s.td, fontWeight: 700, color: amountColor(t.amount), whiteSpace: 'nowrap' }}>
                  {shortAmount(t.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
