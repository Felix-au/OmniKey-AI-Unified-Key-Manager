import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import logoUrl from '../assets/logo.png'

// ── Aurora background CSS ────────────────────────────────────────────────────
const auroraCSS = `
@keyframes blob1 {
  0%,100%{transform:translate(0,0) scale(1)}
  33%{transform:translate(60px,-80px) scale(1.15)}
  66%{transform:translate(-40px,40px) scale(0.9)}
}
@keyframes blob2 {
  0%,100%{transform:translate(0,0) scale(1)}
  33%{transform:translate(-80px,60px) scale(0.85)}
  66%{transform:translate(50px,-30px) scale(1.1)}
}
@keyframes blob3 {
  0%,100%{transform:translate(0,0) scale(1)}
  50%{transform:translate(30px,70px) scale(1.2)}
}
@keyframes fadeSlideUp {
  from{opacity:0;transform:translateY(16px)}
  to{opacity:1;transform:translateY(0)}
}
@keyframes typingDot {
  0%,80%,100%{opacity:0.2;transform:scale(0.8)}
  40%{opacity:1;transform:scale(1)}
}
.animate-fade-up{animation:fadeSlideUp 0.5s ease both;}
.typing-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;animation:typingDot 1.2s infinite;}
.typing-dot:nth-child(2){animation-delay:0.2s;}
.typing-dot:nth-child(3){animation-delay:0.4s;}
@keyframes countUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes shimmer{0%{background-position:200% center}100%{background-position:-200% center}}
@keyframes dropIn{0%{opacity:0;transform:translateY(-6px) scale(0.97)}100%{opacity:1;transform:translateY(0) scale(1)}}
.stat-animate{animation:countUp 0.6s ease both;}
.provider-pill{transition:all 0.18s ease;cursor:default;}
.provider-pill:hover{transform:translateY(-2px) scale(1.05);box-shadow:0 4px 16px rgba(139,92,246,0.18);border-color:rgba(139,92,246,0.4);color:var(--foreground);}
.cta-btn{transition:all 0.15s ease;}
.cta-btn:hover{transform:translateY(-1px) scale(1.02);}
.cta-btn:active{transform:scale(0.97);}
.chain-row{transition:all 0.35s ease;}
.chain-row.drag-hint{transform:translateX(4px);background:rgba(139,92,246,0.06);}
.model-tag{transition:all 0.25s ease;}
.animate-drop-in{animation:dropIn 0.35s ease both;}
@keyframes statPop{0%{transform:scale(1)}50%{transform:scale(1.12)}100%{transform:scale(1)}}
.stat-num{display:inline-block;transition:color 0.2s;cursor:default;}
.stat-num:hover{animation:statPop 0.4s ease;color:rgb(139,92,246);}
`

