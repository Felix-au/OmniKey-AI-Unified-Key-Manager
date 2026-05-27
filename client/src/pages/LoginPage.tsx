import { useState, useEffect } from 'react'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, sendEmailVerification } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/lib/AuthContext'
import { Button } from '@/components/ui/button'
import logoUrl from '../assets/logo.png'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'

function DarkModeToggle() {
  const [dark, setDark] = useState(() =>
    typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
  )

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    if (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark')
      setDark(true)
    }
  }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      aria-label="Toggle theme"
      className="absolute top-6 right-6 rounded-xl border border-border text-foreground hover:bg-muted"
    >
      {dark ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>
      )}
    </Button>
  )
}

export default function LoginPage() {
  const { setDatabaseMode } = useAuth()
  const [rememberMode, setRememberMode] = useState(true)
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [promoStatus, setPromoStatus] = useState<{ activePromoUsers: number; totalPromoLimit: number; remainingSlots: number; isActive: boolean } | null>(null)

  useEffect(() => {
    const fetchPromoStatus = async () => {
      try {
        const base = (import.meta.env.VITE_API_URL || import.meta.env.BASE_URL).replace(/\/$/, '')
        const res = await fetch(`${base}/api/public/promo-status`)
        if (res.ok) {
          const data = await res.json()
          setPromoStatus(data)
        }
      } catch (err) {
        console.warn('Failed to fetch promo status:', err)
      }
    }
    fetchPromoStatus()
  }, [])

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
        const userCredential = await createUserWithEmailAndPassword(auth, email, password)
        if (userCredential.user) {
          await sendEmailVerification(userCredential.user)
        }
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

  const handleGoogleSignIn = async () => {
    setError(null)
    setLoading(true)
    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
    } catch (err: any) {
      console.error(err)
      let friendlyMessage = err.message
      if (err.code === 'auth/popup-blocked') {
        friendlyMessage = 'Sign-in popup was blocked by your browser. Please enable popups.'
      } else if (err.code === 'auth/popup-closed-by-user') {
        friendlyMessage = 'Sign-in popup was closed before completion.'
      } else if (err.code === 'auth/cancelled-popup-request') {
        friendlyMessage = 'Sign-in process was cancelled.'
      }
      setError(friendlyMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-6 relative overflow-hidden text-foreground">
      {/* Dark/Light Theme Toggle */}
      <DarkModeToggle />

      {/* Decorative background gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/10 dark:bg-violet-600/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 dark:bg-indigo-600/5 blur-[120px] pointer-events-none" />

      {/* Main glass card */}
      <div className="w-full max-w-[420px] bg-card/60 backdrop-blur-xl border border-border rounded-3xl p-8 shadow-2xl relative z-10 transition-all duration-300">

        {/* Brand header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-20 h-20 bg-slate-50 dark:bg-white border border-border rounded-3xl flex items-center justify-center p-3.5 shadow-md mb-4">
            <img src={logoUrl} alt="OmniKey AI Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1.5">OmniKey AI</h1>
          <p className="text-xs text-muted-foreground font-medium">Unified Key Manager & Multi-Tenant Gateway</p>
        </div>

        {promoStatus?.isActive && (
          <div className="mb-6 p-4 rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.03] text-center animate-fade-in relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-1 -mt-1 w-2.5 h-2.5 bg-emerald-500/10 rounded-full blur-[1px] animate-pulse" />
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-450 opacity-75 animate-duration-1000"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              10M Promotional Credit Active
            </p>

            <div className="mt-2.5 text-[9px] font-bold tracking-wider text-emerald-600 dark:text-emerald-400 uppercase font-mono bg-emerald-500/10 rounded-lg py-1 px-2.5 inline-block">
              {promoStatus.remainingSlots} of {promoStatus.totalPromoLimit} accounts left!
            </div>
          </div>
        )}

        {/* Google Sign In */}
        <Button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-6 rounded-2xl border border-border bg-background hover:bg-muted text-foreground font-semibold text-xs transition-all flex items-center justify-center gap-2.5 transform active:scale-[0.98] mb-5"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.04,3.1v2.58h3.3c1.93,-1.78 3.04,-4.4 3.04,-7.48c0,-0.68 -0.06,-1.34 -0.18,-1.9Z" fill="#4285F4" />
            <path d="M12,20.6c2.32,0 4.27,-0.77 5.69,-2.1l-2.58,-2c-0.77,0.52 -1.75,0.83 -3.11,0.83c-2.39,0 -4.41,-1.61 -5.13,-3.78H3.45v2.66C4.87,19.03 8.19,20.6 12,20.6Z" fill="#34A853" />
            <path d="M6.87,13.55c-0.18,-0.54 -0.28,-1.11 -0.28,-1.7s0.1,-1.16 0.28,-1.7V7.49H3.45C2.82,8.75 2.47,10.18 2.47,11.7c0,1.52 0.35,2.95 0.98,4.21l3.42,-2.66Z" fill="#FBBC05" />
            <path d="M12,6.27c1.26,0 2.39,0.43 3.28,1.28l2.46,-2.46C16.26,3.64 14.31,2.87 12,2.87c-3.81,0 -7.13,1.57 -8.55,4.62l3.42,2.66c0.72,-2.17 2.74,-3.78 5.13,-3.78Z" fill="#EA4335" />
          </svg>
          Continue with Google
        </Button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-px bg-border grow" />
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">or</span>
          <div className="h-px bg-border grow" />
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1.5 bg-muted/50 rounded-2xl mb-6 border border-border">
          <button
            type="button"
            onClick={() => { setIsRegister(false); setError(null); }}
            className={`py-2 text-xs font-semibold rounded-xl transition-all ${!isRegister
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsRegister(true); setError(null); }}
            className={`py-2 text-xs font-semibold rounded-xl transition-all ${isRegister
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            Create Account
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-xs font-medium px-4 py-3 rounded-2xl mb-6 flex items-start gap-2.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            <span>{error}</span>
          </div>
        )}

        {/* Auth form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5 ml-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5 ml-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
            />
          </div>

          {isRegister && (
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5 ml-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
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
              'Create Account'
            ) : (
              'Sign In to Dashboard'
            )}
          </Button>
        </form>

        {/* Dynamic Mode Switcher (Local-First fallback) */}
        <div className="mt-5 p-4 rounded-2xl bg-muted/30 border border-border flex flex-col items-center">
          <p className="text-[10px] text-muted-foreground font-semibold text-center mb-2.5">
            Running offline or hosting locally?
          </p>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMode}
                onChange={(e) => setRememberMode(e.target.checked)}
                className="rounded border-border bg-background text-violet-600 focus:ring-violet-500 w-3 h-3"
              />
              Remember choice
            </label>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => setConfirmModalOpen(true)}
              className="text-[10px] font-bold py-1.5 px-3 h-auto text-violet-600 dark:text-violet-400 border-violet-500/20 hover:border-violet-500/40 bg-violet-500/5 hover:bg-violet-500/10 rounded-xl"
            >
              Switch to Local-First
            </Button>
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-6 pt-5 border-t border-border text-center">
          <p className="text-[10px] text-muted-foreground font-medium leading-relaxed">
            Authentication is secured by Firebase Guard.
          </p>
        </div>

      </div>
      <ConfirmationModal
        isOpen={confirmModalOpen}
        title="Switch to Local-First Mode?"
        description="Only switch to local-first mode if you have run the project locally on your device; otherwise, it would not work."
        confirmLabel="Switch"
        cancelLabel="Cancel"
        onConfirm={() => {
          setConfirmModalOpen(false)
          setDatabaseMode('local', rememberMode)
        }}
        onCancel={() => setConfirmModalOpen(false)}
      />
    </div>
  )
}
