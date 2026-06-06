import { CATEGORIES } from '../data/categories'

const NAV_ITEMS = [
  { id: 'all', label: 'All Documents', icon: GridIcon },
  { id: 'groups', label: 'Playbooks & Groups', icon: GroupIcon },
]

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

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 10a2 2 0 100-4 2 2 0 000 4zm5.7-2.7l1.1-.9-1-1.7-1.4.4a5 5 0 00-.8-.5L11.3 3H9.7l-.3 1.6a5 5 0 00-.8.5L7.2 4.7l-1 1.7 1.1.9a5 5 0 000 1l-1.1.9 1 1.7 1.4-.4a5 5 0 00.8.5l.3 1.6h1.6l.3-1.6a5 5 0 00.8-.5l1.4.4 1-1.7-1.1-.9a5 5 0 000-1z"/>
    </svg>
  )
}

export default function Sidebar({ view, selectedCategory, docs, groups, onNavigate, onSettings }) {
  const countsByCategory = {}
  if (docs) {
    docs.forEach((d) => {
      countsByCategory[d.category] = (countsByCategory[d.category] ?? 0) + 1
    })
  }

  const isActive = (id) => {
    if (id === 'all') return view === 'all'
    if (id === 'groups') return view === 'groups'
    return view === 'category' && selectedCategory === id
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
          DM
        </div>
        <div>
          <div className="font-semibold text-white text-sm leading-tight">DocManager</div>
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
          const active = isActive(cat.id)
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
      </nav>

      {/* Settings */}
      <div className="border-t border-white/10 p-2">
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
