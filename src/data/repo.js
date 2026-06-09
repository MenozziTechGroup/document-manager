import { getDb, isTauri, lsGet, lsSet, rowToDoc, rowToGroup } from './db'
import * as cloud from './cloud'
import { useCloud } from './supabase'

const LS_DOCS = 'docmanager-docs-v1'
const LS_GROUPS = 'docmanager-groups-v1'
const LS_MEMBERS = 'docmanager-members-v1'
const LS_TAGS = 'docmanager-tags-v1'
const LS_SETTINGS = 'docmanager-settings-v1'
const LS_RUNS = 'docmanager-runs-v1'
const LS_RUNITEMS = 'docmanager-runitems-v1'

const uid = () => crypto.randomUUID()

// All document columns EXCEPT content_text — the full extracted search text can
// be large and the UI never reads it (search uses it only inside SQL WHERE), so
// we avoid pulling it into memory on every load.
const DOC_COLS = [
  'id', 'title', 'category', 'file_path', 'file_name', 'file_type',
  'docx_path', 'pdf_path', 'description', 'status', 'tags', 'version',
  'client_name', 'review_by', 'version_notes', 'favorite', 'last_opened',
  'source_url', 'doc_id', 'domain', 'audience', 'created_at', 'updated_at',
].join(', ')

// ============================================================
// DOCUMENTS
// ============================================================

export async function getDocuments() {
  if (useCloud()) return cloud.getDocuments()
  if (isTauri()) {
    const db = await getDb()
    const rows = await db.select(`SELECT ${DOC_COLS} FROM documents ORDER BY title ASC`)
    return rows.map(rowToDoc)
  }
  return lsGet(LS_DOCS, [])
}

export async function getDocumentsByCategory(category) {
  if (useCloud()) return cloud.getDocumentsByCategory(category)
  if (isTauri()) {
    const db = await getDb()
    const rows = await db.select(
      `SELECT ${DOC_COLS} FROM documents WHERE category=$1 ORDER BY title ASC`,
      [category]
    )
    return rows.map(rowToDoc)
  }
  return lsGet(LS_DOCS, []).filter((d) => d.category === category)
}

export async function searchDocuments(query) {
  if (useCloud()) return cloud.searchDocuments(query)
  const q = `%${query}%`
  if (isTauri()) {
    const db = await getDb()
    const rows = await db.select(
      `SELECT ${DOC_COLS} FROM documents
       WHERE title LIKE $1 OR description LIKE $1 OR client_name LIKE $1
          OR tags LIKE $1 OR content_text LIKE $1 OR doc_id LIKE $1
       ORDER BY title ASC`,
      [q]
    )
    return rows.map(rowToDoc)
  }
  const lower = query.toLowerCase()
  return lsGet(LS_DOCS, []).filter((d) =>
    d.title.toLowerCase().includes(lower) ||
    d.description.toLowerCase().includes(lower) ||
    d.clientName.toLowerCase().includes(lower) ||
    (d.docId ?? '').toLowerCase().includes(lower) ||
    d.tags.some((t) => t.toLowerCase().includes(lower))
  )
}

export async function createDocument(doc) {
  if (useCloud()) return cloud.createDocument(doc)
  const record = { ...doc, id: doc.id ?? uid() }
  if (isTauri()) {
    const db = await getDb()
    // Upsert: on file_path conflict, refresh the paired paths only (preserve manually-added metadata)
    await db.execute(
      `INSERT INTO documents
       (id, title, category, file_path, file_name, file_type, docx_path, pdf_path,
        description, status, tags, version, client_name, review_by, version_notes, source_url,
        doc_id, domain, audience)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       ON CONFLICT(file_path) DO UPDATE SET
         docx_path  = excluded.docx_path,
         pdf_path   = excluded.pdf_path,
         updated_at = datetime('now')`,
      [
        record.id, record.title, record.category, record.filePath, record.fileName,
        record.fileType, record.docxPath ?? '', record.pdfPath ?? '',
        record.description ?? '', record.status ?? 'active',
        JSON.stringify(record.tags ?? []), record.version ?? '', record.clientName ?? '',
        record.reviewBy ?? '', record.versionNotes ?? '', record.sourceUrl ?? '',
        record.docId ?? '', record.domain ?? '', record.audience ?? 'Internal',
      ]
    )
  } else {
    const all = lsGet(LS_DOCS, [])
    const idx = all.findIndex((d) => d.filePath === record.filePath)
    if (idx === -1) lsSet(LS_DOCS, [...all, record])
    else { all[idx] = { ...all[idx], docxPath: record.docxPath, pdfPath: record.pdfPath }; lsSet(LS_DOCS, all) }
  }
  return record
}

/**
 * Reconcile a vault scan against the existing library:
 *  - file already tracked at this path → refresh its paired paths
 *  - a file with the same base name exists but at a different path → RELINK
 *    (the file was renamed/moved; keep all its metadata, update the location)
 *  - otherwise → insert a new record
 * Returns { added, relinked }.
 */
