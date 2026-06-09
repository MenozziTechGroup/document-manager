import { useState, useEffect, useCallback, useRef } from 'react'
import { isTauri } from './data/db'
import {
  getDocuments, searchDocuments, createDocument, updateDocument, deleteDocument,
  syncScannedDocuments,
  getGroups, createGroup, updateGroup, deleteGroup, getSetting, setSetting,
  getDocumentGroupIds, addToGroup, setFavorite, markOpened, findMissingDocIds, writeMetadataBackup,
  importFileToVault, convertToPdf, indexMissing,
  getRuns, getRun, startRun, toggleRunItem, setRunStatus, deleteRun,
  logEvent,
} from './data/repo'
import { reviewStatus, DOMAIN_MAP } from './data/categories'
import { isCloudConfigured, getSession, onAuthChange, signOut, currentUserEmail } from './data/supabase'
import { setVaultRoot, subscribeChanges } from './data/cloud'
import { checkForUpdate, installUpdate } from './data/updater'
import Login from './components/Login'
import Sidebar from './components/Sidebar'
import DocumentList from './components/DocumentList'
import PreviewPane from './components/PreviewPane'
import DocumentModal from './components/DocumentModal'
import GroupModal from './components/GroupModal'
import PlaybooksView from './components/PlaybooksView'
import PlaybookRunView from './components/PlaybookRunView'
import StartRunModal from './components/StartRunModal'
import SettingsPanel from './components/SettingsPanel'
import HelpView from './components/HelpView'
import Onboarding from './components/Onboarding'
import AddToGroupModal from './components/AddToGroupModal'
import SupersedeModal from './components/SupersedeModal'
import PdfPreviewModal from './components/PdfPreviewModal'
import Dashboard from './components/Dashboard'

