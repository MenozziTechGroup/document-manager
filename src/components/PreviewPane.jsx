import { useState } from 'react'
import { isTauri } from '../data/db'
import { CATEGORY_MAP, STATUS_MAP, DOMAIN_MAP, isScript, reviewStatus } from '../data/categories'

async function openFile(filePath) {
  if (!isTauri()) {
    alert('File opening is only available in the desktop app.')
    return false
  }
  try {
    const { openPath } = await import('@tauri-apps/plugin-opener')
    await openPath(filePath)
    return true
  } catch (err) {
    alert(`Could not open file:\n${filePath}\n\nError: ${err}`)
    return false
  }
}

async function revealInExplorer(filePath) {
  if (!isTauri()) return
  try {
    const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
    await revealItemInDir(filePath)
  } catch (err) {
    alert(`Could not reveal file:\n${err}`)
  }
}

async function openUrl(url) {
  if (!isTauri()) { window.open(url, '_blank'); return }
  try {
    const { openUrl: open } = await import('@tauri-apps/plugin-opener')
    await open(url)
  } catch (err) {
    alert(`Could not open link:\n${err}`)
  }
}

// Build a SharePoint web URL from a local synced path, if a base URL is configured.
function sharePointLink(localPath, vaultPath, baseUrl) {
  if (!baseUrl || !vaultPath || !localPath) return null
  const norm = (s) => s.replace(/\\/g, '/')
  const lp = norm(localPath)
  const vp = norm(vaultPath).replace(/\/$/, '')
  if (!lp.toLowerCase().startsWith(vp.toLowerCase())) return null
  const rel = lp.slice(vp.length).replace(/^\//, '')
  const encoded = rel.split('/').map(encodeURIComponent).join('/')
  return `${baseUrl.replace(/\/$/, '')}/${encoded}`
}

export default function PreviewPane({
  doc, groups, onEdit, onDelete, onAddToGroup,
  onToggleFavorite, onOpened, onGeneratePdf, onSupersede, onPreviewPdf, vaultPath, sharePointUrl, isMissing,
}) {
  const [copied, setCopied] = useState('')

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
  const review = reviewStatus(doc.reviewBy)
  const spLink = sharePointLink(doc.docxPath || doc.filePath, vaultPath, sharePointUrl)

  const handleOpen = async (path) => {
    const ok = await openFile(path)
    if (ok && onOpened) onOpened(doc.id)
  }

  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setTimeout(() => setCopied(''), 1500)
    } catch {
      alert('Could not copy to clipboard.')
    }
  }

  const copyContents = async (path) => {
    if (!isTauri()) { alert('Reading file contents is only available in the desktop app.'); return }
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const text = await invoke('read_text_file', { path })
      await copyToClipboard(text, 'contents')
    } catch (err) {
      alert(`Could not read file contents:\n${err}`)
    }
  }

  const script = isScript(doc.fileType)

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: '#e5e7eb' }}>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-start gap-2 min-w-0">
            <button
              onClick={() => onToggleFavorite && onToggleFavorite(doc)}
              title={doc.favorite ? 'Remove from favorites' : 'Add to favorites'}
              className="flex-shrink-0 mt-0.5 transition-colors"
              style={{ color: doc.favorite ? '#f59e0b' : '#d1d5db' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1l2.1 4.3 4.7.7-3.4 3.3.8 4.7L8 11.8 3.8 14l.8-4.7L1.2 6l4.7-.7L8 1z"/>
              </svg>
            </button>
            <h2 className="font-semibold text-sm leading-snug" style={{ color: 'var(--mits-charcoal)' }}>
              {doc.title}
            </h2>
          </div>
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

        {/* Missing-file warning */}
        {isMissing && (
          <div
            className="flex items-center gap-2 mb-3 px-2.5 py-1.5 rounded text-xs"
            style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
              <path d="M6.5 1L12 11H1L6.5 1zm0 4v3m0 1.5v.5"/>
            </svg>
            File not found in the vault — it may have been moved or deleted.
          </div>
        )}

        {/* Open buttons: PDF for reading, Word for editing, editor for scripts */}
        <div className="flex gap-2">
          {script ? (
            <button
              onClick={() => handleOpen(doc.filePath)}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium text-sm text-white transition-opacity hover:opacity-90"
              style={{ background: '#1f2937' }}
            >
              <svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M4 6l3 3-3 3M9 12h5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Open in Editor
            </button>
          ) : doc.pdfPath ? (
            <button
              onClick={() => handleOpen(doc.pdfPath)}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium text-sm text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--mits-red)' }}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
                <path d="M2 2h4v1H3v7h7V6h1v4a1 1 0 01-1 1H2a1 1 0 01-1-1V3a1 1 0 011-1z"/>
                <path d="M7.5 1h4v4h-1V2.4L6.4 6.6l-.8-.8L9.9 2H7.5V1z"/>
              </svg>
              Open PDF
            </button>
          ) : (
            <button
              onClick={() => handleOpen(doc.docxPath || doc.filePath)}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium text-sm text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--mits-red)' }}
            >
              Open Document
            </button>
          )}
          {/* Only show "Edit Source" when it opens a DIFFERENT file than the
              main button — i.e. when a read-only PDF exists alongside the Word
              source. For Word-only docs the main button already opens the .docx. */}
          {doc.pdfPath && doc.docxPath && (
            <button
              onClick={() => handleOpen(doc.docxPath)}
              title="Open the editable Word source"
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-medium text-sm border transition-colors hover:bg-blue-50"
              style={{ borderColor: '#2b579a', color: '#2b579a' }}
            >
              <span className="text-xs font-bold">W</span>
              Edit Source
            </button>
          )}
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          <QuickAction onClick={() => revealInExplorer(doc.docxPath || doc.pdfPath || doc.filePath)}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor">
              <path d="M1 2.5h3l1 1h5v5H1z"/>
            </svg>
            Reveal in Explorer
          </QuickAction>
          <QuickAction onClick={() => copyToClipboard(doc.docxPath || doc.filePath, 'path')}>
            {copied === 'path' ? '✓ Copied' : 'Copy path'}
          </QuickAction>
          {script && (
            <QuickAction onClick={() => copyContents(doc.filePath)}>
              {copied === 'contents' ? '✓ Copied' : 'Copy contents'}
            </QuickAction>
          )}
          {spLink && (
            <QuickAction onClick={() => copyToClipboard(spLink, 'sp')}>
              {copied === 'sp' ? '✓ Copied' : 'Copy SharePoint link'}
            </QuickAction>
          )}
          {/* Offer to generate the paired PDF for a Word-only document */}
          {doc.docxPath && !doc.pdfPath && onGeneratePdf && (
            <QuickAction onClick={() => onGeneratePdf(doc)}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor">
                <path d="M2 1h4l3 3v6H2z" fill="none" stroke="currentColor" strokeWidth="1"/>
              </svg>
              Create PDF
            </QuickAction>
          )}
          {doc.pdfPath && onPreviewPdf && (
            <QuickAction onClick={() => onPreviewPdf(doc)}>Preview PDF</QuickAction>
          )}
          {doc.sourceUrl && (
            <QuickAction onClick={() => openUrl(doc.sourceUrl)}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor">
                <path d="M4 1h6v6M10 1L5 6M5 2H1v8h8V6" fill="none" stroke="currentColor" strokeWidth="1"/>
              </svg>
              Open source chat
            </QuickAction>
          )}
          {onSupersede && (
            <QuickAction onClick={() => onSupersede(doc)}>Supersede…</QuickAction>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="p-4 space-y-3 text-sm">
        {doc.docId && (
          <Row label="Document ID">
            <span className="text-xs font-mono font-semibold" style={{ color: 'var(--mits-charcoal)' }}>{doc.docId}</span>
          </Row>
        )}

        {doc.domain && DOMAIN_MAP[doc.domain] && (
          <Row label="Domain">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#eef2ff', color: '#4338ca' }}>
              {DOMAIN_MAP[doc.domain].label}
            </span>
          </Row>
        )}

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
        {doc.audience === 'Client' && (
          <Row label="Audience">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#dcfce7', color: '#16a34a' }}>
              Client-facing
            </span>
          </Row>
        )}

        {review && (
          <Row label="Review date">
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: review.bg, color: review.color }}
            >
              {review.label}
            </span>
          </Row>
        )}

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

        {/* Version notes / changelog */}
        {doc.versionNotes && (
          <div>
            <div className="text-xs font-medium mb-1" style={{ color: '#6b7280' }}>Version notes</div>
            <div
              className="text-xs rounded p-2 whitespace-pre-wrap"
              style={{ background: '#f8fafc', color: '#374151', border: '1px solid #e5e7eb' }}
            >
              {doc.versionNotes}
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

function QuickAction({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors hover:bg-gray-50"
      style={{ borderColor: '#e5e7eb', color: '#6b7280' }}
    >
      {children}
    </button>
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
