import { CATEGORY_MAP, STATUS_MAP, FILE_TYPE_INFO, DOMAIN_MAP, isScript, reviewStatus } from '../data/categories'

function WordIcon() {
  return (
    <div className="w-10 h-12 rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: '#2b579a' }}>
      W
    </div>
  )
}

function PdfIcon() {
  return (
    <div className="w-10 h-12 rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: '#dc2626' }}>
      PDF
    </div>
  )
}

function ScriptIcon() {
  return (
    <div className="w-10 h-12 rounded flex items-center justify-center text-white flex-shrink-0" style={{ background: '#1f2937' }}>
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 6l3 3-3 3M9 12h5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}

export default function DocumentCard({ doc, selected, onClick, onToggleFavorite, isMissing }) {
  const cat = CATEGORY_MAP[doc.category]
  const status = STATUS_MAP[doc.status] ?? STATUS_MAP.active
  const fileInfo = FILE_TYPE_INFO[doc.fileType] ?? FILE_TYPE_INFO.docx
  const review = reviewStatus(doc.reviewBy)

  return (
    <div
      onClick={onClick}
      className="flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors border"
      style={{
        background: selected ? '#fff' : '#f8f9fa',
        borderColor: selected ? 'var(--mits-red)' : '#e5e7eb',
        boxShadow: selected ? '0 0 0 2px rgba(225,37,27,0.15)' : 'none',
      }}
    >
      {isScript(doc.fileType) ? <ScriptIcon /> : doc.fileType === 'pdf' ? <PdfIcon /> : <WordIcon />}

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-1.5">
          {onToggleFavorite && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(doc) }}
              title={doc.favorite ? 'Remove from favorites' : 'Add to favorites'}
              className="flex-shrink-0 mt-0.5 transition-colors"
              style={{ color: doc.favorite ? '#f59e0b' : '#d1d5db' }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1l2.1 4.3 4.7.7-3.4 3.3.8 4.7L8 11.8 3.8 14l.8-4.7L1.2 6l4.7-.7L8 1z"/>
              </svg>
            </button>
          )}
          <div className="font-medium text-sm truncate flex-1" style={{ color: 'var(--mits-charcoal)' }}>
            {doc.title}
          </div>
          {isMissing && (
            <span
              className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: '#fff7ed', color: '#c2410c' }}
              title="File not found in the vault"
            >
              ⚠ Missing
            </span>
          )}
        </div>

        {doc.docId && (
          <div className="text-xs font-mono mt-0.5" style={{ color: '#9ca3af' }}>{doc.docId}</div>
        )}

        {doc.description && (
          <div className="text-xs mt-0.5 line-clamp-2" style={{ color: '#6b7280' }}>
            {doc.description}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {/* Format badges — mirror the dashboard so paired docs read consistently */}
          {doc.docxPath && (
            <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{ background: '#dbeafe', color: '#2b579a' }}>W</span>
          )}
          {doc.pdfPath && (
            <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{ background: '#fee2e2', color: '#dc2626' }}>PDF</span>
          )}
          {isScript(doc.fileType) && (
            <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{ background: '#e5e7eb', color: '#1f2937' }}>
              {doc.fileType.toUpperCase()}
            </span>
          )}
          {cat && (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: cat.bg, color: cat.color }}>
              {cat.label}
            </span>
          )}
          {doc.domain && DOMAIN_MAP[doc.domain] && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: '#eef2ff', color: '#4338ca' }}
              title={DOMAIN_MAP[doc.domain].label}
            >
              {doc.domain}
            </span>
          )}
          <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: status.bg, color: status.color }}>
            {status.label}
          </span>
          {doc.version && (
            <span className="text-xs" style={{ color: '#9ca3af' }}>v{doc.version}</span>
          )}
          {review && review.urgent && (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: review.bg, color: review.color }}>
              {review.label}
            </span>
          )}
        </div>

        {doc.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {doc.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#f3f4f6', color: '#6b7280' }}>
                {tag}
              </span>
            ))}
            {doc.tags.length > 3 && (
              <span className="text-xs" style={{ color: '#9ca3af' }}>+{doc.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
