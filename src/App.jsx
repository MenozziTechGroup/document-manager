import { useState, useEffect, useCallback } from 'react'
import { isTauri } from './data/db'
import {
  getDocuments, searchDocuments, createDocument, updateDocument, deleteDocument,
  getGroups, createGroup, updateGroup, deleteGroup, getSetting, setSetting,
  getDocumentGroupIds,
} from './data/repo'
import Sidebar from './components/Sidebar'
import DocumentList from './components/DocumentList'
import PreviewPane from './components/PreviewPane'
import DocumentModal from './components/DocumentModal'
import GroupModal from './components/GroupModal'
import GroupsView from './components/GroupsView'
import SettingsPanel from './components/SettingsPanel'
import Onboarding from './components/Onboarding'
import AddToGroupModal from './components/AddToGroupModal'

export default function App() {
  // ── Core data ──────────────────────────────────────────────
  const [docs, setDocs] = useState([])
  const [groups, setGroups] = useState([])
  const [vaultPath, setVaultPath] = useState(null) // null = not loaded yet

  // ── Navigation ─────────────────────────────────────────────
  const [view, setView] = useState('loading') // loading|onboarding|all|category|groups|settings
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [docGroups, setDocGroups] = useState([]) // groups the selected doc belongs to

  // ── Search ─────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null) // null = no active search

  // ── Modals ─────────────────────────────────────────────────
  const [docModal, setDocModal] = useState(null) // null | { doc: null|{} }
  const [groupModal, setGroupModal] = useState(null) // null | { group: null|{} }
  const [addToGroupDoc, setAddToGroupDoc] = useState(null) // doc to add to group

  // ── Operations ─────────────────────────────────────────────
  const [scanning, setScanning] = useState(false)
  const [scanMessage, setScanMessage] = useState('')

  // ── Load on mount ──────────────────────────────────────────
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const [allDocs, allGroups, savedVault] = await Promise.all([
        getDocuments(),
        getGroups(),
        getSetting('vaultPath', null),
      ])
      if (!mounted) return
      setDocs(allDocs)
      setGroups(allGroups)
      setVaultPath(savedVault ?? '')
      setView(savedVault || allDocs.length > 0 ? 'all' : 'onboarding')
    })()
    return () => { mounted = false }
  }, [])

  // ── Selected doc groups ────────────────────────────────────
  useEffect(() => {
    if (!selectedDoc) { setDocGroups([]); return }
    getDocumentGroupIds(selectedDoc.id).then((ids) => {
      setDocGroups(groups.filter((g) => ids.includes(g.id)))
    })
  }, [selectedDoc, groups])

  // ── Search ─────────────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults(null); return }
    const t = setTimeout(async () => {
      const results = await searchDocuments(searchQuery)
      setSearchResults(results)
    }, 200)
    return () => clearTimeout(t)
  }, [searchQuery])

  // ── Navigation helpers ─────────────────────────────────────
  const navigate = useCallback((id, category = null) => {
    setSearchQuery('')
    setSearchResults(null)
    setSelectedDoc(null)
    if (id === 'category') {
      setView('category')
      setSelectedCategory(category)
    } else {
      setView(id)
      setSelectedCategory(null)
    }
  }, [])

  // ── Vault scan ─────────────────────────────────────────────
  const scanVault = useCallback(async (path) => {
    const target = path ?? vaultPath
    if (!target) return
    if (!isTauri()) {
      setScanMessage('Vault scanning only works in the desktop app.')
      setTimeout(() => setScanMessage(''), 3000)
      return
    }

    setScanning(true)
    setScanMessage('')
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const files = await invoke('scan_vault', { path: target })

      let added = 0
      for (const f of files) {
        const title = f.name.replace(/\.(docx|pdf)$/i, '').replace(/[-_]/g, ' ')
        const doc = await createDocument({
          title,
          category: f.category,
          filePath: f.path,
          fileName: f.name,
          fileType: f.file_type,
          description: '',
          status: 'active',
          tags: [],
          version: '',
          clientName: '',
        })
        if (doc) added++
      }

      const allDocs = await getDocuments()
      setDocs(allDocs)
      setScanMessage(added > 0 ? `Added ${added} new document${added > 1 ? 's' : ''}.` : 'Vault is up to date.')
    } catch (err) {
      setScanMessage(`Scan failed: ${err}`)
    } finally {
      setScanning(false)
      setTimeout(() => setScanMessage(''), 4000)
    }
  }, [vaultPath])

  // ── Onboarding complete ────────────────────────────────────
  const handleOnboardingComplete = async (path) => {
    await setSetting('vaultPath', path)
    setVaultPath(path)
    setView('all')
    if (path) scanVault(path)
  }

  // ── Vault path change (from settings) ─────────────────────
  const handleVaultChange = async (path) => {
    await setSetting('vaultPath', path)
    setVaultPath(path)
  }

  // ── Document CRUD ──────────────────────────────────────────
  const handleSaveDoc = async (formData) => {
    let updated
    if (formData.id) {
      updated = await updateDocument(formData)
      setDocs((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
      if (selectedDoc?.id === updated.id) setSelectedDoc(updated)
    } else {
      updated = await createDocument(formData)
      setDocs((prev) => [...prev, updated])
    }
    setDocModal(null)
  }

  const handleDeleteDoc = async (id) => {
    await deleteDocument(id)
    setDocs((prev) => prev.filter((d) => d.id !== id))
    if (selectedDoc?.id === id) setSelectedDoc(null)
  }

  // ── Group CRUD ─────────────────────────────────────────────
  const handleSaveGroup = async (formData) => {
    let updated
    if (formData.id) {
      updated = await updateGroup(formData)
      setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)))
    } else {
      updated = await createGroup(formData)
      setGroups((prev) => [...prev, updated])
    }
    setGroupModal(null)
  }

  const handleDeleteGroup = async (id) => {
    await deleteGroup(id)
    setGroups((prev) => prev.filter((g) => g.id !== id))
  }

  // ── Derived list for the center pane ──────────────────────
  const displayDocs = (() => {
    if (searchResults !== null) return searchResults
    if (view === 'category') return docs.filter((d) => d.category === selectedCategory)
    return docs
  })()

  const listTitle = (() => {
    if (searchResults !== null) return 'Search Results'
    if (view === 'category') return selectedCategory ?? 'Documents'
    return 'All Documents'
  })()

  const listSubtitle = (() => {
    if (searchResults !== null) return `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''} for "${searchQuery}"`
    return `${displayDocs.length} document${displayDocs.length !== 1 ? 's' : ''}`
  })()

  // ── Loading ────────────────────────────────────────────────
  if (view === 'loading') {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: '#9ca3af' }}>
        <div className="text-sm">Loading…</div>
      </div>
    )
  }

  // ── Onboarding ─────────────────────────────────────────────
  if (view === 'onboarding') {
    return <Onboarding onComplete={handleOnboardingComplete} />
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        view={view}
        selectedCategory={selectedCategory}
        docs={docs}
        groups={groups}
        onNavigate={navigate}
        onSettings={() => navigate('settings')}
      />

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b" style={{ borderColor: '#e5e7eb', background: 'white' }}>
          <div className="flex items-center gap-2 flex-1 rounded-lg px-3 py-1.5 text-sm" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#9ca3af" strokeWidth="1.5">
              <circle cx="6" cy="6" r="4"/><path d="M9.5 9.5l3 3"/>
            </svg>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents, tags, descriptions…"
              style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: 13, color: '#374151' }}
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setSearchResults(null) }} style={{ color: '#9ca3af', lineHeight: 1 }}>×</button>
            )}
          </div>
          {scanMessage && (
            <div className="text-xs px-3 py-1 rounded-full" style={{ background: '#f0fdf4', color: '#166534' }}>
              {scanMessage}
            </div>
          )}
        </div>

        {/* Content panels */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {view === 'settings' ? (
            <div className="flex-1 overflow-hidden" style={{ background: 'var(--app-bg)' }}>
              <SettingsPanel vaultPath={vaultPath} onVaultChange={handleVaultChange} />
            </div>
          ) : view === 'groups' ? (
            <>
              <div className="flex-1 overflow-hidden" style={{ background: 'var(--app-bg)' }}>
                <GroupsView
                  groups={groups}
                  docs={docs}
                  selectedDocId={selectedDoc?.id}
                  onSelectDoc={setSelectedDoc}
                  onNewGroup={() => setGroupModal({ group: null })}
                  onEditGroup={(g) => setGroupModal({ group: g })}
                  onDeleteGroup={handleDeleteGroup}
                />
              </div>
              <div className="border-l overflow-hidden flex-shrink-0" style={{ width: 'var(--panel-width)', borderColor: '#e5e7eb', background: 'white' }}>
                <PreviewPane
                  doc={selectedDoc}
                  groups={docGroups}
                  onEdit={(d) => setDocModal({ doc: d })}
                  onDelete={handleDeleteDoc}
                  onAddToGroup={(d) => setAddToGroupDoc(d)}
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex-1 overflow-hidden" style={{ background: 'var(--app-bg)' }}>
                <DocumentList
                  docs={displayDocs}
                  title={listTitle}
                  subtitle={listSubtitle}
                  selectedDocId={selectedDoc?.id}
                  onSelectDoc={setSelectedDoc}
                  onAddDoc={() => setDocModal({ doc: null })}
                  onScanVault={() => scanVault()}
                  scanning={scanning}
                  vaultPath={vaultPath}
                />
              </div>
              <div className="border-l overflow-hidden flex-shrink-0" style={{ width: 'var(--panel-width)', borderColor: '#e5e7eb', background: 'white' }}>
                <PreviewPane
                  doc={selectedDoc}
                  groups={docGroups}
                  onEdit={(d) => setDocModal({ doc: d })}
                  onDelete={handleDeleteDoc}
                  onAddToGroup={(d) => setAddToGroupDoc(d)}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      {docModal && (
        <DocumentModal
          doc={docModal.doc}
          onSave={handleSaveDoc}
          onClose={() => setDocModal(null)}
        />
      )}
      {groupModal && (
        <GroupModal
          group={groupModal.group}
          onSave={handleSaveGroup}
          onClose={() => setGroupModal(null)}
        />
      )}
      {addToGroupDoc && (
        <AddToGroupModal
          doc={addToGroupDoc}
          groups={groups}
          onClose={() => setAddToGroupDoc(null)}
          onDone={() => {
            setAddToGroupDoc(null)
            if (selectedDoc?.id === addToGroupDoc.id) {
              getDocumentGroupIds(addToGroupDoc.id).then((ids) => {
                setDocGroups(groups.filter((g) => ids.includes(g.id)))
              })
            }
          }}
        />
      )}
    </div>
  )
}
