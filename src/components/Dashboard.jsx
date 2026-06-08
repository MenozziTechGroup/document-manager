import { useState } from 'react'
import { CATEGORIES, CATEGORY_MAP, STATUS_MAP, FILE_TYPE_INFO, DOMAIN_MAP, reviewStatus } from '../data/categories'

function DocRow({ doc, onClick }) {
  const status = STATUS_MAP[doc.status] ?? STATUS_MAP.active
  const hasPdf = !!doc.pdfPath
  const hasDocx = !!doc.docxPath

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors hover:bg-white/70 group"
    >
      {/* File type pill */}
      <div className="flex gap-1 flex-shrink-0">
        {hasDocx && (
          <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{ background: '#dbeafe', color: '#2b579a' }}>W</span>
        )}
        {hasPdf && (
          <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{ background: '#fee2e2', color: '#dc2626' }}>PDF</span>
        )}
        {!hasDocx && !hasPdf && (
          <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{ background: '#f3f4f6', color: '#6b7280' }}>
            {(doc.fileType ?? 'doc').toUpperCase()}
          </span>
        )}
      </div>

      {/* Title */}
      <span className="flex-1 text-sm truncate" style={{ color: '#1f2937' }}>
        {doc.title}
      </span>

      {/* Client name */}
      {doc.clientName && (
        <span className="text-xs flex-shrink-0 hidden group-hover:inline" style={{ color: '#9ca3af' }}>
          {doc.clientName}
        </span>
      )}

      {/* Status */}
      <span
        className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
        style={{ background: status.bg, color: status.color }}
      >
        {status.label}
      </span>
    </button>
  )
}

