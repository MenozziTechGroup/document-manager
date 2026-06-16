export const CATEGORIES = [
  { id: 'Runbooks',        label: 'Runbooks',          code: 'RBK', color: '#e1251b', bg: '#fde8e8' },
  { id: 'SOPs',            label: 'SOPs',               code: 'SOP', color: '#2563eb', bg: '#dbeafe' },
  { id: 'Checklists',      label: 'Checklists',         code: 'CHK', color: '#16a34a', bg: '#dcfce7' },
  { id: 'Client Guides',   label: 'Client Guides',      code: 'CGD', color: '#d97706', bg: '#fef3c7' },
  { id: 'Scripts',           label: 'Scripts',            code: 'SCP', color: '#ea580c', bg: '#ffedd5' },
  { id: 'Scripts Reference', label: 'Scripts Reference', code: 'SCR', color: '#7c3aed', bg: '#ede9fe' },
  { id: 'Reference',       label: 'Reference',          code: 'REF', color: '#0d9488', bg: '#ccfbf1' },
  { id: 'Policy',          label: 'Policy',             code: 'POL', color: '#9333ea', bg: '#f3e8ff' },
  { id: 'Letters',         label: 'Letters',            code: 'LTR', color: '#0891b2', bg: '#cffafe' },
  { id: 'Other',           label: 'Other',              code: 'OTH', color: '#6b7280', bg: '#f3f4f6' },
]

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]))

// Returns display info for any category name — predefined ones get their
// configured color/code; unknown folder names get a neutral default.
export function getCategoryInfo(name) {
  return CATEGORY_MAP[name] ?? { id: name, label: name, code: null, color: '#6b7280', bg: '#f3f4f6' }
}

// Domain codes — the second organizing axis (the tool/area a document is about).
// Used alongside the type/category to form Doc IDs like SOP-MDM-003 and to
// browse "everything Hornetsecurity" across document types.
export const DOMAINS = [
  { code: 'IT',   label: 'General IT' },
  { code: 'MDM',  label: 'MDM / Apple Devices' },
  { code: 'DNS',  label: 'DNSFilter' },
  { code: 'NIN',  label: 'NinjaOne' },
  { code: 'M365', label: 'Microsoft 365' },
  { code: 'HRN',  label: 'Hornetsecurity' },
  { code: 'PS',   label: 'PowerShell' },
  { code: 'DOC',  label: 'Document System' },
  { code: 'ACC',  label: 'Account Management' },
  { code: 'ONB',  label: 'Onboarding' },
  { code: 'OFB',  label: 'Offboarding' },
  { code: 'INC',  label: 'Incident Response' },
  { code: 'HR',   label: 'HR' },
]

export const DOMAIN_MAP = Object.fromEntries(DOMAINS.map((d) => [d.code, d]))

export const AUDIENCES = [
  { id: 'Internal', label: 'Internal' },
  { id: 'Client',   label: 'Client-facing' },
]

export const STATUSES = [
  { id: 'active',   label: 'Active',   color: '#16a34a', bg: '#dcfce7' },
  { id: 'draft',    label: 'Draft',    color: '#d97706', bg: '#fef3c7' },
  { id: 'archived', label: 'Archived', color: '#6b7280', bg: '#f3f4f6' },
]

export const STATUS_MAP = Object.fromEntries(STATUSES.map((s) => [s.id, s]))

export const FILE_TYPE_INFO = {
  docx: { label: 'Word', color: '#2b579a', bg: '#dbeafe' },
  pdf:  { label: 'PDF',  color: '#dc2626', bg: '#fee2e2' },
  ps1:  { label: 'PowerShell', color: '#1f2937', bg: '#e5e7eb' },
  psm1: { label: 'PowerShell', color: '#1f2937', bg: '#e5e7eb' },
  bat:  { label: 'Batch', color: '#1f2937', bg: '#e5e7eb' },
  cmd:  { label: 'Batch', color: '#1f2937', bg: '#e5e7eb' },
  sh:   { label: 'Shell', color: '#1f2937', bg: '#e5e7eb' },
  py:   { label: 'Python', color: '#1f2937', bg: '#e5e7eb' },
}

// Script file types are treated as first-class single-file documents
// (no docx/pdf pairing). They get script-specific actions like "Copy contents".
export const SCRIPT_TYPES = ['ps1', 'psm1', 'bat', 'cmd', 'sh', 'py']

export function isScript(fileType) {
  return SCRIPT_TYPES.includes((fileType ?? '').toLowerCase())
}

// File-type options offered in the document modal's dropdown.
export const FILE_TYPE_OPTIONS = [
  { value: 'docx', label: 'Word (.docx)' },
  { value: 'pdf',  label: 'PDF (.pdf)' },
  { value: 'ps1',  label: 'PowerShell (.ps1)' },
  { value: 'psm1', label: 'PowerShell module (.psm1)' },
  { value: 'bat',  label: 'Batch (.bat)' },
  { value: 'cmd',  label: 'Batch (.cmd)' },
  { value: 'sh',   label: 'Shell (.sh)' },
  { value: 'py',   label: 'Python (.py)' },
]

export const GROUP_COLORS = [
  '#e1251b', '#2563eb', '#16a34a', '#d97706',
  '#7c3aed', '#0891b2', '#db2777', '#059669',
]

// Playbook phases — the macro stages of an operational playbook.
// Prep (gather, read-only) → Execute (the change) → Verify (confirm) → Handoff (docs/comms).
export const PHASES = [
  { id: 'Prep',    label: 'Prep',    summary: 'Read-only and gathering work — no client systems touched.', color: '#0891b2', bg: '#cffafe' },
  { id: 'Execute', label: 'Execute', summary: 'The actual operational change.',                              color: '#e1251b', bg: '#fde8e8' },
  { id: 'Verify',  label: 'Verify',  summary: 'Confirm the change took effect end-to-end.',                  color: '#d97706', bg: '#fef3c7' },
  { id: 'Handoff', label: 'Handoff', summary: 'Documentation, client communication, ongoing-management setup.', color: '#16a34a', bg: '#dcfce7' },
]

export const PHASE_MAP = Object.fromEntries(PHASES.map((p) => [p.id, p]))
export const PHASE_ORDER = Object.fromEntries(PHASES.map((p, i) => [p.id, i]))

/**
 * Returns display info for a review_by date string.
 * Returns null if no date is set.
 */
export function reviewStatus(reviewBy) {
  if (!reviewBy) return null
  const target = new Date(reviewBy)
  const now = new Date()
  // Compare date-only (ignore time)
  target.setHours(0, 0, 0, 0)
  now.setHours(0, 0, 0, 0)
  const days = Math.floor((target - now) / (1000 * 60 * 60 * 24))
  if (days < 0)  return { label: 'Review overdue',    color: '#dc2626', bg: '#fee2e2', urgent: true,  days }
  if (days === 0) return { label: 'Review today',     color: '#dc2626', bg: '#fee2e2', urgent: true,  days }
  if (days <= 14) return { label: `Review in ${days}d`, color: '#dc2626', bg: '#fee2e2', urgent: true,  days }
  if (days <= 30) return { label: `Review in ${days}d`, color: '#d97706', bg: '#fef3c7', urgent: true,  days }
  return {
    label: `Review ${target.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
    color: '#16a34a', bg: '#dcfce7', urgent: false, days,
  }
}
