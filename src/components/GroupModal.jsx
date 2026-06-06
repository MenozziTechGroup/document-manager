import { useState, useEffect } from 'react'
import { GROUP_COLORS } from '../data/categories'

const EMPTY = { name: '', description: '', color: '#e1251b' }

export default function GroupModal({ group, onSave, onClose }) {
  const [form, setForm] = useState(group ? { ...group } : { ...EMPTY })
  const isEdit = !!group

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave({ ...form, name: form.name.trim() })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#e5e7eb' }}>
          <h2 className="font-semibold text-base">{isEdit ? 'Edit Group' : 'New Playbook / Group'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Name *</label>
            <input
              required
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: 13, outline: 'none' }}
              placeholder="e.g. Hornet Security Onboarding"
              onFocus={(e) => { e.target.style.borderColor = '#e1251b' }}
              onBlur={(e) => { e.target.style.borderColor = '#d1d5db' }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: 13, outline: 'none', resize: 'none' }}
              rows={2}
              placeholder="What does this group of documents cover?"
              onFocus={(e) => { e.target.style.borderColor = '#e1251b' }}
              onBlur={(e) => { e.target.style.borderColor = '#d1d5db' }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: '#374151' }}>Color</label>
            <div className="flex gap-2 flex-wrap">
              {GROUP_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set('color', c)}
                  className="w-7 h-7 rounded-full transition-transform"
                  style={{
                    background: c,
                    outline: form.color === c ? `3px solid ${c}` : 'none',
                    outlineOffset: 2,
                    transform: form.color === c ? 'scale(1.15)' : 'none',
                  }}
                />
              ))}
            </div>
          </div>
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
            {isEdit ? 'Save Changes' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  )
}
