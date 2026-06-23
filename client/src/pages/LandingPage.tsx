import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'

import logoDark from '../assets/logo-dark-theme.webp'
import logoLight from '../assets/logo-light-theme.webp'

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
@keyframes indicatorPulse {
  0% { transform: scale(0.8); opacity: 0.1; }
  50% { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(0.8); opacity: 0.1; }
}
.animate-indicator-pulse {
  animation: indicatorPulse 1.4s infinite ease-in-out;
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* ── 3D Token Cascade Styles ── */
@keyframes descendTile {
  0% { top: -40px; opacity: 0; transform: rotateX(25deg) rotateY(-15deg) translateZ(-40px) scale(0.85); }
  15% { opacity: 0.85; }
  75% { opacity: 0.95; }
  80% { 
    opacity: 1; 
    border-color: #ffffff; 
    box-shadow: 0 0 12px rgba(255, 255, 255, 0.4); 
    transform: rotateX(25deg) rotateY(-15deg) translateZ(0) scale(1.05); 
  }
  90% { opacity: 0.3; }
  100% { top: 260px; opacity: 0; transform: rotateX(25deg) rotateY(-15deg) translateZ(40px) scale(0.85); }
}

.cascade-3d {
  width: 200px;
  height: 280px;
  position: relative;
  transform-style: preserve-3d;
  overflow: hidden;
}

.cascade-tile {
  position: absolute;
  width: 110px;
  height: 32px;
  left: 45px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: monospace;
  font-size: 0.78rem;
  font-weight: 700;
  color: oklch(0.20 0.005 240); /* Light mode text color (dark charcoal) */
  transform: rotateX(25deg) rotateY(-15deg);
  animation: descendTile var(--cascade-speed) linear infinite;
  opacity: 0;
}

.dark .cascade-tile {
  color: #ffffff; /* Dark mode text color (white) */
}

/* Light mode styles */
.tile-type-system {
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.4);
}
.tile-type-vector {
  background: rgba(6, 182, 212, 0.08);
  border: 1px solid rgba(6, 182, 212, 0.4);
}
.tile-type-attention {
  background: rgba(236, 72, 153, 0.08);
  border: 1px solid rgba(236, 72, 153, 0.4);
}
.tile-type-proxy {
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.4);
}
.tile-type-model {
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.4);
}

/* Dark mode styles */
.dark .tile-type-system {
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.5);
  text-shadow: 0 0 4px #6366f1;
}
.dark .tile-type-vector {
  background: rgba(6, 182, 212, 0.15);
  border: 1px solid rgba(6, 182, 212, 0.5);
  text-shadow: 0 0 4px #06b6d4;
}
.dark .tile-type-attention {
  background: rgba(236, 72, 153, 0.15);
  border: 1px solid rgba(236, 72, 153, 0.5);
  text-shadow: 0 0 4px #ec4899;
}
.dark .tile-type-proxy {
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.5);
  text-shadow: 0 0 4px #10b981;
}
.dark .tile-type-model {
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(245, 158, 11, 0.5);
  text-shadow: 0 0 4px #f59e0b;
}

.tile-text {
  position: relative;
  z-index: 2;
}

.tile-glow {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  border-radius: inherit;
  box-shadow: 0 0 10px rgba(255,255,255,0.05);
  z-index: 1;
}

.target-compiler-line {
  position: absolute;
  bottom: 40px;
  left: 10px;
  right: 10px;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, rgba(6, 182, 212, 0.6) 50%, transparent 100%);
  box-shadow: 0 0 8px rgba(6, 182, 212, 0.8);
  pointer-events: none;
}

/* ── 3D MLP Pipeline Styles ── */
@keyframes gentleSwingMLP {
  0%, 100% { transform: rotateY(-18deg) rotateX(8deg); }
  50% { transform: rotateY(-12deg) rotateX(3deg); }
}

.mlp-detailed-3d {
  width: 320px;
  height: 280px;
  position: relative;
  transform-style: preserve-3d;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: gentleSwingMLP 10s ease-in-out infinite;
}

.mlp-detailed-layer {
  position: absolute;
  width: 65px;
  height: 240px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(3px);
  transform-style: preserve-3d;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  box-sizing: border-box;
  box-shadow: 0 4px 15px rgba(0,0,0,0.06);
}

.dark .mlp-detailed-layer {
  background: rgba(13, 17, 23, 0.75);
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow: 0 4px 15px rgba(0,0,0,0.5);
}

.neuron-flex-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  align-items: center;
  width: 100%;
  transform-style: preserve-3d;
}

.neuron-node-detailed {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ffffff;
  border: 1.5px solid currentColor;
  position: relative;
  transform-style: preserve-3d;
}

@keyframes pulseNodeRing {
  0% { transform: scale(0.8) translateZ(0); opacity: 0.8; }
  100% { transform: scale(2.4) translateZ(10px); opacity: 0; }
}

.pulse-ring {
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  border: 1px solid currentColor;
  animation: pulseNodeRing 1.8s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
}

.synapse-bundle {
  position: absolute;
  width: 90px;
  height: 1px;
  left: 8px;
  top: 3.5px;
  transform-style: preserve-3d;
}

.synapse-track {
  position: absolute;
  width: 100%;
  height: 1px;
  background: currentColor;
  transform-origin: left center;
  opacity: 0.22;
}

.dark .synapse-track {
  opacity: 0.12;
}

@keyframes signalTravelDetailed {
  0% { left: 0%; opacity: 0; transform: scale(0.6); }
  15%, 85% { opacity: 1; transform: scale(1.5); }
  100% { left: 100%; opacity: 0; transform: scale(0.6); }
}

