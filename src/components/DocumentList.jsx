import DocumentCard from './DocumentCard'

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
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#e5e7eb', background: 'white' }}>
        <div>
          <h1 className="font-semibold text-base" style={{ color: 'var(--mits-charcoal)' }}>{title}</h1>
          {subtitle && <div className="text-xs mt-0.5" style={{ color: '#6b7280' }}>{subtitle}</div>}
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

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center" style={{ color: '#9ca3af' }}>
            <div className="text-sm font-medium">No documents here yet</div>
            {vaultPath
              ? <div className="text-xs mt-1">Click "Sync Vault" to scan your SharePoint folder</div>
              : <div className="text-xs mt-1">Configure your vault path in Settings to get started</div>
            }
          </div>
        ) : (
          docs.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              selected={doc.id === selectedDocId}
              onClick={() => onSelectDoc(doc)}
            />
          ))
        )}
      </div>
    </div>
  )
}
