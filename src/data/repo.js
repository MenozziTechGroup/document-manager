import { getDb, isTauri, lsGet, lsSet, rowToDoc, rowToGroup } from './db'

const LS_DOCS = 'docmanager-docs-v1'
const LS_GROUPS = 'docmanager-groups-v1'
const LS_MEMBERS = 'docmanager-members-v1'
const LS_TAGS = 'docmanager-tags-v1'
const LS_SETTINGS = 'docmanager-settings-v1'

const uid = () => crypto.randomUUID()

// ============================================================
// DOCUMENTS
// ============================================================

export async function getDocuments() {
  if (isTauri()) {
    const db = await getDb()
    const rows = await db.select('SELECT * FROM documents ORDER BY title ASC')
    return rows.map(rowToDoc)
  }
  return lsGet(LS_DOCS, [])
}

export async function getDocumentsByCategory(category) {
  if (isTauri()) {
    const db = await getDb()
    const rows = await db.select(
      'SELECT * FROM documents WHERE category=$1 ORDER BY title ASC',
      [category]
    )
    return rows.map(rowToDoc)
  }
  return lsGet(LS_DOCS, []).filter((d) => d.category === category)
}

export async function searchDocuments(query) {
  const q = `%${query}%`
  if (isTauri()) {
    const db = await getDb()
    const rows = await db.select(
      `SELECT * FROM documents
       WHERE title LIKE $1 OR description LIKE $1 OR client_name LIKE $1 OR tags LIKE $1
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
    d.tags.some((t) => t.toLowerCase().includes(lower))
  )
}

export async function createDocument(doc) {
  const record = { ...doc, id: doc.id ?? uid() }
  if (isTauri()) {
    const db = await getDb()
    await db.execute(
      `INSERT OR IGNORE INTO documents
       (id, title, category, file_path, file_name, file_type, description, status, tags, version, client_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        record.id, record.title, record.category, record.filePath, record.fileName,
        record.fileType, record.description ?? '', record.status ?? 'active',
        JSON.stringify(record.tags ?? []), record.version ?? '', record.clientName ?? '',
      ]
    )
  } else {
    const all = lsGet(LS_DOCS, [])
    if (!all.find((d) => d.filePath === record.filePath)) {
      lsSet(LS_DOCS, [...all, record])
    }
  }
  return record
}

export async function updateDocument(doc) {
  if (isTauri()) {
    const db = await getDb()
    await db.execute(
      `UPDATE documents SET
        title=$2, category=$3, file_path=$4, file_name=$5, file_type=$6,
        description=$7, status=$8, tags=$9, version=$10, client_name=$11,
        updated_at=datetime('now')
       WHERE id=$1`,
      [
        doc.id, doc.title, doc.category, doc.filePath, doc.fileName, doc.fileType,
        doc.description ?? '', doc.status ?? 'active', JSON.stringify(doc.tags ?? []),
        doc.version ?? '', doc.clientName ?? '',
      ]
    )
  } else {
    const all = lsGet(LS_DOCS, [])
    lsSet(LS_DOCS, all.map((d) => (d.id === doc.id ? doc : d)))
  }
  return doc
}

export async function deleteDocument(id) {
  if (isTauri()) {
    const db = await getDb()
    await db.execute('DELETE FROM group_members WHERE document_id=$1', [id])
    await db.execute('DELETE FROM documents WHERE id=$1', [id])
  } else {
    lsSet(LS_DOCS, lsGet(LS_DOCS, []).filter((d) => d.id !== id))
    lsSet(LS_MEMBERS, lsGet(LS_MEMBERS, []).filter((m) => m.documentId !== id))
  }
}

// ============================================================
// DOCUMENT GROUPS
// ============================================================

export async function getGroups() {
  if (isTauri()) {
    const db = await getDb()
    const rows = await db.select('SELECT * FROM document_groups ORDER BY name ASC')
    return rows.map(rowToGroup)
  }
  return lsGet(LS_GROUPS, [])
}

export async function createGroup(group) {
  const record = { ...group, id: group.id ?? uid() }
  if (isTauri()) {
    const db = await getDb()
    await db.execute(
      'INSERT INTO document_groups (id, name, description, color) VALUES ($1,$2,$3,$4)',
      [record.id, record.name, record.description ?? '', record.color ?? '#e1251b']
    )
  } else {
    const all = lsGet(LS_GROUPS, [])
    lsSet(LS_GROUPS, [...all, record])
  }
  return record
}

export async function updateGroup(group) {
  if (isTauri()) {
    const db = await getDb()
    await db.execute(
      'UPDATE document_groups SET name=$2, description=$3, color=$4 WHERE id=$1',
      [group.id, group.name, group.description ?? '', group.color ?? '#e1251b']
    )
  } else {
    const all = lsGet(LS_GROUPS, [])
    lsSet(LS_GROUPS, all.map((g) => (g.id === group.id ? group : g)))
  }
  return group
}

export async function deleteGroup(id) {
  if (isTauri()) {
    const db = await getDb()
    await db.execute('DELETE FROM group_members WHERE group_id=$1', [id])
    await db.execute('DELETE FROM document_groups WHERE id=$1', [id])
  } else {
    lsSet(LS_GROUPS, lsGet(LS_GROUPS, []).filter((g) => g.id !== id))
    lsSet(LS_MEMBERS, lsGet(LS_MEMBERS, []).filter((m) => m.groupId !== id))
  }
}

// ============================================================
// GROUP MEMBERS
// ============================================================

export async function getGroupMembers(groupId) {
  if (isTauri()) {
    const db = await getDb()
    const rows = await db.select(
      `SELECT d.* FROM documents d
       JOIN group_members gm ON gm.document_id = d.id
       WHERE gm.group_id=$1
       ORDER BY gm.sort_order ASC, d.title ASC`,
      [groupId]
    )
    return rows.map(rowToDoc)
  }
  const members = lsGet(LS_MEMBERS, []).filter((m) => m.groupId === groupId)
  const docs = lsGet(LS_DOCS, [])
  return members.map((m) => docs.find((d) => d.id === m.documentId)).filter(Boolean)
}

export async function addToGroup(groupId, documentId) {
  if (isTauri()) {
    const db = await getDb()
    await db.execute(
      'INSERT OR IGNORE INTO group_members (id, group_id, document_id) VALUES ($1,$2,$3)',
      [uid(), groupId, documentId]
    )
  } else {
    const all = lsGet(LS_MEMBERS, [])
    if (!all.find((m) => m.groupId === groupId && m.documentId === documentId)) {
      lsSet(LS_MEMBERS, [...all, { id: uid(), groupId, documentId }])
    }
  }
}

export async function removeFromGroup(groupId, documentId) {
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
// TAGS
// ============================================================

export async function getTags() {
  if (isTauri()) {
    const db = await getDb()
    const rows = await db.select('SELECT name FROM tags ORDER BY name ASC')
    return rows.map((r) => r.name)
  }
  return lsGet(LS_TAGS, [])
}

export async function addTag(name) {
  if (isTauri()) {
    const db = await getDb()
    await db.execute('INSERT OR IGNORE INTO tags (id, name) VALUES ($1,$2)', [uid(), name])
  } else {
    const all = lsGet(LS_TAGS, [])
    if (!all.includes(name)) lsSet(LS_TAGS, [...all, name])
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
