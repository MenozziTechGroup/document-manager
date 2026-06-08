import { useState, useEffect, useMemo } from 'react'
import { getGroupMembers, addToGroup, removeFromGroup, updateMember } from '../data/repo'
import { PHASES, PHASE_MAP, PHASE_ORDER, CATEGORY_MAP } from '../data/categories'

export default function PlaybooksView({
  playbooks, docs, runs,
  onNewPlaybook, onEditPlaybook, onDeletePlaybook,
  onStartPlaybook, onOpenRun, onDeleteRun,
}) {
  const [expandedId, setExpandedId] = useState(null)
  const [manifests, setManifests] = useState({})
  const [addingFor, setAddingFor] = useState(null)
  const [addQuery, setAddQuery] = useState('')

  const loadManifest = async (groupId) => {
    const m = await getGroupMembers(groupId)
    setManifests((prev) => ({ ...prev, [groupId]: m }))
  }

  useEffect(() => { if (expandedId) loadManifest(expandedId) }, [expandedId])

  const toggle = (id) => { setExpandedId((prev) => (prev === id ? null : id)); setAddingFor(null) }

  const activeRuns = runs.filter((r) => r.status !== 'complete')
  const playbookById = useMemo(() => Object.fromEntries(playbooks.map((p) => [p.id, p])), [playbooks])

  // ── Manifest editing ──
  const phaseCount = (members, phase) => members.filter((m) => m.phase === phase).length

  const addDoc = async (groupId, docId) => {
    const members = manifests[groupId] ?? []
    await addToGroup(groupId, docId, { phase: 'Execute', required: 'Required', sortOrder: phaseCount(members, 'Execute') })
    await loadManifest(groupId)
  }
  const removeMember = async (groupId, member) => {
    await removeFromGroup(groupId, member.id)
    await loadManifest(groupId)
  }
  const changePhase = async (groupId, member, phase) => {
    const members = manifests[groupId] ?? []
    await updateMember(member.memberId, { phase, required: member.required, condition: member.condition, sortOrder: phaseCount(members, phase) })
    await loadManifest(groupId)
  }
  const toggleRequired = async (groupId, member) => {
    const next = member.required === 'Required' ? 'Conditional' : 'Required'
    await updateMember(member.memberId, { phase: member.phase, required: next, condition: member.condition, sortOrder: member.sortOrder })
    await loadManifest(groupId)
  }
  const move = async (groupId, member, dir) => {
    const members = manifests[groupId] ?? []
    const sibs = members.filter((m) => m.phase === member.phase).sort((a, b) => a.sortOrder - b.sortOrder)
    const idx = sibs.findIndex((m) => m.memberId === member.memberId)
    const swapWith = sibs[idx + dir]
    if (!swapWith) return
    await updateMember(member.memberId, { phase: member.phase, required: member.required, condition: member.condition, sortOrder: swapWith.sortOrder })
    await updateMember(swapWith.memberId, { phase: swapWith.phase, required: swapWith.required, condition: swapWith.condition, sortOrder: member.sortOrder })
    await loadManifest(groupId)
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#e5e7eb', background: 'white' }}>
        <div>
          <h1 className="font-semibold text-base" style={{ color: 'var(--mits-charcoal)' }}>Playbooks</h1>
          <div className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
            Ordered, phased bundles of documents you run as a workflow
          </div>
        </div>
        <button onClick={onNewPlaybook} className="text-xs px-3 py-1.5 rounded text-white flex items-center gap-1.5" style={{ background: 'var(--mits-red)' }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M5 1v8M1 5h8" stroke="white" strokeWidth="1.5" fill="none"/></svg>
          New Playbook
        </button>
      </div>

      <div className="flex-1 p-4 space-y-4">

        {/* Active runs */}
        {activeRuns.length > 0 && (
          <div className="rounded-xl border p-3" style={{ borderColor: '#fca5a5', background: '#fff7f7' }}>
            <div className="flex items-center gap-2 mb-2">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="#e1251b"><path d="M3 2l8 4.5L3 11z"/></svg>
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#e1251b' }}>In-Progress Runs</span>
              <span className="text-xs px-1.5 rounded-full text-white" style={{ background: '#e1251b' }}>{activeRuns.length}</span>
            </div>
            <div className="space-y-2">
              {activeRuns.map((r) => {
                const pb = playbookById[r.groupId]
                const pct = r.total ? Math.round((r.doneCount / r.total) * 100) : 0
                return (
                  <div key={r.id} className="flex items-center gap-3 bg-white rounded-lg border px-4 py-2.5" style={{ borderColor: '#e5e7eb' }}>
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: pb?.color ?? '#e1251b' }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: 'var(--mits-charcoal)' }}>
                        {pb?.name ?? 'Playbook'}{r.clientName ? ` · ${r.clientName}` : ''}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="h-1.5 rounded-full overflow-hidden flex-1" style={{ background: '#f0f0f2', maxWidth: 200 }}>
                          <div className="h-full" style={{ width: `${pct}%`, background: pb?.color ?? 'var(--mits-red)' }} />
                        </div>
                        <span className="text-xs" style={{ color: '#9ca3af' }}>{r.doneCount}/{r.total}{r.status === 'paused' ? ' · paused' : ''}</span>
                      </div>
                    </div>
                    <button onClick={() => onOpenRun(r.id)} className="text-xs px-3 py-1.5 rounded text-white font-medium flex-shrink-0" style={{ background: 'var(--mits-red)' }}>
                      Resume →
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Divider / heading separating runs from the playbook library */}
        {activeRuns.length > 0 && playbooks.length > 0 && (
          <div className="flex items-center gap-3 pt-1">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#6b7280' }}>Playbook Library</span>
            <div className="flex-1 h-px" style={{ background: '#e5e7eb' }} />
          </div>
        )}

        {/* Playbooks */}
        {playbooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center" style={{ color: '#9ca3af' }}>
            <div className="text-sm font-medium">No playbooks yet</div>
            <div className="text-xs mt-1">Create a playbook to bundle documents into a runnable workflow</div>
          </div>
        ) : playbooks.map((pb) => {
          const isOpen = expandedId === pb.id
          const members = manifests[pb.id] ?? []
          const pbRuns = runs.filter((r) => r.groupId === pb.id)
          return (
            <div key={pb.id} className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
              <div className="flex items-start gap-3 px-4 py-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0 mt-1" style={{ background: pb.color }} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm" style={{ color: 'var(--mits-charcoal)' }}>{pb.name}</div>
                  {pb.description && <div className="text-xs mt-0.5" style={{ color: '#6b7280' }}>{pb.description}</div>}
                  {pb.trigger && <div className="text-xs mt-1" style={{ color: '#9ca3af' }}><span style={{ fontWeight: 600 }}>Trigger:</span> {pb.trigger}</div>}
                  {pbRuns.length > 0 && <div className="text-xs mt-1" style={{ color: '#9ca3af' }}>{pbRuns.length} run{pbRuns.length > 1 ? 's' : ''}</div>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => onStartPlaybook(pb)} className="text-xs px-2.5 py-1 rounded text-white font-medium" style={{ background: 'var(--mits-red)' }}>▶ Start</button>
                  <button onClick={() => onEditPlaybook(pb)} className="text-xs px-2 py-1 rounded border transition-colors hover:bg-gray-50" style={{ borderColor: '#e5e7eb', color: '#6b7280' }}>Edit</button>
                  <button onClick={() => { if (confirm(`Delete playbook "${pb.name}"? Its runs are removed too. Documents are not deleted.`)) onDeletePlaybook(pb.id) }} className="text-xs px-2 py-1 rounded border transition-colors hover:bg-red-50" style={{ borderColor: '#fca5a5', color: '#dc2626' }}>Delete</button>
                  <button onClick={() => toggle(pb.id)} className="text-xs px-2 py-1 rounded border transition-colors hover:bg-gray-50 ml-1" style={{ borderColor: '#e5e7eb', color: '#6b7280' }}>{isOpen ? '▲' : '▼ Manage'}</button>
                </div>
              </div>

              {isOpen && (
                <div className="border-t px-4 py-3" style={{ borderColor: '#f3f4f6', background: '#fafafa' }}>
                  {pb.outcome && (
                    <div className="text-xs mb-3 rounded p-2" style={{ background: '#fff', border: '1px solid #e5e7eb', color: '#374151' }}>
                      <span style={{ fontWeight: 600 }}>Outcome:</span> {pb.outcome}
                    </div>
                  )}

                  {PHASES.map((phase) => {
                    const phaseItems = members.filter((m) => m.phase === phase.id).sort((a, b) => a.sortOrder - b.sortOrder)
                    if (phaseItems.length === 0) return null
                    return (
                      <div key={phase.id} className="mb-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: phase.color }}>{phase.label}</span>
                          <span className="text-xs" style={{ color: '#9ca3af' }}>{phaseItems.length}</span>
                        </div>
                        <div className="space-y-1">
                          {phaseItems.map((m, i) => {
                            const code = CATEGORY_MAP[m.category]?.code ?? ''
                            return (
                              <div key={m.memberId} className="flex items-center gap-2 bg-white rounded border px-2.5 py-1.5" style={{ borderColor: '#e5e7eb' }}>
                                <span className="text-xs font-mono" style={{ color: '#9ca3af', minWidth: 20 }}>{i + 1}.</span>
                                {code && <span className="text-xs px-1.5 py-0.5 rounded font-bold flex-shrink-0" style={{ background: '#eaeff4', color: '#0e2841' }}>{code}</span>}
                                <span className="text-sm flex-1 truncate" style={{ color: '#1f2937' }}>{m.docId ? `${m.docId} · ` : ''}{m.title}</span>
                                <button onClick={() => toggleRequired(pb.id, m)} className="text-xs px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: m.required === 'Conditional' ? '#ffedd5' : '#dcfce7', color: m.required === 'Conditional' ? '#c2410c' : '#166534' }} title="Toggle Required / Conditional">
                                  {m.required}
                                </button>
                                <select value={m.phase} onChange={(e) => changePhase(pb.id, m, e.target.value)} className="text-xs rounded border flex-shrink-0" style={{ borderColor: '#e5e7eb', color: '#6b7280', padding: '2px 4px' }}>
                                  {PHASES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                                </select>
                                <button onClick={() => move(pb.id, m, -1)} disabled={i === 0} className="text-xs px-1 flex-shrink-0" style={{ color: i === 0 ? '#d1d5db' : '#6b7280' }}>↑</button>
                                <button onClick={() => move(pb.id, m, 1)} disabled={i === phaseItems.length - 1} className="text-xs px-1 flex-shrink-0" style={{ color: i === phaseItems.length - 1 ? '#d1d5db' : '#6b7280' }}>↓</button>
                                <button onClick={() => removeMember(pb.id, m)} className="text-xs px-1 flex-shrink-0 hover:text-red-500" style={{ color: '#9ca3af' }} title="Remove">✕</button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}

                  {members.length === 0 && (
                    <div className="text-xs text-center py-3" style={{ color: '#9ca3af' }}>No documents yet. Add some below.</div>
                  )}

                  {/* Add documents */}
                  {addingFor === pb.id ? (
                    <div className="mt-2 rounded-lg border" style={{ borderColor: '#e5e7eb', background: 'white' }}>
                      <div className="p-2 border-b" style={{ borderColor: '#f3f4f6' }}>
                        <input value={addQuery} onChange={(e) => setAddQuery(e.target.value)} autoFocus placeholder="Search documents to add…" className="w-full text-sm" style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 9px', outline: 'none' }} />
                      </div>
                      <div className="max-h-56 overflow-y-auto p-1">
                        {docs
                          .filter((d) => !members.some((m) => m.id === d.id))
                          .filter((d) => !addQuery || `${d.title} ${d.docId}`.toLowerCase().includes(addQuery.toLowerCase()))
                          .slice(0, 50)
                          .map((d) => (
                            <button key={d.id} onClick={() => addDoc(pb.id, d.id)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-gray-50">
                              {CATEGORY_MAP[d.category]?.code && <span className="text-xs px-1.5 py-0.5 rounded font-bold flex-shrink-0" style={{ background: '#eaeff4', color: '#0e2841' }}>{CATEGORY_MAP[d.category].code}</span>}
                              <span className="text-sm truncate flex-1" style={{ color: '#1f2937' }}>{d.docId ? `${d.docId} · ` : ''}{d.title}</span>
                              <span className="text-xs flex-shrink-0" style={{ color: '#e1251b' }}>+ Add</span>
                            </button>
                          ))}
                      </div>
                      <div className="p-2 border-t text-right" style={{ borderColor: '#f3f4f6' }}>
                        <button onClick={() => { setAddingFor(null); setAddQuery('') }} className="text-xs px-3 py-1 rounded border" style={{ borderColor: '#d1d5db', color: '#6b7280' }}>Done</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => { setAddingFor(pb.id); setAddQuery('') }} className="text-xs px-3 py-1.5 rounded border transition-colors hover:bg-gray-50 mt-1" style={{ borderColor: '#d1d5db', color: '#374151' }}>
                      + Add documents
                    </button>
                  )}

                  {/* This playbook's runs */}
                  {pbRuns.length > 0 && (
                    <div className="mt-4 pt-3 border-t" style={{ borderColor: '#f3f4f6' }}>
                      <div className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#9ca3af' }}>Runs</div>
                      <div className="space-y-1">
                        {pbRuns.map((r) => (
                          <div key={r.id} className="flex items-center gap-2 text-xs">
                            <button onClick={() => onOpenRun(r.id)} className="flex-1 text-left truncate hover:underline" style={{ color: '#2563eb' }}>
                              {r.clientName || 'Run'}{r.ticket ? ` · ${r.ticket}` : ''} — {r.doneCount}/{r.total} {r.status === 'complete' ? '✓' : r.status === 'paused' ? '(paused)' : ''}
                            </button>
                            <button onClick={() => { if (confirm('Delete this run?')) onDeleteRun(r.id) }} className="px-1 hover:text-red-500" style={{ color: '#9ca3af' }}>✕</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
