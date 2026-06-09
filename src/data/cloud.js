// Cloud data layer (Supabase). Source of truth for shared metadata, playbooks,
// runs, tags, and the audit log. Files stay in SharePoint; documents are
// identified by their VAULT-RELATIVE path (rel_key) so the same record works
// on every machine regardless of its local sync root.
//
// Personal, per-machine state (which docs you've recently opened) stays in
// localStorage and is merged in on load.
import { supabase, currentEmail } from './supabase'

const uid = () => crypto.randomUUID()

// ── Vault root (local, per machine) — used to convert between absolute and
//    vault-relative paths. Set by the app when the vault path is known. ──
let vaultRoot = ''
export function setVaultRoot(p) { vaultRoot = p || '' }

const sep = () => (vaultRoot.includes('\\') ? '\\' : '/')
const norm = (s) => (s || '').replace(/\\/g, '/')

function relativize(abs) {
  if (!abs) return ''
  const a = norm(abs)
  const root = norm(vaultRoot).replace(/\/$/, '')
  if (root && a.toLowerCase().startsWith(root.toLowerCase())) return a.slice(root.length + 1)
  return a // outside the vault — store as-is rather than lose it
}
function absolutize(rel) {
  if (!rel) return ''
  if (!vaultRoot) return rel
  if (/^[a-zA-Z]:[\\/]/.test(rel) || rel.startsWith('/')) return rel // already absolute
  const s = sep()
  return vaultRoot.replace(/[\\/]$/, '') + s + rel.replace(/\//g, s)
}
const stripExt = (p) => (p || '').replace(/\.[^.]+$/, '')

// ── Personal "recently opened" (per machine) ──
const LS_OPENED = 'doccenter-opened-v1'
const getOpened = () => { try { return JSON.parse(localStorage.getItem(LS_OPENED) || '{}') } catch { return {} } }
const setOpened = (m) => localStorage.setItem(LS_OPENED, JSON.stringify(m))

// ── Mappers ──
function rowToDoc(r) {
  const opened = getOpened()
  return {
    id: r.id,
    relKey: r.rel_key,
    title: r.title ?? '',
    category: r.category ?? 'Other',
    fileName: r.file_name ?? '',
    fileType: r.file_type ?? 'docx',
    docxPath: absolutize(r.rel_docx),
    pdfPath: absolutize(r.rel_pdf),
    filePath: absolutize(r.rel_docx || r.rel_pdf || r.rel_file),
    description: r.description ?? '',
    status: r.status ?? 'active',
    tags: Array.isArray(r.tags) ? r.tags : [],
    version: r.version ?? '',
    clientName: r.client_name ?? '',
    reviewBy: r.review_by ?? '',
    versionNotes: r.version_notes ?? '',
    favorite: !!r.favorite,
    sourceUrl: r.source_url ?? '',
    docId: r.doc_id ?? '',
    domain: r.domain ?? '',
    audience: r.audience ?? 'Internal',
    lastOpened: opened[r.id] ?? '',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function docToRow(d) {
  const docxRel = relativize(d.docxPath)
  const pdfRel = relativize(d.pdfPath)
  const isScript = !docxRel && !pdfRel
  return {
    rel_key: d.relKey || stripExt(relativize(d.docxPath || d.pdfPath || d.filePath)),
    rel_docx: docxRel,
    rel_pdf: pdfRel,
    rel_file: isScript ? relativize(d.filePath) : '',
    file_name: d.fileName ?? '',
    file_type: d.fileType ?? 'docx',
    title: d.title ?? '',
    category: d.category ?? 'Other',
    description: d.description ?? '',
    status: d.status ?? 'active',
    tags: d.tags ?? [],
    version: d.version ?? '',
    client_name: d.clientName ?? '',
    review_by: d.reviewBy ?? '',
    version_notes: d.versionNotes ?? '',
    favorite: !!d.favorite,
    source_url: d.sourceUrl ?? '',
    doc_id: d.docId ?? '',
    domain: d.domain ?? '',
    audience: d.audience ?? 'Internal',
    updated_at: new Date().toISOString(),
    updated_by: currentEmail(),
  }
}

async function sel(table, cols = '*') {
  const { data, error } = await supabase.from(table).select(cols)
  if (error) throw error
  return data ?? []
}

// ============================================================
// DOCUMENTS
// ============================================================
export async function getDocuments() {
  const { data, error } = await supabase.from('documents').select('*').order('title')
  if (error) throw error
  return (data ?? []).map(rowToDoc)
}
export async function getDocumentsByCategory(category) {
  const { data, error } = await supabase.from('documents').select('*').eq('category', category).order('title')
  if (error) throw error
  return (data ?? []).map(rowToDoc)
}
export async function searchDocuments(query) {
  const q = `%${query}%`
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .or(`title.ilike.${q},description.ilike.${q},client_name.ilike.${q},doc_id.ilike.${q}`)
    .order('title')
  if (error) throw error
  // tags are jsonb — filter client-side as a supplement
  const lower = query.toLowerCase()
  const byTag = (await getDocuments()).filter((d) => d.tags.some((t) => t.toLowerCase().includes(lower)))
  const map = new Map((data ?? []).map((r) => [r.id, rowToDoc(r)]))
  byTag.forEach((d) => map.set(d.id, d))
  return [...map.values()].sort((a, b) => a.title.localeCompare(b.title))
}
export async function createDocument(doc) {
  const row = docToRow(doc)
  const { data, error } = await supabase.from('documents').upsert(row, { onConflict: 'rel_key' }).select().single()
  if (error) throw error
  return rowToDoc(data)
}
export async function updateDocument(doc) {
  const row = docToRow(doc)
  const { data, error } = await supabase.from('documents').update(row).eq('id', doc.id).select().single()
  if (error) throw error
  return rowToDoc(data)
}
export async function deleteDocument(id) {
  const { error } = await supabase.from('documents').delete().eq('id', id)
  if (error) throw error
}
export async function setFavorite(id, favorite) {
  await supabase.from('documents').update({ favorite: !!favorite }).eq('id', id)
  return favorite
}
export async function markOpened(id) {
  const now = new Date().toISOString()
  const m = getOpened(); m[id] = now; setOpened(m)
  return now
}
export async function getClientNames() {
  const { data, error } = await supabase.from('documents').select('client_name')
  if (error) throw error
  return [...new Set((data ?? []).map((r) => r.client_name).filter(Boolean))].sort()
}

/** Reconcile a vault scan: upsert by rel_key, relink moved files by base name. */
export async function syncScannedDocuments(items) {
  const existing = await getDocuments()
  const byKey = new Map(existing.map((d) => [d.relKey, d]))
  const byBase = new Map()
  for (const d of existing) {
    const b = (d.fileName || '').replace(/\.[^.]+$/, '').toLowerCase()
    if (b && !byBase.has(b)) byBase.set(b, d)
  }
  let added = 0, relinked = 0
  for (const it of items) {
    const relKey = stripExt(relativize(it.docxPath || it.pdfPath || it.filePath))
    const docxRel = relativize(it.docxPath)
    const pdfRel = relativize(it.pdfPath)
    const isScript = !docxRel && !pdfRel
    // Only the file-location fields are ever touched by a scan — NEVER the
    // curated metadata (tags, description, doc_id, review dates, etc.), so a
    // teammate re-syncing the same vault can't wipe what others have set.
    const pathFields = {
      rel_docx: docxRel,
      rel_pdf: pdfRel,
      rel_file: isScript ? relativize(it.filePath) : '',
      file_name: it.fileName,
      file_type: it.fileType,
    }
    if (byKey.has(relKey)) {
      // Already tracked at this path → refresh paths only, preserve metadata
      await supabase.from('documents').update(pathFields).eq('rel_key', relKey)
      continue
    }
    const base = (it.fileName || '').replace(/\.[^.]+$/, '').toLowerCase()
    const moved = base ? byBase.get(base) : null
    if (moved && moved.relKey !== relKey) {
      // File renamed/moved → keep its metadata, update location (+ new folder's category)
      await supabase.from('documents').update({ ...pathFields, rel_key: relKey, category: it.category }).eq('id', moved.id)
      byBase.delete(base)
      relinked++
    } else {
      // Brand-new document → insert with scan defaults
      await createDocument({ ...it, relKey })
      added++
    }
  }
  return { added, relinked }
}

// ============================================================
// TAGS
// ============================================================
export async function getTags() {
  const [tagRows, docs] = await Promise.all([sel('tags', 'name'), getDocuments()])
  const master = tagRows.map((r) => r.name)
  const fromDocs = docs.flatMap((d) => d.tags)
  return [...new Set([...master, ...fromDocs])].sort()
}
export async function addTag(name) {
  await supabase.from('tags').upsert({ name }, { onConflict: 'name' })
}
export async function deleteTag(name) {
  await supabase.from('tags').delete().eq('name', name)
}

// ============================================================
// PLAYBOOKS (groups) + MEMBERS
// ============================================================
function rowToGroup(r) {
  return { id: r.id, name: r.name, description: r.description ?? '', color: r.color ?? '#e1251b', trigger: r.trigger_text ?? '', outcome: r.outcome ?? '', createdAt: r.created_at }
}
export async function getGroups() {
  const { data, error } = await supabase.from('playbooks').select('*').order('name')
  if (error) throw error
  return (data ?? []).map(rowToGroup)
}
export async function createGroup(g) {
  const { data, error } = await supabase.from('playbooks').insert({ name: g.name, description: g.description ?? '', color: g.color ?? '#e1251b', trigger_text: g.trigger ?? '', outcome: g.outcome ?? '' }).select().single()
  if (error) throw error
  return rowToGroup(data)
}
export async function updateGroup(g) {
  const { data, error } = await supabase.from('playbooks').update({ name: g.name, description: g.description ?? '', color: g.color ?? '#e1251b', trigger_text: g.trigger ?? '', outcome: g.outcome ?? '' }).eq('id', g.id).select().single()
  if (error) throw error
  return rowToGroup(data)
}
export async function deleteGroup(id) {
  await supabase.from('playbooks').delete().eq('id', id) // cascades members/runs/run_items
}

export async function getGroupMembers(groupId) {
  const { data: members, error } = await supabase.from('playbook_members').select('*').eq('playbook_id', groupId).order('sort_order')
  if (error) throw error
  if (!members?.length) return []
  const docs = await getDocuments()
  const byKey = new Map(docs.map((d) => [d.relKey, d]))
  return members
    .map((m) => {
      const d = byKey.get(m.rel_key)
      if (!d) return null
      return { ...d, memberId: m.id, phase: m.phase ?? 'Execute', required: m.required ?? 'Required', condition: m.condition ?? '', sortOrder: m.sort_order ?? 0 }
    })
    .filter(Boolean)
}
export async function addToGroup(groupId, documentId, opts = {}) {
  const { phase = 'Execute', required = 'Required', condition = '', sortOrder = 0 } = opts
  // members reference documents by rel_key — look it up
  const { data: doc } = await supabase.from('documents').select('rel_key').eq('id', documentId).single()
  if (!doc) return
  const { data: existing } = await supabase.from('playbook_members').select('id').eq('playbook_id', groupId).eq('rel_key', doc.rel_key)
  if (existing?.length) return // already a member
  await supabase.from('playbook_members').insert({ playbook_id: groupId, rel_key: doc.rel_key, phase, required, condition, sort_order: sortOrder })
}
/** Compute the vault-relative key for a document object (for migration). */
export function relKeyForDoc(doc) {
  return stripExt(relativize(doc.docxPath || doc.pdfPath || doc.filePath))
}
/** Add a playbook member by rel_key directly (used during migration). */
export async function addMemberByRelKey(groupId, relKey, opts = {}) {
  const { phase = 'Execute', required = 'Required', condition = '', sortOrder = 0 } = opts
  if (!relKey) return
  const { data: existing } = await supabase.from('playbook_members').select('id').eq('playbook_id', groupId).eq('rel_key', relKey)
  if (existing?.length) return
  await supabase.from('playbook_members').insert({ playbook_id: groupId, rel_key: relKey, phase, required, condition, sort_order: sortOrder })
}

export async function updateMember(memberId, fields) {
  await supabase.from('playbook_members').update({ phase: fields.phase ?? 'Execute', required: fields.required ?? 'Required', condition: fields.condition ?? '', sort_order: fields.sortOrder ?? 0 }).eq('id', memberId)
}
export async function removeFromGroup(groupId, documentId) {
  const { data: doc } = await supabase.from('documents').select('rel_key').eq('id', documentId).single()
  if (!doc) return
  await supabase.from('playbook_members').delete().eq('playbook_id', groupId).eq('rel_key', doc.rel_key)
}
export async function getDocumentGroupIds(documentId) {
  const { data: doc } = await supabase.from('documents').select('rel_key').eq('id', documentId).single()
  if (!doc) return []
  const { data } = await supabase.from('playbook_members').select('playbook_id').eq('rel_key', doc.rel_key)
  return (data ?? []).map((m) => m.playbook_id)
}

// ============================================================
// RUNS
// ============================================================
function mapRun(r) {
  return { id: r.id, groupId: r.playbook_id, name: r.name ?? '', clientName: r.client_name ?? '', ticket: r.ticket ?? '', status: r.status ?? 'in_progress', startedAt: r.started_at ?? '', completedAt: r.completed_at ?? '' }
}
function mapItem(i) {
  return { id: i.id, runId: i.run_id, documentId: i.rel_key, docTitle: i.doc_title ?? '', phase: i.phase ?? 'Execute', sortOrder: i.sort_order ?? 0, required: i.required ?? 'Required', done: !!i.done, doneAt: i.done_at ?? '' }
}
export async function startRun(groupId, meta = {}) {
  const members = await getGroupMembers(groupId)
  const { data: run, error } = await supabase.from('runs').insert({ playbook_id: groupId, client_name: meta.clientName ?? '', ticket: meta.ticket ?? '', status: 'in_progress', started_by: currentEmail() }).select().single()
  if (error) throw error
  if (members.length) {
    await supabase.from('run_items').insert(members.map((m) => ({
      run_id: run.id, rel_key: m.relKey, doc_title: m.title, phase: m.phase ?? 'Execute', sort_order: m.sortOrder ?? 0, required: m.required ?? 'Required',
    })))
  }
  return run.id
}
export async function getRuns(groupId = null) {
  let qb = supabase.from('runs').select('*').order('started_at', { ascending: false })
  if (groupId) qb = qb.eq('playbook_id', groupId)
  const { data: runs, error } = await qb
  if (error) throw error
  if (!runs?.length) return []
  const { data: items } = await supabase.from('run_items').select('run_id, done')
  const counts = {}
  for (const it of items ?? []) { const c = (counts[it.run_id] ??= { total: 0, done: 0 }); c.total++; if (it.done) c.done++ }
  return runs.map((r) => ({ ...mapRun(r), total: counts[r.id]?.total ?? 0, doneCount: counts[r.id]?.done ?? 0 }))
}
export async function getRun(runId) {
  const { data: runs } = await supabase.from('runs').select('*').eq('id', runId)
  if (!runs?.length) return null
  const { data: items } = await supabase.from('run_items').select('*').eq('run_id', runId).order('sort_order')
  // Resolve rel_key → live document id for opening files
  const docs = await getDocuments()
  const byKey = new Map(docs.map((d) => [d.relKey, d]))
  const mapped = (items ?? []).map((i) => {
    const d = byKey.get(i.rel_key)
    return { ...mapItem(i), documentId: d ? d.id : i.rel_key }
  })
  return { run: mapRun(runs[0]), items: mapped }
}
export async function toggleRunItem(itemId, done) {
  await supabase.from('run_items').update({ done: !!done, done_at: done ? new Date().toISOString() : null, done_by: done ? currentEmail() : '' }).eq('id', itemId)
}
export async function setRunStatus(runId, status) {
  await supabase.from('runs').update({ status, completed_at: status === 'complete' ? new Date().toISOString() : null }).eq('id', runId)
}
export async function deleteRun(runId) {
  await supabase.from('runs').delete().eq('id', runId) // cascades run_items
}

// ============================================================
// AUDIT LOG
// ============================================================
export async function logEvent(action, detail = '') {
  try {
    await supabase.from('audit_log').insert({ who: currentEmail(), action, detail })
  } catch { /* best-effort */ }
}
export async function getAuditLog(limit = 100) {
  const { data, error } = await supabase.from('audit_log').select('*').order('ts', { ascending: false }).limit(limit)
  if (error) throw error
  return (data ?? []).map((r) => ({ id: r.id, ts: r.ts, who: r.who ?? '', action: r.action ?? '', detail: r.detail ?? '' }))
}
export async function clearAuditLog() {
  await supabase.from('audit_log').delete().neq('id', '00000000-0000-0000-0000-000000000000')
}

// Subscribe to realtime changes on runs/run_items/documents/playbooks. cb() on any change.
export function subscribeChanges(cb) {
  if (!supabase) return () => {}
  const ch = supabase.channel('doccenter-sync')
  ;['runs', 'run_items', 'documents', 'playbooks', 'playbook_members'].forEach((t) =>
    ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => cb(t))
  )
  ch.subscribe()
  return () => supabase.removeChannel(ch)
}
