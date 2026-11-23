// Doc ID Registry (Supabase). DocCenter is the master copy of the registry that
// IDX-IT-001 prints: type codes, domain codes, the ledger of every ID issued,
// retired IDs, open registry issues and the SharePoint folder map.
//
// Cloud-only: when not signed in there is no registry, and callers fall back
// to the built-in lists. See supabase/migrations/20261123_doc_id_registry.sql.
import { supabase, currentEmail } from './supabase'
import { DOC_ID_RE, parseDocId } from './docIds'
import { NOT_FILED_STATUSES } from './health'
import { todayLocal } from './categories'

export const ID_STATUSES = ['Reserved', 'Draft', 'Filed', 'Outside', 'Unlocated', 'Tool', 'Retired']


async function q(promise) {
  const { data, error } = await promise
  if (error) throw error
  return data ?? []
}

const mapType = (r) => ({ code: r.code, name: r.name, use: r.use, folder: r.folder, active: r.active, sortOrder: r.sort_order })
const mapDomain = (r) => ({ code: r.code, name: r.name, note: r.note, active: r.active, sortOrder: r.sort_order, addedAt: r.added_at, addedBy: r.added_by })
const mapId = (r) => ({
  docId: r.doc_id, typeCode: r.type_code, domainCode: r.domain_code, seq: r.seq,
  title: r.title, status: r.status, notes: r.notes, issuedAt: r.issued_at, issuedBy: r.issued_by,
  retiredAt: r.retired_at ?? '', replacedBy: r.replaced_by, retireReason: r.retire_reason,
})
const mapIssue = (r) => ({
  id: r.id, issue: r.issue, detail: r.detail, proposedResolution: r.proposed_resolution,
  status: r.status, createdAt: r.created_at, resolvedAt: r.resolved_at ?? '', resolution: r.resolution,
})
const mapFolder = (r) => ({ path: r.path, contents: r.contents, source: r.source, sortOrder: r.sort_order })
const mapSeries = (r) => ({ series: r.series, typeCode: r.type_code, domainCode: r.domain_code, issued: r.issued ?? [], nextAvailable: r.next_available ?? '' })

/** Everything in the registry, or null if the tables don't exist yet / not signed in. */
export async function getRegistry() {
  if (!supabase) return null
  try {
    const [types, domains, ids, issues, folders, series] = await Promise.all([
      q(supabase.from('doc_types').select('*').order('sort_order').order('code')),
      q(supabase.from('doc_domains').select('*').order('sort_order').order('code')),
      q(supabase.from('doc_ids').select('*').order('doc_id')),
      q(supabase.from('registry_issues').select('*').order('created_at')),
      q(supabase.from('registry_folders').select('*').order('sort_order')),
      q(supabase.from('doc_series').select('*').order('series')),
    ])
    return {
      types: types.map(mapType), domains: domains.map(mapDomain), ids: ids.map(mapId),
      issues: issues.map(mapIssue), folders: folders.map(mapFolder), series: series.map(mapSeries),
    }
  } catch (err) {
    // 42P01 = table missing: the registry migration hasn't been run
    if (err?.code === '42P01' || /does not exist/i.test(err?.message ?? '')) return null
    throw err
  }
}

// ── Allocation and use ────────────────────────────────────────────

/** Reserve the next ID in a series (atomic in the database). */
export async function allocateDocId(typeCode, domainCode, title = '') {
  const { data, error } = await supabase.rpc('allocate_doc_id', { p_type: typeCode, p_domain: domainCode, p_title: title })
  if (error) throw error
  return data
}

/**
 * Record that a document carrying this ID was saved in DocCenter: a Reserved /
 * Unlocated / Outside entry becomes Filed; an ID not in the ledger is added as
 * Filed. Draft (in the library, still in development), Tool and Retired entries
 * are left alone.
 */
export async function recordDocIdUse(docId, title) {
  const p = parseDocId(docId)
  if (!p) return
  const { data: rows } = await supabase.from('doc_ids').select('status, title').eq('doc_id', docId)
  const row = rows?.[0]
  if (!row) {
    await q(supabase.from('doc_ids').insert({
      doc_id: docId, type_code: p.type, domain_code: p.domain, seq: p.seq,
      title: title ?? '', status: 'Filed', issued_by: currentEmail(),
    }))
  } else if (NOT_FILED_STATUSES.has(row.status)) {
    await q(supabase.from('doc_ids').update({ status: 'Filed', title: row.title || title || '' }).eq('doc_id', docId))
  }
}

