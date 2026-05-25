import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import logoUrl from '../assets/logo.png'

function useDark() {
  const [dark, setDark] = useState(() =>
    typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
  )
  useEffect(() => {
    const stored = localStorage.getItem('theme')
    if (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark')
      setDark(true)
    }
  }, [])
  const toggle = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }
  return { dark, toggle }
}

const providers = ['Google', 'Groq', 'Mistral', 'NVIDIA', 'Cerebras', 'SambaNova', 'Cohere', 'OpenRouter', 'Cloudflare', 'Zhipu', 'HuggingFace', 'GitHub']
const providerColors: Record<string, string> = {
  Google: 'bg-blue-500', Groq: 'bg-orange-500', Mistral: 'bg-purple-500', NVIDIA: 'bg-green-500',
  Cerebras: 'bg-teal-500', SambaNova: 'bg-red-500', Cohere: 'bg-yellow-500', OpenRouter: 'bg-slate-400',
  Cloudflare: 'bg-orange-400', Zhipu: 'bg-cyan-500', HuggingFace: 'bg-yellow-400', GitHub: 'bg-slate-500',
}

// ── Mock Chat Messages ────────────────────────────────────────────────────────
const mockChat = [
  { role: 'user', text: 'Explain quantum entanglement simply.' },
  { role: 'assistant', text: 'Quantum entanglement is when two particles become linked — measuring one instantly affects the other, no matter the distance. Einstein famously called it "spooky action at a distance."', meta: '312 ms · 47 tokens · gemini-2.5-flash' },
  { role: 'user', text: 'Can it be used for faster-than-light communication?' },
  { role: 'assistant', text: 'No — while the correlation is instant, you cannot use it to send information faster than light. The measurement results are random, so no message can be encoded in them.', meta: '198 ms · 39 tokens · gemini-2.5-flash' },
]

// ── Mock Arena Panels ─────────────────────────────────────────────────────────
const arenaPanels = [
  { model: 'gemini-2.5-flash', color: 'text-blue-400', border: 'border-blue-500/30', latency: '210ms', text: 'Quantum entanglement links particles so measuring one instantly determines the state of the other, regardless of distance.' },
  { model: 'llama-3.3-70b', color: 'text-orange-400', border: 'border-orange-500/30', latency: '188ms', text: 'When particles are entangled, their quantum states are correlated. Observing one collapses both wavefunctions simultaneously.' },
  { model: 'mistral-large', color: 'text-purple-400', border: 'border-purple-500/30', latency: '340ms', text: 'Two entangled particles share a quantum state. Measuring one instantly influences the other — no matter how far apart they are.' },
  { model: 'qwen-2.5-72b', color: 'text-emerald-400', border: 'border-emerald-500/30', latency: '220ms', text: '• Particles share a joint quantum state\n• Measuring one collapses both\n• No information travels between them\n• Distance is irrelevant' },
]

// ── Mock Debate ───────────────────────────────────────────────────────────────
const debateMsgs = [
  { role: 'infavor', label: 'In Favor · gemini-2.5-flash', text: 'AI enhances creativity by handling repetitive tasks, freeing humans for higher-order creative thinking. Tools like Midjourney and GitHub Copilot prove this already.' },
  { role: 'against', label: 'Against · llama-3.3-70b', text: 'Creativity is fundamentally human — rooted in emotion, lived experience, and intention. AI can mimic patterns, but it cannot truly innovate without a soul.' },
  { role: 'judge', label: '⚖ Judge · gpt-4o-mini · Round 1', text: 'Both arguments are well-structured. In Favor scores 7/10 for pragmatic evidence. Against scores 8/10 for philosophical depth. Slight edge to Against this round.' },
]

// ── Mock Fallback Chain ───────────────────────────────────────────────────────
const fallbackChain = [
  { name: 'Google Gemini', status: 'active', latency: '200ms', note: '' },
  { name: 'Groq', status: 'limited', latency: '—', note: '429 Rate Limited' },
  { name: 'Cerebras', status: 'standby', latency: '—', note: 'Auto-failover ↓' },
  { name: 'SambaNova', status: 'standby', latency: '—', note: '' },
]