export default function App() {
  // ── Core data ──────────────────────────────────────────────
  // ── Auth (shared backend) ──────────────────────────────────
  const cloudOn = isCloudConfigured()
  const [session, setSession] = useState(cloudOn ? undefined : null) // undefined=checking, null=signed out

  const [docs, setDocs] = useState([])
  const [groups, setGroups] = useState([])
  const [vaultPath, setVaultPath] = useState(null) // null = not loaded yet
  const [sharePointUrl, setSharePointUrl] = useState('')
  const [missingIds, setMissingIds] = useState(new Set())

  // ── Navigation ─────────────────────────────────────────────
  const [view, setView] = useState('loading') // loading|onboarding|dashboard|all|category|client|domain|groups|run|settings
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedClient, setSelectedClient] = useState(null)
  const [selectedDomain, setSelectedDomain] = useState(null)
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [docGroups, setDocGroups] = useState([]) // groups the selected doc belongs to

  // ── Search ─────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null) // null = no active search

  // ── Playbook runs ──────────────────────────────────────────
  const [runs, setRuns] = useState([])
  const [selectedRun, setSelectedRun] = useState(null) // { run, items }
  const [startRunFor, setStartRunFor] = useState(null) // playbook to start a run for

  // ── Modals ─────────────────────────────────────────────────
  const [docModal, setDocModal] = useState(null) // null | { doc: null|{} }
  const [groupModal, setGroupModal] = useState(null) // null | { group: null|{} }
  const [addToGroupDoc, setAddToGroupDoc] = useState(null) // doc to add to group
  const [supersedeFor, setSupersedeFor] = useState(null) // new doc that supersedes an older one
  const [pdfPreviewDoc, setPdfPreviewDoc] = useState(null) // doc whose PDF is previewed inline

  // ── Operations ─────────────────────────────────────────────
  const [scanning, setScanning] = useState(false)
  const [scanMessage, setScanMessage] = useState('')
  const [newDocIds, setNewDocIds] = useState([]) // IDs of docs added in last scan that need metadata
  const [dragging, setDragging] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [loadReloadKey, setLoadReloadKey] = useState(0)
  const [update, setUpdate] = useState(null)
  const [updateState, setUpdateState] = useState('idle') // idle | installing
  const searchInputRef = useRef(null)
  const docsRef = useRef([])
  const selectedRunRef = useRef(null)

  // ── Load on mount / after sign-in ──────────────────────────
  // Wait for auth when the cloud is on, and set the vault root BEFORE loading
  // (the cloud layer needs it to resolve vault-relative paths to absolute).
  const userId = session?.user?.id ?? null
  useEffect(() => {
    if (cloudOn && !userId) return
    let mounted = true
    ;(async () => {
      const [savedVault, savedSp] = await Promise.all([
        getSetting('vaultPath', null),
        getSetting('sharePointUrl', ''),
      ])
      if (!mounted) return
      setVaultPath(savedVault ?? '')
      setVaultRoot(savedVault ?? '')
      setSharePointUrl(savedSp ?? '')

      try {
        const [allDocs, allGroups, allRuns] = await Promise.all([
          getDocuments(),
          getGroups(),
          getRuns(),
        ])
        if (!mounted) return
        setLoadError(null)
        setDocs(allDocs)
        setGroups(allGroups)
        setRuns(allRuns)
        setView(savedVault || allDocs.length > 0 ? 'dashboard' : 'onboarding')
        findMissingDocIds(allDocs).then((ids) => { if (mounted) setMissingIds(ids) })
        maybeNotifyReviews(allDocs)
        indexMissing().catch(() => {})
      } catch (err) {
        if (mounted) setLoadError(err?.message || 'Could not reach the shared library.')
      }
    })()
    return () => { mounted = false }
  }, [userId, loadReloadKey])

  // ── Review reminder notification (once per day) ────────────
  const maybeNotifyReviews = async (allDocs) => {
    if (!isTauri()) return
    const due = allDocs.filter((d) => {
      const rs = reviewStatus(d.reviewBy)
      return rs && rs.urgent
    })
    if (due.length === 0) return
    const today = new Date().toISOString().slice(0, 10)
    const last = await getSetting('lastReviewNotified', '')
    if (last === today) return
    try {
      const notif = await import('@tauri-apps/plugin-notification')
      let granted = await notif.isPermissionGranted()
      if (!granted) granted = (await notif.requestPermission()) === 'granted'
      if (granted) {
        notif.sendNotification({
          title: 'DocCenter — documents need review',
          body: `${due.length} document${due.length > 1 ? 's are' : ' is'} due for review or updating.`,
        })
        await setSetting('lastReviewNotified', today)
      }
    } catch { /* notifications are best-effort */ }
  }

  // Keep the docs ref current and re-check reviews periodically (so a long-running
  // tray instance still surfaces a daily reminder, not only at launch).
  useEffect(() => { docsRef.current = docs }, [docs])
  useEffect(() => { selectedRunRef.current = selectedRun }, [selectedRun])
  useEffect(() => {
    const id = setInterval(() => maybeNotifyReviews(docsRef.current), 6 * 60 * 60 * 1000)
    return () => clearInterval(id)
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

  // ── Auth session ───────────────────────────────────────────
  useEffect(() => {
    if (!cloudOn) return
    getSession().then(setSession)
    return onAuthChange(setSession)
  }, [])

  // ── Realtime: refresh shared data when a teammate changes something ──
  useEffect(() => {
    if (!cloudOn || !userId) return
    let t
    const unsub = subscribeChanges(() => {
      clearTimeout(t)
      t = setTimeout(async () => {
        const [allDocs, allGroups, allRuns] = await Promise.all([getDocuments(), getGroups(), getRuns()])
        setDocs(allDocs); setGroups(allGroups); setRuns(allRuns)
        const openRun = selectedRunRef.current
        if (openRun) {
          const fresh = await getRun(openRun.run.id).catch(() => null)
          if (fresh) setSelectedRun(fresh)
        }
      }, 400)
    })
    return () => { clearTimeout(t); unsub() }
  }, [userId])

  // ── Check for app updates once on launch (desktop only) ────
  useEffect(() => {
    if (!isTauri()) return
    let cancelled = false
    ;(async () => {
      const u = await checkForUpdate()
      if (!cancelled && u) setUpdate(u)
    })()
    return () => { cancelled = true }
  }, [])

  const applyUpdate = async () => {
    if (!update) return
    setUpdateState('installing')
    try {
      await installUpdate(update) // app relaunches on success
    } catch {
      setUpdateState('idle')
      alert('Update failed to install. You can try again later or reinstall from the latest release.')
    }
  }

  // ── Keyboard shortcut: Ctrl/Cmd+K focuses search ───────────
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Drag-and-drop import ───────────────────────────────────
  useEffect(() => {
    if (!isTauri()) return
    let unlisten = null
    ;(async () => {
      const { getCurrentWebview } = await import('@tauri-apps/api/webview')
      unlisten = await getCurrentWebview().onDragDropEvent((event) => {
        const p = event.payload
        if (p.type === 'enter' || p.type === 'over') {
          setDragging(true)
        } else if (p.type === 'leave') {
          setDragging(false)
        } else if (p.type === 'drop') {
          setDragging(false)
          const dropped = (p.paths || []).filter((x) => /\.(docx|pdf)$/i.test(x))
          if (dropped.length > 0) {
            setDocModal({ doc: { filePath: dropped[0] } })
          }
        }
      })
    })()
    return () => { if (unlisten) unlisten() }
  }, [])

  // ── Navigation helpers ─────────────────────────────────────
  const navigate = useCallback((id, param = null) => {
    setSearchQuery('')
    setSearchResults(null)
    setSelectedDoc(null)
    if (id === 'new-docs') {
      setView('new-docs')
      setSelectedCategory(null)
      setSelectedClient(null)
      setSelectedDomain(null)
    } else if (id === 'category') {
      setView('category')
      setSelectedCategory(param)
      setSelectedClient(null)
      setSelectedDomain(null)
    } else if (id === 'client') {
      setView('client')
      setSelectedClient(param)
      setSelectedCategory(null)
      setSelectedDomain(null)
    } else if (id === 'domain') {
      setView('domain')
      setSelectedDomain(param)
      setSelectedCategory(null)
      setSelectedClient(null)
    } else {
      setView(id)
      setSelectedCategory(null)
      setSelectedClient(null)
      setSelectedDomain(null)
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

      // Pair .docx and .pdf files that share the same base name + category.
      // Script files (.ps1 etc.) are single-file documents and handled separately.
      const pairMap = {}
      const scriptFiles = []
      for (const f of files) {
        if (f.file_type === 'docx' || f.file_type === 'pdf') {
          const baseName = f.name.replace(/\.(docx|pdf)$/i, '')
          const key = `${f.category}::${baseName}`
          if (!pairMap[key]) pairMap[key] = { baseName, category: f.category, docx: null, pdf: null }
          if (f.file_type === 'docx') pairMap[key].docx = f
          else pairMap[key].pdf = f
        } else {
          scriptFiles.push(f)
        }
      }

      const items = []
      for (const pair of Object.values(pairMap)) {
        const primary = pair.docx ?? pair.pdf
        items.push({
          title: pair.baseName.replace(/[-_]/g, ' '),
          category: pair.category,
          filePath: pair.docx?.path ?? pair.pdf?.path ?? '',
          fileName: primary.name,
          fileType: pair.docx ? 'docx' : 'pdf',
          docxPath: pair.docx?.path ?? '',
          pdfPath: pair.pdf?.path ?? '',
          description: '', status: 'active', tags: [], version: '', clientName: '',
        })
      }
      for (const s of scriptFiles) {
        items.push({
          title: s.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
          category: s.category,
          filePath: s.path,
          fileName: s.name,
          fileType: s.file_type,
          docxPath: '', pdfPath: '',
          description: '', status: 'active', tags: [], version: '', clientName: '',
        })
      }

      // Reconcile: insert new, relink moved/renamed files, refresh existing
      const { added, relinked, addedIds } = await syncScannedDocuments(items)

      const allDocs = await getDocuments()
      setDocs(allDocs)
      const parts = []
      if (added > 0) parts.push(`${added} new`)
      if (relinked > 0) parts.push(`${relinked} relinked`)
      setScanMessage(parts.length ? `Synced: ${parts.join(', ')}.` : 'Vault is up to date.')
      if (addedIds && addedIds.length > 0) setNewDocIds(addedIds)
      if (parts.length) logEvent('Vault synced', parts.join(', '))

      // Refresh missing-file detection and auto-back up metadata (best effort)
      findMissingDocIds(allDocs).then(setMissingIds)
      writeMetadataBackup(target).catch(() => { /* backup is best-effort */ })
      // Build the full-text index for any newly added documents (background)
      indexMissing().catch(() => {})
    } catch (err) {
      setScanMessage(`Scan failed: ${err}`)
    } finally {
      setScanning(false)
      setTimeout(() => setScanMessage(''), 4000)
    }
  }, [vaultPath])

  // ── Reload everything from the data layer (after a restore) ─
  const reloadData = useCallback(async () => {
    const [allDocs, allGroups] = await Promise.all([getDocuments(), getGroups()])
    setDocs(allDocs)
    setGroups(allGroups)
    findMissingDocIds(allDocs).then(setMissingIds)
  }, [])

  // ── Favorite toggle ────────────────────────────────────────
  const handleToggleFavorite = useCallback(async (doc) => {
    const next = !doc.favorite
    await setFavorite(doc.id, next)
    setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, favorite: next } : d)))
    setSelectedDoc((cur) => (cur && cur.id === doc.id ? { ...cur, favorite: next } : cur))
  }, [])

  // ── Record a document open (for Recently Opened) ───────────
  const handleOpened = useCallback(async (id) => {
    const now = await markOpened(id)
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, lastOpened: now } : d)))
  }, [])

  // ── SharePoint URL change ──────────────────────────────────
  const handleSharePointChange = useCallback(async (url) => {
    await setSetting('sharePointUrl', url)
    setSharePointUrl(url)
  }, [])

  // ── Generate a PDF for a Word-only document ────────────────
  const handleGeneratePdf = useCallback(async (doc) => {
    if (!doc.docxPath) return
    setScanMessage('Creating PDF copy…')
    try {
      const pdf = await convertToPdf(doc.docxPath)
      const updatedDoc = { ...doc, pdfPath: pdf }
      await updateDocument(updatedDoc)
      setDocs((prev) => prev.map((d) => (d.id === doc.id ? updatedDoc : d)))
      setSelectedDoc((cur) => (cur && cur.id === doc.id ? updatedDoc : cur))
      setScanMessage('PDF created.')
    } catch (err) {
      setScanMessage('')
      alert(`Could not create PDF:\n${err}`)
    } finally {
      setTimeout(() => setScanMessage(''), 3000)
    }
  }, [])

  // ── Onboarding complete ────────────────────────────────────
  const handleOnboardingComplete = async (path) => {
    await setSetting('vaultPath', path)
    setVaultPath(path)
    setVaultRoot(path)
    setView('all')
    if (path) scanVault(path)
  }

  // ── Vault path change (from settings) ─────────────────────
  const handleVaultChange = async (path) => {
    await setSetting('vaultPath', path)
    setVaultPath(path)
    setVaultRoot(path)
  }

  // ── Document CRUD ──────────────────────────────────────────
  const handleSaveDoc = async (formData) => {
    const { _importToVault, _generatePdf, ...data } = formData
    let updated
    if (data.id) {
      updated = await updateDocument(data)
      setDocs((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
      if (selectedDoc?.id === updated.id) setSelectedDoc(updated)
      logEvent('Document updated', updated.title)
    } else {
      // Smart import: copy the file into the vault and optionally make a PDF
      if (_importToVault) {
        try {
          setScanMessage('Importing into vault…')
          const newPath = await importFileToVault(data.filePath, vaultPath, data.category, data.fileName)
          data.filePath = newPath
          const ext = (data.fileName.split('.').pop() || '').toLowerCase()
          if (ext === 'docx') {
            data.docxPath = newPath
            data.fileType = 'docx'
            if (_generatePdf) {
              try {
                setScanMessage('Creating PDF copy…')
                data.pdfPath = await convertToPdf(newPath)
              } catch (err) {
                alert(`The document was imported, but the PDF could not be created:\n${err}\n\nYou can still open and use the Word file; add a PDF later if needed.`)
              }
            }
          } else if (ext === 'pdf') {
            data.pdfPath = newPath
            data.fileType = 'pdf'
          } else {
            // Script or other single file — no docx/pdf pairing
            data.fileType = ext
          }
        } catch (err) {
          setScanMessage('')
          alert(`Import failed:\n${err}`)
          return // keep the modal open so nothing is lost
        }
      }
      updated = await createDocument(data)
      setDocs((prev) => [...prev, updated])
      logEvent(_importToVault ? 'Document imported' : 'Document added', updated.title)
      // Index the new document's content for full-text search (background)
      indexMissing().catch(() => {})
      if (_importToVault && vaultPath) {
        setScanMessage('Imported.')
        setTimeout(() => setScanMessage(''), 3000)
        writeMetadataBackup(vaultPath).catch(() => {})
      }
    }
    setDocModal(null)
  }

  const handleDeleteDoc = async (id) => {
    const doc = docs.find((d) => d.id === id)
    await deleteDocument(id)
    setDocs((prev) => prev.filter((d) => d.id !== id))
    if (selectedDoc?.id === id) setSelectedDoc(null)
    logEvent('Document removed', doc?.title ?? id)
  }

  // ── Bulk operations ────────────────────────────────────────
  const handleBulkUpdate = async (ids, changes) => {
    const idSet = new Set(ids)
    const updatedById = {}
    for (const doc of docs) {
      if (!idSet.has(doc.id)) continue
      const next = { ...doc }
      if (changes.status) next.status = changes.status
      if (changes.category) next.category = changes.category
      if (changes.reviewBy) next.reviewBy = changes.reviewBy
      if (changes.addTag && !next.tags.includes(changes.addTag)) next.tags = [...next.tags, changes.addTag]
      await updateDocument(next)
      updatedById[doc.id] = next
    }
    setDocs((prev) => prev.map((d) => updatedById[d.id] ?? d))
    setSelectedDoc((cur) => (cur && updatedById[cur.id] ? updatedById[cur.id] : cur))
    const what = changes.addTag ? `tag "${changes.addTag}"` : changes.status ? `status ${changes.status}` : changes.category ? `category ${changes.category}` : changes.reviewBy ? `review date ${changes.reviewBy}` : 'metadata'
    logEvent('Bulk update', `${ids.length} documents — ${what}`)
  }

  const handleBulkDelete = async (ids) => {
    for (const id of ids) await deleteDocument(id)
    const idSet = new Set(ids)
    setDocs((prev) => prev.filter((d) => !idSet.has(d.id)))
    setSelectedDoc((cur) => (cur && idSet.has(cur.id) ? null : cur))
    logEvent('Bulk remove', `${ids.length} documents`)
  }

  const handleSupersede = async (oldDoc) => {
    const newDoc = supersedeFor
    if (!newDoc || !oldDoc) return
    const ref = newDoc.docId || newDoc.title
    const note = `Superseded by ${ref}${oldDoc.versionNotes ? `\n\n${oldDoc.versionNotes}` : ''}`
    const updated = { ...oldDoc, status: 'archived', versionNotes: note }
    await updateDocument(updated)
    setDocs((prev) => prev.map((d) => (d.id === oldDoc.id ? updated : d)))
    setSelectedDoc((cur) => (cur && cur.id === oldDoc.id ? updated : cur))
    setSupersedeFor(null)
    logEvent('Document superseded', `${oldDoc.title} archived (replaced by ${newDoc.title})`)
    setScanMessage(`Archived "${oldDoc.title}" as superseded.`)
    setTimeout(() => setScanMessage(''), 3000)
  }

  const handleBulkAddToPlaybook = async (ids, groupId) => {
    for (const id of ids) await addToGroup(groupId, id, { phase: 'Execute', required: 'Required' })
    const pb = groups.find((g) => g.id === groupId)
    setScanMessage(`Added ${ids.length} document${ids.length > 1 ? 's' : ''} to ${pb?.name ?? 'playbook'}.`)
    setTimeout(() => setScanMessage(''), 3000)
    logEvent('Bulk add to playbook', `${ids.length} documents → ${pb?.name ?? 'playbook'}`)
  }

  // ── Group CRUD ─────────────────────────────────────────────
  const handleSaveGroup = async (formData) => {
    let updated
    if (formData.id) {
      updated = await updateGroup(formData)
      setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)))
      logEvent('Playbook updated', updated.name)
    } else {
      updated = await createGroup(formData)
      setGroups((prev) => [...prev, updated])
      logEvent('Playbook created', updated.name)
    }
    setGroupModal(null)
  }

  const handleDeleteGroup = async (id) => {
    await deleteGroup(id)
    setGroups((prev) => prev.filter((g) => g.id !== id))
    setRuns((prev) => prev.filter((r) => r.groupId !== id))
  }

  // ── Playbook runs ──────────────────────────────────────────
  const refreshRuns = useCallback(async () => {
    setRuns(await getRuns())
  }, [])

  const openRun = useCallback(async (runId) => {
    const detail = await getRun(runId)
    if (detail) { setSelectedRun(detail); setView('run') }
  }, [])

  const handleStartRun = async (meta) => {
    if (!startRunFor) return
    const runId = await startRun(startRunFor.id, meta)
    logEvent('Playbook run started', `${startRunFor.name}${meta.clientName ? ` · ${meta.clientName}` : ''}`)
    setStartRunFor(null)
    await refreshRuns()
    await openRun(runId)
  }

  const handleToggleRunItem = async (itemId, done) => {
    await toggleRunItem(itemId, done)
    setSelectedRun((cur) => cur ? { ...cur, items: cur.items.map((i) => (i.id === itemId ? { ...i, done } : i)) } : cur)
    refreshRuns()
  }

  const handleSetRunStatus = async (runId, status) => {
    await setRunStatus(runId, status)
    setSelectedRun((cur) => cur && cur.run.id === runId ? { ...cur, run: { ...cur.run, status } } : cur)
    if (status === 'complete') {
      const pb = groups.find((g) => g.id === selectedRun?.run?.groupId)
      logEvent('Playbook run completed', `${pb?.name ?? 'Playbook'}${selectedRun?.run?.clientName ? ` · ${selectedRun.run.clientName}` : ''}`)
    }
    refreshRuns()
  }

  const handleDeleteRun = async (runId) => {
    await deleteRun(runId)
    if (selectedRun?.run?.id === runId) { setSelectedRun(null); setView('groups') }
    refreshRuns()
  }

  // Open a document's file (PDF if present, else Word/script) and record it
  const openDocFile = useCallback(async (doc) => {
    if (!isTauri()) { alert('Opening files is only available in the desktop app.'); return }
    const target = doc.pdfPath || doc.docxPath || doc.filePath
    if (!target) return
    try {
      const { openPath } = await import('@tauri-apps/plugin-opener')
      await openPath(target)
      handleOpened(doc.id)
    } catch (err) {
      alert(`Could not open file:\n${err}`)
    }
  }, [])

  // ── Derived list for the center pane ──────────────────────
  const newDocIdSet = new Set(newDocIds)
  const displayDocs = (() => {
    if (searchResults !== null) return searchResults
    if (view === 'new-docs') return docs.filter((d) => newDocIdSet.has(d.id))
    if (view === 'category') return docs.filter((d) => d.category === selectedCategory)
    if (view === 'client') return docs.filter((d) => d.clientName === selectedClient)
    if (view === 'domain') return docs.filter((d) => d.domain === selectedDomain)
    return docs
  })()

  const listTitle = (() => {
    if (searchResults !== null) return 'Search Results'
    if (view === 'new-docs') return 'New Documents'
    if (view === 'category') return selectedCategory ?? 'Documents'
    if (view === 'client') return selectedClient ?? 'Client Documents'
    if (view === 'domain') return (DOMAIN_MAP[selectedDomain]?.label ?? selectedDomain) || 'Domain'
    return 'All Documents'
  })()

  const listSubtitle = (() => {
    if (searchResults !== null) return `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''} for "${searchQuery}"`
    if (view === 'new-docs') return `${displayDocs.length} document${displayDocs.length !== 1 ? 's' : ''} added from last scan — click each to fill in details`
    if (view === 'client') return `${displayDocs.length} document${displayDocs.length !== 1 ? 's' : ''} for ${selectedClient}`
    if (view === 'domain') return `${displayDocs.length} document${displayDocs.length !== 1 ? 's' : ''} in this domain`
    return `${displayDocs.length} document${displayDocs.length !== 1 ? 's' : ''}`
  })()

  // ── Auth gate (shared backend) ─────────────────────────────
  if (cloudOn && session === undefined) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: '#9ca3af' }}>
        <div className="text-sm">Connecting…</div>
      </div>
    )
  }
  if (cloudOn && session === null) {
    return <Login />
  }
  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6" style={{ background: 'var(--app-bg)', color: '#6b7280' }}>
        <div className="text-sm font-medium mb-1" style={{ color: 'var(--mits-charcoal)' }}>Couldn't reach the shared library</div>
        <div className="text-xs mb-4 max-w-sm">{loadError} — check your connection and try again.</div>
        <div className="flex gap-2">
          <button onClick={() => { setLoadError(null); setLoadReloadKey((k) => k + 1) }} className="text-sm px-4 py-2 rounded text-white font-medium" style={{ background: 'var(--mits-red)' }}>Retry</button>
          <button onClick={() => signOut()} className="text-sm px-4 py-2 rounded border" style={{ borderColor: '#d1d5db', color: '#374151' }}>Sign out</button>
        </div>
      </div>
    )
  }

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
      {/* Drag-and-drop import overlay */}
      {dragging && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          style={{ background: 'rgba(225,37,27,0.10)', backdropFilter: 'blur(2px)' }}
        >
          <div
            className="flex flex-col items-center gap-3 px-10 py-8 rounded-2xl"
            style={{ background: 'white', border: '2px dashed var(--mits-red)', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}
          >
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="var(--mits-red)" strokeWidth="2">
              <path d="M20 27V8M12 16l8-8 8 8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M6 26v6a2 2 0 002 2h24a2 2 0 002-2v-6" strokeLinecap="round"/>
            </svg>
            <div className="font-semibold text-base" style={{ color: 'var(--mits-charcoal)' }}>Drop to import</div>
            <div className="text-xs" style={{ color: '#6b7280' }}>Release a .docx or .pdf to add it to the library</div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <Sidebar
        view={view}
        selectedCategory={selectedCategory}
        selectedClient={selectedClient}
        selectedDomain={selectedDomain}
        docs={docs}
        groups={groups}
        onNavigate={navigate}
        onSettings={() => navigate('settings')}
      />

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Update banner */}
        {update && (
          <div className="flex items-center gap-3 px-4 py-2 flex-wrap" style={{ background: 'var(--mits-charcoal, #3a3a3a)' }}>
            <span className="text-xs font-semibold text-white">⬆ Update available — v{update.version}</span>
            {update.body && <span className="text-xs truncate max-w-md" style={{ color: '#d1d5db' }}>{update.body}</span>}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={applyUpdate}
                disabled={updateState === 'installing'}
                className="text-white text-xs font-semibold px-3 py-1 rounded transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: 'var(--mits-red)' }}
              >
                {updateState === 'installing' ? 'Installing…' : 'Install & Restart'}
              </button>
              <button onClick={() => setUpdate(null)} className="text-xs" style={{ color: '#9ca3af' }}>Later</button>
            </div>
          </div>
        )}

        {/* New documents banner */}
        {newDocIds.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 flex-wrap" style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
            <span style={{ fontSize: 13, color: '#92400e' }}>
              ✦ <strong>{newDocIds.length} new document{newDocIds.length !== 1 ? 's' : ''}</strong> added from last scan — fill in their details
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => navigate('new-docs')}
                className="text-xs font-semibold px-3 py-1 rounded"
                style={{ background: '#d97706', color: 'white' }}
              >
                Review Now
              </button>
              <button
                onClick={() => setNewDocIds([])}
                className="text-xs"
                style={{ color: '#92400e' }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b" style={{ borderColor: '#e5e7eb', background: 'white' }}>
          <div className="flex items-center gap-2 flex-1 rounded-lg px-3 py-1.5 text-sm" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#9ca3af" strokeWidth="1.5">
              <circle cx="6" cy="6" r="4"/><path d="M9.5 9.5l3 3"/>
            </svg>
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setSearchQuery(''); setSearchResults(null); e.currentTarget.blur() } }}
              placeholder="Search documents, tags, content, Doc IDs…"
              style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: 13, color: '#374151' }}
            />
            {searchQuery ? (
              <button onClick={() => { setSearchQuery(''); setSearchResults(null) }} style={{ color: '#9ca3af', lineHeight: 1 }}>×</button>
            ) : (
              <kbd style={{ fontSize: 10, color: '#9ca3af', border: '1px solid #e5e7eb', borderRadius: 4, padding: '1px 5px', background: 'white' }}>Ctrl K</kbd>
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
          {view === 'settings' && searchResults === null ? (
            <div className="flex-1 overflow-hidden" style={{ background: 'var(--app-bg)' }}>
              <SettingsPanel
                vaultPath={vaultPath}
                onVaultChange={handleVaultChange}
                sharePointUrl={sharePointUrl}
                onSharePointChange={handleSharePointChange}
                onDataChanged={reloadData}
                userEmail={currentUserEmail(session)}
                onSignOut={() => signOut()}
                libraryEmpty={docs.length === 0}
              />
            </div>
          ) : view === 'dashboard' && searchResults === null ? (
            <div className="flex-1 overflow-hidden" style={{ background: 'var(--app-bg)' }}>
              <Dashboard
                docs={docs}
                onSelectDoc={(doc) => { navigate('all'); setSelectedDoc(doc) }}
                onNavigateCategory={(cat) => navigate('category', cat)}
                onNavigateDomain={(code) => navigate('domain', code)}
                onNavigateClient={(name) => navigate('client', name)}
                onScanVault={() => scanVault()}
                scanning={scanning}
                vaultPath={vaultPath}
                onAddDoc={() => setDocModal({ doc: null })}
                onToggleFavorite={handleToggleFavorite}
              />
            </div>
          ) : view === 'help' && searchResults === null ? (
            <div className="flex-1 overflow-hidden" style={{ background: 'var(--app-bg)' }}>
              <HelpView />
            </div>
          ) : view === 'run' && searchResults === null ? (
            <div className="flex-1 overflow-hidden">
              {selectedRun && (
                <PlaybookRunView
                  runDetail={selectedRun}
                  playbook={groups.find((g) => g.id === selectedRun.run.groupId)}
                  docs={docs}
                  onToggleItem={handleToggleRunItem}
                  onOpenDoc={openDocFile}
                  onSetStatus={handleSetRunStatus}
                  onDelete={handleDeleteRun}
                  onBack={() => { setSelectedRun(null); navigate('groups') }}
                />
              )}
            </div>
          ) : view === 'groups' && searchResults === null ? (
            <div className="flex-1 overflow-hidden" style={{ background: 'var(--app-bg)' }}>
              <PlaybooksView
                playbooks={groups}
                docs={docs}
                runs={runs}
                onNewPlaybook={() => setGroupModal({ group: null })}
                onEditPlaybook={(g) => setGroupModal({ group: g })}
                onDeletePlaybook={handleDeleteGroup}
                onStartPlaybook={(pb) => setStartRunFor(pb)}
                onOpenRun={openRun}
                onDeleteRun={handleDeleteRun}
              />
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-hidden" style={{ background: 'var(--app-bg)' }}>
                <DocumentList
                  docs={displayDocs}
                  title={listTitle}
                  subtitle={listSubtitle}
                  selectedDocId={selectedDoc?.id}
                  onSelectDoc={setSelectedDoc}
                  onEditDoc={view === 'new-docs' ? (doc) => setDocModal({ doc }) : undefined}
                  onDismissNew={view === 'new-docs' ? () => { setNewDocIds([]); navigate('all') } : undefined}
                  onAddDoc={() => {
                    const preset = view === 'category'
                      ? { category: selectedCategory }
                      : view === 'client'
                        ? { clientName: selectedClient }
                        : view === 'domain'
                          ? { domain: selectedDomain }
                          : null
                    setDocModal({ doc: preset })
                  }}
                  onScanVault={() => scanVault()}
                  scanning={scanning}
                  vaultPath={vaultPath}
                  onToggleFavorite={handleToggleFavorite}
                  missingIds={missingIds}
                  onBulkUpdate={handleBulkUpdate}
                  onBulkDelete={handleBulkDelete}
                  onBulkAddToPlaybook={handleBulkAddToPlaybook}
                  playbooks={groups}
                />
              </div>
              <div className="border-l overflow-hidden flex-shrink-0" style={{ width: 'var(--panel-width)', borderColor: '#e5e7eb', background: 'white' }}>
                <PreviewPane
                  doc={selectedDoc}
                  groups={docGroups}
                  onEdit={(d) => setDocModal({ doc: d })}
                  onDelete={handleDeleteDoc}
                  onAddToGroup={(d) => setAddToGroupDoc(d)}
                  onToggleFavorite={handleToggleFavorite}
                  onOpened={handleOpened}
                  onGeneratePdf={handleGeneratePdf}
                  onSupersede={(d) => setSupersedeFor(d)}
                  onPreviewPdf={(d) => setPdfPreviewDoc(d)}
                  vaultPath={vaultPath}
                  sharePointUrl={sharePointUrl}
                  isMissing={selectedDoc ? missingIds.has(selectedDoc.id) : false}
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
          vaultPath={vaultPath}
          categoryNames={[...new Set(docs.map((d) => d.category))]}
        />
      )}
      {groupModal && (
        <GroupModal
          group={groupModal.group}
          onSave={handleSaveGroup}
          onClose={() => setGroupModal(null)}
        />
      )}
      {startRunFor && (
        <StartRunModal
          playbook={startRunFor}
          onStart={handleStartRun}
          onClose={() => setStartRunFor(null)}
        />
      )}
      {supersedeFor && (
        <SupersedeModal
          doc={supersedeFor}
          docs={docs}
          onConfirm={handleSupersede}
          onClose={() => setSupersedeFor(null)}
        />
      )}
      {pdfPreviewDoc && (
        <PdfPreviewModal
          doc={pdfPreviewDoc}
          onClose={() => setPdfPreviewDoc(null)}
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