/** Retire an ID permanently. */
export async function retireDocId(docId, { replacedBy = '', reason = '', date = null } = {}) {
  await q(supabase.from('doc_ids').update({
    status: 'Retired',
    retired_at: date || todayLocal(),
    replaced_by: replacedBy,
    retire_reason: reason,
  }).eq('doc_id', docId))
}

/** Give back a Reserved ID that was never used. Anything else stays forever. */
export async function releaseReservedId(docId) {
  await q(supabase.from('doc_ids').delete().eq('doc_id', docId).eq('status', 'Reserved'))
}

export async function updateIdEntry(docId, { title, status, notes }) {
  const row = {}
  if (title !== undefined) row.title = title
  if (status !== undefined) row.status = status
  if (notes !== undefined) row.notes = notes
  await q(supabase.from('doc_ids').update(row).eq('doc_id', docId))
}

// ── Codes, issues, folders ────────────────────────────────────────

export async function saveDomain({ code, name, note = '', active = true }) {
  await q(supabase.from('doc_domains').upsert(
    { code, name, note, active, added_by: currentEmail() },
    { onConflict: 'code' },
  ))
}

export async function saveType({ code, name, use = '', folder = '', active = true }) {
  await q(supabase.from('doc_types').upsert({ code, name, use, folder, active }, { onConflict: 'code' }))
}

export async function addIssue({ issue, detail = '', proposedResolution = '' }) {
  await q(supabase.from('registry_issues').insert({ issue, detail, proposed_resolution: proposedResolution }))
}

export async function resolveIssue(id, resolution = '') {
  await q(supabase.from('registry_issues')
    .update({ status: 'resolved', resolved_at: new Date().toISOString(), resolution })
    .eq('id', id))
}

// ── Import from IDX-IT-001_Registry.json ──────────────────────────

/**
 * Merge an IDX-IT-001_Registry.json into the registry. Adds and updates; never
 * deletes. Codes that IDs use but the file doesn't list (e.g. ABM, retired)
 * are created as retired codes so the ledger stays consistent. Finally every
 * library document whose Doc ID isn't in the ledger is added as Filed.
 * Returns counts of what was written.
 */
