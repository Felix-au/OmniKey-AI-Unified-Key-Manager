import { useState } from 'react'
import { sendEmailVerification } from 'firebase/auth'
import { useAuth } from '@/lib/AuthContext'
import { Button } from '@/components/ui/button'
import logoDark from '../assets/logo-dark-theme.webp'
import logoLight from '../assets/logo-light-theme.webp'
import { useTheme } from '@/lib/useTheme'

export default function EmailVerificationPage() {
  const dark = useTheme()
  const logo = dark ? logoDark : logoLight
  const { user, reloadUser, logout } = useAuth()
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleCheckVerification = async () => {
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      await reloadUser()
      // If still not verified after reloading, notify the user
      if (user && !user.emailVerified) {
        setError("Email verification not detected yet. Please check your inbox and click the verification link.")
      }
    } catch (err: any) {
      console.error(err)
      setError("Failed to refresh account status. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleResendEmail = async () => {
    if (!user) return
    setError(null)
    setMessage(null)
    setResending(true)
    try {
      await sendEmailVerification(user)
      setMessage("Verification email has been resent successfully. Please check your inbox.")
    } catch (err: any) {
      console.error(err)
      if (err.code === 'auth/too-many-requests') {
        setError("Too many requests. Please wait a moment before trying again.")
      } else {
        setError("Failed to send verification email. Please try again later.")
      }
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-6 relative overflow-hidden text-foreground">
      {/* Decorative background gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/10 dark:bg-violet-600/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 dark:bg-indigo-600/5 blur-[120px] pointer-events-none" />

      {/* Main glass card */}
      <div className="w-full max-w-[420px] bg-card/60 backdrop-blur-xl border border-border rounded-3xl p-8 shadow-2xl relative z-10 text-center">
        
        {/* Brand header */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-background border border-border rounded-2xl flex items-center justify-center p-3 shadow-md mb-4">
            <img src={logo} alt="OmniKey AI Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground mb-1">Verify Your Email</h1>
          <p className="text-xs text-muted-foreground">Confirm ownership of your account</p>
        </div>

        {/* Message and status blocks */}
        <div className="bg-muted/40 border border-border rounded-2xl p-4 text-xs leading-relaxed text-muted-foreground mb-6">
          We sent a verification link to <strong className="text-foreground">{user?.email}</strong>. 
          Please click that link to activate your account.
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-xs font-medium px-4 py-3 rounded-2xl mb-6 flex items-start gap-2.5 text-left">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium px-4 py-3 rounded-2xl mb-6 flex items-start gap-2.5 text-left">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
            <span>{message}</span>
          </div>
        )}

        <div className="space-y-3">
          <Button
            type="button"
            onClick={handleCheckVerification}
            disabled={loading || resending}
            className="w-full py-5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-violet-600/20 hover:shadow-violet-600/30 transition-all duration-300 transform active:scale-[0.98]"
          >
            {loading ? "Checking Status..." : "I Have Verified My Email"}
          </Button>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleResendEmail}
              disabled={loading || resending}
              className="flex-1 py-5 rounded-2xl border border-border bg-background hover:bg-muted text-foreground font-semibold text-xs transition-all"
            >
              {resending ? "Sending..." : "Resend Email"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={logout}
              className="flex-1 py-5 rounded-2xl hover:bg-red-500/10 text-red-500 hover:text-red-400 font-semibold text-xs transition-all"
            >
              Sign Out
            </Button>
          </div>
        </div>

      </div>
    </div>
  )
}
