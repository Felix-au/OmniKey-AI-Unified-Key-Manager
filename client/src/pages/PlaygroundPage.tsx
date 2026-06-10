import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/page-header'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { Paperclip, X, Image as ImageIcon, FileAudio } from 'lucide-react'

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
  audioUrl?: string
  imageUrl?: string
  meta?: {
    platform?: string
    model?: string
    latency?: number
    fallbackAttempts?: number
    keyUsed?: string
  }
}

export default function PlaygroundPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string>('auto')
  const [apiFormat, setApiFormat] = useState<'openai' | 'gemini'>('openai')
  const [mode, setMode] = useState<'chat' | 'vision' | 'stt' | 'tts'>('chat')
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string>('')
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: keyData } = useQuery<{ apiKey: string; geminiApiKey: string }>({
    queryKey: ['unified-key'],
    queryFn: () => apiFetch('/api/settings/api-key'),
  })

  const { data: fallbackEntries = [] } = useQuery<FallbackEntry[]>({
    queryKey: ['fallback'],
    queryFn: () => apiFetch('/api/fallback'),
  })

  // Filter models based on selected mode
  const availableModels = fallbackEntries.filter(e => {
    if (e.keyCount === 0 || !e.enabled) return false
    if (mode !== 'chat') {
      return e.platform === 'google'
    }
    return true
  })

  // Reset selected model to 'auto' if the active selection gets filtered out
  useEffect(() => {
    if (selectedModel !== 'auto' && !availableModels.some(m => m.modelId === selectedModel)) {
      setSelectedModel('auto')
    }
  }, [mode, availableModels, selectedModel])

  // Revoke object URLs on unmount to prevent leaks
  useEffect(() => {
    return () => {
      messages.forEach(m => {
        if (m.audioUrl) {
          URL.revokeObjectURL(m.audioUrl)
        }
      })
    }
  }, [messages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const triggerFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setAttachedFile(file)
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => {
        setFilePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    } else {
      setFilePreview('')
    }
  }

  const removeAttachedFile = () => {
    setAttachedFile(null)
    setFilePreview('')
  }

  const handleSend = async () => {
    const text = input.trim()
    if (mode === 'stt' && !attachedFile) return
    if (mode !== 'stt' && !text) return
    if (loading) return

    const userMsg: ChatMessage = { role: 'user', content: text || `Uploaded file: ${attachedFile?.name}` }
    if (mode === 'vision' && filePreview) {
      userMsg.imageUrl = filePreview
    }

    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    inputRef.current?.focus()

    const fileToSend = attachedFile
    const previewToSend = filePreview

    setAttachedFile(null)
    setFilePreview('')

    try {
      const base = (import.meta.env.VITE_API_URL || import.meta.env.BASE_URL).replace(/\/$/, '')
      const start = Date.now()
      let res: Response

      // 🎧 SPEECH-TO-TEXT (STT) MODE
      if (mode === 'stt') {
        const formData = new FormData()
        if (fileToSend) formData.append('file', fileToSend)
        formData.append('model', selectedModel === 'auto' ? 'auto' : selectedModel)

        const headers: Record<string, string> = {}
        if (keyData?.apiKey) headers['Authorization'] = `Bearer ${keyData.apiKey}`
        headers['X-Required-Modality'] = 'audio_input'

        res = await fetch(`${base}/v1/audio/transcriptions`, {
          method: 'POST',
          headers,
          body: formData
        })
      }
      // 🔊 TEXT-TO-SPEECH (TTS) MODE
      else if (mode === 'tts') {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (keyData?.apiKey) headers['Authorization'] = `Bearer ${keyData.apiKey}`
        headers['X-Required-Modality'] = 'audio_output'

        const body = {
          input: text,
          model: selectedModel === 'auto' ? 'auto' : selectedModel,
          voice: 'alloy'
        }

        res = await fetch(`${base}/v1/audio/speech`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        })
      }
      // 👁️ VISION OR SIMPLE CHAT (OPENAI FORMAT)
      else if (apiFormat === 'openai') {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (keyData?.apiKey) headers['Authorization'] = `Bearer ${keyData.apiKey}`
        if (mode === 'vision') headers['X-Required-Modality'] = 'vision'

        // Translate history to OpenAI multimodal messages format if there are images
        const apiMessages = messages.map(m => {
          if (m.imageUrl && m.role === 'user') {
            return {
              role: m.role,
              content: [
                { type: 'text', text: m.content },
                { type: 'image_url', image_url: { url: m.imageUrl } }
              ]
            }
          }
          return { role: m.role, content: m.content }
        })

        let currentContent: any = text
        if (mode === 'vision' && previewToSend) {
          currentContent = [
            { type: 'text', text },
            { type: 'image_url', image_url: { url: previewToSend } }
          ]
        }

        apiMessages.push({ role: 'user', content: currentContent })

        const body: any = {
          messages: apiMessages
        }
        if (selectedModel !== 'auto') body.model = selectedModel

        res = await fetch(`${base}/v1/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        })
      }
      // 👁️ VISION OR SIMPLE CHAT (GEMINI FORMAT)
      else {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        const keyVal = keyData?.geminiApiKey || ''
        const urlModel = selectedModel === 'auto' ? 'auto' : selectedModel
        if (mode === 'vision') headers['X-Required-Modality'] = 'vision'

        const contents = messages.map(m => {
          const parts: any[] = [{ text: m.content }]
          if (m.imageUrl && m.role === 'user') {
            const mimeType = 'image/jpeg'
            const base64Data = m.imageUrl.split(',')[1]
            parts.push({
              inlineData: {
                mimeType,
                data: base64Data
              }
            })
          }
          return {
            role: m.role === 'assistant' ? 'model' : 'user',
            parts
          }
        })

        const currentParts: any[] = [{ text }]
        if (mode === 'vision' && previewToSend) {
          const mimeType = fileToSend?.type || 'image/jpeg'
          const base64Data = previewToSend.split(',')[1]
          currentParts.push({
            inlineData: {
              mimeType,
              data: base64Data
            }
          })
        }

        contents.push({
          role: 'user',
          parts: currentParts
        })

        const body: any = {
          contents
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
        setMessages([...newMessages, {
          role: 'assistant',
          content: `Error: ${err.error?.message ?? 'Unknown error'}`,
        }])
        return
      }

      // Handle TTS binary output
      if (mode === 'tts') {
        const blob = await res.blob()
        const audioUrl = URL.createObjectURL(blob)
        setMessages([...newMessages, {
          role: 'assistant',
          content: 'Synthesized speech audio:',
          audioUrl,
          meta: {
            platform: 'google',
            model: 'gemini-2.5-flash-preview-tts',
            latency,
            keyUsed: keyUsed ?? undefined
          }
        }])
        return
      }

      // Handle STT transcription response
      if (mode === 'stt') {
        const data = await res.json()
        const via = data._routed_via ?? (routedVia ? {
          platform: routedVia.split('/')[0],
          model: routedVia.split('/').slice(1).join('/'),
          keyUsed: keyUsed ?? undefined,
        } : undefined)

        setMessages([...newMessages, {
          role: 'assistant',
          content: data.text || JSON.stringify(data, null, 2),
          meta: {
            platform: via?.platform,
            model: via?.model,
            latency,
            fallbackAttempts: fallbackAttempts ? parseInt(fallbackAttempts) : undefined,
            keyUsed: via?.keyUsed ?? keyUsed ?? undefined,
          }
        }])
        return
      }

      // Handle standard / vision responses
      const data = await res.json()
      let content = ''
      if (apiFormat === 'openai') {
        content = data.choices?.[0]?.message?.content ?? JSON.stringify(data, null, 2)
      } else {
        content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? JSON.stringify(data, null, 2)
      }

      const via = data._routed_via ?? (routedVia ? {
        platform: routedVia.split('/')[0],
        model: routedVia.split('/').slice(1).join('/'),
        keyUsed: keyUsed ?? undefined,
      } : undefined)

      setMessages([...newMessages, {
        role: 'assistant',
        content,
        meta: {
          platform: via?.platform,
          model: via?.model,
          latency,
          fallbackAttempts: fallbackAttempts ? parseInt(fallbackAttempts) : undefined,
          keyUsed: via?.keyUsed ?? keyUsed ?? undefined,
        },
      }])
    } catch (err: any) {
      setMessages([...newMessages, {
        role: 'assistant',
        content: `Error: ${err.message}`,
      }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClear = () => {
    setMessages([])
    setAttachedFile(null)
    setFilePreview('')
    inputRef.current?.focus()
  }

  const activeModelLabel = selectedModel === 'auto'
    ? 'Auto (fallback chain)'
    : availableModels.find(m => m.modelId === selectedModel)?.displayName ?? selectedModel

  const placeholderText = () => {
    if (mode === 'stt') {
      return attachedFile ? `Attached: ${attachedFile.name}. Press Send to transcribe.` : "Attach an audio file to transcribe..."
    }
    if (mode === 'vision') {
      return "Type a prompt and attach an image..."
    }
    if (mode === 'tts') {
      return "Type text to convert into speech..."
    }
    return "Type a message… (⏎ to send, ⇧⏎ for newline)"
  }

  return (
    <div className="flex flex-col h-[calc(100vh-13rem)] sm:h-[calc(100vh-9rem)] md:h-[calc(100vh-8rem)]">
      <PageHeader
        title="Playground"
        description="Send a chat completion through the router and see which provider serves it."
        actions={
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {/* Mode selection toggle */}
            <Select value={mode} onValueChange={(v) => {
              setMode(v as 'chat' | 'vision' | 'stt' | 'tts')
              removeAttachedFile()
            }}>
              <SelectTrigger className="w-full sm:w-[150px] font-semibold bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chat">Simple Chat</SelectItem>
                <SelectItem value="vision">Vision Chat</SelectItem>
                <SelectItem value="stt">Speech to Text</SelectItem>
                <SelectItem value="tts">Text to Speech</SelectItem>
              </SelectContent>
            </Select>

            <Select value={apiFormat} onValueChange={(v) => setApiFormat(v as 'openai' | 'gemini')}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI Format</SelectItem>
                <SelectItem value="gemini">Gemini Format</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedModel} onValueChange={(v) => setSelectedModel(v ?? 'auto')}>
              <SelectTrigger className="flex-1 sm:w-[260px] min-w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (fallback chain)</SelectItem>
                {availableModels.map(m => (
                  <SelectItem key={m.modelDbId} value={m.modelId}>
                    <span className="flex items-center gap-2">
                      <span>{m.displayName}</span>
                      <span className="text-xs text-muted-foreground">{m.platform}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {messages.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleClear}>
                Clear
              </Button>
            )}
          </div>
        }
      />

      <div className="flex-1 flex flex-col rounded-lg border bg-card overflow-hidden min-h-0">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center">
              <div className="space-y-2 max-w-sm">
                <p className="text-base font-medium">Send a message to get started.</p>
                <p className="text-sm text-muted-foreground">
                  Using <span className="text-foreground">{activeModelLabel}</span>. Switch models or modalities in the selectors above.
                </p>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <div className="whitespace-pre-wrap">
                        {msg.content}
                        {msg.imageUrl && (
                          <div className="mt-2 rounded-lg overflow-hidden max-w-xs border border-border bg-background/50">
                            <img src={msg.imageUrl} alt="Attached vision payload" className="w-full object-cover max-h-[200px]" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <MarkdownRenderer content={msg.content} compact />
                        {msg.audioUrl && (
                          <div className="mt-2 pt-1 border-t border-border/30">
                            <audio controls src={msg.audioUrl} className="w-full max-w-md h-9 rounded bg-background" />
                          </div>
                        )}
                      </div>
                    )}
                    {msg.meta && (
                      <div className="flex items-center gap-2 mt-2 flex-wrap text-[11px] opacity-70 tabular-nums">
                        {msg.meta.platform && <span>{msg.meta.platform}</span>}
                        {msg.meta.model && <span className="font-mono">· {msg.meta.model}</span>}
                        {msg.meta.keyUsed && <span className="font-medium bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">Key: {msg.meta.keyUsed}</span>}
                        {msg.meta.latency != null && <span>· {msg.meta.latency} ms</span>}
                        {msg.meta.fallbackAttempts != null && msg.meta.fallbackAttempts > 0 && (
                          <span>· {msg.meta.fallbackAttempts} fallback{msg.meta.fallbackAttempts > 1 ? 's' : ''}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl px-4 py-3">
                    <div className="flex gap-1">
                      <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Upload previews overlay container */}
        {attachedFile && (
          <div className="mx-4 mb-2 p-2 rounded-lg bg-secondary/40 border border-secondary flex items-center justify-between gap-4 max-w-sm glassmorphism">
            <div className="flex items-center gap-2 min-w-0">
              {filePreview ? (
                <img src={filePreview} alt="Image upload preview" className="size-10 rounded object-cover border" />
              ) : (
                <div className="size-10 rounded bg-background flex items-center justify-center border text-muted-foreground">
                  {attachedFile.type.startsWith('audio/') ? <FileAudio className="size-5" /> : <ImageIcon className="size-5" />}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate text-foreground">{attachedFile.name}</p>
                <p className="text-[10px] text-muted-foreground">{(attachedFile.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground" onClick={removeAttachedFile}>
              <X className="size-4" />
            </Button>
          </div>
        )}

        <div className="border-t bg-background/50 p-3">
          <div className="flex gap-2 items-end">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              accept={mode === 'vision' ? 'image/*' : mode === 'stt' ? 'audio/*' : undefined}
              className="hidden"
            />
            {mode === 'vision' || mode === 'stt' ? (
              <Button
                variant="outline"
                size="icon"
                onClick={triggerFileSelect}
                title={mode === 'vision' ? "Upload Image" : "Upload Audio"}
                className="shrink-0 size-10 border bg-background"
              >
                <Paperclip className="size-5 text-muted-foreground" />
              </Button>
            ) : null}
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={mode === 'stt'}
              placeholder={placeholderText()}
              rows={1}
              className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 min-h-[40px] max-h-[160px] disabled:opacity-50"
              style={{ height: 'auto', overflow: 'hidden' }}
              onInput={e => {
                const el = e.target as HTMLTextAreaElement
                el.style.height = 'auto'
                el.style.height = Math.min(el.scrollHeight, 160) + 'px'
              }}
            />
            <Button
              onClick={handleSend}
              disabled={loading || (mode === 'stt' ? !attachedFile : !input.trim())}
              size="default"
            >
              {loading ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