// ── Ocean wave background ─────────────────────────────────────────────────────
function OceanBackground({ dark }: { dark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let animId: number
    let phase = 0
    let t = 0
    const mouse = { x: 0.5, y: 0.5 }
    const onMouse = (e: MouseEvent) => {
      mouse.x = e.clientX / window.innerWidth
      mouse.y = e.clientY / window.innerHeight
    }
    window.addEventListener('mousemove', onMouse)
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)
    // Wave layers: noiseA=random amp range, noiseF/noiseS=slow beat freqs
    const darkWaves = [
      { amp:80, freq:0.0045, speed:0.008, yBase:0.42, color:'rgba(15,23,71,0.9)',    noiseA:22, noiseF:0.00031, noiseS:0.00019 },
      { amp:65, freq:0.007,  speed:0.013, yBase:0.52, color:'rgba(23,37,110,0.75)',  noiseA:18, noiseF:0.00042, noiseS:0.00024 },
      { amp:55, freq:0.006,  speed:0.018, yBase:0.60, color:'rgba(30,58,138,0.65)',  noiseA:14, noiseF:0.00038, noiseS:0.00031 },
      { amp:45, freq:0.009,  speed:0.024, yBase:0.68, color:'rgba(37,99,235,0.40)',  noiseA:12, noiseF:0.00055, noiseS:0.00027 },
      { amp:35, freq:0.011,  speed:0.032, yBase:0.76, color:'rgba(99,102,241,0.30)', noiseA:10, noiseF:0.00061, noiseS:0.00035 },
    ]
    const lightWaves = [
      { amp:80, freq:0.0045, speed:0.008, yBase:0.42, color:'rgba(186,230,253,0.85)', noiseA:22, noiseF:0.00031, noiseS:0.00019 },
      { amp:65, freq:0.007,  speed:0.013, yBase:0.52, color:'rgba(125,211,252,0.70)', noiseA:18, noiseF:0.00042, noiseS:0.00024 },
      { amp:55, freq:0.006,  speed:0.018, yBase:0.60, color:'rgba(56,189,248,0.55)',  noiseA:14, noiseF:0.00038, noiseS:0.00031 },
      { amp:45, freq:0.009,  speed:0.024, yBase:0.68, color:'rgba(14,165,233,0.40)',  noiseA:12, noiseF:0.00055, noiseS:0.00027 },
      { amp:35, freq:0.011,  speed:0.032, yBase:0.76, color:'rgba(2,132,199,0.30)',   noiseA:10, noiseF:0.00061, noiseS:0.00035 },
    ]
    const waves = dark ? darkWaves : lightWaves
    // 45 particles with per-particle random params
    const particles = Array.from({ length: 36 }, () => ({
      x: Math.random(), y: 0.3 + Math.random() * 0.7,
      r: 1.2 + Math.random() * 2.8,
      speed: 0.00008 + Math.random() * 0.00014,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.008 + Math.random() * 0.012,
      alpha: 0.15 + Math.random() * 0.55,
      phase: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.02 + Math.random() * 0.04,
    }))
    const draw = () => {
      const W = canvas.width, H = canvas.height
      const grad = ctx.createLinearGradient(0, 0, 0, H)
      if (dark) {
        grad.addColorStop(0, '#020817'); grad.addColorStop(0.5, '#030d1e'); grad.addColorStop(1, '#0a1628')
      } else {
        grad.addColorStop(0, '#e0f4ff'); grad.addColorStop(0.5, '#bae8ff'); grad.addColorStop(1, '#7dd3fc')
      }
      ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)
      waves.forEach(({ amp, freq, speed, yBase, color, noiseA, noiseF, noiseS }, wi) => {
        const p = phase * speed + wi * 0.6
        // Two slow-beat sines = organic random amplitude per wave
        const ampNoise = noiseA * (Math.sin(t * noiseF + wi * 1.7) * 0.6 + Math.sin(t * noiseS * 1.3 + wi * 2.9) * 0.4)
        const eAmp = amp + ampNoise
        ctx.beginPath(); ctx.moveTo(0, H)
        for (let x = 0; x <= W + 2; x += 2) {
          const y = yBase * H
            + Math.sin(x * freq + p) * eAmp
            + Math.sin(x * freq * 1.7 + p * 1.3) * eAmp * 0.35
          ctx.lineTo(x, y)
        }
        ctx.lineTo(W, H); ctx.closePath()
        ctx.fillStyle = color; ctx.fill()
      })
      particles.forEach(pt => {
        pt.y -= pt.speed; pt.wobble += pt.wobbleSpeed; pt.phase += pt.twinkleSpeed
        if (pt.y < -0.05) { pt.y = 1.05; pt.x = Math.random() }
        // Subtle cursor pull
        pt.x += (mouse.x - pt.x) * 0.0006
        pt.y += (mouse.y - pt.y) * 0.0004
        const px = pt.x * W + Math.sin(pt.wobble) * 6
        const py = pt.y * H
        const a = pt.alpha * (0.5 + 0.5 * Math.sin(pt.phase))
        if (dark) {
          const g = ctx.createRadialGradient(px, py, 0, px, py, pt.r * 3.5)
          g.addColorStop(0, `rgba(200,240,255,${a})`); g.addColorStop(0.4, `rgba(147,210,255,${a*0.5})`); g.addColorStop(1, 'rgba(99,180,255,0)')
          ctx.beginPath(); ctx.arc(px, py, pt.r * 3.5, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill()
          ctx.beginPath(); ctx.arc(px, py, pt.r * 0.6, 0, Math.PI * 2); ctx.fillStyle = `rgba(230,248,255,${Math.min(a*1.4,0.9)})`; ctx.fill()
        } else {
          const g = ctx.createRadialGradient(px, py, 0, px, py, pt.r * 3.5)
          g.addColorStop(0, `rgba(15,30,80,${a*0.7})`); g.addColorStop(0.4, `rgba(30,58,138,${a*0.35})`); g.addColorStop(1, 'rgba(30,58,138,0)')
          ctx.beginPath(); ctx.arc(px, py, pt.r * 3.5, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill()
          ctx.beginPath(); ctx.arc(px, py, pt.r * 0.5, 0, Math.PI * 2); ctx.fillStyle = `rgba(10,20,60,${Math.min(a*1.2,0.6)})`; ctx.fill()
        }
      })
      phase += 0.6; t++
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); window.removeEventListener('mousemove', onMouse) }
  }, [dark])
  return <canvas ref={canvasRef} style={{ position:'fixed', inset:0, zIndex:-1, pointerEvents:'none', width:'100%', height:'100%' }} />
}

