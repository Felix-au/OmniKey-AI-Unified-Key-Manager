import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface OnboardingTourProps {
  isOpen: boolean
  onClose: () => void
}

export function OnboardingTour({ isOpen, onClose }: OnboardingTourProps) {
  const [step, setStep] = useState(1)
  
  // Animation state for Step 1
  const [step1State, setStep1State] = useState<'idle' | 'typing1' | 'success1' | 'typing2' | 'success2'>('idle')
  const [key1Text, setKey1Text] = useState('')
  const [key2Text, setKey2Text] = useState('')

  // Animation state for Step 3
  const [step3Dragged, setStep3Dragged] = useState(false)

  // Animation state for Step 4
  const [activeMsgCount, setActiveMsgCount] = useState(1)

  // Manage Step 1 typing sequences
  useEffect(() => {
    if (step !== 1 || !isOpen) return
    setStep1State('idle')
    setKey1Text('')
    setKey2Text('')

    const t1 = setTimeout(() => {
      setStep1State('typing1')
      let fullText = 'AIzaSyB_SimulatedGoogleKey123'
      let cur = ''
      let idx = 0
      const timer = setInterval(() => {
        if (idx < fullText.length) {
          cur += fullText[idx]
          setKey1Text(cur)
          idx++
        } else {
          clearInterval(timer)
          setStep1State('success1')
        }
      }, 50)
      return () => clearInterval(timer)
    }, 1000)

    const t2 = setTimeout(() => {
      setStep1State('typing2')
      let fullText = 'gsk_SimulatedGroqKey998877'
      let cur = ''
      let idx = 0
      const timer = setInterval(() => {
        if (idx < fullText.length) {
          cur += fullText[idx]
          setKey2Text(cur)
          idx++
        } else {
          clearInterval(timer)
          setStep1State('success2')
        }
      }, 50)
      return () => clearInterval(timer)
    }, 3500)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [step, isOpen])

  // Manage Step 3 draggable reset interval
  useEffect(() => {
    if (step !== 3 || !isOpen) return
    setStep3Dragged(false)
    const t = setInterval(() => {
      setStep3Dragged(prev => !prev)
    }, 3000)
    return () => clearInterval(t)
  }, [step, isOpen])

  // Manage Step 4 chat message increment sequence
  useEffect(() => {
    if (step !== 4 || !isOpen) return
    setActiveMsgCount(1)
    const interval = setInterval(() => {
      setActiveMsgCount(prev => (prev < 5 ? prev + 1 : 1))
    }, 4500)
    return () => clearInterval(interval)
  }, [step, isOpen])

  if (!isOpen) return null

  const handleFinish = () => {
    localStorage.setItem('omnikey_onboarded', 'true')
    onClose()
  }

  const stepsCount = 4

  const simulatedChatData = [
    {
      prompt: "Analyze user demographics in the cloud",
      target: "Groq (llama-3-70b)",
      key: "KeyPool-A (sk_groq_01)",
      status: "success",
      color: "text-orange-500",
      bg: "bg-orange-500/5 border-orange-500/20",
      latency: "148ms",
      response: "Cloud demographics show a 42% growth rate in key markets, highly concentrated in US-East."
    },
    {
      prompt: "Summarize top cloud integration risks",
      target: "Groq (llama-3-70b)",
      key: "KeyPool-A (sk_groq_01)",
      status: "failover",
      color: "text-orange-500",
      bg: "bg-amber-500/5 border-amber-500/20",
      latency: "312ms",
      failoverTarget: "Gemini (gemini-1.5-flash)",
      failoverKey: "KeyPool-B (sk_gemini_03)",
      response: "Groq sk_groq_01 returned HTTP 429 (Rate Limit Exhausted). Silently auto-routed to Gemini: Top integration risks include API latency, synchronization delays, and transient connection losses."
    },
    {
      prompt: "Write a bubble sort algorithm in Python",
      target: "NVIDIA (mixtral-8x22b)",
      key: "KeyPool-C (sk_nvidia_01)",
      status: "success",
      color: "text-emerald-500",
      bg: "bg-emerald-500/5 border-emerald-500/20",
      latency: "210ms",
      response: "Here is your bubble sort:\n\n```python\ndef bubble_sort(arr):\n    n = len(arr)\n    for i in range(n):\n        for j in range(0, n-i-1):\n            if arr[j] > arr[j+1]:\n                arr[j], arr[j+1] = arr[j+1], arr[j]\n```"
    },
    {
      prompt: "Optimize it for Big-O performance",
      target: "NVIDIA (mixtral-8x22b)",
      key: "KeyPool-C (sk_nvidia_01)",
      status: "failover_error",
      color: "text-emerald-500",
      bg: "bg-rose-500/5 border-rose-500/20",
      latency: "125ms",
      failoverTarget: "Cerebras (llama3.1-8b)",
      failoverKey: "KeyPool-D (sk_cerebras_01)",
      response: "NVIDIA sk_nvidia_01 returned HTTP 502 (Gateway Timeout). Silently auto-routed to Cerebras: Bubble sort has worst-case O(N^2). Optimize by keeping track of swaps or using QuickSort / MergeSort for O(N log N)."
    },
    {
      prompt: "What is the worst-case space complexity?",
      target: "Mistral (codestral)",
      key: "KeyPool-E (sk_mistral_01)",
      status: "success",
      color: "text-amber-500",
      bg: "bg-amber-500/5 border-amber-500/20",
      latency: "185ms",
      response: "The worst-case space complexity of bubble sort is O(1) auxiliary space, as it performs sorting in-place without copying data."
    }
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-background/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-300">
      
      {/* CSS Animation classes injection */}
      <style>{`
        @keyframes simulated-pulse {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.05); }
        }
        @keyframes simulated-ping {
          0% { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(2); opacity: 0; }
        }
        .anim-sim-pulse {
          animation: simulated-pulse 2s infinite ease-in-out;
        }
        .anim-sim-ping {
          animation: simulated-ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        .step-transition {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>

      {/* Main glassmorphic card wrapper */}
      <div className="w-full max-w-3xl bg-card border border-border shadow-2xl rounded-3xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh] relative transform active:scale-100 transition-all duration-300">
        
        {/* Glow accent filters */}
        <div className="absolute top-[-10%] left-[-10%] w-[35%] h-[35%] rounded-full bg-violet-600/10 dark:bg-violet-600/5 blur-[80px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[35%] h-[35%] rounded-full bg-indigo-600/10 dark:bg-indigo-600/5 blur-[80px] pointer-events-none" />

        {/* Header */}
        <div className="px-6 py-5 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75 anim-sim-ping"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-violet-600"></span>
            </span>
            <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">OmniKey Interactive Tour</span>
          </div>
          <button 
            onClick={onClose} 
            className="text-xs text-muted-foreground hover:text-foreground font-semibold py-1 px-2.5 rounded-lg hover:bg-muted transition-colors"
          >
            Skip Tour
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 flex flex-col min-h-0 space-y-4">
          
          {/* Steps tracker breadcrumbs */}
          <div className="grid grid-cols-4 gap-2 shrink-0">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className="space-y-1.5">
                <div className={`h-1 rounded-full transition-colors duration-500 ${s <= step ? 'bg-violet-600' : 'bg-muted'}`} />
                <span className={`hidden sm:inline-block text-[9px] font-bold uppercase tracking-wider ${s === step ? 'text-violet-600 dark:text-violet-400' : 'text-muted-foreground'}`}>
                  {s === 1 ? 'API Keys' : s === 2 ? 'Budgets' : s === 3 ? 'Priority' : 'Failover'}
                </span>
              </div>
            ))}
          </div>

          {/* Title & Description */}
          <div className="shrink-0 space-y-1 text-center sm:text-left mt-1">
            {step === 1 && (
              <>
                <h3 className="text-base sm:text-lg font-bold text-foreground">Step 1: Adding your provider keys</h3>
                <p className="text-xs text-muted-foreground">Add credentials for Google, Groq, NVIDIA, etc. OmniKey healthchecks and validates keys automatically in the background.</p>
              </>
            )}
            {step === 2 && (
              <>
                <h3 className="text-base sm:text-lg font-bold text-foreground">Step 2: Monitoring token budgets</h3>
                <p className="text-xs text-muted-foreground">Set and check monthly budgets per model platform to shield yourself against runaway costs or billing surprises.</p>
              </>
            )}
            {step === 3 && (
              <>
                <h3 className="text-base sm:text-lg font-bold text-foreground">Step 3: Deciding model fallback priority</h3>
                <p className="text-xs text-muted-foreground">Arrange platforms in priority order. When a model throws an error, OmniKey automatically cascades to the next configured fallback.</p>
              </>
            )}
            {step === 4 && (
              <>
                <h3 className="text-base sm:text-lg font-bold text-foreground">Step 4: Smart Failover simulation</h3>
                <p className="text-xs text-muted-foreground">Watch how 5 consecutive chat playground requests traverse different keys, platforms, and models under error states.</p>
              </>
            )}
          </div>

          {/* Visual simulation canvas container */}
          <div className="flex-1 min-h-[220px] bg-muted/30 border border-border rounded-2xl p-4 flex flex-col justify-center relative overflow-hidden text-xs sm:text-sm">
            
            {/* Step 1 Visual Mockup: Adding keys typing effect */}
            {step === 1 && (
              <div className="space-y-3.5 max-w-md mx-auto w-full animate-in fade-in duration-300">
                <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm space-y-2.5">
                  <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    <span>Platform: Google Studio</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded ${step1State === 'success1' || step1State === 'typing2' || step1State === 'success2' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>
                      {step1State === 'success1' || step1State === 'typing2' || step1State === 'success2' ? '✓ HealthyChecked' : 'Verifying...'}
                    </span>
                  </div>
                  <div className="font-mono text-xs p-2 rounded-lg bg-background border border-border flex items-center justify-between min-h-[34px] overflow-hidden whitespace-nowrap">
                    <span className="truncate">{key1Text || 'typing...'}</span>
                    {(step1State === 'success1' || step1State === 'typing2' || step1State === 'success2') && (
                      <span className="size-2 rounded-full bg-emerald-500 shrink-0 shadow-lg shadow-emerald-500/30" />
                    )}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm space-y-2.5 transition-all duration-500">
                  <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    <span>Platform: Groq Cloud</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded ${step1State === 'success2' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>
                      {step1State === 'success2' ? '✓ HealthyChecked' : 'Verifying...'}
                    </span>
                  </div>
                  <div className="font-mono text-xs p-2 rounded-lg bg-background border border-border flex items-center justify-between min-h-[34px] overflow-hidden whitespace-nowrap">
                    <span className="truncate">{key2Text || (step1State === 'success1' ? 'idle' : '...')}</span>
                    {step1State === 'success2' && (
                      <span className="size-2 rounded-full bg-emerald-500 shrink-0 shadow-lg shadow-emerald-500/30" />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2 Visual Mockup: Token budgets segmented bar */}
            {step === 2 && (
              <div className="space-y-4 max-w-md mx-auto w-full animate-in fade-in duration-300">
                {/* Promo usage card mock */}
                <div className="p-4 rounded-xl border border-emerald-500/10 bg-emerald-500/[0.03] space-y-2">
                  <div className="flex justify-between text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    <span>Promotional token pool</span>
                    <span>9.2M / 10M remaining</span>
                  </div>
                  <div className="w-full h-2 bg-emerald-500/10 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-[1500ms] w-[92%] ease-out" />
                  </div>
                </div>

                {/* Monthly usage card mock */}
                <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                  <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
                    <span>Monthly budget segments</span>
                    <span>140M / 200M remaining (70%)</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden flex">
                    <div className="h-full bg-[#4285f4] transition-all duration-[1000ms] w-[40%] ease-out" title="Google segment" />
                    <div className="h-full bg-[#f55036] transition-all duration-[1200ms] w-[20%] ease-out" title="Groq segment" />
                    <div className="h-full bg-[#76b900] transition-all duration-[1500ms] w-[10%] ease-out" title="NVIDIA segment" />
                    <div className="h-full bg-muted-foreground/20 w-[30%]" title="Used" />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    <div className="flex items-center gap-1.5"><span className="size-1.5 rounded-sm bg-[#4285f4]" />Google: 80M</div>
                    <div className="flex items-center gap-1.5"><span className="size-1.5 rounded-sm bg-[#f55036]" />Groq: 40M</div>
                    <div className="flex items-center gap-1.5"><span className="size-1.5 rounded-sm bg-[#76b900]" />NVIDIA: 20M</div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3 Visual Mockup: Fallback Priority Swap Animation */}
            {step === 3 && (
              <div className="space-y-2.5 max-w-sm mx-auto w-full animate-in fade-in duration-300">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 text-center">
                  Drag & Drop Priority Ordering
                </div>
                
                {/* List item #1 */}
                <div className={`p-3 rounded-xl border text-xs bg-card flex items-center gap-2.5 transition-all duration-700 ${
                  step3Dragged ? 'border-violet-500/20 bg-violet-500/[0.02] shadow-sm' : 'border-border'
                }`}>
                  <span className="text-muted-foreground select-none">⠿</span>
                  <span className="font-bold text-violet-600 dark:text-violet-400 w-3 text-center">{step3Dragged ? '1' : '2'}</span>
                  <span className="font-medium">google/gemini-2.5-flash</span>
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-bold uppercase font-mono">Google</span>
                </div>

                {/* List item #2 */}
                <div className={`p-3 rounded-xl border border-border text-xs bg-card flex items-center gap-2.5 transition-all duration-700`}>
                  <span className="text-muted-foreground select-none">⠿</span>
                  <span className="font-bold text-muted-foreground w-3 text-center">{step3Dragged ? '2' : '1'}</span>
                  <span className="font-medium">groq/llama-3.1-70b</span>
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-500 font-bold uppercase font-mono">Groq</span>
                </div>

                {/* List item #3 */}
                <div className="p-3 rounded-xl border border-border text-xs bg-card flex items-center gap-2.5 opacity-60">
                  <span className="text-muted-foreground select-none">⠿</span>
                  <span className="font-bold text-muted-foreground w-3 text-center">3</span>
                  <span className="font-medium">nvidia/mixtral-8x22b</span>
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold uppercase font-mono">NVIDIA</span>
                </div>

                {/* Drag Indicator Overlay Ring */}
                <div className={`absolute left-[15%] pointer-events-none transition-all duration-1000 flex items-center justify-center ${
                  step3Dragged ? 'top-[42%] opacity-0 scale-75' : 'top-[22%] opacity-100 scale-110'
                }`}>
                  <div className="size-6 rounded-full border border-violet-500 bg-violet-500/20 anim-sim-pulse flex items-center justify-center">
                    <span className="text-xs">✨</span>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4 Visual Mockup: Animated Failover Chat Log */}
            {step === 4 && (
              <div className="space-y-3 flex-1 flex flex-col justify-end min-h-0 animate-in fade-in duration-300 w-full">
                
                {/* Top tracking state indicator */}
                <div className="absolute top-2.5 left-0 right-0 text-center shrink-0 flex items-center justify-center gap-2">
                  <span className="text-[10px] bg-violet-600/10 text-violet-500 border border-violet-500/20 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                    Simulating Request {activeMsgCount} of 5
                  </span>
                  <span className="text-[9px] text-muted-foreground anim-sim-pulse">Looping demo...</span>
                </div>

                {/* Scrollbox of mock logs */}
                <div className="space-y-3.5 overflow-y-auto px-1.5 py-2 max-h-[190px] text-xs sm:text-[11px] leading-relaxed scrollbar-none">
                  {simulatedChatData.map((item, idx) => {
                    const isVisible = idx < activeMsgCount
                    if (!isVisible) return null

                    return (
                      <div key={idx} className="space-y-1.5 animate-in slide-in-from-bottom-2 duration-300">
                        {/* Prompt */}
                        <div className="flex gap-2 justify-end">
                          <div className="bg-violet-600 text-white rounded-xl px-3 py-1.5 max-w-[80%] font-semibold text-right shadow-sm">
                            {item.prompt}
                          </div>
                        </div>

                        {/* Rerouted detail payload panel */}
                        <div className={`p-3 rounded-xl border ${item.bg} max-w-[85%] font-medium space-y-1`}>
                          
                          {/* Route line */}
                          <div className="flex items-center gap-1.5 flex-wrap font-bold text-[9px] uppercase tracking-wider">
                            <span className={item.color}>{item.target}</span>
                            <span className="text-muted-foreground">· Key: {item.key}</span>
                            <span className="text-muted-foreground">· {item.latency}</span>
                          </div>

                          {/* Failover cascader log */}
                          {item.status === 'failover' && (
                            <div className="p-1.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-bold font-mono text-[9px] uppercase tracking-wide flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Failover: Groq 429 ➔ Rerouted to {item.failoverTarget}
                            </div>
                          )}

                          {item.status === 'failover_error' && (
                            <div className="p-1.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-bold font-mono text-[9px] uppercase tracking-wide flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                              Failover: NVIDIA 502 ➔ Rerouted to {item.failoverTarget}
                            </div>
                          )}

                          {/* Mock response bubble */}
                          <p className="text-foreground/90 whitespace-pre-line mt-1">{item.response}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer actions bar */}
        <div className="px-6 py-4 border-t border-border bg-card/60 backdrop-blur-sm flex items-center justify-between shrink-0">
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
                Got it! Finish Tour
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