.activation-pulse {
  position: absolute;
  width: 4.8px;
  height: 4.8px;
  border-radius: 50%;
  top: -1.9px;
  background: #00f3ff;
  box-shadow: 0 0 8px #00f3ff, 0 0 3px #00f3ff;
  animation: signalTravelDetailed 1.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

@keyframes backpropTravel {
  0% { left: 100%; opacity: 0; transform: scale(0.6); }
  15%, 85% { opacity: 1; transform: scale(1.5); }
  100% { left: 0%; opacity: 0; transform: scale(0.6); }
}

.backprop-pulse {
  position: absolute;
  width: 4.8px;
  height: 4.8px;
  border-radius: 50%;
  top: -1.9px;
  background: #ff2a5f;
  box-shadow: 0 0 8px #ff2a5f, 0 0 3px #ff2a5f;
  animation: backpropTravel 1.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}
@keyframes popInInvite {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); box-shadow: 0 0 16px rgba(139,92,246,0.6); }
}
.animate-pop-invite {
  animation: popInInvite 1.2s infinite ease-in-out;
}
`


// ── Interactive Neural Mesh Background ──────────────────────────────────────────
function NeuralMeshBackground({ dark }: { dark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    const particles: Array<{
      x: number
      y: number
      vx: number
      vy: number
    }> = []

    const count = window.innerWidth < 768 ? 22 : 45
    const mouse = { x: -9999, y: -9999, inside: false }

    const onMouse = (e: MouseEvent) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
      mouse.inside = true
    }
    const onLeave = () => {
      mouse.inside = false
      mouse.x = -9999
      mouse.y = -9999
    }

    window.addEventListener('mousemove', onMouse)
    document.addEventListener('mouseleave', onLeave)

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Initialize particles with random positions and velocities
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
      })
    }

    let lastTime = 0
    const fpsInterval = 1000 / 30

    const draw = (timestamp?: number) => {
      const now = timestamp || performance.now()
      const elapsed = now - lastTime

      if (elapsed >= fpsInterval) {
        lastTime = now - (elapsed % fpsInterval)

        const W = canvas.width
        const H = canvas.height
        ctx.clearRect(0, 0, W, H)

      // Background color/gradient
      if (dark) {
        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, W, H)
      } else {
        const grad = ctx.createLinearGradient(0, 0, 0, H)
        grad.addColorStop(0, '#ffffff')
        grad.addColorStop(0.5, '#fafafb')
        grad.addColorStop(1, '#f3f4f6')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, W, H)
      }

      // Update particles
      particles.forEach((n) => {
        // Natural Drift (Brownian drift)
        n.vx += (Math.random() - 0.5) * 0.008
        n.vy += (Math.random() - 0.5) * 0.008

        // Repulsion from 3D MLP construct (Top-Left)
        const isDesktop = window.innerWidth >= 768
        if (isDesktop) {
          const cX = 134
          const cY = 236 // Statically 102px top + 134px half height
          const dx = n.x - cX
          const dy = n.y - cY
          const dist = Math.sqrt(dx * dx + dy * dy)
          const radius = 180
          if (dist < radius && dist > 0) {
            const force = (1 - dist / radius) * 0.5
            n.vx += (dx / dist) * force
            n.vy += (dy / dist) * force
          }
        }

        // Clamp Speed between 0.3 and 1.4
        const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy)
        if (speed < 0.3) {
          const angle = speed > 0 ? Math.atan2(n.vy, n.vx) : Math.random() * Math.PI * 2
          n.vx = Math.cos(angle) * 0.3
          n.vy = Math.sin(angle) * 0.3
        } else if (speed > 1.4) {
          n.vx = (n.vx / speed) * 1.4
          n.vy = (n.vy / speed) * 1.4
        }

        // Update Position
        n.x += n.vx
        n.y += n.vy

        // Screen Boundary Wrapping
        if (n.x < 0) n.x += W
        if (n.x > W) n.x -= W
        if (n.y < 0) n.y += H
        if (n.y > H) n.y -= H
      })

      // Draw connections between nearby particles (dynamic paths)
      ctx.save()
      ctx.shadowBlur = dark ? 18 : 8
      ctx.shadowColor = '#06b6d4'
      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          const p1 = particles[i]
          const p2 = particles[j]
          const dx = p1.x - p2.x
          const dy = p1.y - p2.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < 160) {
            const opacity = (1 - dist / 160) * (dark ? 0.65 : 0.4)
            ctx.strokeStyle = `rgba(6, 182, 212, ${opacity})`
            ctx.lineWidth = dark ? 1.2 : 0.7
            ctx.beginPath()
            ctx.moveTo(p1.x, p1.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.stroke()
          }
        }
      }
      ctx.restore()

      // Draw connections to mouse cursor when hovering
      if (mouse.inside) {
        ctx.save()
        ctx.shadowBlur = dark ? 28 : 16
        ctx.shadowColor = '#06b6d4'
        particles.forEach((n) => {
          const dx = n.x - mouse.x
          const dy = n.y - mouse.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < 140) {
            const opacity = (1 - dist / 160) * (dark ? 1.0 : 0.85)
            ctx.strokeStyle = `rgba(6, 182, 212, ${opacity})`
            ctx.lineWidth = dark ? 2.2 : 1.6
            ctx.beginPath()
            ctx.moveTo(n.x, n.y)
            ctx.lineTo(mouse.x, mouse.y)
            ctx.stroke()
          }
        })
        ctx.restore()
      }

        // Draw particle nodes with a heavy cyan glow
        ctx.save()
        ctx.shadowBlur = 22
        ctx.shadowColor = '#06b6d4'
        ctx.fillStyle = 'rgba(6, 182, 212, 0.95)'
        particles.forEach((n) => {
          ctx.beginPath()
          ctx.arc(n.x, n.y, 3, 0, Math.PI * 2)
          ctx.fill()
        })
        ctx.restore()
      }

      animId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouse)
      document.removeEventListener('mouseleave', onLeave)
    }
  }, [dark])

  return (
    <canvas
      ref={canvasRef}
      className="neural-mesh-canvas"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        pointerEvents: 'none',
        width: '100%',
        height: '100%',
      }}
    />
  )
}

// ── Animated chat hook ───────────────────────────────────────────────────────
function useAnimatedChat() {
  const [visible, setVisible] = useState(0)
  const [typing, setTyping] = useState(false)
  const [inputText, setInputText] = useState('')
  const [showSendPrompt, setShowSendPrompt] = useState(false)
  const [isFadingOut, setIsFadingOut] = useState(false)
  const [userIndex, setUserIndex] = useState(0)
  const [isTypingUser, setIsTypingUser] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const stateRef = useRef({
    visible,
    userIndex,
    isTypingUser,
    active: false,
    currentTimeout: null as ReturnType<typeof setTimeout> | null,
    currentInterval: null as ReturnType<typeof setInterval> | null
  })

  useEffect(() => {
    stateRef.current.visible = visible
    stateRef.current.userIndex = userIndex
    stateRef.current.isTypingUser = isTypingUser
  }, [visible, userIndex, isTypingUser])

  const runTimeout = (fn: () => void, delay: number) => {
    if (!stateRef.current.active) return
    if (stateRef.current.currentTimeout) clearTimeout(stateRef.current.currentTimeout)
    stateRef.current.currentTimeout = setTimeout(fn, delay)
  }

  const typeText = (text: string, onComplete: () => void) => {
    let index = 0
    setInputText('')
    setIsTypingUser(true)
    if (stateRef.current.currentInterval) clearInterval(stateRef.current.currentInterval)
    stateRef.current.currentInterval = setInterval(() => {
      if (!stateRef.current.active) {
        clearInterval(stateRef.current.currentInterval!)
        return
      }
      index++
      if (index <= text.length) {
        setInputText(text.slice(0, index))
      } else {
        clearInterval(stateRef.current.currentInterval!)
        setIsTypingUser(false)
        onComplete()
      }
    }, 45)
  }

  const startNextUserMessage = (idx: number) => {
    runTimeout(() => {
      typeText(mockChat[idx].text, () => {
        setShowSendPrompt(true)
      })
    }, 800)
  }

  const handleSendClick = () => {
    if (!showSendPrompt) return
    setShowSendPrompt(false)
    const idx = userIndex
    
    setVisible(idx + 1)
    setInputText('')

    runTimeout(() => {
      setTyping(true)
      runTimeout(() => {
        setTyping(false)
        setVisible(idx + 2)

        if (idx + 2 < mockChat.length) {
          const nextIdx = idx + 2
          setUserIndex(nextIdx)
          startNextUserMessage(nextIdx)
        }
      }, 2000)
    }, 800)
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        if (!stateRef.current.active) {
          stateRef.current.active = true
          setIsFadingOut(false)
          setVisible(0)
          setInputText('')
          setTyping(false)
          setShowSendPrompt(false)
          setUserIndex(0)
          setIsTypingUser(false)
          startNextUserMessage(0)
        }
      } else {
        stateRef.current.active = false
        if (stateRef.current.currentTimeout) clearTimeout(stateRef.current.currentTimeout)
        if (stateRef.current.currentInterval) clearInterval(stateRef.current.currentInterval)
        setVisible(0)
        setInputText('')
        setTyping(false)
        setShowSendPrompt(false)
        setUserIndex(0)
        setIsTypingUser(false)
        setIsFadingOut(false)
      }
    }, { threshold: 0.15 })

    observer.observe(el)

    return () => {
      stateRef.current.active = false
      observer.disconnect()
      if (stateRef.current.currentTimeout) clearTimeout(stateRef.current.currentTimeout)
      if (stateRef.current.currentInterval) clearInterval(stateRef.current.currentInterval)
    }
  }, [])

  return {
    visible,
    typing,
    inputText,
    isFadingOut,
    showSendPrompt,
    handleSendClick,
    containerRef
  }
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

// ── Arena choreographed animation hook ──────────────────────────────────────────

function useArenaAnimation() {
  const [prompt, setPrompt] = useState('')
  const [promptActive, setPromptActive] = useState(false)
  const [models, setModels] = useState<string[]>(['', '', '', ''])
  const [sendReady, setSendReady] = useState(false)
  const [sendClicked, setSendClicked] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [visiblePanels, setVisiblePanels] = useState(0)
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null)
  const [isFadingOut, setIsFadingOut] = useState(false)

  const containerRef = useRef<HTMLDivElement | null>(null)

  const stateRef = useRef({
    active: false,
    currentTimeout: null as ReturnType<typeof setTimeout> | null,
    currentInterval: null as ReturnType<typeof setInterval> | null
  })

  const runTimeout = (fn: () => void, delay: number) => {
    if (!stateRef.current.active) return
    if (stateRef.current.currentTimeout) clearTimeout(stateRef.current.currentTimeout)
    stateRef.current.currentTimeout = setTimeout(fn, delay)
  }

  const typePrompt = (text: string, onComplete: () => void) => {
    let index = 0
    setPrompt('')
    setPromptActive(true)
    if (stateRef.current.currentInterval) clearInterval(stateRef.current.currentInterval)
    stateRef.current.currentInterval = setInterval(() => {
      if (!stateRef.current.active) {
        clearInterval(stateRef.current.currentInterval!)
        return
      }
      index++
      if (index <= text.length) {
        setPrompt(text.slice(0, index))
      } else {
        clearInterval(stateRef.current.currentInterval!)
        setPromptActive(false)
        onComplete()
      }
    }, 40)
  }

  const toggleDropdown = (idx: number) => {
    setActiveDropdown(activeDropdown === idx ? null : idx)
  }

  const selectModel = (idx: number, model: string) => {
    const updated = [...models]
    updated[idx] = model
    setModels(updated)
    setActiveDropdown(null)
    if (updated.every(m => m !== '')) {
      setSendReady(true)
    }
  }

  const fillRandomModels = () => {
    const defaultModels = ['gemini-2.5-flash', 'llama-3.3-70b', 'mistral-large', 'qwen-2.5-72b']
    setModels(defaultModels)
    setSendReady(true)
    setActiveDropdown(null)
  }

  const handleSendClick = () => {
    if (!sendReady || sendClicked) return
    setSendClicked(true)
    setIsLoading(true)
    
    runTimeout(() => {
      setIsLoading(false)
      setVisiblePanels(1)
      runTimeout(() => {
        setVisiblePanels(2)
        runTimeout(() => {
          setVisiblePanels(3)
          runTimeout(() => {
            setVisiblePanels(4)
          }, 800)
        }, 700)
      }, 600)
    }, 1200)
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        if (!stateRef.current.active) {
          stateRef.current.active = true
          setIsFadingOut(false)
          setPrompt('')
          setPromptActive(false)
          setModels(['', '', '', ''])
          setSendReady(false)
          setSendClicked(false)
          setIsLoading(false)
          setVisiblePanels(0)
          setActiveDropdown(null)
          
          runTimeout(() => {
            typePrompt("Explain quantum entanglement simply.", () => {
              // Await user choices
            })
          }, 1000)
        }
      } else {
        stateRef.current.active = false
        if (stateRef.current.currentTimeout) clearTimeout(stateRef.current.currentTimeout)
        if (stateRef.current.currentInterval) clearInterval(stateRef.current.currentInterval)
        setPrompt('')
        setPromptActive(false)
        setModels(['', '', '', ''])
        setSendReady(false)
        setSendClicked(false)
        setIsLoading(false)
        setVisiblePanels(0)
        setActiveDropdown(null)
        setIsFadingOut(false)
      }
    }, { threshold: 0.15 })

    observer.observe(el)

    return () => {
      stateRef.current.active = false
      observer.disconnect()
      if (stateRef.current.currentTimeout) clearTimeout(stateRef.current.currentTimeout)
      if (stateRef.current.currentInterval) clearInterval(stateRef.current.currentInterval)
    }
  }, [])

  useEffect(() => {
    if (activeDropdown === null) return
    const click = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('.model-selector-slot')) return
      setActiveDropdown(null)
    }
    window.addEventListener('click', click)
    return () => window.removeEventListener('click', click)
  }, [activeDropdown])

  return {
    prompt,
    promptActive,
    models,
    sendReady,
    sendClicked,
    isLoading,
    visiblePanels,
    containerRef,
    isFadingOut,
    activeDropdown,
    toggleDropdown,
    selectModel,
    fillRandomModels,
    handleSendClick
  }
}

// ── Fallback order animation ──────────────────────────────────────────────────
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

function useDebateArenaSimulation() {
  const [topicText, setTopicText] = useState('')
  const [openingPlayer, setOpeningPlayer] = useState('Auto')
  const [rounds, setRounds] = useState(3)
  const [judging, setJudging] = useState('At the End')
  const [infavor, setInfavor] = useState('Auto')
  const [against, setAgainst] = useState('Auto')
  const [judge, setJudge] = useState('Auto')
  const [isStartClicked, setIsStartClicked] = useState(false)
  const [stage, setStage] = useState<'config' | 'debating'>('config')
  const [visibleCount, setVisibleCount] = useState(0)
  const [isTyping, setIsTyping] = useState(false)
  const [isFadingOut, setIsFadingOut] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [isTopicFinished, setIsTopicFinished] = useState(false)

  const containerRef = useRef<HTMLDivElement | null>(null)

  const stateRef = useRef({
    active: false,
    currentTimeout: null as ReturnType<typeof setTimeout> | null,
    currentInterval: null as ReturnType<typeof setInterval> | null,
    rounds: 3
  })

  useEffect(() => {
    stateRef.current.rounds = rounds
  }, [rounds])

  const runTimeout = (fn: () => void, delay: number) => {
    if (!stateRef.current.active) return
    if (stateRef.current.currentTimeout) clearTimeout(stateRef.current.currentTimeout)
    stateRef.current.currentTimeout = setTimeout(fn, delay)
  }

  const typeText = (text: string, onComplete: () => void) => {
    let index = 0
    setTopicText('')
    setIsTopicFinished(false)
    if (stateRef.current.currentInterval) clearInterval(stateRef.current.currentInterval)
    stateRef.current.currentInterval = setInterval(() => {
      if (!stateRef.current.active) {
        clearInterval(stateRef.current.currentInterval!)
        return
      }
      index++
      if (index <= text.length) {
        setTopicText(text.slice(0, index))
      } else {
        clearInterval(stateRef.current.currentInterval!)
        setIsTopicFinished(true)
        onComplete()
      }
    }, 40)
  }

  const handleStartClick = () => {
    if (!isTopicFinished || stage === 'debating') return
    setIsStartClicked(true)
    runTimeout(() => {
      setIsStartClicked(false)
      setStage('debating')
      runDebate()
    }, 400)
  }

  const runDebate = () => {
    let currentMsgIndex = 0
    const maxMessages = stateRef.current.rounds * 3

    const nextMessage = () => {
      if (!stateRef.current.active) return
      if (currentMsgIndex >= maxMessages || currentMsgIndex >= 15) {
        return
      }

      setIsTyping(true)
      runTimeout(() => {
        setIsTyping(false)
        setVisibleCount(currentMsgIndex + 1)
        currentMsgIndex++
        runTimeout(nextMessage, 1500)
      }, 1800)
    }

    nextMessage()
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        if (!stateRef.current.active) {
          stateRef.current.active = true
          setIsFadingOut(false)
          setStage('config')
          setTopicText('')
          setOpeningPlayer('Auto')
          setRounds(3)
          setJudging('At the End')
          setInfavor('Auto')
          setAgainst('Auto')
          setJudge('Auto')
          setIsStartClicked(false)
          setVisibleCount(0)
          setIsTyping(false)
          setActiveDropdown(null)
          setIsTopicFinished(false)
          
          runTimeout(() => {
            typeText("Should AI replace human creativity?", () => {
              // Wait for user configurations
            })
          }, 1000)
        }
      } else {
        stateRef.current.active = false
        if (stateRef.current.currentTimeout) clearTimeout(stateRef.current.currentTimeout)
        if (stateRef.current.currentInterval) clearInterval(stateRef.current.currentInterval)
        setStage('config')
        setTopicText('')
        setOpeningPlayer('Auto')
        setRounds(3)
        setJudging('At the End')
        setInfavor('Auto')
        setAgainst('Auto')
        setJudge('Auto')
        setIsStartClicked(false)
        setVisibleCount(0)
        setIsTyping(false)
        setActiveDropdown(null)
        setIsTopicFinished(false)
        setIsFadingOut(false)
      }
    }, { threshold: 0.15 })

    observer.observe(el)

    return () => {
      stateRef.current.active = false
      observer.disconnect()
      if (stateRef.current.currentTimeout) clearTimeout(stateRef.current.currentTimeout)
      if (stateRef.current.currentInterval) clearInterval(stateRef.current.currentInterval)
    }
  }, [])

  useEffect(() => {
    if (activeDropdown === null) return
    const click = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('.debate-selector-slot')) return
      setActiveDropdown(null)
    }
    window.addEventListener('click', click)
    return () => window.removeEventListener('click', click)
  }, [activeDropdown])

  return {
    topicText,
    openingPlayer,
    setOpeningPlayer,
    rounds,
    setRounds,
    judging,
    setJudging,
    infavor,
    setInfavor,
    against,
    setAgainst,
    judge,
    setJudge,
    isStartClicked,
    stage,
    visibleCount,
    isTyping,
    isFadingOut,
    containerRef,
    activeDropdown,
    setActiveDropdown,
    toggleDropdown: (name: string) => setActiveDropdown(activeDropdown === name ? null : name),
    isTopicFinished,
    handleStartClick
  }
}

// ── Count-up hook ─────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1200, decimals = 0) {
  const [val, setVal] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current; if (!el) return
    let animId: number | null = null
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        if (animId) cancelAnimationFrame(animId)
        const start = performance.now()
        const tick = (now: number) => {
          const p = Math.min((now - start) / duration, 1)
          const raw = p * target
          const factor = Math.pow(10, decimals)
          setVal(Math.round(raw * factor) / factor)
          if (p < 1) {
            animId = requestAnimationFrame(tick)
          } else {
            animId = null
          }
        }
        animId = requestAnimationFrame(tick)
      } else {
        setVal(0)
        if (animId) {
          cancelAnimationFrame(animId)
          animId = null
        }
      }
    }, { threshold: 0.1 })
    obs.observe(el)
    return () => {
      obs.disconnect()
      if (animId) cancelAnimationFrame(animId)
    }
  }, [target, duration, decimals])
  return { val, ref }
}

// ── GitHub icon ──────────────────────────────────────────────────────────────
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

const providerLogos: Record<string, string> = {
  Google: '/logos/google.svg',
  Groq: '/logos/groq.svg',
  Mistral: '/logos/mistral.svg',
  NVIDIA: '/logos/nvidia.svg',
  Cerebras: '/logos/cerebras.svg',
  SambaNova: '/logos/sambanova.jpg',
  Cohere: '/logos/cohere.svg',
  OpenRouter: '/logos/openrouter.svg',
  Cloudflare: '/logos/cloudflare.svg',
  Zhipu: '/logos/zai.svg',
  GitHub: '/logos/github.svg',
}

// ── Generated token phrases for Autoregressive Cascade ─────────────────────────
const SIMULATED_TOKENS = [
  { val: "System", type: "system" },
  { val: "Prompt", type: "system" },
  { val: "Vector", type: "vector" },
  { val: "Weights", type: "attention" },
  { val: "Query", type: "proxy" },
  { val: "Resolve", type: "proxy" },
  { val: "Model", type: "model" },
  { val: "Decode", type: "attention" },
  { val: "Cache", type: "proxy" },
  { val: "Response", type: "model" },
]

// ── Mock Chat Messages ────────────────────────────────────────────────────────
const mockChat = [
  { role: 'user', text: 'Explain quantum entanglement simply.' },
  { role: 'assistant', text: 'Quantum entanglement is when two particles become linked — measuring one instantly affects the other, no matter the distance. Einstein famously called it "spooky action at a distance."', meta: '312 ms · 47 tokens · gemini-2.5-flash' },
  { role: 'user', text: 'Can it be used for faster-than-light communication?' },
  { role: 'assistant', text: 'No — while the correlation is instant, you cannot use it to send information faster than light. The measurement results are random, so no message can be encoded in them.', meta: '198 ms · 39 tokens · gemini-2.5-flash' },
  { role: 'user', text: 'Is quantum cryptography completely secure?' },
  { role: 'assistant', text: 'Yes. Eavesdropping disrupts the delicate entangled state, immediately alerting both parties of the intrusion. This makes any unauthorized interception physically impossible.', meta: '245 ms · 42 tokens · gemini-2.5-flash' },
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
  // Round 1
  { role: 'infavor', label: 'In Favor · gemini-2.5-flash · Round 1', text: 'AI acts as a collaborative partner, expanding the boundaries of human ideation by suggesting non-obvious combinations and patterns that inspire novel ideas.' },
  { role: 'against', label: 'Against · llama-3.3-70b · Round 1', text: 'True creative leaps require breaking conventions and lived emotional experience. Static probability matrices merely repackage existing human data without genuine agency.' },
  {
    role: 'judge', label: '⚖ Judge · gpt-4o-mini · Round 1', text: `Score Card (Round 1):

