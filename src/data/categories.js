export const CATEGORIES = [
  { id: 'Runbooks',        label: 'Runbooks',          color: '#e1251b', bg: '#fde8e8' },
  { id: 'SOPs',            label: 'SOPs',               color: '#2563eb', bg: '#dbeafe' },
  { id: 'Checklists',      label: 'Checklists',         color: '#16a34a', bg: '#dcfce7' },
  { id: 'Client Guides',   label: 'Client Guides',      color: '#d97706', bg: '#fef3c7' },
  { id: 'Scripts Reference', label: 'Scripts Reference', color: '#7c3aed', bg: '#ede9fe' },
  { id: 'Letters',         label: 'Letters',            color: '#0891b2', bg: '#cffafe' },
  { id: 'Other',           label: 'Other',              color: '#6b7280', bg: '#f3f4f6' },
]

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]))

export const STATUSES = [
  { id: 'active',   label: 'Active',   color: '#16a34a', bg: '#dcfce7' },
  { id: 'draft',    label: 'Draft',    color: '#d97706', bg: '#fef3c7' },
  { id: 'archived', label: 'Archived', color: '#6b7280', bg: '#f3f4f6' },
]

export const STATUS_MAP = Object.fromEntries(STATUSES.map((s) => [s.id, s]))

export const FILE_TYPE_INFO = {
  docx: { label: 'Word', color: '#2b579a', bg: '#dbeafe' },
  pdf:  { label: 'PDF',  color: '#dc2626', bg: '#fee2e2' },
}

export const GROUP_COLORS = [
  '#e1251b', '#2563eb', '#16a34a', '#d97706',
  '#7c3aed', '#0891b2', '#db2777', '#059669',
]