export async function syncScannedDocuments(items) {
  if (useCloud()) return cloud.syncScannedDocuments(items)
  const existing = await getDocuments()
  const byFilePath = new Map(existing.map((d) => [d.filePath, d]))
  const byBase = new Map()
  for (const d of existing) {
    const b = (d.fileName || '').replace(/\.[^.]+$/, '').toLowerCase()
    if (b && !byBase.has(b)) byBase.set(b, d)
  }
  let added = 0, relinked = 0
  const addedIds = []
  for (const it of items) {
    if (byFilePath.has(it.filePath)) {
      await createDocument(it) // upsert on file_path → refreshes docx/pdf paths
      continue
    }
    const base = (it.fileName || '').replace(/\.[^.]+$/, '').toLowerCase()
    const moved = base ? byBase.get(base) : null
    if (moved && moved.filePath !== it.filePath) {
      await updateDocument({
        ...moved,
        category: it.category,
        filePath: it.filePath,
        fileName: it.fileName,
        fileType: it.fileType,
        docxPath: it.docxPath,
        pdfPath: it.pdfPath,
      })
      byBase.delete(base) // don't relink the same record twice in one scan
      relinked++
    } else {
      const doc = await createDocument(it)
      if (doc) { addedIds.push(doc.id); added++ }
    }
  }
  return { added, relinked, addedIds }
}

export async function updateDocument(doc) {
  if (useCloud()) return cloud.updateDocument(doc)
  if (isTauri()) {
    const db = await getDb()
    await db.execute(
      `UPDATE documents SET
        title=$2, category=$3, file_path=$4, file_name=$5, file_type=$6,
        docx_path=$7, pdf_path=$8,
        description=$9, status=$10, tags=$11, version=$12, client_name=$13,
        review_by=$14, version_notes=$15, favorite=$16, source_url=$17,
        doc_id=$18, domain=$19, audience=$20,
        updated_at=datetime('now')
       WHERE id=$1`,
      [
        doc.id, doc.title, doc.category, doc.filePath, doc.fileName, doc.fileType,
        doc.docxPath ?? '', doc.pdfPath ?? '',
        doc.description ?? '', doc.status ?? 'active', JSON.stringify(doc.tags ?? []),
        doc.version ?? '', doc.clientName ?? '',
        doc.reviewBy ?? '', doc.versionNotes ?? '', doc.favorite ? 1 : 0, doc.sourceUrl ?? '',
        doc.docId ?? '', doc.domain ?? '', doc.audience ?? 'Internal',
      ]
    )
  } else {
    const all = lsGet(LS_DOCS, [])
    lsSet(LS_DOCS, all.map((d) => (d.id === doc.id ? doc : d)))
  }
  return doc
}

export async function deleteDocument(id) {
  if (useCloud()) return cloud.deleteDocument(id)
  if (isTauri()) {
    const db = await getDb()
    await db.execute('DELETE FROM group_members WHERE document_id=$1', [id])
    await db.execute('DELETE FROM documents WHERE id=$1', [id])
  } else {
    lsSet(LS_DOCS, lsGet(LS_DOCS, []).filter((d) => d.id !== id))
    lsSet(LS_MEMBERS, lsGet(LS_MEMBERS, []).filter((m) => m.documentId !== id))
  }
}

/** Toggle a document's favorite (star) flag. Returns the new value. */
export async function setFavorite(id, favorite) {
  if (useCloud()) return cloud.setFavorite(id, favorite)
  if (isTauri()) {
    const db = await getDb()
    await db.execute('UPDATE documents SET favorite=$2 WHERE id=$1', [id, favorite ? 1 : 0])
  } else {
    const all = lsGet(LS_DOCS, [])
    lsSet(LS_DOCS, all.map((d) => (d.id === id ? { ...d, favorite } : d)))
  }
  return favorite
}

/** Record that a document was just opened (for the Recently Opened list). */
export async function markOpened(id) {
  if (useCloud()) return cloud.markOpened(id)
  const now = new Date().toISOString()
  if (isTauri()) {
    const db = await getDb()
    await db.execute('UPDATE documents SET last_opened=$2 WHERE id=$1', [id, now])
  } else {
    const all = lsGet(LS_DOCS, [])
    lsSet(LS_DOCS, all.map((d) => (d.id === id ? { ...d, lastOpened: now } : d)))
  }
  return now
}

/**
 * Given the loaded documents, returns a Set of document ids whose underlying
 * file (docx or pdf) is missing from disk. Browser mode can't check the
 * filesystem, so it returns an empty set.
 */
export async function findMissingDocIds(docs) {
  if (!isTauri()) return new Set()
  const { invoke } = await import('@tauri-apps/api/core')
  // Build a flat list of every path we expect to exist, remembering which doc each belongs to
  const checks = []
  for (const d of docs) {
    const paths = [d.docxPath, d.pdfPath].filter(Boolean)
    // Fall back to filePath if no paired paths recorded
    if (paths.length === 0 && d.filePath) paths.push(d.filePath)
    for (const p of paths) checks.push({ id: d.id, path: p })
  }
  if (checks.length === 0) return new Set()
  const results = await invoke('paths_exist', { paths: checks.map((c) => c.path) })
  // A doc is "missing" if ANY of its expected files is gone
  const missing = new Set()
  checks.forEach((c, i) => { if (!results[i]) missing.add(c.id) })
  return missing
}