In Favor Model: 6/10
Against Model: 7/10
Round Critique: In Favor points out collaborative potential, while Against emphasizes emotional authenticity. Slight edge to Against for distinguishing agency from iteration.` },
  // Round 2
  { role: 'infavor', label: 'In Favor · gemini-2.5-flash · Round 2', text: 'AI tools democratize expression, allowing people without formal training or technical illustration skills to manifest and communicate complex artistic visions.' },
  { role: 'against', label: 'Against · llama-3.3-70b · Round 2', text: 'Democratization shouldn\'t mean flooding the world with derivative, low-effort content. It risks diluting the value of dedication, craftsmanship, and years of skill.' },
  {
    role: 'judge', label: '⚖ Judge · gpt-4o-mini · Round 2', text: `Score Card (Round 2):

In Favor Model: 8/10
Against Model: 8/10
Round Critique: A balanced round. In Favor scores highly on accessibility and inclusion, but Against correctly warns of market dilution. This round is a draw.` },
  // Round 3
  { role: 'infavor', label: 'In Favor · gemini-2.5-flash · Round 3', text: 'Generative models accelerate iteration, enabling creators to rapidly test and prototype concepts in seconds rather than spending weeks on basic drafts.' },
  { role: 'against', label: 'Against · llama-3.3-70b · Round 3', text: 'Accelerating iteration bypasses the critical process of deep reflection. "Happy accidents" occur during slow, deliberate craftsmanship, not instant generations.' },
  {
    role: 'judge', label: '⚖ Judge · gpt-4o-mini · Round 3', text: `Score Card (Round 3):

