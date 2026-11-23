import { useState, useMemo } from 'react'
import { isTauri } from '../data/db'
import { logEvent } from '../data/repo'
import { todayLocal } from '../data/categories'
import {
  ID_STATUSES, importRegistryJson, buildRegistryJson, retireDocId, releaseReservedId,
  updateIdEntry, saveDomain, saveType, addIssue, resolveIssue, recordDocIdUse,
} from '../data/registry'
import { registryHealth, healthCounts } from '../data/health'
import { exportWorkbook } from '../data/excelExport'

const REGISTRY_FILE = 'IDX-IT-001_Registry.json'

const STATUS_STYLE = {
  Reserved:  { bg: '#e0e7ff', color: '#4338ca' },
  Draft:     { bg: '#fef3c7', color: '#b45309' },
  Filed:     { bg: '#dcfce7', color: '#15803d' },
  Outside:   { bg: '#f3f4f6', color: '#4b5563' },
  Unlocated: { bg: '#ffedd5', color: '#c2410c' },
  Tool:      { bg: '#e0f2fe', color: '#0369a1' },
  Retired:   { bg: '#f3f4f6', color: '#9ca3af' },
}

const TABS = [
  { id: 'health', label: 'Health' },
  { id: 'ledger', label: 'ID Ledger' },
  { id: 'series', label: 'Next Available' },
  { id: 'types', label: 'Type Codes' },
  { id: 'domains', label: 'Domain Codes' },
  { id: 'issues', label: 'Open Issues' },
  { id: 'folders', label: 'Folder Map' },
]

const joinPath = (dir, name) => (dir ? `${dir.replace(/[\\/]$/, '')}${dir.includes('\\') ? '\\' : '/'}${name}` : name)