// ============================================================
// DOCUMENT GROUPS
// ============================================================

export async function getGroups() {
  if (useCloud()) return cloud.getGroups()
  if (isTauri()) {
    const db = await getDb()
    const rows = await db.select('SELECT * FROM document_groups ORDER BY name ASC')
    return rows.map(rowToGroup)
  }
  return lsGet(LS_GROUPS, [])
}

export async function createGroup(group) {
  if (useCloud()) return cloud.createGroup(group)
  const record = { ...group, id: group.id ?? uid() }
  if (isTauri()) {
    const db = await getDb()
    await db.execute(
      'INSERT INTO document_groups (id, name, description, color, trigger_text, outcome) VALUES ($1,$2,$3,$4,$5,$6)',
      [record.id, record.name, record.description ?? '', record.color ?? '#e1251b', record.trigger ?? '', record.outcome ?? '']
    )
  } else {
    const all = lsGet(LS_GROUPS, [])
    lsSet(LS_GROUPS, [...all, record])
  }
  return record
}

export async function updateGroup(group) {
  if (useCloud()) return cloud.updateGroup(group)
  if (isTauri()) {
    const db = await getDb()
    await db.execute(
      'UPDATE document_groups SET name=$2, description=$3, color=$4, trigger_text=$5, outcome=$6 WHERE id=$1',
      [group.id, group.name, group.description ?? '', group.color ?? '#e1251b', group.trigger ?? '', group.outcome ?? '']
    )
  } else {
    const all = lsGet(LS_GROUPS, [])
    lsSet(LS_GROUPS, all.map((g) => (g.id === group.id ? group : g)))
  }
  return group
}

export async function deleteGroup(id) {
  if (useCloud()) return cloud.deleteGroup(id)
  if (isTauri()) {
    const db = await getDb()
    await db.execute('DELETE FROM playbook_run_items WHERE run_id IN (SELECT id FROM playbook_runs WHERE group_id=$1)', [id])
    await db.execute('DELETE FROM playbook_runs WHERE group_id=$1', [id])
    await db.execute('DELETE FROM group_members WHERE group_id=$1', [id])
    await db.execute('DELETE FROM document_groups WHERE id=$1', [id])
  } else {
    const runIds = lsGet(LS_RUNS, []).filter((r) => r.groupId === id).map((r) => r.id)
    lsSet(LS_RUNS, lsGet(LS_RUNS, []).filter((r) => r.groupId !== id))
    lsSet(LS_RUNITEMS, lsGet(LS_RUNITEMS, []).filter((i) => !runIds.includes(i.runId)))
    lsSet(LS_GROUPS, lsGet(LS_GROUPS, []).filter((g) => g.id !== id))
    lsSet(LS_MEMBERS, lsGet(LS_MEMBERS, []).filter((m) => m.groupId !== id))
  }
}

// ============================================================
// GROUP MEMBERS
// ============================================================

export async function getGroupMembers(groupId) {
  if (useCloud()) return cloud.getGroupMembers(groupId)
  if (isTauri()) {
    const db = await getDb()
    const rows = await db.select(
      `SELECT d.*, gm.id AS member_id, gm.phase AS m_phase, gm.required AS m_required,
              gm.condition AS m_condition, gm.sort_order AS m_order
       FROM documents d
       JOIN group_members gm ON gm.document_id = d.id
       WHERE gm.group_id=$1
       ORDER BY gm.sort_order ASC, d.title ASC`,
      [groupId]
    )
    return rows.map((r) => ({
      ...rowToDoc(r),
      memberId: r.member_id,
      phase: r.m_phase ?? 'Execute',
      required: r.m_required ?? 'Required',
      condition: r.m_condition ?? '',
      sortOrder: r.m_order ?? 0,
    }))
  }
  const members = lsGet(LS_MEMBERS, [])
    .filter((m) => m.groupId === groupId)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  const docs = lsGet(LS_DOCS, [])
  return members
    .map((m) => {
      const d = docs.find((x) => x.id === m.documentId)
      return d ? {
        ...d, memberId: m.id, phase: m.phase ?? 'Execute',
        required: m.required ?? 'Required', condition: m.condition ?? '', sortOrder: m.sortOrder ?? 0,
      } : null
    })
    .filter(Boolean)
}

