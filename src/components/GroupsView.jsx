import { useState, useEffect } from 'react'
import { getGroupMembers } from '../data/repo'
import DocumentCard from './DocumentCard'

export default function GroupsView({ groups, docs, selectedDocId, onSelectDoc, onNewGroup, onEditGroup, onDeleteGroup, onNavigateGroup }) {
  const [expandedId, setExpandedId] = useState(null)
  const [members, setMembers] = useState({})

  useEffect(() => {
    if (!expandedId) return
    getGroupMembers(expandedId).then((m) => {
      setMembers((prev) => ({ ...prev, [expandedId]: m }))
    })
  }, [expandedId])

  const toggle = (id) => setExpandedId((prev) => (prev === id ? null : id))

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#e5e7eb', background: 'white' }}>
        <div>
          <h1 className="font-semibold text-base" style={{ color: 'var(--mits-charcoal)' }}>Playbooks &amp; Groups</h1>
          <div className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
            Link related documents together for easy execution
          </div>
        </div>
        <button
          onClick={onNewGroup}
          className="text-xs px-3 py-1.5 rounded text-white flex items-center gap-1.5"
          style={{ background: 'var(--mits-red)' }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <path d="M5 1v8M1 5h8" stroke="white" strokeWidth="1.5" fill="none"/>
          </svg>
          New Group
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center" style={{ color: '#9ca3af' }}>
            <div className="text-sm font-medium">No groups yet</div>
            <div className="text-xs mt-1">Create a group to link related documents together</div>
          </div>
        ) : (
          groups.map((group) => {
            const isOpen = expandedId === group.id
            const groupMembers = members[group.id] ?? []
            const docCount = docs.filter((d) => {
              // We don't know the count without loading; show "…" until expanded
              return false
            }).length

            return (
              <div key={group.id} className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: group.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm" style={{ color: 'var(--mits-charcoal)' }}>{group.name}</div>
                    {group.description && (
                      <div className="text-xs truncate" style={{ color: '#6b7280' }}>{group.description}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onEditGroup(group)}
                      className="text-xs px-2 py-1 rounded border transition-colors hover:bg-gray-50"
                      style={{ borderColor: '#e5e7eb', color: '#6b7280' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete group "${group.name}"? Documents are not deleted.`)) onDeleteGroup(group.id) }}
                      className="text-xs px-2 py-1 rounded border transition-colors hover:bg-red-50"
                      style={{ borderColor: '#fca5a5', color: '#dc2626' }}
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => toggle(group.id)}
                      className="text-xs px-2 py-1 rounded border transition-colors hover:bg-gray-50 ml-1"
                      style={{ borderColor: '#e5e7eb', color: '#6b7280' }}
                    >
                      {isOpen ? '▲ Hide' : '▼ Show'}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t px-4 py-3 space-y-2" style={{ borderColor: '#f3f4f6', background: '#fafafa' }}>
                    {groupMembers.length === 0 ? (
                      <div className="text-xs text-center py-3" style={{ color: '#9ca3af' }}>
                        No documents in this group yet. Select a document and use "Add to Playbook / Group".
                      </div>
                    ) : (
                      groupMembers.map((doc) => (
                        <DocumentCard
                          key={doc.id}
                          doc={doc}
                          selected={doc.id === selectedDocId}
                          onClick={() => onSelectDoc(doc)}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
