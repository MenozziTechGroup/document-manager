// Reading document-control metadata (Doc ID, version, effective date, status)
// out of the files themselves. DocBuilder stamps .docx files with custom
// properties (DocID, DocVersion, DocStatus) and a cover table; scripts carry a
// "# Version:" / "# Updated:" header block. Filed documents are generated from
// source, so for these four fields the FILE is the record and DocCenter mirrors it.
//
// Pure functions only — the Tauri calls that fetch props/text live in repo.js.

const DOC_ID_RE = /^[A-Z]{2,4}-[A-Z0-9]{2,5}-\d{3}$/
const VERSION_RE = /^\d+(\.\d+)*$/

/** Doc ID at the start of a filename, e.g. "SOP-DNS-001_DNSFilter.docx" → "SOP-DNS-001". */
export function docIdFromFileName(fileName) {
  const m = (fileName ?? '').match(/^([A-Z]{2,4}-[A-Z0-9]{2,5}-\d{3})(?=[_.\s-]|$)/)
  return m ? m[1] : ''
}

/** Version suffix in a filename, e.g. "..._v1.2.docx" → "1.2". */
function versionFromFileName(fileName) {
  const m = (fileName ?? '').replace(/\.[^.]+$/, '').match(/[_\s-]v(\d+(?:\.\d+)*)$/i)
  return m ? m[1] : ''
}

const COVER_LABELS = ['Document ID', 'Version', 'Effective Date', 'Author', 'Category', 'Subcategory', 'Applies To', 'Platform']

/**
 * Reads label/value pairs from a DocBuilder cover table in extracted text.
 * In .docx text each cell is its own line ("Version" then "1.1.0"); PDF text
 * may put both on one line ("Version 1.1.0"). Only the top of the document is
 * searched so headings further down ("Version History") can't match.
 */
export function parseCoverText(text) {
  const lines = (text ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 60)
  const isLabel = (l) => COVER_LABELS.some((lab) => l.toLowerCase() === lab.toLowerCase())
  const find = (label) => {
    const lower = label.toLowerCase()
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      if (l.toLowerCase() === lower) {
        const next = lines[i + 1]
        return next && !isLabel(next) ? next : ''
      }
      // "Version 1.1.0" (PDF text) or "Doc ID: SOP-NET-001" (hand-built covers)
      if (l.toLowerCase().startsWith(lower + ' ') || l.toLowerCase().startsWith(lower + ':')) {
        return l.slice(label.length).replace(/^:/, '').trim()
      }
    }
    return ''
  }
  const docId = find('Document ID') || find('Doc ID')
  const version = find('Version')
  return {
    docId: DOC_ID_RE.test(docId) ? docId : '',
    version: VERSION_RE.test(version) ? version : '',
    effectiveDate: find('Effective Date'),
  }
}

/** Reads the "# Version: / # Updated:" header block at the top of a script. */
export function parseScriptHeader(text) {
  const head = (text ?? '').split(/\r?\n/).slice(0, 40).join('\n')
  const field = (name) => {
    const m = head.match(new RegExp(`^\\s*(?:#|//|::|REM)\\s*${name}:\\s*(.+?)\\s*$`, 'im'))
    return m ? m[1] : ''
  }
  const version = field('Version')
  return {
    docId: docIdFromFileName(field('Script')),
    version: VERSION_RE.test(version) ? version : '',
    effectiveDate: field('Updated'),
  }
}

/** Maps a file's DocStatus onto DocCenter's library status. */
export function statusFromFile(docStatus) {
  const s = (docStatus ?? '').trim().toLowerCase()
  if (!s) return ''
  if (s === 'approved') return 'active'
  return 'draft' // Draft, Pending approval, In review, …
}

/**
 * Combines everything a file says about itself into one record. Each field
 * takes the most authoritative source available: document properties, then
 * the cover table / script header, then the filename.
 *   props: { props: {DocID, DocVersion, DocStatus, EffectiveDate?}, title } from read_docx_props (or null)
 *   text:  extracted document text or script source (or '')
 */
export function buildFileMeta({ fileName, props, text, script }) {
  const p = props?.props ?? {}
  const body = script ? parseScriptHeader(text) : parseCoverText(text)
  const propId = (p.DocID ?? '').trim()
  const propVersion = (p.DocVersion ?? '').trim()
  return {
    docId: (DOC_ID_RE.test(propId) ? propId : '') || body.docId || docIdFromFileName(fileName),
    version: (VERSION_RE.test(propVersion) ? propVersion : '') || body.version || versionFromFileName(fileName),
    effectiveDate: (p.EffectiveDate ?? '').trim() || body.effectiveDate,
    status: statusFromFile(p.DocStatus),
  }
}

/** Compares dotted versions numerically: -1, 0 or 1. */
export function compareVersions(a, b) {
  const pa = String(a ?? '').split('.').map((n) => parseInt(n, 10) || 0)
  const pb = String(b ?? '').split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return d < 0 ? -1 : 1
  }
  return 0
}

/**
 * Which of a document's fields should change to match its file. Returns an
 * object of changed fields (possibly empty). Rules:
 *  - a field changes only when the file actually provides a value;
 *  - a file whose version is OLDER than the library's changes nothing — that's
 *    a machine whose SharePoint copy hasn't synced yet, not a rollback;
 *  - an Archived document stays archived (superseding is a library decision).
 */
export function fileMetaChanges(doc, meta) {
  if (!meta) return {}
  if (meta.version && doc.version && VERSION_RE.test(doc.version) && compareVersions(meta.version, doc.version) < 0) {
    return {}
  }
  const changes = {}
  if (meta.docId && meta.docId !== doc.docId) changes.docId = meta.docId
  if (meta.version && meta.version !== doc.version) changes.version = meta.version
  if (meta.effectiveDate && meta.effectiveDate !== doc.effectiveDate) changes.effectiveDate = meta.effectiveDate
  if (meta.status && doc.status !== 'archived' && meta.status !== doc.status) changes.status = meta.status
  return changes
}

/** One-line description of applied changes, for the audit log. */
export function describeChanges(doc, changes) {
  const label = { docId: 'Doc ID', version: 'version', effectiveDate: 'effective date', status: 'status' }
  return Object.entries(changes)
    .map(([k, v]) => `${label[k]} ${doc[k] || '(blank)'} → ${v}`)
    .join('; ')
}

/** True when the filename's Doc ID disagrees with the document's Doc ID. */
export function fileNameIdMismatch(doc) {
  const fromName = docIdFromFileName(doc.fileName)
  return !!(fromName && doc.docId && fromName !== doc.docId)
}