In Favor Model: 8/10
Against Model: 7/10
Round Critique: In Favor highlights real-world industrial utility, whereas Against argues for the cognitive value of time. Slight edge to In Favor for practical feasibility.` },
  // Round 4
  { role: 'infavor', label: 'In Favor · gemini-2.5-flash · Round 4', text: 'By scanning historical art styles, AI can identify unexplored aesthetic gaps, enabling human artists to deliberately explore fresh stylistic frontiers.' },
  { role: 'against', label: 'Against · llama-3.3-70b · Round 4', text: 'Finding stylistic gaps via analysis is a formulaic approach, not an artistic one. Art is an expression of conscious emotion reflecting a moment in time.' },
  {
    role: 'judge', label: '⚖ Judge · gpt-4o-mini · Round 4', text: `Score Card (Round 4):

In Favor Model: 7/10
Against Model: 8/10
Round Critique: Against presents a strong philosophical argument against analytical creativity, though In Favor has solid utility. Score remains extremely tight.` },
  // Round 5
  { role: 'infavor', label: 'In Favor · gemini-2.5-flash · Round 5', text: 'Ultimately, AI is another tool in the artist\'s toolkit, analogous to the camera or synthesizer which faced similar resistance when first introduced.' },
  { role: 'against', label: 'Against · llama-3.3-70b · Round 5', text: 'A camera doesn\'t decide what is beautiful, and a synthesizer doesn\'t write lyrics. AI is the first tool that actively seeks to replace the creative agent.' },
  {
    role: 'judge', label: '⚖ Judge · gpt-4o-mini · Round 5', text: `Final Arena Verdict:

In Favor Model: 7/10
Against Model: 9/10
Declared Winner: Against Model
Key Debate Summary & Analysis: Ultimately, while In Favor presented a strong pragmatic defense of AI as an iteration booster and accessibility tool, Against won the debate by capturing the core distinction of human creative agency and lived intent.` }
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
    <section id={id} className={`relative z-10 py-20 px-6 ${alt ? 'bg-muted/30 dark:bg-white/[0.02]' : ''}`}>
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

const faqData = [
  {
    question: "Why use OmniKey AI?",
    answer: "OmniKey AI is a high-performance AI proxy gateway that consolidates multiple model providers and developer API credentials under a single OpenAI-compatible interface. By acting as a unified middleware layer, it simplifies application development, secures API keys, handles dynamic fallback routing, and aggregates usage stats in real-time.",
    tag: "general"
  },
  {
    question: "How does dynamic model routing reduce costs?",
    answer: "OmniKey AI allows you to set routing rules that prioritize the most cost-efficient models for simpler queries, while automatically falling back to more capable models only when high accuracy is required. This cuts down inference bills significantly.",
    tag: "general"
  },
  {
    question: "What is the default latency overhead of the gateway?",
    answer: "OmniKey's proxy layer is optimized for speed, introducing less than 15 milliseconds of latency overhead. Requests are processed and forwarded directly to the upstream model providers without unnecessary serialization delays.",
    tag: "general"
  },
  {
    question: "Is there a free tier for developers?",
    answer: "Yes, we offer a generous free tier that includes up to 10 million free tokens on signup, access to 12+ providers, basic failover routing, and real-time usage analytics on your dashboard.",
    tag: "general"
  },
  {
    question: "How does fallback routing work?",
    answer: "When a primary model provider or endpoint experiences downtime, latency spikes, or rate limits, the routing layer automatically detects the failure. It silently redirects the request to the next best alternative provider in under 15 milliseconds, ensuring continuous availability.",
    tag: "routing"
  },
  {
    question: "How is API key failover managed?",
    answer: "OmniKey AI pools multiple developer keys and tracks the rate limit status of different models internally in real-time. When a key hits a quota ceiling or triggers a rate limit (such as HTTP 429), requests are seamlessly and instantly routed to the next available key.",
    tag: "routing"
  },
  {
    question: "Can I customize my fallback order?",
    answer: "Yes. Developers can define custom prioritized fallback lists for their endpoints through the dashboard. If your primary provider fails, OmniKey will sequentially try the backup providers in your exact defined order.",
    tag: "routing"
  },
  {
    question: "What is the 'auto' model in OmniKey AI?",
    answer: "The 'auto' model is a dynamic placeholder model. When targeted, OmniKey's router automatically selects the highest-priority online model in your configured fallback chain, abstracting vendor-specific details away from client code.",
    tag: "routing"
  },
  {
    question: "Is the API proxy gateway compatible with standard OpenAI and Gemini SDKs?",
    answer: "Yes. OmniKey AI is built to be a drop-in replacement. You can point your existing OpenAI or Google Gen AI client SDKs directly to our proxy base URLs. Simply update the baseURL and swap your key for your unified OmniKey token.",
    tag: "api"
  },
  {
    question: "What models are supported by the gateway?",
    answer: "We support over 60+ models from industry-leading providers, including Google Gemini (Flash, Pro), Meta Llama (via Groq, Cerebras, SambaNova), Mistral Large, Qwen, and DeepSeek. You can target specific models or route dynamically.",
    tag: "api"
  },
  {
    question: "Does the proxy gateway support streaming completions?",
    answer: "Yes. Streaming is fully supported via Server-Sent Events (SSE) for both OpenAI-compatible and Gemini-compatible formats. When you set the stream parameter to true, token chunks are forwarded to your client application with minimal overhead.",
    tag: "api"
  },
  {
    question: "Do I need to change my code to use OmniKey AI?",
    answer: "Minimal changes are required. Since OmniKey AI exposes an OpenAI-compatible web API, you only need to redirect your API requests by changing the base URL in your SDK configuration to our gateway address and replace the API key.",
    tag: "api"
  },
  {
    question: "How does the gateway secure my developer credentials?",
    answer: "Security is a top priority. Upstream provider keys (such as your personal Google AI Studio or Groq keys) are encrypted using industry-standard symmetric AES-256-GCM encryption before database persistence. They are decrypted in-memory only during routing execution.",
    tag: "security"
  },
  {
    question: "Do my API requests get logged on the server?",
    answer: "By default, requests are routed statelessly. However, if audit logging is enabled in the Admin Console, the server maintains recent audit records (latency, token count, and timestamps) for usage statistics. These logs do not contain raw prompt payloads.",
    tag: "security"
  },
  {
    question: "Can I revoke or refresh my OmniKey tokens instantly?",
    answer: "Yes. If you suspect a token has been compromised, you can revoke or rotate it immediately via the dashboard's Keys section. The old token will be blacklisted across all edge servers within seconds.",
    tag: "security"
  },
  {
    question: "Does OmniKey support role-based access control (RBAC)?",
    answer: "Yes, you can create multiple restricted tokens with specific permissions (e.g. read-only, write-only, or limited to specific model providers) to delegate access to team members or staging environments safely.",
    tag: "security"
  }
]

// ── Landing Page ──────────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate()
  const { dark, toggle } = useDark()
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [activeCategory, setActiveCategory] = useState<'general' | 'routing' | 'api' | 'security'>('general')
  const chat = useAnimatedChat()
  const routingPhase = useAnimatedRouting()
  const arena = useArenaAnimation()
  const fallbackOrder = useFallbackOrder()
  const debateSim = useDebateArenaSimulation()
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null)
  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight
    }
  }, [debateSim.visibleCount, debateSim.isTyping])
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [chat.visible, chat.typing, chat.inputText])
  const heroRef = useRef<HTMLElement>(null)
  const [routedRequestsTarget, setRoutedRequestsTarget] = useState(850.00)
  const [tokensChanneledTarget, setTokensChanneledTarget] = useState(100.00)
  const [successRateTarget, setSuccessRateTarget] = useState(99.98)
  const [requestsUnit, setRequestsUnit] = useState('K+')
  const [tokensUnit, setTokensUnit] = useState('M+')
  const [successUnit, setSuccessUnit] = useState('%')

  const stat1 = useCountUp(100)
  const stat4 = useCountUp(routedRequestsTarget, 1200, 2)
  const stat5 = useCountUp(tokensChanneledTarget, 1200, 2)
  const stat6 = useCountUp(successRateTarget, 1200, 2)
  const [promoStatus, setPromoStatus] = useState<{ activePromoUsers: number; totalPromoLimit: number; remainingSlots: number; isActive: boolean } | null>(null)
  const [featuresDropdownOpen, setFeaturesDropdownOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY
      if (y > 60) {
        setScrolled(true)
      } else if (y < 15) {
        setScrolled(false)
      }
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactMessage, setContactMessage] = useState('')
  const [contactSubmitting, setContactSubmitting] = useState(false)
  const [contactError, setContactError] = useState<string | null>(null)
  const [contactSuccess, setContactSuccess] = useState<string | null>(null)

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setContactError(null)
    setContactSuccess(null)

    if (!contactName.trim() || !contactEmail.trim() || !contactMessage.trim()) {
      setContactError("All fields are required.")
      return
    }

    if (!contactEmail.includes('@')) {
      setContactError("Please enter a valid email address.")
      return
    }

    setContactSubmitting(true)
    try {
      const base = (import.meta.env.VITE_API_URL || import.meta.env.BASE_URL).replace(/\/$/, '')
      const res = await fetch(`${base}/api/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: contactName,
          email: contactEmail,
          message: contactMessage,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || `HTTP error ${res.status}`)
      }

      setContactSuccess("Your message has been sent successfully!")
      setContactName('')
      setContactEmail('')
      setContactMessage('')
    } catch (err: any) {
      setContactError(err.message || "Failed to send message. Please try again.")
    } finally {
      setContactSubmitting(false)
    }
  }

  useEffect(() => {
    const fetchPromoStatus = async () => {
      try {
        const base = (import.meta.env.VITE_API_URL || import.meta.env.BASE_URL).replace(/\/$/, '')
        const res = await fetch(`${base}/api/public/promo-status`)
        if (res.ok) {
          const data = await res.json()
          setPromoStatus(data)
        }
      } catch (err) {
        console.warn('Failed to fetch promo status:', err)
      }
    }
    const fetchPublicStats = async () => {
      try {
        const base = (import.meta.env.VITE_API_URL || import.meta.env.BASE_URL).replace(/\/$/, '')
        const res = await fetch(`${base}/api/public/stats`)
        if (res.ok) {
          const data = await res.json()

          const totalReqs = data.totalRequests || 0
          setRoutedRequestsTarget(Math.round((totalReqs / 1000) * 100) / 100)
          setRequestsUnit('K+')

          const totalToks = data.tokensChanneled || 0
          setTokensChanneledTarget(Math.round((totalToks / 1_000_000) * 100) / 100)
          setTokensUnit('M+')

          const rawSuccess = data.successRate !== undefined ? data.successRate : 100
          if (rawSuccess >= 100) {
            setSuccessRateTarget(100)
          } else {
            setSuccessRateTarget(Math.floor(rawSuccess * 100) / 100)
          }
          setSuccessUnit('%')
        }
      } catch (err) {
        console.warn('Failed to fetch public stats:', err)
      }
    }

    fetchPromoStatus()
    fetchPublicStats()
  }, [])

  return (
    <div className="min-h-screen text-foreground relative pb-10">
      <Helmet>
        <title>OmniKey AI - One Key. Every Model.</title>
        <meta name="description" content="Route requests across Gemini, Groq, Mistral, and more with automatic fallbacks for 100% uptime. Explore our API proxy gateway with Groq fallback routing and free Gemini API failover." />
      </Helmet>
      <style>{auroraCSS}</style>
      <NeuralMeshBackground dark={dark} />

      {/* NAV */}
      <header className={`sticky top-0 z-50 transition-all duration-300 bg-background/10 backdrop-blur-[24px] border-b border-cyan-400/40 shadow-[0_4px_24px_rgba(6,182,212,0.35)] rounded-b-2xl ${scrolled ? 'h-12' : 'h-16'}`}>
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between relative h-full transition-all duration-300">
          <div className="flex items-center gap-2 shrink-0">
            <span className={`font-bold tracking-tight transition-all duration-300 ${scrolled ? 'text-sm' : 'text-lg text-foreground'}`}>OmniKey AI</span>
          </div>
          <div className="flex items-center gap-6 ml-auto">
            <nav className={`hidden md:flex items-center justify-end text-muted-foreground transition-all duration-300 ${scrolled ? 'gap-5 text-sm' : 'gap-6 text-[14px]'}`}>
              {/* Features Dropdown */}
              <div
                className="relative py-2"
                onMouseEnter={() => setFeaturesDropdownOpen(true)}
                onMouseLeave={() => setFeaturesDropdownOpen(false)}
              >
                <button
                  onClick={() => setFeaturesDropdownOpen(!featuresDropdownOpen)}
                  className={`hover:text-foreground transition-colors flex items-center gap-1.5 cursor-pointer focus:outline-none transition-all duration-300 ${scrolled ? 'font-medium' : 'font-semibold text-foreground/90'}`}
                >
                  Features
                  <svg
                    className={`w-2.5 h-2.5 transition-transform duration-200 ${featuresDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {featuresDropdownOpen && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-40 rounded-xl border border-border bg-card/95 backdrop-blur-xl shadow-xl py-2 z-50 animate-fade-in flex flex-col">
                    <a
                      href="#routing"
                      onClick={() => setFeaturesDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 hover:text-foreground hover:bg-muted/50 transition-colors w-full"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="18" r="3" /><circle cx="18" cy="6" r="3" /><path d="M6 15c0-3.87 3.13-7 7-7h2" /><polyline points="17 3 21 7 17 11" /></svg>
                      Routing
                    </a>
                    <a
                      href="#features"
                      onClick={() => setFeaturesDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 hover:text-foreground hover:bg-muted/50 transition-colors w-full"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                      Playground
                    </a>
                    <a
                      href="#arena"
                      onClick={() => setFeaturesDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 hover:text-foreground hover:bg-muted/50 transition-colors w-full"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
                      Arena
                    </a>
                    <a
                      href="#debate"
                      onClick={() => setFeaturesDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 hover:text-foreground hover:bg-muted/50 transition-colors w-full"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z" /></svg>
                      Debate
                    </a>
                  </div>
                )}
              </div>

              <a
                href="/docs"
                onClick={e => { e.preventDefault(); navigate('/docs') }}
                className={`hover:text-foreground transition-colors flex items-center gap-1.5 transition-all duration-300 ${scrolled ? 'font-medium' : 'font-semibold text-foreground/90'}`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>
                Docs
              </a>

              <a href="#faq" className={`hover:text-foreground transition-colors flex items-center gap-1.5 transition-all duration-300 ${scrolled ? 'font-medium' : 'font-semibold text-foreground/90'}`}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                FAQs
              </a>

              <a href="#contact" className={`hover:text-foreground transition-colors flex items-center gap-1.5 transition-all duration-300 ${scrolled ? 'font-medium' : 'font-semibold text-foreground/90'}`}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
                Contact
              </a>
            </nav>
            <div className="flex items-center gap-3">
              <button onClick={toggle} title="Toggle theme" className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer">
                {dark ? <SunIcon /> : <MoonIcon />}
              </button>
              <button
                onClick={() => navigate('/keys')}
                className={`cta-btn bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-2xl shadow-md shadow-violet-500/20 transition-all duration-300 cursor-pointer ${scrolled ? 'text-xs px-4 py-1.5' : 'text-sm px-4 py-2'}`}
              >
                Get Started →
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* HERO SECTION - BIFURCATED GRID */}
      <section ref={heroRef} className="relative min-h-[calc(100vh-80px)] flex items-center py-6 px-6 md:px-12 max-w-7xl mx-auto z-10">
        <div className="grid md:grid-cols-12 gap-12 items-center w-full">

          {/* Left Column - Large Logo & Supported Providers (Centered) */}
          <div className="md:col-span-6 flex flex-col justify-center items-center text-center gap-6">

            {/* Combined Logo & Providers Container with 0 gap */}
            <div className="flex flex-col items-center gap-0 w-full">
              {/* Big Logo */}
              <div className="w-full flex justify-center items-center">
                <img
                  src={dark ? logoDark : logoLight}
                  alt="OmniKey AI - One Key. Every Model."
                  className="max-h-[38vh] md:max-h-[33vh] w-auto object-contain transition-all duration-300 transform hover:scale-[1.01]"
                />
              </div>

              {/* Supported Providers Badges */}
              <div className="w-full mt-0">
                <div className="flex flex-wrap justify-center gap-2">
                  {providers.map(p => {
                    const logo = providerLogos[p]
                    const isGitHub = p === 'GitHub'
                    return (
                      <span key={p} className="provider-pill flex items-center gap-2 text-xs px-3.5 py-2 rounded-full border border-border bg-card/60 text-muted-foreground">
                        {isGitHub ? (
                          <span className="text-foreground dark:text-white flex items-center justify-center">
                            <GitHubIcon size={14} />
                          </span>
                        ) : logo ? (
                          <img src={logo} alt={p} className="w-4 h-4 object-contain" />
                        ) : (
                          <span className={`w-1.5 h-1.5 rounded-full ${providerColors[p]}`} />
                        )}
                        {p}
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>

          </div>

          {/* Right Column - Launch Offer, Stats Grid & Description Text */}
          <div className="md:col-span-6 flex flex-col justify-center items-center gap-6 w-full">

            {/* Launch Offer Banner */}
            <div>
              {promoStatus?.isActive ? (
                <div
                  onClick={() => navigate('/keys')}
                  className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-emerald-500/40 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.25)] hover:shadow-[0_0_22px_rgba(16,185,129,0.5)] hover:bg-emerald-500/10 text-xs font-semibold text-emerald-600 dark:text-emerald-400 cursor-pointer transition-all duration-300 transform hover:scale-[1.02]"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 animate-pulse"></span>
                  </span>
                  <span>Launch Offer: Get 10M tokens free!</span>
                </div>
              ) : (
                <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-500">
                  ⚡ 12 Free LLM Providers. Zero Lock-in.
                </span>
              )}
            </div>

            {/* Stats Block (2x2 grid) */}
            <div className="w-full">
              {/* Outer wrapper: defined border + subtle cyan glow */}
              <div className="rounded-2xl border border-cyan-500/50 shadow-[0_0_28px_6px_rgba(6,182,212,0.28)] overflow-hidden">
                {/* Grid with internal separators via divide */}
                <div className="grid grid-cols-2 bg-card/25 backdrop-blur-md divide-x divide-y divide-cyan-500/20 relative">
                  {[
                    { ref: stat1.ref, val: `${stat1.val.toLocaleString()}+`, label: 'Models Available' },
                    { ref: stat4.ref, val: `${stat4.val.toFixed(2)}${requestsUnit}`, label: 'Requests Processed' },
                    { ref: stat5.ref, val: `${stat5.val.toFixed(2)}${tokensUnit}`, label: 'Tokens Channeled' },
                    { ref: stat6.ref, val: `${stat6.val.toFixed(2)}${successUnit}`, label: 'Routing Success Rate' }
                  ].map(({ ref, val, label }) => (
                    <div key={label} ref={ref} className="stat-animate text-center py-6 px-4">
                      <div className="text-3xl font-extrabold text-foreground stat-num">{val}</div>
                      <div className="text-xs text-muted-foreground mt-1">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Description Text */}
            <p className="text-sm text-muted-foreground leading-relaxed max-w-lg text-center mx-auto">
              OmniKey AI roots your requests across Gemini, Groq, Mistral, NVIDIA, Cerebras and more — with automatic fallbacks to ensure 100% uptime.
            </p>

          </div>

        </div>
      </section>


      {/* ── SECTION: Chat Playground ── */}
      {/* ── SECTION: Smart Routing ── */}
      <Section id="routing" alt>
        <div className="grid md:grid-cols-2 gap-12 items-center">
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
          <div>
            <Pill label="Smart Routing" color="violet" />
            <SectionHeading>Zero Downtime. Automatic Fallbacks.</SectionHeading>
            <SectionSub>When one provider rate-limits, OmniKey silently routes to the next best option. Your app never sees an error — just seamless responses.</SectionSub>
          </div>
        </div>
      </Section>

      {/* ── SECTION: Chat Playground ── */}
      <Section id="features">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <Pill label="Chat Playground" color="green" />
            <SectionHeading>Test Any Model Instantly</SectionHeading>
            <SectionSub>Switch between OpenAI and Gemini formats. Pick any model, type your prompt, and see real AI responses with live latency and token metrics.</SectionSub>
          </div>
          <MockCard>
            <div ref={chat.containerRef} className={`transition-opacity duration-500 ${chat.isFadingOut ? 'opacity-0' : 'opacity-100'}`}>
              <div className="bg-muted/40 dark:bg-white/5 px-4 py-3 border-b border-border flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">gemini-2.5-flash</span>
                <span className="text-[10px] bg-violet-500/10 text-violet-500 border border-violet-500/20 rounded-full px-2 py-0.5 font-semibold">OmniKey AI</span>
              </div>
              <div ref={chatScrollRef} className="p-4 space-y-3 h-[260px] overflow-y-auto scroll-smooth">
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
                <div className="flex-1 bg-muted/40 dark:bg-white/5 rounded-xl text-xs px-3 py-2 text-foreground font-medium flex items-center min-h-[32px] overflow-hidden">
                  {chat.inputText ? (
                    <span className="flex items-center truncate">
                      <span>{chat.inputText}</span>
                      <span className="w-1 h-3.5 bg-violet-500 ml-0.5 animate-pulse inline-block" />
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Type a message...</span>
                  )}
                </div>
                <button
                  onClick={chat.handleSendClick}
                  disabled={!chat.showSendPrompt}
                  className={`rounded-xl px-4 py-2 flex items-center text-white text-xs font-semibold transition-all duration-300 ${
                    chat.showSendPrompt
                      ? 'bg-violet-600 shadow-lg shadow-violet-500/35 cursor-pointer animate-pop-invite hover:bg-violet-700 active:scale-95'
                      : 'bg-muted-foreground/20 text-muted-foreground/60 cursor-not-allowed'
                  }`}
                >
                  Send
                </button>
              </div>
            </div>
          </MockCard>
        </div>
      </Section>

      {/* ── SECTION: Arena ── */}
      <Section id="arena" alt>
        <div ref={arena.containerRef} className="grid md:grid-cols-2 gap-12 items-center">
          <MockCard>
            <div className={`transition-opacity duration-500 ${arena.isFadingOut ? 'opacity-0' : 'opacity-100'}`}>
              <div className="bg-muted/40 dark:bg-white/5 px-4 py-3 border-b border-border flex items-center justify-between gap-3 min-h-[45px]">
                <div className="text-xs font-semibold flex items-center overflow-hidden flex-1">
                  <span className="text-muted-foreground shrink-0">Prompt:&nbsp;</span>
                  {arena.prompt ? (
                    <span className="flex items-center text-foreground truncate">
                      <span>{arena.prompt}</span>
                      {arena.promptActive && <span className="w-1.5 h-3.5 bg-blue-500 ml-0.5 animate-pulse inline-block" />}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/45 italic font-normal">Awaiting prompt...</span>
                  )}
                </div>
                
                {/* Buttons container */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Random Models button */}
                  {!arena.promptActive && !arena.sendClicked && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        arena.fillRandomModels()
                      }}
                      className="px-2 py-1 text-[10px] font-semibold rounded-lg border border-violet-500/35 text-violet-500 bg-violet-500/5 hover:bg-violet-500/10 cursor-pointer transition-all duration-300"
                    >
                      Random Models
                    </button>
                  )}
                  
                  {/* Send button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      arena.handleSendClick()
                    }}
                    disabled={!arena.sendReady || arena.sendClicked}
                    className={`rounded-lg px-3 py-1 text-[10px] font-bold border transition-all duration-300 ${
                      arena.sendClicked
                        ? 'bg-blue-700 text-white border-blue-600 scale-95 shadow-none'
                        : arena.sendReady
                          ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20 scale-100 cursor-pointer animate-pop-invite hover:bg-blue-700'
                          : 'bg-muted-foreground/10 text-muted-foreground/40 border-border/40 scale-100 cursor-not-allowed'
                    }`}
                  >
                    Send
                  </button>
                </div>
              </div>
              
              {/* Model selectors row */}
              <div className="grid grid-cols-4 divide-x divide-border border-b border-border relative z-10">
                {arena.models.map((m, i) => {
                  const colors = ['text-blue-400', 'text-orange-400', 'text-purple-400', 'text-emerald-400']
                  const dropdownOptions = [
                    ['gemini-2.5-flash', 'gemini-1.5-pro', 'gpt-4o'],
                    ['llama-3.3-70b', 'llama-3.1-8b', 'claude-3-5-sonnet'],
                    ['mistral-large', 'mistral-nemo', 'deepseek-v3'],
                    ['qwen-2.5-72b', 'gemma-2-9b', 'phi-3-medium']
                  ]
                  const isDropdownOpen = arena.activeDropdown === i
                  const isSlotInviting = !m && !arena.promptActive && !arena.sendClicked
                  
                  return (
                    <div 
                      key={i} 
                      className={`model-selector-slot relative px-2 py-2 text-xs font-semibold flex flex-col items-center justify-center min-h-[40px] gap-1 ${colors[i]} ${
                        isSlotInviting 
                          ? 'bg-violet-500/5 hover:bg-violet-500/10 border-dashed border-violet-500/40 cursor-pointer animate-pulse' 
                          : 'cursor-pointer hover:bg-muted/40'
                      } transition-all duration-300`}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!arena.promptActive && !arena.sendClicked) {
                          arena.toggleDropdown(i)
                        }
                      }}
                    >
                      {m ? (
                        <span className="model-tag truncate animate-drop-in">{m}</span>
                      ) : (
                        <span className="text-muted-foreground/50 font-normal italic">Select Model</span>
                      )}
                      
                      {isDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl py-1.5 z-50 animate-drop-in flex flex-col max-h-[120px] overflow-y-auto">
                          {dropdownOptions[i].map(opt => (
                            <button
                              key={opt}
                              onClick={(e) => {
                                e.stopPropagation()
                                arena.selectModel(i, opt)
                              }}
                              className="px-2 py-1 text-left text-xs text-foreground hover:bg-violet-500/10 hover:text-violet-500 w-full transition-colors font-medium truncate"
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              
              <div className="grid grid-cols-2 gap-0 divide-x divide-y divide-border">
                {arenaPanels.map((p, i) => {
                  const isPanelVisible = i < arena.visiblePanels
                  return (
                    <div key={i} className="p-3 min-h-[140px] relative flex flex-col justify-between overflow-hidden">
                      <div>
                        <div className={`text-[10px] font-semibold mb-2 ${p.color} flex items-center justify-between`}>
                          <span>{arena.models[i] || '—'}</span>
                          <span className="text-muted-foreground font-normal">{isPanelVisible ? p.latency : '...'}</span>
                        </div>
                        {arena.isLoading && !isPanelVisible ? (
                          <div className="flex gap-1 items-center h-10 text-muted-foreground/40">
                            <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                          </div>
                        ) : isPanelVisible ? (
                          <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-line animate-fade-up">
                            {p.text}
                          </p>
                        ) : (
                          <div className="text-xs text-muted-foreground/30 italic font-normal py-2">Awaiting trigger...</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
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
      <Section id="debate">
        <div className="text-center mb-4">
          <span className="inline-block text-xs sm:text-sm font-semibold px-3.5 py-1 rounded-full border bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-sm">
            ⚔ Debate Arena
          </span>
        </div>
        <MockCard>
          <div ref={debateSim.containerRef} className="grid md:grid-cols-[280px_1fr]">
            <div className="border-r border-border p-5 space-y-4 bg-muted/20 dark:bg-white/[0.02] relative">
              <div className="space-y-1">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Topic</div>
                <div className={`text-xs bg-background border rounded-xl px-3 py-2 text-foreground transition-all duration-300 min-h-[34px] flex items-center border-border`}>
                  {debateSim.topicText ? (
                    <span className="flex items-center truncate">
                      <span>{debateSim.topicText}</span>
                      {!debateSim.isTopicFinished && <span className="w-1.5 h-3.5 bg-violet-500 ml-0.5 animate-pulse inline-block" />}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/35 italic font-normal">Awaiting topic input...</span>
                  )}
                </div>
              </div>
              
              {/* Opening Player dropdown */}
              <div className="space-y-1">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Opening Player</div>
                <div 
                  onClick={(e) => { e.stopPropagation(); if (debateSim.stage !== 'debating') debateSim.toggleDropdown('opening') }}
                  className={`debate-selector-slot relative text-xs bg-background border rounded-xl px-3 py-2 text-foreground flex justify-between items-center transition-all duration-300 ${
                    debateSim.stage === 'debating' ? 'cursor-not-allowed opacity-75' : 'cursor-pointer hover:bg-muted/30'
                  } ${debateSim.activeDropdown === 'opening' ? 'border-violet-500 ring-1 ring-violet-500/30' : 'border-border'}`}
                >
                  <span>{debateSim.openingPlayer}</span>
                  <span className="text-muted-foreground">▾</span>
                  {debateSim.activeDropdown === 'opening' && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl py-1 z-50 animate-drop-in flex flex-col">
                      {['Auto', 'In Favor', 'Against'].map(opt => (
                        <button key={opt} onClick={(e) => { e.stopPropagation(); debateSim.setOpeningPlayer(opt); debateSim.setActiveDropdown(null) }} className="px-3 py-1.5 text-left text-xs text-foreground hover:bg-violet-500/10 hover:text-violet-500 w-full transition-colors">{opt}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Rounds & Judging dropdowns */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Rounds</div>
                  <div 
                    onClick={(e) => { e.stopPropagation(); if (debateSim.stage !== 'debating') debateSim.toggleDropdown('rounds') }}
                    className={`debate-selector-slot relative text-xs bg-background border rounded-xl px-3 py-2 text-foreground flex justify-between items-center transition-all duration-300 ${
                      debateSim.stage === 'debating' ? 'cursor-not-allowed opacity-75' : 'cursor-pointer hover:bg-muted/30'
                    } ${debateSim.activeDropdown === 'rounds' ? 'border-violet-500 ring-1 ring-violet-500/30' : 'border-border'}`}
                  >
                    <span>{debateSim.rounds}</span>
                    <span className="text-muted-foreground">▾</span>
                    {debateSim.activeDropdown === 'rounds' && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl py-1 z-50 animate-drop-in flex flex-col">
                        {[1, 2, 3, 4, 5].map(opt => (
                          <button key={opt} onClick={(e) => { e.stopPropagation(); debateSim.setRounds(opt); debateSim.setActiveDropdown(null) }} className="px-3 py-1.5 text-left text-xs text-foreground hover:bg-violet-500/10 hover:text-violet-500 w-full transition-colors">{opt}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Judging</div>
                  <div 
                    onClick={(e) => { e.stopPropagation(); if (debateSim.stage !== 'debating') debateSim.toggleDropdown('judging') }}
                    className={`debate-selector-slot relative text-xs bg-background border rounded-xl px-3 py-2 text-foreground flex justify-between items-center transition-all duration-300 ${
                      debateSim.stage === 'debating' ? 'cursor-not-allowed opacity-75' : 'cursor-pointer hover:bg-muted/30'
                    } ${debateSim.activeDropdown === 'judging' ? 'border-violet-500 ring-1 ring-violet-500/30' : 'border-border'}`}
                  >
                    <span>{debateSim.judging}</span>
                    <span className="text-muted-foreground">▾</span>
                    {debateSim.activeDropdown === 'judging' && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl py-1 z-50 animate-drop-in flex flex-col">
                        {['Auto', 'Every Round', 'At the End'].map(opt => (
                          <button key={opt} onClick={(e) => { e.stopPropagation(); debateSim.setJudging(opt); debateSim.setActiveDropdown(null) }} className="px-3 py-1.5 text-left text-xs text-foreground hover:bg-violet-500/10 hover:text-violet-500 w-full transition-colors">{opt}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* In Favor & Against in same row */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider flex gap-1 items-center"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />In Favor</div>
                  <div 
                    onClick={(e) => { e.stopPropagation(); if (debateSim.stage !== 'debating') debateSim.toggleDropdown('infavor') }}
                    className={`debate-selector-slot relative text-xs bg-background border rounded-xl px-3 py-2 text-foreground flex justify-between items-center transition-all duration-300 ${
                      debateSim.stage === 'debating' ? 'cursor-not-allowed opacity-75' : 'cursor-pointer hover:bg-muted/30'
                    } ${debateSim.activeDropdown === 'infavor' ? 'border-violet-500 ring-1 ring-violet-500/30' : 'border-border'}`}
                  >
                    <span className="truncate">{debateSim.infavor}</span>
                    <span className="text-muted-foreground ml-1">▾</span>
                    {debateSim.activeDropdown === 'infavor' && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl py-1.5 z-50 animate-drop-in flex flex-col">
                        {['Auto', 'gemini-2.5-flash', 'deepseek-r1', 'claude-3-5-sonnet'].map(opt => (
                          <button key={opt} onClick={(e) => { e.stopPropagation(); debateSim.setInfavor(opt); debateSim.setActiveDropdown(null) }} className="px-2 py-1.5 text-left text-xs text-foreground hover:bg-violet-500/10 hover:text-violet-500 w-full transition-colors truncate">{opt}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold text-rose-500 uppercase tracking-wider flex gap-1 items-center"><span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />Against</div>
                  <div 
                    onClick={(e) => { e.stopPropagation(); if (debateSim.stage !== 'debating') debateSim.toggleDropdown('against') }}
                    className={`debate-selector-slot relative text-xs bg-background border rounded-xl px-3 py-2 text-foreground flex justify-between items-center transition-all duration-300 ${
                      debateSim.stage === 'debating' ? 'cursor-not-allowed opacity-75' : 'cursor-pointer hover:bg-muted/30'
                    } ${debateSim.activeDropdown === 'against' ? 'border-violet-500 ring-1 ring-violet-500/30' : 'border-border'}`}
                  >
                    <span className="truncate">{debateSim.against}</span>
                    <span className="text-muted-foreground ml-1">▾</span>
                    {debateSim.activeDropdown === 'against' && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl py-1.5 z-50 animate-drop-in flex flex-col">
                        {['Auto', 'llama-3.3-70b', 'mistral-large', 'gpt-4o-mini'].map(opt => (
                          <button key={opt} onClick={(e) => { e.stopPropagation(); debateSim.setAgainst(opt); debateSim.setActiveDropdown(null) }} className="px-2 py-1.5 text-left text-xs text-foreground hover:bg-violet-500/10 hover:text-violet-500 w-full transition-colors truncate">{opt}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Judge dropdown */}
              <div className="space-y-1">
                <div className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider flex gap-1 items-center"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />Judge</div>
                <div 
                  onClick={(e) => { e.stopPropagation(); if (debateSim.stage !== 'debating') debateSim.toggleDropdown('judge') }}
                  className={`debate-selector-slot relative text-xs bg-background border rounded-xl px-3 py-2 text-foreground flex justify-between items-center transition-all duration-300 ${
                    debateSim.stage === 'debating' ? 'cursor-not-allowed opacity-75' : 'cursor-pointer hover:bg-muted/30'
                  } ${debateSim.activeDropdown === 'judge' ? 'border-violet-500 ring-1 ring-violet-500/30' : 'border-border'}`}
                >
                  <span className="truncate">{debateSim.judge}</span>
                  <span className="text-muted-foreground ml-1">▾</span>
                  {debateSim.activeDropdown === 'judge' && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl py-1.5 z-50 animate-drop-in flex flex-col">
                      {['Auto', 'gpt-4o-mini', 'gemini-2.0-flash', 'llama-3.3-70b'].map(opt => (
                        <button key={opt} onClick={(e) => { e.stopPropagation(); debateSim.setJudge(opt); debateSim.setActiveDropdown(null) }} className="px-3 py-1.5 text-left text-xs text-foreground hover:bg-violet-500/10 hover:text-violet-500 w-full transition-colors truncate">{opt}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Start button */}
              <button
                onClick={debateSim.handleStartClick}
                disabled={!debateSim.isTopicFinished || debateSim.stage === 'debating'}
                className={`w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-semibold rounded-xl px-4 py-2.5 text-center transition-all duration-300 ${
                  debateSim.isTopicFinished && debateSim.stage !== 'debating'
                    ? 'shadow-lg shadow-violet-500/35 cursor-pointer animate-pop-invite hover:from-violet-550 hover:to-indigo-550 active:scale-95'
                    : 'opacity-50 cursor-not-allowed shadow-none'
                } ${debateSim.isStartClicked ? 'scale-95 brightness-90' : ''}`}
              >
                Start Debate Arena
              </button>
            </div>
            
            {/* Transcript */}
            <div className={`p-5 flex flex-col h-[390px] transition-opacity duration-500 ${debateSim.isFadingOut ? 'opacity-0' : 'opacity-100'}`}>
              {debateSim.stage === 'config' ? (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/45 border-2 border-dashed border-border/60 rounded-2xl p-6 bg-muted/5">
                  <span className="text-3xl mb-3">⚔</span>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1">Debate Arena Offline</p>
                  <p className="text-[11px] text-center max-w-[200px] leading-relaxed">Configure the parameters in the sidebar and press start to begin the simulation.</p>
                </div>
              ) : (
                <>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 shrink-0 flex items-center justify-between">
                    <span>Round {Math.min(debateSim.rounds, Math.floor(debateSim.visibleCount / 3) + 1)} of {debateSim.rounds}</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-indicator-pulse inline-block" />
                  </div>
                  <div ref={transcriptScrollRef} className="flex-1 overflow-y-auto no-scrollbar pr-1 space-y-3 scroll-smooth">
                    {debateMsgs.map((m, i) => i < debateSim.visibleCount ? (
                      <div key={i} className={`rounded-xl border px-4 py-3 text-xs leading-relaxed animate-fade-up ${m.role === 'infavor' ? 'border-emerald-500/30 bg-emerald-500/5' :
                        m.role === 'against' ? 'border-rose-500/30 bg-rose-500/5' :
                          'border-amber-500/30 bg-amber-500/5'
                        }`}>
                        <div className={`text-[10px] font-semibold mb-1 ${m.role === 'infavor' ? 'text-emerald-500' :
                          m.role === 'against' ? 'text-rose-500' :
                            'text-amber-500'
                          }`}>{m.label}</div>
                        <p className="whitespace-pre-line">{m.text}</p>
                      </div>
                    ) : null)}

                    {debateSim.isTyping && (
                      <div className="rounded-xl border px-4 py-3 text-xs leading-relaxed animate-fade-up bg-muted/20 border-border/40 flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          {debateMsgs[debateSim.visibleCount]?.role === 'infavor' ? 'In Favor is typing' :
                            debateMsgs[debateSim.visibleCount]?.role === 'against' ? 'Against is typing' :
                              'Judge is evaluating'}
                        </span>
                        <div className="flex gap-1 items-center">
                          <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </MockCard>
      </Section>

      {/* ── SECTION: FAQ & How it Works ── */}
      <Section id="faq" alt>
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-4">
            <span className="inline-block text-xs sm:text-sm font-semibold px-3.5 py-1 rounded-full border bg-violet-500/10 text-violet-500 border-violet-500/20 shadow-sm">
              Got Questions?
            </span>
          </div>

          {/* FAQ Category Tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-10 max-w-xl mx-auto animate-fade-up">
            {(['general', 'routing', 'api', 'security'] as const).map(cat => {
              const isActive = activeCategory === cat;
              const labels = {
                general: 'General Info',
                routing: 'Smart Routing',
                api: 'API Compatibility',
                security: 'Security & Encryption'
              };
              return (
                <button
                  key={cat}
                  onClick={() => {
                    setActiveCategory(cat);
                    setOpenFaq(null);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all duration-300 cursor-pointer select-none ${isActive
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 border-violet-500 text-white shadow-lg shadow-violet-500/20'
                    : 'border-border bg-card/40 text-muted-foreground hover:text-foreground hover:bg-card/75 hover:border-violet-500/20'
                    }`}
                >
                  {labels[cat]}
                </button>
              );
            })}
          </div>

          <div className="space-y-4">
            {faqData
              .filter(faq => faq.tag === activeCategory)
              .map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div
                    key={idx}
                    style={{ animationDelay: `${idx * 100}ms` }}
                    className={`group rounded-2xl border transition-all duration-300 bg-card/60 backdrop-blur overflow-hidden animate-fade-up ${isOpen
                      ? 'border-violet-500/40 ring-1 ring-violet-500/20 shadow-[0_0_25px_rgba(139,92,246,0.22)] bg-gradient-to-br from-card to-violet-500/5'
                      : 'border-border hover:border-violet-500/30 hover:shadow-[0_0_15px_rgba(139,92,246,0.08)] hover:bg-card/90'
                      }`}
                  >
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full text-left p-4 flex items-center justify-between gap-4 font-semibold text-foreground cursor-pointer select-none"
                    >
                      <span className="flex items-center gap-3 text-xs sm:text-sm">
                        <span className={`text-[10px] transition-all duration-350 transform ${isOpen ? 'text-violet-500 rotate-90 scale-125' : 'text-slate-400 rotate-0 scale-100 group-hover:text-violet-400 group-hover:rotate-45'}`}>✦</span>
                        <span className={`transition-colors duration-300 ${isOpen ? 'text-violet-500' : 'text-foreground group-hover:text-violet-400'}`}>
                          {faq.question}
                        </span>
                      </span>
                      <span className={`text-muted-foreground shrink-0 transition-all duration-350 ${isOpen ? 'rotate-180 text-violet-500' : 'group-hover:text-violet-400 group-hover:translate-y-0.5'}`}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </span>
                    </button>
                    <div
                      className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                        }`}
                    >
                      <div className="overflow-hidden">
                        <div className="px-5 pb-4 pt-0.5 text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                          <p className="pt-2 border-t border-border/40">
                            {faq.answer}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </Section>

      {/* ── SECTION: Contact Developer ── */}
      <Section id="contact" alt>
        <div className="max-w-lg mx-auto animate-fade-up">
          <div className="text-center mb-4">
            <span className="inline-block text-xs sm:text-sm font-semibold px-3.5 py-1 rounded-full border bg-violet-500/10 text-violet-500 border-violet-500/20 shadow-sm">
              Get in Touch
            </span>
          </div>

          <div className="rounded-2xl border border-border bg-card/85 backdrop-blur-xl shadow-xl overflow-hidden p-6 md:p-8 relative">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-violet-500/10 rounded-full blur-[48px] pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-[48px] pointer-events-none" />

            <form onSubmit={handleContactSubmit} className="space-y-4 relative z-10">
              {contactError && (
                <div className="text-xs font-semibold text-rose-500 dark:text-rose-450 bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">
                  {contactError}
                </div>
              )}
              {contactSuccess && (
                <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                  {contactSuccess}
                </div>
              )}

              <div>
                <label htmlFor="contact-name" className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Name
                </label>
                <input
                  id="contact-name"
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Your Name"
                  disabled={contactSubmitting}
                  className="w-full bg-background/50 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/35 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-all"
                />
              </div>

              <div>
                <label htmlFor="contact-email" className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <input
                  id="contact-email"
                  type="email"
                  required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  disabled={contactSubmitting}
                  className="w-full bg-background/50 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/35 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-all"
                />
              </div>

              <div>
                <label htmlFor="contact-message" className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Message
                </label>
                <textarea
                  id="contact-message"
                  required
                  rows={3}
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  placeholder="How can we help you?"
                  disabled={contactSubmitting}
                  className="w-full bg-background/50 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/35 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-all resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={contactSubmitting}
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold rounded-xl py-3.5 text-center cursor-pointer shadow-lg shadow-violet-500/20 hover:from-violet-550 hover:to-indigo-550 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {contactSubmitting ? 'Sending Message...' : 'Send Message'}
              </button>
            </form>
          </div>
        </div>
      </Section>

      <div
        className="fixed z-[1] pointer-events-none select-none hidden md:flex items-center justify-center animate-fade-in"
        style={{
          top: '102px',
          left: '-20px',
          width: '320px',
          height: '280px',
          perspective: '800px',
          transformStyle: 'preserve-3d',
          transform: 'scale(0.96)',
          transformOrigin: 'top left'
        }}
      >
        <div className="mlp-detailed-3d">
          {/* 4 Layers of Nodes */}
          {[
            { name: "Input", nodes: 3, color: "#8b5cf6", shadow: "rgba(139,92,246,0.5)" },
            { name: "Hidden 1", nodes: 5, color: "#06b6d4", shadow: "rgba(6,182,212,0.5)" },
            { name: "Hidden 2", nodes: 4, color: "#ec4899", shadow: "rgba(236,72,153,0.5)" },
            { name: "Output", nodes: 3, color: "#10b981", shadow: "rgba(16,185,129,0.5)" }
          ].map((layer, layerIdx) => (
            <div
              key={layerIdx}
              className={`mlp-detailed-layer layer-idx-${layerIdx}`}
              style={{
                transform: `rotateY(-20deg) translateZ(${(layerIdx - 1.5) * 90}px)`
              }}
            >
              <div className="mlp-layer-header flex justify-between w-full px-2">
                <span className="text-[7px] text-slate-500 dark:text-muted-foreground/60 tracking-wider uppercase font-bold">{layer.name}</span>
                <span className="text-[7px] text-violet-600 dark:text-violet-400 font-mono">L{layerIdx}</span>
              </div>

              <div className="neuron-flex-container">
                {Array.from({ length: layer.nodes }).map((_, nIdx) => (
                  <div
                    key={nIdx}
                    className="neuron-node-detailed"
                    style={{
                      borderColor: layer.color,
                      boxShadow: `0 0 12px ${layer.shadow}`
                    }}
                  >
                    <span className="pulse-ring" style={{ animationDelay: `${nIdx * 0.2}s` }} />

                    {/* Connective Synapse Tracks */}
                    {layerIdx < 3 && (
                      <div className="synapse-bundle">
                        {Array.from({ length: [5, 4, 3][layerIdx] || 0 }).map((_, linkIdx) => {
                          const skewAngle = (linkIdx - (([5, 4, 3][layerIdx] - 1) / 2)) * 14;
                          return (
                            <div
                              key={linkIdx}
                              className="synapse-track"
                              style={{
                                transform: `rotateZ(${skewAngle}deg)`,
                                opacity: 0.12
                              }}
                            >
                              {/* Forward Propagation Activation (Cyan/Blue) */}
                              <span
                                className="activation-pulse"
                                style={{
                                  animationDelay: `${nIdx * 0.35 + linkIdx * 0.25 + layerIdx * 0.6}s`
                                }}
                              />
                              {/* Backward Propagation Gradient (Rose Red) */}
                              <span
                                className="backprop-pulse"
                                style={{
                                  animationDelay: `${(4 - nIdx) * 0.35 + (3 - linkIdx) * 0.25 + (3 - layerIdx) * 0.6}s`
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3D Token Cascade Background Element ── */}
      <div
        className="fixed bottom-0 z-[1] pointer-events-none select-none hidden md:flex items-center justify-center"
        style={{
          right: '-25px',
          width: '220px',
          height: '280px',
          perspective: '500px',
          transformStyle: 'preserve-3d',
        }}
      >
        <div className="cascade-3d" style={{ '--cascade-speed': '4.5s' } as React.CSSProperties}>
          {Array.from({ length: 5 }).map((_, i) => {
            const delay = (i * 0.9).toFixed(1)
            const tokenObj = SIMULATED_TOKENS[i % SIMULATED_TOKENS.length]
            const displayValue = tokenObj.val

            return (
              <div
                key={i}
                className={`cascade-tile tile-type-${tokenObj.type}`}
                style={{
                  animationDelay: `${delay}s`,
                  transformStyle: 'preserve-3d',
                }}
              >
                <span className="tile-text">{displayValue}</span>
                <div className="tile-glow"></div>
              </div>
            )
          })}
          <div className="target-compiler-line"></div>
        </div>
      </div>

      {/* ── FOOTER: Persistent Frosted Glass Footer ── */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 h-10 bg-background/20 backdrop-blur-[24px] border-t border-cyan-400/40 rounded-t-2xl shadow-[0_-4px_24px_rgba(6,182,212,0.35)] flex items-center px-6">
        <div className="w-full max-w-6xl mx-auto flex items-center justify-between relative text-[11px] text-muted-foreground">
          {/* Centered Copyright */}
          <span className="absolute left-1/2 -translate-x-1/2 font-medium tracking-wide">
            &copy; 2026 OmniKey AI. All rights reserved.
          </span>

          {/* Right-aligned GitHub repository link */}
          <div className="ml-auto flex items-center gap-1.5 z-10">
            <a
              href="https://github.com/Felix-au/OmniKey-AI-Unified-Key-Manager"
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-cyan-400 transition-colors duration-300 flex items-center gap-1.5 font-semibold hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="opacity-80 hover:opacity-100"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" /></svg>
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
