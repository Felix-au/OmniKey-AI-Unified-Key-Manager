import { useState } from 'react'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import logoUrl from '../assets/logo.png'

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (isRegister && password !== confirmPassword) {
      setError("Passwords do not match.")
      setLoading(false)
      return
    }

    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password)
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
    } catch (err: any) {
      console.error(err)
      let friendlyMessage = err.message
      if (err.code === 'auth/invalid-credential') {
        friendlyMessage = 'Invalid email or password.'
      } else if (err.code === 'auth/email-already-in-use') {
        friendlyMessage = 'This email address is already registered.'
      } else if (err.code === 'auth/weak-password') {
        friendlyMessage = 'Password must be at least 6 characters.'
      } else if (err.code === 'auth/invalid-email') {
        friendlyMessage = 'Please enter a valid email address.'
      }
      setError(friendlyMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 p-6 relative overflow-hidden">
      {/* Decorative background gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />

      {/* Main glass card */}
      <div className="w-full max-w-[420px] bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 transition-all duration-300">
        
        {/* Brand header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-2xl flex items-center justify-center p-2.5 shadow-lg shadow-violet-500/10 mb-4 animate-pulse">
            <img src={logoUrl} alt="OmniKey AI Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1.5">OmniKey AI</h1>
          <p className="text-xs text-slate-400 font-medium">Unified Key Manager & Multi-Tenant Gateway</p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-950/80 rounded-2xl mb-6 border border-slate-900">
          <button
            type="button"
            onClick={() => { setIsRegister(false); setError(null); }}
            className={`py-2 text-xs font-semibold rounded-xl transition-all ${
              !isRegister
                ? 'bg-slate-800 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsRegister(true); setError(null); }}
            className={`py-2 text-xs font-semibold rounded-xl transition-all ${
              isRegister
                ? 'bg-slate-800 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium px-4 py-3 rounded-2xl mb-6 flex items-start gap-2.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>{error}</span>
          </div>
        )}

        {/* Auth form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5 ml-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5 ml-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
            />
          </div>

          {isRegister && (
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5 ml-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
              />
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full py-6 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-violet-600/20 hover:shadow-violet-600/30 transition-all duration-300 transform active:scale-[0.98]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : isRegister ? (
              'Create Cloud Account'
            ) : (
              'Sign In to Dashboard'
            )}
          </Button>
        </form>

        {/* Footer note */}
        <div className="mt-6 pt-5 border-t border-slate-800/40 text-center">
          <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
            Authentication is secured by Firebase Guard. Database persistence resides on cluster0 MongoDB.
          </p>
        </div>

      </div>
    </div>
  )
}
