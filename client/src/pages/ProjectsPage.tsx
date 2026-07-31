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
  allowVision?: boolean
  allowVoice?: boolean
  allowTTS?: boolean
  allowImageGen?: boolean
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
  poolUpgrade: boolean
  allowVision: boolean
  allowVoice: boolean
  allowTTS: boolean
  allowImageGen: boolean
  approvedPoolUpgrade: boolean
  approvedAllowVision: boolean
  approvedAllowVoice: boolean
  approvedAllowTTS: boolean
  approvedAllowImageGen: boolean
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
  const [reqPoolUpgrade, setReqPoolUpgrade] = useState(true)
  const [reqVision, setReqVision] = useState(false)
  const [reqVoice, setReqVoice] = useState(false)
  const [reqTTS, setReqTTS] = useState(false)
  const [reqImageGen, setReqImageGen] = useState(false)

  const requestFunding = useMutation({
    mutationFn: (body: {
      projectKeyId: string;
      projectLink: string;
      remarks: string;
      poolUpgrade: boolean;
      allowVision: boolean;
      allowVoice: boolean;
      allowTTS: boolean;
      allowImageGen: boolean;
    }) =>
      apiFetch('/api/project-keys/fund-request', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      setSuccessOpen(true)
      queryClient.invalidateQueries({ queryKey: ['fund-requests'] })
      setFundKeyId('')
      setFundLink('')
      setFundRemarks('')
      setReqPoolUpgrade(true)
      setReqVision(false)
      setReqVoice(false)
      setReqTTS(false)
      setReqImageGen(false)
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

    if (!reqPoolUpgrade && !reqVision && !reqVoice && !reqTTS && !reqImageGen) {
      alert('Please select at least one access upgrade request option.')
      return;
    }

    requestFunding.mutate({
      projectKeyId: fundKeyId,
      projectLink: fundLink,
      remarks: fundRemarks,
      poolUpgrade: reqPoolUpgrade,
      allowVision: reqVision,
      allowVoice: reqVoice,
      allowTTS: reqTTS,
      allowImageGen: reqImageGen
    })
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
            <form onSubmit={handleRequestFunding} className="grid gap-6 md:grid-cols-[1.2fr_1.8fr] items-start">
              {/* Left Column: Information Card & Key Selectors */}
              <div className="space-y-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 mb-2 uppercase tracking-wide">
                    Project Upgrades & Modality Access
                  </span>
                  <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                    Request Project Upgrades
                  </h2>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    Take your project to the next level. You can request to upgrade your default 10 Million promotional token pool to <strong className="text-violet-600 dark:text-violet-400">100 Million tokens</strong>, as well as request special access to advanced multimodal capabilities (Vision, Speech-to-Text, Text-to-Speech, and Image Generation) for this project's key.
                  </p>
                </div>

                <div className="space-y-2 border-t pt-4 border-border/40 pb-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                    <span>Boost token budget to 100M for higher volume usage</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                    <span>Enable advanced modalities (Vision & Audio models)</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                    <span>Selective admin verification and review</span>
                  </div>
                </div>

                <div className="space-y-3 border-t pt-4 border-border/40">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Select Project Key</Label>
                    <Select value={fundKeyId} onValueChange={(v) => setFundKeyId(v || '')}>
                      <SelectTrigger className="w-full h-8 text-xs bg-muted/40">
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
              </div>

              {/* Right Column: Upgrade Form checkboxes & action */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Access Upgrades Requested</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Card 1: Image Generation Access */}
                    <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer select-none transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] shadow-sm ${reqImageGen
                        ? 'bg-violet-500/10 border-violet-500/40 text-violet-900 dark:text-violet-200 ring-1 ring-violet-500/20'
                        : 'bg-muted/30 border-border/40 hover:bg-muted/50 text-slate-700 dark:text-zinc-300'
                      }`}>
                      <input
                        type="checkbox"
                        checked={reqImageGen}
                        onChange={(e) => setReqImageGen(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`p-2 rounded-lg border transition-all ${reqImageGen
                          ? 'bg-violet-600 text-white border-violet-600/20 shadow-sm'
                          : 'bg-card text-muted-foreground border-border/60'
                        }`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <polyline points="21 15 16 10 5 21" />
                        </svg>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold">Image Generation Access</div>
                        <div className="text-[10px] text-muted-foreground/90 leading-snug">Allows generating images via Flux / Stable Diffusion models</div>
                      </div>
                    </label>

                    {/* Card 2: Vision Access */}
                    <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer select-none transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] shadow-sm ${reqVision
                        ? 'bg-violet-500/10 border-violet-500/40 text-violet-900 dark:text-violet-200 ring-1 ring-violet-500/20'
                        : 'bg-muted/30 border-border/40 hover:bg-muted/50 text-slate-700 dark:text-zinc-300'
                      }`}>
                      <input
                        type="checkbox"
                        checked={reqVision}
                        onChange={(e) => setReqVision(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`p-2 rounded-lg border transition-all ${reqVision
                          ? 'bg-violet-600 text-white border-violet-600/20 shadow-sm'
                          : 'bg-card text-muted-foreground border-border/60'
                        }`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5">
                          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold">Vision Access</div>
                        <div className="text-[10px] text-muted-foreground/90 leading-snug">Allows sending images to multimodal models</div>
                      </div>
                    </label>

                    {/* Card 3: Voice Access (STT) */}
                    <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer select-none transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] shadow-sm ${reqVoice
                        ? 'bg-violet-500/10 border-violet-500/40 text-violet-900 dark:text-violet-200 ring-1 ring-violet-500/20'
                        : 'bg-muted/30 border-border/40 hover:bg-muted/50 text-slate-700 dark:text-zinc-300'
                      }`}>
                      <input
                        type="checkbox"
                        checked={reqVoice}
                        onChange={(e) => setReqVoice(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`p-2 rounded-lg border transition-all ${reqVoice
                          ? 'bg-violet-600 text-white border-violet-600/20 shadow-sm'
                          : 'bg-card text-muted-foreground border-border/60'
                        }`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5">
                          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          <line x1="12" x2="12" y1="19" y2="22" />
                        </svg>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold">Voice Access (STT)</div>
                        <div className="text-[10px] text-muted-foreground/90 leading-snug">Enables speech-to-text transcriptions</div>
                      </div>
                    </label>

                    {/* Card 4: TTS Access */}
                    <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer select-none transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] shadow-sm ${reqTTS
                        ? 'bg-violet-500/10 border-violet-500/40 text-violet-900 dark:text-violet-200 ring-1 ring-violet-500/20'
                        : 'bg-muted/30 border-border/40 hover:bg-muted/50 text-slate-700 dark:text-zinc-300'
                      }`}>
                      <input
                        type="checkbox"
                        checked={reqTTS}
                        onChange={(e) => setReqTTS(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`p-2 rounded-lg border transition-all ${reqTTS
                          ? 'bg-violet-600 text-white border-violet-600/20 shadow-sm'
                          : 'bg-card text-muted-foreground border-border/60'
                        }`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5">
                          <path d="M11 5L6 9H2v6h4l5 4V5z" />
                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                        </svg>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold">TTS Access</div>
                        <div className="text-[10px] text-muted-foreground/90 leading-snug">Enables text-to-speech generation</div>
                      </div>
                    </label>

                    {/* Card 5: 100M Token Upgrade */}
                    <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer select-none transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] shadow-sm sm:col-span-2 ${reqPoolUpgrade
                        ? 'bg-violet-500/10 border-violet-500/40 text-violet-900 dark:text-violet-200 ring-1 ring-violet-500/20'
                        : 'bg-muted/30 border-border/40 hover:bg-muted/50 text-slate-700 dark:text-zinc-300'
                      }`}>
                      <input
                        type="checkbox"
                        checked={reqPoolUpgrade}
                        onChange={(e) => setReqPoolUpgrade(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`p-2 rounded-lg border transition-all ${reqPoolUpgrade
                          ? 'bg-violet-600 text-white border-violet-600/20 shadow-sm'
                          : 'bg-card text-muted-foreground border-border/60'
                        }`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5">
                          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                        </svg>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold">100M Token Upgrade</div>
                        <div className="text-[10px] text-muted-foreground/90 leading-snug">Increase pool size from 10M to 100M</div>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Remarks / Use Case Description</Label>
                  <textarea
                    value={fundRemarks}
                    onChange={e => setFundRemarks(e.target.value)}
                    placeholder="Tell us what you are building and why you need these model access upgrades..."
                    className="w-full h-[80px] text-xs rounded-md border border-input bg-muted/40 px-3 py-2 shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  size="sm"
                  className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold shadow-md shadow-violet-600/10 h-9"
                  disabled={!fundKeyId || !fundLink || requestFunding.isPending}
                >
                  {requestFunding.isPending ? 'Submitting Request…' : 'Submit Access Upgrade Request'}
                </Button>
              </div>
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
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 shadow-sm select-none">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Funded (100M)
                            </span>
                          )}
                          {k.allowVision && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20 shadow-sm select-none">
                              <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                              Vision
                            </span>
                          )}
                          {k.allowVoice && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20 shadow-sm select-none">
                              <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                              Voice
                            </span>
                          )}
                          {k.allowTTS && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-pink-50 text-pink-700 dark:bg-pink-500/10 dark:text-pink-400 border border-pink-200 dark:border-pink-500/20 shadow-sm select-none">
                              <span className="h-1.5 w-1.5 rounded-full bg-pink-500" />
                              TTS
                            </span>
                          )}
                          {k.allowImageGen && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 shadow-sm select-none">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              Image Gen
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
                                className={`w-[200px] h-8 font-mono text-xs bg-muted/40 select-all cursor-text text-center ${!k.projectLink ? 'text-amber-500 font-semibold' : 'text-violet-500'
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

                    {/* Requested items listing */}
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <span className="text-[10px] text-muted-foreground mr-1 font-semibold">Requested:</span>
                      {req.poolUpgrade && (
                        <span className="text-[9px] bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 px-1.5 py-0.5 rounded font-medium">100M Pool</span>
                      )}
                      {req.allowVision && (
                        <span className="text-[9px] bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 px-1.5 py-0.5 rounded font-medium">Vision</span>
                      )}
                      {req.allowVoice && (
                        <span className="text-[9px] bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 px-1.5 py-0.5 rounded font-medium">Voice (STT)</span>
                      )}
                      {req.allowTTS && (
                        <span className="text-[9px] bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 px-1.5 py-0.5 rounded font-medium">TTS</span>
                      )}
                      {req.allowImageGen && (
                        <span className="text-[9px] bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 px-1.5 py-0.5 rounded font-medium">Image Gen</span>
                      )}
                    </div>
                    {req.status === 'approved' && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-450 mr-1 font-semibold">Approved:</span>
                        {req.approvedPoolUpgrade && (
                          <span className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 px-1.5 py-0.5 rounded font-semibold">100M Pool</span>
                        )}
                        {req.approvedAllowVision && (
                          <span className="text-[9px] bg-sky-500/10 text-sky-600 dark:text-sky-400 px-1.5 py-0.5 rounded font-medium">Vision</span>
                        )}
                        {req.approvedAllowVoice && (
                          <span className="text-[9px] bg-violet-500/10 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded font-medium">Voice (STT)</span>
                        )}
                        {req.approvedAllowTTS && (
                          <span className="text-[9px] bg-pink-500/10 text-pink-600 dark:text-pink-400 px-1.5 py-0.5 rounded font-medium">TTS</span>
                        )}
                        {req.approvedAllowImageGen && (
                          <span className="text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">Image Gen</span>
                        )}
                        {!req.approvedPoolUpgrade && !req.approvedAllowVision && !req.approvedAllowVoice && !req.approvedAllowTTS && !req.approvedAllowImageGen && (
                          <span className="text-[9px] text-muted-foreground italic">None (Approved with no changes)</span>
                        )}
                      </div>
                    )}
                    <span className="text-[10px] text-slate-550 dark:text-zinc-500 block mt-1">
                      Submitted on {new Date(req.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${req.status === 'approved'
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
