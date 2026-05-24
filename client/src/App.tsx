import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { AuthProvider, useAuth } from '@/lib/AuthContext'
import LoginPage from '@/pages/LoginPage'
import KeysPage from '@/pages/KeysPage'
import PlaygroundPage from '@/pages/PlaygroundPage'
import FallbackPage from '@/pages/FallbackPage'
import AnalyticsPage from '@/pages/AnalyticsPage'
import DevCornerPage from '@/pages/DevCornerPage'
import AdminPage from '@/pages/AdminPage'
import logoUrl from './assets/logo.png'

const queryClient = new QueryClient()

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `relative text-sm px-1 py-4 transition-colors ${
          isActive
            ? 'text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`
      }
    >
      {children}
    </NavLink>
  )
}

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
    <Button variant="ghost" size="sm" onClick={toggle} aria-label="Toggle theme">
      {dark ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
      )}
    </Button>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <img src={logoUrl} alt="OmniKey AI Logo" className="h-6 w-auto object-contain" />
      <span className="font-semibold tracking-tight text-sm">OmniKey AI</span>
    </div>
  )
}

function DashboardLayout() {
  const { user, loading, localDbEnabled, cloudDbAvailable, logout, setDatabaseMode } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-950">
        <svg className="animate-spin h-8 w-8 text-white mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-xs text-slate-400 font-medium">Establishing secure auth gateway...</span>
      </div>
    )
  }

  // Secure Auth Lock: Load premium login cards if in multi-tenant cloud mode and logged out
  if (!localDbEnabled && !user) {
    return <LoginPage />
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-6 flex items-center">
          <Brand />
          <nav className="flex items-center gap-6 ml-10">
            <NavItem to="/playground">Playground</NavItem>
            <NavItem to="/keys">Keys</NavItem>
            <NavItem to="/fallback">Fallback</NavItem>
            <NavItem to="/analytics">Analytics</NavItem>
            <NavItem to="/dev-corner">Dev Corner</NavItem>
          </nav>
          <div className="ml-auto py-2 flex items-center gap-4">
            {localDbEnabled && cloudDbAvailable && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDatabaseMode('cloud')}
                className="text-xs font-semibold text-violet-600 dark:text-violet-400 border-violet-500/20 hover:border-violet-500/40 bg-violet-500/5 hover:bg-violet-500/10 rounded-xl h-8 px-3"
              >
                Switch to Cloud Mode
              </Button>
            )}
            {localDbEnabled && !cloudDbAvailable && (
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1">
                Local-Only Mode
              </span>
            )}
            {!localDbEnabled && (
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider bg-emerald-500/5 border border-emerald-500/10 rounded-xl px-2.5 py-1">
                Cloud Connected
              </span>
            )}
            <DarkModeToggle />
            {!localDbEnabled && user && (
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="text-xs font-semibold text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl"
              >
                Sign Out
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <Routes>
          <Route path="/" element={<Navigate to="/playground" replace />} />
          <Route path="/playground" element={<PlaygroundPage />} />
          <Route path="/keys" element={<KeysPage />} />
          <Route path="/fallback" element={<FallbackPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/dev-corner" element={<DevCornerPage />} />
          <Route path="/test" element={<Navigate to="/playground" replace />} />
          <Route path="/health" element={<Navigate to="/keys" replace />} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Routes>
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/*" element={<DashboardLayout />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
