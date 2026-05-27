import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@/lib/AuthContext'
import LoginPage from '@/pages/LoginPage'
import KeysPage from '@/pages/KeysPage'
import PlaygroundPage from '@/pages/PlaygroundPage'
import FallbackPage from '@/pages/FallbackPage'
import AnalyticsPage from '@/pages/AnalyticsPage'
import DevCornerPage from '@/pages/DevCornerPage'
import AdminPage from '@/pages/AdminPage'
import logoUrl from './assets/logo.png'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import ModelsPage from '@/pages/ModelsPage'
import ComparePage from '@/pages/ComparePage'
import DebatePage from '@/pages/DebatePage'
import LandingPage from '@/pages/LandingPage'
import EmailVerificationPage from '@/pages/EmailVerificationPage'
import { OnboardingTour } from '@/components/OnboardingTour'

const queryClient = new QueryClient()

// ── Icons ────────────────────────────────────────────────────────────────────
const IconChat = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
)
const IconArena = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
  </svg>
)
const IconDebate = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/>
  </svg>
)
const IconKeys = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>
  </svg>
)
const IconFallback = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
  </svg>
)
const IconModels = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>
  </svg>
)
const IconAnalytics = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
)
const IconDev = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
  </svg>
)
const IconChevron = ({ collapsed }: { collapsed: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)
const IconSun = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2m-7.07-14.07 1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2m-4.93-7.07-1.41 1.41M6.34 17.66l-1.41 1.41"/>
  </svg>
)
const IconMoon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
  </svg>
)

// ── Dark Mode Toggle ──────────────────────────────────────────────────────────
function DarkModeToggle({ collapsed }: { collapsed: boolean }) {
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
    <button
      onClick={toggle}
      title="Toggle theme"
      className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
    >
      <span className="shrink-0">{dark ? <IconSun /> : <IconMoon />}</span>
      {!collapsed && <span>{dark ? 'Light Mode' : 'Dark Mode'}</span>}
    </button>
  )
}

