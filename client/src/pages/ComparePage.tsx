import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'

interface FallbackEntry {
  modelDbId: number
  priority: number
  enabled: boolean
  platform: string
  modelId: string
  displayName: string
  sizeLabel: string
  keyCount: number
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  meta?: {
    platform?: string
    model?: string
    latency?: number
    fallbackAttempts?: number
    keyUsed?: string
  }
}

interface PanelConfig {
  id: string
  model: string
  format: 'openai' | 'gemini'
  messages: ChatMessage[]
  loading: boolean
}

export default function ComparePage() {
  const [numPanels, setNumPanels] = useState<number>(2)
  const [panels, setPanels] = useState<PanelConfig[]>([
    { id: 'panel-1', model: 'auto', format: 'openai', messages: [], loading: false },
    { id: 'panel-2', model: 'auto', format: 'gemini', messages: [], loading: false },
  ])
  const [input, setInput] = useState('')
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const { data: keyData } = useQuery<{ apiKey: string; geminiApiKey: string }>({
    queryKey: ['unified-key'],
    queryFn: () => apiFetch('/api/settings/api-key'),
  })

  const { data: fallbackEntries = [] } = useQuery<FallbackEntry[]>({
    queryKey: ['fallback'],
    queryFn: () => apiFetch('/api/fallback'),
  })

  const availableModels = fallbackEntries.filter(e => e.keyCount > 0 && e.enabled)

  // Sync panels state when numPanels changes
  useEffect(() => {
    setPanels(prev => {
      const next = [...prev]
      if (next.length < numPanels) {
        // Add new panels
        for (let i = next.length; i < numPanels; i++) {
          next.push({
            id: `panel-${i + 1}`,
            model: 'auto',
            format: i % 2 === 0 ? 'openai' : 'gemini',
            messages: prev[0]?.messages.filter(m => m.role === 'user').map(m => ({ ...m })) || [],
            loading: false,
          })
        }
      } else if (next.length > numPanels) {
        // Shrink panels
        return next.slice(0, numPanels)
      }
      return next
    })
  }, [numPanels])

  const handleSend = async () => {
    const text = input.trim()
    if (!text) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    setInput('')

    // Update all panels with the user message and set loading
    const updatedPanels = panels.map(p => ({
      ...p,
      messages: [...p.messages, userMsg],
      loading: true,
    }))
    setPanels(updatedPanels)

    // Execute requests in parallel
    updatedPanels.forEach(async (panel) => {
      const newMessages = panel.messages
      try {
        const base = (import.meta.env.VITE_API_URL || import.meta.env.BASE_URL).replace(/\/$/, '')
        const start = Date.now()
        let res: Response

        if (panel.format === 'openai') {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' }
          if (keyData?.apiKey) headers['Authorization'] = `Bearer ${keyData.apiKey}`

          const body: any = {
            messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          }
          if (panel.model !== 'auto') body.model = panel.model

          res = await fetch(`${base}/v1/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
          })
        } else {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' }
          const keyVal = keyData?.geminiApiKey || ''
          const urlModel = panel.model === 'auto' ? 'auto' : panel.model

          const body: any = {
            contents: newMessages.map(m => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }]
            }))
          }

          res = await fetch(`${base}/v1beta/models/${urlModel}:generateContent?key=${keyVal}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
          })
        }

        const latency = Date.now() - start
        const routedVia = res.headers.get('X-Routed-Via')
        const fallbackAttempts = res.headers.get('X-Fallback-Attempts')
        const keyUsed = res.headers.get('X-Key-Used')

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }))
          setPanels(prev => prev.map(p => p.id === panel.id ? {
            ...p,
            loading: false,
            messages: [...p.messages, {
              role: 'assistant',
              content: `Error: ${err.error?.message ?? 'Unknown error'}`,
            }]
          } : p))
          return
        }

        const data = await res.json()
        let content = ''
        if (panel.format === 'openai') {
          content = data.choices?.[0]?.message?.content ?? JSON.stringify(data, null, 2)
        } else {
          content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? JSON.stringify(data, null, 2)
        }

        const via = data._routed_via ?? (routedVia ? {
          platform: routedVia.split('/')[0],
          model: routedVia.split('/').slice(1).join('/'),
          keyUsed: keyUsed ?? undefined,
        } : undefined)

        setPanels(prev => prev.map(p => p.id === panel.id ? {
          ...p,
          loading: false,
          messages: [...p.messages, {
            role: 'assistant',
            content,
            meta: {
              platform: via?.platform,
              model: via?.model,
              latency,
              fallbackAttempts: fallbackAttempts ? parseInt(fallbackAttempts) : undefined,
              keyUsed: via?.keyUsed ?? (keyUsed || undefined),
            },
          }]
        } : p))
      } catch (err: any) {
        setPanels(prev => prev.map(p => p.id === panel.id ? {
          ...p,
          loading: false,
          messages: [...p.messages, {
            role: 'assistant',
            content: `Error: ${err.message}`,
          }]
        } : p))
      }
    })

    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClear = () => {
    setPanels(prev => prev.map(p => ({ ...p, messages: [], loading: false })))
    inputRef.current?.focus()
  }

  const updatePanelConfig = (id: string, updates: Partial<PanelConfig>) => {
    setPanels(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
  }

  return (
    <div className="flex flex-col h-[calc(100vh-13rem)] sm:h-[calc(100vh-9rem)] md:h-[calc(100vh-8rem)]">
      <PageHeader
        title="Arena"
        description="Compare latency, output quality, and fallback routing of multiple configurations side-by-side."
        actions={
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground">Panels:</span>
            <Select value={String(numPanels)} onValueChange={(v) => setNumPanels(Number(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Column</SelectItem>
                <SelectItem value="2">2 Columns</SelectItem>
                <SelectItem value="3">3 Columns</SelectItem>
                <SelectItem value="4">4 Columns</SelectItem>
              </SelectContent>
            </Select>
            {panels.some(p => p.messages.length > 0) && (
              <Button variant="outline" size="sm" onClick={handleClear}>
                Clear All
              </Button>
            )}
          </div>
        }
      />

      {/* Panels container */}
      <div
        className="flex-1 min-h-0 grid gap-3 mb-3 overflow-y-auto"
        style={{ gridTemplateColumns: `repeat(${isMobile ? 1 : numPanels}, minmax(0, 1fr))` }}
      >
        {panels.map((panel, idx) => {
          const activeModelLabel = panel.model === 'auto'
            ? 'Auto'
            : availableModels.find(m => m.modelId === panel.model)?.displayName ?? panel.model

          return (
            <div key={panel.id} className="flex flex-col rounded-xl border bg-card/60 backdrop-blur overflow-hidden min-h-[300px] relative shadow-sm hover:shadow transition-shadow">
              {/* Panel Header Settings */}
              <div className="p-3 border-b bg-muted/20 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Panel {idx + 1}</span>
                  <Badge variant="secondary" className="text-[10px] py-0 px-2 font-semibold">
                    {panel.format === 'openai' ? 'OpenAI Format' : 'Gemini Format'}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Select value={panel.format} onValueChange={(v) => updatePanelConfig(panel.id, { format: (v as 'openai' | 'gemini') ?? 'openai' })}>
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue placeholder="Format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="gemini">Gemini</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={panel.model} onValueChange={(v) => updatePanelConfig(panel.id, { model: v ?? 'auto' })}>
                    <SelectTrigger className="h-8 text-xs flex-[2] w-0">
                      <SelectValue placeholder="Model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (fallback)</SelectItem>
                      {availableModels.map(m => (
                        <SelectItem key={m.modelDbId} value={m.modelId}>
                          <span className="flex items-center gap-1.5 justify-between w-full">
                            <span className="truncate max-w-[120px]">{m.displayName}</span>
                            <span className="text-[10px] text-muted-foreground uppercase">{m.platform}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Chat messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
                {panel.messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-4">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Configured Model:</p>
                    <p className="text-sm font-bold text-foreground">{activeModelLabel}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Ready to execute in {panel.format.toUpperCase()} format.
                    </p>
                  </div>
                ) : (
                  <>
                    {panel.messages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[90%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                            msg.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                          {msg.meta && (
                            <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[10px] opacity-80 tabular-nums font-medium text-muted-foreground border-t border-muted-foreground/10 pt-1.5">
                              {msg.meta.platform && <span className="uppercase text-violet-500 font-semibold">{msg.meta.platform}</span>}
                              {msg.meta.model && <span className="font-mono text-[9px] truncate max-w-[100px] bg-secondary px-1 py-0.5 rounded">{msg.meta.model}</span>}
                              {msg.meta.keyUsed && (
                                <span className="font-medium bg-blue-500/10 text-blue-500 dark:text-blue-400 px-1 py-0.5 rounded text-[9px]">
                                  Key: {msg.meta.keyUsed}
                                </span>
                              )}
                              {msg.meta.latency != null && <span className="text-emerald-500">{msg.meta.latency} ms</span>}
                              {msg.meta.fallbackAttempts != null && msg.meta.fallbackAttempts > 0 && (
                                <span className="text-amber-500">FB: {msg.meta.fallbackAttempts}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {panel.loading && (
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-2xl px-3 py-2">
                          <div className="flex gap-1.5 items-center">
                            <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Input row */}
      <div className="border rounded-xl bg-card p-3 shadow-sm">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message to prompt all models concurrently… (⏎ to send)"
            rows={1}
            className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 min-h-[40px] max-h-[120px] scrollbar-none"
            style={{ height: 'auto', overflow: 'hidden' }}
            onInput={e => {
              const el = e.target as HTMLTextAreaElement
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 120) + 'px'
            }}
          />
          <Button onClick={handleSend} disabled={panels.some(p => p.loading) || !input.trim()} size="default" className="px-5">
            {panels.some(p => p.loading) ? 'Running…' : 'Run Arena'}
          </Button>
        </div>
      </div>
    </div>
  )
}