export async function importRegistryJson(json, docs = []) {
  if (!json || !Array.isArray(json.typeCodes) || !Array.isArray(json.ids)) {
    throw new Error('This doesn’t look like an IDX-IT-001 registry file.')
  }
  const types = new Map(json.typeCodes.map((t, i) => [t.code, {
    code: t.code, name: t.type ?? '', use: t.use ?? '', folder: t.folder ?? '', active: true, sort_order: i,
  }]))
  const domains = new Map((json.domainCodes ?? []).map((d, i) => [d.code, {
    code: d.code, name: d.domain ?? '', note: d.note ?? '', active: true, sort_order: i, added_by: currentEmail(),
  }]))

  const idRows = new Map()
  const put = (docId, fields) => {
    const p = parseDocId(docId)
    if (!p) return
    if (!types.has(p.type)) types.set(p.type, { code: p.type, name: '', use: '', folder: '', active: false, sort_order: 900 })
    if (!domains.has(p.domain)) {
      domains.set(p.domain, { code: p.domain, name: '', note: 'Retired — used by IDs in the ledger, not in the registry’s domain list', active: false, sort_order: 900, added_by: currentEmail() })
    }
    idRows.set(docId, { doc_id: docId, type_code: p.type, domain_code: p.domain, seq: p.seq, ...idRows.get(docId), ...fields })
  }
  for (const e of json.ids) put(e.docId, { title: e.title ?? '', status: e.status || 'Filed', notes: e.notes ?? '' })
  for (const r of json.retired ?? []) {
    put(r.docId, {
      status: 'Retired', retired_at: r.retired || null, replaced_by: DOC_ID_RE.test(r.replacedBy ?? '') ? r.replacedBy : '', retire_reason: r.reason ?? '',
      title: idRows.get(r.docId)?.title ?? '',
    })
  }

  // Library documents not in the file at all → Filed, but only when both codes
  // are known; a typo'd code shouldn't invent a domain (those are reported back)
  let fromLibrary = 0
  const skipped = []
  for (const d of docs) {
    if (!DOC_ID_RE.test(d.docId ?? '') || idRows.has(d.docId)) continue
    const p = parseDocId(d.docId)
    if (!types.has(p.type) || !domains.has(p.domain)) { skipped.push(d.docId); continue }
    put(d.docId, { title: d.title ?? '', status: 'Filed', notes: 'Added from the DocCenter library on import' })
    fromLibrary++
  }
  // Every row needs the full column set for a bulk upsert
  const rows = [...idRows.values()].map((r) => ({
    title: '', status: 'Filed', notes: '', retired_at: null, replaced_by: '', retire_reason: '', ...r,
  }))

  await q(supabase.from('doc_types').upsert([...types.values()], { onConflict: 'code' }))
  await q(supabase.from('doc_domains').upsert([...domains.values()], { onConflict: 'code' }))
  await q(supabase.from('doc_ids').upsert(rows, { onConflict: 'doc_id' }))

  const folders = (json.folders ?? []).map((f, i) => ({ path: f.path, contents: f.contents ?? '', source: f.source ?? '', sort_order: i }))
  if (folders.length) await q(supabase.from('registry_folders').upsert(folders, { onConflict: 'path' }))

  // Issues have no natural key — add only those whose title isn't already there
  const existing = new Set((await q(supabase.from('registry_issues').select('issue'))).map((r) => r.issue))
  const newIssues = (json.openIssues ?? [])
    .filter((i) => i.issue && !existing.has(i.issue))
    .map((i) => ({ issue: i.issue, detail: i.detail ?? '', proposed_resolution: i.proposedResolution ?? '' }))
  if (newIssues.length) await q(supabase.from('registry_issues').insert(newIssues))

  return {
    types: types.size, domains: domains.size, ids: rows.length,
    retired: rows.filter((r) => r.status === 'Retired').length,
    fromLibrary, skipped: [...new Set(skipped)], issues: newIssues.length, folders: folders.length,
  }
}

// ── Export (same shape as IDX-IT-001_Registry.json) ───────────────

/**
 * The registry as an IDX-IT-001_Registry.json the IDX-IT-001 script can read.
 * A Reserved / Unlocated / Outside entry is exported as Filed when a library
 * document carries its ID; Draft, Tool and Filed are exported as recorded.
 */
export function buildRegistryJson(registry, docs = []) {
  const inLibrary = new Set(docs.map((d) => d.docId).filter(Boolean))
  const live = registry.ids.filter((e) => e.status !== 'Retired')
  return {
    docId: 'IDX-IT-001',
    source: 'MITS DocCenter',
    generated: todayLocal(),
    typeCodes: registry.types.filter((t) => t.active)
      .map((t) => ({ code: t.code, type: t.name, use: t.use, folder: t.folder })),
    domainCodes: registry.domains.filter((d) => d.active)
      .map((d) => ({ code: d.code, domain: d.name, note: d.note || null })),
    ids: live.map((e) => ({
      docId: e.docId,
      title: e.title,
      status: NOT_FILED_STATUSES.has(e.status) && inLibrary.has(e.docId) ? 'Filed' : e.status,
      notes: e.notes || null,
    })),
    retired: registry.ids.filter((e) => e.status === 'Retired')
      .map((e) => ({ docId: e.docId, retired: e.retiredAt || null, replacedBy: e.replacedBy, reason: e.retireReason })),
    series: registry.series.filter((s) => s.nextAvailable)
      .map((s) => ({ series: s.series, issued: s.issued.map((n) => String(n).padStart(3, '0')), nextAvailable: s.nextAvailable })),
    openIssues: registry.issues.filter((i) => i.status === 'open')
      .map((i) => ({ issue: i.issue, detail: i.detail, proposedResolution: i.proposedResolution })),
    folders: registry.folders.map((f) => ({ path: f.path, contents: f.contents, source: f.source })),
  }
}

/** Realtime: cb() whenever the ledger or domain codes change. */
export function subscribeRegistry(cb) {
  if (!supabase) return () => {}
  const ch = supabase.channel('doccenter-registry')
  ;['doc_ids', 'doc_domains'].forEach((t) =>
    ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => cb(t))
  )
  ch.subscribe()
  return () => supabase.removeChannel(ch)
}
