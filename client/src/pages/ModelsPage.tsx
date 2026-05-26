import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'

interface FallbackEntry {
  modelDbId: number
  priority: number
  enabled: boolean
  platform: string
  modelId: string
  displayName: string
  sizeLabel: string
  keyCount: number
  globallyDisabled: boolean
}

type CheckStatus = 'unchecked' | 'checking' | 'available' | 'unavailable'

export default function ModelsPage() {
  const { data: keyData } = useQuery<{ apiKey: string }>({
    queryKey: ['unified-key'],
    queryFn: () => apiFetch('/api/settings/api-key'),
  })

  const { data: fallbackEntries = [], isLoading } = useQuery<FallbackEntry[]>({
    queryKey: ['fallback'],
    queryFn: () => apiFetch('/api/fallback'),
  })

  // In-memory availability state
  const [availability, setAvailability] = useState<Record<string, { status: CheckStatus; error?: string }>>({})
  const [sortBy, setSortBy] = useState<string>('default')

  // Perform check for a single model
  const checkModel = async (modelId: string) => {
    setAvailability(prev => ({ ...prev, [modelId]: { status: 'checking' } }))

    try {
      const base = (import.meta.env.VITE_API_URL || import.meta.env.BASE_URL).replace(/\/$/, '')
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (keyData?.apiKey) {
        headers['Authorization'] = `Bearer ${keyData.apiKey}`
      }

      const res = await fetch(`${base}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1
        }),
      })

      if (res.ok) {
        setAvailability(prev => ({ ...prev, [modelId]: { status: 'available' } }))
      } else {
        const err = await res.json().catch(() => ({}))
        const msg = err.error?.message || `HTTP ${res.status}`
        setAvailability(prev => ({ ...prev, [modelId]: { status: 'unavailable', error: msg } }))
      }
    } catch (err: any) {
      setAvailability(prev => ({ ...prev, [modelId]: { status: 'unavailable', error: err.message } }))
    }
  }

  // Check all active models in parallel
  const checkAll = () => {
    const activeModels = fallbackEntries.filter(e => e.keyCount > 0)
    activeModels.forEach(model => {
      checkModel(model.modelId)
    })
  }

  // Sort model configurations
  const sortedEntries = [...fallbackEntries].sort((a, b) => {
    if (sortBy === 'name') {
      return a.displayName.localeCompare(b.displayName)
    }
    if (sortBy === 'platform') {
      return a.platform.localeCompare(b.platform)
    }
    if (sortBy === 'userStatus') {
      const aVal = a.keyCount > 0 && a.enabled ? 1 : 0
      const bVal = b.keyCount > 0 && b.enabled ? 1 : 0
      return bVal - aVal // Enabled first
    }
    if (sortBy === 'adminStatus') {
      const aVal = a.globallyDisabled ? 0 : 1
      const bVal = b.globallyDisabled ? 0 : 1
      return bVal - aVal // Active first
    }
    // Default: priority sort
    return a.priority - b.priority
  })

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Model Registry & Status" 
        description="View active models, user enablement preferences, and check live endpoint availability in real-time."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-card border border-border rounded-xl text-xs h-9 px-3 focus:outline-none focus:border-violet-500 text-foreground cursor-pointer"
              >
                <option value="default">Default Priority</option>
                <option value="name">Model Name (A-Z)</option>
                <option value="platform">Platform (A-Z)</option>
                <option value="userStatus">User Enabled First</option>
                <option value="adminStatus">Admin Active First</option>
              </select>
            </div>
            <Button 
              onClick={checkAll} 
              disabled={fallbackEntries.length === 0}
              className="bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl text-xs h-9 px-4 flex items-center gap-1.5 shadow-lg shadow-violet-600/15 border-none cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Check All Active
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <svg className="animate-spin h-7 w-7 text-violet-500 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-xs text-muted-foreground">Loading registry metadata...</span>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto shadow-sm">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="p-4 w-12 text-center">#</th>
                <th className="p-4">Platform</th>
                <th className="p-4">Model Name</th>
                <th className="p-4">Size</th>
                <th className="p-4">User Status</th>
                <th className="p-4">Admin Status</th>
                <th className="p-4 text-center">Availability</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sortedEntries.map((entry, index) => {
                const info = availability[entry.modelId] || { status: 'unchecked' }
                return (
                  <tr 
                    key={entry.modelDbId} 
                    className="hover:bg-muted/30 transition-colors group cursor-pointer"
                    onClick={() => {
                      if (entry.keyCount > 0) {
                        checkModel(entry.modelId)
                      }
                    }}
                  >
                    <td className="p-4 text-center text-xs font-semibold text-muted-foreground">
                      {index + 1}
                    </td>
                    <td className="p-4 font-medium text-foreground">
                      <span className="capitalize">{entry.platform}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">{entry.displayName}</span>
                        <span className="text-xs text-muted-foreground font-mono">{entry.modelId}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-900/60 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
                        {entry.sizeLabel}
                      </span>
                    </td>
                    <td className="p-4">
                      {entry.keyCount === 0 ? (
                        <span className="text-xs text-muted-foreground italic">No Keys Configured</span>
                      ) : entry.enabled ? (
                        <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-500 border border-emerald-500/20">
                          Enabled
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-slate-500/10 px-2.5 py-0.5 text-xs font-semibold text-slate-500 border border-slate-500/20">
                          Disabled
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      {entry.globallyDisabled ? (
                        <span className="inline-flex items-center rounded-md bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-500 border border-red-500/20">
                          Disabled by Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-500 border border-emerald-500/20">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                      {entry.keyCount === 0 ? (
                        <span className="text-xs text-muted-foreground italic">Unavailable</span>
                      ) : info.status === 'checking' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-500 justify-center w-full">
                          <svg className="animate-spin h-3.5 w-3.5 text-violet-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Checking...
                        </span>
                      ) : info.status === 'available' ? (
                        <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-500 border border-emerald-500/20">
                          Available
                        </span>
                      ) : info.status === 'unavailable' ? (
                        <div className="flex flex-col items-center group/tooltip relative justify-center w-full">
                          <span className="inline-flex items-center rounded-md bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-500 border border-red-500/20">
                            Offline
                          </span>
                          {info.error && (
                            <span className="absolute bottom-full mb-1 scale-0 group-hover/tooltip:scale-100 transition-all duration-150 origin-bottom bg-slate-900 text-white text-[10px] rounded px-2 py-1 max-w-[200px] shadow-lg leading-snug">
                              {info.error}
                            </span>
                          )}
                        </div>
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => checkModel(entry.modelId)}
                          className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 hover:text-violet-500 rounded-lg px-3 py-1 h-auto"
                        >
                          Check
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
