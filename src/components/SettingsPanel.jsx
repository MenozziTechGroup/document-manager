import { useState } from 'react'
import { isTauri } from '../data/db'

export default function SettingsPanel({ vaultPath, onVaultChange }) {
  const [path, setPath] = useState(vaultPath ?? '')
  const [saved, setSaved] = useState(false)

  const pickFolder = async () => {
    if (!isTauri()) {
      alert('Folder picker is only available in the desktop app.')
      return
    }
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({ directory: true, multiple: false, title: 'Select Vault Folder' })
    if (selected) {
      setPath(selected)
      setSaved(false)
    }
  }

  const save = () => {
    onVaultChange(path.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-3 border-b" style={{ borderColor: '#e5e7eb', background: 'white' }}>
        <h1 className="font-semibold text-base" style={{ color: 'var(--mits-charcoal)' }}>Settings</h1>
      </div>

      <div className="p-6 max-w-xl space-y-8">
        {/* Vault Configuration */}
        <section>
          <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--mits-charcoal)' }}>Vault Folder</h2>
          <p className="text-xs mb-4" style={{ color: '#6b7280' }}>
            Point DocManager at your SharePoint-synced folder. The app will scan this folder for .docx and .pdf files
            and organize them by subfolder name (e.g. a "Runbooks" subfolder maps to the Runbooks category).
          </p>

          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                value={path}
                onChange={(e) => { setPath(e.target.value); setSaved(false) }}
                placeholder="C:\Users\…\OneDrive - Menozzi IT Solutions\MITS Docs"
                style={{
                  flex: 1, border: '1px solid #d1d5db', borderRadius: 6,
                  padding: '7px 10px', fontSize: 13, fontFamily: 'monospace', outline: 'none',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#e1251b' }}
                onBlur={(e) => { e.target.style.borderColor = '#d1d5db' }}
              />
              <button
                onClick={pickFolder}
                className="text-sm px-3 py-1.5 rounded border transition-colors hover:bg-gray-50"
                style={{ borderColor: '#d1d5db', color: '#374151', whiteSpace: 'nowrap' }}
              >
                Browse…
              </button>
            </div>

            <button
              onClick={save}
              className="text-sm px-4 py-2 rounded text-white font-medium transition-colors"
              style={{ background: saved ? '#16a34a' : 'var(--mits-red)' }}
            >
              {saved ? '✓ Saved' : 'Save Path'}
            </button>
          </div>
        </section>

        {/* Folder structure guide */}
        <section>
          <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--mits-charcoal)' }}>Recommended Folder Structure</h2>
          <p className="text-xs mb-3" style={{ color: '#6b7280' }}>
            Organize your SharePoint folder like this so the vault scan automatically assigns categories:
          </p>
          <div className="rounded-lg p-3 font-mono text-xs space-y-0.5" style={{ background: '#f3f4f6', color: '#374151' }}>
            {[
              'MITS Docs/',
              '  ├── Runbooks/',
              '  ├── SOPs/',
              '  ├── Checklists/',
              '  ├── Client Guides/',
              '  ├── Scripts Reference/',
              '  ├── Letters/',
              '  └── Other/',
            ].map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        </section>

        {/* About */}
        <section>
          <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--mits-charcoal)' }}>About</h2>
          <div className="text-xs space-y-1" style={{ color: '#6b7280' }}>
            <div>MITS DocManager v0.1.0</div>
            <div>Menozzi IT Solutions</div>
          </div>
        </section>
      </div>
    </div>
  )
}
