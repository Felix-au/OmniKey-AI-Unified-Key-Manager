import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/lib/AuthContext'
import { Switch } from '@/components/ui/switch'

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
    totalProjects?: number;
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
    errorRate?: number;
  }>;
  adminEmails?: Array<{ email: string; isFundingProvider: boolean }>;
  promoUsers?: Array<{
    userId: string;
    email: string;
    tokensUsed: number;
    tokensLimit: number;
    createdAt: string;
    inputTokens: number;
    outputTokens: number;
    requestsCount: number;
  }>;
  projects?: Array<{
    id: string;
    name: string;
    projectKey: string;
    format: string;
    enabled: boolean;
    isPromoted: boolean;
    createdAt: string;
    userEmail: string;
    metrics: {
      totalRequests: number;
      successRate: number;
      errorRate: number;
      totalTokens: number;
      avgLatencyMs: number;
      lastUsedAt: string | null;
    };
  }>;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}

export default function AdminPage() {
  const { localDbEnabled } = useAuth()
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('omnikey_admin_token'))
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [adminEmails, setAdminEmails] = useState<Array<{ email: string; isFundingProvider: boolean }>>([])
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [addingEmail, setAddingEmail] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [removingPromoUserId, setRemovingPromoUserId] = useState<string | null>(null)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)

  // Developer accounts sorting
  const [userSortKey, setUserSortKey] = useState<'email' | 'keysCount' | 'requestsCount' | 'tokensConsumed' | 'costSaved' | 'errorRate'>('requestsCount')
  const [userSortOrder, setUserSortOrder] = useState<'asc' | 'desc'>('desc')

  const handleUserSort = (key: typeof userSortKey) => {
    if (userSortKey === key) {
      setUserSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setUserSortKey(key)
      setUserSortOrder(key === 'email' ? 'asc' : 'desc')
    }
  }

  const renderSortIndicator = (key: typeof userSortKey) => {
    if (userSortKey !== key) {
      return <span className="text-slate-350 dark:text-zinc-650 ml-1 text-[10px] select-none opacity-40 hover:opacity-100">↕</span>
    }
    return <span className="text-violet-500 dark:text-violet-400 font-bold ml-1 text-[10px] select-none">{userSortOrder === 'asc' ? '▲' : '▼'}</span>
  }

  const sortedUsers = [...(stats?.users || [])].sort((a, b) => {
    let aVal: any = a[userSortKey] ?? 0
    let bVal: any = b[userSortKey] ?? 0

    if (userSortKey === 'email') {
      aVal = a.email.toLowerCase()
      bVal = b.email.toLowerCase()
      return userSortOrder === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal)
    }

    return userSortOrder === 'asc' ? aVal - bVal : bVal - aVal
  })

  // Promo user accounts sorting
  const [promoSortKey, setPromoSortKey] = useState<'email' | 'tokensLimit' | 'remaining' | 'tokensUsed' | 'inputTokens' | 'outputTokens' | 'requestsCount' | 'usedPct'>('requestsCount')
  const [promoSortOrder, setPromoSortOrder] = useState<'asc' | 'desc'>('desc')

  const handlePromoSort = (key: typeof promoSortKey) => {
    if (promoSortKey === key) {
      setPromoSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setPromoSortKey(key)
      setPromoSortOrder(key === 'email' ? 'asc' : 'desc')
    }
  }

  const renderPromoSortIndicator = (key: typeof promoSortKey) => {
    if (promoSortKey !== key) {
      return <span className="text-slate-350 dark:text-zinc-650 ml-1 text-[10px] select-none opacity-40 hover:opacity-100">↕</span>
    }
    return <span className="text-violet-500 dark:text-violet-400 font-bold ml-1 text-[10px] select-none">{promoSortOrder === 'asc' ? '▲' : '▼'}</span>
  }

  const sortedPromoUsers = [...(stats?.promoUsers || [])].sort((a, b) => {
    let aVal: any = 0
    let bVal: any = 0

    if (promoSortKey === 'email') {
      aVal = a.email.toLowerCase()
      bVal = b.email.toLowerCase()
      return promoSortOrder === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal)
    } else if (promoSortKey === 'remaining') {
      aVal = Math.max(0, a.tokensLimit - a.tokensUsed)
      bVal = Math.max(0, b.tokensLimit - b.tokensUsed)
    } else if (promoSortKey === 'usedPct') {
      aVal = a.tokensLimit > 0 ? (a.tokensUsed / a.tokensLimit) : 0
      bVal = b.tokensLimit > 0 ? (b.tokensUsed / b.tokensLimit) : 0
    } else {
      aVal = a[promoSortKey] ?? 0
      bVal = b[promoSortKey] ?? 0
    }

    return promoSortOrder === 'asc' ? aVal - bVal : bVal - aVal
  })

  // Registered projects sorting
  // Registered projects sorting
  const [projectSortKey, setProjectSortKey] = useState<'name' | 'userEmail' | 'totalRequests' | 'errorRate' | 'avgLatencyMs' | 'totalTokens' | 'createdAt'>('createdAt')
  const [projectSortOrder, setProjectSortOrder] = useState<'asc' | 'desc'>('desc')

  const handleProjectSort = (key: typeof projectSortKey) => {
    if (projectSortKey === key) {
      setProjectSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setProjectSortKey(key)
      setProjectSortOrder(key === 'createdAt' || key === 'name' || key === 'userEmail' ? 'asc' : 'desc')
    }
  }

  const renderProjectSortIndicator = (key: typeof projectSortKey) => {
    if (projectSortKey !== key) {
      return <span className="text-slate-350 dark:text-zinc-650 ml-1 text-[10px] select-none opacity-40 hover:opacity-100">↕</span>
    }
    return <span className="text-violet-500 dark:text-violet-400 font-bold ml-1 text-[10px] select-none">{projectSortOrder === 'asc' ? '▲' : '▼'}</span>
  }

  const sortedProjects = [...(stats?.projects || [])].sort((a, b) => {
    let aVal: any = 0
    let bVal: any = 0

    if (projectSortKey === 'name') {
      aVal = a.name.toLowerCase()
      bVal = b.name.toLowerCase()
      return projectSortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    } else if (projectSortKey === 'userEmail') {
      aVal = a.userEmail.toLowerCase()
      bVal = b.userEmail.toLowerCase()
      return projectSortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    } else if (projectSortKey === 'totalRequests') {
      aVal = a.metrics?.totalRequests ?? 0
      bVal = b.metrics?.totalRequests ?? 0
    } else if (projectSortKey === 'errorRate') {
      aVal = a.metrics?.errorRate ?? 0
      bVal = b.metrics?.errorRate ?? 0
    } else if (projectSortKey === 'avgLatencyMs') {
      aVal = a.metrics?.avgLatencyMs ?? 0
      bVal = b.metrics?.avgLatencyMs ?? 0
    } else if (projectSortKey === 'totalTokens') {
      aVal = a.metrics?.totalTokens ?? 0
      bVal = b.metrics?.totalTokens ?? 0
    } else if (projectSortKey === 'createdAt') {
      aVal = new Date(a.createdAt).getTime()
      bVal = new Date(b.createdAt).getTime()
    }

    return projectSortOrder === 'asc' ? aVal - bVal : bVal - aVal
  })

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'dashboard' | 'models' | 'projects' | 'logs' | 'security' | 'promo'>('dashboard')

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
  const [showFlushConfirm, setShowFlushConfirm] = useState(false)

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
    if (stats?.adminEmails) {
      setAdminEmails(stats.adminEmails)
    }
  }, [stats])

  useEffect(() => {
    if (token) {
      fetchStats(token)
    }
  }, [token])

  const handleGoogleLogin = async () => {
    setError(null)
    setLoading(true)
    try {
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      const idToken = await result.user.getIdToken()

      const base = (import.meta.env.VITE_API_URL || import.meta.env.BASE_URL).replace(/\/$/, '')
      const response = await fetch(`${base}/api/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ idToken })
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error?.message || 'Unauthorized admin account')
      }

      const data = await response.json()
      localStorage.setItem('omnikey_admin_token', data.token)
      setToken(data.token)
    } catch (err: any) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddAdminEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAdminEmail) return
    setError(null)
    setSuccessMsg(null)
    setAddingEmail(true)
    try {
      const base = (import.meta.env.VITE_API_URL || import.meta.env.BASE_URL).replace(/\/$/, '')
      const response = await fetch(`${base}/api/admin/emails`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: newAdminEmail })
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error?.message || 'Failed to add admin email')
      }

      setSuccessMsg('Admin email added successfully!')
      setAdminEmails(prev => [{ email: newAdminEmail.trim().toLowerCase(), isFundingProvider: false }, ...prev])
      setNewAdminEmail('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setAddingEmail(false)
    }
  }

  const handleRemoveAdminEmail = async (emailToRemove: string) => {
    setError(null)
    setSuccessMsg(null)
    try {
      const base = (import.meta.env.VITE_API_URL || import.meta.env.BASE_URL).replace(/\/$/, '')
      const response = await fetch(`${base}/api/admin/emails`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: emailToRemove })
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error?.message || 'Failed to remove admin email')
      }

      setSuccessMsg('Admin email removed successfully!')
      setAdminEmails(prev => prev.filter(e => e.email !== emailToRemove))
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleRemovePromoUser = async (userIdToRemove: string) => {
    setError(null)
    setSuccessMsg(null)
    setRemovingPromoUserId(userIdToRemove)
    try {
      const base = (import.meta.env.VITE_API_URL || import.meta.env.BASE_URL).replace(/\/$/, '')
      const response = await fetch(`${base}/api/admin/promo/${userIdToRemove}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error?.message || 'Failed to remove user from promo pool')
      }

      setSuccessMsg('User removed from promo pool successfully!')
      if (token) fetchStats(token)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setRemovingPromoUserId(null)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Are you sure you want to completely delete this user's account? All their configurations and whitelisted keys will be permanently deleted.")) {
      return
    }

    setError(null)
    setSuccessMsg(null)
    setDeletingUserId(userId)
    try {
      const base = (import.meta.env.VITE_API_URL || import.meta.env.BASE_URL).replace(/\/$/, '')
      const response = await fetch(`${base}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error?.message || 'Failed to delete user account')
      }

      setSuccessMsg('User account deleted successfully!')
      if (token) fetchStats(token)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setDeletingUserId(null)
    }
  }

  const handleToggleFunding = async (email: string, isFundingProvider: boolean) => {
    setError(null)
    setSuccessMsg(null)
    try {
      const base = (import.meta.env.VITE_API_URL || import.meta.env.BASE_URL).replace(/\/$/, '')
      const response = await fetch(`${base}/api/admin/emails/toggle-funding`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, isFundingProvider })
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error?.message || 'Failed to update funding provider status')
      }

      setSuccessMsg('Funding provider status updated successfully!')
      setAdminEmails(prev => prev.map(e => e.email === email ? { ...e, isFundingProvider } : e))
    } catch (err: any) {
      setError(err.message)
    }
  }

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
  const handleFlushLogs = () => {
    setShowFlushConfirm(true)
  }

  const executeFlushLogs = async () => {
    setShowFlushConfirm(false)
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
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-zinc-950 p-6 transition-colors duration-200 relative">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-[128px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px] pointer-events-none" />

        <div className="w-full max-w-md bg-white dark:bg-zinc-900/40 backdrop-blur-xl border border-slate-200 dark:border-zinc-800/80 rounded-2xl p-8 shadow-2xl relative">
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
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Access secure system analytics & keys</p>
          </div>

          {localDbEnabled ? (
            <form onSubmit={handleLogin} className="space-y-5">
              {error && (
                <div className="text-xs font-semibold text-rose-500 dark:text-rose-400 bg-rose-550/10 border border-rose-550/20 rounded-lg p-3">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-300 uppercase tracking-wider mb-2">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500 transition-colors"
                  placeholder="admin"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-300 uppercase tracking-wider mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500 transition-colors"
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
          ) : (
            <div className="space-y-5">
              {error && (
                <div className="text-xs font-semibold text-rose-500 dark:text-rose-400 bg-rose-550/10 border border-rose-550/20 rounded-lg p-3">
                  {error}
                </div>
              )}

              <Button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full py-6 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-905 dark:text-white font-semibold text-xs flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-zinc-800/80 transition-all shadow-sm"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                {loading ? 'Connecting Google Account...' : 'Sign In with Google'}
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 p-6 md:p-10 relative transition-colors duration-200">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-violet-600/5 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-emerald-600/5 rounded-full blur-[160px] pointer-events-none" />

      {/* Header */}
      <header className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-zinc-800/80 mb-6 relative">
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
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Dual-database cloud admin system management panel</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label="Toggle theme" className="h-9 w-9 p-0 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
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
            className="text-xs font-semibold text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-900 bg-white dark:bg-zinc-900/40 rounded-xl h-9 px-4"
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
      <section className="max-w-7xl mx-auto flex justify-center items-center border-b border-slate-200 dark:border-zinc-800 mb-8">
        {(['dashboard', 'models', 'projects', 'logs', 'security', 'promo'] as const).map(tab => (
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
                : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-slate-200'
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
          <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-450 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
            {successMsg}
          </div>
        )}

        {/* -------------------- 1. DASHBOARD TAB -------------------- */}
        {activeTab === 'dashboard' && (
          <>
            {/* System High-Level Cards Grid */}
            <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="bg-white dark:bg-zinc-900/30 border border-slate-200 dark:border-zinc-800/80 rounded-xl p-5 shadow-sm">
                <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Total Users</span>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">{stats?.system?.totalUsers ?? '—'}</div>
                <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">Registered developer accounts</div>
              </div>

              <div className="bg-white dark:bg-zinc-900/30 border border-slate-200 dark:border-zinc-800/80 rounded-xl p-5 shadow-sm">
                <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Projects Registered</span>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">{stats?.system?.totalProjects ?? '—'}</div>
                <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">Registered project API keys</div>
              </div>

              <div className="bg-white dark:bg-zinc-900/30 border border-slate-200 dark:border-zinc-800/80 rounded-xl p-5 shadow-sm">
                <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">API Keys</span>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">{stats?.system?.totalKeys ?? '—'}</div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-450 flex items-center gap-1 mt-1">
                  <span>{stats?.system?.activeKeys ?? 0} healthy / active</span>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900/30 border border-slate-200 dark:border-zinc-800/80 rounded-xl p-5 shadow-sm relative overflow-hidden">
                <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Overall Savings</span>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-450 mt-1.5">₹{stats?.system?.overallCostSaved !== undefined ? (stats.system.overallCostSaved * 83).toFixed(2) : '—'}</div>
                <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">Free-tier value mapped</div>
              </div>

              <div className="bg-white dark:bg-zinc-900/30 border border-slate-200 dark:border-zinc-800/80 rounded-xl p-5 shadow-sm">
                <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Avg saved / Request</span>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">
                  ₹{stats?.system?.averageCostSavedPerRequest !== undefined ? (stats.system.averageCostSavedPerRequest * 83).toFixed(4) : '—'}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">Average value per routing</div>
              </div>
            </section>

            {/* Performance Stats Row */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-zinc-900/30 border border-slate-200 dark:border-zinc-800/80 rounded-xl p-5 flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">Total Requests</span>
                  <span className="text-xl font-bold text-slate-900 dark:text-white mt-1 block">{stats?.system?.totalRequests ?? '—'}</span>
                </div>
                <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-zinc-800/60 flex items-center justify-center text-slate-500 dark:text-zinc-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900/30 border border-slate-200 dark:border-zinc-800/80 rounded-xl p-5 flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">Overall Success Rate</span>
                  <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
                    {stats?.system?.successRate !== undefined ? `${stats.system.successRate.toFixed(1)}%` : '—'}
                  </span>
                </div>
                <div className="h-10 w-10 rounded-lg bg-emerald-500/5 flex items-center justify-center text-emerald-600 border border-emerald-500/10">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900/30 border border-slate-200 dark:border-zinc-800/80 rounded-xl p-5 flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">Average Latency</span>
                  <span className="text-xl font-bold text-slate-900 dark:text-white mt-1 block">
                    {stats?.system?.averageLatencyMs !== undefined ? `${stats.system.averageLatencyMs} ms` : '—'}
                  </span>
                </div>
                <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-zinc-800/60 flex items-center justify-center text-slate-500 dark:text-zinc-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
              </div>
            </section>

            {/* Richer Statistics Details */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Latency Distribution */}
              <div className="bg-white dark:bg-zinc-900/20 border border-slate-200 dark:border-zinc-800/80 rounded-xl p-6 shadow-sm">
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
                            <span className="text-slate-600 dark:text-zinc-300">{bucket.label}</span>
                            <span className="text-slate-500 dark:text-zinc-400">{count} queries</span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-zinc-950 h-2 rounded-full overflow-hidden">
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
              <div className="bg-white dark:bg-zinc-900/20 border border-slate-200 dark:border-zinc-800/80 rounded-xl p-6 shadow-sm">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-5 uppercase tracking-wider flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  Top Error Signatures
                </h2>
                {stats?.errorBreakdown && stats.errorBreakdown.length > 0 ? (
                  <div className="space-y-3">
                    {stats.errorBreakdown.map((err, index) => (
                      <div key={index} className="bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800/40 rounded-xl p-3.5 flex justify-between items-center gap-3">
                        <span className="text-xs font-mono text-rose-600 dark:text-rose-300 truncate max-w-[80%]">{err.error}</span>
                        <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
                          {err.count} times
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-550 dark:text-zinc-500 text-center py-10">Zero system routing errors detected. Healthy state!</div>
                )}
              </div>
            </section>

            {/* Platform Utilization */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <section className="bg-white dark:bg-zinc-900/20 border border-slate-200 dark:border-zinc-800/80 rounded-xl p-6 shadow-sm">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-5 uppercase tracking-wider flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                  Platform Utilization & Savings
                </h2>
                {stats?.platformBreakdown && stats.platformBreakdown.length > 0 ? (
                  <div className="space-y-4">
                    {stats.platformBreakdown.map(p => (
                      <div key={p.platform} className="bg-slate-55 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800/50 rounded-xl p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-700 dark:text-zinc-200 capitalize">{p.platform}</span>
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                            saved ₹{(p.costSaved * 83).toFixed(2)}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-white dark:bg-zinc-950/40 p-2 rounded-lg border border-slate-100 dark:border-transparent">
                            <div className="text-[10px] text-slate-500 font-medium uppercase">Requests</div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white mt-1">{p.totalRequests}</div>
                          </div>
                          <div className="bg-white dark:bg-zinc-950/40 p-2 rounded-lg border border-slate-100 dark:border-transparent">
                            <div className="text-[10px] text-slate-500 font-medium uppercase">Success</div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white mt-1">{p.successRate.toFixed(1)}%</div>
                          </div>
                          <div className="bg-white dark:bg-zinc-950/40 p-2 rounded-lg border border-slate-100 dark:border-transparent">
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
              <section className="bg-white dark:bg-zinc-900/20 border border-slate-200 dark:border-zinc-800/80 rounded-xl p-6 shadow-sm">
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
                            <span className="text-slate-700 dark:text-zinc-300 font-mono text-[11px]">{m.modelId}</span>
                            <span className="text-slate-500 dark:text-zinc-400 text-[10px]">{m.totalRequests} hits</span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-zinc-950 h-2 rounded-full overflow-hidden">
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
            <section className="bg-white dark:bg-zinc-900/20 border border-slate-200 dark:border-zinc-800/80 rounded-xl p-6 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-5 uppercase tracking-wider flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                Request Volume (Last 30 Days)
              </h2>
              {stats?.timeSeries && stats.timeSeries.length > 0 ? (
                <div className="flex items-end gap-2.5 h-36 pt-4 border-b border-slate-200 dark:border-zinc-800">
                  {stats.timeSeries.map((t) => {
                    const maxReq = Math.max(...stats.timeSeries.map(x => x.requests))
                    const heightPct = maxReq > 0 ? (t.requests / maxReq) * 80 + 10 : 10
                    return (
                      <div key={t.date} className="flex-1 h-full flex flex-col items-center group relative cursor-pointer">
                        <div className="absolute -top-8 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-sm text-slate-900 dark:text-white">
                          {t.requests} reqs ({t.successRate.toFixed(0)}% ok)
                        </div>
                        <div className="w-full flex-1 flex flex-col justify-end">
                          <div 
                            className="w-full bg-violet-500/20 group-hover:bg-violet-500/40 border-t border-violet-500/50 rounded-t transition-all" 
                            style={{ height: `${heightPct}%` }}
                          />
                        </div>
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
            <section className="bg-white dark:bg-zinc-900/20 border border-slate-200 dark:border-zinc-800/80 rounded-xl p-6 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-5 uppercase tracking-wider flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Registered Developer Accounts
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider">
                      <th
                        onClick={() => handleUserSort('email')}
                        className="pb-3 pl-4 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition-colors select-none"
                      >
                        Developer Account {renderSortIndicator('email')}
                      </th>
                      <th
                        onClick={() => handleUserSort('keysCount')}
                        className="pb-3 text-center cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition-colors select-none"
                      >
                        Keys Whitelisted {renderSortIndicator('keysCount')}
                      </th>
                      <th
                        onClick={() => handleUserSort('requestsCount')}
                        className="pb-3 text-center cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition-colors select-none"
                      >
                        API Requests {renderSortIndicator('requestsCount')}
                      </th>
                      <th
                        onClick={() => handleUserSort('errorRate')}
                        className="pb-3 text-center cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition-colors select-none"
                      >
                        Error Rate {renderSortIndicator('errorRate')}
                      </th>
                      <th
                        onClick={() => handleUserSort('tokensConsumed')}
                        className="pb-3 text-center cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition-colors select-none"
                      >
                        Tokens Saved {renderSortIndicator('tokensConsumed')}
                      </th>
                      <th
                        onClick={() => handleUserSort('costSaved')}
                        className="pb-3 text-center cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition-colors select-none"
                      >
                        Total Savings (INR) {renderSortIndicator('costSaved')}
                      </th>
                      {!localDbEnabled && <th className="pb-3 text-right pr-4">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedUsers && sortedUsers.length > 0 ? (
                      sortedUsers.map(u => {
                        const errRate = u.errorRate ?? 0
                        const errRateColor = errRate === 0
                          ? 'text-slate-400 dark:text-zinc-500 font-medium'
                          : errRate < 5
                            ? 'text-emerald-500 font-medium'
                            : errRate < 20
                              ? 'text-amber-500 font-medium'
                              : 'text-rose-500 font-bold'

                        return (
                          <tr key={u.userId} className="border-b border-slate-100 dark:border-zinc-800/40 hover:bg-slate-50 dark:hover:bg-zinc-900/10 transition-colors text-slate-700 dark:text-zinc-300">
                            <td className="py-4 pl-4 font-semibold text-slate-900 dark:text-zinc-200">
                              <div>{u.email}</div>
                              <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono mt-0.5">UID: {u.userId}</div>
                            </td>
                            <td className="py-4 text-center text-slate-800 dark:text-zinc-300 font-semibold">{u.keysCount} keys</td>
                            <td className="py-4 text-center text-slate-800 dark:text-zinc-300 font-semibold">{u.requestsCount} reqs</td>
                            <td className={`py-4 text-center font-semibold tabular-nums ${errRateColor}`}>{errRate.toFixed(1)}%</td>
                            <td className="py-4 text-center text-slate-500 dark:text-zinc-400 font-mono">{(u.tokensConsumed / 1000).toFixed(1)}k</td>
                            <td className="py-4 text-center font-bold text-emerald-600 dark:text-emerald-400">₹{(u.costSaved * 83).toFixed(2)}</td>
                            {!localDbEnabled && (
                              <td className="py-4 text-right pr-4">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={deletingUserId === u.userId}
                                  onClick={() => handleDeleteUser(u.userId)}
                                  className="text-xs font-semibold text-rose-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl px-3 py-1 h-7 border border-transparent hover:border-rose-500/20"
                                >
                                  {deletingUserId === u.userId ? 'Deleting...' : 'Delete'}
                                </Button>
                              </td>
                            )}
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan={localDbEnabled ? 6 : 7} className="py-10 text-slate-550 dark:text-zinc-500 text-center">No active user accounts.</td>
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
          <section className="bg-white dark:bg-zinc-900/20 border border-slate-200 dark:border-zinc-800/80 rounded-xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                  Platform routing configurations
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Enable or disable specific language models globally from proxy loadbalancing.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stats?.modelsCatalog && stats.modelsCatalog.length > 0 ? (
                stats.modelsCatalog.map(model => {
                  const key = `${model.platform}-${model.modelId}`
                  const loading = !!togglingModel[key]
                  return (
                    <div key={key} className="bg-slate-50 dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 rounded-xl p-4 flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 dark:text-white">{model.displayName}</span>
                          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-extrabold bg-slate-200 dark:bg-zinc-850 text-slate-600 dark:text-zinc-400 border border-slate-300 dark:border-zinc-800">
                            {model.platform}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-zinc-500 font-mono mt-1 select-all">{model.modelId}</div>
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
                <div className="col-span-2 text-xs text-slate-550 dark:text-zinc-500 text-center py-10">No models found in database catalog catalog.</div>
              )}
            </div>
          </section>
        )}

        {/* -------------------- Projects TAB -------------------- */}
        {activeTab === 'projects' && (
          <section className="bg-white dark:bg-zinc-900/20 border border-slate-200 dark:border-zinc-800/80 rounded-xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                  Registered Workspace Projects
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                  View and manage API client keys grouped by registered developer project workspaces.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider">
                    <th
                      onClick={() => handleProjectSort('name')}
                      className="pb-3 pl-4 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition-colors select-none"
                    >
                      Project Name {renderProjectSortIndicator('name')}
                    </th>
                    <th
                      onClick={() => handleProjectSort('userEmail')}
                      className="pb-3 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition-colors select-none"
                    >
                      Owner {renderProjectSortIndicator('userEmail')}
                    </th>
                    <th
                      onClick={() => handleProjectSort('totalRequests')}
                      className="pb-3 text-center cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition-colors select-none"
                    >
                      Requests {renderProjectSortIndicator('totalRequests')}
                    </th>
                    <th
                      onClick={() => handleProjectSort('errorRate')}
                      className="pb-3 text-center cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition-colors select-none"
                    >
                      Error Rate {renderProjectSortIndicator('errorRate')}
                    </th>
                    <th
                      onClick={() => handleProjectSort('totalTokens')}
                      className="pb-3 text-center cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition-colors select-none"
                    >
                      Tokens {renderProjectSortIndicator('totalTokens')}
                    </th>
                    <th
                      onClick={() => handleProjectSort('avgLatencyMs')}
                      className="pb-3 text-center cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition-colors select-none"
                    >
                      Avg Latency {renderProjectSortIndicator('avgLatencyMs')}
                    </th>
                    <th
                      onClick={() => handleProjectSort('createdAt')}
                      className="pb-3 text-right pr-4 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition-colors select-none"
                    >
                      Registered At {renderProjectSortIndicator('createdAt')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedProjects && sortedProjects.length > 0 ? (
                    sortedProjects.map((p) => {
                      const errorRate = p.metrics?.errorRate ?? 0

                      const errorColor = errorRate === 0
                        ? 'text-slate-400 dark:text-zinc-500 font-medium'
                        : errorRate < 5
                          ? 'text-emerald-500 font-medium'
                          : errorRate < 20
                            ? 'text-amber-500 font-medium'
                            : 'text-rose-500 font-bold'

                      return (
                        <tr key={p.id} className="border-b border-slate-100 dark:border-zinc-800/40 hover:bg-slate-50 dark:hover:bg-zinc-900/10 transition-colors text-slate-700 dark:text-zinc-300">
                          <td className="py-4 pl-4 font-semibold text-slate-900 dark:text-zinc-200">
                            <div className="flex items-center gap-2">
                              <span>{p.name}</span>
                              {p.isPromoted && (
                                <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                                  Promoted
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono mt-0.5 select-all">Key: {p.projectKey}</div>
                          </td>
                          <td className="py-4 font-mono text-[10px] text-slate-500 dark:text-zinc-400">
                            {p.userEmail}
                          </td>
                          <td className="py-4 text-center font-semibold text-slate-800 dark:text-zinc-300 tabular-nums">
                            {p.metrics?.totalRequests ?? 0} hits
                          </td>
                          <td className={`py-4 text-center font-semibold tabular-nums ${errorColor}`}>
                            {errorRate.toFixed(1)}%
                          </td>
                          <td className="py-4 text-center text-slate-500 dark:text-zinc-400 font-mono">
                            {formatTokens(p.metrics?.totalTokens ?? 0)}
                          </td>
                          <td className="py-4 text-center text-slate-800 dark:text-zinc-300 font-semibold tabular-nums">
                            {p.metrics?.avgLatencyMs ?? 0} ms
                          </td>
                          <td className="py-4 text-right pr-4 font-mono text-[10px] text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                            {new Date(p.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-10 text-slate-550 dark:text-zinc-500 text-center">No projects registered.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* -------------------- 3. AUDIT LOGS TAB -------------------- */}
        {activeTab === 'logs' && (
          <section className="bg-white dark:bg-zinc-900/20 border border-slate-200 dark:border-zinc-800/80 rounded-xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                  Live Proxy Audit Logs
                </h2>
                <p className="text-xs text-slate-550 dark:text-zinc-400 mt-1">Audit the 15 most recent routing request events processed through the proxy.</p>
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
                  <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider">
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
                      <tr key={index} className="border-b border-slate-100 dark:border-zinc-800/40 hover:bg-slate-50 dark:hover:bg-zinc-900/10 transition-colors text-slate-700 dark:text-zinc-300">
                        <td className="py-4 pl-4 font-mono text-[10px] text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="py-4 font-mono text-[10px] text-slate-500 dark:text-zinc-400 select-all">
                          {log.userEmail || log.userId}
                        </td>
                        <td className="py-4">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">{log.modelId}</span>
                            <span className="text-[9px] uppercase tracking-wider font-extrabold px-1 rounded bg-slate-200 dark:bg-zinc-950 text-slate-555 dark:text-zinc-500">
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
                              : log.status === 'fallback'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/10'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/10'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="py-4 text-center text-slate-800 dark:text-zinc-300 font-semibold">{log.latencyMs}ms</td>
                        <td className="py-4 text-right pr-4 font-mono text-slate-500 dark:text-zinc-400">
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
          <div className="max-w-xl mx-auto w-full space-y-8">
            {/* Whitelist Panel */}
            <section className="bg-white dark:bg-zinc-900/20 border border-slate-200 dark:border-zinc-800/80 rounded-xl p-6 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 mb-3">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                Admin Emails Whitelist
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mb-5">
                Manage which users can authenticate via Google to access the Admin Console.
              </p>

              <form onSubmit={handleAddAdminEmail} className="mb-6">
                <input
                  type="email"
                  value={newAdminEmail}
                  onChange={e => setNewAdminEmail(e.target.value)}
                  disabled={addingEmail}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-violet-500 transition-colors"
                  placeholder={addingEmail ? "Authorizing..." : "Type email and press Enter to authorize..."}
                  required
                />
              </form>

              <div className="space-y-2">
                {adminEmails.length > 0 ? (
                  <div className="overflow-x-auto border border-slate-200/60 dark:border-zinc-800/40 rounded-xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-zinc-950/40 border-b border-slate-200/60 dark:border-zinc-800/40">
                          <th className="px-4 py-3 text-[10px] font-bold text-slate-550 dark:text-zinc-400 uppercase tracking-wider">Email</th>
                          {!localDbEnabled && (
                            <th className="px-4 py-3 text-[10px] font-bold text-slate-550 dark:text-zinc-400 uppercase tracking-wider text-center">Fund Promo Pool</th>
                          )}
                          <th className="px-4 py-3 text-[10px] font-bold text-slate-550 dark:text-zinc-400 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60 dark:divide-zinc-800/40">
                        {adminEmails.map(({ email, isFundingProvider }) => (
                          <tr key={email} className="hover:bg-slate-50/50 dark:hover:bg-zinc-950/10 transition-colors">
                            <td className="px-4 py-3 text-xs font-mono text-slate-700 dark:text-zinc-300 truncate max-w-[200px]">{email}</td>
                            {!localDbEnabled && (
                              <td className="px-4 py-3 text-center">
                                <div className="inline-flex items-center justify-center">
                                  <Switch
                                    checked={isFundingProvider}
                                    onCheckedChange={(checked) => handleToggleFunding(email, checked)}
                                  />
                                </div>
                              </td>
                            )}
                            <td className="px-4 py-3 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={adminEmails.length <= 1}
                                onClick={() => handleRemoveAdminEmail(email)}
                                className="text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 h-7 w-7 p-0 rounded-lg"
                                title={adminEmails.length <= 1 ? "Cannot delete the last admin" : "Remove administrator"}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center text-xs text-slate-500 py-6">No admin emails configured.</div>
                )}
              </div>
            </section>

            {/* Local Credentials Config Panel */}
            {localDbEnabled && (
              <section className="bg-white dark:bg-zinc-900/20 border border-slate-200 dark:border-zinc-800/80 rounded-xl p-6 shadow-sm">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 mb-5">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                  Change Local Admin Credentials
                </h2>

                <form onSubmit={handleUpdateCredentials} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-zinc-300 uppercase tracking-wider mb-2">New Username</label>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={e => setNewUsername(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500 transition-colors"
                      placeholder="New Username"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-zinc-300 uppercase tracking-wider mb-2">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500 transition-colors"
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
          </div>
        )}

        {/* -------------------- 5. PROMO TAB -------------------- */}
        {activeTab === 'promo' && (
          <div className="max-w-6xl mx-auto w-full space-y-6">
            {localDbEnabled ? (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 text-center">
                <h2 className="text-sm font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2 flex items-center justify-center gap-2">
                  ⚠️ Cloud Feature Only
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Promotional token budgets and new user allocations are only supported in MongoDB Cloud mode.
                </p>
              </div>
            ) : (
              <>
                {/* Stats cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-zinc-900/20 border border-slate-200 dark:border-zinc-800/80 rounded-xl p-5 shadow-sm">
                    <div className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Promo Users</div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5 tabular-nums">
                      {stats?.promoUsers?.length ?? 0}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-zinc-900/20 border border-slate-200 dark:border-zinc-800/80 rounded-xl p-5 shadow-sm">
                    <div className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Total Consumed Promo</div>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-450 mt-1.5 tabular-nums">
                      {formatTokens(stats?.promoUsers?.reduce((s, u) => s + u.tokensUsed, 0) ?? 0)}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-zinc-900/20 border border-slate-200 dark:border-zinc-800/80 rounded-xl p-5 shadow-sm">
                    <div className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Total Allocated Promo</div>
                    <div className="text-2xl font-bold text-violet-650 dark:text-violet-400 mt-1.5 tabular-nums">
                      {formatTokens(stats?.promoUsers?.reduce((s, u) => s + u.tokensLimit, 0) ?? 0)}
                    </div>
                  </div>
                </div>

                {/* Main Table */}
                <section className="bg-white dark:bg-zinc-900/20 border border-slate-200 dark:border-zinc-800/80 rounded-xl p-6 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 mb-5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Promotional User Accounts & Statistics
                  </h2>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider">
                          <th
                            onClick={() => handlePromoSort('email')}
                            className="pb-3 pl-4 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition-colors select-none"
                          >
                            User Details {renderPromoSortIndicator('email')}
                          </th>
                          <th
                            onClick={() => handlePromoSort('tokensLimit')}
                            className="pb-3 text-center cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition-colors select-none"
                          >
                            Allocated {renderPromoSortIndicator('tokensLimit')}
                          </th>
                          <th
                            onClick={() => handlePromoSort('remaining')}
                            className="pb-3 text-center cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition-colors select-none"
                          >
                            Remaining {renderPromoSortIndicator('remaining')}
                          </th>
                          <th
                            onClick={() => handlePromoSort('tokensUsed')}
                            className="pb-3 text-center cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition-colors select-none"
                          >
                            Used (Aggregate) {renderPromoSortIndicator('tokensUsed')}
                          </th>
                          <th className="pb-3 text-center">Split (Input/Output)</th>
                          <th
                            onClick={() => handlePromoSort('requestsCount')}
                            className="pb-3 text-center cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition-colors select-none"
                          >
                            Requests {renderPromoSortIndicator('requestsCount')}
                          </th>
                          <th
                            onClick={() => handlePromoSort('usedPct')}
                            className="pb-3 text-center cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition-colors select-none"
                          >
                            Progress {renderPromoSortIndicator('usedPct')}
                          </th>
                          <th className="pb-3 text-right pr-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedPromoUsers && sortedPromoUsers.length > 0 ? (
                          sortedPromoUsers.map((u) => {
                            const remaining = Math.max(0, u.tokensLimit - u.tokensUsed)
                            const usedPct = u.tokensLimit > 0 ? Math.min(100, Math.round((u.tokensUsed / u.tokensLimit) * 100)) : 0
                            return (
                              <tr key={u.userId} className="border-b border-slate-100 dark:border-zinc-800/40 hover:bg-slate-50 dark:hover:bg-zinc-900/10 transition-colors text-slate-700 dark:text-zinc-300">
                                <td className="py-4 pl-4 font-semibold text-slate-900 dark:text-zinc-200">
                                  <div>{u.email}</div>
                                  <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono mt-0.5">UID: {u.userId}</div>
                                  <div className="text-[9px] text-slate-400 dark:text-zinc-500 mt-0.5">Seeded: {new Date(u.createdAt).toLocaleString()}</div>
                                </td>
                                <td className="py-4 text-center font-semibold text-slate-900 dark:text-white tabular-nums">
                                  {formatTokens(u.tokensLimit)}
                                </td>
                                <td className="py-4 text-center font-semibold text-emerald-600 dark:text-emerald-450 tabular-nums">
                                  {formatTokens(remaining)}
                                </td>
                                <td className="py-4 text-center font-semibold text-slate-600 dark:text-zinc-400 tabular-nums">
                                  {formatTokens(u.tokensUsed)}
                                </td>
                                <td className="py-4 text-center font-mono text-[10px] text-slate-550 dark:text-zinc-450 tabular-nums">
                                  {formatTokens(u.inputTokens)} / {formatTokens(u.outputTokens)}
                                </td>
                                <td className="py-4 text-center font-semibold text-slate-800 dark:text-zinc-300 tabular-nums">
                                  {u.requestsCount} reqs
                                </td>
                                <td className="py-4 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <div className="w-16 bg-slate-100 dark:bg-zinc-950 h-1.5 rounded-full overflow-hidden">
                                      <div 
                                        className="bg-emerald-500 h-full rounded-full" 
                                        style={{ width: `${usedPct}%` }}
                                      />
                                    </div>
                                    <span className="text-[10px] font-mono w-7 text-right">{usedPct}%</span>
                                  </div>
                                </td>
                                <td className="py-4 text-right pr-4">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={removingPromoUserId === u.userId}
                                    onClick={() => handleRemovePromoUser(u.userId)}
                                    className="text-xs font-semibold text-rose-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl px-3 py-1 h-7 border border-transparent hover:border-rose-500/20"
                                  >
                                    {removingPromoUserId === u.userId ? 'Removing...' : 'Remove'}
                                  </Button>
                                </td>
                              </tr>
                            )
                          })
                        ) : (
                          <tr>
                            <td colSpan={8} className="py-10 text-slate-550 dark:text-zinc-500 text-center">No promotional user accounts.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
          </div>
        )}
      </main>
      <ConfirmationModal
        isOpen={showFlushConfirm}
        title="Flush Analytics Logs?"
        description="WARNING: Are you sure you want to permanently delete all proxy logs? This cannot be undone."
        confirmLabel="Flush Logs"
        cancelLabel="Cancel"
        onConfirm={executeFlushLogs}
        onCancel={() => setShowFlushConfirm(false)}
        variant="destructive"
      />
    </div>
  )
}
