import { useState, useEffect } from 'react'
import { isTauri } from '../data/db'

export default function PdfPreviewModal({ doc, onClose }) {
  const [src, setSrc] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!isTauri()) { setError('PDF preview is only available in the desktop app.'); return }
      try {
        const { convertFileSrc } = await import('@tauri-apps/api/core')
        if (mounted) setSrc(convertFileSrc(doc.pdfPath))
      } catch (e) {
        if (mounted) setError(String(e))
      }
    })()
    return () => { mounted = false }
  }, [doc.pdfPath])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={onClose}>
      <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ background: 'var(--mits-charcoal, #3a3a3a)' }} onClick={(e) => e.stopPropagation()}>
        <div className="text-white text-sm font-medium truncate">{doc.title}</div>
        <button onClick={onClose} className="text-white text-lg leading-none px-2 hover:opacity-80">×</button>
      </div>
      <div className="flex-1 m-4 mt-3 rounded-lg overflow-hidden" style={{ background: 'white' }} onClick={(e) => e.stopPropagation()}>
        {error ? (
          <div className="flex items-center justify-center h-full text-sm" style={{ color: '#6b7280' }}>{error}</div>
        ) : src ? (
          <iframe title={doc.title} src={src} style={{ width: '100%', height: '100%', border: 'none' }} />
        ) : (
          <div className="flex items-center justify-center h-full text-sm" style={{ color: '#9ca3af' }}>Loading preview…</div>
        )}
      </div>
    </div>
  )
}
