import { useState } from 'react'
import { signIn } from '../data/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await signIn(email.trim(), password)
      // App's auth listener picks up the new session and renders the app.
    } catch (err) {
      setError(err?.message || 'Sign-in failed. Check your email and password.')
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center justify-center h-full" style={{ background: 'var(--app-bg)' }}>
      <form onSubmit={submit} className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-7">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0" style={{ background: 'var(--mits-red)' }}>DC</div>
          <div>
            <div className="font-semibold text-base leading-tight" style={{ color: 'var(--mits-charcoal)' }}>DocCenter</div>
            <div className="text-xs" style={{ color: '#9ca3af' }}>Menozzi IT Solutions</div>
          </div>
        </div>

        <h1 className="text-sm font-semibold mb-1" style={{ color: 'var(--mits-charcoal)' }}>Sign in</h1>
        <p className="text-xs mb-4" style={{ color: '#6b7280' }}>Use your DocCenter account to access the shared library.</p>

        <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Email</label>
        <input
          type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required
          className="w-full mb-3" style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', fontSize: 13, outline: 'none' }}
          placeholder="you@menozzi.tech"
        />
        <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Password</label>
        <input
          type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
          className="w-full mb-4" style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', fontSize: 13, outline: 'none' }}
          placeholder="••••••••"
        />

        {error && (
          <div className="text-xs mb-3 px-3 py-2 rounded" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' }}>{error}</div>
        )}

        <button
          type="submit" disabled={busy}
          className="w-full text-sm py-2.5 rounded-lg text-white font-medium transition-opacity"
          style={{ background: 'var(--mits-red)', opacity: busy ? 0.6 : 1 }}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
