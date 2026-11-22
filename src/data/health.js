// Registry health: where the Doc ID Registry and the library (what's actually
// filed in SharePoint) disagree. Pure — pass in the registry, the documents and
// the set of document ids whose file is missing on this machine.

import { DOC_ID_RE, parseDocId, fileNameFollowsConvention, expectedTypeCode } from './docIds'
import { docIdFromFileName } from './fileMeta'
import { isScript } from './categories'

// Ledger statuses that say "not in DocCenter" — wrong if a document carries the ID.
// (Draft is NOT here: the registry uses it for in-library documents still in development.)
export const NOT_FILED_STATUSES = new Set(['Reserved', 'Unlocated', 'Outside'])

const RESERVATION_STALE_DAYS = 14

/**
 * Returns an array of checks, most serious first:
 *   { key, severity: 'error'|'warning'|'info', title, explain, items: [...] }
 * Each item: { docId, title, detail, docRefId?, fix? }
 *   docRefId — a library document id the UI can open
 *   fix      — { label, kind, docId, status? } a one-click repair the UI can run
 */
export function registryHealth({ registry, docs, missingIds = new Set(), now = new Date() }) {
  const ledger = new Map((registry?.ids ?? []).map((e) => [e.docId, e]))
  const types = new Map((registry?.types ?? []).map((t) => [t.code, t]))
  const domains = new Map((registry?.domains ?? []).map((d) => [d.code, d]))
  const byId = new Map()
  for (const d of docs) {
    if (d.docId) byId.set(d.docId, [...(byId.get(d.docId) ?? []), d])
  }
  const docItem = (d, detail, extra = {}) => ({ docId: d.docId, title: d.title, detail, docRefId: d.id, ...extra })

  const checks = []
  const add = (key, severity, title, explain, items) => { if (items.length) checks.push({ key, severity, title, explain, items }) }

  // ── Errors ──
  add('duplicate', 'error', 'Doc ID used by more than one document',
    'Each Doc ID must belong to exactly one document. Give all but one a new ID (Reserve next), or remove a stray copy from the library.',
    [...byId.entries()].filter(([, ds]) => ds.length > 1).flatMap(([, ds]) =>
      ds.map((d) => docItem(d, `${ds.length} documents · ${d.fileName}`))))

  if (registry) {
    add('retired-in-use', 'error', 'Retired Doc ID still on a live document',
      'Retired IDs are never reused. Archive the document (or Supersede it) — or, if it is genuinely still in use, the retirement was a mistake.',
      docs.filter((d) => d.status !== 'archived' && ledger.get(d.docId)?.status === 'Retired').map((d) => {
        const e = ledger.get(d.docId)
        return docItem(d, `Retired ${e.retiredAt || ''}${e.replacedBy ? ` → ${e.replacedBy}` : ''} · ${d.fileName}`)
      }))
  }

  add('invalid', 'error', 'Doc ID isn’t in TYPE-DOMAIN-NNN form',
    'Correct the Doc ID in the document (and its file).',
    docs.filter((d) => d.docId && !DOC_ID_RE.test(d.docId)).map((d) => docItem(d, d.fileName)))

  if (registry) {
    add('unknown-code', 'error', 'Doc ID uses an unregistered or retired code',
      'Register the code in Type Codes / Domain Codes, or correct the Doc ID.',
      docs.filter((d) => {
        const p = parseDocId(d.docId)
        return p && !ledger.has(d.docId) && (!types.get(p.type)?.active || !domains.get(p.domain)?.active)
      }).map((d) => {
        const p = parseDocId(d.docId)
        const bad = [!types.get(p.type)?.active && `type ${p.type}`, !domains.get(p.domain)?.active && `domain ${p.domain}`].filter(Boolean)
        return docItem(d, `Unregistered ${bad.join(' and ')} · ${d.fileName}`)
      }))
  }

  add('file-missing', 'error', 'File not found on this machine',
    'The library has a record but the file isn’t at its path in this machine’s synced folder. It may have been moved, renamed or deleted — or SharePoint hasn’t finished syncing here.',
    docs.filter((d) => missingIds.has(d.id)).map((d) => docItem(d, d.relKey || d.filePath)))

  // ── Warnings ──
  if (registry) {
    add('not-in-ledger', 'warning', 'Doc ID not in the registry',
      'The document carries a valid ID the registry has never recorded. Add it, so the number can’t be issued to something else.',
      docs.filter((d) => {
        const p = parseDocId(d.docId)
        return p && !ledger.has(d.docId) && types.get(p.type)?.active && domains.get(p.domain)?.active
      }).map((d) => docItem(d, d.fileName, { fix: { label: 'Add to registry', kind: 'record', docId: d.docId, title: d.title } })))

    add('ledger-no-document', 'warning', 'Registry says Filed, but no document has the ID',
      'The ledger records the ID as filed in DocCenter, but no library document carries it. Find the file, or mark the entry Unlocated.',
      registry.ids.filter((e) => e.status === 'Filed' && !byId.has(e.docId))
        .map((e) => ({ docId: e.docId, title: e.title, detail: e.notes, fix: { label: 'Mark Unlocated', kind: 'status', docId: e.docId, status: 'Unlocated' } })))

    add('ledger-status-stale', 'warning', 'Registry says not filed, but a document has the ID',
      'The ledger still records the ID as Reserved, Unlocated or Outside, but it is in the library now.',
      registry.ids.filter((e) => NOT_FILED_STATUSES.has(e.status) && byId.has(e.docId))
        .map((e) => ({ docId: e.docId, title: e.title, detail: `Registry status: ${e.status}`, docRefId: byId.get(e.docId)[0].id,
          fix: { label: 'Mark Filed', kind: 'status', docId: e.docId, status: 'Filed' } })))
  }

  add('name-id-mismatch', 'warning', 'Filename and Doc ID disagree',
    'The ID at the start of the filename differs from the document’s Doc ID. One of them is wrong.',
    docs.filter((d) => {
      const fromName = docIdFromFileName(d.fileName)
      return fromName && d.docId && fromName !== d.docId
    }).map((d) => docItem(d, `Filename says ${docIdFromFileName(d.fileName)} · ${d.fileName}`)))

  add('wrong-folder', 'warning', 'Document is in another type’s folder',
    'The Doc ID’s type code doesn’t match the folder it’s filed in. Move the file, or reclassify the document.',
    docs.filter((d) => {
      const p = parseDocId(d.docId)
      const expected = expectedTypeCode(d, registry)
      return p && expected && expected !== p.type
    }).map((d) => docItem(d, `${parseDocId(d.docId).type} in ${d.category} (holds ${expectedTypeCode(d, registry)})`)))

  // ── Info ──
  add('bad-filename', 'info', 'Filename doesn’t follow DOC-ID_Title_With_Underscores',
    'Rename when the document is next rebuilt. DocCenter keeps the record across the rename.',
    docs.filter((d) => DOC_ID_RE.test(d.docId ?? '') && !fileNameFollowsConvention(d.fileName, d.docId, isScript(d.fileType)))
      .map((d) => docItem(d, d.fileName)))

  if (registry) {
    const cutoff = now.getTime() - RESERVATION_STALE_DAYS * 86400000
    add('stale-reservation', 'info', `Reserved more than ${RESERVATION_STALE_DAYS} days ago and never used`,
      'Release the number if the document isn’t coming, so the series stays tidy.',
      registry.ids.filter((e) => e.status === 'Reserved' && !byId.has(e.docId) && new Date(e.issuedAt).getTime() < cutoff)
        .map((e) => ({ docId: e.docId, title: e.title, detail: `Reserved ${String(e.issuedAt).slice(0, 10)}${e.issuedBy ? ` by ${e.issuedBy}` : ''}` })))
  }

  add('no-doc-id', 'info', 'Document has no Doc ID',
    'Fine for uncontrolled files; controlled documents should get one (Reserve next).',
    docs.filter((d) => !d.docId).map((d) => ({ docId: '', title: d.title, detail: `${d.category} · ${d.fileName}`, docRefId: d.id })))

  const order = { error: 0, warning: 1, info: 2 }
  return checks.sort((a, b) => order[a.severity] - order[b.severity])
}

/** Totals by severity, for badges. */
export function healthCounts(checks) {
  const c = { error: 0, warning: 0, info: 0 }
  for (const k of checks) c[k.severity] += k.items.length
  return c
}