// ── Animated chat hook ───────────────────────────────────────────────────────
function useAnimatedChat() {
  const [visible, setVisible] = useState(0)
  const [typing, setTyping] = useState(false)
  useEffect(() => {
    const cycle = () => {
      setVisible(0); setTyping(false)
      const delays = [600, 1800, 3000, 4400]
      delays.forEach((d, i) => {
        setTimeout(() => { setTyping(true) }, d)
        setTimeout(() => { setTyping(false); setVisible(i + 1) }, d + 900)
      })
      setTimeout(cycle, 9000)
    }
    const t = setTimeout(cycle, 400)
    return () => clearTimeout(t)
  }, [])
  return { visible, typing }
}

// ── Animated debate hook ─────────────────────────────────────────────────────
function useAnimatedDebate() {
  const [visible, setVisible] = useState(0)
  useEffect(() => {
    const cycle = () => {
      setVisible(0)
        ;[1200, 3500, 6200].forEach((d, i) => setTimeout(() => setVisible(i + 1), d))
      setTimeout(cycle, 10000)
    }
    const t = setTimeout(cycle, 600)
    return () => clearTimeout(t)
  }, [])
  return visible
}

// ── Animated routing hook ────────────────────────────────────────────────────
function useAnimatedRouting() {
  const [phase, setPhase] = useState<'idle' | 'error' | 'rerouting' | 'done'>('idle')
  useEffect(() => {
    const cycle = () => {
      setPhase('idle')
      setTimeout(() => setPhase('error'), 1500)
      setTimeout(() => setPhase('rerouting'), 3000)
      setTimeout(() => setPhase('done'), 4500)
      setTimeout(cycle, 8000)
    }
    const t = setTimeout(cycle, 800)
    return () => clearTimeout(t)
  }, [])
  return phase
}

// ── Arena animated latency ───────────────────────────────────────────────────
function useArenaVisible() {
  const [visible, setVisible] = useState(0)
  useEffect(() => {
    const cycle = () => {
      setVisible(0)
        ;[300, 700, 1200, 1800].forEach((d, i) => setTimeout(() => setVisible(i + 1), d))
      setTimeout(cycle, 6000)
    }
    const t = setTimeout(cycle, 200)
    return () => clearTimeout(t)
  }, [])
  return visible
}

// ── Arena model selection cycling ────────────────────────────────────────────
const modelOptions = ['gemini-2.5-flash', 'llama-3.3-70b', 'mistral-large', 'qwen-2.5-72b', 'gpt-4o-mini', 'deepseek-r1', 'claude-3-5-sonnet', 'nvidia/llama-3.1-nemotron-70b']
function useArenaSelection() {
  const [models, setModels] = useState(['gemini-2.5-flash', 'llama-3.3-70b', 'mistral-large', 'qwen-2.5-72b'])
  const [selecting, setSelecting] = useState<number | null>(null)
  useEffect(() => {
    const cycle = () => {
      const slot = Math.floor(Math.random() * 4)
      setSelecting(slot)
      setTimeout(() => {
        setModels(prev => { const n = [...prev]; n[slot] = modelOptions[Math.floor(Math.random() * modelOptions.length)]; return n })
        setSelecting(null)
      }, 900)
      setTimeout(cycle, 4500 + Math.random() * 2000)
    }
    const t = setTimeout(cycle, 2500)
    return () => clearTimeout(t)
  }, [])
  return { models, selecting }
}