// ── Section Wrapper ───────────────────────────────────────────────────────────
function Section({ children, alt = false, id }: { children: React.ReactNode; alt?: boolean; id?: string }) {
  return (
    <section id={id} className={`py-20 px-6 ${alt ? 'bg-muted/30 dark:bg-white/[0.02]' : ''}`}>
      <div className="max-w-6xl mx-auto">{children}</div>
    </section>
  )
}

function Pill({ label, color = 'violet' }: { label: string; color?: string }) {
  const map: Record<string, string> = {
    violet: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
    green: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  }
  return <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full border ${map[color] ?? map.violet} mb-4`}>{label}</span>
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-3xl font-bold tracking-tight text-foreground mb-3">{children}</h2>
}

function SectionSub({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-base leading-relaxed max-w-md">{children}</p>
}

function MockCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-card/80 backdrop-blur shadow-xl overflow-hidden ${className}`}>
      {children}
    </div>
  )
}

// ── Landing Page ──────────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate()
  const { dark, toggle } = useDark()

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* NAV */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-6">
          <div className="flex items-center gap-2 shrink-0">
            <img src={logoUrl} alt="OmniKey AI" className="h-6 w-6 object-contain" />
            <span className="font-semibold text-sm tracking-tight">OmniKey AI</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 ml-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#arena" className="hover:text-foreground transition-colors">Arena</a>
            <a href="#debate" className="hover:text-foreground transition-colors">Debate</a>
            <a href="#routing" className="hover:text-foreground transition-colors">Routing</a>
            <a href="https://github.com/Felix-au/OmniKey-AI-Unified-Key-Manager" target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">GitHub</a>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <button onClick={toggle} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors text-sm">
              {dark ? '☀' : '🌙'}
            </button>
            <button
              onClick={() => navigate('/playground')}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all"
            >
              Open Dashboard →
            </button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative py-28 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 -z-10 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[600px] rounded-full bg-violet-500/10 dark:bg-violet-500/5 blur-3xl" />
        </div>
        <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-500 mb-6">
          ⚡ 12 Free LLM Providers. Zero Lock-in.
        </span>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
          One Key.<br />
          <span className="bg-gradient-to-r from-violet-500 to-indigo-500 bg-clip-text text-transparent">Every Model.</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
          OmniKey AI routes your requests across Gemini, Groq, Mistral, NVIDIA, Cerebras and 7 more — with automatic fallbacks, live token tracking, and a built-in AI sandbox suite.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <button
            onClick={() => navigate('/playground')}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold px-8 py-3.5 rounded-2xl text-base transition-all shadow-lg shadow-violet-500/20"
          >
            Open Dashboard →
          </button>
          <a
            href="https://github.com/Felix-au/OmniKey-AI-Unified-Key-Manager"
            target="_blank" rel="noreferrer"
            className="border border-border bg-card hover:bg-accent/60 text-foreground font-semibold px-8 py-3.5 rounded-2xl text-base transition-all"
          >
            View on GitHub
          </a>
        </div>
        {/* Provider pills */}
        <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
          {providers.map(p => (
            <span key={p} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border bg-card/60 text-muted-foreground">
              <span className={`w-2 h-2 rounded-full ${providerColors[p]}`} />
              {p}
            </span>
          ))}
        </div>
      </section>

      {/* STATS */}
      <div className="max-w-4xl mx-auto px-6 mb-8">
        <div className="grid grid-cols-3 divide-x divide-border rounded-2xl border border-border bg-card/60 backdrop-blur">
          {[['100+', 'Models Available'], ['1B+', 'Free Tokens / Month'], ['12', 'Free Providers']].map(([val, label]) => (
            <div key={label} className="py-6 text-center">
              <div className="text-3xl font-extrabold text-foreground">{val}</div>
              <div className="text-xs text-muted-foreground mt-1">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── SECTION: Chat Playground ── */}
      <Section id="features" alt>
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <Pill label="Chat Playground" color="green" />
            <SectionHeading>Test Any Model Instantly</SectionHeading>
            <SectionSub>Switch between OpenAI and Gemini formats. Pick any model, type your prompt, and see real AI responses with live latency and token metrics.</SectionSub>
          </div>
          <MockCard>
            <div className="bg-muted/40 dark:bg-white/5 px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">gemini-2.5-flash</span>
              <span className="text-[10px] bg-violet-500/10 text-violet-500 border border-violet-500/20 rounded-full px-2 py-0.5 font-semibold">OpenAI Format</span>
            </div>
            <div className="p-4 space-y-3 min-h-[220px]">
              {mockChat.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${m.role === 'user' ? 'bg-violet-600 text-white' : 'bg-muted/60 dark:bg-white/8 text-foreground border border-border'}`}>
                    {m.text}
                    {m.meta && <div className="mt-1 text-[10px] opacity-60">{m.meta}</div>}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border px-4 py-3 flex gap-2">
              <div className="flex-1 bg-muted/40 dark:bg-white/5 rounded-xl text-xs px-3 py-2 text-muted-foreground">Type a message...</div>
              <div className="bg-violet-600 rounded-xl px-3 py-2 text-white text-xs font-semibold">Send</div>
            </div>
          </MockCard>
        </div>
      </Section>

      {/* ── SECTION: Arena ── */}
      <Section id="arena">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <MockCard>
            <div className="bg-muted/40 dark:bg-white/5 px-4 py-3 border-b border-border">
              <span className="text-xs font-semibold text-muted-foreground">Prompt: "Explain quantum entanglement simply."</span>
            </div>
            <div className="grid grid-cols-2 gap-0 divide-x divide-y divide-border">
              {arenaPanels.map((p, i) => (
                <div key={i} className="p-3">
                  <div className={`text-[10px] font-semibold mb-2 ${p.color} flex items-center justify-between`}>
                    <span>{p.model}</span>
                    <span className="text-muted-foreground font-normal">{p.latency}</span>
                  </div>
                  <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-line">{p.text}</p>
                </div>
              ))}
            </div>
          </MockCard>
          <div>
            <Pill label="Side-by-Side Arena" color="blue" />
            <SectionHeading>Compare Models Head-to-Head</SectionHeading>
            <SectionSub>Run the same prompt across up to 4 models simultaneously. See who responds fastest, most accurately, and most concisely — side by side.</SectionSub>
          </div>
        </div>
      </Section>

      {/* ── SECTION: Debate Arena ── */}
      <Section id="debate" alt>
        <div className="text-center mb-10">
          <Pill label="⚔ Debate Arena" color="rose" />
          <SectionHeading>Watch Two AIs Argue It Out</SectionHeading>
          <p className="text-muted-foreground max-w-xl mx-auto">Pick a topic, assign In Favor and Against models, set the number of rounds, and let a Judge model moderate the entire debate.</p>
        </div>
        <MockCard>
          <div className="grid md:grid-cols-[280px_1fr]">
            {/* Config panel */}
            <div className="border-r border-border p-5 space-y-4 bg-muted/20 dark:bg-white/[0.02]">
              <div className="space-y-1">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Topic</div>
                <div className="text-xs bg-background border border-border rounded-xl px-3 py-2 text-foreground">Should AI replace human creativity?</div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Opening Player</div>
                <div className="text-xs bg-background border border-border rounded-xl px-3 py-2 text-foreground flex justify-between"><span>In Favor</span><span className="text-muted-foreground">▾</span></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Rounds</div>
                  <div className="text-xs bg-background border border-border rounded-xl px-3 py-2 text-foreground">3</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Judging</div>
                  <div className="text-xs bg-background border border-border rounded-xl px-3 py-2 text-foreground flex justify-between"><span>Every Round</span><span className="text-muted-foreground">▾</span></div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider flex gap-1 items-center"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"/>In Favor</div>
                <div className="text-xs bg-background border border-border rounded-xl px-3 py-2 text-foreground flex justify-between"><span>gemini-2.5-flash</span><span className="text-muted-foreground">▾</span></div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-semibold text-rose-500 uppercase tracking-wider flex gap-1 items-center"><span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block"/>Against</div>
                <div className="text-xs bg-background border border-border rounded-xl px-3 py-2 text-foreground flex justify-between"><span>llama-3.3-70b</span><span className="text-muted-foreground">▾</span></div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider flex gap-1 items-center"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"/>Judge</div>
                <div className="text-xs bg-background border border-border rounded-xl px-3 py-2 text-foreground flex justify-between"><span>gpt-4o-mini</span><span className="text-muted-foreground">▾</span></div>
              </div>
              <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-semibold rounded-xl px-4 py-2.5 text-center cursor-default">Start Debate Arena</div>
            </div>
            {/* Transcript */}
            <div className="p-5 space-y-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Round 1 of 3</div>
              {debateMsgs.map((m, i) => (
                <div key={i} className={`rounded-xl border px-4 py-3 text-xs leading-relaxed ${
                  m.role === 'infavor' ? 'border-emerald-500/30 bg-emerald-500/5 text-foreground' :
                  m.role === 'against' ? 'border-rose-500/30 bg-rose-500/5 text-foreground' :
                  'border-amber-500/30 bg-amber-500/5 text-foreground'
                }`}>
                  <div className={`text-[10px] font-semibold mb-1 ${m.role === 'infavor' ? 'text-emerald-500' : m.role === 'against' ? 'text-rose-500' : 'text-amber-500'}`}>{m.label}</div>
                  {m.text}
                </div>
              ))}
            </div>
          </div>
        </MockCard>
      </Section>

      {/* ── SECTION: Smart Routing ── */}
      <Section id="routing">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <Pill label="Smart Routing" color="violet" />
            <SectionHeading>Zero Downtime. Automatic Fallbacks.</SectionHeading>
            <SectionSub>When one provider rate-limits, OmniKey silently routes to the next best option. Your app never sees an error — just seamless responses.</SectionSub>
          </div>
          <MockCard className="divide-y divide-border">
            <div className="px-4 py-3 bg-muted/40 dark:bg-white/5 text-xs font-semibold text-muted-foreground">Fallback Chain — Priority Order</div>
            {fallbackChain.map((p, i) => (
              <div key={i} className="px-4 py-3.5 flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                <span className={`w-2 h-2 rounded-full shrink-0 ${p.status === 'active' ? 'bg-emerald-500 animate-pulse' : p.status === 'limited' ? 'bg-red-500' : 'bg-slate-400'}`} />
                <span className="text-xs font-medium text-foreground flex-1">{p.name}</span>
                {p.note && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${p.status === 'limited' ? 'bg-red-500/10 text-red-500' : 'bg-slate-500/10 text-muted-foreground'}`}>{p.note}</span>}
                {p.latency !== '—' && <span className="text-[10px] text-emerald-500 font-semibold">{p.latency} avg</span>}
              </div>
            ))}
            <div className="px-4 py-3 text-[10px] text-muted-foreground bg-muted/20">
              → Request auto-routed to Cerebras after Groq 429
            </div>
          </MockCard>
        </div>
      </Section>

      {/* FOOTER */}
      <footer className="border-t border-border py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src={logoUrl} alt="OmniKey AI" className="h-5 w-5 object-contain opacity-70" />
            <span className="font-semibold text-foreground">OmniKey AI</span>
          </div>
          <span>Built for developers who want a billion free LLM tokens.</span>
          <a href="https://github.com/Felix-au/OmniKey-AI-Unified-Key-Manager" target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">
            GitHub →
          </a>
        </div>
      </footer>
    </div>
  )
}
