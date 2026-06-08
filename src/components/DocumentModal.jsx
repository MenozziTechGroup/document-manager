import { useState, useEffect } from 'react'
import { CATEGORIES, CATEGORY_MAP, STATUSES, DOMAINS, AUDIENCES, FILE_TYPE_OPTIONS } from '../data/categories'
import { isTauri } from '../data/db'
import { getTags, addTag, getClientNames, suggestDocId } from '../data/repo'

const EMPTY = {
  title: '',
  category: 'SOPs',
  filePath: '',
  fileName: '',
  fileType: 'docx',
  description: '',
  status: 'active',
  tags: [],
  version: '',
  clientName: '',
  reviewBy: '',
  versionNotes: '',
  sourceUrl: '',
  docId: '',
  domain: '',
  audience: 'Internal',
}

export default function DocumentModal({ doc, onSave, onClose, vaultPath }) {
  // doc can be: null (new), { category } (new with preset category), or a full doc object (edit)
  const isEdit = !!(doc?.id)
  const [form, setForm] = useState(
    isEdit
      ? { ...doc, tags: [...(doc.tags ?? [])] }
      : { ...EMPTY, ...(doc ?? {}) }
  )
  const [tagInput, setTagInput] = useState('')
  const [allTags, setAllTags] = useState([])
  const [clientNames, setClientNames] = useState([])

  // Smart import: when adding a new doc from outside the vault, offer to file
  // it into the right category folder and (optionally) generate a paired PDF.
  const canImport = !isEdit && isTauri() && !!vaultPath
  const [importToVault, setImportToVault] = useState(false)
  const [generatePdf, setGeneratePdf] = useState(true)

  const pathInsideVault = (p) => {
    if (!vaultPath || !p) return false
    const norm = (s) => s.replace(/\\/g, '/').toLowerCase()
    return norm(p).startsWith(norm(vaultPath).replace(/\/$/, ''))
  }

  // Load master tag list and known client names on mount
  useEffect(() => {
    getTags().then(setAllTags)
    getClientNames().then(setClientNames)
  }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const addTagToForm = (tag) => {
    const t = tag.trim()
    if (t && !form.tags.includes(t)) {
      set('tags', [...form.tags, t])
      // Add to master list if new
      if (!allTags.includes(t)) {
        addTag(t)
        setAllTags((prev) => [...prev, t].sort())
      }
    }
    setTagInput('')
  }

  const removeTag = (tag) => set('tags', form.tags.filter((t) => t !== tag))

  const handleSuggestDocId = async () => {
    const code = CATEGORY_MAP[form.category]?.code
    if (!code || !form.domain) {
      alert('Pick a category and a domain first, then I can suggest the next Doc ID.')
      return
    }
    const id = await suggestDocId(code, form.domain)
    if (id) set('docId', id)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    onSave({
      ...form,
      title: form.title.trim(),
      _importToVault: canImport && importToVault,
      _generatePdf: canImport && importToVault && generatePdf,
    })
  }

  // Auto-derive fileName, fileType, title, and version from the selected file path
  const handleFilePathChange = (v) => {
    set('filePath', v)
    const parts = v.replace(/\\/g, '/').split('/')
    const name = parts[parts.length - 1] ?? ''
    if (!name) return
    set('fileName', name)
    const ext = name.split('.').pop()?.toLowerCase()
    if (ext) set('fileType', ext)
    // Auto-fill title if blank
    const baseName = name.replace(/\.[^.]+$/, '')
    if (!form.title) set('title', baseName.replace(/[-_]/g, ' '))
    // Parse version from filename e.g. "Server_Maintenance_Runbook_v2.1.docx"
    const versionMatch = baseName.match(/[_\s-]v(\d+[\d.]*)$/i)
    if (versionMatch && !form.version) set('version', versionMatch[1])
    // Suggest importing into the vault when the file lives outside it
    if (canImport) setImportToVault(!!v && !pathInsideVault(v))
  }

  // When a file path is pre-filled (drag-and-drop import), derive its metadata
  useEffect(() => {
    if (!isEdit && form.filePath && !form.fileName) {
      handleFilePathChange(form.filePath)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const suggestedTags = allTags.filter(
    (t) => !form.tags.includes(t) &&
      (tagInput === '' || t.toLowerCase().includes(tagInput.toLowerCase()))
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#e5e7eb' }}>
          <h2 className="font-semibold text-base">{isEdit ? 'Edit Document' : 'Add Document'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          <Field label="Title *">
            <input
              required
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              className="input-base"
              placeholder="e.g. Server Maintenance Runbook"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select value={form.category} onChange={(e) => set('category', e.target.value)} className="input-base">
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={(e) => set('status', e.target.value)} className="input-base">
                {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Domain">
              <select value={form.domain} onChange={(e) => set('domain', e.target.value)} className="input-base">
                <option value="">— None —</option>
                {DOMAINS.map((d) => <option key={d.code} value={d.code}>{d.code} — {d.label}</option>)}
              </select>
            </Field>
            <Field label="Audience">
              <select value={form.audience} onChange={(e) => set('audience', e.target.value)} className="input-base">
                {AUDIENCES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Document ID">
            <div className="flex gap-2">
              <input
                value={form.docId}
                onChange={(e) => set('docId', e.target.value)}
                className="input-base flex-1 font-mono"
                placeholder="e.g. SOP-MDM-003"
              />
              <button
                type="button"
                onClick={handleSuggestDocId}
                className="text-sm px-3 py-1.5 rounded border transition-colors hover:bg-gray-50 flex-shrink-0"
                style={{ borderColor: '#d1d5db', color: '#374151' }}
              >
                Suggest
              </button>
            </div>
            <div className="text-xs mt-1" style={{ color: '#9ca3af' }}>
              Stable identifier in <span className="font-mono">TYPE-DOMAIN-NNN</span> form. Pick a domain, then Suggest for the next free number.
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="File type">
              <select value={form.fileType} onChange={(e) => set('fileType', e.target.value)} className="input-base">
                {FILE_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Version">
              <input
                value={form.version}
                onChange={(e) => set('version', e.target.value)}
                className="input-base"
                placeholder="e.g. 1.2 (auto-detected from filename)"
              />
            </Field>
          </div>

          <Field label="File path">
            <div className="flex gap-2">
              <input
                value={form.filePath}
                onChange={(e) => handleFilePathChange(e.target.value)}
                className="input-base font-mono text-xs flex-1"
                placeholder="C:\OneDrive - MITS\Docs\Runbooks\file.docx"
              />
              <button
                type="button"
                onClick={async () => {
                  if (!isTauri()) return
                  const { open } = await import('@tauri-apps/plugin-dialog')
                  const selected = await open({
                    multiple: false,
                    filters: [
                      { name: 'Documents & Scripts', extensions: ['docx', 'pdf', 'ps1', 'psm1', 'bat', 'cmd', 'sh', 'py'] },
                      { name: 'Word Documents', extensions: ['docx'] },
                      { name: 'PDF Files', extensions: ['pdf'] },
                      { name: 'Scripts', extensions: ['ps1', 'psm1', 'bat', 'cmd', 'sh', 'py'] },
                    ],
                  })
                  if (selected) handleFilePathChange(selected)
                }}
                className="text-sm px-3 py-1.5 rounded border transition-colors hover:bg-gray-50 flex-shrink-0"
                style={{ borderColor: '#d1d5db', color: '#374151' }}
              >
                Browse…
              </button>
            </div>
          </Field>

          {/* Smart import — file the document into the vault */}
          {canImport && form.filePath && (
            <div className="rounded-lg p-3 space-y-2" style={{ background: '#fafafa', border: '1px solid #e5e7eb' }}>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={importToVault}
                  onChange={(e) => setImportToVault(e.target.checked)}
                  style={{ marginTop: 2, accentColor: '#e1251b' }}
                />
                <span className="text-xs" style={{ color: '#374151' }}>
                  <span className="font-medium">Copy this file into the vault</span> — files it into the correct
                  SharePoint subfolder for the chosen category so you don't have to find it manually.
                </span>
              </label>

              {importToVault && (
                <>
                  <div className="text-xs font-mono rounded px-2 py-1 break-all" style={{ background: '#fff', border: '1px solid #e5e7eb', color: '#6b7280' }}>
                    {vaultPath}\{form.category}\{form.fileName || '…'}
                  </div>
                  {form.fileType === 'docx' && (
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={generatePdf}
                        onChange={(e) => setGeneratePdf(e.target.checked)}
                        style={{ marginTop: 2, accentColor: '#e1251b' }}
                      />
                      <span className="text-xs" style={{ color: '#374151' }}>
                        <span className="font-medium">Also create a PDF copy</span> — generates a read-only PDF
                        alongside the Word file using Microsoft Word. Recommended so the "Open PDF" button works.
                      </span>
                    </label>
                  )}
                </>
              )}
            </div>
          )}

          {/* Client name with datalist suggestions */}
          <Field label="Client name (if applicable)">
            <input
              list="client-names-list"
              value={form.clientName}
              onChange={(e) => set('clientName', e.target.value)}
              className="input-base"
              placeholder="Type or select a client name…"
              autoComplete="off"
            />
            <datalist id="client-names-list">
              {clientNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            {clientNames.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {clientNames.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => set('clientName', name)}
                    className="text-xs px-2 py-0.5 rounded border transition-colors hover:bg-gray-100"
                    style={{
                      borderColor: form.clientName === name ? '#e1251b' : '#e5e7eb',
                      background: form.clientName === name ? '#fde8e8' : 'white',
                      color: form.clientName === name ? '#e1251b' : '#6b7280',
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </Field>

          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              className="input-base resize-none"
              rows={2}
              placeholder="Brief summary of what this document covers…"
            />
          </Field>

          <Field label="Review / expiry date">
            <input
              type="date"
              value={form.reviewBy}
              onChange={(e) => set('reviewBy', e.target.value)}
              className="input-base"
              style={{ colorScheme: 'light' }}
            />
            <div className="text-xs mt-1" style={{ color: '#9ca3af' }}>
              Set a date to be reminded this document needs review or updating.
            </div>
          </Field>

          <Field label="Version notes / What changed">
            <textarea
              value={form.versionNotes}
              onChange={(e) => set('versionNotes', e.target.value)}
              className="input-base resize-none"
              rows={3}
              placeholder="Paste the changelog from the Claude Chat document, or describe what changed in this version…"
            />
          </Field>

          <Field label="Source chat / project link">
            <input
              type="url"
              value={form.sourceUrl}
              onChange={(e) => set('sourceUrl', e.target.value)}
              className="input-base"
              placeholder="https://claude.ai/project/…  (the chat that built this document)"
            />
            <div className="text-xs mt-1" style={{ color: '#9ca3af' }}>
              Paste the Claude Chat or project URL so revisions start one click from the conversation that created it.
            </div>
          </Field>

          {/* Tags with master list suggestions */}
          <Field label="Tags">
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTagToForm(tagInput) } }}
                className="input-base flex-1"
                placeholder="Type a tag and press Enter, or pick below…"
              />
              <button
                type="button"
                onClick={() => addTagToForm(tagInput)}
                className="text-xs px-3 py-1.5 rounded border flex-shrink-0"
                style={{ borderColor: '#d1d5db', color: '#6b7280' }}
              >
                Add
              </button>
            </div>

            {/* Active tags on this document */}
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {form.tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium"
                    style={{ background: '#fde8e8', color: '#e1251b' }}
                  >
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="opacity-60 hover:opacity-100">×</button>
                  </span>
                ))}
              </div>
            )}

            {/* Master tag suggestions — show unselected tags */}
            {suggestedTags.length > 0 && (
              <div className="mt-2">
                <div className="text-xs mb-1" style={{ color: '#9ca3af' }}>
                  {tagInput ? 'Matching tags:' : 'Existing tags — click to add:'}
                </div>
                <div className="flex flex-wrap gap-1">
                  {suggestedTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => addTagToForm(tag)}
                      className="text-xs px-2 py-0.5 rounded border transition-colors hover:bg-gray-100"
                      style={{ borderColor: '#e5e7eb', color: '#6b7280' }}
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Field>
        </form>

        <div className="flex justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: '#e5e7eb' }}>
          <button type="button" onClick={onClose} className="text-sm px-4 py-2 rounded border" style={{ borderColor: '#d1d5db', color: '#6b7280' }}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="text-sm px-4 py-2 rounded text-white font-medium"
            style={{ background: 'var(--mits-red)' }}
          >
            {isEdit ? 'Save Changes' : 'Add Document'}
          </button>
        </div>
      </div>

      <style>{`
        .input-base {
          width: 100%;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s;
        }
        .input-base:focus { border-color: #e1251b; }
      `}</style>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>{label}</label>
      {children}
    </div>
  )
}
