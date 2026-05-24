import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface AdminStats {
  system: {
    totalUsers: number;
    totalKeys: number;
    activeKeys: number;
    totalRequests: number;
    successRate: number;
    overallCostSaved: number;
    averageCostSavedPerRequest: number;
    averageLatencyMs: number;
  };
  platformBreakdown: Array<{
    platform: string;
    totalRequests: number;
    successRate: number;
    tokensProcessed: number;
    avgLatencyMs: number;
    costSaved: number;
  }>;
  modelBreakdown: Array<{
    modelId: string;
    platform: string;
    totalRequests: number;
  }>;
  timeSeries: Array<{
    date: string;
    requests: number;
    successRate: number;
  }>;
  latencyDistribution: {
    fast: number;
    normal: number;
    slow: number;
    verySlow: number;
  };
  errorBreakdown: Array<{
    error: string;
    count: number;
  }>;
  recentLogs: Array<{
    createdAt: string;
    platform: string;
    modelId: string;
    status: string;
    latencyMs: number;
    inputTokens: number;
    outputTokens: number;
    error: string | null;
    userId: string;
    userEmail?: string;
  }>;
  modelsCatalog: Array<{
    platform: string;
    modelId: string;
    displayName: string;
    enabled: boolean;
  }>;
  users: Array<{
    userId: string;
    email: string;
    keysCount: number;
    requestsCount: number;
    tokensConsumed: number;
    costSaved: number;
  }>;
}

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('omnikey_admin_token'))
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'dashboard' | 'models' | 'logs' | 'security'>('dashboard')

  // Theme support
  const [dark, setDark] = useState(() =>
    typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
  )

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    if (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark')
      setDark(true)
    } else {
      document.documentElement.classList.remove('dark')
      setDark(false)
    }
  }, [])

  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  // Security Credentials Update States
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [updatingCredentials, setUpdatingCredentials] = useState(false)

  // Flush State
  const [flushingLogs, setFlushingLogs] = useState(false)

  // Model Toggle Loading Map
  const [togglingModel, setTogglingModel] = useState<Record<string, boolean>>({})

  // Fetch stats helper
  const fetchStats = async (adminToken: string) => {
    setStatsLoading(true)
    setError(null)
    try {
      const base = (import.meta.env.VITE_API_URL || import.meta.env.BASE_URL).replace(/\/$/, '')
      const response = await fetch(`${base}/api/admin/stats`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      })
      if (!response.ok) {
        if (response.status === 401) {
          handleLogout()
          throw new Error('Admin session expired. Please log in again.')
        }
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error?.message || `HTTP ${response.status}`)
      }
      const data = await response.json()
      setStats(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setStatsLoading(false)
    }
  }

  useEffect(() => {
    if (token) {
      fetchStats(token)
    }
  }, [token])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const base = (import.meta.env.VITE_API_URL || import.meta.env.BASE_URL).replace(/\/$/, '')
      const response = await fetch(`${base}/api/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error?.message || 'Invalid admin credentials')
      }

      const data = await response.json()
      localStorage.setItem('omnikey_admin_token', data.token)
      setToken(data.token)
      setUsername('')
      setPassword('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('omnikey_admin_token')
    setToken(null)
    setStats(null)
    setActiveTab('dashboard')
  }

  // Update Username/Password
  const handleUpdateCredentials = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    setUpdatingCredentials(true)
    try {
      const base = (import.meta.env.VITE_API_URL || import.meta.env.BASE_URL).replace(/\/$/, '')
      const response = await fetch(`${base}/api/admin/change-credentials`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newUsername, newPassword })
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error?.message || 'Failed to update credentials')
      }

      setSuccessMsg('Admin credentials updated successfully!')
      setNewUsername('')
      setNewPassword('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUpdatingCredentials(false)
    }
  }

  // Flush Analytics Logs
  const handleFlushLogs = async () => {
    if (!window.confirm('WARNING: Are you sure you want to permanently delete all proxy logs? This cannot be undone.')) {
      return
    }
    setError(null)
    setSuccessMsg(null)
    setFlushingLogs(true)
    try {
      const base = (import.meta.env.VITE_API_URL || import.meta.env.BASE_URL).replace(/\/$/, '')
      const response = await fetch(`${base}/api/admin/flush-logs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error?.message || 'Failed to flush request logs')
      }

      setSuccessMsg('All request logs deleted successfully!')
      if (token) fetchStats(token)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setFlushingLogs(false)
    }
  }

  // Toggle Global Model Routing
  const handleToggleModel = async (modelId: string, platform: string, currentEnabled: boolean) => {
    const key = `${platform}-${modelId}`
    setTogglingModel(prev => ({ ...prev, [key]: true }))
    try {
      const base = (import.meta.env.VITE_API_URL || import.meta.env.BASE_URL).replace(/\/$/, '')
      const response = await fetch(`${base}/api/admin/toggle-model`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          modelId,
          platform,
          enabled: !currentEnabled
        })
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error?.message || 'Failed to toggle model')
      }

      // Update state locally
      if (stats) {
        const updatedCatalog = stats.modelsCatalog.map(m => {
          if (m.modelId === modelId && m.platform === platform) {
            return { ...m, enabled: !currentEnabled }
          }
          return m
        })
        setStats({ ...stats, modelsCatalog: updatedCatalog })
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setTogglingModel(prev => ({ ...prev, [key]: false }))
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 transition-colors duration-200 relative">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-[128px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px] pointer-events-none" />

        <div className="w-full max-w-md bg-white dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-slate-800/80 rounded-2xl p-8 shadow-2xl relative">
          <div className="absolute top-4 right-4">
            <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label="Toggle theme" className="h-8 w-8 p-0 rounded-full">
              {dark ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-300"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-600"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
              )}
            </Button>
          </div>

          <div className="flex flex-col items-center mb-8">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Admin Console</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Access secure system analytics & keys</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="text-xs font-semibold text-rose-500 dark:text-rose-400 bg-rose-550/10 border border-rose-500/20 rounded-lg p-3">
                {error}
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500 transition-colors"
                placeholder="admin"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500 transition-colors"
                placeholder="••••••••"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl py-6 flex items-center justify-center shadow-lg shadow-violet-600/20 transition-all text-xs"
            >
              {loading ? 'Authenticating...' : 'Sign In as Admin'}
            </Button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-6 md:p-10 relative transition-colors duration-200">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-violet-600/5 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-emerald-600/5 rounded-full blur-[160px] pointer-events-none" />

      {/* Header */}
      <header className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800/80 mb-6 relative">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              OmniKey AI <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded bg-violet-500/20 text-violet-600 dark:text-violet-400 border border-violet-500/30">Console</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Dual-database cloud admin system management panel</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label="Toggle theme" className="h-9 w-9 p-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40">
            {dark ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-300"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-600"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchStats(token)}
            disabled={statsLoading}
            className="text-xs font-semibold text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 bg-white dark:bg-slate-900/40 rounded-xl h-9 px-4"
          >
            {statsLoading ? 'Refreshing...' : 'Refresh Stats'}
          </Button>
          <Button
            onClick={handleLogout}
            className="text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-xl h-9 px-4 shadow-lg shadow-rose-600/10 transition-all border-none"
          >
            Log Out
          </Button>
        </div>
      </header>

      {/* Navigation tabs row */}
      <section className="max-w-7xl mx-auto flex items-center border-b border-slate-200 dark:border-slate-800 mb-8">
        {(['dashboard', 'models', 'logs', 'security'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab)
              setError(null)
              setSuccessMsg(null)
            }}
            className={`text-xs font-semibold tracking-wider uppercase px-5 py-3 border-b-2 transition-all ${
              activeTab === tab 
                ? 'border-violet-500 text-violet-600 dark:text-violet-400 font-bold' 
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </section>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto space-y-8 relative">
        {error && (
          <div className="text-xs font-semibold text-rose-500 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
            {successMsg}
          </div>
        )}

        {/* -------------------- 1. DASHBOARD TAB -------------------- */}
        {activeTab === 'dashboard' && (
          <>
            {/* System High-Level Cards Grid */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 shadow-sm">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Users</span>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">{stats?.system?.totalUsers ?? '—'}</div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Registered developer accounts</div>
              </div>

              <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 shadow-sm">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">API Keys</span>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">{stats?.system?.totalKeys ?? '—'}</div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1">
                  <span>{stats?.system?.activeKeys ?? 0} healthy / active</span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 shadow-sm relative overflow-hidden">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Overall Savings</span>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1.5">₹{stats?.system?.overallCostSaved !== undefined ? (stats.system.overallCostSaved * 83).toFixed(2) : '—'}</div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Free-tier value mapped</div>
              </div>

              <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 shadow-sm">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Avg saved / Request</span>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">
                  ₹{stats?.system?.averageCostSavedPerRequest !== undefined ? (stats.system.averageCostSavedPerRequest * 83).toFixed(4) : '—'}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Average value per routing</div>
              </div>
            </section>

            {/* Performance Stats Row */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Total Requests</span>
                  <span className="text-xl font-bold text-slate-900 dark:text-white mt-1 block">{stats?.system?.totalRequests ?? '—'}</span>
                </div>
                <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center text-slate-500 dark:text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Overall Success Rate</span>
                  <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
                    {stats?.system?.successRate !== undefined ? `${stats.system.successRate.toFixed(1)}%` : '—'}
                  </span>
                </div>
                <div className="h-10 w-10 rounded-lg bg-emerald-500/5 flex items-center justify-center text-emerald-600 border border-emerald-500/10">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Average Latency</span>
                  <span className="text-xl font-bold text-slate-900 dark:text-white mt-1 block">
                    {stats?.system?.averageLatencyMs !== undefined ? `${stats.system.averageLatencyMs} ms` : '—'}
                  </span>
                </div>
                <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center text-slate-500 dark:text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
              </div>
            </section>

            {/* Richer Statistics Details */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Latency Distribution */}
              <div className="bg-white dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800/80 rounded-xl p-6 shadow-sm">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-5 uppercase tracking-wider flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                  Latency Range distribution
                </h2>
                {stats?.latencyDistribution ? (
                  <div className="space-y-4">
                    {[
                      { label: 'Instant (<200ms)', key: 'fast', color: 'from-emerald-500 to-teal-400' },
                      { label: 'Standard (200ms - 1s)', key: 'normal', color: 'from-violet-500 to-indigo-500' },
                      { label: 'Delayed (1s - 3s)', key: 'slow', color: 'from-amber-500 to-orange-400' },
                      { label: 'Severe (>3s)', key: 'verySlow', color: 'from-rose-500 to-red-500' }
                    ].map(bucket => {
                      const count = (stats.latencyDistribution as any)[bucket.key] || 0
                      const max = Math.max(1, ...Object.values(stats.latencyDistribution))
                      const percent = (count / max) * 100
                      return (
                        <div key={bucket.key} className="space-y-1.5">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-slate-600 dark:text-slate-300">{bucket.label}</span>
                            <span className="text-slate-500 dark:text-slate-400">{count} queries</span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-950 h-2 rounded-full overflow-hidden">
                            <div 
                              className={`bg-gradient-to-r ${bucket.color} h-full rounded-full`} 
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 text-center py-10">No latency reports found.</div>
                )}
              </div>

              {/* Error breakdowns */}
              <div className="bg-white dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800/80 rounded-xl p-6 shadow-sm">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-5 uppercase tracking-wider flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  Top Error Signatures
                </h2>
                {stats?.errorBreakdown && stats.errorBreakdown.length > 0 ? (
                  <div className="space-y-3">
                    {stats.errorBreakdown.map((err, index) => (
                      <div key={index} className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/40 rounded-xl p-3.5 flex justify-between items-center gap-3">
                        <span className="text-xs font-mono text-rose-600 dark:text-rose-300 truncate max-w-[80%]">{err.error}</span>
                        <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
                          {err.count} times
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-550 dark:text-slate-500 text-center py-10">Zero system routing errors detected. Healthy state!</div>
                )}
              </div>
            </section>

            {/* Platform Utilization */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <section className="bg-white dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800/80 rounded-xl p-6 shadow-sm">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-5 uppercase tracking-wider flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                  Platform Utilization & Savings
                </h2>
                {stats?.platformBreakdown && stats.platformBreakdown.length > 0 ? (
                  <div className="space-y-4">
                    {stats.platformBreakdown.map(p => (
                      <div key={p.platform} className="bg-slate-55 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/50 rounded-xl p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 capitalize">{p.platform}</span>
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                            saved ₹{(p.costSaved * 83).toFixed(2)}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-white dark:bg-slate-950/40 p-2 rounded-lg border border-slate-100 dark:border-transparent">
                            <div className="text-[10px] text-slate-500 font-medium uppercase">Requests</div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white mt-1">{p.totalRequests}</div>
                          </div>
                          <div className="bg-white dark:bg-slate-950/40 p-2 rounded-lg border border-slate-100 dark:border-transparent">
                            <div className="text-[10px] text-slate-500 font-medium uppercase">Success</div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white mt-1">{p.successRate.toFixed(1)}%</div>
                          </div>
                          <div className="bg-white dark:bg-slate-950/40 p-2 rounded-lg border border-slate-100 dark:border-transparent">
                            <div className="text-[10px] text-slate-500 font-medium uppercase">Avg Latency</div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white mt-1">{p.avgLatencyMs}ms</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 text-center py-10">No platform records.</div>
                )}
              </section>

              {/* Model Popularity */}
              <section className="bg-white dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800/80 rounded-xl p-6 shadow-sm">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-5 uppercase tracking-wider flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  Top Routed Models
                </h2>
                {stats?.modelBreakdown && stats.modelBreakdown.length > 0 ? (
                  <div className="space-y-4">
                    {stats.modelBreakdown.map((m) => {
                      const maxRequests = Math.max(...stats.modelBreakdown.map(x => x.totalRequests))
                      const pct = maxRequests > 0 ? (m.totalRequests / maxRequests) * 100 : 0
                      return (
                        <div key={m.modelId} className="space-y-1.5">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-slate-700 dark:text-slate-300 font-mono text-[11px]">{m.modelId}</span>
                            <span className="text-slate-500 dark:text-slate-400 text-[10px]">{m.totalRequests} hits</span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-950 h-2 rounded-full overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-violet-600 to-indigo-500 h-full rounded-full" 
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 text-center py-10">No model statistics.</div>
                )}
              </section>
            </div>

            {/* Time Series */}
            <section className="bg-white dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800/80 rounded-xl p-6 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-5 uppercase tracking-wider flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                Request Volume (Last 30 Days)
              </h2>
              {stats?.timeSeries && stats.timeSeries.length > 0 ? (
                <div className="flex items-end gap-2.5 h-36 pt-4 border-b border-slate-200 dark:border-slate-800">
                  {stats.timeSeries.map((t) => {
                    const maxReq = Math.max(...stats.timeSeries.map(x => x.requests))
                    const heightPct = maxReq > 0 ? (t.requests / maxReq) * 80 + 10 : 10
                    return (
                      <div key={t.date} className="flex-1 flex flex-col items-center group relative cursor-pointer">
                        <div className="absolute -top-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-sm text-slate-900 dark:text-white">
                          {t.requests} reqs ({t.successRate.toFixed(0)}% ok)
                        </div>
                        <div 
                          className="w-full bg-violet-500/20 group-hover:bg-violet-500/40 border-t border-violet-500/50 rounded-t transition-all" 
                          style={{ height: `${heightPct}%` }}
                        />
                        <span className="text-[9px] text-slate-500 mt-2 font-mono truncate w-full text-center">
                          {t.date.split('-').slice(1).join('/')}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-xs text-slate-500 text-center py-10">No logs over 30 days.</div>
              )}
            </section>

            {/* Registered Users */}
            <section className="bg-white dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800/80 rounded-xl p-6 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-5 uppercase tracking-wider flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Registered Developer Accounts
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                      <th className="pb-3 pl-4">Developer Account</th>
                      <th className="pb-3 text-center">Keys Whitelisted</th>
                      <th className="pb-3 text-center">API Requests</th>
                      <th className="pb-3 text-center">Tokens Saved</th>
                      <th className="pb-3 text-right pr-4">Total Savings (INR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats?.users && stats.users.length > 0 ? (
                      stats.users.map(u => (
                        <tr key={u.userId} className="border-b border-slate-100 dark:border-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-900/10 transition-colors text-slate-700 dark:text-slate-300">
                          <td className="py-4 pl-4 font-semibold text-slate-900 dark:text-slate-200">
                            <div>{u.email}</div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">UID: {u.userId}</div>
                          </td>
                          <td className="py-4 text-center text-slate-800 dark:text-slate-300 font-semibold">{u.keysCount} keys</td>
                          <td className="py-4 text-center text-slate-800 dark:text-slate-300 font-semibold">{u.requestsCount} reqs</td>
                          <td className="py-4 text-center text-slate-500 dark:text-slate-400 font-mono">{(u.tokensConsumed / 1000).toFixed(1)}k</td>
                          <td className="py-4 text-right pr-4 font-bold text-emerald-600 dark:text-emerald-400">₹{(u.costSaved * 83).toFixed(2)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-10 text-slate-550 dark:text-slate-500 text-center">No active user accounts.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {/* -------------------- 2. MODELS TAB -------------------- */}
        {activeTab === 'models' && (
          <section className="bg-white dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800/80 rounded-xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                  Platform routing configurations
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Enable or disable specific language models globally from proxy loadbalancing.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stats?.modelsCatalog && stats.modelsCatalog.length > 0 ? (
                stats.modelsCatalog.map(model => {
                  const key = `${model.platform}-${model.modelId}`
                  const loading = !!togglingModel[key]
                  return (
                    <div key={key} className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 dark:text-white">{model.displayName}</span>
                          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-extrabold bg-slate-200 dark:bg-slate-850 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-800">
                            {model.platform}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-500 font-mono mt-1 select-all">{model.modelId}</div>
                      </div>
                      
                      <Button
                        size="sm"
                        disabled={loading}
                        onClick={() => handleToggleModel(model.modelId, model.platform, model.enabled)}
                        className={`text-xs font-semibold rounded-xl px-4 py-2 border transition-all h-8 ${
                          model.enabled
                            ? 'bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-500/10 border-rose-500/20 hover:border-rose-500/40 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {loading ? '...' : model.enabled ? 'Active' : 'Disabled'}
                      </Button>
                    </div>
                  )
                })
              ) : (
                <div className="col-span-2 text-xs text-slate-550 dark:text-slate-500 text-center py-10">No models found in database catalog catalog.</div>
              )}
            </div>
          </section>
        )}

        {/* -------------------- 3. AUDIT LOGS TAB -------------------- */}
        {activeTab === 'logs' && (
          <section className="bg-white dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800/80 rounded-xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                  Live Proxy Audit Logs
                </h2>
                <p className="text-xs text-slate-550 dark:text-slate-400 mt-1">Audit the 15 most recent routing request events processed through the proxy.</p>
              </div>
              <Button
                disabled={flushingLogs}
                onClick={handleFlushLogs}
                className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl h-9 px-4 shadow-lg shadow-rose-600/10 transition-all border-none"
              >
                {flushingLogs ? 'Flushing...' : 'Flush Audit Logs'}
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                    <th className="pb-3 pl-4">Timestamp</th>
                    <th className="pb-3">Developer Email</th>
                    <th className="pb-3">Model Details</th>
                    <th className="pb-3 text-center">Status</th>
                    <th className="pb-3 text-center">Latency</th>
                    <th className="pb-3 text-right pr-4">Tokens (I/O)</th>
                  </tr>
                </thead>
                <tbody>
                  {stats?.recentLogs && stats.recentLogs.length > 0 ? (
                    stats.recentLogs.map((log, index) => (
                      <tr key={index} className="border-b border-slate-100 dark:border-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-900/10 transition-colors text-slate-700 dark:text-slate-300">
                        <td className="py-4 pl-4 font-mono text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="py-4 font-mono text-[10px] text-slate-500 dark:text-slate-400 select-all">
                          {log.userEmail || log.userId}
                        </td>
                        <td className="py-4">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{log.modelId}</span>
                            <span className="text-[9px] uppercase tracking-wider font-extrabold px-1 rounded bg-slate-200 dark:bg-slate-950 text-slate-555 dark:text-slate-500">
                              {log.platform}
                            </span>
                          </div>
                          {log.error && (
                            <div className="text-[10px] text-rose-500 dark:text-rose-400 mt-1 max-w-xs truncate font-mono">{log.error}</div>
                          )}
                        </td>
                        <td className="py-4 text-center">
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                            log.status === 'success'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/10'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="py-4 text-center text-slate-800 dark:text-slate-300 font-semibold">{log.latencyMs}ms</td>
                        <td className="py-4 text-right pr-4 font-mono text-slate-500 dark:text-slate-400">
                          {log.inputTokens} / {log.outputTokens}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-10 text-slate-500 text-center">No proxy requests processed. Logs directory empty.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* -------------------- 4. SECURITY TAB -------------------- */}
        {activeTab === 'security' && (
          <section className="max-w-md bg-white dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800/80 rounded-xl p-6 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
              Change Admin Credentials
            </h2>

            <form onSubmit={handleUpdateCredentials} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">New Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  className="w-full bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500 transition-colors"
                  placeholder="New Username"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500 transition-colors"
                  placeholder="••••••••"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={updatingCredentials}
                className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl py-5 flex items-center justify-center shadow-lg shadow-violet-600/20 transition-all text-xs border-none"
              >
                {updatingCredentials ? 'Updating...' : 'Update Admin Credentials'}
              </Button>
            </form>
          </section>
        )}
      </main>
    </div>
  )
}