export async function addToGroup(groupId, documentId, opts = {}) {
  if (useCloud()) return cloud.addToGroup(groupId, documentId, opts)
  const { phase = 'Execute', required = 'Required', condition = '', sortOrder = 0 } = opts
  if (isTauri()) {
    const db = await getDb()
    await db.execute(
      `INSERT OR IGNORE INTO group_members (id, group_id, document_id, phase, required, condition, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [uid(), groupId, documentId, phase, required, condition, sortOrder]
    )
  } else {
    const all = lsGet(LS_MEMBERS, [])
    if (!all.find((m) => m.groupId === groupId && m.documentId === documentId)) {
      lsSet(LS_MEMBERS, [...all, { id: uid(), groupId, documentId, phase, required, condition, sortOrder }])
    }
  }
}

/** Update a playbook member's phase, required flag, condition, or order. */
export async function updateMember(memberId, fields) {
  if (useCloud()) return cloud.updateMember(memberId, fields)
  if (isTauri()) {
    const db = await getDb()
    await db.execute(
      'UPDATE group_members SET phase=$2, required=$3, condition=$4, sort_order=$5 WHERE id=$1',
      [memberId, fields.phase ?? 'Execute', fields.required ?? 'Required', fields.condition ?? '', fields.sortOrder ?? 0]
    )
  } else {
    const all = lsGet(LS_MEMBERS, [])
    lsSet(LS_MEMBERS, all.map((m) => (m.id === memberId ? { ...m, ...fields } : m)))
  }
}

export async function removeFromGroup(groupId, documentId) {
  if (useCloud()) return cloud.removeFromGroup(groupId, documentId)
  if (isTauri()) {
    const db = await getDb()
    await db.execute(
      'DELETE FROM group_members WHERE group_id=$1 AND document_id=$2',
      [groupId, documentId]
    )
  } else {
    lsSet(
      LS_MEMBERS,
      lsGet(LS_MEMBERS, []).filter(
        (m) => !(m.groupId === groupId && m.documentId === documentId)
      )
    )
  }
}

export async function getDocumentGroupIds(documentId) {
  if (useCloud()) return cloud.getDocumentGroupIds(documentId)
  if (isTauri()) {
    const db = await getDb()
    const rows = await db.select(
      'SELECT group_id FROM group_members WHERE document_id=$1',
      [documentId]
    )
    return rows.map((r) => r.group_id)
  }
  return lsGet(LS_MEMBERS, [])
    .filter((m) => m.documentId === documentId)
    .map((m) => m.groupId)
}

// ============================================================
// DOC IDS  (stable TYPE-DOMAIN-NNN identifiers)
// ============================================================

/**
 * Suggest the next available Doc ID for a given type code + domain code,
 * e.g. ("SOP", "MDM") → "SOP-MDM-004" by scanning existing IDs with that
 * prefix and incrementing the highest number found.
 */
export async function suggestDocId(typeCode, domainCode) {
  if (!typeCode || !domainCode) return ''
  const prefix = `${typeCode}-${domainCode}-`
  let docs
  if (useCloud()) {
    docs = (await getDocuments()).map((d) => d.docId).filter(Boolean)
  } else if (isTauri()) {
    const db = await getDb()
    docs = await db.select('SELECT doc_id FROM documents WHERE doc_id LIKE $1', [`${prefix}%`])
    docs = docs.map((r) => r.doc_id)
  } else {
    docs = lsGet(LS_DOCS, []).map((d) => d.docId).filter(Boolean)
  }
  let max = 0
  for (const id of docs) {
    const m = (id ?? '').match(new RegExp(`^${typeCode}-${domainCode}-(\\d+)$`, 'i'))
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

// ============================================================
// PLAYBOOK RUNS  (instances — a tech running a playbook for a client)
// ============================================================

function mapRunRow(r) {
  return {
    id: r.id, groupId: r.group_id, name: r.name ?? '',
    clientName: r.client_name ?? '', ticket: r.ticket ?? '',
    status: r.status ?? 'in_progress', startedAt: r.started_at ?? '', completedAt: r.completed_at ?? '',
  }
}

function mapItemRow(i) {
  return {
    id: i.id, runId: i.run_id, documentId: i.document_id, docTitle: i.doc_title ?? '',
    phase: i.phase ?? 'Execute', sortOrder: i.sort_order ?? 0,
    required: i.required ?? 'Required', done: !!i.done, doneAt: i.done_at ?? '',
  }
}

/** Start a run of a playbook — snapshots its current manifest into run items. */
export async function startRun(groupId, meta = {}) {
  if (useCloud()) return cloud.startRun(groupId, meta)
  const runId = uid()
  const members = await getGroupMembers(groupId)
  const now = new Date().toISOString()
  if (isTauri()) {
    const db = await getDb()
    await db.execute(
      'INSERT INTO playbook_runs (id, group_id, name, client_name, ticket, status) VALUES ($1,$2,$3,$4,$5,$6)',
      [runId, groupId, meta.name ?? '', meta.clientName ?? '', meta.ticket ?? '', 'in_progress']
    )
    for (const m of members) {
      await db.execute(
        `INSERT INTO playbook_run_items (id, run_id, document_id, doc_title, phase, sort_order, required)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [uid(), runId, m.id, m.title, m.phase ?? 'Execute', m.sortOrder ?? 0, m.required ?? 'Required']
      )
    }
  } else {
    const runs = lsGet(LS_RUNS, [])
    lsSet(LS_RUNS, [...runs, { id: runId, groupId, name: meta.name ?? '', clientName: meta.clientName ?? '', ticket: meta.ticket ?? '', status: 'in_progress', startedAt: now, completedAt: '' }])
    const items = lsGet(LS_RUNITEMS, [])
    members.forEach((m) => items.push({ id: uid(), runId, documentId: m.id, docTitle: m.title, phase: m.phase ?? 'Execute', sortOrder: m.sortOrder ?? 0, required: m.required ?? 'Required', done: false, doneAt: '' }))
    lsSet(LS_RUNITEMS, items)
  }
  return runId
}