// ── Fallback order animation ──────────────────────────────────────────────────
const allProviders = ['Google Gemini', 'Groq', 'Cerebras', 'SambaNova', 'Mistral', 'OpenRouter']
function useFallbackOrder() {
  const [order, setOrder] = useState([0, 1, 2, 3])
  const [dragging, setDragging] = useState<number | null>(null)
  useEffect(() => {
    const cycle = () => {
      const slot = Math.floor(Math.random() * 3) + 1
      setDragging(slot)
      setTimeout(() => {
        setOrder(prev => { const n = [...prev]; const tmp = n[slot]; n[slot] = n[slot - 1]; n[slot - 1] = tmp; return n })
        setDragging(null)
      }, 800)
      setTimeout(cycle, 4000)
    }
    const t = setTimeout(cycle, 3000)
    return () => clearTimeout(t)
  }, [])
  return { order, dragging }
}

// ── Debate config cursor animation ───────────────────────────────────────────────
const debateConfigFields = ['opening', 'rounds', 'judging', 'infavor', 'against', 'judge'] as const
type DebateField = typeof debateConfigFields[number]
const judgeModels = ['gpt-4o-mini', 'gemini-2.0-flash', 'llama-3.3-70b', 'mistral-large']
const favorModels = ['gemini-2.5-flash', 'claude-3-5-sonnet', 'qwen-2.5-72b', 'deepseek-r1']
const againstModels = ['llama-3.3-70b', 'mistral-large', 'gpt-4o-mini', 'nvidia/nemotron-70b']
function useDebateConfig() {
  const [activeField, setActiveField] = useState<DebateField | null>(null)
  const [rounds, setRounds] = useState(3)
  const [judging, setJudging] = useState('Every Round')
  const [infavor, setInfavor] = useState('gemini-2.5-flash')
  const [against, setAgainst] = useState('llama-3.3-70b')
  const [judge, setJudge] = useState('gpt-4o-mini')
  useEffect(() => {
    const seq: [DebateField, number, () => void][] = [
      ['rounds', 800, () => setRounds(r => r < 6 ? r + 1 : 2)],
      ['judging', 1600, () => setJudging(j => j === 'Every Round' ? 'At the End' : 'Every Round')],
      ['infavor', 2600, () => setInfavor(favorModels[Math.floor(Math.random() * favorModels.length)])],
      ['against', 3700, () => setAgainst(againstModels[Math.floor(Math.random() * againstModels.length)])],
      ['judge', 4800, () => setJudge(judgeModels[Math.floor(Math.random() * judgeModels.length)])],
    ]
    const cycle = () => {
      setActiveField(null)
      const tos: ReturnType<typeof setTimeout>[] = []
      seq.forEach(([field, delay, action]) => {
        tos.push(setTimeout(() => { setActiveField(field); action() }, delay))
        tos.push(setTimeout(() => setActiveField(null), delay + 600))
      })
      tos.push(setTimeout(cycle, 7000))
    }
    const t = setTimeout(cycle, 1000)
    return () => clearTimeout(t)
  }, [])
  return { activeField, rounds, judging, infavor, against, judge }
}

// ── Count-up hook ─────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1200) {
  const [val, setVal] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      obs.disconnect()
      const start = performance.now()
      const tick = (now: number) => {
        const p = Math.min((now - start) / duration, 1)
        setVal(Math.round(p * target))
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, { threshold: 0.5 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [target, duration])
  return { val, ref }
}

// \u2500\u2500 GitHub icon \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
const GitHubIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
)


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

// ── Sun/Moon SVG icons ────────────────────────────────────────────────────────
const SunIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2m-7.07-14.07 1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2m-4.93-7.07-1.41 1.41M6.34 17.66l-1.41 1.41" /></svg>)
const MoonIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>)

