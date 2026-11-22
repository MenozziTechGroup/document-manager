// Doc ID rules: TYPE-DOMAIN-NNN identifiers, the filename convention, and the
// checks run when a document is added or edited. Pure functions — the registry
// itself (types, domains, ledger) is loaded by registry.js and passed in.

import { CATEGORY_MAP } from './categories'

export const DOC_ID_RE = /^([A-Z]{2,4})-([A-Z0-9]{2,5})-(\d{3})$/

/** "SOP-MDM-003" → { type: 'SOP', domain: 'MDM', seq: 3 }, or null. */
export function parseDocId(id) {
  const m = (id ?? '').match(DOC_ID_RE)
  return m ? { type: m[1], domain: m[2], seq: parseInt(m[3], 10) } : null
}

/**
 * Filenames are [DOC-ID]_[Title_With_Underscores].ext with an optional _vN.N.
 * Script titles may also use hyphens (SCR-PS-002_Install-M365BusinessStandard.ps1).
 */
export function fileNameFollowsConvention(fileName, docId, script = false) {
  if (!fileName || !docId) return true
  const esc = docId.replace(/[-]/g, '\\-')
  const title = script ? '[A-Za-z0-9_-]+' : '[A-Za-z0-9_]+'
  return new RegExp(`^${esc}_${title}(_v\\d+(\\.\\d+)*)?\\.[A-Za-z0-9]+$`).test(fileName)
}

/**
 * The type code expected for a document in this category (folder). The
 * registry's folder map wins; the built-in CATEGORIES list is the fallback.
 */
export function typeCodeForCategory(category, registry) {
  const c = (category ?? '').toLowerCase()
  const t = registry?.types?.find((x) => x.folder.toLowerCase() === c)
  return t?.code ?? CATEGORY_MAP[category]?.code ?? null
}

/**
 * Checks a document before it is saved.
 *   doc       the form values being saved
 *   original  the stored document when editing (null when adding)
 *   docs      every document in the library
 *   registry  { types, domains, ids } or null when the registry isn't available
 *   script    true for script files (looser filename rule)
 * Returns { errors, warnings } — errors block the save, warnings don't.
 *
 * Errors only apply when the Doc ID is new or being changed: a document that
 * already carries a duplicate ID (from its file, say) can still have its tags
 * edited, and the problem is shown as a warning instead.
 */
export function validateDocument({ doc, original, docs, registry, script = false }) {
  const errors = []
  const warnings = []
  const id = (doc.docId ?? '').trim()
  const changing = !original || (original.docId ?? '') !== id
  const problem = (msg) => (changing ? errors : warnings).push(msg)

  if (!id) {
    warnings.push('No Doc ID — the document won’t appear in the registry.')
    return { errors, warnings }
  }
  const parsed = parseDocId(id)
  if (!parsed) {
    problem(`"${id}" isn’t a valid Doc ID. Use TYPE-DOMAIN-NNN, e.g. SOP-MDM-003.`)
    return { errors, warnings }
  }

  if (registry) {
    const type = registry.types.find((t) => t.code === parsed.type)
    const domain = registry.domains.find((d) => d.code === parsed.domain)
    if (!type) problem(`Type code ${parsed.type} isn’t registered. Add it in Registry → Types first.`)
    else if (!type.active) problem(`Type code ${parsed.type} is retired.`)
    if (!domain) problem(`Domain code ${parsed.domain} isn’t registered. Add it in Registry → Domains first.`)
    else if (!domain.active) problem(`Domain code ${parsed.domain} is retired.`)

    const entry = registry.ids.find((e) => e.docId === id)
    if (entry?.status === 'Retired') {
      const by = entry.replacedBy ? ` (replaced by ${entry.replacedBy})` : ''
      problem(`${id} was retired${entry.retiredAt ? ` on ${entry.retiredAt}` : ''}${by}. Retired IDs are never reused.`)
    } else if (!entry && changing) {
      warnings.push(`${id} isn’t in the registry yet — it will be added when you save.`)
    }
  }

  const clash = docs.find((d) => d.docId === id && d.id !== doc.id)
  if (clash) problem(`${id} is already used by “${clash.title}”.`)

  const expectedType = typeCodeForCategory(doc.category, registry)
  if (expectedType && expectedType !== parsed.type) {
    warnings.push(`${id} is a ${parsed.type}, but the ${doc.category} folder holds ${expectedType} documents.`)
  }
  if (!fileNameFollowsConvention(doc.fileName, id, script)) {
    warnings.push(`The filename doesn’t follow ${id}_Title_With_Underscores${script ? '' : '.docx'}.`)
  }
  return { errors, warnings }
}
