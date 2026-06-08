import { useMemo } from 'react'
import { PHASES, PHASE_MAP, PHASE_ORDER, CATEGORY_MAP } from '../data/categories'

const STATUS_BADGE = {
  in_progress: { label: 'In Progress', color: '#c2410c', bg: '#ffedd5' },
  complete:    { label: 'Complete',    color: '#166534', bg: '#dcfce7' },
  paused:      { label: 'Paused',      color: '#6b7280', bg: '#f3f4f6' },
}

export default function PlaybookRunView({ runDetail, playbook, docs, onToggleItem, onOpenDoc, onSetStatus, onDelete, onBack }) {
  const { run, items } = runDetail
  const docsById = useMemo(() => Object.fromEntries(docs.map((d) => [d.id, d])), [docs])

  const total = items.length
  const doneCount = items.filter((i) => i.done).length
  const pct = total ? Math.round((doneCount / total) * 100) : 0

  // Group items by phase, ordered by the standard phase order then sort_order
  const phaseGroups = useMemo(() => {
    const groups = {}
    for (const it of items) {
      ;(groups[it.phase] ??= []).push(it)
    }
    const names = Object.keys(groups).sort(
      (a, b) => (PHASE_ORDER[a] ?? 99) - (PHASE_ORDER[b] ?? 99)
    )
    return names.map((name) => ({
      name,
      meta: PHASE_MAP[name],
      items: groups[name].slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    }))
  }, [items])

  // The next undone item, in phase order then sort order, for "Open next document"
  const orderedItems = useMemo(() => phaseGroups.flatMap((pg) => pg.items), [phaseGroups])
  const nextItem = orderedItems.find((i) => !i.done)
  const status = STATUS_BADGE[run.status] ?? STATUS_BADGE.in_progress

  const openItem = (it) => {
    const doc = docsById[it.documentId]
    if (doc) onOpenDoc(doc)
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--app-bg)' }}>
      {/* Header */}
      <div className="px-6 py-4 border-b" style={{ borderColor: '#e5e7eb', background: 'white' }}>
        <button onClick={onBack} className="text-xs mb-2 flex items-center gap-1" style={{ color: '#6b7280' }}>
          ← Back to Playbooks
        </button>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: playbook?.color ?? '#e1251b' }} />
              <h1 className="font-semibold text-base truncate" style={{ color: 'var(--mits-charcoal)' }}>{playbook?.name ?? 'Playbook Run'}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0" style={{ background: status.bg, color: status.color }}>
                {status.label}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: '#6b7280' }}>
              {run.clientName && <span>Client: <span style={{ color: 'var(--mits-charcoal)', fontWeight: 600 }}>{run.clientName}</span></span>}
              {run.ticket && <span>Ticket: <span style={{ color: 'var(--mits-charcoal)', fontWeight: 600 }}>{run.ticket}</span></span>}
              {run.startedAt && <span>Started {new Date(run.startedAt).toLocaleDateString()}</span>}
            </div>
          </div>
          <div className="text-right flex-shrink-0" style={{ minWidth: 150 }}>
            <div className="text-2xl font-bold leading-none" style={{ color: 'var(--mits-charcoal)' }}>{doneCount} / {total}</div>
            <div className="h-1.5 rounded-full mt-2 overflow-hidden" style={{ background: '#f0f0f2' }}>
              <div className="h-full" style={{ width: `${pct}%`, background: 'var(--mits-red)' }} />
            </div>
            <div className="text-xs mt-1" style={{ color: '#9ca3af' }}>{pct}% complete</div>
          </div>
        </div>
      </div>

      {/* Phases */}
      <div className="flex-1 p-4 space-y-3">
        {phaseGroups.length === 0 ? (
          <div className="text-sm text-center py-10" style={{ color: '#9ca3af' }}>
            This playbook had no documents when the run was started.
          </div>
        ) : phaseGroups.map((pg) => {
          const pDone = pg.items.filter((i) => i.done).length
          const allDone = pDone === pg.items.length
          const meta = pg.meta ?? { label: pg.name, color: '#6b7280', bg: '#f3f4f6', summary: '' }
          return (
            <div key={pg.name} className="rounded-xl border overflow-hidden" style={{ background: 'white', borderColor: '#e5e7eb' }}>
              <div
                className="flex items-center justify-between px-4 py-2.5 border-b"
                style={{ borderColor: '#f3f4f6', borderLeft: `4px solid ${meta.color}`, background: allDone ? '#f0fdf4' : meta.bg + '55' }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--mits-charcoal)' }}>{meta.label}</span>
                  <span className="text-xs font-medium" style={{ color: allDone ? '#16a34a' : meta.color }}>
                    {allDone ? '✓ Complete' : `${pDone} of ${pg.items.length}`}
                  </span>
                </div>
                {meta.summary && <span className="text-xs hidden sm:block" style={{ color: '#9ca3af' }}>{meta.summary}</span>}
              </div>
              <div className="py-1">
                {pg.items.map((it) => {
                  const doc = docsById[it.documentId]
                  const code = doc ? (CATEGORY_MAP[doc.category]?.code ?? '') : ''
                  const isNext = nextItem && nextItem.id === it.id
                  const conditional = it.required === 'Conditional'
                  return (
                    <div
                      key={it.id}
                      className="flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0"
                      style={{ borderColor: '#f5f5f7', background: isNext ? '#fffaf7' : 'white' }}
                    >
                      <input
                        type="checkbox"
                        checked={it.done}
                        onChange={(e) => onToggleItem(it.id, e.target.checked)}
                        style={{ width: 16, height: 16, accentColor: '#e1251b', flexShrink: 0 }}
                      />
                      {code && (
                        <span className="text-xs px-1.5 py-0.5 rounded font-bold flex-shrink-0" style={{ background: '#eaeff4', color: '#0e2841', minWidth: 34, textAlign: 'center' }}>
                          {code}
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {doc?.docId && <span className="text-xs font-mono flex-shrink-0" style={{ color: '#9ca3af' }}>{doc.docId}</span>}
                          <span className="text-sm truncate" style={{ color: it.done ? '#9ca3af' : '#1f2937', textDecoration: it.done ? 'line-through' : 'none', fontWeight: isNext ? 600 : 400 }}>
                            {it.docTitle || doc?.title || '(document removed)'}
                          </span>
                          {isNext && <span className="text-xs font-semibold flex-shrink-0" style={{ color: '#e1251b' }}>← UP NEXT</span>}
                        </div>
                        {conditional && (
                          <div className="text-xs mt-0.5" style={{ color: '#c2410c' }}>
                            Conditional{it.condition ? ` — ${it.condition}` : ''}
                          </div>
                        )}
                      </div>
                      {doc ? (
                        <button
                          onClick={() => openItem(it)}
                          className="text-xs px-2 py-1 rounded border transition-colors hover:bg-gray-50 flex-shrink-0"
                          style={{ borderColor: '#d1d5db', color: '#374151' }}
                        >
                          Open
                        </button>
                      ) : (
                        <span className="text-xs flex-shrink-0" style={{ color: '#c2410c' }}>removed</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer actions */}
      <div className="sticky bottom-0 flex items-center justify-between px-6 py-3 border-t" style={{ borderColor: '#e5e7eb', background: 'white' }}>
        <button
          onClick={() => { if (confirm('Delete this run? Its progress will be lost. The playbook template is not affected.')) onDelete(run.id) }}
          className="text-xs px-3 py-1.5 rounded border transition-colors hover:bg-red-50"
          style={{ borderColor: '#fca5a5', color: '#dc2626' }}
        >
          Delete run
        </button>
        <div className="flex gap-2">
          {run.status === 'in_progress' ? (
            <button onClick={() => onSetStatus(run.id, 'paused')} className="text-xs px-3 py-1.5 rounded border transition-colors hover:bg-gray-50" style={{ borderColor: '#d1d5db', color: '#374151' }}>
              Pause
            </button>
          ) : run.status === 'paused' ? (
            <button onClick={() => onSetStatus(run.id, 'in_progress')} className="text-xs px-3 py-1.5 rounded border transition-colors hover:bg-gray-50" style={{ borderColor: '#d1d5db', color: '#374151' }}>
              Resume
            </button>
          ) : null}
          {nextItem ? (
            <button onClick={() => openItem(nextItem)} className="text-xs px-3 py-1.5 rounded text-white font-medium" style={{ background: 'var(--mits-red)' }}>
              Open next document →
            </button>
          ) : run.status !== 'complete' ? (
            <button onClick={() => onSetStatus(run.id, 'complete')} className="text-xs px-3 py-1.5 rounded text-white font-medium" style={{ background: '#16a34a' }}>
              ✓ Mark complete
            </button>
          ) : (
            <button onClick={() => onSetStatus(run.id, 'in_progress')} className="text-xs px-3 py-1.5 rounded border transition-colors hover:bg-gray-50" style={{ borderColor: '#d1d5db', color: '#374151' }}>
              Reopen
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