/** List runs (optionally for one playbook), each with {total, doneCount}. */
export async function getRuns(groupId = null) {
  if (useCloud()) return cloud.getRuns(groupId)
  if (isTauri()) {
    const db = await getDb()
    const runs = groupId
      ? await db.select('SELECT * FROM playbook_runs WHERE group_id=$1 ORDER BY started_at DESC', [groupId])
      : await db.select('SELECT * FROM playbook_runs ORDER BY started_at DESC')
    const out = []
    for (const r of runs) {
      const c = await db.select('SELECT COUNT(*) AS total, COALESCE(SUM(done),0) AS done FROM playbook_run_items WHERE run_id=$1', [r.id])
      out.push({ ...mapRunRow(r), total: c[0].total ?? 0, doneCount: c[0].done ?? 0 })
    }
    return out
  }
  let runs = lsGet(LS_RUNS, [])
  if (groupId) runs = runs.filter((r) => r.groupId === groupId)
  const items = lsGet(LS_RUNITEMS, [])
  return runs
    .slice()
    .sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''))
    .map((r) => {
      const ri = items.filter((i) => i.runId === r.id)
      return { ...r, total: ri.length, doneCount: ri.filter((i) => i.done).length }
    })
}

/** Full run detail: { run, items }. */
export async function getRun(runId) {
  if (useCloud()) return cloud.getRun(runId)
  if (isTauri()) {
    const db = await getDb()
    const runs = await db.select('SELECT * FROM playbook_runs WHERE id=$1', [runId])
    if (!runs.length) return null
    const items = await db.select('SELECT * FROM playbook_run_items WHERE run_id=$1 ORDER BY sort_order ASC', [runId])
    return { run: mapRunRow(runs[0]), items: items.map(mapItemRow) }
  }
  const r = lsGet(LS_RUNS, []).find((x) => x.id === runId)
  if (!r) return null
  const items = lsGet(LS_RUNITEMS, []).filter((i) => i.runId === runId).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  return { run: r, items }
}

export async function toggleRunItem(itemId, done) {
  if (useCloud()) return cloud.toggleRunItem(itemId, done)
  const now = done ? new Date().toISOString() : ''
  if (isTauri()) {
    const db = await getDb()
    await db.execute('UPDATE playbook_run_items SET done=$2, done_at=$3 WHERE id=$1', [itemId, done ? 1 : 0, now])
  } else {
    const items = lsGet(LS_RUNITEMS, [])
    lsSet(LS_RUNITEMS, items.map((i) => (i.id === itemId ? { ...i, done, doneAt: now } : i)))
  }
}

export async function setRunStatus(runId, status) {
  if (useCloud()) return cloud.setRunStatus(runId, status)
  const now = status === 'complete' ? new Date().toISOString() : ''
  if (isTauri()) {
    const db = await getDb()
    await db.execute('UPDATE playbook_runs SET status=$2, completed_at=$3 WHERE id=$1', [runId, status, now])
  } else {
    const runs = lsGet(LS_RUNS, [])
    lsSet(LS_RUNS, runs.map((r) => (r.id === runId ? { ...r, status, completedAt: now } : r)))
  }
}

export async function deleteRun(runId) {
  if (useCloud()) return cloud.deleteRun(runId)
  if (isTauri()) {
    const db = await getDb()
    await db.execute('DELETE FROM playbook_run_items WHERE run_id=$1', [runId])
    await db.execute('DELETE FROM playbook_runs WHERE id=$1', [runId])
  } else {
    lsSet(LS_RUNS, lsGet(LS_RUNS, []).filter((r) => r.id !== runId))
    lsSet(LS_RUNITEMS, lsGet(LS_RUNITEMS, []).filter((i) => i.runId !== runId))
  }
}

// ============================================================
// CLIENT NAMES (derived from documents)
// ============================================================

export async function getClientNames() {
  if (useCloud()) return cloud.getClientNames()
  if (isTauri()) {
    const db = await getDb()
    const rows = await db.select(
      `SELECT DISTINCT client_name FROM documents
       WHERE client_name IS NOT NULL AND client_name != ''
       ORDER BY client_name ASC`
    )
    return rows.map((r) => r.client_name)
  }
  const all = lsGet(LS_DOCS, [])
  return [...new Set(all.map((d) => d.clientName).filter(Boolean))].sort()
}

// ============================================================
// TAGS
// ============================================================

export async function getTags() {
  if (useCloud()) return cloud.getTags()
  if (isTauri()) {
    const db = await getDb()
    // Merge the master tags table with any tags already stored on documents
    const [tagRows, docRows] = await Promise.all([
      db.select('SELECT name FROM tags ORDER BY name ASC'),
      db.select("SELECT tags FROM documents WHERE tags != '[]' AND tags != ''"),
    ])
    const masterTags = tagRows.map((r) => r.name)
    const docTags = []
    for (const row of docRows) {
      try {
        const parsed = JSON.parse(row.tags)
        if (Array.isArray(parsed)) docTags.push(...parsed)
      } catch { /* skip malformed */ }
    }
    return [...new Set([...masterTags, ...docTags])].sort()
  }
  return lsGet(LS_TAGS, [])
}

