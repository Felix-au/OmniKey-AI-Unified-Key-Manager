import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

interface OnboardingTourProps {
  isOpen: boolean
  onClose: () => void
}

export function OnboardingTour({ isOpen, onClose }: OnboardingTourProps) {
  const [step, setStep] = useState(1)

  // Step 1: Simulated Adding Keys State
  const [step1State, setStep1State] = useState<'idle' | 'typing1' | 'added1' | 'typing2' | 'added2'>('idle')
  const [platformInput, setPlatformInput] = useState('Google AI Studio')
  const [keyInput, setKeyInput] = useState('')
  const [labelInput, setLabelInput] = useState('')
  const [configuredKeys, setConfiguredKeys] = useState<{ platform: string; key: string; label: string; status: string }[]>([])

  // Step 3: Priority swap timer
  const [step3Dragged, setStep3Dragged] = useState(false)

  // Step 4: Animated chat state
  // Each entry: { role, content (fully revealed), typingContent (partial), state: 'user-typing'|'loading'|'done' }
  type ChatEntry = { role: 'user' | 'assistant'; content: string; typingContent: string; streamingContent: string; state: 'user-typing' | 'loading' | 'streaming' | 'done'; meta?: { platform: string; model: string; keyUsed: string; latency: number; fallbackAttempts: number } }
  const [chatLog, setChatLog] = useState<ChatEntry[]>([])
  const chatScrollRef = useRef<HTMLDivElement>(null)

  // Step 5: refs for scrolling
  const consoleRef = useRef<HTMLDivElement>(null)
  const consoleScrollRef = useRef<HTMLDivElement>(null)

  // Step 5: Dev Corner sandbox simulator state
  const [devFormat, setDevFormat] = useState<'openai' | 'gemini'>('openai')
  const [devExecuting, setDevExecuting] = useState(false)
  const [devConsole, setDevConsole] = useState('Console idle. Click "Run Proxy Sandbox Request" to execute dynamic request blocks.')

  // Fetch current unified API key dynamically
  const { data: keyData } = useQuery<{ apiKey: string; geminiApiKey: string }>({
    queryKey: ['unified-key'],
    queryFn: () => apiFetch('/api/settings/api-key'),
    enabled: isOpen
  })

  const base = (import.meta.env.VITE_API_URL || import.meta.env.BASE_URL || '').replace(/\/$/, '')
  const baseApiUrl = base.startsWith('http') ? base : `${window.location.origin}${base}`

  const apiKey = (devFormat === 'openai' ? keyData?.apiKey : keyData?.geminiApiKey) ||
    (devFormat === 'openai' ? 'omnikey-75dd7a2bc61b53f320ef4be8eb08e4cb8c' : 'omnikey-g-973867cbb322d1daf301f886e260c2df2')

  const completionEndpoint = devFormat === 'openai'
    ? `${baseApiUrl}/v1/chat/completions`
    : `${baseApiUrl}/v1beta/models/auto:generateContent`

  // Manage Step 1 typing simulations
  useEffect(() => {
    if (step !== 1 || !isOpen) return
    setStep1State('idle')
    setKeyInput('')
    setLabelInput('')
    setPlatformInput('Google AI Studio')
    setConfiguredKeys([])

    // Type Key 1: Google
    const t1 = setTimeout(() => {
      setStep1State('typing1')
      let fullKey = 'AIzaSySimulatedGoogleKey10101'
      let cur = ''
      let idx = 0
      const timer = setInterval(() => {
        if (idx < fullKey.length) {
          cur += fullKey[idx]
          setKeyInput(cur)
          idx++
        } else {
          clearInterval(timer)
          setLabelInput('primary-google')
          setTimeout(() => {
            setConfiguredKeys([
              { platform: 'Google AI Studio', key: 'AIzaSySi•••••••••••••••••••••10101', label: 'primary-google', status: 'healthy' }
            ])
            setKeyInput('')
            setLabelInput('')
            setPlatformInput('Groq')
            setStep1State('added1')
          }, 600)
        }
      }, 35)
      return () => clearInterval(timer)
    }, 1200)

    // Type Key 2: Groq
    const t2 = setTimeout(() => {
      setStep1State('typing2')
      let fullKey = 'gsk_SimulatedGroqKey992288'
      let cur = ''
      let idx = 0
      const timer = setInterval(() => {
        if (idx < fullKey.length) {
          cur += fullKey[idx]
          setKeyInput(cur)
          idx++
        } else {
          clearInterval(timer)
          setLabelInput('groq-fast')
          setTimeout(() => {
            setConfiguredKeys(prev => [
              ...prev,
              { platform: 'Groq', key: 'gsk_Sim•••••••••••••••••••••992288', label: 'groq-fast', status: 'healthy' }
            ])
            setKeyInput('')
            setLabelInput('')
            setStep1State('added2')
          }, 600)
        }
      }, 35)
      return () => clearInterval(timer)
    }, 4500)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [step, isOpen])

  // Manage Step 3 draggable animation ticks
  useEffect(() => {
    if (step !== 3 || !isOpen) return
    setStep3Dragged(false)
    const t = setInterval(() => {
      setStep3Dragged(prev => !prev)
    }, 3200)
    return () => clearInterval(t)
  }, [step, isOpen])

  // Manage Step 4 animated chat playback
  const chatMessages = [
    { role: 'user' as const, content: 'Analyze user demographics in the cloud' },
    { role: 'assistant' as const, content: 'Cloud demographics show a 42% growth rate in key markets, highly concentrated in US-East.', meta: { platform: 'groq', model: 'llama-3-70b', keyUsed: 'sk_groq_01', latency: 148, fallbackAttempts: 0 } },
    { role: 'user' as const, content: 'Summarize top cloud integration risks' },
    { role: 'assistant' as const, content: 'Top cloud integration risks include API latency, synchronization delays, and transient connection losses.', meta: { platform: 'google', model: 'gemini-1.5-flash', keyUsed: 'sk_gemini_03', latency: 312, fallbackAttempts: 1 } },
    { role: 'user' as const, content: 'Write a bubble sort in Python' },
    { role: 'assistant' as const, content: 'def bubble_sort(arr):\n  n = len(arr)\n  for i in range(n):\n    for j in range(0, n-i-1):\n      if arr[j] > arr[j+1]:\n        arr[j], arr[j+1] = arr[j+1], arr[j]', meta: { platform: 'nvidia', model: 'mixtral-8x22b', keyUsed: 'sk_nvidia_01', latency: 210, fallbackAttempts: 0 } },
    { role: 'user' as const, content: 'Optimize it for Big-O performance' },
    { role: 'assistant' as const, content: 'Bubble sort is O(N²). Use QuickSort or MergeSort for O(N log N) average complexity.', meta: { platform: 'cerebras', model: 'llama3.1-8b', keyUsed: 'sk_cerebras_01', latency: 125, fallbackAttempts: 1 } },
    { role: 'user' as const, content: 'What is the worst-case space complexity?' },
    { role: 'assistant' as const, content: 'Bubble sort uses O(1) auxiliary space — it sorts in-place with no extra data structures needed.', meta: { platform: 'mistral', model: 'codestral', keyUsed: 'sk_mistral_01', latency: 185, fallbackAttempts: 0 } },
  ]

  useEffect(() => {
    if (step !== 4 || !isOpen) return
    setChatLog([])
    let cancelled = false
    let msgIdx = 0

    const playNext = () => {
      if (cancelled || msgIdx >= chatMessages.length) return
      const msg = chatMessages[msgIdx]
      msgIdx++

      if (msg.role === 'user') {
        let cur = ''
        let i = 0
        setChatLog(prev => [...prev, { role: 'user', content: msg.content, typingContent: '', streamingContent: '', state: 'user-typing' }])
        const iv = setInterval(() => {
          if (cancelled) { clearInterval(iv); return }
          if (i < msg.content.length) {
            cur += msg.content[i]; i++
            setChatLog(prev => prev.map((e, idx) => idx === prev.length - 1 ? { ...e, typingContent: cur } : e))
          } else {
            clearInterval(iv)
            setChatLog(prev => prev.map((e, idx) => idx === prev.length - 1 ? { ...e, state: 'done', typingContent: cur } : e))
            setTimeout(playNext, 300)
          }
        }, 40)
      } else {
        // Show loading dots first
        setChatLog(prev => [...prev, { role: 'assistant', content: msg.content, typingContent: '', streamingContent: '', state: 'loading', meta: msg.meta }])
        const loadingDuration = 700 + Math.random() * 500
        setTimeout(() => {
          if (cancelled) return
          // Switch to streaming — reveal content char by char (SSE simulation)
          setChatLog(prev => prev.map((e, idx) => idx === prev.length - 1 ? { ...e, state: 'streaming' } : e))
          let cur = ''
          let i = 0
          const streamIv = setInterval(() => {
            if (cancelled) { clearInterval(streamIv); return }
            if (i < msg.content.length) {
              // Stream 1-3 chars at a time like real SSE tokens
              const chunk = msg.content.slice(i, i + 2)
              cur += chunk; i += chunk.length
              setChatLog(prev => prev.map((e, idx) => idx === prev.length - 1 ? { ...e, streamingContent: cur } : e))
            } else {
              clearInterval(streamIv)
              setChatLog(prev => prev.map((e, idx) => idx === prev.length - 1 ? { ...e, state: 'done' } : e))
              setTimeout(playNext, 500)
            }
          }, 25)
        }, loadingDuration)
      }
    }

    const startDelay = setTimeout(playNext, 400)
    return () => { cancelled = true; clearTimeout(startDelay) }
  }, [step, isOpen])

  // Auto-scroll chat on new entries
  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
  }, [chatLog])

  // Auto-scroll console as output grows
  useEffect(() => {
    if (consoleScrollRef.current) consoleScrollRef.current.scrollTop = consoleScrollRef.current.scrollHeight
  }, [devConsole])

  if (!isOpen) return null

  // Trigger simulated request in Step 5 Sandbox
  const runSimulatedDevRequest = () => {
    if (devExecuting) return
    setDevExecuting(true)
    setDevConsole('Sending request to server...')
    // Scroll to console panel after a short delay
    setTimeout(() => {
      consoleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 200)

    setTimeout(() => {
      setDevConsole(
        `[System] Hitting proxy sandbox gateway...\n` +
        `[System] Target URL: ${completionEndpoint}\n` +
        `[System] Status: 200 OK\n` +
        `[System] Rerouted: Google (gemini-2.5-flash) via KeyPool-B (sk_gemini_03)\n` +
        `[System] Response size: 485 bytes | Latency: 165ms\n\n` +
        `Connecting SSE Stream...\n`
      )
    }, 1000)

    setTimeout(() => {
      const responseText = "OmniKey AI provides zero downtime with silent multi-provider fallbacks. Your unified API credentials are fully active and compatible with all standard SDK pipelines. Happy hacking!"
      let cur = ""
      let idx = 0
      const typingTimer = setInterval(() => {
        if (idx < responseText.length) {
          cur += responseText[idx]
          setDevConsole(
            `[System] Hitting proxy sandbox gateway...\n` +
            `[System] Target URL: ${completionEndpoint}\n` +
            `[System] Status: 200 OK\n` +
            `[System] Rerouted: Google (gemini-2.5-flash) via KeyPool-B (sk_gemini_03)\n` +
            `[System] Response size: 485 bytes | Latency: 165ms\n\n` +
            `Connecting SSE Stream...\n` +
            `"${cur}"`
          )
          idx++
        } else {
          clearInterval(typingTimer)
          setDevExecuting(false)
        }
      }, 15)
    }, 2200)
  }

  const handleFinish = () => {
    localStorage.setItem('omnikey_onboarded', 'true')
    onClose()
  }

  const stepsCount = 5



  const statusDot: Record<string, string> = {
    healthy: 'bg-emerald-500',
    rate_limited: 'bg-amber-500',
    invalid: 'bg-rose-500',
  }

  const jsCodeSnippet = devFormat === 'openai'
    ? `// OmniKey AI Unified Request Example
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
        model: 'auto',
        messages: [
          { role: 'user', content: 'Explain the advantages of OmniKey\\'s smart fallback routing system.' }
        ],
        stream: true
      })
    });
    console.log('Rerouted automatically on any 429 errors!');
  } catch (err) {
    console.error('Request failed:', err);
  }
}`
    : `// OmniKey AI Unified Request Example (Gemini Format)
const apiKey = '${apiKey}';
const endpoint = '${baseApiUrl}/v1beta/models/auto:generateContent';

async function generateCompletion() {
  try {
    const url = \`\${endpoint}?key=\${apiKey}\`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: 'Explain the advantages of OmniKey\\'s smart fallback routing system.' }] }
        ]
      })
    });
    const data = await response.json();
    console.log(data);
  } catch (err) {
    console.error('Request failed:', err);
  }
}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-background/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-300">

      <style>{`
        @keyframes mock-pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
        @keyframes mock-ping {
          0% { transform: scale(0.85); opacity: 0.8; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        .anim-mock-pulse {
          animation: mock-pulse 2s infinite ease-in-out;
        }
        .anim-mock-ping {
          animation: mock-ping 1.2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        .step-transition {
          transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>

      {/* Onboarding Wizard Panel */}
      <div className="w-full max-w-4xl bg-card border border-border shadow-2xl rounded-3xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] relative">

        {/* Colorful visual backdrop accents */}
        <div className="absolute top-[-10%] left-[-10%] w-[35%] h-[35%] rounded-full bg-violet-600/10 dark:bg-violet-600/5 blur-[90px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[35%] h-[35%] rounded-full bg-emerald-600/10 dark:bg-emerald-600/5 blur-[90px] pointer-events-none" />

        {/* Header toolbar */}
        <div className="px-6 py-4.5 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75 anim-mock-ping"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-violet-600"></span>
            </span>
            <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Onboarding tour</span>
          </div>
          <button
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground font-semibold py-1 px-2.5 rounded-lg hover:bg-muted transition-colors"
          >
            Skip Tour
          </button>
        </div>

        {/* Primary Container */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col min-h-0 space-y-4">

          {/* Progress track */}
          <div className="grid grid-cols-5 gap-2 shrink-0">
            {[1, 2, 3, 4, 5].map(s => (
              <div key={s} className="space-y-1.5">
                <div className={`h-1 rounded-full transition-colors duration-500 ${s <= step ? 'bg-violet-600' : 'bg-muted'}`} />
                <span className={`hidden sm:inline-block text-[9px] font-bold uppercase tracking-wider ${s === step ? 'text-violet-600 dark:text-violet-400' : 'text-muted-foreground'}`}>
                  {s === 1 ? '1. Add Keys' : s === 2 ? '2. Budgets' : s === 3 ? '3. Priority' : s === 4 ? '4. Demonstration' : '5. Dev Corner'}
                </span>
              </div>
            ))}
          </div>

          {/* Headline details */}
          <div className="shrink-0 space-y-0.5 text-center sm:text-left mt-1">
            {step === 1 && (
              <>
                <h3 className="text-base sm:text-lg font-bold text-foreground">Step 1: Add Provider Keys (at /keys)</h3>
                <p className="text-xs text-muted-foreground">Input platform credentials, add custom labels, and check statuses in real time.</p>
              </>
            )}
            {step === 2 && (
              <>
                <h3 className="text-base sm:text-lg font-bold text-foreground">Step 2: Check monthly budgets (at /fallback)</h3>
                <p className="text-xs text-muted-foreground">Shield your budget from runaway token consumption. Inspect segmented monthly allocations and your one-time Promotional Pool (if allocated).</p>
              </>
            )}
            {step === 3 && (
              <>
                <h3 className="text-base sm:text-lg font-bold text-foreground">Step 3: Decide model priority (at /fallback)</h3>
                <p className="text-xs text-muted-foreground">Adjust platform priority rankings. When a key or model fails, the router seamlessly fails over to the next option in the chain.</p>
              </>
            )}
            {step === 4 && (
              <>
                <h3 className="text-base sm:text-lg font-bold text-foreground">Step 4: Smart Failover Demo</h3>
                <p className="text-xs text-muted-foreground">Consecutive prompts automatically reroute past rate-limits (429) and gateway errors (502) silently.</p>
              </>
            )}
            {step === 5 && (
              <>
                <h3 className="text-base sm:text-lg font-bold text-foreground">Step 5: API Sandbox (at /dev-corner)</h3>
                <p className="text-xs text-muted-foreground">Access SDK scripts, copy endpoints/keys, and click "Run Proxy sandbox request" below to simulate API calls.</p>
              </>
            )}
          </div>

          {/* Interactive Screen Simulation Canvas */}
          <div className="flex-1 min-h-[260px] bg-muted/20 border border-border rounded-2xl p-4 flex flex-col justify-center relative overflow-hidden text-xs sm:text-sm">

            {/* Step 1 Simulation: Keys UI */}
            {step === 1 && (
              <div className="overflow-y-auto max-h-[260px] sm:max-h-[320px] space-y-4 w-full max-w-2xl mx-auto animate-in fade-in duration-300 text-left pr-1">
                {/* Simulated Form exactly matching KeysPage */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Add a provider key</div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">Platform</label>
                      <select
                        value={platformInput}
                        disabled
                        className="w-full sm:w-[200px] bg-background border rounded-lg h-8 px-3 text-xs"
                      >
                        <option>Google AI Studio</option>
                        <option>Groq</option>
                      </select>
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <label className="text-xs font-medium">API key</label>
                      <Input
                        type="password"
                        value={keyInput}
                        readOnly
                        placeholder="Input Key"
                        className="font-mono text-xs w-full h-8"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">Label </label>
                      <Input
                        value={labelInput}
                        readOnly
                        placeholder="optional"
                        className="w-full sm:w-[130px] h-8"
                      />
                    </div>

                    <Button type="button" size="sm" className="bg-violet-600 text-white h-8 px-4" disabled>
                      {step1State === 'typing1' || step1State === 'typing2' ? 'Adding...' : 'Add key'}
                    </Button>
                  </div>
                </div>

                {/* Simulated Configured Providers List exactly matching KeysPage */}
                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Configured providers</div>
                  {configuredKeys.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/80 p-6 text-center text-muted-foreground text-xs">
                      No provider keys configured yet. Type and add one above.
                    </div>
                  ) : (
                    <div className="rounded-xl border divide-y bg-card overflow-hidden">
                      {configuredKeys.map((k, i) => (
                        <div key={i} className="flex items-center gap-2 px-3.5 py-2.5 hover:bg-muted/40 transition-colors animate-in slide-in-from-top-1 duration-300">
                          <span className={`size-1.5 rounded-full shrink-0 ${statusDot[k.status]}`} />
                          <code className="text-xs font-mono truncate max-w-[150px] sm:max-w-none">{k.key}</code>
                          <span className="text-xs text-muted-foreground font-semibold">({k.label})</span>
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-500 rounded px-1.5 py-0.5 font-bold uppercase font-mono ml-1">Healthy</span>
                          <span className="flex-1" />
                          <Button variant="ghost" size="xs" className="h-6 text-[10px] text-muted-foreground" disabled>Check</Button>
                          <Button variant="ghost" size="xs" className="h-6 text-[10px] text-red-500" disabled>Remove</Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 2 Simulation: Budgets UI */}
            {step === 2 && (
              <div className="space-y-4 w-full max-w-2xl mx-auto animate-in fade-in duration-300 text-left">
                {/* Simulated PromoUsageBar exactly matching FallbackPage */}
                <section className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.02] p-4.5 space-y-2.5">
                  <div className="flex items-baseline justify-between">
                    <h2 className="text-xs font-bold text-emerald-600 dark:text-emerald-450 flex items-center gap-1.5 uppercase tracking-wider">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 anim-mock-pulse flex-shrink-0" />
                      Promotional token pool
                    </h2>
                    <span className="text-[10px] text-muted-foreground tabular-nums font-bold">
                      <span className="text-foreground">9.2M</span> remaining <span className="mx-1">·</span> 92% of 10M
                    </span>
                  </div>

                  <div className="flex h-2.5 rounded-full overflow-hidden bg-muted">
                    <div className="bg-emerald-500 transition-all duration-[1000ms] w-[92%] ease-out" />
                    <div className="bg-muted-foreground/20 w-[8%]" />
                  </div>
                </section>

                {/* Simulated TokenUsageBar exactly matching FallbackPage */}
                <section className="rounded-xl border border-border bg-card p-4.5 space-y-3">
                  <div className="flex items-baseline justify-between">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Monthly token budget</h2>
                    <span className="text-[10px] text-muted-foreground tabular-nums font-bold">
                      <span className="text-foreground">140M</span> remaining <span className="mx-1">·</span> 70% of 200M
                    </span>
                  </div>

                  <div className="flex h-2.5 rounded-full overflow-hidden bg-muted">
                    <div className="bg-[#4285f4] transition-all duration-[1200ms] w-[40%] ease-out" />
                    <div className="bg-[#f55036] transition-all duration-[1500ms] w-[20%] ease-out" />
                    <div className="bg-[#8b5cf6] transition-all duration-[1800ms] w-[10%] ease-out" />
                    <div className="bg-muted-foreground/25 w-[30%]" />
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-[10px] font-bold text-muted-foreground font-mono mt-1">
                    <div className="flex items-center gap-1.5"><span className="size-2 rounded bg-[#4285f4]" />google: 80M</div>
                    <div className="flex items-center gap-1.5"><span className="size-2 rounded bg-[#f55036]" />groq: 40M</div>
                    <div className="flex items-center gap-1.5"><span className="size-2 rounded bg-[#8b5cf6]" />cerebras: 20M</div>
                  </div>
                </section>
              </div>
            )}

            {/* Step 3 Simulation: Fallback Priority List */}
            {step === 3 && (
              <div className="space-y-3 w-full max-w-xl mx-auto animate-in fade-in duration-300 text-left">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-center mb-1">
                  Active Fallback Order
                </div>

                <div className="rounded-xl border border-border divide-y bg-card overflow-hidden">

                  {/* Row 1 */}
                  <div className={`flex items-center gap-3 px-4 py-3 transition-all duration-700 ${step3Dragged ? 'bg-violet-500/[0.03] border-violet-500/20' : 'bg-card'
                    }`}>
                    <button className="cursor-grab text-muted-foreground/60 select-none text-xs">⠿</button>
                    <span className="text-xs font-mono text-violet-600 dark:text-violet-400 font-bold w-4 text-center">
                      {step3Dragged ? '1' : '2'}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm">google/gemini-2.5-flash</span>
                        <span className="text-[10px] text-muted-foreground">google</span>
                      </div>
                      <div className="flex gap-3 text-[9px] font-bold text-muted-foreground mt-0.5 uppercase tracking-wide">
                        <span>Intel #1</span>
                        <span>Speed #2</span>
                        <span>40M tok/mo</span>
                      </div>
                    </div>
                    <Switch checked={true} readOnly />
                  </div>

                  {/* Row 2 */}
                  <div className="flex items-center gap-3 px-4 py-3 bg-card transition-all duration-700">
                    <button className="cursor-grab text-muted-foreground/60 select-none text-xs">⠿</button>
                    <span className="text-xs font-mono text-muted-foreground font-bold w-4 text-center">
                      {step3Dragged ? '2' : '1'}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm">groq/llama-3.1-70b</span>
                        <span className="text-[10px] text-muted-foreground">groq</span>
                      </div>
                      <div className="flex gap-3 text-[9px] font-bold text-muted-foreground mt-0.5 uppercase tracking-wide">
                        <span>Intel #2</span>
                        <span>Speed #1</span>
                        <span>20M tok/mo</span>
                      </div>
                    </div>
                    <Switch checked={true} readOnly />
                  </div>

                  {/* Row 3 */}
                  <div className="flex items-center gap-3 px-4 py-3 bg-card opacity-50">
                    <button className="cursor-grab text-muted-foreground/60 select-none text-xs">⠿</button>
                    <span className="text-xs font-mono text-muted-foreground font-bold w-4 text-center">3</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm">nvidia/mixtral-8x22b</span>
                        <span className="text-[10px] text-muted-foreground">nvidia</span>
                      </div>
                      <div className="flex gap-3 text-[9px] font-bold text-muted-foreground mt-0.5 uppercase tracking-wide">
                        <span>Intel #3</span>
                        <span>Speed #3</span>
                        <span>10M tok/mo</span>
                      </div>
                    </div>
                    <Switch checked={false} readOnly />
                  </div>
                </div>

                {/* Animated cursor overlay */}
                <div className={`absolute left-[12%] pointer-events-none transition-all duration-1000 flex items-center justify-center ${step3Dragged ? 'top-[44%] opacity-0 scale-75' : 'top-[22%] opacity-100 scale-110'
                  }`}>
                  <div className="size-6 rounded-full border-2 border-violet-600 bg-violet-600/35 anim-mock-pulse" />
                </div>
              </div>
            )}

            {/* Step 4 Simulation: Animated Chat Playground */}
            {step === 4 && (
              <div className="w-full max-w-2xl mx-auto flex flex-col min-h-[220px] animate-in fade-in duration-300 text-left">
                {/* Playground header */}
                <div className="shrink-0 px-3 py-2 bg-muted/40 border border-border rounded-t-xl flex items-center justify-between mb-0">
                  <span className="text-[10px] font-bold text-muted-foreground">Playground — Auto Routing Active</span>
                  <span className="text-[9px] px-2 py-0.5 rounded bg-violet-500/10 text-violet-500 font-bold uppercase">SSE Streaming</span>
                </div>
                {/* Chat window */}
                <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-2 py-3 space-y-3 border border-t-0 border-border rounded-b-xl bg-background/50 max-h-[240px]">
                  {chatLog.map((entry, idx) => (
                    <div key={idx} className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-1 duration-200`}>
                      <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${entry.role === 'user' ? 'bg-violet-600 text-white' : 'bg-muted border border-border'
                        }`}>
                        {entry.state === 'user-typing' ? (
                          <p className="whitespace-pre-wrap">
                            {entry.typingContent}
                            <span className="inline-block w-0.5 h-3 bg-white/80 ml-0.5 animate-pulse align-middle" />
                          </p>
                        ) : entry.state === 'loading' ? (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                          </span>
                        ) : entry.state === 'streaming' ? (
                          <p className="whitespace-pre-wrap">
                            {entry.streamingContent}
                            <span className="inline-block w-0.5 h-3 bg-muted-foreground/60 ml-0.5 animate-pulse align-middle" />
                          </p>
                        ) : (
                          <>
                            <p className="whitespace-pre-wrap">{entry.content}</p>
                            {entry.meta && (
                              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80 font-mono">
                                <span>{entry.meta.platform}</span>
                                <span>· {entry.meta.model}</span>
                                <span className="bg-violet-500/10 text-violet-500 px-1 py-0.5 rounded">Key: {entry.meta.keyUsed}</span>
                                <span>· {entry.meta.latency}ms</span>
                                {entry.meta.fallbackAttempts > 0 && (
                                  <span className="bg-amber-500/10 text-amber-500 px-1 py-0.5 rounded flex items-center gap-1">
                                    <span className="size-1 rounded-full bg-amber-500 animate-pulse" />
                                    {entry.meta.fallbackAttempts} fallback
                                  </span>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  {chatLog.length === 0 && (
                    <div className="text-center text-muted-foreground text-xs py-6">Starting simulation...</div>
                  )}
                </div>
              </div>
            )}

            {/* Step 5 Simulation: Dev Corner UI */}
            {step === 5 && (
              <div className="w-full max-w-3xl mx-auto animate-in fade-in duration-300 text-left flex flex-col lg:grid lg:grid-cols-2 gap-4 overflow-y-auto max-h-[320px] sm:max-h-[380px] pr-1">

                {/* Left: Config panel */}
                <div className="bg-card border rounded-xl p-3.5 space-y-3 shrink-0">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Request Configuration</div>

                  <div className="space-y-2 text-[10px] font-semibold text-muted-foreground">
                    <div>
                      <label className="block text-[8px] uppercase font-bold text-slate-500 mb-1">API Key Format</label>
                      <select value={devFormat} onChange={e => setDevFormat(e.target.value as 'openai' | 'gemini')} className="w-full bg-background border rounded h-6 px-2 text-[9px] focus:outline-none">
                        <option value="openai">OpenAI Format (/v1/...)</option>
                        <option value="gemini">Gemini Format (/v1beta/...)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[8px] uppercase font-bold text-slate-500 mb-1">Unified key</label>
                      <Input value={apiKey} readOnly className="w-full font-mono text-[9px] bg-muted/40 h-6 px-2" />
                    </div>
                    <div>
                      <label className="block text-[8px] uppercase font-bold text-slate-500 mb-1">Target Endpoint</label>
                      <Input value={completionEndpoint} readOnly className="w-full font-mono text-[9px] bg-muted/40 h-6 px-2" />
                    </div>
                    <div>
                      <label className="block text-[8px] uppercase font-bold text-slate-500 mb-1">User Conversation Prompt</label>
                      <textarea
                        rows={2}
                        value="Explain the advantages of OmniKey's smart fallback routing system."
                        readOnly
                        className="w-full bg-background border rounded-lg px-2 py-1 text-[9px] font-medium bg-muted/20 focus:outline-none resize-none font-mono"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={runSimulatedDevRequest}
                    disabled={devExecuting}
                    className="w-full py-3 h-auto bg-violet-600 hover:bg-violet-500 text-[10px] font-bold text-white shadow shadow-violet-500/10 active:scale-[0.98] transition-all rounded-lg"
                  >
                    {devExecuting ? 'Executing Request...' : 'Run Proxy Sandbox Request'}
                  </Button>
                </div>

                {/* Right: SDK snippet + console (stacked within right column) */}
                <div className="flex flex-col gap-3 min-h-0">
                  {/* SDK snippet */}
                  <div className="bg-card border rounded-xl p-3 shrink-0">
                    <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Dynamic SDK Code Snippet</div>
                    <div className="bg-slate-50 dark:bg-slate-950 rounded-lg p-2 overflow-auto border border-border max-h-[130px]">
                      <pre className="text-[8px] font-mono leading-relaxed text-indigo-950 dark:text-indigo-200 whitespace-pre">{jsCodeSnippet}</pre>
                    </div>
                  </div>

                  {/* Execution console */}
                  <div ref={consoleRef} className="bg-card border rounded-xl p-3 shrink-0">
                    <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>Execution Console</span>
                      {devExecuting && <span className="text-[8px] text-emerald-500 animate-pulse font-bold lowercase">Streaming SSE...</span>}
                    </div>
                    <div
                      ref={consoleScrollRef}
                      className="bg-slate-50 dark:bg-slate-950 rounded-lg p-2.5 overflow-auto border border-border font-mono text-[9px] text-emerald-700 dark:text-emerald-400 leading-relaxed whitespace-pre-wrap h-[120px] sm:h-[140px]"
                    >
                      {devConsole}
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>

        {/* Footer controls */}
        <div className="px-6 py-4.5 border-t border-border bg-card/60 backdrop-blur-sm flex items-center justify-between shrink-0">
          <div className="flex gap-2">
            {step > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(prev => prev - 1)}
                className="step-transition px-4"
              >
                Back
              </Button>
            )}
          </div>

          <div className="flex gap-2 items-center">
            <span className="text-[11px] text-muted-foreground mr-1">
              Step {step} of {stepsCount}
            </span>
            {step < stepsCount ? (
              <Button
                variant="default"
                size="sm"
                onClick={() => setStep(prev => prev + 1)}
                className="step-transition bg-violet-600 hover:bg-violet-500 text-white font-bold px-4"
              >
                Next
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={handleFinish}
                className="step-transition bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 animate-pulse shadow-md shadow-emerald-600/20"
              >
                Got it!
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
