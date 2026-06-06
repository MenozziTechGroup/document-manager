import { CATEGORY_MAP, STATUS_MAP, FILE_TYPE_INFO } from '../data/categories'

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

export default function DocumentCard({ doc, selected, onClick }) {
  const cat = CATEGORY_MAP[doc.category]
  const status = STATUS_MAP[doc.status] ?? STATUS_MAP.active
  const fileInfo = FILE_TYPE_INFO[doc.fileType] ?? FILE_TYPE_INFO.docx

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
      {doc.fileType === 'pdf' ? <PdfIcon /> : <WordIcon />}

      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate" style={{ color: 'var(--mits-charcoal)' }}>
          {doc.title}
        </div>

        {doc.description && (
          <div className="text-xs mt-0.5 line-clamp-2" style={{ color: '#6b7280' }}>
            {doc.description}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {cat && (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: cat.bg, color: cat.color }}>
              {cat.label}
            </span>
          )}
          <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: status.bg, color: status.color }}>
            {status.label}
          </span>
          {doc.version && (
            <span className="text-xs" style={{ color: '#9ca3af' }}>v{doc.version}</span>
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