export async function addTag(name) {
  if (useCloud()) return cloud.addTag(name)
  if (isTauri()) {
    const db = await getDb()
    await db.execute('INSERT OR IGNORE INTO tags (id, name) VALUES ($1,$2)', [uid(), name])
  } else {
    const all = lsGet(LS_TAGS, [])
    if (!all.includes(name)) lsSet(LS_TAGS, [...all, name])
  }
}

export async function deleteTag(name) {
  if (useCloud()) return cloud.deleteTag(name)
  if (isTauri()) {
    const db = await getDb()
    await db.execute('DELETE FROM tags WHERE name=$1', [name])
  } else {
    lsSet(LS_TAGS, lsGet(LS_TAGS, []).filter((t) => t !== name))
  }
}

// ============================================================
// AUDIT LOG  (what changed, when, by whom)
// ============================================================

const LS_AUDIT = 'docmanager-audit-v1'

/** Record an activity-log entry. Best-effort — never throws to the caller. */
export async function logEvent(action, detail = '') {
  if (useCloud()) return cloud.logEvent(action, detail)
  try {
    const who = await getSetting('technicianName', '')
    if (isTauri()) {
      const db = await getDb()
      await db.execute('INSERT INTO audit_log (id, who, action, detail) VALUES ($1,$2,$3,$4)', [uid(), who ?? '', action, detail])
    } else {
      const all = lsGet(LS_AUDIT, [])
      all.unshift({ id: uid(), ts: new Date().toISOString(), who: who ?? '', action, detail })
      lsSet(LS_AUDIT, all.slice(0, 500))
    }
  } catch { /* logging must never break the app */ }
}

export async function getAuditLog(limit = 100) {
  if (useCloud()) return cloud.getAuditLog(limit)
  if (isTauri()) {
    const db = await getDb()
    const rows = await db.select('SELECT * FROM audit_log ORDER BY ts DESC LIMIT $1', [limit])
    return rows.map((r) => ({ id: r.id, ts: r.ts, who: r.who ?? '', action: r.action ?? '', detail: r.detail ?? '' }))
  }
  return lsGet(LS_AUDIT, []).slice(0, limit)
}

/** Build a CSV string of the whole library for export. */
export async function buildDocumentsCsv() {
  const docs = await getDocuments()
  const cols = ['Doc ID', 'Title', 'Type', 'Domain', 'Status', 'Version', 'Client', 'Audience', 'Review By', 'Tags', 'Has PDF', 'File Path']
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const rows = docs.map((d) => [
    d.docId, d.title, d.category, d.domain, d.status, d.version, d.clientName,
    d.audience, d.reviewBy, (d.tags ?? []).join('; '), d.pdfPath ? 'Yes' : 'No', d.filePath,
  ].map(esc).join(','))
  return [cols.map(esc).join(','), ...rows].join('\r\n')
}

export async function clearAuditLog() {
  if (useCloud()) return cloud.clearAuditLog()
  if (isTauri()) {
    const db = await getDb()
    await db.execute('DELETE FROM audit_log')
  } else {
    lsSet(LS_AUDIT, [])
  }
}

// ============================================================
// SETTINGS
// ============================================================

export async function getSetting(key, fallback = null) {
  if (isTauri()) {
    const db = await getDb()
    const rows = await db.select('SELECT value FROM settings WHERE key=$1', [key])
    if (!rows.length) return fallback
    try { return JSON.parse(rows[0].value) } catch { return fallback }
  }
  const all = lsGet(LS_SETTINGS, {})
  return key in all ? all[key] : fallback
}

export async function setSetting(key, value) {
  if (isTauri()) {
    const db = await getDb()
    await db.execute(
      `INSERT INTO settings (key, value) VALUES ($1,$2)
       ON CONFLICT(key) DO UPDATE SET value=$2`,
      [key, JSON.stringify(value)]
    )
  } else {
    const all = lsGet(LS_SETTINGS, {})
    all[key] = value
    lsSet(LS_SETTINGS, all)
  }
}

// ============================================================
// MIGRATION  (one-time push of this machine's local library → cloud)
// ============================================================

/** Read documents/groups/members/tags straight from LOCAL storage (bypassing
 *  the cloud delegation), then push everything up to the cloud. Idempotent for
 *  documents (upsert by rel_key) and skips playbooks that already exist by name. */
