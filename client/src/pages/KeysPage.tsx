import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { auth } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { PageHeader } from '@/components/page-header'
import type { ApiKey, Platform } from '../../../shared/types'

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'google', label: 'Google AI Studio' },
  { value: 'groq', label: 'Groq' },
  { value: 'cerebras', label: 'Cerebras' },
  { value: 'sambanova', label: 'SambaNova' },
  { value: 'nvidia', label: 'NVIDIA NIM' },
  { value: 'mistral', label: 'Mistral' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'github', label: 'GitHub Models' },
  { value: 'cohere', label: 'Cohere' },
  { value: 'cloudflare', label: 'Cloudflare Workers AI' },
  { value: 'zhipu', label: 'Zhipu AI (Z.ai)' },
  { value: 'ollama', label: 'Ollama Cloud' },
  { value: 'kilo', label: 'Kilo Gateway (anon ok)' },
  { value: 'pollinations', label: 'Pollinations (anon ok)' },
  { value: 'llm7', label: 'LLM7 (anon ok)' },
  { value: 'huggingface', label: 'HuggingFace Router' },
]

const statusDot: Record<string, string> = {
  healthy: 'bg-emerald-500',
  rate_limited: 'bg-amber-500',
  invalid: 'bg-rose-500',
  error: 'bg-rose-500',
  unknown: 'bg-muted-foreground/40',
}

const statusLabel: Record<string, string> = {
  healthy: 'healthy',
  rate_limited: 'rate-limited',
  invalid: 'invalid',
  error: 'error',
  unknown: 'unchecked',
}

interface HealthPlatform {
  platform: string
  totalKeys: number
  healthyKeys: number
  rateLimitedKeys: number
  invalidKeys: number
  errorKeys: number
  unknownKeys: number
}

interface HealthData {
  platforms: HealthPlatform[]
  keys: { id: string; platform: string; status: string; lastCheckedAt: string | null }[]
}

