import { useState, useMemo, useRef, useEffect } from 'react'
import DocumentCard from './DocumentCard'
import { reviewStatus, CATEGORY_MAP, getCategoryInfo, STATUSES } from '../data/categories'

const SORT_OPTIONS = [
  { id: 'title-asc',   label: 'Title A–Z' },
  { id: 'title-desc',  label: 'Title Z–A' },
  { id: 'newest',      label: 'Date Added ↓' },
  { id: 'oldest',      label: 'Date Added ↑' },
  { id: 'updated',     label: 'Recently Updated' },
  { id: 'review',      label: 'Review Date ↑' },
]

export default function DocumentList({
  docs,
  title,
  subtitle,
  selectedDocId,
  onSelectDoc,
  onAddDoc,
  onScanVault,
  scanning,
  vaultPath,
  onToggleFavorite,
  missingIds,
  onBulkUpdate,
  onBulkDelete,
  onBulkAddToPlaybook,
  playbooks = [],
}) {
  // Derive category list dynamically from all docs passed in
  const categoryList = useMemo(() => {
    const names = [...new Set(docs.map((d) => d.category))]
    const knownOrder = Object.keys(CATEGORY_MAP)
    return [
      ...knownOrder.filter((k) => names.includes(k)),
      ...names.filter((n) => !CATEGORY_MAP[n]).sort(),
    ]
  }, [docs])

  const [sortBy, setSortBy] = useState('title-asc')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [filterReview, setFilterReview] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  // ── Bulk selection ──
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [bulkTag, setBulkTag] = useState('')
  const [bulkReview, setBulkReview] = useState('')

  const toggleSelect = (id) => setSelected((prev) => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const exitSelect = () => { setSelectMode(false); setSelected(new Set()); setBulkTag(''); setBulkReview('') }
  const applyBulk = async (changes) => {
    if (selected.size === 0) return
    await onBulkUpdate([...selected], changes)
    setBulkTag(''); setBulkReview('')
  }
  const bulkRemove = async () => {
    if (selected.size === 0) return
    if (confirm(`Remove ${selected.size} document${selected.size > 1 ? 's' : ''} from the library? The files on disk are not deleted.`)) {
      await onBulkDelete([...selected])
      exitSelect()
    }
  }

  const processed = useMemo(() => {
    let result = [...docs]

    // Filters
    if (filterStatus !== 'all') {
      result = result.filter((d) => d.status === filterStatus)
    }
    if (filterType === 'paired') {
      result = result.filter((d) => d.pdfPath && d.docxPath)
    } else if (filterType === 'word') {
      result = result.filter((d) => d.docxPath && !d.pdfPath)
    } else if (filterType === 'pdf') {
      result = result.filter((d) => d.pdfPath && !d.docxPath)
    }
    if (filterReview) {
      result = result.filter((d) => {
        const rs = reviewStatus(d.reviewBy)
        return rs && rs.urgent
      })
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'title-desc': return b.title.localeCompare(a.title)
        case 'newest': return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
        case 'oldest': return (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
        case 'updated': return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')
        case 'review': {
          const ra = reviewStatus(a.reviewBy)
          const rb = reviewStatus(b.reviewBy)
          const da = ra ? ra.days : 99999
          const db2 = rb ? rb.days : 99999
          return da - db2
        }
        default: return a.title.localeCompare(b.title)
      }
    })

    return result
  }, [docs, sortBy, filterStatus, filterType, filterReview])

  // Scroll the selected card into view when the selection changes (e.g. when
  // a document is chosen from the dashboard and we land deep in the list).
  const selectedRef = useRef(null)
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }
  }, [selectedDocId])

  // Is any filter active?
  const hasActiveFilters = filterStatus !== 'all' || filterType !== 'all' || filterReview
  const activeFilterCount = [filterStatus !== 'all', filterType !== 'all', filterReview].filter(Boolean).length

  const clearFilters = () => {
    setFilterStatus('all')
    setFilterType('all')
    setFilterReview(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#e5e7eb', background: 'white' }}>
        <div>
          <h1 className="font-semibold text-base" style={{ color: 'var(--mits-charcoal)' }}>{title}</h1>
          {subtitle && <div className="text-xs mt-0.5" style={{ color: '#6b7280' }}>{subtitle}</div>}
        </div>
        <div className="flex gap-2">
          {processed.length > 0 && (
            <button
              onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
              className="text-xs px-3 py-1.5 rounded border transition-colors hover:bg-gray-50"
              style={{ borderColor: selectMode ? '#e1251b' : '#d1d5db', color: selectMode ? '#e1251b' : '#6b7280' }}
            >
              {selectMode ? 'Cancel' : 'Select'}
            </button>
          )}
          {vaultPath && (
            <button
              onClick={onScanVault}
              disabled={scanning}
              title="Scan your vault folder for new or changed documents"
              className="text-xs px-3 py-1.5 rounded border transition-colors hover:bg-gray-50 flex items-center gap-1.5"
              style={{ borderColor: '#d1d5db', color: '#6b7280' }}
            >
              {scanning ? (
                <>
                  <span className="animate-spin inline-block w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full" />
                  Scanning…
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M10 6A4 4 0 112 6a4 4 0 018 0zM6 4v2l1.5 1.5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
                  </svg>
                  Sync Vault
                </>
              )}
            </button>
          )}
          <button
            onClick={onAddDoc}
            className="text-xs px-3 py-1.5 rounded text-white flex items-center gap-1.5"
            style={{ background: 'var(--mits-red)' }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <path d="M5 1v8M1 5h8" stroke="white" strokeWidth="1.5" fill="none"/>
            </svg>
            Add Document
          </button>
        </div>
      </div>

      {/* Sort / Filter toolbar */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b text-xs flex-wrap"
        style={{ borderColor: '#f3f4f6', background: '#fafafa' }}
      >
        {/* Sort */}
        <div className="flex items-center gap-1.5" style={{ color: '#6b7280' }}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor" opacity="0.6">
            <path d="M1 2h9M2 5h7M3 8h5"/>
          </svg>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{ border: 'none', background: 'transparent', fontSize: 12, color: '#374151', outline: 'none', cursor: 'pointer' }}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>

        <div style={{ width: 1, height: 14, background: '#e5e7eb', flexShrink: 0 }} />

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded transition-colors"
          style={{
            background: showFilters || hasActiveFilters ? '#fde8e8' : 'transparent',
            color: hasActiveFilters ? '#e1251b' : '#6b7280',
            border: hasActiveFilters ? '1px solid #fca5a5' : '1px solid transparent',
          }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor" opacity="0.8">
            <path d="M1 2.5h9l-3.5 4v3l-2-1V6.5L1 2.5z"/>
          </svg>
          Filters
          {activeFilterCount > 0 && (
            <span className="px-1 rounded-full text-white text-xs" style={{ background: '#e1251b', fontSize: 10 }}>
              {activeFilterCount}
            </span>
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-xs px-1.5 py-0.5 rounded transition-colors hover:bg-red-50"
            style={{ color: '#9ca3af' }}
          >
            Clear
          </button>
        )}

        {/* Result count after filtering */}
        {docs.length !== processed.length && (
          <span style={{ color: '#9ca3af', marginLeft: 'auto' }}>
            {processed.length} of {docs.length}
          </span>
        )}
      </div>

      {/* Filter panel (expandable) */}
      {showFilters && (
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 border-b text-xs"
          style={{ background: '#fff', borderColor: '#f3f4f6' }}
        >
          <FilterGroup label="Status">
            {[
              { id: 'all', label: 'All' },
              { id: 'active', label: 'Active' },
              { id: 'draft', label: 'Draft' },
              { id: 'archived', label: 'Archived' },
            ].map((o) => (
              <Chip key={o.id} active={filterStatus === o.id} onClick={() => setFilterStatus(o.id)}>
                {o.label}
              </Chip>
            ))}
          </FilterGroup>

          <FilterGroup label="Files">
            {[
              { id: 'all', label: 'All' },
              { id: 'paired', label: 'Paired (W+PDF)' },
              { id: 'word', label: 'Word only' },
              { id: 'pdf', label: 'PDF only' },
            ].map((o) => (
              <Chip key={o.id} active={filterType === o.id} onClick={() => setFilterType(o.id)}>
                {o.label}
              </Chip>
            ))}
          </FilterGroup>

          <FilterGroup label="Review">
            <Chip active={filterReview} onClick={() => setFilterReview((v) => !v)}>
              Needs review
            </Chip>
          </FilterGroup>
        </div>
      )}

      {/* Bulk action bar */}
      {selectMode && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b text-xs" style={{ borderColor: '#fca5a5', background: '#fff7f7' }}>
          <label className="flex items-center gap-1.5 cursor-pointer" style={{ color: '#374151' }}>
            <input
              type="checkbox"
              checked={processed.length > 0 && selected.size === processed.length}
              onChange={(e) => setSelected(e.target.checked ? new Set(processed.map((d) => d.id)) : new Set())}
              style={{ accentColor: '#e1251b' }}
            />
            <span className="font-medium" style={{ color: '#e1251b' }}>{selected.size} selected</span>
          </label>

          <div style={{ width: 1, height: 16, background: '#fca5a5' }} />

          <select disabled={!selected.size} onChange={(e) => { if (e.target.value) applyBulk({ status: e.target.value }); e.target.value = '' }} className="rounded border" style={{ borderColor: '#d1d5db', color: '#374151', padding: '3px 6px', background: 'white' }} defaultValue="">
            <option value="">Set status…</option>
            {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>

          <select disabled={!selected.size} onChange={(e) => { if (e.target.value) applyBulk({ category: e.target.value }); e.target.value = '' }} className="rounded border" style={{ borderColor: '#d1d5db', color: '#374151', padding: '3px 6px', background: 'white' }} defaultValue="">
            <option value="">Set category…</option>
            {categoryList.map((id) => { const c = getCategoryInfo(id); return <option key={id} value={id}>{c.label}</option> })}
          </select>

          <div className="flex items-center gap-1">
            <input value={bulkTag} onChange={(e) => setBulkTag(e.target.value)} placeholder="Add tag…" className="rounded border" style={{ borderColor: '#d1d5db', padding: '3px 6px', width: 90 }} />
            <button disabled={!selected.size || !bulkTag.trim()} onClick={() => applyBulk({ addTag: bulkTag.trim() })} className="px-2 py-1 rounded border" style={{ borderColor: '#d1d5db', color: '#374151', background: 'white' }}>Add</button>
          </div>

          <div className="flex items-center gap-1">
            <input type="date" value={bulkReview} onChange={(e) => setBulkReview(e.target.value)} className="rounded border" style={{ borderColor: '#d1d5db', padding: '3px 6px', colorScheme: 'light' }} />
            <button disabled={!selected.size || !bulkReview} onClick={() => applyBulk({ reviewBy: bulkReview })} className="px-2 py-1 rounded border" style={{ borderColor: '#d1d5db', color: '#374151', background: 'white' }}>Set review</button>
          </div>

          {playbooks.length > 0 && (
            <select disabled={!selected.size} onChange={(e) => { if (e.target.value) onBulkAddToPlaybook([...selected], e.target.value); e.target.value = '' }} className="rounded border" style={{ borderColor: '#d1d5db', color: '#374151', padding: '3px 6px', background: 'white' }} defaultValue="">
              <option value="">Add to playbook…</option>
              {playbooks.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}

          <button disabled={!selected.size} onClick={bulkRemove} className="px-2 py-1 rounded border transition-colors hover:bg-red-50 ml-auto" style={{ borderColor: '#fca5a5', color: '#dc2626' }}>
            Remove
          </button>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {processed.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center" style={{ color: '#9ca3af' }}>
            <div className="text-sm font-medium">
              {hasActiveFilters ? 'No documents match the current filters' : 'No documents here yet'}
            </div>
            {!hasActiveFilters && (
              vaultPath
                ? <div className="text-xs mt-1">Click "Sync Vault" to scan your SharePoint folder</div>
                : <div className="text-xs mt-1">Configure your vault path in Settings to get started</div>
            )}
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs mt-2 underline" style={{ color: '#e1251b' }}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          processed.map((doc) => (
            <div key={doc.id} ref={doc.id === selectedDocId ? selectedRef : null} className="flex items-center gap-2">
              {selectMode && (
                <input
                  type="checkbox"
                  checked={selected.has(doc.id)}
                  onChange={() => toggleSelect(doc.id)}
                  style={{ accentColor: '#e1251b', width: 16, height: 16, flexShrink: 0 }}
                />
              )}
              <div className="flex-1 min-w-0">
                <DocumentCard
                  doc={doc}
                  selected={doc.id === selectedDocId}
                  onClick={() => (selectMode ? toggleSelect(doc.id) : onSelectDoc(doc))}
                  onToggleFavorite={selectMode ? undefined : onToggleFavorite}
                  isMissing={missingIds?.has(doc.id)}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function FilterGroup({ label, children }) {
  return (
    <div className="flex items-center gap-1.5">
      <span style={{ color: '#9ca3af', fontWeight: 500 }}>{label}:</span>
      {children}
    </div>
  )
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-0.5 rounded-full transition-colors"
      style={{
        background: active ? '#fde8e8' : '#f3f4f6',
        color: active ? '#e1251b' : '#6b7280',
        border: active ? '1px solid #fca5a5' : '1px solid transparent',
        fontWeight: active ? 600 : 400,
      }}
    >
      {children}
    </button>
  )
}