export default function RegistryView({ registry, docs, onChanged, vaultPath, missingIds, onOpenDoc }) {
  const [tab, setTab] = useState('health')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null) // { text, error }

  const flash = (text, error = false) => {
    setMessage({ text, error })
    if (!error) setTimeout(() => setMessage(null), 6000)
  }
  const run = async (fn, okText) => {
    setBusy(true)
    try {
      await fn()
      await onChanged()
      if (okText) flash(okText)
    } catch (err) {
      flash(err?.message ?? String(err), true)
    } finally {
      setBusy(false)
    }
  }

  // ── Import / export ──────────────────────────────────────
  const handleImport = async () => {
    let text = ''
    try {
      if (isTauri()) {
        const { open } = await import('@tauri-apps/plugin-dialog')
        const picked = await open({
          multiple: false,
          defaultPath: joinPath(vaultPath, REGISTRY_FILE),
          filters: [{ name: 'Registry JSON', extensions: ['json'] }],
        })
        if (!picked) return
        const { invoke } = await import('@tauri-apps/api/core')
        text = await invoke('read_text_file', { path: picked })
      } else {
        text = await new Promise((resolve) => {
          const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.json' })
          input.onchange = () => input.files[0]?.text().then(resolve)
          input.click()
        })
      }
    } catch (err) {
      flash(`Couldn’t read the file: ${err?.message ?? err}`, true)
      return
    }
    let json
    try { json = JSON.parse(text) } catch { flash('That file isn’t valid JSON.', true); return }
    if (registry?.ids?.length && !window.confirm(
      `Merge ${json.ids?.length ?? 0} IDs from IDX-IT-001 v${json.version ?? '?'} into the registry?\n\n` +
      'Entries in the file overwrite the same entries here. Nothing here is deleted.',
    )) return
    await run(async () => {
      const r = await importRegistryJson(json, docs)
      logEvent('Registry imported', `IDX-IT-001 v${json.version ?? '?'}: ${r.ids} IDs, ${r.domains} domains, ${r.types} types`)
      const skipped = r.skipped.length ? ` Not added (unknown codes): ${r.skipped.join(', ')}.` : ''
      flash(`Imported ${r.ids} IDs (${r.retired} retired, ${r.fromLibrary} added from the library), ${r.types} type codes, ${r.domains} domain codes, ${r.issues} new issues, ${r.folders} folders.${skipped}`)
    })
  }

  const handleExport = async () => {
    const json = JSON.stringify(buildRegistryJson(registry, docs), null, 2)
    try {
      if (isTauri()) {
        const { save } = await import('@tauri-apps/plugin-dialog')
        const path = await save({ defaultPath: joinPath(vaultPath, REGISTRY_FILE), filters: [{ name: 'Registry JSON', extensions: ['json'] }] })
        if (!path) return
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('write_text_file', { path, contents: json })
        flash(`Exported to ${path}`)
      } else {
        const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
        Object.assign(document.createElement('a'), { href: url, download: REGISTRY_FILE }).click()
        URL.revokeObjectURL(url)
      }
      logEvent('Registry exported', REGISTRY_FILE)
    } catch (err) {
      flash(`Export failed: ${err?.message ?? err}`, true)
    }
  }

  const handleExcel = async () => {
    setBusy(true)
    try {
      const saved = await exportWorkbook({ vaultPath })
      if (saved) {
        logEvent('Inventory exported', saved)
        flash(isTauri() ? `Saved ${saved}` : `Downloaded ${saved}`)
      }
    } catch (err) {
      flash(`Excel export failed: ${err?.message ?? err}`, true)
    } finally {
      setBusy(false)
    }
  }

  const empty = !registry || registry.ids.length === 0
  const checks = useMemo(
    () => (registry ? registryHealth({ registry, docs, missingIds }) : []),
    [registry, docs, missingIds],
  )
  const counts = healthCounts(checks)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#e5e7eb', background: 'white' }}>
        <div>
          <h1 className="font-semibold text-base" style={{ color: 'var(--mits-charcoal)' }}>Doc ID Registry</h1>
          <div className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
            The master list behind IDX-IT-001 — every Doc ID issued or retired, the codes, and the next free number
          </div>
        </div>
        {registry && (
          <div className="flex gap-2 flex-shrink-0 whitespace-nowrap">
            <button onClick={handleImport} disabled={busy} className="text-xs px-3 py-1.5 rounded border" style={{ borderColor: '#d1d5db', color: '#374151' }}>
              Import JSON…
            </button>
            {!empty && <>
              <button onClick={handleExcel} disabled={busy} className="text-xs px-3 py-1.5 rounded border" style={{ borderColor: '#d1d5db', color: '#374151' }}
                title="Inventory, ledger, codes, retired IDs, issues, folder map and health in one workbook">
                Export to Excel…
              </button>
              <button onClick={handleExport} disabled={busy} className="text-xs px-3 py-1.5 rounded text-white" style={{ background: 'var(--mits-red)' }}
                title="IDX-IT-001_Registry.json — what the IDX-IT-001 document is built from">
                Export for IDX-IT-001…
              </button>
            </>}
          </div>
        )}
      </div>

      {message && (
        <div className="mx-4 mt-3 text-xs px-3 py-2 rounded flex justify-between gap-3"
          style={{ background: message.error ? '#fee2e2' : '#dcfce7', color: message.error ? '#b91c1c' : '#166534' }}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} style={{ opacity: 0.6 }}>✕</button>
        </div>
      )}

      {!registry ? (
        <Notice title="The registry tables aren’t set up yet">
          Run <span className="font-mono">supabase/migrations/20261123_doc_id_registry.sql</span> in the Supabase SQL
          editor, then reopen this page.
        </Notice>
      ) : empty ? (
        <Notice title="Start by importing IDX-IT-001">
          Import <span className="font-mono">{REGISTRY_FILE}</span> from the library to load the type codes, domain
          codes, every issued and retired ID, open issues and the folder map. Documents in DocCenter whose ID isn’t
          in the file are added as Filed.
          <div className="mt-3">
            <button onClick={handleImport} disabled={busy} className="text-xs px-3 py-1.5 rounded text-white" style={{ background: 'var(--mits-red)' }}>
              {busy ? 'Importing…' : 'Import IDX-IT-001_Registry.json…'}
            </button>
          </div>
        </Notice>
      ) : (
        <>
          <div className="flex gap-1 px-4 pt-3 border-b overflow-x-auto" style={{ borderColor: '#e5e7eb' }}>
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className="text-xs px-3 py-1.5 -mb-px border-b-2 whitespace-nowrap"
                style={{ borderColor: tab === t.id ? 'var(--mits-red)' : 'transparent', color: tab === t.id ? 'var(--mits-charcoal)' : '#6b7280', fontWeight: tab === t.id ? 600 : 400 }}>
                {t.label}
                {t.id === 'health' && counts.error + counts.warning > 0 && (
                  <span className="ml-1.5 px-1.5 rounded-full" style={{ background: counts.error ? '#fee2e2' : '#ffedd5', color: counts.error ? '#b91c1c' : '#c2410c' }}>
                    {counts.error + counts.warning}
                  </span>
                )}
                {t.id === 'issues' && registry.issues.some((i) => i.status === 'open') && (
                  <span className="ml-1.5 px-1.5 rounded-full" style={{ background: '#fee2e2', color: '#b91c1c' }}>
                    {registry.issues.filter((i) => i.status === 'open').length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {tab === 'health' && <Health checks={checks} counts={counts} run={run} busy={busy} onOpenDoc={onOpenDoc} />}
            {tab === 'ledger' && <Ledger registry={registry} docs={docs} run={run} busy={busy} />}
            {tab === 'series' && <Series registry={registry} />}
            {tab === 'types' && <Types registry={registry} run={run} busy={busy} />}
            {tab === 'domains' && <Domains registry={registry} run={run} busy={busy} />}
            {tab === 'issues' && <Issues registry={registry} run={run} busy={busy} />}
            {tab === 'folders' && <Folders registry={registry} />}
          </div>
        </>
      )}
    </div>
  )
}

// ── Health ─────────────────────────────────────────────────────────
const SEVERITY_STYLE = {
  error:   { border: '#fca5a5', bg: '#fff5f5', color: '#b91c1c', label: 'Error' },
  warning: { border: '#fed7aa', bg: '#fffbf5', color: '#c2410c', label: 'Warning' },
  info:    { border: '#e5e7eb', bg: 'white',   color: '#6b7280', label: 'Info' },
}

function Health({ checks, counts, run, busy, onOpenDoc }) {
  const [open, setOpen] = useState({}) // key → expanded
  const applyFix = (fix) => run(async () => {
    if (fix.kind === 'record') await recordDocIdUse(fix.docId, fix.title)
    else if (fix.kind === 'status') await updateIdEntry(fix.docId, { status: fix.status })
    logEvent('Registry health fix', `${fix.docId}: ${fix.label}`)
  }, `${fix.docId}: ${fix.label.toLowerCase()} — done.`)

  if (!checks.length) {
    return <div className="text-sm py-10 text-center" style={{ color: '#15803d' }}>✓ The registry and the library agree — nothing to fix.</div>
  }
  return (
    <div className="space-y-2">
      <div className="text-xs mb-1" style={{ color: '#6b7280' }}>
        Where the registry and what’s filed in SharePoint disagree: {counts.error} error{counts.error === 1 ? '' : 's'},{' '}
        {counts.warning} warning{counts.warning === 1 ? '' : 's'}, {counts.info} for information.
        File checks reflect this machine’s synced copy of the library.
      </div>
      {checks.map((c) => {
        const st = SEVERITY_STYLE[c.severity]
        const expanded = open[c.key] ?? c.severity !== 'info'
        return (
          <div key={c.key} className="rounded-lg border text-xs" style={{ borderColor: st.border, background: st.bg }}>
            <button className="w-full flex items-center gap-2 px-3 py-2 text-left" onClick={() => setOpen((o) => ({ ...o, [c.key]: !expanded }))}>
              <span className="font-semibold px-1.5 rounded" style={{ color: st.color }}>{st.label}</span>
              <span className="font-semibold flex-1" style={{ color: 'var(--mits-charcoal)' }}>{c.title}</span>
              <span className="px-1.5 rounded-full" style={{ background: 'white', color: st.color }}>{c.items.length}</span>
              <span style={{ color: '#9ca3af' }}>{expanded ? '▾' : '▸'}</span>
            </button>
            {expanded && (
              <div className="px-3 pb-2">
                <div className="mb-1.5" style={{ color: '#4b5563' }}>{c.explain}</div>
                <table className="w-full">
                  <tbody>
                    {c.items.map((i, n) => (
                      <tr key={`${i.docId}-${i.docRefId ?? n}`} className="border-t align-top" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
                        <Td className="font-mono whitespace-nowrap">{i.docId || '—'}</Td>
                        <Td>{i.title}</Td>
                        <Td style={{ color: '#6b7280' }}>{i.detail}</Td>
                        <Td className="whitespace-nowrap text-right">
                          {i.docRefId && onOpenDoc && <LinkBtn onClick={() => onOpenDoc(i.docRefId)}>Open</LinkBtn>}
                          {i.fix && <LinkBtn disabled={busy} onClick={() => applyFix(i.fix)}>{i.fix.label}</LinkBtn>}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Ledger ─────────────────────────────────────────────────────────
function Ledger({ registry, docs, run, busy }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [retiring, setRetiring] = useState(null) // docId being retired
  const [editing, setEditing] = useState(null)   // docId being edited

  const byId = useMemo(() => {
    const m = new Map()
    for (const d of docs) if (d.docId) m.set(d.docId, [...(m.get(d.docId) ?? []), d])
    return m
  }, [docs])

  const rows = registry.ids.filter((e) =>
    (!status || e.status === status) &&
    (!query || `${e.docId} ${e.title} ${e.notes}`.toLowerCase().includes(query.toLowerCase())),
  )
  const counts = Object.fromEntries(ID_STATUSES.map((s) => [s, registry.ids.filter((e) => e.status === s).length]))

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search IDs, titles, notes…"
          className="text-xs px-2 py-1.5 rounded border flex-1" style={{ borderColor: '#d1d5db', minWidth: 180 }} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="text-xs px-2 py-1.5 rounded border" style={{ borderColor: '#d1d5db' }}>
          <option value="">All statuses ({registry.ids.length})</option>
          {ID_STATUSES.filter((s) => counts[s]).map((s) => <option key={s} value={s}>{s} ({counts[s]})</option>)}
        </select>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr style={{ color: '#6b7280' }} className="text-left">
            <Th>Doc ID</Th><Th>Title</Th><Th>Status</Th><Th>In DocCenter</Th><Th>Notes</Th><Th />
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => {
            const inLib = byId.get(e.docId) ?? []
            return [
              <tr key={e.docId} className="border-t align-top" style={{ borderColor: '#f3f4f6' }}>
                <Td className="font-mono whitespace-nowrap">{e.docId}</Td>
                <Td>{e.title || <span style={{ color: '#9ca3af' }}>—</span>}</Td>
                <Td><StatusChip status={e.status} /></Td>
                <Td>
                  {inLib.length === 0 ? <span style={{ color: '#9ca3af' }}>—</span>
                    : inLib.length === 1 ? <span title={inLib[0].fileName}>✓</span>
                      : <span style={{ color: '#b91c1c' }} title={inLib.map((d) => d.fileName).join('\n')}>⚠ {inLib.length} documents</span>}
                </Td>
                <Td style={{ color: '#6b7280' }}>
                  {e.status === 'Retired'
                    ? <>Retired {e.retiredAt}{e.replacedBy && <> → <span className="font-mono">{e.replacedBy}</span></>}{e.retireReason && <> · {e.retireReason}</>}</>
                    : e.notes}
                </Td>
                <Td className="whitespace-nowrap text-right">
                  {e.status !== 'Retired' && <>
                    <LinkBtn onClick={() => { setEditing(e.docId); setRetiring(null) }}>Edit</LinkBtn>
                    <LinkBtn onClick={() => { setRetiring(e.docId); setEditing(null) }}>Retire</LinkBtn>
                  </>}
                  {e.status === 'Reserved' && (
                    <LinkBtn disabled={busy} onClick={() => window.confirm(`Release ${e.docId}? It was never used, so the number goes back to its series.`) &&
                      run(() => releaseReservedId(e.docId).then(() => logEvent('Doc ID released', e.docId)), `Released ${e.docId}.`)}>
                      Release
                    </LinkBtn>
                  )}
                </Td>
              </tr>,
              retiring === e.docId && (
                <tr key={`${e.docId}-retire`}><td colSpan={6}>
                  <RetireForm entry={e} busy={busy} onCancel={() => setRetiring(null)} onSubmit={(f) =>
                    run(async () => {
                      await retireDocId(e.docId, f)
                      logEvent('Doc ID retired', `${e.docId}${f.replacedBy ? ` → replaced by ${f.replacedBy}` : ''}${f.reason ? ` (${f.reason})` : ''}`)
                      setRetiring(null)
                    }, `${e.docId} retired. It will never be issued again.`)} />
                </td></tr>
              ),
              editing === e.docId && (
                <tr key={`${e.docId}-edit`}><td colSpan={6}>
                  <EditEntryForm entry={e} busy={busy} onCancel={() => setEditing(null)} onSubmit={(f) =>
                    run(async () => { await updateIdEntry(e.docId, f); setEditing(null) }, `${e.docId} updated.`)} />
                </td></tr>
              ),
            ]
          })}
        </tbody>
      </table>
      {rows.length === 0 && <div className="text-xs py-6 text-center" style={{ color: '#9ca3af' }}>No matching IDs</div>}
    </div>
  )
}

function RetireForm({ entry, busy, onSubmit, onCancel }) {
  const [replacedBy, setReplacedBy] = useState('')
  const [reason, setReason] = useState('')
  const [date, setDate] = useState(todayLocal())
  return (
    <InlineForm onCancel={onCancel} busy={busy} submitLabel={`Retire ${entry.docId}`} danger
      onSubmit={() => onSubmit({ replacedBy: replacedBy.trim().toUpperCase(), reason: reason.trim(), date })}>
      <div className="text-xs mb-2" style={{ color: '#b91c1c' }}>Retiring is permanent — the number is never issued again.</div>
      <div className="grid grid-cols-3 gap-2">
        <Input label="Replaced by (optional)" value={replacedBy} onChange={setReplacedBy} placeholder="e.g. RBK-NET-001" mono />
        <Input label="Retired on" value={date} onChange={setDate} type="date" />
        <Input label="Reason" value={reason} onChange={setReason} placeholder="e.g. Reclassified as runbook" />
      </div>
    </InlineForm>
  )
}

function EditEntryForm({ entry, busy, onSubmit, onCancel }) {
  const [title, setTitle] = useState(entry.title)
  const [status, setStatus] = useState(entry.status)
  const [notes, setNotes] = useState(entry.notes)
  return (
    <InlineForm onCancel={onCancel} busy={busy} submitLabel="Save" onSubmit={() => onSubmit({ title: title.trim(), status, notes: notes.trim() })}>
      <div className="grid grid-cols-3 gap-2">
        <Input label="Title" value={title} onChange={setTitle} />
        <label className="text-xs" style={{ color: '#6b7280' }}>Status
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="block w-full mt-1 text-xs px-2 py-1.5 rounded border" style={{ borderColor: '#d1d5db' }}>
            {ID_STATUSES.filter((s) => s !== 'Retired').map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <Input label="Notes" value={notes} onChange={setNotes} />
      </div>
    </InlineForm>
  )
}

// ── Series ─────────────────────────────────────────────────────────
function Series({ registry }) {
  const [query, setQuery] = useState('')
  const rows = registry.series.filter((s) => !query || s.series.toLowerCase().includes(query.toLowerCase()))
  return (
    <div>
      <div className="text-xs mb-3" style={{ color: '#6b7280' }}>
        Retired numbers count as issued, so they are never handed out again. Use <strong>Reserve next</strong> in the
        document form to claim one — that reserves it here so nobody else gets the same number.
      </div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter series, e.g. SOP or MDM"
        className="text-xs px-2 py-1.5 rounded border mb-3 w-64" style={{ borderColor: '#d1d5db' }} />
      <table className="w-full text-xs">
        <thead><tr className="text-left" style={{ color: '#6b7280' }}><Th>Series</Th><Th>Issued numbers</Th><Th>Next available</Th></tr></thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.series} className="border-t" style={{ borderColor: '#f3f4f6' }}>
              <Td className="font-mono">{s.series}</Td>
              <Td className="font-mono" style={{ color: '#6b7280' }}>{s.issued.map((n) => String(n).padStart(3, '0')).join(', ')}</Td>
              <Td className="font-mono font-semibold">{s.nextAvailable || <span style={{ color: '#9ca3af', fontWeight: 400 }}>retired code</span>}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Type codes ─────────────────────────────────────────────────────
function Types({ registry, run, busy }) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <div className="text-xs" style={{ color: '#6b7280' }}>
          <strong>DocCenter folder</strong> is the vault folder holding that type — it decides which type
          <strong> Reserve next</strong> uses and flags documents filed in the wrong folder.
        </div>
        <button onClick={() => { setAdding(true); setEditing(null) }} className="text-xs px-3 py-1.5 rounded border flex-shrink-0" style={{ borderColor: '#d1d5db' }}>Add type code</button>
      </div>
      {adding && (
        <CodeForm kind="type" busy={busy} existing={registry.types} onCancel={() => setAdding(false)}
          onSubmit={(f) => run(async () => { await saveType(f); logEvent('Type code added', `${f.code} — ${f.name}`); setAdding(false) }, `Type code ${f.code} added.`)} />
      )}
      <table className="w-full text-xs">
        <thead><tr className="text-left" style={{ color: '#6b7280' }}><Th>Code</Th><Th>Type</Th><Th>Use</Th><Th>DocCenter folder</Th><Th>Active</Th><Th /></tr></thead>
        <tbody>
          {registry.types.map((t) => [
            <tr key={t.code} className="border-t" style={{ borderColor: '#f3f4f6', opacity: t.active ? 1 : 0.5 }}>
              <Td className="font-mono font-semibold">{t.code}</Td><Td>{t.name}</Td><Td style={{ color: '#6b7280' }}>{t.use}</Td>
              <Td>{t.folder}</Td><Td>{t.active ? 'Yes' : 'Retired'}</Td>
              <Td className="text-right"><LinkBtn onClick={() => { setEditing(t.code); setAdding(false) }}>Edit</LinkBtn></Td>
            </tr>,
            editing === t.code && (
              <tr key={`${t.code}-edit`}><td colSpan={6}>
                <CodeForm kind="type" initial={t} busy={busy} onCancel={() => setEditing(null)}
                  onSubmit={(f) => run(async () => { await saveType(f); logEvent('Type code updated', f.code); setEditing(null) }, `Type code ${f.code} saved.`)} />
              </td></tr>
            ),
          ])}
        </tbody>
      </table>
    </div>
  )
}

// ── Domain codes ───────────────────────────────────────────────────
function Domains({ registry, run, busy }) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const used = useMemo(() => {
    const m = {}
    for (const e of registry.ids) m[e.domainCode] = (m[e.domainCode] ?? 0) + 1
    return m
  }, [registry.ids])
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <div className="text-xs" style={{ color: '#6b7280' }}>
          Register a domain here before using it in a Doc ID. Retiring a code keeps its IDs but stops new ones.
        </div>
        <button onClick={() => { setAdding(true); setEditing(null) }} className="text-xs px-3 py-1.5 rounded border flex-shrink-0" style={{ borderColor: '#d1d5db' }}>Add domain code</button>
      </div>
      {adding && (
        <CodeForm kind="domain" busy={busy} existing={registry.domains} onCancel={() => setAdding(false)}
          onSubmit={(f) => run(async () => { await saveDomain(f); logEvent('Domain code added', `${f.code} — ${f.name}`); setAdding(false) }, `Domain code ${f.code} registered.`)} />
      )}
      <table className="w-full text-xs">
        <thead><tr className="text-left" style={{ color: '#6b7280' }}><Th>Code</Th><Th>Domain</Th><Th>Note</Th><Th>IDs</Th><Th>Active</Th><Th /></tr></thead>
        <tbody>
          {registry.domains.map((d) => [
            <tr key={d.code} className="border-t" style={{ borderColor: '#f3f4f6', opacity: d.active ? 1 : 0.5 }}>
              <Td className="font-mono font-semibold">{d.code}</Td><Td>{d.name}</Td><Td style={{ color: '#6b7280' }}>{d.note}</Td>
              <Td>{used[d.code] ?? 0}</Td><Td>{d.active ? 'Yes' : 'Retired'}</Td>
              <Td className="text-right"><LinkBtn onClick={() => { setEditing(d.code); setAdding(false) }}>Edit</LinkBtn></Td>
            </tr>,
            editing === d.code && (
              <tr key={`${d.code}-edit`}><td colSpan={6}>
                <CodeForm kind="domain" initial={d} busy={busy} onCancel={() => setEditing(null)}
                  onSubmit={(f) => run(async () => { await saveDomain(f); logEvent('Domain code updated', f.code); setEditing(null) }, `Domain code ${f.code} saved.`)} />
              </td></tr>
            ),
          ])}
        </tbody>
      </table>
    </div>
  )
}

function CodeForm({ kind, initial, existing = [], busy, onSubmit, onCancel }) {
  const isType = kind === 'type'
  const [code, setCode] = useState(initial?.code ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [extra, setExtra] = useState((isType ? initial?.use : initial?.note) ?? '')
  const [folder, setFolder] = useState(initial?.folder ?? '')
  const [active, setActive] = useState(initial?.active ?? true)
  const pattern = isType ? /^[A-Z]{2,4}$/ : /^[A-Z0-9]{2,5}$/
  const c = code.trim().toUpperCase()
  const error = !initial && c && (!pattern.test(c)
    ? `${isType ? 'Type' : 'Domain'} codes are ${isType ? '2–4 letters' : '2–5 letters or digits'}.`
    : existing.some((x) => x.code === c) ? `${c} already exists.` : '')
  return (
    <InlineForm busy={busy} onCancel={onCancel} submitLabel={initial ? 'Save' : 'Add'} disabled={!c || !name.trim() || !!error}
      onSubmit={() => onSubmit(isType
        ? { code: c, name: name.trim(), use: extra.trim(), folder: folder.trim(), active }
        : { code: c, name: name.trim(), note: extra.trim(), active })}>
      <div className={`grid gap-2 ${isType ? 'grid-cols-5' : 'grid-cols-4'}`}>
        <Input label="Code" value={code} onChange={(v) => setCode(v.toUpperCase())} mono disabled={!!initial} />
        <Input label={isType ? 'Type' : 'Domain'} value={name} onChange={setName} />
        <Input label={isType ? 'Use' : 'Note'} value={extra} onChange={setExtra} />
        {isType && <Input label="DocCenter folder" value={folder} onChange={setFolder} placeholder="e.g. Runbooks" />}
        <label className="text-xs flex items-end gap-1.5 pb-1.5" style={{ color: '#6b7280' }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
        </label>
      </div>
      {error && <div className="text-xs mt-1" style={{ color: '#b91c1c' }}>{error}</div>}
    </InlineForm>
  )
}

// ── Issues ─────────────────────────────────────────────────────────
function Issues({ registry, run, busy }) {
  const [adding, setAdding] = useState(false)
  const [resolving, setResolving] = useState(null)
  const [showResolved, setShowResolved] = useState(false)
  const open = registry.issues.filter((i) => i.status === 'open')
  const resolved = registry.issues.filter((i) => i.status !== 'open')
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <div className="text-xs" style={{ color: '#6b7280' }}>Registry decisions waiting on someone. Resolving one keeps it on record.</div>
        <button onClick={() => setAdding(true)} className="text-xs px-3 py-1.5 rounded border" style={{ borderColor: '#d1d5db' }}>Add issue</button>
      </div>
      {adding && <IssueForm busy={busy} onCancel={() => setAdding(false)}
        onSubmit={(f) => run(async () => { await addIssue(f); setAdding(false) }, 'Issue added.')} />}
      {open.length === 0 && <div className="text-xs py-6 text-center" style={{ color: '#9ca3af' }}>No open issues</div>}
      {open.map((i) => (
        <div key={i.id} className="rounded-lg border p-3 text-xs" style={{ borderColor: '#fed7aa', background: '#fffbf5' }}>
          <div className="flex justify-between gap-3">
            <div className="font-semibold" style={{ color: 'var(--mits-charcoal)' }}>{i.issue}</div>
            {resolving !== i.id && <LinkBtn onClick={() => setResolving(i.id)}>Resolve</LinkBtn>}
          </div>
          {i.detail && <div className="mt-1" style={{ color: '#4b5563' }}>{i.detail}</div>}
          {i.proposedResolution && <div className="mt-1" style={{ color: '#6b7280' }}><strong>Proposed:</strong> {i.proposedResolution}</div>}
          {resolving === i.id && <ResolveForm busy={busy} onCancel={() => setResolving(null)}
            onSubmit={(text) => run(async () => { await resolveIssue(i.id, text); logEvent('Registry issue resolved', i.issue); setResolving(null) }, 'Issue resolved.')} />}
        </div>
      ))}
      {resolved.length > 0 && (
        <div className="pt-2">
          <LinkBtn onClick={() => setShowResolved((v) => !v)}>{showResolved ? 'Hide' : 'Show'} {resolved.length} resolved</LinkBtn>
          {showResolved && resolved.map((i) => (
            <div key={i.id} className="text-xs border-t py-2" style={{ borderColor: '#f3f4f6', color: '#6b7280' }}>
              <span className="line-through">{i.issue}</span> — {i.resolution || 'resolved'} ({(i.resolvedAt || '').slice(0, 10)})
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function IssueForm({ busy, onSubmit, onCancel }) {
  const [issue, setIssue] = useState('')
  const [detail, setDetail] = useState('')
  const [proposedResolution, setProposed] = useState('')
  return (
    <InlineForm busy={busy} onCancel={onCancel} submitLabel="Add" disabled={!issue.trim()}
      onSubmit={() => onSubmit({ issue: issue.trim(), detail: detail.trim(), proposedResolution: proposedResolution.trim() })}>
      <div className="grid grid-cols-3 gap-2">
        <Input label="Issue" value={issue} onChange={setIssue} />
        <Input label="Detail" value={detail} onChange={setDetail} />
        <Input label="Proposed resolution" value={proposedResolution} onChange={setProposed} />
      </div>
    </InlineForm>
  )
}

function ResolveForm({ busy, onSubmit, onCancel }) {
  const [text, setText] = useState('')
  return (
    <InlineForm busy={busy} onCancel={onCancel} submitLabel="Mark resolved" onSubmit={() => onSubmit(text.trim())}>
      <Input label="How was it resolved?" value={text} onChange={setText} />
    </InlineForm>
  )
}

// ── Folders ────────────────────────────────────────────────────────
function Folders({ registry }) {
  return (
    <div>
      <div className="text-xs mb-3" style={{ color: '#6b7280' }}>
        The SharePoint folder map printed in IDX-IT-001, relative to the Menozzi IT - Documents library. It comes
        from the imported registry file.
      </div>
      <table className="w-full text-xs">
        <thead><tr className="text-left" style={{ color: '#6b7280' }}><Th>Folder</Th><Th>Contents</Th><Th>Source</Th></tr></thead>
        <tbody>
          {registry.folders.map((f) => (
            <tr key={f.path} className="border-t" style={{ borderColor: '#f3f4f6' }}>
              <Td className="font-mono">{f.path}</Td><Td>{f.contents}</Td><Td style={{ color: '#6b7280' }}>{f.source}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Small pieces ───────────────────────────────────────────────────
function Notice({ title, children }) {
  return (
    <div className="m-6 max-w-lg rounded-xl border p-5 text-sm" style={{ borderColor: '#e5e7eb', background: 'white', color: '#4b5563' }}>
      <div className="font-semibold mb-1" style={{ color: 'var(--mits-charcoal)' }}>{title}</div>
      {children}
    </div>
  )
}

function StatusChip({ status }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.Outside
  return <span className="px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap" style={{ background: s.bg, color: s.color }}>{status}</span>
}

function InlineForm({ children, onSubmit, onCancel, submitLabel, busy, disabled, danger }) {
  return (
    <form className="rounded-lg border p-3 my-2" style={{ borderColor: '#e5e7eb', background: '#f9fafb' }}
      onSubmit={(e) => { e.preventDefault(); if (!disabled && !busy) onSubmit() }}>
      {children}
      <div className="flex justify-end gap-2 mt-2">
        <button type="button" onClick={onCancel} className="text-xs px-3 py-1 rounded border" style={{ borderColor: '#d1d5db', color: '#6b7280' }}>Cancel</button>
        <button type="submit" disabled={disabled || busy} className="text-xs px-3 py-1 rounded text-white"
          style={{ background: danger ? '#b91c1c' : 'var(--mits-red)', opacity: disabled || busy ? 0.5 : 1 }}>
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}

function Input({ label, value, onChange, placeholder, mono, type = 'text', disabled }) {
  return (
    <label className="text-xs" style={{ color: '#6b7280' }}>{label}
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
        className={`block w-full mt-1 text-xs px-2 py-1.5 rounded border ${mono ? 'font-mono' : ''}`}
        style={{ borderColor: '#d1d5db', background: disabled ? '#f3f4f6' : 'white', color: 'var(--mits-charcoal)' }} />
    </label>
  )
}

const Th = ({ children }) => <th className="font-medium py-1.5 pr-3">{children}</th>
const Td = ({ children, className = '', style }) => <td className={`py-1.5 pr-3 ${className}`} style={style}>{children}</td>
const LinkBtn = ({ children, onClick, disabled }) => (
  <button type="button" onClick={onClick} disabled={disabled} className="text-xs ml-2 hover:underline" style={{ color: '#2563eb' }}>{children}</button>
)
