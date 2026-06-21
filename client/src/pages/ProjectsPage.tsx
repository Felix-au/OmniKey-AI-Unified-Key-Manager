import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { PageHeader } from '@/components/page-header'

interface ProjectKey {
  id: string
  name: string
  projectKey: string
  format: 'openai' | 'gemini'
  enabled: boolean
  isPromoted: boolean
  createdAt: string
  metrics?: {
    totalRequests: number
    successRate: number
    totalTokens: number
    avgLatencyMs: number
    lastUsedAt: string | null
  }
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.round(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return date.toLocaleDateString()
}

function formatTokens(n?: number): string {
  if (!n) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export default function ProjectsPage() {
  const queryClient = useQueryClient()
  const [createName, setCreateName] = useState('')
  const [createFormat, setCreateFormat] = useState<'openai' | 'gemini'>('openai')
  
  const [promoteName, setPromoteName] = useState('')
  const [promoteFormat, setPromoteFormat] = useState<'openai' | 'gemini'>('openai')

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [keyToDelete, setKeyToDelete] = useState<ProjectKey | null>(null)
  
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({})
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null)

  const { data: projectKeys = [], isLoading } = useQuery<ProjectKey[]>({
    queryKey: ['project-keys'],
    queryFn: () => apiFetch('/api/project-keys'),
  })

  const createKey = useMutation({
    mutationFn: (body: { name: string; format: string }) =>
      apiFetch('/api/project-keys', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-keys'] })
      setCreateName('')
    },
  })

  const promoteKey = useMutation({
    mutationFn: (body: { name: string; format: string }) =>
      apiFetch('/api/project-keys/promote', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-keys'] })
      setPromoteName('')
    },
    onError: (err: any) => {
      alert(err.message || 'Promotion failed')
    }
  })

  const deleteKey = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/project-keys/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-keys'] })
    },
  })

  const toggleKey = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      apiFetch(`/api/project-keys/${id}`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-keys'] })
    },
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!createName) return
    createKey.mutate({ name: createName, format: createFormat })
  }

  const handlePromote = (e: React.FormEvent) => {
    e.preventDefault()
    if (!promoteName) return
    promoteKey.mutate({ name: promoteName, format: promoteFormat })
  }

  const handleDeleteClick = (key: ProjectKey) => {
    setKeyToDelete(key)
    setConfirmOpen(true)
  }

  const handleCopy = (keyId: string, keyValue: string) => {
    navigator.clipboard.writeText(keyValue)
    setCopiedKeyId(keyId)
    setTimeout(() => setCopiedKeyId(null), 1500)
  }

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Configure app-specific API keys and monitor real-time consumption and error rates."
      />

      <div className="space-y-8">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Create Custom Key */}
          <section className="rounded-lg border bg-card p-5">
            <h2 className="text-sm font-medium mb-3">Create Project Key</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Project / App Name</Label>
                <Input
                  value={createName}
                  onChange={e => setCreateName(e.target.value)}
                  placeholder="e.g. My Mobile App"
                  className="w-full text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Key Format</Label>
                <Select value={createFormat} onValueChange={(v) => setCreateFormat(v as 'openai' | 'gemini')}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI Format (omnikey-proj-...)</SelectItem>
                    <SelectItem value="gemini">Gemini Format (omnikey-g-proj-...)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" size="sm" className="w-full" disabled={!createName || createKey.isPending}>
                {createKey.isPending ? 'Generating…' : 'Generate Project Key'}
              </Button>
            </form>
          </section>

          {/* Promote Default Key */}
          <section className="rounded-lg border bg-card p-5">
            <h2 className="text-sm font-medium mb-3">Promote Default Key</h2>
            <form onSubmit={handlePromote} className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Project / App Name</Label>
                <Input
                  value={promoteName}
                  onChange={e => setPromoteName(e.target.value)}
                  placeholder="e.g. Staging Environment"
                  className="w-full text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Unified Key to Promote</Label>
                <Select value={promoteFormat} onValueChange={(v) => setPromoteFormat(v as 'openai' | 'gemini')}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI Format Unified Key</SelectItem>
                    <SelectItem value="gemini">Gemini Format Unified Key</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" size="sm" className="w-full" variant="outline" disabled={!promoteName || promoteKey.isPending}>
                {promoteKey.isPending ? 'Promoting…' : 'Promote Key'}
              </Button>
            </form>
          </section>
        </div>

        {/* Project Keys List */}
        <section>
          <h2 className="text-sm font-medium mb-3">Project Keys</h2>
          {isLoading ? (
            <div className="rounded-lg border p-8 text-center bg-card">
              <p className="text-xs text-muted-foreground animate-pulse">Loading project keys & usage metrics…</p>
            </div>
          ) : projectKeys.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center bg-card">
              <p className="text-xs text-muted-foreground">
                No project keys created yet. Generate one above to manage key access per app/project.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border divide-y bg-card overflow-hidden">
              {projectKeys.map(k => {
                const isRevealed = !!revealedKeys[k.id]
                const masked = k.projectKey.slice(0, 15) + '•'.repeat(24)

                const reqs = k.metrics?.totalRequests ?? 0
                const rate = k.metrics?.successRate ?? 0
                const tokens = k.metrics?.totalTokens ?? 0
                const latency = k.metrics?.avgLatencyMs ?? 0
                const activeStr = formatRelativeTime(k.metrics?.lastUsedAt ?? null)

                return (
                  <div key={k.id} className="flex flex-col gap-4 p-5 hover:bg-muted/30 transition-colors">
                    {/* Top line: Name & Metadata / Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-col gap-0.5">
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          {k.name}
                          <span className="text-[10px] bg-muted text-muted-foreground border px-2 py-0.5 rounded capitalize">
                            {k.format}
                          </span>
                          {k.isPromoted && (
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded font-medium">
                              Promoted
                            </span>
                          )}
                        </h3>
                        <p className="text-[10px] text-muted-foreground">
                          Created: {new Date(k.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">{k.enabled ? 'Enabled' : 'Disabled'}</span>
                          <Switch
                            checked={k.enabled}
                            onCheckedChange={checked => toggleKey.mutate({ id: k.id, enabled: checked })}
                            disabled={toggleKey.isPending}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="xs"
                          className="text-muted-foreground hover:text-destructive h-7"
                          onClick={() => handleDeleteClick(k)}
                          disabled={deleteKey.isPending}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>

                    {/* Middle Line: Key Display / Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="text-xs font-mono bg-muted px-2.5 py-1.5 rounded truncate max-w-full sm:max-w-md">
                        {isRevealed ? k.projectKey : masked}
                      </code>
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => setRevealedKeys(prev => ({ ...prev, [k.id]: !prev[k.id] }))}
                        className="h-7 text-xs"
                      >
                        {isRevealed ? 'Hide' : 'Show'}
                      </Button>
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => handleCopy(k.id, k.projectKey)}
                        className="h-7 text-xs"
                      >
                        {copiedKeyId === k.id ? 'Copied' : 'Copy'}
                      </Button>
                    </div>

                    {/* Bottom Line: Aggregated Key Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-border/40">
                      <div className="rounded-md border bg-card/40 px-3 py-1.5">
                        <span className="text-[9px] text-muted-foreground uppercase tracking-wider block">Requests</span>
                        <span className="text-xs font-medium tabular-nums">{reqs}</span>
                      </div>
                      <div className="rounded-md border bg-card/40 px-3 py-1.5">
                        <span className="text-[9px] text-muted-foreground uppercase tracking-wider block">Success Rate</span>
                        <span className={`text-xs font-medium tabular-nums ${
                          reqs === 0 ? '' : rate >= 95 ? 'text-emerald-500' : rate >= 80 ? 'text-amber-500' : 'text-rose-500'
                        }`}>
                          {reqs === 0 ? '—' : `${rate}%`}
                        </span>
                      </div>
                      <div className="rounded-md border bg-card/40 px-3 py-1.5">
                        <span className="text-[9px] text-muted-foreground uppercase tracking-wider block">Tokens Consumed</span>
                        <span className="text-xs font-medium tabular-nums">{formatTokens(tokens)}</span>
                      </div>
                      <div className="rounded-md border bg-card/40 px-3 py-1.5">
                        <span className="text-[9px] text-muted-foreground uppercase tracking-wider block">Avg Latency</span>
                        <span className="text-xs font-medium tabular-nums">{reqs === 0 ? '—' : `${latency} ms`}</span>
                      </div>
                      <div className="rounded-md border bg-card/40 px-3 py-1.5 col-span-2 sm:col-span-1">
                        <span className="text-[9px] text-muted-foreground uppercase tracking-wider block">Last Active</span>
                        <span className="text-xs font-medium truncate block" title={k.metrics?.lastUsedAt ?? undefined}>{activeStr}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmOpen}
        title="Delete Project Key"
        description={`Are you sure you want to delete the project key "${keyToDelete?.name}"?\n\nConnected applications and projects using this key will immediately lose access and proxy requests will fail. This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={() => {
          if (keyToDelete) deleteKey.mutate(keyToDelete.id)
          setConfirmOpen(false)
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
