import { useState, useEffect, useRef, useCallback } from 'react'

const REFRESH_MS  = 60 * 60 * 1000
const STORAGE_KEY = 'trump_location'

// Known Trump locations with coordinates
const KNOWN_LOCATIONS = {
  'White House':        { lat: 38.8977,  lng: -77.0365  },
  'Mar-a-Lago':         { lat: 26.6794,  lng: -80.0364  },
  'Bedminster':         { lat: 40.6673,  lng: -74.6544  },
  'Trump Tower':        { lat: 40.7625,  lng: -73.9738  },
  'Walter Reed':        { lat: 38.9845,  lng: -77.0947  },
  'Camp David':         { lat: 39.6482,  lng: -77.4647  },
  'Air Force One':      { lat: 38.8977,  lng: -77.0365  },
}

function loadStored() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) }
  catch { return null }
}

function saveLocation(loc) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(loc)) } catch {}
}

const s = {
  root: {
    maxWidth: 1200, margin: '0 auto', padding: '24px 24px 48px',
    fontFamily: "'IBM Plex Sans', sans-serif",
  },
  topBar: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    marginBottom: 20, flexWrap: 'wrap', gap: 12,
  },
  heading: {
    fontSize: 13, fontWeight: 700, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: '#6b7280', margin: 0,
  },
  meta:      { fontSize: 12, color: '#9ca3af', marginTop: 3 },
  countdown: { color: '#c41230', fontWeight: 700 },
  refreshBtn: (loading) => ({
    background: '#c41230', border: 'none', color: '#fff',
    borderRadius: 6, padding: '7px 16px',
    cursor: loading ? 'not-allowed' : 'pointer',
    fontSize: 12, fontFamily: 'inherit', fontWeight: 700,
    letterSpacing: '0.08em', opacity: loading ? 0.6 : 1, flexShrink: 0,
  }),
  grid: {
    display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start',
  },
  mapBox: {
    background: '#fff', border: '1px solid rgba(0,0,0,0.09)',
    borderRadius: 12, overflow: 'hidden', height: 480,
  },
  sidebar: { display: 'flex', flexDirection: 'column', gap: 12 },
  card: {
    background: '#fff', border: '1px solid rgba(0,0,0,0.09)',
    borderRadius: 12, padding: '18px 20px',
  },
  locName: {
    fontSize: 22, fontWeight: 800, color: '#0a1628',
    letterSpacing: '-0.01em', marginBottom: 4,
  },
  locSub: { fontSize: 13, color: '#6b7280', lineHeight: 1.5 },
  divider: { borderTop: '1px solid rgba(0,0,0,0.07)', margin: '14px 0' },
  label: {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
    textTransform: 'uppercase', color: '#9ca3af', marginBottom: 5,
  },
  value: { fontSize: 13, color: '#374151', lineHeight: 1.55 },
  dotRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  dot: (color) => ({
    width: 8, height: 8, borderRadius: '50%',
    background: color, flexShrink: 0,
    animation: 'pulse 2s infinite',
  }),
  confidence: (c) => ({
    display: 'inline-block', fontSize: 11, fontWeight: 700,
    padding: '2px 8px', borderRadius: 5, marginTop: 6,
    ...(c >= 80
      ? { background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.25)', color: '#16a34a' }
      : c >= 50
      ? { background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.25)', color: '#d97706' }
      : { background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.1)', color: '#6b7280' }),
  }),
  nextCard: {
    background: '#fff',
    border: '1px solid rgba(196,18,48,0.2)',
    borderLeft: '3px solid #c41230',
    borderRadius: 10,
    padding: '16px 18px',
  },
  nextLabel: {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
    textTransform: 'uppercase', color: '#c41230', marginBottom: 8,
    display: 'flex', alignItems: 'center', gap: 6,
  },
  nextArrow: { fontSize: 14, color: '#c41230' },
  nextName: { fontSize: 17, fontWeight: 800, color: '#0a1628', marginBottom: 3 },
  nextSub:  { fontSize: 12, color: '#6b7280', lineHeight: 1.5 },
  nextTime: {
    marginTop: 8, fontSize: 11, fontWeight: 700,
    color: '#003087', background: 'rgba(0,48,135,0.06)',
    border: '1px solid rgba(0,48,135,0.15)',
    borderRadius: 5, padding: '2px 8px', display: 'inline-block',
  },
  histItem: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
    padding: '7px 0', borderBottom: '1px solid rgba(0,0,0,0.05)',
    fontSize: 12,
  },
  histLoc:  { color: '#374151', fontWeight: 600 },
  histTime: { color: '#9ca3af', fontSize: 11 },
  spinner: {
    width: 32, height: 32,
    border: '3px solid rgba(196,18,48,0.15)', borderTop: '3px solid #c41230',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    margin: '80px auto',
  },
  error: {
    background: 'rgba(196,18,48,0.06)', border: '1px solid rgba(196,18,48,0.2)',
    borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#c41230',
    marginBottom: 14,
  },
  notice: {
    background: 'rgba(0,48,135,0.05)', border: '1px solid rgba(0,48,135,0.15)',
    borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#003087',
    marginBottom: 14,
  },
}

