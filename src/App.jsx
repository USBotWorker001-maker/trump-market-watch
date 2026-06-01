import { useState } from 'react'
import TrumpStockTracker from './TrumpStockTracker'
import TruthSocialFeed from './TruthSocialFeed'
import CongressFeed from './CongressFeed'
import LocationMap from './LocationMap'

const tabs = [
  { id: 'stocks',   label: 'Stock Mentions'      },
  { id: 'truth',    label: 'Truth Social'         },
  { id: 'congress', label: 'Congressional Trades' },
  { id: 'location', label: 'Location'             },
]

const s = {
  tabBar: {
    position: 'relative',
    zIndex: 2,
    background: '#ffffff',
    borderBottom: '2px solid rgba(0,0,0,0.07)',
    display: 'flex',
    gap: 0,
    padding: '0 12px',
  },
  tab: (active) => ({
    padding: '12px 16px',
    fontSize: 11,
    fontWeight: 700,
    fontFamily: "'IBM Plex Sans', sans-serif",
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    border: 'none',
    background: 'transparent',
    color: active ? '#c41230' : '#9ca3af',
    borderBottom: active ? '2px solid #c41230' : '2px solid transparent',
    marginBottom: -2,
    transition: 'color 0.15s',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  }),
}

export default function App() {
  const [activeTab, setActiveTab] = useState('stocks')

  return (
    <div>
      <div style={s.tabBar} className="tab-bar">
        {tabs.map(t => (
          <button key={t.id} style={s.tab(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {activeTab === 'stocks'   && <TrumpStockTracker />}
      {activeTab === 'truth'    && <TruthSocialFeed />}
      {activeTab === 'congress' && <CongressFeed />}
      {activeTab === 'location' && <LocationMap />}
    </div>
  )
}
