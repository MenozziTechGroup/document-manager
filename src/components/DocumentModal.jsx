import { useState, useEffect } from 'react'
import { CATEGORIES, STATUSES } from '../data/categories'

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
}

export default function DocumentModal({ doc, onSave, onClose }) {
  const [form, setForm] = useState(doc ? { ...doc, tags: [...(doc.tags ?? [])] } : { ...EMPTY })
  const [tagInput, setTagInput] = useState('')
  const isEdit = !!doc

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const addTag = () => {
    const tag = tagInput.trim()
    if (tag && !form.tags.includes(tag)) {
      set('tags', [...form.tags, tag])
    }
    setTagInput('')
  }

  const removeTag = (tag) => set('tags', form.tags.filter((t) => t !== tag))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    onSave({ ...form, title: form.title.trim() })
  }

  // Auto-derive fileName from filePath
  const handleFilePathChange = (v) => {
    set('filePath', v)
    const parts = v.replace(/\\/g, '/').split('/')
    const name = parts[parts.length - 1] ?? ''
    if (name) {
      set('fileName', name)
      const ext = name.split('.').pop()?.toLowerCase()
      if (ext === 'pdf') set('fileType', 'pdf')
      else if (ext === 'docx') set('fileType', 'docx')
      if (!form.title) set('title', name.replace(/\.(docx|pdf)$/i, ''))
    }
  }

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
            <Field label="File type">
              <select value={form.fileType} onChange={(e) => set('fileType', e.target.value)} className="input-base">
                <option value="docx">Word (.docx)</option>
                <option value="pdf">PDF (.pdf)</option>
              </select>
            </Field>
            <Field label="Version">
              <input value={form.version} onChange={(e) => set('version', e.target.value)} className="input-base" placeholder="e.g. 1.2" />
            </Field>
          </div>

          <Field label="File path">
            <input
              value={form.filePath}
              onChange={(e) => handleFilePathChange(e.target.value)}
              className="input-base font-mono text-xs"
              placeholder="C:\OneDrive - MITS\Docs\Runbooks\file.docx"
            />
          </Field>

          <Field label="Client name (if applicable)">
            <input value={form.clientName} onChange={(e) => set('clientName', e.target.value)} className="input-base" placeholder="e.g. Hornet Security" />
          </Field>

          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              className="input-base resize-none"
              rows={3}
              placeholder="Brief summary of what this document covers…"
            />
          </Field>

          <Field label="Tags">
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                className="input-base flex-1"
                placeholder="Add a tag and press Enter"
              />
              <button type="button" onClick={addTag} className="text-xs px-3 py-1.5 rounded border" style={{ borderColor: '#d1d5db', color: '#6b7280' }}>
                Add
              </button>
            </div>
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {form.tags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded" style={{ background: '#f3f4f6', color: '#374151' }}>
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="text-gray-400 hover:text-gray-600">×</button>
                  </span>
                ))}
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