// ── Landing Page ──────────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate()
  const { dark, toggle } = useDark()
  const chat = useAnimatedChat()
  const debateVisible = useAnimatedDebate()
  const routingPhase = useAnimatedRouting()
  const arenaVisible = useArenaVisible()
  const arenaSelection = useArenaSelection()
  const fallbackOrder = useFallbackOrder()
  const debateCfg = useDebateConfig()
  const heroRef = useRef<HTMLElement>(null)
  const stat1 = useCountUp(100)
  const stat2 = useCountUp(1000)
  const stat3 = useCountUp(12)

  return (
    <div className="min-h-screen text-foreground relative">
      <style>{auroraCSS}</style>
      <OceanBackground dark={dark} />

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
            <button onClick={toggle} title="Toggle theme" className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors">
              {dark ? <SunIcon /> : <MoonIcon />}
            </button>
            <button
              onClick={() => navigate('/playground')}
              className="cta-btn bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-md shadow-violet-500/20"
            >
              Get Started →
            </button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section ref={heroRef} className="relative py-28 px-6 text-center">
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
            className="cta-btn bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold px-8 py-3.5 rounded-2xl text-base shadow-lg shadow-violet-500/20"
          >
            Get Started Free →
          </button>
          <a
            href="https://github.com/Felix-au/OmniKey-AI-Unified-Key-Manager"
            target="_blank" rel="noreferrer"
            className="cta-btn border border-border bg-card hover:bg-accent/60 text-foreground font-semibold px-8 py-3.5 rounded-2xl text-base flex items-center gap-2"
          >
            <GitHubIcon size={18} />
            View on GitHub
          </a>
        </div>
        {/* Provider pills */}
        <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
          {providers.map(p => (
            <span key={p} className="provider-pill flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border bg-card/60 text-muted-foreground">
              <span className={`w-2 h-2 rounded-full ${providerColors[p]}`} />
              {p}
            </span>
          ))}
        </div>
      </section>

      {/* STATS */}
      <div className="max-w-4xl mx-auto px-6 mb-8">
        <div className="grid grid-cols-3 divide-x divide-border rounded-2xl border border-border bg-card/60 backdrop-blur">
          {[{ ref: stat1.ref, val: `${stat1.val}+`, label: 'Models Available' },
          { ref: stat2.ref, val: stat2.val >= 1000 ? '1B+' : `${stat2.val}M+`, label: 'Free Tokens / Month' },
          { ref: stat3.ref, val: `${stat3.val}`, label: 'Free Providers' }].map(({ ref, val, label }) => (
            <div key={label} ref={ref} className="py-6 text-center stat-animate">
              <div className="text-3xl font-extrabold text-foreground stat-num">{val}</div>
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
              {mockChat.map((m, i) => i < chat.visible && (
                <div key={i} className={`flex animate-fade-up ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${m.role === 'user' ? 'bg-violet-600 text-white' : 'bg-muted/60 dark:bg-white/8 text-foreground border border-border'}`}>
                    {m.text}
                    {m.meta && <div className="mt-1 text-[10px] opacity-60">{m.meta}</div>}
                  </div>
                </div>
              ))}
              {chat.typing && (
                <div className="flex justify-start animate-fade-up">
                  <div className="bg-muted/60 border border-border rounded-xl px-3 py-2 flex gap-1 items-center text-muted-foreground">
                    <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                  </div>
                </div>
              )}
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
            {/* Model selectors row */}
            <div className="grid grid-cols-4 divide-x divide-border border-b border-border">
              {arenaSelection.models.map((m, i) => {
                const colors = ['text-blue-400', 'text-orange-400', 'text-purple-400', 'text-emerald-400']
                const isSelecting = arenaSelection.selecting === i
                return (
                  <div key={i} className={`px-2 py-2 text-[10px] font-semibold flex items-center gap-1 ${colors[i]} ${isSelecting ? 'bg-violet-500/10' : ''} transition-colors duration-300`}>
                    {isSelecting ? (
                      <><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></>
                    ) : (
                      <span className="model-tag truncate animate-drop-in">{m}</span>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="grid grid-cols-2 gap-0 divide-x divide-y divide-border">
              {arenaPanels.map((p, i) => (
                <div key={i} className={`p-3 transition-all duration-500 ${i < arenaVisible ? 'opacity-100' : 'opacity-0 translate-y-2'}`}>
                  <div className={`text-[10px] font-semibold mb-2 ${p.color} flex items-center justify-between`}>
                    <span>{arenaSelection.models[i] ?? p.model}</span>
                    <span className="text-muted-foreground font-normal">{i < arenaVisible ? p.latency : '...'}</span>
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
            <div className="border-r border-border p-5 space-y-4 bg-muted/20 dark:bg-white/[0.02] relative">
              {/* Animated cursor ball */}
              <div className={`absolute top-2 right-2 w-3 h-3 rounded-full border-2 border-border shadow transition-all duration-500 ${debateCfg.activeField ? 'bg-foreground scale-110 opacity-100' : 'bg-muted opacity-40 scale-75'
                }`} />
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
                  <div className={`text-xs bg-background border rounded-xl px-3 py-2 text-foreground transition-all duration-300 ${debateCfg.activeField === 'rounds' ? 'border-violet-500 ring-1 ring-violet-500/30' : 'border-border'
                    }`}>{debateCfg.rounds}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Judging</div>
                  <div className={`text-xs bg-background border rounded-xl px-3 py-2 text-foreground flex justify-between transition-all duration-300 ${debateCfg.activeField === 'judging' ? 'border-violet-500 ring-1 ring-violet-500/30' : 'border-border'
                    }`}><span>{debateCfg.judging}</span><span className="text-muted-foreground">▾</span></div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider flex gap-1 items-center"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />In Favor</div>
                <div className={`text-xs bg-background border rounded-xl px-3 py-2 text-foreground flex justify-between transition-all duration-300 ${debateCfg.activeField === 'infavor' ? 'border-violet-500 ring-1 ring-violet-500/30' : 'border-border'
                  }`}><span className="truncate">{debateCfg.infavor}</span><span className="text-muted-foreground ml-1">▾</span></div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-semibold text-rose-500 uppercase tracking-wider flex gap-1 items-center"><span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />Against</div>
                <div className={`text-xs bg-background border rounded-xl px-3 py-2 text-foreground flex justify-between transition-all duration-300 ${debateCfg.activeField === 'against' ? 'border-violet-500 ring-1 ring-violet-500/30' : 'border-border'
                  }`}><span className="truncate">{debateCfg.against}</span><span className="text-muted-foreground ml-1">▾</span></div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider flex gap-1 items-center"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />Judge</div>
                <div className={`text-xs bg-background border rounded-xl px-3 py-2 text-foreground flex justify-between transition-all duration-300 ${debateCfg.activeField === 'judge' ? 'border-violet-500 ring-1 ring-violet-500/30' : 'border-border'
                  }`}><span className="truncate">{debateCfg.judge}</span><span className="text-muted-foreground ml-1">▾</span></div>
              </div>
              <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-semibold rounded-xl px-4 py-2.5 text-center cursor-default">Start Debate Arena</div>
            </div>
            {/* Transcript */}
            <div className="p-5 space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Round 1 of 3</div>
              {debateMsgs.map((m, i) => i < debateVisible ? (
                <div key={i} className={`rounded-xl border px-4 py-3 text-xs leading-relaxed animate-fade-up ${m.role === 'infavor' ? 'border-emerald-500/30 bg-emerald-500/5' :
                    m.role === 'against' ? 'border-rose-500/30 bg-rose-500/5' :
                      'border-amber-500/30 bg-amber-500/5'
                  }`}>
                  <div className={`text-[10px] font-semibold mb-1 ${m.role === 'infavor' ? 'text-emerald-500' : m.role === 'against' ? 'text-rose-500' : 'text-amber-500'}`}>{m.label}</div>
                  {m.text}
                </div>
              ) : i === debateVisible ? (
                <div key={i} className="flex gap-1 px-4 py-3 text-muted-foreground animate-fade-up">
                  <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                </div>
              ) : null)}
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
            {fallbackChain.map((p, i) => {
              const isGroq = p.name === 'Groq'
              const isCerebras = p.name === 'Cerebras'
              const showError = isGroq && (routingPhase === 'error' || routingPhase === 'rerouting' || routingPhase === 'done')
              const isRerouted = isCerebras && (routingPhase === 'rerouting' || routingPhase === 'done')
              const isDragging = fallbackOrder.dragging === i
              return (
                <div key={i} className={`chain-row px-4 py-3.5 flex items-center gap-3 transition-colors duration-700 ${isDragging ? 'drag-hint' : ''} ${isRerouted ? 'bg-emerald-500/5' : ''}`}>
                  <span className="text-muted-foreground select-none text-sm">⠿</span>
                  <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                  <span className={`w-2 h-2 rounded-full shrink-0 transition-colors duration-500 ${isRerouted ? 'bg-emerald-500 animate-pulse' :
                      showError ? 'bg-red-500' :
                        p.status === 'active' ? 'bg-emerald-500 animate-pulse' :
                          'bg-slate-400'
                    }`} />
                  <span className="text-xs font-medium text-foreground flex-1">{p.name}</span>
                  {isDragging && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-500 animate-fade-up">Moving ↑</span>}
                  {showError && !isDragging && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 animate-fade-up">429</span>}
                  {isRerouted && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 animate-fade-up">↑ Active</span>}
                  {p.status === 'active' && !showError && !isDragging && <span className="text-[10px] text-emerald-500 font-semibold">{p.latency} avg</span>}
                </div>
              )
            })}
            <div className={`px-4 py-3 text-[10px] transition-all duration-700 ${routingPhase === 'rerouting' || routingPhase === 'done'
                ? 'text-emerald-500 bg-emerald-500/5'
                : 'text-muted-foreground bg-muted/20'
              }`}>
              {routingPhase === 'idle' ? '● Monitoring provider health...' :
                routingPhase === 'error' ? '⚠ Groq returned 429 — initiating failover...' :
                  '✓ Request auto-routed to Cerebras after Groq 429'}
            </div>
          </MockCard>
        </div>
      </Section>

      {/* ── SECTION: Fallback Config ── */}
      <Section alt>
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <MockCard className="divide-y divide-border">
            <div className="px-4 py-3 bg-muted/40 dark:bg-white/5 text-xs font-semibold text-muted-foreground flex items-center justify-between">
              <span>Configure Priority Order</span>
              <span className="text-[10px] text-violet-500 font-semibold">Drag to reorder</span>
            </div>
            {fallbackOrder.order.map((provIdx, rowIdx) => {
              const isDragging = fallbackOrder.dragging === rowIdx
              return (
                <div key={provIdx} className={`chain-row px-4 py-3.5 flex items-center gap-3 ${isDragging ? 'drag-hint' : ''}`}>
                  <span className="text-muted-foreground cursor-grab text-sm select-none">⠿</span>
                  <span className="text-xs text-muted-foreground w-4">{rowIdx + 1}</span>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${rowIdx === 0 ? 'bg-emerald-500' : 'bg-slate-400'
                    }`} />
                  <span className="text-xs font-medium text-foreground flex-1 animate-drop-in">{allProviders[provIdx]}</span>
                  {rowIdx === 0 && <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full font-semibold">Primary</span>}
                  {isDragging && <span className="text-[10px] bg-violet-500/10 text-violet-500 px-2 py-0.5 rounded-full font-semibold animate-fade-up">Moving ↑</span>}
                </div>
              )
            })}
            <div className="px-4 py-3 bg-muted/10 flex gap-2 items-center">
              <div className="cta-btn text-[10px] font-semibold px-3 py-1.5 rounded-xl bg-violet-600 text-white cursor-default">Save Order</div>
              <span className="text-[10px] text-muted-foreground">Changes apply instantly to all routing</span>
            </div>
          </MockCard>
          <div>
            <Pill label="Fallback Config" color="amber" />
            <SectionHeading>You Control the Priority.</SectionHeading>
            <SectionSub>Drag providers into your preferred order. OmniKey tries them top-to-bottom on every request, automatically skipping any that are rate-limited or unavailable.</SectionSub>
          </div>
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
          <a href="https://github.com/Felix-au/OmniKey-AI-Unified-Key-Manager" target="_blank" rel="noreferrer" className="cta-btn hover:text-foreground transition-colors flex items-center gap-1.5">
            <GitHubIcon size={15} />
            GitHub
          </a>
        </div>
      </footer>
    </div>
  )
}