export async function migrateLocalToCloud() {
  if (!useCloud()) throw new Error('Sign in to the cloud before migrating.')

  // ---- read local ----
  let localDocs = []
  const localGroups = []
  let localTags = []
  if (isTauri()) {
    const db = await getDb()
    localDocs = (await db.select('SELECT * FROM documents ORDER BY title ASC')).map(rowToDoc)
    const groupRows = await db.select('SELECT * FROM document_groups')
    for (const gr of groupRows) {
      const g = rowToGroup(gr)
      const m = await db.select(
        `SELECT d.*, gm.phase AS m_phase, gm.required AS m_required, gm.condition AS m_condition, gm.sort_order AS m_order
         FROM documents d JOIN group_members gm ON gm.document_id = d.id WHERE gm.group_id=$1 ORDER BY gm.sort_order ASC`,
        [gr.id]
      )
      g._members = m.map((r) => ({ ...rowToDoc(r), phase: r.m_phase, required: r.m_required, condition: r.m_condition, sortOrder: r.m_order }))
      localGroups.push(g)
    }
    const tagRows = await db.select('SELECT name FROM tags')
    localTags = [...new Set([...tagRows.map((r) => r.name), ...localDocs.flatMap((d) => d.tags)])]
  } else {
    localDocs = lsGet(LS_DOCS, [])
    const members = lsGet(LS_MEMBERS, [])
    for (const g of lsGet(LS_GROUPS, [])) {
      const _members = members
        .filter((m) => m.groupId === g.id)
        .map((m) => { const d = localDocs.find((x) => x.id === m.documentId); return d ? { ...d, phase: m.phase, required: m.required, condition: m.condition, sortOrder: m.sortOrder } : null })
        .filter(Boolean)
      localGroups.push({ ...g, _members })
    }
    localTags = [...new Set([...lsGet(LS_TAGS, []), ...localDocs.flatMap((d) => d.tags)])]
  }

  // ---- push to cloud ----
  for (const t of localTags) { if (t) await cloud.addTag(t) }
  for (const d of localDocs) { await cloud.createDocument(d) } // upsert by rel_key

  const existingGroups = await cloud.getGroups()
  const byName = new Map(existingGroups.map((g) => [g.name, g]))
  let playbookCount = 0
  for (const g of localGroups) {
    let cg = byName.get(g.name)
    if (!cg) { cg = await cloud.createGroup(g); playbookCount++ }
    for (const m of g._members || []) {
      await cloud.addMemberByRelKey(cg.id, cloud.relKeyForDoc(m), { phase: m.phase, required: m.required, condition: m.condition, sortOrder: m.sortOrder })
    }
  }
  return { documents: localDocs.length, playbooks: playbookCount, tags: localTags.filter(Boolean).length }
}

// ============================================================
// SMART IMPORT  (file the Claude-built .docx into the vault)
// ============================================================

/** Copy a file into <vault>/<category>/. Returns the new path. */
export async function importFileToVault(src, vaultPath, category, fileName) {
  if (!isTauri()) throw new Error('Importing files is only available in the desktop app.')
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke('import_into_vault', { src, vault: vaultPath, category, fileName })
}

/** Generate a PDF next to a .docx using Word. Returns the new PDF path. */
export async function convertToPdf(src) {
  if (!isTauri()) throw new Error('PDF conversion is only available in the desktop app.')
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke('convert_to_pdf', { src })
}

// ============================================================
// FULL-TEXT INDEX  (search inside document content)
// ------------------------------------------------------------
// Text is extracted from each document's .docx (the PDF is generated from
// the same source, so indexing the Word file covers both) and stored in the
// content_text column, which searchDocuments() searches with LIKE.
// ============================================================

/** Extract plain text from a .docx via the Rust command. */
export async function extractDocxText(docxPath) {
  if (!isTauri() || !docxPath) return ''
  const { invoke } = await import('@tauri-apps/api/core')
  try {
    return await invoke('extract_docx_text', { path: docxPath })
  } catch {
    return ''
  }
}

/** Extract searchable text for a document: prefer the .docx, fall back to PDF. */
async function extractTextForDoc(d) {
  if (!isTauri()) return ''
  const { invoke } = await import('@tauri-apps/api/core')
  try {
    if (d.docxPath) return await invoke('extract_docx_text', { path: d.docxPath })
    if (d.pdfPath) return await invoke('extract_pdf_text', { path: d.pdfPath })
  } catch { /* unreadable file → no content */ }
  return ''
}

/** Store extracted content text for a document. */
export async function setDocumentContent(id, text) {
  if (isTauri()) {
    const db = await getDb()
    await db.execute('UPDATE documents SET content_text=$2 WHERE id=$1', [id, text])
  }
  // Browser mode keeps content only in memory; nothing persisted.
}

/** Documents with a file but no indexed content yet (.docx or PDF-only). */
export async function getUnindexedDocs() {
  if (!isTauri()) return []
  const db = await getDb()
  const rows = await db.select(
    "SELECT id, docx_path, pdf_path FROM documents WHERE content_text = '' AND (docx_path != '' OR pdf_path != '')"
  )
  return rows.map((r) => ({ id: r.id, docxPath: r.docx_path, pdfPath: r.pdf_path }))
}

/** Index a list of {id, docxPath, pdfPath}. Returns how many were indexed. */
export async function indexDocuments(list) {
  if (!isTauri()) return 0
  let count = 0
  for (const d of list) {
    const text = await extractTextForDoc(d)
    if (text) { await setDocumentContent(d.id, text); count++ }
  }
  return count
}

/** Index any documents not yet indexed (called after scans/imports). */
export async function indexMissing() {
  const pending = await getUnindexedDocs()
  return indexDocuments(pending)
}

/** Rebuild the entire content index from scratch (Settings button). */
export async function reindexAll() {
  if (!isTauri()) return 0
  const db = await getDb()
  const rows = await db.select("SELECT id, docx_path, pdf_path FROM documents WHERE docx_path != '' OR pdf_path != ''")
  return indexDocuments(rows.map((r) => ({ id: r.id, docxPath: r.docx_path, pdfPath: r.pdf_path })))
}

