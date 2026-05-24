import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/page-header'

interface FallbackEntry {
  modelDbId: number
  platform: string
  modelId: string
  displayName: string
  keyCount: number
  enabled: boolean
}

export default function DevCornerPage() {
  const [selectedModel, setSelectedModel] = useState('auto')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState('')
  const [topP, setTopP] = useState(1.0)
  const [stream, setStream] = useState(false)
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful AI assistant.')
  const [userPrompt, setUserPrompt] = useState('Hello, tell me a quick developer joke about AI!')
  const [responseOutput, setResponseOutput] = useState('')
  const [executing, setExecuting] = useState(false)
  const [copied, setCopied] = useState(false)

  // Fetch current unified API key
  const { data: keyData } = useQuery<{ apiKey: string }>({
    queryKey: ['unified-key'],
    queryFn: () => apiFetch('/api/settings/api-key'),
  })

  // Fetch available models from fallback configuration catalog
  const { data: fallbackEntries = [] } = useQuery<FallbackEntry[]>({
    queryKey: ['fallback'],
    queryFn: () => apiFetch('/api/fallback'),
  })

  const availableModels = fallbackEntries.filter(e => e.keyCount > 0 && e.enabled)
  const apiKey = keyData?.apiKey || 'omnikey-placeholder-key'
  
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  const currentOrigin = window.location.origin
  const baseApiUrl = `${currentOrigin}${base}/v1`
  const completionEndpoint = `${baseApiUrl}/chat/completions`

  // Dynamically compile JavaScript request snippet
  const jsCodeSnippet = `// OmniKey AI Unified Request Example
const apiKey = '${apiKey}';
const endpoint = '${completionEndpoint}';

async function generateCompletion() {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${apiKey}\`
      },
      body: JSON.stringify({
        model: '${selectedModel}',
        messages: [
          { role: 'system', content: '${systemPrompt.replace(/'/g, "\\'")}' },
          { role: 'user', content: '${userPrompt.replace(/'/g, "\\'")}' }
        ],
        temperature: ${temperature},
        ${maxTokens ? `max_tokens: ${maxTokens},` : ''}
        ${topP < 1.0 ? `top_p: ${topP},` : ''}
        stream: ${stream}
      })
    });

    if (${stream}) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      console.log('--- Streaming Response ---');
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            if (line.includes('[DONE]')) break;
            try {
              const parsed = JSON.parse(line.slice(6));
              const text = parsed.choices?.[0]?.delta?.content || '';
              process.stdout.write(text);
            } catch (err) {}
          }
        }
      }
    } else {
      const data = await response.json();
      console.log('Response content:', data.choices[0].message.content);
    }
  } catch (error) {
    console.error('Request failed:', error);
  }
}

generateCompletion();`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(jsCodeSnippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Execute interactive API request directly from the dashboard
  const handleExecuteRequest = async () => {
    setExecuting(true)
    setResponseOutput('Sending request to server...')
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
      
      const body: any = {
        model: selectedModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature,
        stream
      }
      if (maxTokens) body.max_tokens = parseInt(maxTokens)
      if (topP < 1.0) body.top_p = topP

      const res = await fetch(`${base}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }))
        setResponseOutput(`Error details:\n${JSON.stringify(errJson, null, 2)}`)
        setExecuting(false)
        return
      }

      if (stream) {
        setResponseOutput('')
        const reader = res.body?.getReader()
        const decoder = new TextDecoder('utf-8')
        if (!reader) {
          setResponseOutput('Error: Unable to initialize stream reader.')
          setExecuting(false)
          return
        }

        let streamingText = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              if (line.includes('[DONE]')) continue
              try {
                const parsed = JSON.parse(line.slice(6))
                const content = parsed.choices?.[0]?.delta?.content || ''
                streamingText += content
                setResponseOutput(streamingText)
              } catch (e) {}
            }
          }
        }
      } else {
        const data = await res.json()
        setResponseOutput(JSON.stringify(data, null, 2))
      }
    } catch (err: any) {
      setResponseOutput(`Execution failed: ${err.message}`)
    } finally {
      setExecuting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Developer Corner"
        description="Dynamic API documentation, auto-updating SDK scripts, and interactive proxy execution sandbox."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Parameter Configuration Panel */}
        <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-6">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Request Configuration</h3>
            <p className="text-xs text-muted-foreground">Adjust request properties to compile dynamic scripts and run proxy tests.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Unified API Authorization Key
              </label>
              <Input
                type="text"
                value={apiKey}
                readOnly
                className="w-full font-mono text-xs bg-muted/40 select-all cursor-text"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Proxy Endpoint Address
              </label>
              <Input
                type="text"
                value={completionEndpoint}
                readOnly
                className="w-full font-mono text-xs bg-muted/40 select-all cursor-text"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Router Model Target
                </label>
                <select
                  value={selectedModel}
                  onChange={e => setSelectedModel(e.target.value)}
                  className="w-full bg-background border rounded-lg h-8 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="auto">auto (best intelligent model)</option>
                  {availableModels.map(m => (
                    <option key={m.modelDbId} value={m.modelId}>
                      {m.displayName} ({m.platform})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Execution Output Mode
                </label>
                <select
                  value={stream ? 'true' : 'false'}
                  onChange={e => setStream(e.target.value === 'true')}
                  className="w-full bg-background border rounded-lg h-8 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="false">Standard JSON (blocking)</option>
                  <option value="true">Streaming Events (SSE)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Temperature ({temperature})
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={e => setTemperature(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-violet-600"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Max Tokens (optional)
                </label>
                <input
                  type="number"
                  placeholder="Catalog Limit"
                  value={maxTokens}
                  onChange={e => setMaxTokens(e.target.value)}
                  className="w-full bg-background border rounded-lg px-3 h-8 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Top P Selection
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={topP}
                  onChange={e => setTopP(parseFloat(e.target.value))}
                  className="w-full bg-background border rounded-lg px-3 h-8 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Developer System Prompt
              </label>
              <textarea
                rows={2}
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                placeholder="Initialize global AI constraints here..."
                className="w-full bg-background border rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                User Conversation Prompt
              </label>
              <textarea
                rows={3}
                value={userPrompt}
                onChange={e => setUserPrompt(e.target.value)}
                placeholder="Ask your router whatever you need..."
                className="w-full bg-background border rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>

            <Button
              onClick={handleExecuteRequest}
              disabled={executing || !apiKey}
              className="w-full py-5 rounded-xl bg-violet-600 hover:bg-violet-500 font-semibold text-xs tracking-wide shadow-lg shadow-violet-600/10 hover:shadow-violet-600/20 active:scale-[0.98] transition-all"
            >
              {executing ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing request...
                </span>
              ) : (
                'Run Proxy Sandbox Request'
              )}
            </Button>
          </div>
        </div>

        {/* Live Code Compiler & Response Visualizer */}
        <div className="space-y-6">
          {/* JavaScript SDK Sandbox Block */}
          <div className="bg-card border rounded-2xl p-6 shadow-sm flex flex-col h-[340px]">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Dynamic SDK Code Snippet</h4>
                <p className="text-[10px] text-muted-foreground">Auto-compiles instantly as request parameters change.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={copyToClipboard}
                className="text-[10px] font-bold py-1 px-3 h-auto text-violet-400 border-violet-500/20 hover:border-violet-500/40 bg-violet-950/10 hover:bg-violet-950/20 rounded-lg shrink-0"
              >
                {copied ? 'Copied!' : 'Copy Script'}
              </Button>
            </div>
            <div className="flex-1 min-h-0 bg-slate-950 rounded-xl border border-slate-900 overflow-auto p-4 text-left">
              <pre className="text-[11px] font-mono leading-relaxed text-indigo-200 whitespace-pre">
                {jsCodeSnippet}
              </pre>
            </div>
          </div>

          {/* Interactive Request Output Stream */}
          <div className="bg-card border rounded-2xl p-6 shadow-sm flex flex-col h-[280px]">
            <div className="space-y-1 mb-3 shrink-0">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Interactive Execution Console</h4>
              <p className="text-[10px] text-muted-foreground">Real-time parsed output response from the gateway router.</p>
            </div>
            <div className="flex-1 min-h-0 bg-slate-950 rounded-xl border border-slate-900 overflow-auto p-4 text-left font-mono text-[11px] text-emerald-400 leading-relaxed whitespace-pre-wrap select-all cursor-text">
              {responseOutput || 'Console idle. Click "Run Proxy Sandbox Request" to execute dynamic request blocks.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
