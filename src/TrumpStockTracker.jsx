import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchAllMentions,
  fetchStockPrice,
  formatCountdown,
  getPastDates,
  ANTHROPIC_KEY,
  FINNHUB_KEY,
} from './api'

const REFRESH_MS = 60 * 60 * 1000 // 1 hour

// ─── STYLES ────────────────────────────────────────────────────────────────
const s = {
  root: {
    minHeight: '100vh',
    background: '#060b14',
    fontFamily: "'Georgia', 'Times New Roman', serif",
    color: '#e2e8f0',
    position: 'relative',
    overflow: 'hidden',
  },
  bgGrid: {
    position: 'fixed',
    inset: 0,
    backgroundImage:
      'linear-gradient(rgba(220,38,38,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(220,38,38,0.04) 1px, transparent 1px)',
    backgroundSize: '40px 40px',
    pointerEvents: 'none',
    zIndex: 0,
  },
  bgGlow: {
    position: 'fixed',
    top: '-20%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '80vw',
    height: '60vh',
    background: 'radial-gradient(ellipse, rgba(220,38,38,0.08) 0%, transparent 70%)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  flagStripe: {
    height: 5,
    background: 'linear-gradient(90deg, #b91c1c, #dc2626, #1d4ed8, #dc2626, #b91c1c)',
  },
  header: {
    position: 'relative',
    zIndex: 1,
    background: 'linear-gradient(180deg, #0f172a 0%, #060b14 100%)',
    borderBottom: '1px solid rgba(220,38,38,0.3)',
  },
  headerInner: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '20px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  logoBlock: { display: 'flex', alignItems: 'center', gap: 16 },
  eagle: { fontSize: 48 },
  title: {
    margin: 0,
    fontSize: 26,
    fontWeight: 800,
    letterSpacing: '0.12em',
    color: '#f8fafc',
    textTransform: 'uppercase',
    textShadow: '0 0 30px rgba(220,38,38,0.5)',
  },
  subtitle: {
    margin: '2px 0 0',
    fontSize: 12,
    color: '#64748b',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
  },
  headerRight: { display: 'flex', gap: 10, alignItems: 'center' },
  notifBtn: {
    background: 'rgba(245,158,11,0.1)',
    border: '1px solid #f59e0b',
    color: '#f59e0b',
    borderRadius: 6,
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'inherit',
    letterSpacing: '0.05em',
  },
  refreshBtn: (loading) => ({
    background: 'linear-gradient(135deg, #b91c1c, #dc2626)',
    border: 'none',
    color: '#fff',
    borderRadius: 6,
    padding: '8px 20px',
    cursor: loading ? 'not-allowed' : 'pointer',
    fontSize: 13,
    fontFamily: 'inherit',
    fontWeight: 700,
    letterSpacing: '0.08em',
    boxShadow: '0 0 20px rgba(220,38,38,0.3)',
    opacity: loading ? 0.6 : 1,
  }),
  statusBar: {
    position: 'relative',
    zIndex: 1,
    background: 'rgba(15,23,42,0.8)',
    borderBottom: '1px solid rgba(30,41,59,0.8)',
    padding: '8px 24px',
    display: 'flex',
    alignItems: 'center',
    gap: 24,
    fontSize: 12,
    flexWrap: 'wrap',
  },
  statusItem: { display: 'flex', alignItems: 'center', gap: 6 },
  statusDot: (color) => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: color,
    boxShadow: `0 0 8px ${color}`,
    animation: 'pulse 2s infinite',
    flexShrink: 0,
  }),
  statusLabel: { color: '#94a3b8', letterSpacing: '0.05em' },
  newBadge: {
    background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
    color: '#fff',
    fontSize: 10,
    fontWeight: 800,
    padding: '2px 8px',
    borderRadius: 99,
    letterSpacing: '0.1em',
    animation: 'pulse 1s infinite',
  },
  alertBox: (color, bg, border) => ({
    position: 'relative',
    zIndex: 1,
    margin: '16px 24px 0',
    maxWidth: 1152,
    marginLeft: 'auto',
    marginRight: 'auto',
    background: bg,
    border: `1px solid ${border}`,
    borderRadius: 8,
    padding: '12px 16px',
    fontSize: 13,
    color,
  }),
  code: {
    background: 'rgba(0,0,0,0.3)',
    padding: '1px 6px',
    borderRadius: 4,
    fontFamily: 'monospace',
    fontSize: 12,
  },
  statsRow: {
    position: 'relative',
    zIndex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 12,
    maxWidth: 1200,
    margin: '20px auto 0',
    padding: '0 24px',
  },
  statCard: {
    background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.5))',
    border: '1px solid rgba(30,41,59,0.8)',
    borderRadius: 10,
    padding: '16px 20px',
    textAlign: 'center',
  },
  statVal: { fontSize: 26, fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' },
  statLabel: { fontSize: 11, color: '#64748b', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 4 },
  filterRow: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    maxWidth: 1200,
    margin: '16px auto 0',
    padding: '0 24px',
    flexWrap: 'wrap',
  },
  filterLabel: {
    fontSize: 12,
    color: '#64748b',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginRight: 4,
  },
  select: {
    background: 'rgba(15,23,42,0.9)',
    border: '1px solid rgba(30,41,59,0.8)',
    color: '#e2e8f0',
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 13,
    fontFamily: "'Georgia', serif",
    cursor: 'pointer',
    outline: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2364748b' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 10px center',
    paddingRight: 32,
    minWidth: 110,
  },
  clearBtn: {
    background: 'transparent',
    border: '1px solid rgba(100,116,139,0.4)',
    color: '#64748b',
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 12,
    fontFamily: "'Georgia', serif",
    cursor: 'pointer',
    letterSpacing: '0.05em',
    transition: 'all 0.2s',
  },
  filterCount: {
    fontSize: 12,
    color: '#94a3b8',
    marginLeft: 6,
  },
  tableWrapper: {
    position: 'relative',
    zIndex: 1,
    maxWidth: 1200,
    margin: '16px auto',
    padding: '0 24px 40px',
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    background: 'rgba(15,23,42,0.7)',
    borderRadius: 12,
    overflow: 'hidden',
    border: '1px solid rgba(30,41,59,0.8)',
  },
  th: {
    background: 'rgba(30,41,59,0.9)',
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 700,
    color: '#94a3b8',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    borderBottom: '1px solid rgba(220,38,38,0.2)',
    fontFamily: "'Georgia', serif",
    whiteSpace: 'nowrap',
  },
  tr: (i, hist) => ({
    background: hist
      ? i % 2 === 0 ? 'rgba(30,41,59,0.3)' : 'rgba(20,30,48,0.2)'
      : i % 2 === 0 ? 'rgba(15,23,42,0.4)' : 'transparent',
    borderBottom: '1px solid rgba(30,41,59,0.5)',
    transition: 'background 0.2s',
    opacity: hist ? 0.85 : 1,
    animation: 'fadeIn 0.3s ease both',
  }),
  td: { padding: '14px 16px', fontSize: 14, color: '#e2e8f0', verticalAlign: 'top' },
  ticker: {
    background: 'linear-gradient(135deg, rgba(220,38,38,0.2), rgba(185,28,28,0.1))',
    border: '1px solid rgba(220,38,38,0.4)',
    color: '#fca5a5',
    padding: '3px 10px',
    borderRadius: 6,
    fontWeight: 800,
    fontSize: 13,
    letterSpacing: '0.08em',
    fontFamily: 'monospace',
    display: 'inline-block',
  },
  histBadge: {
    background: 'rgba(100,116,139,0.2)',
    border: '1px solid rgba(100,116,139,0.4)',
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: 800,
    padding: '1px 5px',
    borderRadius: 4,
    letterSpacing: '0.1em',
    fontFamily: 'monospace',
    whiteSpace: 'nowrap',
    display: 'inline-block',
    verticalAlign: 'middle',
    marginRight: 4,
  },
  price: { color: '#a7f3d0', fontWeight: 700, fontFamily: 'monospace', fontSize: 15 },
  change: (pct) => ({
    color: pct >= 0 ? '#4ade80' : '#f87171',
    fontWeight: 700,
    fontFamily: 'monospace',
    fontSize: 13,
  }),
  sentimentBadge: (sentiment) => ({
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.05em',
    ...(sentiment === 'bullish'
      ? { background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)', color: '#4ade80' }
      : sentiment === 'bearish'
      ? { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171' }
      : { background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.25)', color: '#94a3b8' }),
  }),
  sourceLink: { color: '#60a5fa', textDecoration: 'none', fontSize: 12 },
  emptyCell: { textAlign: 'center', padding: '60px 20px', fontSize: 14 },
  spinner: {
    width: 36,
    height: 36,
    border: '3px solid rgba(220,38,38,0.2)',
    borderTop: '3px solid #dc2626',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto',
  },
  footer: {
    position: 'relative',
    zIndex: 1,
    textAlign: 'center',
    padding: '20px',
    fontSize: 11,
    color: '#334155',
    letterSpacing: '0.1em',
    borderTop: '1px solid rgba(30,41,59,0.5)',
  },
}

// ─── COMPONENT ─────────────────────────────────────────────────────────────
export default function TrumpStockTracker() {
  const [mentions, setMentions]       = useState([])
  const [loading, setLoading]         = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [error, setError]             = useState(null)
  const [filterMonth, setFilterMonth] = useState('')
  const [filterDay, setFilterDay]     = useState('')
  const [filterYear, setFilterYear]   = useState('')
  const [newCount, setNewCount]       = useState(0)
  const [countdown, setCountdown]     = useState(REFRESH_MS)
  const [notifPerm, setNotifPerm]     = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  )

  const prevTickers  = useRef(new Set())
  const intervalRef  = useRef(null)
  const countdownRef = useRef(null)

  // Browser notification
  const notify = useCallback((m) => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    new Notification(`🇺🇸 Trump mentioned $${m.ticker}`, { body: m.context })
  }, [])

  const requestNotif = async () => {
    if (typeof Notification === 'undefined') return
    const p = await Notification.requestPermission()
    setNotifPerm(p)
  }

  // Main fetch
  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const raw = await fetchAllMentions()
      const enriched = await Promise.all(
        raw.map(async (m) => {
          const prices = await fetchStockPrice(m.ticker)
          return { ...m, ...prices, id: `${m.ticker}-${m.date}` }
        })
      )
      const brandNew = enriched.filter((m) => !m.isHistorical && !prevTickers.current.has(m.ticker))
      brandNew.forEach(notify)
      setNewCount(brandNew.length)
      prevTickers.current = new Set(enriched.map((m) => m.ticker))
      setMentions(enriched)
      setLastUpdated(new Date())
      setCountdown(REFRESH_MS)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [notify])

  // Auto-refresh
  useEffect(() => {
    fetchAll()
    intervalRef.current = setInterval(fetchAll, REFRESH_MS)
    return () => clearInterval(intervalRef.current)
  }, [fetchAll])

  // Countdown ticker
  useEffect(() => {
    clearInterval(countdownRef.current)
    countdownRef.current = setInterval(() => setCountdown((c) => Math.max(0, c - 1000)), 1000)
    return () => clearInterval(countdownRef.current)
  }, [lastUpdated])

  // Derived data
  const todayStr      = new Date().toISOString().split('T')[0]
  const todayMentions = mentions.filter((m) => m.date?.startsWith(todayStr))

  // Build unique month/day/year options from mentions
  const allDates = mentions.map((m) => m.date?.split(' ')[0]).filter(Boolean)
  const uniqueYears  = [...new Set(allDates.map((d) => d.split('-')[0]))].sort((a,b) => b-a)
  const uniqueMonths = [...new Set(allDates.map((d) => d.split('-')[1]))].sort()
  const uniqueDays   = [...new Set(allDates.map((d) => d.split('-')[2]))].sort((a,b) => a-b)

  const monthNames = { '01':'January','02':'February','03':'March','04':'April','05':'May','06':'June','07':'July','08':'August','09':'September','10':'October','11':'November','12':'December' }

  const filtered = mentions.filter((m) => {
    const d = m.date?.split(' ')[0] ?? ''
    const [y, mo, day] = d.split('-')
    if (filterYear  && y   !== filterYear)  return false
    if (filterMonth && mo  !== filterMonth) return false
    if (filterDay   && day !== filterDay)   return false
    return true
  })

  const missingAnthropicKey = !ANTHROPIC_KEY
  const missingFinnhubKey   = !FINNHUB_KEY

  return (
    <div style={s.root}>
      <div style={s.bgGrid} />
      <div style={s.bgGlow} />

      {/* ── Header ── */}
      <header style={s.header}>
        <div style={s.flagStripe} />
        <div style={s.headerInner}>
          <div style={s.logoBlock}>
            <span style={s.eagle}>🦅</span>
            <div>
              <h1 style={s.title}>Trump Market Watch</h1>
              <p style={s.subtitle}>Real-time stock mentions tracker</p>
            </div>
          </div>
          <div style={s.headerRight}>
            {notifPerm !== 'granted' && (
              <button style={s.notifBtn} onClick={requestNotif}>🔔 Enable Alerts</button>
            )}
            <button style={s.refreshBtn(loading)} onClick={fetchAll} disabled={loading}>
              {loading ? '⟳ Scanning...' : '⟳ Refresh Now'}
            </button>
          </div>
        </div>
      </header>

      {/* ── Status bar ── */}
      <div style={s.statusBar}>
        <div style={s.statusItem}>
          <span style={s.statusDot(loading ? '#facc15' : '#22c55e')} />
          <span style={s.statusLabel}>{loading ? 'Scanning web for Trump statements...' : 'Live'}</span>
        </div>
        {lastUpdated && (
          <span style={s.statusLabel}>
            Last updated: {lastUpdated.toLocaleTimeString()} · Next refresh in{' '}
            <strong style={{ color: '#f59e0b' }}>{formatCountdown(countdown)}</strong>
          </span>
        )}
        {newCount > 0 && <span style={s.newBadge}>+{newCount} NEW</span>}
      </div>

      {/* ── Warnings ── */}
      {missingAnthropicKey && (
        <div style={s.alertBox('#fde68a', 'rgba(251,191,36,0.08)', 'rgba(251,191,36,0.3)')}>
          <strong>⚠️ Anthropic API key missing.</strong> Add <code style={s.code}>VITE_ANTHROPIC_API_KEY</code> to your <code style={s.code}>.env</code> file. See README for instructions.
        </div>
      )}
      {missingFinnhubKey && (
        <div style={s.alertBox('#93c5fd', 'rgba(59,130,246,0.06)', 'rgba(59,130,246,0.25)')}>
          <strong>ℹ️ Finnhub key missing.</strong> Stock prices won't load. Add <code style={s.code}>VITE_FINNHUB_API_KEY</code> to your <code style={s.code}>.env</code> file. Free key at{' '}
          <a href="https://finnhub.io" target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>finnhub.io</a>.
        </div>
      )}
      {error && (
        <div style={s.alertBox('#fca5a5', 'rgba(220,38,38,0.08)', 'rgba(220,38,38,0.3)')}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* ── Stats ── */}
      <div style={s.statsRow}>
        {[
          { label: 'Mentions Today',    val: todayMentions.length },
          { label: 'Last 4 Days Total', val: mentions.length },
          { label: 'Unique Tickers',    val: new Set(mentions.map((m) => m.ticker)).size },
          { label: 'Alert Status',      val: notifPerm === 'granted' ? '✅ Active' : '❌ Off' },
        ].map((stat) => (
          <div key={stat.label} style={s.statCard}>
            <div style={s.statVal}>{loading && mentions.length === 0 ? '—' : stat.val}</div>
            <div style={s.statLabel}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ── Date Filter Dropdowns ── */}
      <div style={s.filterRow}>
        <span style={s.filterLabel}>Filter by:</span>

        <select style={s.select} value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
          <option value="">All Months</option>
          {uniqueMonths.map((m) => (
            <option key={m} value={m}>{monthNames[m] ?? m}</option>
          ))}
        </select>

        <select style={s.select} value={filterDay} onChange={(e) => setFilterDay(e.target.value)}>
          <option value="">All Days</option>
          {uniqueDays.map((d) => (
            <option key={d} value={d}>{parseInt(d, 10)}</option>
          ))}
        </select>

        <select style={s.select} value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
          <option value="">All Years</option>
          {uniqueYears.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        {(filterMonth || filterDay || filterYear) && (
          <button style={s.clearBtn} onClick={() => { setFilterMonth(''); setFilterDay(''); setFilterYear('') }}>
            ✕ Clear
          </button>
        )}

        <span style={s.filterCount}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ── Table ── */}
      <div style={s.tableWrapper}>
        <table style={s.table}>
          <thead>
            <tr>
              {['Date & Time', 'Ticker', 'Company', 'Trump Said', 'Sentiment', 'Price', 'Change', 'Source'].map((h) => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && mentions.length === 0 ? (
              <tr>
                <td colSpan={8} style={s.emptyCell}>
                  <div style={s.spinner} />
                  <p style={{ color: '#94a3b8', marginTop: 16 }}>
                    Scanning 4 days of Trump statements simultaneously…
                  </p>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={s.emptyCell}>
                  <div style={{ fontSize: 48 }}>🤫</div>
                  <p style={{ color: '#94a3b8', marginTop: 8 }}>No stock mentions found for this period.</p>
                </td>
              </tr>
            ) : (
              filtered.map((m, i) => (
                <tr key={m.id ?? i} style={s.tr(i, m.isHistorical)}>
                  <td style={s.td}>
                    {m.isHistorical && <span style={s.histBadge}>HIST</span>}
                    {m.date}
                  </td>
                  <td style={s.td}><span style={s.ticker}>${m.ticker}</span></td>
                  <td style={s.td}>{m.company}</td>
                  <td style={{ ...s.td, maxWidth: 280, color: '#cbd5e1', fontSize: 13 }}>"{m.context}"</td>
                  <td style={s.td}>
                    {m.sentiment ? (
                      <div>
                        <span style={s.sentimentBadge(m.sentiment)}>
                          {m.sentiment === 'bullish' ? '▲ Bullish' : m.sentiment === 'bearish' ? '▼ Bearish' : '◆ Neutral'}
                        </span>
                        {m.sentimentReason && (
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 5, maxWidth: 180, lineHeight: 1.4 }}>
                            {m.sentimentReason}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: '#475569' }}>—</span>
                    )}
                  </td>
                  <td style={s.td}>
                    {m.price != null
                      ? <span style={s.price}>${m.price.toFixed(2)}</span>
                      : <span style={{ color: '#475569' }}>—</span>}
                  </td>
                  <td style={s.td}>
                    {m.changePct != null
                      ? <span style={s.change(m.changePct)}>{m.changePct >= 0 ? '▲' : '▼'} {Math.abs(m.changePct).toFixed(2)}%</span>
                      : <span style={{ color: '#475569' }}>—</span>}
                  </td>
                  <td style={s.td}>
                    {m.source
                      ? <a href={m.source.startsWith('http') ? m.source : '#'} target="_blank" rel="noreferrer" style={s.sourceLink}>
                          {m.source.replace(/https?:\/\/(www\.)?/, '').slice(0, 32)}{m.source.length > 32 ? '…' : ''}
                        </a>
                      : <span style={{ color: '#475569' }}>—</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <footer style={s.footer}>
        Data sourced via AI web search · Stock prices via Finnhub · Not financial advice · Auto-refreshes every hour
      </footer>
    </div>
  )
}