export default function Dashboard({ docs, onSelectDoc, onNavigateCategory, onNavigateDomain, onNavigateClient, onScanVault, scanning, vaultPath, onAddDoc, onToggleFavorite }) {
  const [browseMode, setBrowseMode] = useState('type') // type | domain | client

  // Group docs by category, preserving CATEGORIES order
  const byCategory = {}
  for (const cat of CATEGORIES) byCategory[cat.id] = []
  for (const doc of docs) {
    if (byCategory[doc.category]) byCategory[doc.category].push(doc)
    else byCategory['Other'] = [...(byCategory['Other'] ?? []), doc]
  }

  // Group by domain and by client (only entries that have values)
  const byDomain = {}
  const byClient = {}
  for (const doc of docs) {
    if (doc.domain) (byDomain[doc.domain] ??= []).push(doc)
    if (doc.clientName) (byClient[doc.clientName] ??= []).push(doc)
  }

  // Type-breakdown badges for a set of docs (e.g. "3 SOP · 1 CHK")
  const typeBreakdown = (set) => {
    const counts = {}
    for (const d of set) {
      const code = CATEGORY_MAP[d.category]?.code ?? 'OTH'
      counts[code] = (counts[code] ?? 0) + 1
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }

  const totalDocs = docs.length
  const activeDocs = docs.filter((d) => d.status === 'active').length
  const pairedDocs = docs.filter((d) => d.pdfPath && d.docxPath).length
  const needsReviewDocs = docs.filter((d) => {
    const rs = reviewStatus(d.reviewBy)
    return rs && rs.urgent
  })
  const favoriteDocs = docs.filter((d) => d.favorite)
  const recentDocs = docs
    .filter((d) => d.lastOpened)
    .sort((a, b) => b.lastOpened.localeCompare(a.lastOpened))
    .slice(0, 6)

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: '#e5e7eb', background: 'white' }}
      >
        <div>
          <h1 className="font-semibold text-base" style={{ color: 'var(--mits-charcoal)' }}>
            Document Library
          </h1>
          <div className="flex gap-4 mt-1">
            <Stat label="Total" value={totalDocs} />
            <Stat label="Active" value={activeDocs} color="#16a34a" />
            <Stat label="Paired (W+PDF)" value={pairedDocs} color="#2563eb" />
            {needsReviewDocs.length > 0 && (
              <Stat label="Needs Review" value={needsReviewDocs.length} color="#dc2626" />
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {vaultPath && (
            <button
              onClick={onScanVault}
              disabled={scanning}
              className="text-xs px-3 py-1.5 rounded border transition-colors hover:bg-gray-50 flex items-center gap-1.5"
              style={{ borderColor: '#d1d5db', color: '#6b7280' }}
            >
              {scanning ? (
                <>
                  <span className="animate-spin inline-block w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full" />
                  Scanning…
                </>
              ) : (
                <>↻ Sync Vault</>
              )}
            </button>
          )}
          <button
            onClick={onAddDoc}
            className="text-xs px-3 py-1.5 rounded text-white flex items-center gap-1.5"
            style={{ background: 'var(--mits-red)' }}
          >
            + Add Document
          </button>
        </div>
      </div>

      {/* Needs Review alert strip */}
      {needsReviewDocs.length > 0 && (
        <div className="px-4 pt-4">
          <div
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: '#fca5a5', background: '#fff' }}
          >
            <div
              className="flex items-center gap-2 px-4 py-2.5 border-b"
              style={{ borderColor: '#fca5a5', background: '#fff5f5', borderLeft: '4px solid #dc2626' }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="#dc2626">
                <path d="M7 1a6 6 0 100 12A6 6 0 007 1zm0 3v3.5M7 9.5v1"/>
              </svg>
              <span className="text-sm font-semibold" style={{ color: '#dc2626' }}>
                {needsReviewDocs.length} document{needsReviewDocs.length > 1 ? 's' : ''} need{needsReviewDocs.length === 1 ? 's' : ''} review
              </span>
            </div>
            <div className="py-1">
              {needsReviewDocs.slice(0, 5).map((doc) => {
                const rs = reviewStatus(doc.reviewBy)
                return (
                  <button
                    key={doc.id}
                    onClick={() => onSelectDoc(doc)}
                    className="w-full flex items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-gray-50"
                  >
                    <span className="flex-1 text-sm font-medium truncate" style={{ color: '#1f2937' }}>{doc.title}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                      style={{ background: rs.bg, color: rs.color }}>
                      {rs.label}
                    </span>
                    <span className="text-xs flex-shrink-0" style={{ color: '#9ca3af' }}>{doc.category}</span>
                  </button>
                )
              })}
              {needsReviewDocs.length > 5 && (
                <div className="px-4 py-1.5 text-xs" style={{ color: '#9ca3af' }}>
                  + {needsReviewDocs.length - 5} more
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recently Opened + Favorites */}
      {totalDocs > 0 && (recentDocs.length > 0 || favoriteDocs.length > 0) && (
        <div className="grid gap-4 px-4 pt-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))' }}>
          {recentDocs.length > 0 && (
            <ShortcutCard title="Recently Opened" accent="#6b7280" icon="clock">
              {recentDocs.map((doc) => (
                <DocRow key={doc.id} doc={doc} onClick={() => onSelectDoc(doc)} />
              ))}
            </ShortcutCard>
          )}
          {favoriteDocs.length > 0 && (
            <ShortcutCard title="Favorites" accent="#f59e0b" icon="star">
              {favoriteDocs.map((doc) => (
                <DocRow key={doc.id} doc={doc} onClick={() => onSelectDoc(doc)} />
              ))}
            </ShortcutCard>
          )}
        </div>
      )}

      {/* Browse toggle */}
      {totalDocs > 0 && (
        <div className="flex items-center gap-2 px-4 pt-4">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#6b7280' }}>Browse Library</span>
          <div className="flex rounded-md overflow-hidden border" style={{ borderColor: '#d8d8dc' }}>
            {[
              { id: 'type', label: 'By Type' },
              { id: 'domain', label: 'By Domain' },
              { id: 'client', label: 'By Client' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setBrowseMode(m.id)}
                className="text-xs px-3 py-1 transition-colors"
                style={{ background: browseMode === m.id ? 'var(--mits-red)' : 'white', color: browseMode === m.id ? 'white' : '#374151', fontWeight: browseMode === m.id ? 600 : 400 }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sections */}
      <div className="flex-1 p-4">
        {totalDocs === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center" style={{ color: '#9ca3af' }}>
            <div className="text-sm font-medium">No documents yet</div>
            <div className="text-xs mt-1">
              {vaultPath ? 'Click "Sync Vault" to import your documents' : 'Configure your vault path in Settings'}
            </div>
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))' }}>
            {browseMode === 'type' && CATEGORIES.map((cat) => {
              const catDocs = byCategory[cat.id] ?? []
              if (catDocs.length === 0) return null
              return (
                <GroupCard
                  key={cat.id}
                  title={cat.label}
                  color={cat.color}
                  count={catDocs.length}
                  docs={catDocs}
                  onSelectDoc={onSelectDoc}
                  onViewAll={() => onNavigateCategory(cat.id)}
                />
              )
            })}

            {browseMode === 'domain' && (
              Object.keys(byDomain).length === 0 ? (
                <EmptyBrowse label="No documents have a domain yet. Set a domain when adding or editing a document." />
              ) : Object.keys(byDomain).sort().map((code) => (
                <GroupCard
                  key={code}
                  title={DOMAIN_MAP[code]?.label ?? code}
                  subtitle={code}
                  color="#4338ca"
                  count={byDomain[code].length}
                  badges={typeBreakdown(byDomain[code])}
                  docs={byDomain[code]}
                  onSelectDoc={onSelectDoc}
                  onViewAll={() => onNavigateDomain(code)}
                />
              ))
            )}

            {browseMode === 'client' && (
              Object.keys(byClient).length === 0 ? (
                <EmptyBrowse label="No documents have a client yet. Set a client name when adding or editing a document." />
              ) : Object.keys(byClient).sort().map((name) => (
                <GroupCard
                  key={name}
                  title={name}
                  color="#0891b2"
                  count={byClient[name].length}
                  badges={typeBreakdown(byClient[name])}
                  docs={byClient[name]}
                  onSelectDoc={onSelectDoc}
                  onViewAll={() => onNavigateClient(name)}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function GroupCard({ title, subtitle, color, count, badges, docs, onSelectDoc, onViewAll }) {
  const PREVIEW_COUNT = 8

  return (
    <div className="rounded-xl overflow-hidden border" style={{ background: 'white', borderColor: '#e5e7eb' }}>
      {/* Header */}
      <div className="px-4 py-3 border-b" style={{ borderColor: '#f3f4f6', borderLeft: `4px solid ${color}` }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
            {subtitle && <span className="text-xs font-mono px-1 rounded flex-shrink-0" style={{ background: '#eef2ff', color: '#4338ca' }}>{subtitle}</span>}
            <span className="font-semibold text-sm truncate" style={{ color: 'var(--mits-charcoal)' }}>{title}</span>
            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0" style={{ background: `${color}22`, color }}>{count}</span>
          </div>
          <button onClick={onViewAll} className="text-xs transition-colors hover:underline flex-shrink-0" style={{ color }}>
            View all →
          </button>
        </div>
        {badges && badges.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {badges.map(([code, n]) => (
              <span key={code} className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: '#eaeff4', color: '#0e2841' }}>
                {n} {code}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Document list */}
      <div className="py-1">
        {docs.slice(0, PREVIEW_COUNT).map((doc) => (
          <DocRow key={doc.id} doc={doc} onClick={() => onSelectDoc(doc)} />
        ))}
        {docs.length > PREVIEW_COUNT && (
          <button
            onClick={onViewAll}
            className="w-full text-xs py-2 text-center transition-colors hover:bg-gray-50"
            style={{ color: '#9ca3af' }}
          >
            + {docs.length - PREVIEW_COUNT} more — View all
          </button>
        )}
      </div>
    </div>
  )
}

function EmptyBrowse({ label }) {
  return (
    <div className="text-sm text-center py-10" style={{ color: '#9ca3af', gridColumn: '1 / -1' }}>
      {label}
    </div>
  )
}

function ShortcutCard({ title, accent, icon, children }) {
  return (
    <div className="rounded-xl overflow-hidden border" style={{ background: 'white', borderColor: '#e5e7eb' }}>
      <div
        className="flex items-center gap-2 px-4 py-3 border-b"
        style={{ borderColor: '#f3f4f6', borderLeft: `4px solid ${accent}` }}
      >
        {icon === 'star' ? (
          <svg width="13" height="13" viewBox="0 0 16 16" fill={accent}>
            <path d="M8 1l2.1 4.3 4.7.7-3.4 3.3.8 4.7L8 11.8 3.8 14l.8-4.7L1.2 6l4.7-.7L8 1z"/>
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke={accent} strokeWidth="1.5">
            <circle cx="8" cy="8" r="6.5"/><path d="M8 4.5V8l2.5 2"/>
          </svg>
        )}
        <span className="font-semibold text-sm" style={{ color: 'var(--mits-charcoal)' }}>{title}</span>
      </div>
      <div className="py-1">{children}</div>
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div className="flex items-center gap-1.5 text-xs" style={{ color: '#6b7280' }}>
      <span className="font-semibold text-sm" style={{ color: color ?? 'var(--mits-charcoal)' }}>{value}</span>
      <span>{label}</span>
    </div>
  )
}
