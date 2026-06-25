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
  projectLink: string
  createdAt: string
  metrics?: {
    totalRequests: number
    successRate: number
    totalTokens: number
    avgLatencyMs: number
    lastUsedAt: string | null
  }
}

interface FundingRequest {
  id: string
  projectKeyId: string
  projectName: string
  projectLink: string
  remarks: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
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
  const [createLink, setCreateLink] = useState('')
  const [createFormat, setCreateFormat] = useState<'openai' | 'gemini'>('openai')

  const [promoteName, setPromoteName] = useState('')
  const [promoteLink, setPromoteLink] = useState('')
  const [promoteFormat, setPromoteFormat] = useState<'openai' | 'gemini'>('openai')

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [keyToDelete, setKeyToDelete] = useState<ProjectKey | null>(null)
  const [successOpen, setSuccessOpen] = useState(false)
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null)
  const [editLinkLabel, setEditLinkLabel] = useState('')

  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({})
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null)

  const { data: projectKeys = [], isLoading } = useQuery<ProjectKey[]>({
    queryKey: ['project-keys'],
    queryFn: () => apiFetch('/api/project-keys'),
  })

  const { data: fundingRequests = [] } = useQuery<FundingRequest[]>({
    queryKey: ['fund-requests'],
    queryFn: () => apiFetch('/api/project-keys/fund-requests'),
  })

  const createKey = useMutation({
    mutationFn: (body: { name: string; format: string; projectLink: string }) =>
      apiFetch('/api/project-keys', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-keys'] })
      setCreateName('')
      setCreateLink('')
    },
  })

  const promoteKey = useMutation({
    mutationFn: (body: { name: string; format: string; projectLink: string }) =>
      apiFetch('/api/project-keys/promote', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-keys'] })
      setPromoteName('')
      setPromoteLink('')
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

  const updateLinkMutation = useMutation({
    mutationFn: ({ id, projectLink }: { id: string; projectLink: string }) =>
      apiFetch(`/api/project-keys/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ projectLink })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-keys'] })
      setEditingKeyId(null)
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to update project link')
    }
  })

  const handleSaveLink = (id: string) => {
    let isValidUrl = false;
    try {
      const url = new URL(editLinkLabel);
      isValidUrl = url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      isValidUrl = false;
    }
    if (!isValidUrl) {
      alert('Please provide a valid HTTP or HTTPS project URL.');
      return;
    }

    updateLinkMutation.mutate({ id, projectLink: editLinkLabel })
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!createName || !createLink) return

    let isValidUrl = false;
    try {
      const url = new URL(createLink);
      isValidUrl = url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      isValidUrl = false;
    }
    if (!isValidUrl) {
      alert('Please provide a valid HTTP or HTTPS project URL.');
      return;
    }

    createKey.mutate({ name: createName, format: createFormat, projectLink: createLink })
  }

  const handlePromote = (e: React.FormEvent) => {
    e.preventDefault()
    if (!promoteName || !promoteLink) return

    let isValidUrl = false;
    try {
      const url = new URL(promoteLink);
      isValidUrl = url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      isValidUrl = false;
    }
    if (!isValidUrl) {
      alert('Please provide a valid HTTP or HTTPS project URL.');
      return;
    }

    promoteKey.mutate({ name: promoteName, format: promoteFormat, projectLink: promoteLink })
  }

  const [fundKeyId, setFundKeyId] = useState('')
  const [fundLink, setFundLink] = useState('')
  const [fundRemarks, setFundRemarks] = useState('')

  const requestFunding = useMutation({
    mutationFn: (body: { projectKeyId: string; projectLink: string; remarks: string }) =>
      apiFetch('/api/project-keys/fund-request', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      setSuccessOpen(true)
      queryClient.invalidateQueries({ queryKey: ['fund-requests'] })
      setFundKeyId('')
      setFundLink('')
      setFundRemarks('')
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to submit funding request')
    }
  })

  const handleRequestFunding = (e: React.FormEvent) => {
    e.preventDefault()
    if (!fundKeyId || !fundLink) return

    let isValidUrl = false;
    try {
      const url = new URL(fundLink);
      isValidUrl = url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      isValidUrl = false;
    }
    if (!isValidUrl) {
      alert('Please provide a valid HTTP or HTTPS project URL (e.g. https://github.com/...).');
      return;
    }

    requestFunding.mutate({ projectKeyId: fundKeyId, projectLink: fundLink, remarks: fundRemarks })
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

  const selectedProject = projectKeys.find(k => k.id === fundKeyId);
  const selectedText = selectedProject ? `${selectedProject.name} (${selectedProject.format})` : "Select project key...";

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Configure app-specific API keys and monitor real-time consumption and error rates."
      />

      <div className="space-y-8">
        {/* Row 1: Key Management Forms */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Create Custom Key */}
          <section className="rounded-lg border bg-card p-5 shadow-sm">
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
                <Label className="text-xs">Project Link (GitHub / Website)</Label>
                <Input
                  value={createLink}
                  onChange={e => setCreateLink(e.target.value)}
                  placeholder="e.g. https://github.com/my-org/my-app"
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
              <Button type="submit" size="sm" className="w-full" disabled={!createName || !createLink || createKey.isPending}>
                {createKey.isPending ? 'Generating…' : 'Generate Project Key'}
              </Button>
            </form>
          </section>

          {/* Promote Default Key */}
          <section className="rounded-lg border bg-card p-5 shadow-sm">
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
                <Label className="text-xs">Project Link (GitHub / Website)</Label>
                <Input
                  value={promoteLink}
                  onChange={e => setPromoteLink(e.target.value)}
                  placeholder="e.g. https://github.com/my-org/my-app"
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
              <Button type="submit" size="sm" className="w-full" variant="outline" disabled={!promoteName || !promoteLink || promoteKey.isPending}>
                {promoteKey.isPending ? 'Promoting…' : 'Promote Key'}
              </Button>
            </form>
          </section>
        </div>

        {/* Row 2: Request Project Funding Upgrade (Styled Standalone Section) */}
        <div className="w-full">
          <section className="rounded-lg border border-violet-500/20 bg-card p-6 shadow-md bg-gradient-to-br from-violet-600/5 via-card to-emerald-500/5">
            <div className="grid gap-6 md:grid-cols-[1.2fr_1.8fr] items-start">
              {/* Left Column: Information Card */}
              <div className="space-y-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 mb-2">
                    PROMOTIONAL POOL UPGRADE
                  </span>
                  <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                    Request Project Funding
                  </h2>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    Serious about what you're building? You can request to upgrade your default 10 Million promotional token pool to <strong className="text-violet-600 dark:text-violet-400">100 Million tokens</strong>.
                  </p>
                </div>
                
                <div className="space-y-2 border-t pt-4 border-border/40">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>User-wide pool upgrade across all project keys</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Verification and review by admin</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Upgrade Form */}
              <form onSubmit={handleRequestFunding} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Select Project Key</Label>
                    <Select value={fundKeyId} onValueChange={(v) => setFundKeyId(v || '')}>
                      <SelectTrigger className="w-full">
                        <SelectValue>{selectedText}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {projectKeys.map(k => (
                          <SelectItem key={k.id} value={k.id}>
                            {k.name} ({k.format})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Project Link (GitHub / Website)</Label>
                    <Input
                      value={fundLink}
                      onChange={e => setFundLink(e.target.value)}
                      placeholder="e.g. https://github.com/username/project"
                      className="w-full text-xs h-8 bg-muted/40"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Remarks / Use Case Description</Label>
                  <textarea
                    value={fundRemarks}
                    onChange={e => setFundRemarks(e.target.value)}
                    placeholder="Tell us what you are building and why you need a 100M token limit upgrade..."
                    className="w-full h-16 text-xs rounded-md border border-input bg-muted/40 px-3 py-2 shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                  />
                </div>

                <Button 
                  type="submit" 
                  size="sm" 
                  className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold shadow-md shadow-violet-600/10 h-9" 
                  disabled={!fundKeyId || !fundLink || requestFunding.isPending}
                >
                  {requestFunding.isPending ? 'Submitting Request…' : 'Submit 100M Upgrade Request'}
                </Button>
              </form>
            </div>
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
                    {/* Top Row: Responsive grid arranging Name (left), Key (centered on desktop, wrapped below on mobile), Controls (right on all screens) */}
                    <div className="grid grid-cols-2 md:grid-cols-[1fr_auto_1fr] items-center gap-4 w-full">
                      {/* Name, Info */}
                      <div className="col-span-1 order-1 md:order-1 flex flex-col gap-0.5">
                        <h3 className="text-sm font-semibold text-foreground flex flex-wrap items-center gap-2">
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

                      {/* Styled key value field and Project Link field side by side on desktop, stacked on mobile */}
                      <div className="col-span-2 md:col-span-1 order-3 md:order-2 flex flex-col xl:flex-row items-center justify-center md:justify-self-center gap-4 w-full md:w-auto mt-2 md:mt-0">
                        {/* Key value block */}
                        <div className="flex items-center gap-2">
                          <Input
                            type="text"
                            value={isRevealed ? k.projectKey : masked}
                            readOnly
                            className="w-[240px] h-8 font-mono text-xs bg-muted/40 select-all cursor-text text-center"
                            title="Unified Project API Key"
                          />
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => setRevealedKeys(prev => ({ ...prev, [k.id]: !prev[k.id] }))}
                            className="h-8 text-xs px-2"
                            title="Show/Hide Key"
                          >
                            {isRevealed ? 'Hide' : 'Show'}
                          </Button>
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => handleCopy(k.id, k.projectKey)}
                            className="h-8 text-xs px-2"
                            title="Copy Key to Clipboard"
                          >
                            {copiedKeyId === k.id ? 'Copied' : 'Copy'}
                          </Button>
                        </div>

                        {/* Project Link block (styled similarly as input box) */}
                        <div className="flex items-center gap-2">
                          {editingKeyId === k.id ? (
                            <>
                              <Input
                                type="text"
                                value={editLinkLabel}
                                onChange={(e) => setEditLinkLabel(e.target.value)}
                                placeholder="Project URL Link"
                                className="w-[200px] h-8 font-mono text-xs bg-muted/20 text-center"
                              />
                              <Button
                                size="xs"
                                onClick={() => handleSaveLink(k.id)}
                                disabled={updateLinkMutation.isPending}
                                className="bg-violet-600 hover:bg-violet-700 text-white h-8 px-2.5 text-xs font-semibold"
                              >
                                Save
                              </Button>
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => setEditingKeyId(null)}
                                className="h-8 px-2"
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Input
                                type="text"
                                value={k.projectLink || 'No Project Link'}
                                readOnly
                                className={`w-[200px] h-8 font-mono text-xs bg-muted/40 select-all cursor-text text-center ${
                                  !k.projectLink ? 'text-amber-500 font-semibold' : 'text-violet-500'
                                }`}
                                title="Project URL Link"
                              />
                              {k.projectLink ? (
                                <a
                                  href={k.projectLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="h-8 px-2.5 flex items-center justify-center border border-input rounded-md hover:bg-accent/65 transition-colors text-xs font-medium"
                                  title="Open Website Link"
                                >
                                  Open
                                </a>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="xs"
                                  disabled
                                  className="h-8 text-xs px-2.5 opacity-55 cursor-not-allowed"
                                  title="No Link Configured"
                                >
                                  Open
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() => {
                                  setEditingKeyId(k.id)
                                  setEditLinkLabel(k.projectLink || '')
                                }}
                                className="h-8 text-xs px-2"
                                title="Edit Project Link"
                              >
                                Edit
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Enabled/Remove Controls */}
                      <div className="col-span-1 order-2 md:order-3 flex items-center gap-3 justify-self-end">
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
                          className="text-muted-foreground hover:text-destructive h-8"
                          onClick={() => handleDeleteClick(k)}
                          disabled={deleteKey.isPending}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>

                    {/* Bottom Line: Aggregated Key Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-border/40">
                      <div className="rounded-md border bg-card/40 px-3 py-1.5">
                        <span className="text-[9px] text-muted-foreground uppercase tracking-wider block">Requests</span>
                        <span className="text-xs font-medium tabular-nums">{reqs}</span>
                      </div>
                      <div className="rounded-md border bg-card/40 px-3 py-1.5">
                        <span className="text-[9px] text-muted-foreground uppercase tracking-wider block">Success Rate</span>
                        <span className={`text-xs font-medium tabular-nums ${reqs === 0 ? '' : rate >= 95 ? 'text-emerald-500' : rate >= 80 ? 'text-amber-500' : 'text-rose-500'
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

        {/* Funding Requests List */}
        {fundingRequests.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-medium mb-3">Funding Upgrade Requests</h2>
            <div className="rounded-lg border bg-card overflow-hidden divide-y divide-border/60">
              {fundingRequests.map((req) => (
                <div key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-foreground">{req.projectName}</span>
                      <a
                        href={req.projectLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-violet-500 hover:underline truncate max-w-[200px]"
                      >
                        {req.projectLink}
                      </a>
                    </div>
                    {req.remarks && (
                      <p className="text-xs text-muted-foreground italic">"{req.remarks}"</p>
                    )}
                    <span className="text-[10px] text-slate-500 block">
                      Submitted on {new Date(req.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        req.status === 'approved'
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          : req.status === 'rejected'
                          ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
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

      {/* Success Modal */}
      <ConfirmationModal
        isOpen={successOpen}
        title="Funding Request Submitted"
        description="Funding request submitted successfully. Admin will review it shortly."
        confirmLabel="OK"
        onConfirm={() => setSuccessOpen(false)}
      />
    </div>
  )
}