function UnifiedKeySection() {
  const queryClient = useQueryClient()
  const [showOpenAi, setShowOpenAi] = useState(false)
  const [showGemini, setShowGemini] = useState(false)
  const [copiedOpenAi, setCopiedOpenAi] = useState(false)
  const [copiedGemini, setCopiedGemini] = useState(false)

  const { data } = useQuery<{ apiKey: string; geminiApiKey: string }>({
    queryKey: ['unified-key'],
    queryFn: () => apiFetch('/api/settings/api-key'),
  })

  const regenerateOpenAi = useMutation({
    mutationFn: () => apiFetch('/api/settings/api-key/regenerate', {
      method: 'POST',
      body: JSON.stringify({ format: 'openai' })
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['unified-key'] }),
  })

  const regenerateGemini = useMutation({
    mutationFn: () => apiFetch('/api/settings/api-key/regenerate', {
      method: 'POST',
      body: JSON.stringify({ format: 'gemini' })
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['unified-key'] }),
  })

  const apiKey = data?.apiKey ?? ''
  const geminiApiKey = data?.geminiApiKey ?? ''

  const maskedOpenAi = apiKey ? apiKey.slice(0, 13) + '•'.repeat(32) : '…'
  const maskedGemini = geminiApiKey ? geminiApiKey.slice(0, 15) + '•'.repeat(32) : '…'

  const base = (import.meta.env.VITE_API_URL || import.meta.env.BASE_URL || '').replace(/\/$/, '')
  const baseApiUrl = base.startsWith('http') ? base : `${window.location.origin}${base}`

  const openAiBaseUrl = `${baseApiUrl}/v1`
  const geminiBaseUrl = `${baseApiUrl}/v1beta`

  function copyOpenAi() {
    navigator.clipboard.writeText(apiKey)
    setCopiedOpenAi(true)
    setTimeout(() => setCopiedOpenAi(false), 1500)
  }

  function copyGemini() {
    navigator.clipboard.writeText(geminiApiKey)
    setCopiedGemini(true)
    setTimeout(() => setCopiedGemini(false), 1500)
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* OpenAI format key section */}
      <section className="rounded-lg border bg-card p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h2 className="text-sm font-medium">Unified API Key (OpenAI Format)</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Use this as your OpenAI <code className="font-mono">api_key</code>; it routes chat completion requests.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => regenerateOpenAi.mutate()}
            disabled={regenerateOpenAi.isPending}
          >
            Regenerate
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Input
            type="text"
            value={showOpenAi ? apiKey : maskedOpenAi}
            readOnly
            className="flex-1 font-mono text-xs bg-muted/40 select-all cursor-text"
          />
          <Button variant="outline" size="sm" onClick={() => setShowOpenAi(!showOpenAi)}>
            {showOpenAi ? 'Hide' : 'Show'}
          </Button>
          <Button variant="outline" size="sm" onClick={copyOpenAi}>
            {copiedOpenAi ? 'Copied' : 'Copy'}
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
          <span className="text-muted-foreground">Base URL</span>
          <code className="font-mono">{openAiBaseUrl}</code>
          <span className="text-muted-foreground">Endpoint</span>
          <code className="font-mono">/v1/chat/completions</code>
        </div>
      </section>

      {/* Gemini format key section */}
      <section className="rounded-lg border bg-card p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h2 className="text-sm font-medium">Unified API Key (Gemini Format)</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Use this for the Gemini SDK/REST API; it translates requests/responses in and out.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => regenerateGemini.mutate()}
            disabled={regenerateGemini.isPending}
          >
            Regenerate
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Input
            type="text"
            value={showGemini ? geminiApiKey : maskedGemini}
            readOnly
            className="flex-1 font-mono text-xs bg-muted/40 select-all cursor-text"
          />
          <Button variant="outline" size="sm" onClick={() => setShowGemini(!showGemini)}>
            {showGemini ? 'Hide' : 'Show'}
          </Button>
          <Button variant="outline" size="sm" onClick={copyGemini}>
            {copiedGemini ? 'Copied' : 'Copy'}
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
          <span className="text-muted-foreground">Base URL</span>
          <code className="font-mono">{geminiBaseUrl}</code>
          <span className="text-muted-foreground">Endpoint</span>
          <code className="font-mono">/v1beta/models/:model:generateContent</code>
        </div>
      </section>
    </div>
  )
}

interface ProjectKey {
  id: string
  name: string
  projectKey: string
  format: 'openai' | 'gemini'
  enabled: boolean
  isPromoted: boolean
  createdAt: string
}