// ============================================================
// METADATA BACKUP  (JSON sidecar in the vault folder)
// ------------------------------------------------------------
// Document files live in SharePoint, but the metadata you add in
// DocManager (tags, review dates, version notes, groups, favorites)
// lives only in this machine's local SQLite. Exporting it to the vault
// folder means SharePoint backs it up automatically and it can seed a
// second tech's app. Documents are keyed by file name (not full path)
// so the backup is portable across machines with different sync roots.
// ============================================================

const BACKUP_REL = '.docmanager/metadata.json'

function backupPath(vaultPath) {
  const sep = vaultPath.includes('\\') ? '\\' : '/'
  const trimmed = vaultPath.endsWith(sep) ? vaultPath.slice(0, -1) : vaultPath
  return `${trimmed}${sep}${BACKUP_REL.replace('/', sep)}`
}

/** Build a portable snapshot of all DocManager metadata. */
export async function exportMetadata() {
  const [docs, groups, tags] = await Promise.all([getDocuments(), getGroups(), getTags()])
  const groupsOut = []
  for (const g of groups) {
    const members = await getGroupMembers(g.id)
    groupsOut.push({
      name: g.name,
      description: g.description,
      color: g.color,
      members: members.map((m) => m.fileName),
    })
  }
  return {
    schema: 1,
    exportedAt: new Date().toISOString(),
    documents: docs.map((d) => ({
      fileName: d.fileName,
      category: d.category,
      title: d.title,
      description: d.description,
      status: d.status,
      tags: d.tags,
      version: d.version,
      clientName: d.clientName,
      reviewBy: d.reviewBy,
      versionNotes: d.versionNotes,
      favorite: d.favorite,
      sourceUrl: d.sourceUrl,
      docId: d.docId,
      domain: d.domain,
      audience: d.audience,
    })),
    groups: groupsOut,
    tags,
  }
}

/** Write the metadata snapshot to <vault>/.docmanager/metadata.json. */
export async function writeMetadataBackup(vaultPath) {
  if (!vaultPath) throw new Error('No vault path configured')
  const data = await exportMetadata()
  const json = JSON.stringify(data, null, 2)
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('write_text_file', { path: backupPath(vaultPath), contents: json })
  } else {
    lsSet('docmanager-metadata-backup', data)
  }
  return data
}

/** Read the metadata snapshot from the vault, or null if none exists. */
export async function readMetadataBackup(vaultPath) {
  if (isTauri()) {
    if (!vaultPath) return null
    const { invoke } = await import('@tauri-apps/api/core')
    const json = await invoke('read_text_file', { path: backupPath(vaultPath) })
    if (!json) return null
    try { return JSON.parse(json) } catch { return null }
  }
  return lsGet('docmanager-metadata-backup', null)
}

/**
 * Merge a metadata snapshot into the local library. Documents are matched by
 * file name and only their metadata fields are overlaid (paths are left intact),
 * so this is safe to run after a vault sync on any machine. Missing groups and
 * tags are created. Returns a summary of what was applied.
 */
export async function importMetadata(data) {
  if (!data || !Array.isArray(data.documents)) {
    return { updated: 0, groups: 0, tags: 0 }
  }

  // Tags → master list
  for (const t of data.tags ?? []) await addTag(t)

  // Documents → match by fileName, overlay metadata only
  const localDocs = await getDocuments()
  const byName = new Map(localDocs.map((d) => [d.fileName, d]))
  let updated = 0
  for (const bd of data.documents) {
    const local = byName.get(bd.fileName)
    if (!local) continue
    await updateDocument({
      ...local,
      title: bd.title ?? local.title,
      category: bd.category ?? local.category,
      description: bd.description ?? local.description,
      status: bd.status ?? local.status,
      tags: bd.tags ?? local.tags,
      version: bd.version ?? local.version,
      clientName: bd.clientName ?? local.clientName,
      reviewBy: bd.reviewBy ?? local.reviewBy,
      versionNotes: bd.versionNotes ?? local.versionNotes,
      favorite: bd.favorite ?? local.favorite,
      sourceUrl: bd.sourceUrl ?? local.sourceUrl,
      docId: bd.docId ?? local.docId,
      domain: bd.domain ?? local.domain,
      audience: bd.audience ?? local.audience,
    })
    updated++
  }

  // Groups → upsert by name, relink members by fileName
  const localGroups = await getGroups()
  const groupByName = new Map(localGroups.map((g) => [g.name, g]))
  const refreshed = await getDocuments()
  const docByName = new Map(refreshed.map((d) => [d.fileName, d]))
  let groupsCount = 0
  for (const bg of data.groups ?? []) {
    let g = groupByName.get(bg.name)
    if (!g) {
      g = await createGroup({ name: bg.name, description: bg.description, color: bg.color })
      groupByName.set(bg.name, g)
    }
    for (const fn of bg.members ?? []) {
      const d = docByName.get(fn)
      if (d) await addToGroup(g.id, d.id)
    }
    groupsCount++
  }

  return { updated, groups: groupsCount, tags: (data.tags ?? []).length }
}
