import { useState, useEffect } from 'react'
import { isTauri } from '../data/db'
import {
  getTags, addTag, deleteTag,
  writeMetadataBackup, readMetadataBackup, importMetadata, reindexAll,
  getSetting, setSetting, getAuditLog, clearAuditLog, buildDocumentsCsv, migrateLocalToCloud,
} from '../data/repo'

export default function SettingsPanel({
  vaultPath, onVaultChange, sharePointUrl, onSharePointChange, onDataChanged,
  userEmail, onSignOut, libraryEmpty,
}) {
  const [path, setPath] = useState(vaultPath ?? '')
  const [saved, setSaved] = useState(false)
  const [tags, setTags] = useState([])
  const [newTag, setNewTag] = useState('')
  const [spUrl, setSpUrl] = useState(sharePointUrl ?? '')
  const [spSaved, setSpSaved] = useState(false)
  const [backupMsg, setBackupMsg] = useState('')
  const [indexMsg, setIndexMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [techName, setTechName] = useState('')
  const [techSaved, setTechSaved] = useState(false)
  const [audit, setAudit] = useState([])
  const [csvMsg, setCsvMsg] = useState('')
  const [migrateMsg, setMigrateMsg] = useState('')

  const handleMigrate = async () => {
    if (!confirm('Push this machine\'s local library (documents, metadata, playbooks, tags) up to the shared cloud? Safe to run more than once — existing cloud records are updated, not duplicated.')) return
    setMigrateMsg('Migrating…')
    try {
      const r = await migrateLocalToCloud()
      setMigrateMsg(`Migrated ${r.documents} documents, ${r.playbooks} playbooks, ${r.tags} tags.`)
      if (onDataChanged) onDataChanged()
    } catch (err) {
      setMigrateMsg(`Migration failed: ${err.message || err}`)
    } finally {
      setTimeout(() => setMigrateMsg(''), 8000)
    }
  }

  useEffect(() => {
    getTags().then(setTags)
    getSetting('technicianName', '').then((v) => setTechName(v ?? ''))
    getAuditLog(80).then(setAudit)
  }, [])

  const saveTechName = async () => {
    await setSetting('technicianName', techName.trim())
    setTechSaved(true)
    setTimeout(() => setTechSaved(false), 2000)
  }

  const exportCsv = async () => {
    setCsvMsg('')
    try {
      const csv = await buildDocumentsCsv()
      const fileName = 'MITS_DocCenter_Library.csv'
      if (isTauri()) {
        const { save } = await import('@tauri-apps/plugin-dialog')
        const path = await save({ defaultPath: fileName, filters: [{ name: 'CSV', extensions: ['csv'] }] })
        if (!path) return
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('write_text_file', { path, contents: csv })
        setCsvMsg('Exported.')
      } else {
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = fileName; a.click()
        URL.revokeObjectURL(url)
        setCsvMsg('Downloaded.')
      }
    } catch (err) {
      setCsvMsg(`Export failed: ${err}`)
    } finally {
      setTimeout(() => setCsvMsg(''), 4000)
    }
  }

  const handleClearAudit = async () => {
    if (!confirm('Clear the activity log? This cannot be undone.')) return
    await clearAuditLog()
    setAudit([])
  }

  useEffect(() => { setSpUrl(sharePointUrl ?? '') }, [sharePointUrl])

  const saveSharePoint = () => {
    onSharePointChange(spUrl.trim())
    setSpSaved(true)
    setTimeout(() => setSpSaved(false), 2000)
  }

  const handleBackup = async () => {
    if (!vaultPath) { setBackupMsg('Set a vault folder first.'); return }
    setBusy(true)
    try {
      const data = await writeMetadataBackup(vaultPath)
      setBackupMsg(`Backed up ${data.documents.length} documents and ${data.groups.length} groups.`)
    } catch (err) {
      setBackupMsg(`Backup failed: ${err}`)
    } finally {
      setBusy(false)
      setTimeout(() => setBackupMsg(''), 5000)
    }
  }

  const handleReindex = async () => {
    setBusy(true)
    setIndexMsg('Rebuilding search index…')
    try {
      const n = await reindexAll()
      setIndexMsg(`Search index rebuilt for ${n} document${n === 1 ? '' : 's'}.`)
    } catch (err) {
      setIndexMsg(`Reindex failed: ${err}`)
    } finally {
      setBusy(false)
      setTimeout(() => setIndexMsg(''), 5000)
    }
  }

  const handleRestore = async () => {
    if (!vaultPath) { setBackupMsg('Set a vault folder first.'); return }
    if (!confirm('Restore metadata from the vault backup? This overlays tags, notes, review dates, groups and favorites onto your existing documents (matched by file name). Files are not changed.')) return
    setBusy(true)
    try {
      const data = await readMetadataBackup(vaultPath)
      if (!data) { setBackupMsg('No backup found in the vault folder.'); return }
      const result = await importMetadata(data)
      setBackupMsg(`Restored: ${result.updated} documents, ${result.groups} groups, ${result.tags} tags.`)
      if (onDataChanged) onDataChanged()
      getTags().then(setTags)
    } catch (err) {
      setBackupMsg(`Restore failed: ${err}`)
    } finally {
      setBusy(false)
      setTimeout(() => setBackupMsg(''), 6000)
    }
  }

  const pickFolder = async () => {
    if (!isTauri()) {
      alert('Folder picker is only available in the desktop app.')
      return
    }
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({ directory: true, multiple: false, title: 'Select Vault Folder' })
    if (selected) {
      setPath(selected)
      setSaved(false)
    }
  }

  const save = () => {
    onVaultChange(path.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleAddTag = async () => {
    const t = newTag.trim()
    if (!t || tags.includes(t)) { setNewTag(''); return }
    await addTag(t)
    setTags((prev) => [...prev, t].sort())
    setNewTag('')
  }

  const handleDeleteTag = async (t) => {
    await deleteTag(t)
    setTags((prev) => prev.filter((x) => x !== t))
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-3 border-b" style={{ borderColor: '#e5e7eb', background: 'white' }}>
        <h1 className="font-semibold text-base" style={{ color: 'var(--mits-charcoal)' }}>Settings</h1>
      </div>

      <div className="p-6 max-w-xl space-y-8">

        {/* Account */}
        {userEmail && (
          <section>
            <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--mits-charcoal)' }}>Account</h2>
            <p className="text-xs mb-3" style={{ color: '#6b7280' }}>Signed in to the shared DocCenter backend.</p>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2" style={{ borderColor: '#e5e7eb', background: 'white' }}>
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0" style={{ background: 'var(--mits-charcoal, #3a3a3a)' }}>
                  {userEmail.slice(0, 1).toUpperCase()}
                </div>
                <span className="text-sm truncate" style={{ color: '#374151' }}>{userEmail}</span>
              </div>
              <button onClick={onSignOut} className="text-xs px-3 py-1.5 rounded border transition-colors hover:bg-gray-50 flex-shrink-0" style={{ borderColor: '#d1d5db', color: '#374151' }}>
                Sign out
              </button>
            </div>
            {libraryEmpty && (
              <div className="mt-3">
                <p className="text-xs mb-2" style={{ color: '#6b7280' }}>
                  First time setup: push this machine's existing local library up to the shared cloud.
                  <strong> Run this once</strong>, before the team starts editing. (Hidden once the cloud library has documents.)
                </p>
                <button onClick={handleMigrate} className="text-xs px-3 py-1.5 rounded border transition-colors hover:bg-gray-50" style={{ borderColor: '#d1d5db', color: '#374151' }}>
                  Migrate local library to cloud
                </button>
                {migrateMsg && (
                  <div className="text-xs mt-2" style={{ color: migrateMsg.includes('failed') ? '#dc2626' : '#166534' }}>{migrateMsg}</div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Technician */}
        <section>
          <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--mits-charcoal)' }}>Your Name</h2>
          <p className="text-xs mb-4" style={{ color: '#6b7280' }}>
            Used to attribute entries in the activity log. Helpful once a second tech is using DocCenter.
          </p>
          <div className="flex gap-2">
            <input
              value={techName}
              onChange={(e) => { setTechName(e.target.value); setTechSaved(false) }}
              placeholder="e.g. Michael Menozzi"
              style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 10px', fontSize: 13, outline: 'none' }}
              onFocus={(e) => { e.target.style.borderColor = '#e1251b' }}
              onBlur={(e) => { e.target.style.borderColor = '#d1d5db' }}
            />
            <button onClick={saveTechName} className="text-sm px-4 py-2 rounded text-white font-medium flex-shrink-0" style={{ background: techSaved ? '#16a34a' : 'var(--mits-red)' }}>
              {techSaved ? '✓ Saved' : 'Save'}
            </button>
          </div>
        </section>

        {/* Vault Configuration */}
        <section>
          <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--mits-charcoal)' }}>Vault Folder</h2>
          <p className="text-xs mb-4" style={{ color: '#6b7280' }}>
            Point DocCenter at your SharePoint-synced folder. The app scans for .docx and .pdf files
            and organizes them by subfolder name (e.g. a "Runbooks" subfolder → Runbooks category).
          </p>
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                value={path}
                onChange={(e) => { setPath(e.target.value); setSaved(false) }}
                placeholder="C:\Users\…\OneDrive - Menozzi IT Solutions\MITS Docs"
                style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 10px', fontSize: 13, fontFamily: 'monospace', outline: 'none' }}
                onFocus={(e) => { e.target.style.borderColor = '#e1251b' }}
                onBlur={(e) => { e.target.style.borderColor = '#d1d5db' }}
              />
              <button
                onClick={pickFolder}
                className="text-sm px-3 py-1.5 rounded border transition-colors hover:bg-gray-50"
                style={{ borderColor: '#d1d5db', color: '#374151', whiteSpace: 'nowrap' }}
              >
                Browse…
              </button>
            </div>
            <button
              onClick={save}
              className="text-sm px-4 py-2 rounded text-white font-medium"
              style={{ background: saved ? '#16a34a' : 'var(--mits-red)' }}
            >
              {saved ? '✓ Saved' : 'Save Path'}
            </button>
          </div>
        </section>

        {/* SharePoint link base */}
        <section>
          <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--mits-charcoal)' }}>SharePoint Link (optional)</h2>
          <p className="text-xs mb-4" style={{ color: '#6b7280' }}>
            Paste the web URL of your SharePoint document library root (the online address that maps to your
            synced vault folder). DocCenter uses it to build a "Copy SharePoint link" button so you can share
            documents with people who don't have the folder synced.
          </p>
          <div className="flex gap-2">
            <input
              value={spUrl}
              onChange={(e) => { setSpUrl(e.target.value); setSpSaved(false) }}
              placeholder="https://menozziit.sharepoint.com/sites/MITS/Shared Documents/MITS Docs"
              style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 10px', fontSize: 13, fontFamily: 'monospace', outline: 'none' }}
              onFocus={(e) => { e.target.style.borderColor = '#e1251b' }}
              onBlur={(e) => { e.target.style.borderColor = '#d1d5db' }}
            />
            <button
              onClick={saveSharePoint}
              className="text-sm px-4 py-2 rounded text-white font-medium flex-shrink-0"
              style={{ background: spSaved ? '#16a34a' : 'var(--mits-red)' }}
            >
              {spSaved ? '✓ Saved' : 'Save'}
            </button>
          </div>
        </section>

        {/* Metadata Backup */}
        <section>
          <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--mits-charcoal)' }}>Metadata Backup</h2>
          <p className="text-xs mb-4" style={{ color: '#6b7280' }}>
            Your document files live in SharePoint, but the details you add here (tags, descriptions, review dates,
            version notes, groups and favorites) are stored on this PC. Back them up to a
            <code className="px-1" style={{ background: '#f3f4f6', borderRadius: 3 }}>.docmanager</code>
            file inside your vault folder so SharePoint keeps a copy — and so another tech can restore the same
            organization on their machine after syncing the vault.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleBackup}
              disabled={busy}
              className="text-sm px-4 py-2 rounded text-white font-medium"
              style={{ background: 'var(--mits-red)', opacity: busy ? 0.6 : 1 }}
            >
              Back Up Now
            </button>
            <button
              onClick={handleRestore}
              disabled={busy}
              className="text-sm px-4 py-2 rounded border transition-colors hover:bg-gray-50"
              style={{ borderColor: '#d1d5db', color: '#374151', opacity: busy ? 0.6 : 1 }}
            >
              Restore from Backup
            </button>
          </div>
          {backupMsg && (
            <div className="text-xs mt-2" style={{ color: backupMsg.includes('failed') ? '#dc2626' : '#166534' }}>
              {backupMsg}
            </div>
          )}
        </section>

        {/* Search Index */}
        <section>
          <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--mits-charcoal)' }}>Full-Text Search Index</h2>
          <p className="text-xs mb-4" style={{ color: '#6b7280' }}>
            DocCenter reads the text inside your Word documents so search can find documents by their content,
            not just their title or tags. Indexing happens automatically when you sync or import. Rebuild it
            manually if you've edited documents outside the app and want the search to catch up.
          </p>
          <button
            onClick={handleReindex}
            disabled={busy}
            className="text-sm px-4 py-2 rounded border transition-colors hover:bg-gray-50"
            style={{ borderColor: '#d1d5db', color: '#374151', opacity: busy ? 0.6 : 1 }}
          >
            Rebuild Search Index
          </button>
          {indexMsg && (
            <div className="text-xs mt-2" style={{ color: indexMsg.includes('failed') ? '#dc2626' : '#166534' }}>
              {indexMsg}
            </div>
          )}
        </section>

        {/* Export */}
        <section>
          <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--mits-charcoal)' }}>Export Library</h2>
          <p className="text-xs mb-4" style={{ color: '#6b7280' }}>
            Export the full document inventory (Doc IDs, titles, types, domains, status, clients, review dates, tags, paths) to a
            CSV file — handy for reporting, audits, or sharing the library list outside the app.
          </p>
          <button onClick={exportCsv} className="text-sm px-4 py-2 rounded border transition-colors hover:bg-gray-50" style={{ borderColor: '#d1d5db', color: '#374151' }}>
            Export to CSV
          </button>
          {csvMsg && (
            <div className="text-xs mt-2" style={{ color: csvMsg.includes('failed') ? '#dc2626' : '#166534' }}>{csvMsg}</div>
          )}
        </section>

        {/* Activity Log */}
        <section>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--mits-charcoal)' }}>Activity Log</h2>
            {audit.length > 0 && (
              <button onClick={handleClearAudit} className="text-xs px-2 py-1 rounded border transition-colors hover:bg-red-50" style={{ borderColor: '#fca5a5', color: '#dc2626' }}>Clear</button>
            )}
          </div>
          <p className="text-xs mb-3" style={{ color: '#6b7280' }}>
            Recent changes on this machine — document edits, imports, vault syncs, playbook activity.
          </p>
          {audit.length === 0 ? (
            <div className="text-xs" style={{ color: '#9ca3af' }}>No activity recorded yet.</div>
          ) : (
            <div className="rounded-lg border divide-y max-h-72 overflow-y-auto" style={{ borderColor: '#e5e7eb', background: 'white' }}>
              {audit.map((e) => (
                <div key={e.id} className="flex items-start gap-2 px-3 py-1.5 text-xs" style={{ borderColor: '#f3f4f6' }}>
                  <span className="flex-shrink-0" style={{ color: '#9ca3af', minWidth: 116 }}>
                    {e.ts ? new Date(e.ts.includes('T') ? e.ts : e.ts.replace(' ', 'T') + 'Z').toLocaleString() : ''}
                  </span>
                  <span className="font-medium flex-shrink-0" style={{ color: '#e1251b', minWidth: 120 }}>{e.action}</span>
                  <span className="flex-1" style={{ color: '#374151' }}>{e.detail}</span>
                  {e.who && <span className="flex-shrink-0" style={{ color: '#9ca3af' }}>{e.who}</span>}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Tag Management */}
        <section>
          <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--mits-charcoal)' }}>Tag Library</h2>
          <p className="text-xs mb-4" style={{ color: '#6b7280' }}>
            Manage the master tag list. Tags added to any document automatically appear here.
            Deleting a tag removes it from the list but does <strong>not</strong> remove it from documents that already have it.
          </p>

          {/* Add new tag */}
          <div className="flex gap-2 mb-3">
            <input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag() } }}
              placeholder="New tag name…"
              style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: 13, outline: 'none' }}
              onFocus={(e) => { e.target.style.borderColor = '#e1251b' }}
              onBlur={(e) => { e.target.style.borderColor = '#d1d5db' }}
            />
            <button
              onClick={handleAddTag}
              className="text-sm px-3 py-1.5 rounded text-white"
              style={{ background: 'var(--mits-red)' }}
            >
              Add Tag
            </button>
          </div>

          {/* Tag list */}
          {tags.length === 0 ? (
            <div className="text-xs" style={{ color: '#9ca3af' }}>No tags yet. Tags appear here as you add them to documents.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <div
                  key={t}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border"
                  style={{ borderColor: '#e5e7eb', background: '#f9fafb', color: '#374151' }}
                >
                  <span>{t}</span>
                  <button
                    onClick={() => { if (confirm(`Remove tag "${t}" from the master list?`)) handleDeleteTag(t) }}
                    className="text-gray-400 hover:text-red-500 transition-colors leading-none"
                    title="Remove tag"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Folder structure guide */}
        <section>
          <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--mits-charcoal)' }}>Recommended Folder Structure</h2>
          <p className="text-xs mb-3" style={{ color: '#6b7280' }}>
            Organize your SharePoint folder like this so Sync Vault automatically assigns categories:
          </p>
          <div className="rounded-lg p-3 font-mono text-xs space-y-0.5" style={{ background: '#f3f4f6', color: '#374151' }}>
            {[
              'MITS Docs/',
              '  ├── Runbooks/',
              '  ├── SOPs/',
              '  ├── Checklists/',
              '  ├── Client Guides/',
              '  ├── Scripts Reference/',
              '  ├── Letters/',
              '  └── Other/',
            ].map((line) => <div key={line}>{line}</div>)}
          </div>
        </section>

        {/* About */}
        <section>
          <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--mits-charcoal)' }}>About</h2>
          <div className="text-xs space-y-1" style={{ color: '#6b7280' }}>
            <div>MITS DocCenter v0.1.0</div>
            <div style={{ color: '#9ca3af' }}>Document Command Center</div>
            <div>Menozzi IT Solutions</div>
          </div>
        </section>

      </div>
    </div>
  )
}
