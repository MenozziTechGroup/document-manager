import { useState, useEffect } from 'react'
import { getDocumentGroupIds, addToGroup, removeFromGroup } from '../data/repo'

export default function AddToGroupModal({ doc, groups, onClose, onDone }) {
  const [memberGroupIds, setMemberGroupIds] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getDocumentGroupIds(doc.id).then(setMemberGroupIds)
  }, [doc.id])

  const toggle = async (groupId) => {
    setSaving(true)
    const isMember = memberGroupIds.includes(groupId)
    if (isMember) {
      await removeFromGroup(groupId, doc.id)
      setMemberGroupIds((prev) => prev.filter((id) => id !== groupId))
    } else {
      await addToGroup(groupId, doc.id)
      setMemberGroupIds((prev) => [...prev, groupId])
    }
    setSaving(false)
  }

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#e5e7eb' }}>
          <div>
            <h2 className="font-semibold text-base">Add to Group</h2>
            <div className="text-xs mt-0.5 truncate max-w-xs" style={{ color: '#6b7280' }}>{doc.title}</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>

        <div className="px-5 py-3 max-h-72 overflow-y-auto">
          {groups.length === 0 ? (
            <div className="text-sm text-center py-6" style={{ color: '#9ca3af' }}>
              No groups yet. Create a group first.
            </div>
          ) : (
            <div className="space-y-2">
              {groups.map((group) => {
                const isMember = memberGroupIds.includes(group.id)
                return (
                  <button
                    key={group.id}
                    onClick={() => toggle(group.id)}
                    disabled={saving}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors text-left"
                    style={{
                      borderColor: isMember ? group.color : '#e5e7eb',
                      background: isMember ? `${group.color}15` : 'white',
                    }}
                  >
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: group.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: 'var(--mits-charcoal)' }}>{group.name}</div>
                      {group.description && (
                        <div className="text-xs truncate" style={{ color: '#9ca3af' }}>{group.description}</div>
                      )}
                    </div>
                    <div
                      className="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0"
                      style={{ borderColor: isMember ? group.color : '#d1d5db', background: isMember ? group.color : 'white' }}
                    >
                      {isMember && <svg width="8" height="8" viewBox="0 0 8 8" fill="white"><path d="M1 4l2 2 4-4"/></svg>}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end px-5 py-4 border-t" style={{ borderColor: '#e5e7eb' }}>
          <button
            onClick={onDone}
            className="text-sm px-4 py-2 rounded text-white font-medium"
            style={{ background: 'var(--mits-red)' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
