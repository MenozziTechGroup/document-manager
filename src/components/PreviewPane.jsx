import { isTauri } from '../data/db'
import { CATEGORY_MAP, STATUS_MAP } from '../data/categories'

async function openFile(filePath) {
  if (!isTauri()) {
    alert('File opening is only available in the desktop app.')
    return
  }
  const { openPath } = await import('@tauri-apps/plugin-opener')
  await openPath(filePath)
}

export default function PreviewPane({ doc, groups, onEdit, onDelete, onAddToGroup }) {
  if (!doc) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full text-center p-8"
        style={{ color: '#9ca3af' }}
      >
        <svg width="48" height="48" viewBox="0 0 48 48" fill="currentColor" className="mb-3 opacity-40">
          <path d="M12 6h16l10 10v26a2 2 0 01-2 2H12a2 2 0 01-2-2V8a2 2 0 012-2z"/>
          <path d="M28 6v10h10" fill="none" stroke="currentColor" strokeWidth="2"/>
        </svg>
        <div className="font-medium text-sm">Select a document</div>
        <div className="text-xs mt-1">Click any document to see its details</div>
      </div>
    )
  }

  const cat = CATEGORY_MAP[doc.category]
  const status = STATUS_MAP[doc.status] ?? STATUS_MAP.active

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: '#e5e7eb' }}>
        <div className="flex items-start justify-between gap-2 mb-3">
          <h2 className="font-semibold text-sm leading-snug" style={{ color: 'var(--mits-charcoal)' }}>
            {doc.title}
          </h2>
          <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={() => onEdit(doc)}
              className="text-xs px-2 py-1 rounded border transition-colors hover:bg-gray-50"
              style={{ borderColor: '#d1d5db', color: '#6b7280' }}
            >
              Edit
            </button>
            <button
              onClick={() => { if (confirm(`Remove "${doc.title}" from the library? The file on disk is not deleted.`)) onDelete(doc.id) }}
              className="text-xs px-2 py-1 rounded border transition-colors hover:bg-red-50"
              style={{ borderColor: '#fca5a5', color: '#dc2626' }}
            >
              Remove
            </button>
          </div>
        </div>

        {/* Open button */}
        <button
          onClick={() => openFile(doc.filePath)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg font-medium text-sm text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--mits-red)' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <path d="M2 2h5v1H3v8h8V6h1v5a1 1 0 01-1 1H2a1 1 0 01-1-1V3a1 1 0 011-1z"/>
            <path d="M8 1h5v5h-1V2.7L7.4 7.3 6.7 6.6 11.3 2H8V1z"/>
          </svg>
          Open in {doc.fileType === 'pdf' ? 'PDF Viewer' : 'Word'}
        </button>
      </div>

      {/* Metadata */}
      <div className="p-4 space-y-3 text-sm">
        <Row label="Category">
          {cat ? (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: cat.bg, color: cat.color }}>
              {cat.label}
            </span>
          ) : doc.category}
        </Row>

        <Row label="Status">
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: status.bg, color: status.color }}>
            {status.label}
          </span>
        </Row>

        <Row label="File type">
          <span className="text-xs font-medium uppercase" style={{ color: doc.fileType === 'pdf' ? '#dc2626' : '#2b579a' }}>
            {doc.fileType}
          </span>
        </Row>

        {doc.version && <Row label="Version">{doc.version}</Row>}
        {doc.clientName && <Row label="Client">{doc.clientName}</Row>}

        {doc.description && (
          <div>
            <div className="text-xs font-medium mb-1" style={{ color: '#6b7280' }}>Description</div>
            <div className="text-sm" style={{ color: 'var(--mits-charcoal)' }}>{doc.description}</div>
          </div>
        )}

        {doc.tags.length > 0 && (
          <div>
            <div className="text-xs font-medium mb-1.5" style={{ color: '#6b7280' }}>Tags</div>
            <div className="flex flex-wrap gap-1">
              {doc.tags.map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded" style={{ background: '#f3f4f6', color: '#374151' }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* File path */}
        <div>
          <div className="text-xs font-medium mb-1" style={{ color: '#6b7280' }}>File location</div>
          <div className="text-xs break-all rounded p-2" style={{ background: '#f3f4f6', color: '#6b7280' }}>
            {doc.filePath}
          </div>
        </div>

        {/* Groups this doc belongs to */}
        {groups && groups.length > 0 && (
          <div>
            <div className="text-xs font-medium mb-1.5" style={{ color: '#6b7280' }}>Playbooks & Groups</div>
            <div className="space-y-1">
              {groups.map((g) => (
                <div key={g.id} className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: g.color }} />
                  <span>{g.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => onAddToGroup(doc)}
          className="w-full text-xs py-1.5 rounded border transition-colors hover:bg-gray-50 flex items-center justify-center gap-1.5"
          style={{ borderColor: '#d1d5db', color: '#6b7280' }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" fill="none"/>
          </svg>
          Add to Playbook / Group
        </button>
      </div>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs" style={{ color: '#9ca3af' }}>{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  )
}
