import { useState, useEffect } from 'react'
import { getClientNames } from '../data/repo'

export default function StartRunModal({ playbook, onStart, onClose }) {
  const [clientName, setClientName] = useState('')
  const [ticket, setTicket] = useState('')
  const [clientNames, setClientNames] = useState([])

  useEffect(() => { getClientNames().then(setClientNames) }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = (e) => {
    e.preventDefault()
    onStart({ clientName: clientName.trim(), ticket: ticket.trim() })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#e5e7eb' }}>
          <div>
            <h2 className="font-semibold text-base">Start Playbook</h2>
            <div className="text-xs mt-0.5" style={{ color: '#6b7280' }}>{playbook.name}</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>

        <form onSubmit={submit} className="px-5 py-4 space-y-4">
          <p className="text-xs" style={{ color: '#6b7280' }}>
            This creates a tracked run — a checklist you work through for this client. Your progress is saved
            independently of the playbook template.
          </p>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Client</label>
            <input
              list="run-client-names"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              autoFocus
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 10px', fontSize: 13, outline: 'none' }}
              placeholder="Who is this run for?"
              onFocus={(e) => { e.target.style.borderColor = '#e1251b' }}
              onBlur={(e) => { e.target.style.borderColor = '#d1d5db' }}
            />
            <datalist id="run-client-names">
              {clientNames.map((n) => <option key={n} value={n} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Ticket # (optional)</label>
            <input
              value={ticket}
              onChange={(e) => setTicket(e.target.value)}
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 10px', fontSize: 13, outline: 'none' }}
              placeholder="e.g. HaloPSA #4127"
              onFocus={(e) => { e.target.style.borderColor = '#e1251b' }}
              onBlur={(e) => { e.target.style.borderColor = '#d1d5db' }}
            />
          </div>
        </form>

        <div className="flex justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: '#e5e7eb' }}>
          <button type="button" onClick={onClose} className="text-sm px-4 py-2 rounded border" style={{ borderColor: '#d1d5db', color: '#6b7280' }}>
            Cancel
          </button>
          <button onClick={submit} className="text-sm px-4 py-2 rounded text-white font-medium" style={{ background: 'var(--mits-red)' }}>
            Start Run →
          </button>
        </div>
      </div>
    </div>
  )
}
