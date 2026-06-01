import { useState } from 'react'
import TrumpStockTracker from './TrumpStockTracker'
import TruthSocialFeed from './TruthSocialFeed'
import CongressFeed from './CongressFeed'

const tabs = [
  { id: 'stocks',   label: 'Stock Mentions'       },
  { id: 'truth',    label: 'Truth Social'          },
  { id: 'congress', label: 'Congressional Trades'  },
]

const s = {
  tabBar: {
    position: 'relative',
    zIndex: 2,
    background: '#ffffff',
    borderBottom: '2px solid rgba(0,0,0,0.07)',
    display: 'flex',
    gap: 0,
    padding: '0 24px',
  },
  tab: (active) => ({
    padding: '13px 22px',
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "'IBM Plex Sans', sans-serif",
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    border: 'none',
    background: 'transparent',
    color: active ? '#c41230' : '#9ca3af',
    borderBottom: active ? '2px solid #c41230' : '2px solid transparent',
    marginBottom: -2,
    transition: 'color 0.15s',
  }),
}

export default function App() {
  const [activeTab, setActiveTab] = useState('stocks')

  return (
    <div>
      <div style={s.tabBar}>
        {tabs.map(t => (
          <button key={t.id} style={s.tab(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {activeTab === 'stocks'   && <TrumpStockTracker />}
      {activeTab === 'truth'    && <TruthSocialFeed />}
      {activeTab === 'congress' && <CongressFeed />}
    </div>
  )
}
