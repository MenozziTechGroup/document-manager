import { useState, useEffect } from 'react'
import { CATEGORY_MAP } from '../data/categories'

export default function SupersedeModal({ doc, docs, onConfirm, onClose }) {
  const [query, setQuery] = useState('')

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const candidates = docs
    .filter((d) => d.id !== doc.id && d.status !== 'archived')
    .filter((d) => !query || `${d.title} ${d.docId}`.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 60)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#e5e7eb' }}>
          <div>
            <h2 className="font-semibold text-base">Supersede an older version</h2>
            <div className="text-xs mt-0.5 truncate max-w-xs" style={{ color: '#6b7280' }}>
              “{doc.title}” replaces…
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>

        <div className="px-5 pt-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            placeholder="Find the document this replaces…"
            className="w-full text-sm"
            style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', outline: 'none' }}
          />
          <p className="text-xs mt-2" style={{ color: '#9ca3af' }}>
            The document you pick will be marked <strong>Archived</strong> and noted as superseded by this one. Its file is untouched.
          </p>
        </div>

        <div className="px-3 py-2 overflow-y-auto flex-1">
          {candidates.length === 0 ? (
            <div className="text-sm text-center py-6" style={{ color: '#9ca3af' }}>No matching documents.</div>
          ) : candidates.map((d) => (
            <button
              key={d.id}
              onClick={() => onConfirm(d)}
              className="w-full flex items-center gap-2 px-2 py-2 rounded text-left hover:bg-gray-50"
            >
              {CATEGORY_MAP[d.category]?.code && (
                <span className="text-xs px-1.5 py-0.5 rounded font-bold flex-shrink-0" style={{ background: '#eaeff4', color: '#0e2841' }}>{CATEGORY_MAP[d.category].code}</span>
              )}
              <span className="text-sm truncate flex-1" style={{ color: '#1f2937' }}>{d.docId ? `${d.docId} · ` : ''}{d.title}</span>
              {d.version && <span className="text-xs flex-shrink-0" style={{ color: '#9ca3af' }}>v{d.version}</span>}
            </button>
          ))}
        </div>

        <div className="flex justify-end px-5 py-3 border-t" style={{ borderColor: '#e5e7eb' }}>
          <button onClick={onClose} className="text-sm px-4 py-2 rounded border" style={{ borderColor: '#d1d5db', color: '#6b7280' }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
