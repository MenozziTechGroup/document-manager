import { useState } from 'react'
import { isTauri } from '../data/db'

export default function Onboarding({ onComplete }) {
  const [path, setPath] = useState('')
  const [step, setStep] = useState(1)

  const pickFolder = async () => {
    if (!isTauri()) {
      setStep(2)
      return
    }
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({ directory: true, multiple: false, title: 'Select your MITS Docs folder' })
    if (selected) {
      setPath(selected)
      setStep(2)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center" style={{ background: 'var(--app-bg)' }}>
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mb-6"
        style={{ background: 'var(--mits-red)' }}
      >
        DM
      </div>

      <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--mits-charcoal)' }}>
        Welcome to MITS DocCenter
      </h1>
      <p className="text-sm mb-8 max-w-md" style={{ color: '#6b7280' }}>
        Your central library for Runbooks, SOPs, Checklists, Client Guides, Scripts, and Letters.
        Let&apos;s connect it to your SharePoint-synced folder to get started.
      </p>

      {step === 1 && (
        <div className="w-full max-w-md space-y-3">
          <button
            onClick={pickFolder}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90"
            style={{ background: 'var(--mits-red)' }}
          >
            Select My MITS Docs Folder
          </button>
          <button
            onClick={() => onComplete('')}
            className="w-full py-2.5 rounded-xl text-sm border transition-colors hover:bg-white"
            style={{ borderColor: '#d1d5db', color: '#6b7280' }}
          >
            Skip for now — I'll set it up in Settings
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="w-full max-w-md space-y-4">
          <div className="rounded-lg p-4 text-left" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
            <div className="text-xs font-medium mb-1" style={{ color: '#6b7280' }}>Selected folder:</div>
            <div className="text-sm font-mono break-all" style={{ color: 'var(--mits-charcoal)' }}>
              {path || '(no path — will configure in Settings)'}
            </div>
          </div>

          <div className="text-xs text-left rounded-lg p-4" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }}>
            <div className="font-medium mb-1">For best results, structure your folder like this:</div>
            <div className="font-mono space-y-0.5">
              {['MITS Docs/', '  ├── Runbooks/', '  ├── SOPs/', '  ├── Checklists/', '  ├── Client Guides/', '  ├── Scripts Reference/', '  └── Letters/'].map((l) => (
                <div key={l}>{l}</div>
              ))}
            </div>
          </div>

          <button
            onClick={() => onComplete(path)}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90"
            style={{ background: 'var(--mits-red)' }}
          >
            {path ? "Let's Go — Scan My Vault" : 'Continue'}
          </button>
        </div>
      )}
    </div>
  )
}