function ProjectKeysSection() {
  const queryClient = useQueryClient()
  const [createName, setCreateName] = useState('')
  const [createFormat, setCreateFormat] = useState<'openai' | 'gemini'>('openai')
  
  const [promoteName, setPromoteName] = useState('')
  const [promoteFormat, setPromoteFormat] = useState<'openai' | 'gemini'>('openai')

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [keyToDelete, setKeyToDelete] = useState<ProjectKey | null>(null)
  
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({})
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null)

  const { data: projectKeys = [] } = useQuery<ProjectKey[]>({
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
    <div className="space-y-6">
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
        {projectKeys.length === 0 ? (
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
              return (
                <div key={k.id} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                  <div className="flex flex-col gap-1 min-w-[150px]">
                    <span className="text-xs font-semibold text-foreground">{k.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      Created: {new Date(k.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-grow sm:flex-grow-0">
                    <code className="text-xs font-mono bg-muted px-2 py-1 rounded truncate max-w-[200px] sm:max-w-none">
                      {isRevealed ? k.projectKey : masked}
                    </code>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => setRevealedKeys(prev => ({ ...prev, [k.id]: !prev[k.id] }))}
                    >
                      {isRevealed ? 'Hide' : 'Show'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleCopy(k.id, k.projectKey)}
                    >
                      {copiedKeyId === k.id ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] bg-muted/60 text-muted-foreground border px-2 py-0.5 rounded capitalize">
                      {k.format}
                    </span>
                    {k.isPromoted && (
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded">
                        Promoted
                      </span>
                    )}
                  </div>
                  <div className="flex-1" />
                  <div className="flex items-center gap-4">
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
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteClick(k)}
                      disabled={deleteKey.isPending}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

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

function parseUtcDate(str: string | null | undefined): Date | null {
  if (!str) return null
  if (str.includes('T') && str.includes('Z')) return new Date(str)
  const formatted = str.replace(' ', 'T') + (str.endsWith('Z') ? '' : 'Z')
  return new Date(formatted)
}

export default function KeysPage() {
  const queryClient = useQueryClient()
  const [platform, setPlatform] = useState<Platform | ''>('')
  const [apiKey, setApiKey] = useState('')
  const [accountId, setAccountId] = useState('')
  const [label, setLabel] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: keys = [], isLoading } = useQuery<ApiKey[]>({
    queryKey: ['keys'],
    queryFn: () => apiFetch('/api/keys'),
  })

  const { data: healthData } = useQuery<HealthData>({
    queryKey: ['health'],
    queryFn: () => apiFetch('/api/health'),
    refetchInterval: 30000,
  })

  const addKey = useMutation({
    mutationFn: (body: { platform: string; key: string; label?: string }) =>
      apiFetch('/api/keys', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keys'] })
      queryClient.invalidateQueries({ queryKey: ['health'] })
      queryClient.invalidateQueries({ queryKey: ['fallback'] })
      setPlatform('')
      setApiKey('')
      setAccountId('')
      setLabel('')
    },
  })

  const deleteKey = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/keys/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keys'] })
      queryClient.invalidateQueries({ queryKey: ['health'] })
    },
  })

  const checkAll = useMutation({
    mutationFn: () => apiFetch('/api/health/check-all', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health'] })
      queryClient.invalidateQueries({ queryKey: ['keys'] })
    },
  })

  const checkKey = useMutation({
    mutationFn: (keyId: string) => apiFetch(`/api/health/check/${keyId}`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health'] })
      queryClient.invalidateQueries({ queryKey: ['keys'] })
    },
  })

  const needsAccountId = platform === 'cloudflare'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!platform || !apiKey) return
    if (needsAccountId && !accountId) return
    const key = needsAccountId ? `${accountId}:${apiKey}` : apiKey
    addKey.mutate({ platform, key, label: label || undefined })
  }

  const healthKeyMap = new Map<string, { status: string; lastCheckedAt: string | null }>()
  for (const k of healthData?.keys ?? []) healthKeyMap.set(k.id, k)

  const handleExportCsv = async () => {
    try {
      const base = (import.meta.env.VITE_API_URL || import.meta.env.BASE_URL).replace(/\/$/, '')
      const headers: Record<string, string> = {}
      const user = auth.currentUser
      if (user) {
        const token = await user.getIdToken()
        headers['Authorization'] = `Bearer ${token}`
      }
      const response = await fetch(`${base}/api/keys/export`, { headers })
      if (!response.ok) throw new Error('Failed to export keys')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'omnikey_keys_export.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      alert(`Export failed: ${err.message}`)
    }
  }

  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      const csvText = event.target?.result
      if (typeof csvText !== 'string') return

      try {
        const base = (import.meta.env.VITE_API_URL || import.meta.env.BASE_URL).replace(/\/$/, '')
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }
        const user = auth.currentUser
        if (user) {
          const token = await user.getIdToken()
          headers['Authorization'] = `Bearer ${token}`
        }
        const response = await fetch(`${base}/api/keys/import`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ csvText }),
        })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error?.message ?? 'Import failed')
        }
        alert(`Successfully imported ${data.count} keys!`)
        queryClient.invalidateQueries({ queryKey: ['keys'] })
        queryClient.invalidateQueries({ queryKey: ['health'] })
        queryClient.invalidateQueries({ queryKey: ['fallback'] })
      } catch (err: any) {
        alert(`Import failed: ${err.message}`)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const grouped = PLATFORMS.map(p => ({
    ...p,
    keys: keys.filter(k => k.platform === p.value),
  })).filter(p => p.keys.length > 0)

  return (
    <div>
      <PageHeader
        title="Keys"
        description="Provider credentials and the unified API key your apps connect with."
        actions={
          keys.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => checkAll.mutate()} disabled={checkAll.isPending}>
              {checkAll.isPending ? 'Checking…' : 'Check all'}
            </Button>
          )
        }
      />

      <div className="space-y-8">
        <UnifiedKeySection />

        <ProjectKeysSection />

        <section>
          <h2 className="text-sm font-medium mb-3">Add a provider key</h2>
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-end gap-3 rounded-lg border p-4 bg-card">
            <div className="space-y-1.5">
              <Label className="text-xs">Platform</Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {needsAccountId && (
              <div className="space-y-1.5">
                <Label className="text-xs">Account ID</Label>
                <Input
                  value={accountId}
                  onChange={e => setAccountId(e.target.value)}
                  placeholder="a1b2c3d4…"
                  className="w-full sm:w-[200px] font-mono text-xs"
                />
              </div>
            )}
            <div className="space-y-1.5 flex-1 min-w-0">
              <Label className="text-xs">{needsAccountId ? 'API token' : 'API key'}</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={needsAccountId ? 'Bearer token' : 'paste key here'}
                className="font-mono text-xs w-full"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Label</Label>
              <Input
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="optional"
                className="w-full sm:w-[160px]"
              />
            </div>
            <Button type="submit" size="sm" className="w-full sm:w-auto" disabled={!platform || !apiKey || (needsAccountId && !accountId) || addKey.isPending}>
              {addKey.isPending ? 'Adding…' : 'Add key'}
            </Button>
          </form>
          {addKey.isError && (
            <p className="text-destructive text-xs mt-2">{(addKey.error as Error).message}</p>
          )}
        </section>

        <section>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-medium">Configured providers</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={keys.length === 0}>
                Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                Import CSV
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleImportCsv}
              />
            </div>
          </div>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : keys.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No provider keys yet. Add one above to start routing.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map(group => (
                <div key={group.value}>
                  <div className="flex items-baseline justify-between mb-2">
                    <h3 className="text-sm font-medium">{group.label}</h3>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {group.keys.length} key{group.keys.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="rounded-lg border divide-y bg-card overflow-hidden">
                    {group.keys.map(k => {
                      const h = healthKeyMap.get(k.id)
                      const status = h?.status ?? k.status
                      const lastChecked = h?.lastCheckedAt
                      return (
                        <div key={k.id} className="flex flex-wrap items-center gap-2 px-3 py-3 hover:bg-muted/40 transition-colors">
                          <span className={`size-1.5 rounded-full flex-shrink-0 ${statusDot[status] ?? statusDot.unknown}`} />
                          <code className="text-xs font-mono flex-shrink-0 truncate max-w-[120px] sm:max-w-none">{k.maskedKey}</code>
                          {k.label && <span className="text-xs text-muted-foreground">{k.label}</span>}
                          <span className="text-xs text-muted-foreground">{statusLabel[status] ?? status}</span>
                          <div className="flex-1" />
                          {lastChecked && (
                            <span className="text-[11px] text-muted-foreground tabular-nums hidden sm:inline">
                              {parseUtcDate(lastChecked)?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
                            </span>
                          )}
                          <Button variant="ghost" size="xs" onClick={() => checkKey.mutate(k.id)} disabled={checkKey.isPending}>
                            Check
                          </Button>
                          <Button variant="ghost" size="xs" className="text-muted-foreground hover:text-destructive" onClick={() => deleteKey.mutate(k.id)} disabled={deleteKey.isPending}>
                            Remove
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
