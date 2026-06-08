import { CATEGORIES, DOMAIN_MAP } from '../data/categories'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
  { id: 'all', label: 'All Documents', icon: GridIcon },
  { id: 'groups', label: 'Playbooks', icon: GroupIcon },
]

function DashboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="1" y="1" width="6" height="9" rx="1"/>
      <rect x="9" y="1" width="6" height="4" rx="1"/>
      <rect x="9" y="7" width="6" height="8" rx="1"/>
      <rect x="1" y="12" width="6" height="3" rx="1"/>
    </svg>
  )
}

function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="1" y="1" width="6" height="6" rx="1"/>
      <rect x="9" y="1" width="6" height="6" rx="1"/>
      <rect x="1" y="9" width="6" height="6" rx="1"/>
      <rect x="9" y="9" width="6" height="6" rx="1"/>
    </svg>
  )
}

function GroupIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 3h12v2H2zM2 7h10v2H2zM2 11h8v2H2z"/>
    </svg>
  )
}

function HelpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6.5" />
      <path d="M6.2 6.2a1.9 1.9 0 0 1 3.6.6c0 1.2-1.8 1.6-1.8 2.7" strokeLinecap="round" />
      <circle cx="8" cy="11.6" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M2 4.5h12M2 8h12M2 11.5h12" />
      <circle cx="6" cy="4.5" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="10" cy="8" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="5" cy="11.5" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  )
}

function ClientIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
      <circle cx="5" cy="3.5" r="2"/>
      <path d="M1 9c0-2.2 1.8-4 4-4s4 1.8 4 4" fill="currentColor" opacity="0.7"/>
    </svg>
  )
}

export default function Sidebar({ view, selectedCategory, selectedClient, selectedDomain, docs, groups, onNavigate, onSettings }) {
  const countsByCategory = {}
  const countsByClient = {}
  const countsByDomain = {}
  if (docs) {
    docs.forEach((d) => {
      countsByCategory[d.category] = (countsByCategory[d.category] ?? 0) + 1
      if (d.clientName) {
        countsByClient[d.clientName] = (countsByClient[d.clientName] ?? 0) + 1
      }
      if (d.domain) {
        countsByDomain[d.domain] = (countsByDomain[d.domain] ?? 0) + 1
      }
    })
  }

  // Sorted lists of unique client names / domain codes
  const clientNames = Object.keys(countsByClient).sort()
  const domainCodes = Object.keys(countsByDomain).sort()

  const isActive = (id) => {
    if (id === 'all') return view === 'all'
    if (id === 'groups') return view === 'groups'
    if (id === 'dashboard') return view === 'dashboard'
    return false
  }

  return (
    <aside
      className="flex flex-col h-full text-sm"
      style={{ width: 'var(--sidebar-width)', background: 'var(--sidebar-bg)', color: '#e5e5e5' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-white/10">
        <div
          className="w-7 h-7 rounded flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
          style={{ background: 'var(--mits-red)' }}
        >
          DC
        </div>
        <div>
          <div className="font-semibold text-white text-sm leading-tight">DocCenter</div>
          <div className="text-xs" style={{ color: 'var(--mits-gray-light)' }}>Menozzi IT Solutions</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {/* Primary nav */}
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className="w-full flex items-center gap-2.5 px-4 py-2 text-left transition-colors"
            style={{
              background: isActive(id) ? 'rgba(225,37,27,0.25)' : 'transparent',
              color: isActive(id) ? 'white' : '#ccc',
            }}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}

        {/* Categories */}
        <div className="px-4 pt-4 pb-1 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--mits-gray)' }}>
          Categories
        </div>
        {CATEGORIES.map((cat) => {
          const count = countsByCategory[cat.id] ?? 0
          const active = view === 'category' && selectedCategory === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => onNavigate('category', cat.id)}
              className="w-full flex items-center justify-between px-4 py-1.5 text-left transition-colors"
              style={{
                background: active ? 'rgba(225,37,27,0.25)' : 'transparent',
                color: active ? 'white' : '#ccc',
              }}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                <span>{cat.label}</span>
              </div>
              {count > 0 && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.1)', color: '#bbb' }}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}

        {/* Domains */}
        {domainCodes.length > 0 && (
          <>
            <div className="px-4 pt-4 pb-1 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--mits-gray)' }}>
              By Domain
            </div>
            {domainCodes.map((code) => {
              const active = view === 'domain' && selectedDomain === code
              return (
                <button
                  key={code}
                  onClick={() => onNavigate('domain', code)}
                  className="w-full flex items-center justify-between px-4 py-1.5 text-left transition-colors"
                  style={{
                    background: active ? 'rgba(225,37,27,0.25)' : 'transparent',
                    color: active ? 'white' : '#ccc',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono px-1 rounded" style={{ background: 'rgba(255,255,255,0.08)', color: '#bbb' }}>{code}</span>
                    <span className="truncate" style={{ maxWidth: 110 }}>{DOMAIN_MAP[code]?.label ?? code}</span>
                  </div>
                  <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(255,255,255,0.1)', color: '#bbb' }}>
                    {countsByDomain[code]}
                  </span>
                </button>
              )
            })}
          </>
        )}

        {/* Clients */}
        {clientNames.length > 0 && (
          <>
            <div className="px-4 pt-4 pb-1 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--mits-gray)' }}>
              By Client
            </div>
            {clientNames.map((name) => {
              const active = view === 'client' && selectedClient === name
              return (
                <button
                  key={name}
                  onClick={() => onNavigate('client', name)}
                  className="w-full flex items-center justify-between px-4 py-1.5 text-left transition-colors"
                  style={{
                    background: active ? 'rgba(225,37,27,0.25)' : 'transparent',
                    color: active ? 'white' : '#ccc',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <ClientIcon />
                    <span className="truncate" style={{ maxWidth: 120 }}>{name}</span>
                  </div>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: 'rgba(255,255,255,0.1)', color: '#bbb' }}
                  >
                    {countsByClient[name]}
                  </span>
                </button>
              )
            })}
          </>
        )}
      </nav>

      {/* Help + Settings */}
      <div className="border-t border-white/10 p-2 space-y-0.5">
        <button
          onClick={() => onNavigate('help')}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded transition-colors"
          style={{
            background: view === 'help' ? 'rgba(225,37,27,0.25)' : 'transparent',
            color: view === 'help' ? 'white' : '#aaa',
          }}
        >
          <HelpIcon />
          <span>Help &amp; Guide</span>
        </button>
        <button
          onClick={onSettings}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded transition-colors"
          style={{
            background: view === 'settings' ? 'rgba(225,37,27,0.25)' : 'transparent',
            color: view === 'settings' ? 'white' : '#aaa',
          }}
        >
          <SettingsIcon />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  )
}