// ── Sidebar Nav Item ──────────────────────────────────────────────────────────
function SideNavItem({ to, icon, label, collapsed }: { to: string; icon: React.ReactNode; label: string; collapsed: boolean }) {
  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg text-sm transition-colors ${
          collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2'
        } ${
          isActive
            ? 'bg-accent text-foreground font-medium'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
        }`
      }
    >
      <span className={`shrink-0 ${collapsed ? '[&>svg]:w-5 [&>svg]:h-5' : ''}`}>{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  )
}

// ── Section Label ─────────────────────────────────────────────────────────────
function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div className="my-2 border-t border-border/50" />
  return <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{label}</p>
}

// ── Mobile Hamburger Button ───────────────────────────────────────────────────
const IconMenu = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>
  </svg>
)
const IconX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

// ── Mobile Theme Toggle (icon-only, for topbar) ───────────────────────────────
function MobileThemeToggle() {
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
    <button
      onClick={toggle}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
    >
      {dark ? <IconSun /> : <IconMoon />}
    </button>
  )
}

// ── Dashboard Layout ──────────────────────────────────────────────────────────
function DashboardLayout() {
  const { user, loading, localDbEnabled, cloudDbAvailable, logout, setDatabaseMode } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showSwitchModal, setShowSwitchModal] = useState(false)

  const [showTour, setShowTour] = useState(false)

  useEffect(() => {
    if (!loading && (localDbEnabled || user)) {
      const onboarded = localStorage.getItem('omnikey_onboarded')
      if (!onboarded) {
        setShowTour(true)
      }
    }
  }, [loading, localDbEnabled, user])

  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-950">
        <svg className="animate-spin h-8 w-8 text-white mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
        </svg>
        <span className="text-xs text-slate-400 font-medium">Establishing secure auth gateway...</span>
      </div>
    )
  }

  if (!localDbEnabled && !user) return <LoginPage />
  if (!localDbEnabled && user && !user.emailVerified) return <EmailVerificationPage />

  const sidebarW = collapsed ? 'w-[72px]' : 'w-[220px]'

  // Shared sidebar inner content (used for both desktop & mobile drawer)
  function SidebarContent({ mobile = false }: { mobile?: boolean }) {
    return (
      <>
        {/* Brand + collapse toggle */}
        <div className="flex items-center h-14 px-3 border-b border-border gap-2 shrink-0">
          <button
            onClick={() => { if (collapsed && !mobile) setCollapsed(false) }}
            title={collapsed && !mobile ? 'Expand sidebar' : undefined}
            className={`shrink-0 rounded-lg transition-colors ${collapsed && !mobile ? 'hover:bg-accent/60 cursor-pointer p-1' : 'cursor-default'}`}
          >
            <img
              src={logoUrl}
              alt="OmniKey AI"
              className={`object-contain transition-all duration-200 ${collapsed && !mobile ? 'h-9 w-9' : 'h-6 w-6'}`}
            />
          </button>
          {(!collapsed || mobile) && <span className="font-semibold text-sm tracking-tight truncate">OmniKey AI</span>}
          {mobile ? (
            <button
              onClick={() => setMobileOpen(false)}
              className="ml-auto shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
              aria-label="Close menu"
            >
              <IconX />
            </button>
          ) : (!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              title="Collapse sidebar"
              className="ml-auto shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
            >
              <IconChevron collapsed={false} />
            </button>
          ))}
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 space-y-0.5" onClick={() => mobile && setMobileOpen(false)}>
          <SectionLabel label="Chat" collapsed={collapsed && !mobile} />
          <SideNavItem to="/playground" icon={<IconChat />} label="Chat"  collapsed={collapsed && !mobile} />
          <SideNavItem to="/compare"   icon={<IconArena />}  label="Arena"  collapsed={collapsed && !mobile} />
          <SideNavItem to="/debate"    icon={<IconDebate />} label="Debate" collapsed={collapsed && !mobile} />

          <SectionLabel label="Manage" collapsed={collapsed && !mobile} />
          <SideNavItem to="/models"    icon={<IconModels />}   label="Models"    collapsed={collapsed && !mobile} />
          <SideNavItem to="/keys"      icon={<IconKeys />}     label="Keys"      collapsed={collapsed && !mobile} />
          <SideNavItem to="/fallback"  icon={<IconFallback />} label="Fallback"  collapsed={collapsed && !mobile} />
          <SideNavItem to="/analytics" icon={<IconAnalytics />}label="Analytics" collapsed={collapsed && !mobile} />

          <SectionLabel label="Developer" collapsed={collapsed && !mobile} />
          <SideNavItem to="/dev-corner" icon={<IconDev />}   label="Dev Corner" collapsed={collapsed && !mobile} />
        </nav>

        {/* Bottom controls */}
        <div className="px-2 py-3 border-t border-border space-y-1 shrink-0">
          {(!collapsed || mobile) && (
            <>
              {localDbEnabled && cloudDbAvailable && (
                <button
                  onClick={() => setDatabaseMode('cloud')}
                  className="w-full text-left text-[10px] font-semibold text-violet-500 uppercase tracking-wider bg-violet-500/5 border border-violet-500/10 rounded-lg px-3 py-1.5 hover:bg-violet-500/10 transition-colors"
                >
                  Switch to Cloud
                </button>
              )}
              {localDbEnabled && !cloudDbAvailable && (
                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5">
                  Local-Only Mode
                </span>
              )}
              {!localDbEnabled && (
                <div className="space-y-1">
                  <span className="block text-[10px] font-bold text-emerald-500 uppercase tracking-wider bg-emerald-500/5 border border-emerald-500/10 rounded-lg px-3 py-1.5">
                    Cloud Connected
                  </span>
                  <button
                    onClick={() => setShowSwitchModal(true)}
                    className="w-full text-left text-[10px] font-semibold text-violet-500 uppercase tracking-wider bg-violet-500/5 border border-violet-500/10 rounded-lg px-3 py-1.5 hover:bg-violet-500/10 transition-colors"
                  >
                    Switch to Local
                  </button>
                </div>
              )}
            </>
          )}
          <button
            onClick={() => setShowTour(true)}
            title="Start Onboarding Tour"
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-violet-600 dark:text-violet-400 hover:text-violet-500 hover:bg-violet-500/10 transition-colors"
          >
            <span className="shrink-0 text-xs">✨</span>
            {(!collapsed || mobile) && <span>Onboarding Tour</span>}
          </button>
          <DarkModeToggle collapsed={collapsed && !mobile} />
          {!localDbEnabled && user && (!collapsed || mobile) && (
            <button
              onClick={logout}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-red-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Sign Out
            </button>
          )}
        </div>
      </>
    )
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* ── Desktop Sidebar (hidden on mobile) ── */}
      <aside className={`hidden md:flex ${sidebarW} shrink-0 flex-col border-r border-border bg-background/95 backdrop-blur sticky top-0 h-screen overflow-hidden transition-all duration-200 z-40`}>
        <SidebarContent />
      </aside>

      {/* ── Mobile Drawer Overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          aria-modal="true"
          role="dialog"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer panel */}
          <aside className="absolute left-0 top-0 h-full w-[260px] flex flex-col border-r border-border bg-background shadow-2xl">
            <SidebarContent mobile />
          </aside>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0 overflow-auto">
        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-30 flex items-center gap-3 h-14 px-4 border-b border-border bg-background/95 backdrop-blur">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
            aria-label="Open menu"
          >
            <IconMenu />
          </button>
          <img src={logoUrl} alt="OmniKey AI" className="h-5 w-5 object-contain" />
          <span className="font-semibold text-sm tracking-tight">OmniKey AI</span>
          <div className="ml-auto">
            <MobileThemeToggle />
          </div>
        </div>

        <main className="max-w-6xl mx-auto px-3 sm:px-6 py-5 sm:py-8">
          <Routes>
            <Route path="/"           element={<Navigate to="/keys" replace />} />
            <Route path="/playground" element={<PlaygroundPage />} />
            <Route path="/compare"    element={<ComparePage />} />
            <Route path="/debate"     element={<DebatePage />} />
            <Route path="/keys"       element={<KeysPage />} />
            <Route path="/fallback"   element={<FallbackPage />} />
            <Route path="/analytics"  element={<AnalyticsPage />} />
            <Route path="/models"     element={<ModelsPage />} />
            <Route path="/dev-corner" element={<DevCornerPage />} />
            <Route path="/test"       element={<Navigate to="/keys" replace />} />
            <Route path="/health"     element={<Navigate to="/keys" replace />} />
          </Routes>
        </main>
      </div>

      <ConfirmationModal
        isOpen={showSwitchModal}
        title="Switch to Local-First Mode?"
        description="Only switch to local-first mode if you have run the project locally on your device; otherwise, it would not work."
        confirmLabel="Switch"
        cancelLabel="Cancel"
        onConfirm={() => { setShowSwitchModal(false); setDatabaseMode('local') }}
        onCancel={() => setShowSwitchModal(false)}
      />
      <OnboardingTour isOpen={showTour} onClose={() => setShowTour(false)} />
    </div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Routes>
            <Route path="/"       element={<LandingPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/*"     element={<DashboardLayout />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
