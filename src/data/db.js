// Dual-mode data layer.
// - Tauri desktop: uses SQLite via tauri-plugin-sql.
// - Browser (Vite preview): falls back to localStorage for fast UI iteration.

let _db = null
let _loadPromise = null

export function isTauri() {
  return typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__
}

export async function getDb() {
  if (!isTauri()) return null
  if (_db) return _db
  if (!_loadPromise) {
    _loadPromise = (async () => {
      const { default: Database } = await import('@tauri-apps/plugin-sql')
      _db = await Database.load('sqlite:docmanager.db')
      return _db
    })()
  }
  return _loadPromise
}

// ---- localStorage helpers (browser fallback) ----

export function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function lsSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

// ---- row <-> app object mappers ----

export function rowToDoc(r) {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    filePath: r.file_path,
    fileName: r.file_name,
    fileType: r.file_type,
    description: r.description ?? '',
    status: r.status ?? 'active',
    tags: safeParseArray(r.tags),
    version: r.version ?? '',
    clientName: r.client_name ?? '',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export function rowToGroup(r) {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    color: r.color ?? '#e1251b',
    createdAt: r.created_at,
  }
}

function safeParseArray(v) {
  if (Array.isArray(v)) return v
  try {
    const parsed = JSON.parse(v ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