export default function LocationMap() {
  const [locData, setLocData]       = useState(() => loadStored())
  const [history, setHistory]       = useState([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const mapRef                      = useRef(null)
  const leafletMapRef               = useRef(null)
  const markerRef                   = useRef(null)
  const nextMarkerRef               = useRef(null)
  const routeLineRef                = useRef(null)
  const intervalRef                 = useRef(null)
  const timeoutRef                  = useRef(null)
  const leafletLoadedRef            = useRef(false)

  const msUntilNextHour = () => {
    const now = new Date(), next = new Date(now)
    next.setHours(now.getHours() + 1, 0, 0, 0)
    return next - now
  }

  // ── Load Leaflet from CDN ──
  const loadLeaflet = useCallback(() => new Promise((resolve) => {
    if (window.L) { resolve(); return }
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = resolve
    document.head.appendChild(script)
  }), [])

  // ── Init / update map ──
  const initMap = useCallback(async (lat, lng, locationName, nextLat, nextLng, nextName) => {
    await loadLeaflet()
    if (!mapRef.current || !window.L) return

    const L = window.L

    const currentIcon = L.divIcon({
      className: '',
      html: `<div style="width:18px;height:18px;border-radius:50%;background:#c41230;border:3px solid #fff;box-shadow:0 0 0 2px #c41230,0 2px 8px rgba(0,0,0,0.25);"></div>`,
      iconSize: [18, 18], iconAnchor: [9, 9],
    })
    const nextIcon = L.divIcon({
      className: '',
      html: `<div style="width:14px;height:14px;border-radius:50%;background:#fff;border:3px solid #c41230;box-shadow:0 2px 6px rgba(0,0,0,0.2);"></div>`,
      iconSize: [14, 14], iconAnchor: [7, 7],
    })

    if (leafletMapRef.current) {
      // Update existing map
      leafletMapRef.current.setView([lat, lng], 8, { animate: true })
      if (markerRef.current) markerRef.current.setLatLng([lat, lng]).getPopup()?.setContent(`<strong>${locationName}</strong>`)

      // Remove old route + next marker
      if (routeLineRef.current)  { routeLineRef.current.remove();  routeLineRef.current  = null }
      if (nextMarkerRef.current) { nextMarkerRef.current.remove(); nextMarkerRef.current = null }

      if (nextLat && nextLng) {
        routeLineRef.current = L.polyline([[lat, lng], [nextLat, nextLng]], {
          color: '#c41230', weight: 2, dashArray: '6 6', opacity: 0.6,
        }).addTo(leafletMapRef.current)
        nextMarkerRef.current = L.marker([nextLat, nextLng], { icon: nextIcon })
          .addTo(leafletMapRef.current)
          .bindPopup(`<strong>${nextName}</strong><br><span style="font-size:11px;color:#6b7280;">Next stop</span>`, { offset: [0, -6] })
        const bounds = L.latLngBounds([[lat, lng], [nextLat, nextLng]])
        leafletMapRef.current.fitBounds(bounds, { padding: [60, 60] })
      }
      return
    }

    // First init
    const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: true })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 18,
    }).addTo(map)

    const marker = L.marker([lat, lng], { icon: currentIcon }).addTo(map)
    marker.bindPopup(`<strong>${locationName}</strong>`, { offset: [0, -8] }).openPopup()

    if (nextLat && nextLng) {
      routeLineRef.current = L.polyline([[lat, lng], [nextLat, nextLng]], {
        color: '#c41230', weight: 2, dashArray: '6 6', opacity: 0.6,
      }).addTo(map)
      nextMarkerRef.current = L.marker([nextLat, nextLng], { icon: nextIcon })
        .addTo(map)
        .bindPopup(`<strong>${nextName}</strong><br><span style="font-size:11px;color:#6b7280;">Next stop</span>`, { offset: [0, -6] })
      const bounds = L.latLngBounds([[lat, lng], [nextLat, nextLng]])
      map.fitBounds(bounds, { padding: [60, 60] })
    } else {
      map.setView([lat, lng], 10)
    }

    leafletMapRef.current = map
    markerRef.current     = marker
  }, [loadLeaflet])

  // ── Fetch location from server ──
  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'location' }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const loc = {
        name:            data.location      ?? 'Unknown',
        description:     data.description   ?? '',
        lat:             data.lat           ?? 38.8977,
        lng:             data.lng           ?? -77.0365,
        confidence:      data.confidence    ?? 0,
        source:          data.source        ?? '',
        nextLocation:    data.nextLocation  ?? null,
        nextDescription: data.nextDescription ?? null,
        nextLat:         data.nextLat       ?? null,
        nextLng:         data.nextLng       ?? null,
        nextTime:        data.nextTime      ?? null,
        fetchedAt:       new Date().toISOString(),
      }

      setLocData(loc)
      saveLocation(loc)
      setHistory(prev => [loc, ...prev].slice(0, 10))
      setLastUpdated(new Date())
      initMap(loc.lat, loc.lng, loc.name, loc.nextLat, loc.nextLng, loc.nextLocation)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [initMap])

  // ── Init map with stored location on mount ──
  useEffect(() => {
    if (locData) {
      initMap(locData.lat, locData.lng, locData.name, locData.nextLat, locData.nextLng, locData.nextLocation)
    }
    refresh()
    timeoutRef.current = setTimeout(() => {
      refresh()
      intervalRef.current = setInterval(refresh, REFRESH_MS)
    }, msUntilNextHour())
    return () => {
      clearTimeout(timeoutRef.current)
      clearInterval(intervalRef.current)
      if (leafletMapRef.current) {
        leafletMapRef.current.remove()
        leafletMapRef.current = null
        markerRef.current     = null
      }
    }
  }, [])

  return (
    <div style={s.root}>
      <div style={s.topBar}>
        <div>
          <p style={s.heading}>Trump Location Tracker</p>
          {lastUpdated && (
            <p style={s.meta}>
              Updated {lastUpdated.toLocaleTimeString()} · Updates at the top of the hour
            </p>
          )}
        </div>
        <button style={s.refreshBtn(loading)} onClick={refresh} disabled={loading}>
          {loading ? 'Locating...' : 'Refresh Now'}
        </button>
      </div>

      <div style={s.notice}>
        Location determined from White House schedule, pool reports, and recent news. Updated hourly.
      </div>

      {error && <div style={s.error}>Error: {error}</div>}

      <div style={s.grid}>
        {/* Map */}
        <div style={s.mapBox}>
          {loading && !locData
            ? <div style={s.spinner} />
            : <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
          }
        </div>

        {/* Sidebar */}
        <div style={s.sidebar}>
          {locData && (
            <div style={s.card}>
              <div style={s.dotRow}>
                <span style={s.dot(loading ? '#d97706' : '#16a34a')} />
                <span style={{ fontSize: 11, color: '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {loading ? 'Updating...' : 'Current Location'}
                </span>
              </div>
              <div style={s.locName}>{locData.name}</div>
              {locData.description && <div style={s.locSub}>{locData.description}</div>}
              <span style={s.confidence(locData.confidence)}>
                {locData.confidence}% confidence
              </span>

              <div style={s.divider} />

              <div style={s.label}>Source</div>
              <div style={s.value}>{locData.source || '—'}</div>

              <div style={{ ...s.divider, marginTop: 10 }} />

              <div style={s.label}>Coordinates</div>
              <div style={{ ...s.value, fontFamily: 'monospace', fontSize: 12 }}>
                {locData.lat?.toFixed(4)}, {locData.lng?.toFixed(4)}
              </div>
            </div>
          )}

          {locData?.nextLocation && (
            <div style={s.nextCard}>
              <div style={s.nextLabel}>
                <span style={s.nextArrow}>→</span> Next Stop
              </div>
              <div style={s.nextName}>{locData.nextLocation}</div>
              {locData.nextDescription && <div style={s.nextSub}>{locData.nextDescription}</div>}
              {locData.nextTime && <div style={s.nextTime}>{locData.nextTime}</div>}
            </div>
          )}

          {history.length > 1 && (
            <div style={s.card}>
              <div style={s.label}>Location History</div>
              {history.slice(1).map((h, i) => (
                <div key={i} style={s.histItem}>
                  <span style={s.histLoc}>{h.name}</span>
                  <span style={s.histTime}>
                    {new Date(h.fetchedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
