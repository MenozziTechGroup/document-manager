// Excel export: the live document inventory plus, when signed in, the whole
// Doc ID Registry and its health report — one workbook IDX-IT-001 and audits
// can be built from. exceljs is loaded only when an export runs.

import { getDocuments, findMissingDocIds } from './repo'
import { getRegistry } from './registry'
import { registryHealth } from './health'
import { parseDocId, typeCodeForCategory } from './docIds'
import { DOMAIN_MAP, STATUS_MAP, todayLocal } from './categories'
import { isTauri } from './db'

const HEADER_FILL = 'FFE1251B' // MITS red
const BAND_FILL = 'FFF7F7F7'

function addSheet(wb, name, columns, rows) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 16 }))
  for (const r of rows) ws.addRow(r)
  const header = ws.getRow(1)
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
  header.alignment = { vertical: 'middle' }
  header.height = 20
  ws.eachRow((row, i) => {
    if (i > 1 && i % 2 === 1) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND_FILL } }
    if (i > 1) row.alignment = { vertical: 'top', wrapText: true }
  })
  if (rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }
  return ws
}

/** Build the workbook. Returns an ArrayBuffer (.xlsx). */
export async function buildWorkbook({ docs, registry, missingIds = new Set() }) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'MITS DocCenter'
  wb.created = new Date()

  const ledger = new Map((registry?.ids ?? []).map((e) => [e.docId, e]))
  // Documents with a Doc ID first, in ID order; the rest after, by title
  const sorted = [...docs].sort((a, b) =>
    (!a.docId - !b.docId) || (a.docId ?? '').localeCompare(b.docId ?? '') || a.title.localeCompare(b.title))

  // ── Inventory: every document in the library ──
  addSheet(wb, 'Inventory', [
    { header: 'Doc ID', key: 'docId', width: 15 },
    { header: 'Title', key: 'title', width: 46 },
    { header: 'Type', key: 'type', width: 7 },
    { header: 'Folder', key: 'category', width: 15 },
    { header: 'Domain', key: 'domain', width: 9 },
    { header: 'Status', key: 'status', width: 10 },
    { header: 'Version', key: 'version', width: 9 },
    { header: 'Effective Date', key: 'effectiveDate', width: 15 },
    { header: 'Audience', key: 'audience', width: 12 },
    { header: 'Client', key: 'client', width: 16 },
    { header: 'Review By', key: 'reviewBy', width: 12 },
    { header: 'Registry Status', key: 'registry', width: 14 },
    { header: 'File Name', key: 'fileName', width: 50 },
    { header: 'Path in Library', key: 'path', width: 56 },
    { header: 'PDF', key: 'pdf', width: 6 },
    { header: 'File Found', key: 'found', width: 10 },
    { header: 'Tags', key: 'tags', width: 24 },
    { header: 'Last Updated', key: 'updated', width: 12 },
  ], sorted.map((d) => {
    const p = parseDocId(d.docId)
    return {
      docId: d.docId,
      title: d.title,
      type: p?.type ?? typeCodeForCategory(d.category, registry) ?? '',
      category: d.category,
      domain: d.domain || p?.domain || '',
      status: STATUS_MAP[d.status]?.label ?? d.status,
      version: d.version,
      effectiveDate: d.effectiveDate,
      audience: d.audience === 'Client' ? 'Client-facing' : 'Internal',
      client: d.clientName,
      reviewBy: d.reviewBy,
      registry: d.docId ? (ledger.get(d.docId)?.status ?? (registry ? 'Not registered' : '')) : '',
      fileName: d.fileName,
      path: d.relKey ? `${d.relKey}${d.fileName ? d.fileName.slice(d.fileName.lastIndexOf('.')) : ''}` : d.filePath,
      pdf: d.pdfPath ? 'Yes' : 'No',
      found: missingIds.has(d.id) ? 'Missing' : isTauri() ? 'Yes' : '',
      tags: (d.tags ?? []).join('; '),
      updated: (d.updatedAt ?? '').slice(0, 10),
    }
  }))

  if (registry) {
    const inLibrary = new Set(docs.map((d) => d.docId).filter(Boolean))
    addSheet(wb, 'ID Ledger', [
      { header: 'Doc ID', key: 'docId', width: 15 },
      { header: 'Title', key: 'title', width: 50 },
      { header: 'Status', key: 'status', width: 11 },
      { header: 'In DocCenter', key: 'inLib', width: 12 },
      { header: 'Notes', key: 'notes', width: 70 },
      { header: 'Issued', key: 'issued', width: 12 },
      { header: 'Issued By', key: 'by', width: 22 },
    ], registry.ids.filter((e) => e.status !== 'Retired').map((e) => ({
      docId: e.docId, title: e.title, status: e.status, inLib: inLibrary.has(e.docId) ? 'Yes' : '',
      notes: e.notes, issued: String(e.issuedAt ?? '').slice(0, 10), by: e.issuedBy,
    })))

    addSheet(wb, 'Next Available', [
      { header: 'Series', key: 'series', width: 12 },
      { header: 'Issued Numbers', key: 'issued', width: 50 },
      { header: 'Next Available ID', key: 'next', width: 18 },
    ], registry.series.map((s) => ({
      series: s.series, issued: s.issued.map((n) => String(n).padStart(3, '0')).join(', '), next: s.nextAvailable || 'retired code',
    })))

    addSheet(wb, 'Retired IDs', [
      { header: 'Retired ID', key: 'docId', width: 15 },
      { header: 'Retired', key: 'date', width: 12 },
      { header: 'Replaced By', key: 'by', width: 15 },
      { header: 'Reason', key: 'reason', width: 80 },
    ], registry.ids.filter((e) => e.status === 'Retired').map((e) => ({
      docId: e.docId, date: e.retiredAt, by: e.replacedBy, reason: e.retireReason,
    })))

    addSheet(wb, 'Type Codes', [
      { header: 'Code', key: 'code', width: 8 },
      { header: 'Type', key: 'name', width: 30 },
      { header: 'Use', key: 'use', width: 44 },
      { header: 'DocCenter Folder', key: 'folder', width: 20 },
      { header: 'Active', key: 'active', width: 8 },
    ], registry.types.map((t) => ({ ...t, active: t.active ? 'Yes' : 'Retired' })))

    addSheet(wb, 'Domain Codes', [
      { header: 'Code', key: 'code', width: 8 },
      { header: 'Domain', key: 'name', width: 60 },
      { header: 'Note', key: 'note', width: 50 },
      { header: 'Active', key: 'active', width: 8 },
    ], registry.domains.map((d) => ({ ...d, name: d.name || DOMAIN_MAP[d.code]?.label || '', active: d.active ? 'Yes' : 'Retired' })))

    addSheet(wb, 'Open Issues', [
      { header: 'Issue', key: 'issue', width: 36 },
      { header: 'Detail', key: 'detail', width: 70 },
      { header: 'Proposed Resolution', key: 'proposedResolution', width: 50 },
    ], registry.issues.filter((i) => i.status === 'open'))

    addSheet(wb, 'Folder Map', [
      { header: 'Folder', key: 'path', width: 50 },
      { header: 'Contents', key: 'contents', width: 44 },
      { header: 'Source', key: 'source', width: 26 },
    ], registry.folders)
  }

  // ── Health: where the registry and the library disagree ──
  const checks = registryHealth({ registry, docs, missingIds })
  addSheet(wb, 'Health', [
    { header: 'Severity', key: 'severity', width: 10 },
    { header: 'Check', key: 'check', width: 46 },
    { header: 'Doc ID', key: 'docId', width: 15 },
    { header: 'Title', key: 'title', width: 44 },
    { header: 'Detail', key: 'detail', width: 70 },
  ], checks.flatMap((c) => c.items.map((i) => ({
    severity: c.severity[0].toUpperCase() + c.severity.slice(1), check: c.title, docId: i.docId, title: i.title, detail: i.detail,
  }))))

  return wb.xlsx.writeBuffer()
}

/**
 * Gather everything, build the workbook and save it (desktop: Save dialog;
 * browser: download). Returns the saved path, or '' if cancelled.
 */
export async function exportWorkbook({ vaultPath } = {}) {
  const docs = await getDocuments()
  const [registry, missingIds] = await Promise.all([
    getRegistry().catch(() => null),
    findMissingDocIds(docs).catch(() => new Set()),
  ])
  const buffer = await buildWorkbook({ docs, registry, missingIds })
  const stamp = todayLocal()
  const fileName = `MITS_DocCenter_Inventory_${stamp}.xlsx`
  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const sep = (vaultPath ?? '').includes('\\') ? '\\' : '/'
    const path = await save({
      defaultPath: vaultPath ? `${vaultPath.replace(/[\\/]$/, '')}${sep}${fileName}` : fileName,
      filters: [{ name: 'Excel workbook', extensions: ['xlsx'] }],
    })
    if (!path) return ''
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('write_binary_file', { path, contents: Array.from(new Uint8Array(buffer)) })
    return path
  }
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  Object.assign(document.createElement('a'), { href: url, download: fileName }).click()
  URL.revokeObjectURL(url)
  return fileName
}
