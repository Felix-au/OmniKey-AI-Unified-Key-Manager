import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import logoUrl from '../assets/logo-without-text.png'

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
@keyframes footerCyanPulse {
  0%, 100% {
    box-shadow: 0 -8px 32px rgba(6, 182, 212, 0.6), 0 -2px 10px rgba(6, 182, 212, 0.3);
    border-color: rgba(34, 211, 238, 0.7);
  }
  50% {
    box-shadow: 0 -14px 44px rgba(6, 182, 212, 0.85), 0 -4px 16px rgba(6, 182, 212, 0.45);
    border-color: rgba(34, 211, 238, 0.95);
  }
}
.animate-footer-pulse {
  animation: footerCyanPulse 3.5s infinite ease-in-out;
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

    const count = 72
    const mouse = { x: 0, y: 0, inside: false, lastActive: 0, intensity: 0 }

    const onMouse = (e: MouseEvent) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
      mouse.lastActive = Date.now()
    }
    const onEnter = () => { mouse.inside = true }
    const onLeave = () => { mouse.inside = false }

    window.addEventListener('mousemove', onMouse)
    window.addEventListener('mouseenter', onEnter)
    window.addEventListener('mouseleave', onLeave)

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Initialize 72 particles with random positions and velocities
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
      })
    }

    let helixAngle = 0

    const draw = () => {
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

      // DNA Helix center in bottom-right corner
      const helixCenterX = W - 150
      const helixCenterY = H - 150
      const avoidanceRadius = 150

      // Update and draw particles
      particles.forEach((n) => {
        // Natural Drift (Brownian drift)
        n.vx += (Math.random() - 0.5) * 0.008
        n.vy += (Math.random() - 0.5) * 0.008

        // Bottom-Right Helix Repulsion
        const dxHelix = n.x - helixCenterX
        const dyHelix = n.y - helixCenterY
        const distHelix = Math.sqrt(dxHelix * dxHelix + dyHelix * dyHelix)

        if (distHelix < avoidanceRadius && distHelix > 0) {
          const F_repulse = (1 - distHelix / avoidanceRadius) * 0.28
          const ux = dxHelix / distHelix
          const uy = dyHelix / distHelix
          n.vx += F_repulse * ux
          n.vy += F_repulse * uy
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

      // Draw particle nodes with a heavy cyan glow
      ctx.save()
      ctx.shadowBlur = 12
      ctx.shadowColor = '#06b6d4'
      ctx.fillStyle = 'rgba(6, 182, 212, 0.95)'
      particles.forEach((n) => {
        ctx.beginPath()
        ctx.arc(n.x, n.y, 3, 0, Math.PI * 2)
        ctx.fill()
      })
      ctx.restore()

      // Track mouse movement intensity transitions
      const targetIntensity = (mouse.inside && (Date.now() - mouse.lastActive < 150)) ? 1 : 0
      mouse.intensity += (targetIntensity - mouse.intensity) * 0.1

      // Draw glowing connections to mouse cursor only when moving (Cyber Cyan laser glow)
      if (mouse.intensity > 0.01) {
        ctx.save()
        ctx.shadowBlur = 12
        ctx.shadowColor = '#06b6d4'
        particles.forEach((n) => {
          const dx = n.x - mouse.x
          const dy = n.y - mouse.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < 195) {
            const intensity = (1 - dist / 195) * mouse.intensity
            const opacity = intensity * 0.8

            ctx.strokeStyle = `rgba(6, 182, 212, ${opacity})`
            ctx.lineWidth = 1.8
            ctx.beginPath()
            ctx.moveTo(n.x, n.y)
            ctx.lineTo(mouse.x, mouse.y)
            ctx.stroke()
          }
        })
        ctx.restore()
      }

      // Render 3D Rotating DNA Helix in bottom-right corner
      const helixPoints = 15
      const helixRadius = 32
      const helixSpacing = 12
      const halfLength = (helixPoints * helixSpacing) / 2

      for (let i = 0; i < helixPoints; i++) {
        const pointY = helixCenterY - halfLength + i * helixSpacing
        const angle = i * 0.35 + helixAngle

        // Strand A
        const offsetA = Math.sin(angle) * helixRadius
        const zA = Math.cos(angle) * helixRadius
        const xA = helixCenterX + offsetA
        // Strand B (180 degrees out of phase)
        const offsetB = Math.sin(angle + Math.PI) * helixRadius
        const zB = Math.cos(angle + Math.PI) * helixRadius
        const xB = helixCenterX + offsetB

        // Depth opacity/scaling
        const alphaA = 0.35 + ((zA + helixRadius) / (2 * helixRadius)) * 0.65
        const alphaB = 0.35 + ((zB + helixRadius) / (2 * helixRadius)) * 0.65
        const scaleA = 1.5 + ((zA + helixRadius) / (2 * helixRadius)) * 2.5
        const scaleB = 1.5 + ((zB + helixRadius) / (2 * helixRadius)) * 2.5

        // Connect Strand A & Strand B with rung line
        const avgZ = (zA + zB) / 2
        const alphaLine = 0.15 + ((avgZ + helixRadius) / (2 * helixRadius)) * 0.35
        ctx.strokeStyle = `rgba(6, 182, 212, ${alphaLine})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(xA, pointY)
        ctx.lineTo(xB, pointY)
        ctx.stroke()

        // Draw Strand A Node
        ctx.fillStyle = `rgba(6, 182, 212, ${alphaA})`
        ctx.beginPath()
        ctx.arc(xA, pointY, scaleA, 0, Math.PI * 2)
        ctx.fill()

        // Draw Strand B Node
        ctx.fillStyle = `rgba(6, 182, 212, ${alphaB})`
        ctx.beginPath()
        ctx.arc(xB, pointY, scaleB, 0, Math.PI * 2)
        ctx.fill()
      }

      helixAngle += 0.015
      animId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouse)
      window.removeEventListener('mouseenter', onEnter)
      window.removeEventListener('mouseleave', onLeave)
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
  const [isFadingOut, setIsFadingOut] = useState(false)

  useEffect(() => {
    let active = true
    let currentTimeout: ReturnType<typeof setTimeout> | null = null
    let currentInterval: ReturnType<typeof setInterval> | null = null

    const runTimeout = (fn: () => void, delay: number) => {
      if (!active) return
      currentTimeout = setTimeout(fn, delay)
    }

    const typeText = (text: string, onComplete: () => void) => {
      let index = 0
      setInputText('')
      currentInterval = setInterval(() => {
        if (!active) {
          clearInterval(currentInterval!)
          return
        }
        index++
        if (index <= text.length) {
          setInputText(text.slice(0, index))
        } else {
          clearInterval(currentInterval!)
          onComplete()
        }
      }, 45) // typing speed: 45ms per character
    }

    const loop = () => {
      if (!active) return
      setIsFadingOut(false)
      setVisible(0)
      setInputText('')
      setTyping(false)

      runTimeout(() => {
        // Step 1: User types Question 1
        typeText(mockChat[0].text, () => {
          runTimeout(() => {
            setVisible(1)
            setInputText('')

            runTimeout(() => {
              // Step 2: Assistant types Response 1
              setTyping(true)
              runTimeout(() => {
                setTyping(false)
                setVisible(2)

                runTimeout(() => {
                  // Step 3: User types Question 2
                  typeText(mockChat[2].text, () => {
                    runTimeout(() => {
                      setVisible(3)
                      setInputText('')

                      runTimeout(() => {
                        // Step 4: Assistant types Response 2
                        setTyping(true)
                        runTimeout(() => {
                          setTyping(false)
                          setVisible(4)

                          runTimeout(() => {
                            // Step 5: User types Question 3
                            typeText(mockChat[4].text, () => {
                              runTimeout(() => {
                                setVisible(5)
                                setInputText('')

                                runTimeout(() => {
                                  // Step 6: Assistant types Response 3
                                  setTyping(true)
                                  runTimeout(() => {
                                    setTyping(false)
                                    setVisible(6)

                                    // Step 7: Hold state before resetting cycle
                                    runTimeout(() => {
                                      setIsFadingOut(true)
                                      runTimeout(loop, 500)
                                    }, 9000)
                                  }, 2400)
                                }, 800)
                              }, 400)
                            })
                          }, 1500)
                        }, 2200)
                      }, 800)
                    }, 400)
                  })
                }, 1500)
              }, 2200)
            }, 800)
          }, 400)
        })
      }, 1000)
    }

    loop()

    return () => {
      active = false
      if (currentTimeout) clearTimeout(currentTimeout)
      if (currentInterval) clearInterval(currentInterval)
    }
  }, [])

  return { visible, typing, inputText, isFadingOut }
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
  const [selectingIndex, setSelectingIndex] = useState<number | null>(null)
  const [sendReady, setSendReady] = useState(false)
  const [sendClicked, setSendClicked] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [visiblePanels, setVisiblePanels] = useState(0)
  const [isFadingOut, setIsFadingOut] = useState(false)

  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let active = false
    let currentTimeout: ReturnType<typeof setTimeout> | null = null
    let currentInterval: ReturnType<typeof setInterval> | null = null

    const runTimeout = (fn: () => void, delay: number) => {
      if (!active) return
      currentTimeout = setTimeout(fn, delay)
    }

    const typePrompt = (text: string, onComplete: () => void) => {
      let index = 0
      setPrompt('')
      setPromptActive(true)
      currentInterval = setInterval(() => {
        if (!active) {
          clearInterval(currentInterval!)
          return
        }
        index++
        if (index <= text.length) {
          setPrompt(text.slice(0, index))
        } else {
          clearInterval(currentInterval!)
          setPromptActive(false)
          onComplete()
        }
      }, 40)
    }

    const loop = () => {
      if (!active) return
      setIsFadingOut(false)
      setPrompt('')
      setPromptActive(false)
      setModels(['', '', '', ''])
      setSelectingIndex(null)
      setSendReady(false)
      setSendClicked(false)
      setIsLoading(false)
      setVisiblePanels(0)

      runTimeout(() => {
        // Type prompt
        typePrompt("Explain quantum entanglement simply.", () => {
          runTimeout(() => {
            // Select Model 1
            setSelectingIndex(0)
            runTimeout(() => {
              setSelectingIndex(null)
              setModels(['gemini-2.5-flash', '', '', ''])

              runTimeout(() => {
                // Select Model 2
                setSelectingIndex(1)
                runTimeout(() => {
                  setSelectingIndex(null)
                  setModels(['gemini-2.5-flash', 'llama-3.3-70b', '', ''])

                  runTimeout(() => {
                    // Select Model 3
                    setSelectingIndex(2)
                    runTimeout(() => {
                      setSelectingIndex(null)
                      setModels(['gemini-2.5-flash', 'llama-3.3-70b', 'mistral-large', ''])

                      runTimeout(() => {
                        // Select Model 4
                        setSelectingIndex(3)
                        runTimeout(() => {
                          setSelectingIndex(null)
                          setModels(['gemini-2.5-flash', 'llama-3.3-70b', 'mistral-large', 'qwen-2.5-72b'])

                          runTimeout(() => {
                            // Phase 4: Show Send Button & Click
                            setSendReady(true)
                            runTimeout(() => {
                              setSendClicked(true)
                              runTimeout(() => {
                                setSendClicked(false)
                                setSendReady(false)
                                setIsLoading(true)

                                runTimeout(() => {
                                  // Phase 5: Staggered response reveals
                                  setVisiblePanels(1)
                                  runTimeout(() => {
                                    setVisiblePanels(2)
                                    runTimeout(() => {
                                      setVisiblePanels(3)
                                      runTimeout(() => {
                                        setVisiblePanels(4)
                                        setIsLoading(false)

                                        // Phase 6: Hold state before resetting cycle
                                        runTimeout(() => {
                                          setIsFadingOut(true)
                                          runTimeout(loop, 500)
                                        }, 2500)
                                      }, 800)
                                    }, 700)
                                  }, 600)
                                }, 600)
                              }, 300)
                            }, 800)
                          }, 600)
                        }, 500)
                      }, 250)
                    }, 500)
                  }, 250)
                }, 500)
              }, 250)
            }, 500)
          }, 600)
        })
      }, 1000)
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        if (!active) {
          active = true
          loop()
        }
      } else {
        active = false
        if (currentTimeout) clearTimeout(currentTimeout)
        if (currentInterval) clearInterval(currentInterval)
        // Reset states on out of focus
        setPrompt('')
        setPromptActive(false)
        setModels(['', '', '', ''])
        setSelectingIndex(null)
        setSendReady(false)
        setSendClicked(false)
        setIsLoading(false)
        setVisiblePanels(0)
        setIsFadingOut(false)
      }
    }, { threshold: 0.15 })

    observer.observe(el)

    return () => {
      active = false
      observer.disconnect()
      if (currentTimeout) clearTimeout(currentTimeout)
      if (currentInterval) clearInterval(currentInterval)
    }
  }, [])

  return { prompt, promptActive, models, selectingIndex, sendReady, sendClicked, isLoading, visiblePanels, containerRef, isFadingOut }
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
const debateConfigFields = ['opening', 'rounds', 'judging', 'infavor', 'against', 'judge'] as const
type DebateField = typeof debateConfigFields[number]

function useDebateArenaSimulation() {
  const [activeField, setActiveField] = useState<DebateField | 'topic' | 'startBtn' | null>(null)
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

  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let active = false
    let currentTimeout: ReturnType<typeof setTimeout> | null = null
    let currentInterval: ReturnType<typeof setInterval> | null = null

    const runTimeout = (fn: () => void, delay: number) => {
      if (!active) return
      currentTimeout = setTimeout(fn, delay)
    }

    const typeText = (text: string, onComplete: () => void) => {
      let index = 0
      setTopicText('')
      currentInterval = setInterval(() => {
        if (!active) {
          clearInterval(currentInterval!)
          return
        }
        index++
        if (index <= text.length) {
          setTopicText(text.slice(0, index))
        } else {
          clearInterval(currentInterval!)
          onComplete()
        }
      }, 40) // typing speed: 40ms per char
    }

    const loop = () => {
      if (!active) return
      
      // Reset all states
      setIsFadingOut(false)
      setStage('config')
      setActiveField(null)
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

      runTimeout(() => {
        // Step 1: Type Topic
        setActiveField('topic')
        typeText("Should AI replace human creativity?", () => {
          setActiveField(null)
          
          runTimeout(() => {
            // Step 2: Select Opening Player
            setActiveField('opening')
            runTimeout(() => {
              setOpeningPlayer('In Favor')
              setActiveField(null)

              runTimeout(() => {
                // Step 3: Change Rounds (3 -> 4)
                setActiveField('rounds')
                runTimeout(() => {
                  setRounds(4)
                  runTimeout(() => {
                    // Step 3b: Change Rounds (4 -> 5)
                    setRounds(5)
                    setActiveField(null)

                    runTimeout(() => {
                      // Step 4: Change Judging
                      setActiveField('judging')
                      runTimeout(() => {
                        setJudging('Every Round')
                        setActiveField(null)

                        runTimeout(() => {
                          // Step 5: Select In Favor model (deliberation: Auto -> claude-3-5-sonnet -> deepseek-r1 -> gemini-2.5-flash)
                          setActiveField('infavor')
                          runTimeout(() => {
                            setInfavor('claude-3-5-sonnet')
                            runTimeout(() => {
                              setInfavor('deepseek-r1')
                              runTimeout(() => {
                                setInfavor('gemini-2.5-flash')
                                setActiveField(null)

                                runTimeout(() => {
                                  // Step 6: Select Against model (deliberation: Auto -> gpt-4o-mini -> mistral-large -> llama-3.3-70b)
                                  setActiveField('against')
                                  runTimeout(() => {
                                    setAgainst('gpt-4o-mini')
                                    runTimeout(() => {
                                      setAgainst('mistral-large')
                                      runTimeout(() => {
                                        setAgainst('llama-3.3-70b')
                                        setActiveField(null)

                                        runTimeout(() => {
                                          // Step 7: Select Judge model (deliberation: Auto -> gemini-2.0-flash -> llama-3.3-70b -> gpt-4o-mini)
                                          setActiveField('judge')
                                          runTimeout(() => {
                                            setJudge('gemini-2.0-flash')
                                            runTimeout(() => {
                                              setJudge('llama-3.3-70b')
                                              runTimeout(() => {
                                                setJudge('gpt-4o-mini')
                                                setActiveField(null)

                                                runTimeout(() => {
                                                  // Step 8: Click Start Button
                                                  setActiveField('startBtn')
                                                  runTimeout(() => {
                                                    setIsStartClicked(true)
                                                    runTimeout(() => {
                                                      setIsStartClicked(false)
                                                      setActiveField(null)
                                                      setStage('debating')
                                                      
                                                      // Start the debate transcript choreography
                                                      runDebate()
                                                    }, 400)
                                                  }, 800)
                                                }, 600)
                                              }, 400)
                                            }, 400)
                                          }, 850)
                                        }, 600)
                                      }, 400)
                                    }, 400)
                                  }, 850)
                                }, 600)
                              }, 400)
                            }, 400)
                          }, 850)
                        }, 600)
                      }, 800)
                    }, 600)
                  }, 800)
                }, 800)
              }, 600)
            }, 800)
          }, 600)
        })
      }, 1000)
    }

    const runDebate = () => {
      // We have 15 messages (5 rounds * 3 messages per round).
      // We will show typing dots, then reveal the message, then wait, then repeat.
      let currentMsgIndex = 0

      const nextMessage = () => {
        if (!active) return
        if (currentMsgIndex >= 15) {
          // Finished the debate! Wait, fade out, then loop.
          runTimeout(() => {
            setIsFadingOut(true)
            runTimeout(loop, 600)
          }, 3000) // Let the user read the final verdict for 3 seconds
          return
        }

        // Show typing indicator
        setIsTyping(true)
        runTimeout(() => {
          setIsTyping(false)
          setVisibleCount(currentMsgIndex + 1)
          currentMsgIndex++
          // Wait a short delay before starting the next turn
          runTimeout(nextMessage, 1500)
        }, 1800) // Simulate typing for 1.8 seconds
      }

      nextMessage()
    }

    // IntersectionObserver to only play animation when section is in view
    const el = containerRef.current
    if (!el) {
      // Fallback if ref is not ready
      loop()
      return () => {
        active = false
        if (currentTimeout) clearTimeout(currentTimeout)
        if (currentInterval) clearInterval(currentInterval)
      }
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        if (!active) {
          active = true
          loop()
        }
      } else {
        active = false
        if (currentTimeout) clearTimeout(currentTimeout)
        if (currentInterval) clearInterval(currentInterval)
        // Reset states
        setActiveField(null)
        setTopicText('')
        setOpeningPlayer('Auto')
        setRounds(3)
        setJudging('At the End')
        setInfavor('Auto')
        setAgainst('Auto')
        setJudge('Auto')
        setIsStartClicked(false)
        setStage('config')
        setVisibleCount(0)
        setIsTyping(false)
        setIsFadingOut(false)
      }
    }, { threshold: 0.15 })

    observer.observe(el)

    return () => {
      active = false
      observer.disconnect()
      if (currentTimeout) clearTimeout(currentTimeout)
      if (currentInterval) clearInterval(currentInterval)
    }
  }, [])

  return {
    activeField,
    topicText,
    openingPlayer,
    rounds,
    judging,
    infavor,
    against,
    judge,
    isStartClicked,
    stage,
    visibleCount,
    isTyping,
    isFadingOut,
    containerRef
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
  { role: 'judge', label: '⚖ Judge · gpt-4o-mini · Round 1', text: `Score Card (Round 1):

In Favor Model: 6/10
Against Model: 7/10
Round Critique: In Favor points out collaborative potential, while Against emphasizes emotional authenticity. Slight edge to Against for distinguishing agency from iteration.` },
  // Round 2
  { role: 'infavor', label: 'In Favor · gemini-2.5-flash · Round 2', text: 'AI tools democratize expression, allowing people without formal training or technical illustration skills to manifest and communicate complex artistic visions.' },
  { role: 'against', label: 'Against · llama-3.3-70b · Round 2', text: 'Democratization shouldn\'t mean flooding the world with derivative, low-effort content. It risks diluting the value of dedication, craftsmanship, and years of skill.' },
  { role: 'judge', label: '⚖ Judge · gpt-4o-mini · Round 2', text: `Score Card (Round 2):

In Favor Model: 8/10
Against Model: 8/10
Round Critique: A balanced round. In Favor scores highly on accessibility and inclusion, but Against correctly warns of market dilution. This round is a draw.` },
  // Round 3
  { role: 'infavor', label: 'In Favor · gemini-2.5-flash · Round 3', text: 'Generative models accelerate iteration, enabling creators to rapidly test and prototype concepts in seconds rather than spending weeks on basic drafts.' },
  { role: 'against', label: 'Against · llama-3.3-70b · Round 3', text: 'Accelerating iteration bypasses the critical process of deep reflection. "Happy accidents" occur during slow, deliberate craftsmanship, not instant generations.' },
  { role: 'judge', label: '⚖ Judge · gpt-4o-mini · Round 3', text: `Score Card (Round 3):

In Favor Model: 8/10
Against Model: 7/10
Round Critique: In Favor highlights real-world industrial utility, whereas Against argues for the cognitive value of time. Slight edge to In Favor for practical feasibility.` },
  // Round 4
  { role: 'infavor', label: 'In Favor · gemini-2.5-flash · Round 4', text: 'By scanning historical art styles, AI can identify unexplored aesthetic gaps, enabling human artists to deliberately explore fresh stylistic frontiers.' },
  { role: 'against', label: 'Against · llama-3.3-70b · Round 4', text: 'Finding stylistic gaps via analysis is a formulaic approach, not an artistic one. Art is an expression of conscious emotion reflecting a moment in time.' },
  { role: 'judge', label: '⚖ Judge · gpt-4o-mini · Round 4', text: `Score Card (Round 4):

In Favor Model: 7/10
Against Model: 8/10
Round Critique: Against presents a strong philosophical argument against analytical creativity, though In Favor has solid utility. Score remains extremely tight.` },
  // Round 5
  { role: 'infavor', label: 'In Favor · gemini-2.5-flash · Round 5', text: 'Ultimately, AI is another tool in the artist\'s toolkit, analogous to the camera or synthesizer which faced similar resistance when first introduced.' },
  { role: 'against', label: 'Against · llama-3.3-70b · Round 5', text: 'A camera doesn\'t decide what is beautiful, and a synthesizer doesn\'t write lyrics. AI is the first tool that actively seeks to replace the creative agent.' },
  { role: 'judge', label: '⚖ Judge · gpt-4o-mini · Round 5', text: `Final Arena Verdict:

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

const faqData = [
  {
    question: "Why use OmniKey AI?",
    answer: "OmniKey AI is a high-performance AI proxy gateway that consolidates multiple model providers and developer API credentials under a single OpenAI-compatible interface. By acting as a unified middleware layer, it simplifies application development, secures API keys, handles dynamic fallback routing, and aggregates usage stats in real-time, eliminating vendor lock-in and avoiding runtime interruptions.",
    tag: "general"
  },
  {
    question: "How does fallback routing work?",
    answer: "When a primary model provider or endpoint experiences downtime, latency spikes, or rate limits, the routing layer automatically detects the failure. It silently redirects the request to the next best alternative provider in under 15 milliseconds, ensuring continuous availability for your end users.",
    tag: "general"
  },
  {
    question: "How is API key failover managed?",
    answer: "OmniKey AI pools multiple developer keys and tracks the rate limit status of different models internally in real-time. When a key hits a quota ceiling or triggers a rate limit (such as HTTP 429), requests are seamlessly and instantly routed to the next available key or standby provider in the chain to avoid user-facing errors.",
    tag: "general"
  },
  {
    question: "Is the API proxy gateway compatible with standard OpenAI and Gemini SDKs?",
    answer: "Yes. OmniKey AI is built to be a drop-in replacement. You can point your existing OpenAI or Google Gen AI client SDKs directly to our proxy base URLs. Simply update the baseURL (for OpenAI) or baseUrl (for Google Gen AI) and swap your key for your unified OmniKey token.",
    tag: "api"
  },
  {
    question: "What models are supported by the gateway?",
    answer: "We support over 60+ models from industry-leading providers, including Google Gemini (Flash, Pro), Meta Llama (via Groq, Cerebras, SambaNova), Mistral Large, Qwen, and DeepSeek. You can target specific models or use the 'auto' model to route dynamically to the most cost-efficient or lowest-latency provider.",
    tag: "api"
  },
  {
    question: "How does the gateway secure my developer credentials?",
    answer: "Security is a top priority. Upstream provider keys (such as your personal Google AI Studio or Groq keys) are encrypted using industry-standard symmetric AES-256-GCM encryption before database persistence. They are decrypted in-memory only during routing execution, ensuring your credentials remain completely private.",
    tag: "security"
  },
  {
    question: "Does the proxy gateway support streaming completions?",
    answer: "Yes. Streaming is fully supported via Server-Sent Events (SSE) for both OpenAI-compatible and Gemini-compatible formats. When you set the stream parameter to true, token chunks are forwarded to your client application as they are generated with minimal overhead.",
    tag: "api"
  },
  {
    question: "Do I need to change my code to use OmniKey AI?",
    answer: "Minimal changes are required. Since OmniKey AI exposes an OpenAI-compatible web API, you only need to redirect your API requests by changing the base URL/endpoint in your SDK configuration to your hosted proxy server address (available under the Keys or Dev Corner sections of the dashboard) and replace your API key with your unified OmniKey token. All request payloads, headers, and schemas remain exactly the same.",
    tag: "api"
  },
  {
    question: "What is the 'auto' model in OmniKey AI?",
    answer: "The 'auto' model is a dynamic placeholder model. When targeted, OmniKey's router automatically selects the highest-priority online model in your configured fallback chain. This allows your client application to function continuously even if specific vendor models are rate-limited or disabled.",
    tag: "api"
  },
  {
    question: "Do my API requests get logged on the server?",
    answer: "By default, requests are routed statelessly. However, if audit logging is enabled in the Admin Console, the server maintains recent audit records (latency, token count, and timestamps) for usage statistics. These logs do not contain raw prompt payloads and can be flushed instantly by the administrator.",
    tag: "security"
  }
]

// ── Landing Page ──────────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate()
  const { dark, toggle } = useDark()
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [activeCategory, setActiveCategory] = useState<'general' | 'api' | 'security'>('general')
  const chat = useAnimatedChat()
  const routingPhase = useAnimatedRouting()
  const arena = useArenaAnimation()
  const fallbackOrder = useFallbackOrder()
  const debateSim = useDebateArenaSimulation()
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight
    }
  }, [debateSim.visibleCount, debateSim.isTyping])
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
      <header className={`sticky top-0 z-50 transition-all duration-300 bg-background/10 backdrop-blur-[24px] border-b border-cyan-400/30 shadow-[0_4px_20px_rgba(6,182,212,0.25)] rounded-b-2xl ${scrolled ? 'h-12' : 'h-20'}`}>
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between relative h-full transition-all duration-300">
          <div className="flex items-center gap-2 shrink-0">
            <span className={`font-bold tracking-tight transition-all duration-300 ${scrolled ? 'text-sm' : 'text-xl text-foreground'}`}>OmniKey AI</span>
          </div>
          <div className="flex items-center gap-6 ml-auto">
            <nav className={`hidden md:flex items-center justify-end text-muted-foreground transition-all duration-300 ${scrolled ? 'gap-5 text-sm' : 'gap-7 text-[15px]'}`}>
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
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                Contact
              </a>
            </nav>
            <div className="flex items-center gap-3">
              <button onClick={toggle} title="Toggle theme" className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer">
                {dark ? <SunIcon /> : <MoonIcon />}
              </button>
              <button
                onClick={() => navigate('/keys')}
                className="cta-btn bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold px-5 py-2.5 rounded-2xl shadow-md shadow-violet-500/20 transition-all duration-300 cursor-pointer"
              >
                Get Started →
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section ref={heroRef} className="relative pt-2 pb-28 px-6 text-center">
        {promoStatus?.isActive ? (
          <div
            onClick={() => navigate('/keys')}
            className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-6 cursor-pointer transition-all duration-300 transform hover:scale-[1.02]"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-450 opacity-75 animate-duration-1000"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Launch Offer: Get 10M tokens free!</span>
          </div>
        ) : (
          <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-500 mb-6">
            ⚡ 12 Free LLM Providers. Zero Lock-in.
          </span>
        )}
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
          One Key.<br />
          <span className="bg-gradient-to-r from-violet-500 to-indigo-500 bg-clip-text text-transparent">Every Model.</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
          OmniKey AI routes your requests across Gemini, Groq, Mistral, NVIDIA, Cerebras and more — with automatic fallbacks to ensure 100% uptime.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <button
            onClick={() => navigate('/keys')}
            className="cta-btn bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold px-8 py-3.5 rounded-2xl text-base shadow-lg shadow-violet-500/20"
          >
            Get Started →
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border/60 rounded-2xl border border-border/80 bg-card/60 backdrop-blur overflow-hidden">
          {[
            { ref: stat1.ref, val: `${stat1.val.toLocaleString()}+`, label: 'Models Available' },
            { ref: stat4.ref, val: `${stat4.val.toFixed(2)}${requestsUnit}`, label: 'Requests Processed' },
            { ref: stat5.ref, val: `${stat5.val.toFixed(2)}${tokensUnit}`, label: 'Tokens Channeled' },
            { ref: stat6.ref, val: `${stat6.val.toFixed(2)}${successUnit}`, label: 'Routing Success Rate' }
          ].map(({ ref, val, label }) => (
            <div key={label} ref={ref} className="py-6 text-center stat-animate bg-card/40 dark:bg-slate-900/40 backdrop-blur-md">
              <div className="text-3xl font-extrabold text-foreground stat-num">{val}</div>
              <div className="text-xs text-muted-foreground mt-1 px-2">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── SECTION: Chat Playground ── */}
      {/* ── SECTION: Smart Routing ── */}
      <Section id="routing" alt>
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

      {/* ── SECTION: Chat Playground ── */}
      <Section id="features">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <Pill label="Chat Playground" color="green" />
            <SectionHeading>Test Any Model Instantly</SectionHeading>
            <SectionSub>Switch between OpenAI and Gemini formats. Pick any model, type your prompt, and see real AI responses with live latency and token metrics.</SectionSub>
          </div>
          <MockCard>
            <div className={`transition-opacity duration-500 ${chat.isFadingOut ? 'opacity-0' : 'opacity-100'}`}>
              <div className="bg-muted/40 dark:bg-white/5 px-4 py-3 border-b border-border flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">gemini-2.5-flash</span>
                <span className="text-[10px] bg-violet-500/10 text-violet-500 border border-violet-500/20 rounded-full px-2 py-0.5 font-semibold">OmniKey AI</span>
              </div>
              <div className="p-4 space-y-3 h-[340px] flex flex-col justify-end overflow-hidden">
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
                <div className={`rounded-xl px-3 py-2 flex items-center text-white text-xs font-semibold transition-colors duration-300 ${chat.inputText ? 'bg-violet-600 shadow-md shadow-violet-500/20' : 'bg-muted-foreground/20 text-muted-foreground/60'}`}>
                  Send
                </div>
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
                      {arena.promptActive && <span className="w-1 h-3.5 bg-blue-500 ml-0.5 animate-pulse inline-block" />}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/45 italic font-normal">Awaiting prompt...</span>
                  )}
                </div>
                <div className={`shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-bold border transition-all duration-300 ${
                  arena.sendClicked
                    ? 'bg-blue-700 text-white border-blue-600 scale-95 shadow-none'
                    : arena.sendReady
                      ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20 scale-100'
                      : 'bg-muted-foreground/10 text-muted-foreground/40 border-border/40 scale-100'
                }`}>
                  Send
                </div>
              </div>
              {/* Model selectors row */}
              <div className="grid grid-cols-4 divide-x divide-border border-b border-border">
                {arena.models.map((m, i) => {
                  const colors = ['text-blue-400', 'text-orange-400', 'text-purple-400', 'text-emerald-400']
                  const isSelecting = arena.selectingIndex === i
                  return (
                    <div key={i} className={`px-2 py-2 text-[10px] font-semibold flex items-center justify-center min-h-[33px] gap-1 ${colors[i]} ${isSelecting ? 'bg-violet-500/10' : ''} transition-colors duration-300`}>
                      {isSelecting ? (
                        <span className="flex gap-0.5"><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></span>
                      ) : m ? (
                        <span className="model-tag truncate animate-drop-in">{m}</span>
                      ) : (
                        <span className="text-muted-foreground/30 font-normal italic">—</span>
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
        <div className="text-center mb-10">
          <Pill label="⚔ Debate Arena" color="rose" />
          <SectionHeading>Watch Two AIs Argue It Out</SectionHeading>
          <p className="text-muted-foreground max-w-xl mx-auto">Pick a topic, assign In Favor and Against models, set the number of rounds, and let a Judge model moderate the entire debate.</p>
        </div>
        <MockCard>
          <div ref={debateSim.containerRef} className="grid md:grid-cols-[280px_1fr]">
            <div className="border-r border-border p-5 space-y-4 bg-muted/20 dark:bg-white/[0.02] relative">
              {/* Animated cursor ball */}
              <div className={`absolute top-2 right-2 w-3 h-3 rounded-full border-2 border-border shadow transition-all duration-500 ${debateSim.activeField ? 'bg-foreground scale-110 opacity-100' : 'bg-muted opacity-40 scale-75'
                }`} />
              <div className="space-y-1">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Topic</div>
                <div className={`text-xs bg-background border rounded-xl px-3 py-2 text-foreground transition-all duration-300 min-h-[34px] flex items-center ${
                  debateSim.activeField === 'topic' ? 'border-violet-500 ring-1 ring-violet-500/30' : 'border-border'
                }`}>
                  {debateSim.topicText ? (
                    <span className="flex items-center truncate">
                      <span>{debateSim.topicText}</span>
                      {debateSim.activeField === 'topic' && <span className="w-1.5 h-3.5 bg-violet-500 ml-0.5 animate-pulse inline-block" />}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/35 italic font-normal">Awaiting topic input...</span>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Opening Player</div>
                <div className={`text-xs bg-background border rounded-xl px-3 py-2 text-foreground flex justify-between transition-all duration-300 ${
                  debateSim.activeField === 'opening' ? 'border-violet-500 ring-1 ring-violet-500/30' : 'border-border'
                }`}>
                  <span>{debateSim.openingPlayer}</span>
                  <span className="text-muted-foreground">▾</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Rounds</div>
                  <div className={`text-xs bg-background border rounded-xl px-3 py-2 text-foreground transition-all duration-300 ${
                    debateSim.activeField === 'rounds' ? 'border-violet-500 ring-1 ring-violet-500/30' : 'border-border'
                  }`}>{debateSim.rounds}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Judging</div>
                  <div className={`text-xs bg-background border rounded-xl px-3 py-2 text-foreground flex justify-between transition-all duration-300 ${
                    debateSim.activeField === 'judging' ? 'border-violet-500 ring-1 ring-violet-500/30' : 'border-border'
                  }`}>
                    <span>{debateSim.judging}</span>
                    <span className="text-muted-foreground">▾</span>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider flex gap-1 items-center"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />In Favor</div>
                <div className={`text-xs bg-background border rounded-xl px-3 py-2 text-foreground flex justify-between transition-all duration-300 ${
                  debateSim.activeField === 'infavor' ? 'border-violet-500 ring-1 ring-violet-500/30' : 'border-border'
                }`}>
                  <span className="truncate">{debateSim.infavor}</span>
                  <span className="text-muted-foreground ml-1">▾</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-semibold text-rose-500 uppercase tracking-wider flex gap-1 items-center"><span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />Against</div>
                <div className={`text-xs bg-background border rounded-xl px-3 py-2 text-foreground flex justify-between transition-all duration-300 ${
                  debateSim.activeField === 'against' ? 'border-violet-500 ring-1 ring-violet-500/30' : 'border-border'
                }`}>
                  <span className="truncate">{debateSim.against}</span>
                  <span className="text-muted-foreground ml-1">▾</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider flex gap-1 items-center"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />Judge</div>
                <div className={`text-xs bg-background border rounded-xl px-3 py-2 text-foreground flex justify-between transition-all duration-300 ${
                  debateSim.activeField === 'judge' ? 'border-violet-500 ring-1 ring-violet-500/30' : 'border-border'
                }`}>
                  <span className="truncate">{debateSim.judge}</span>
                  <span className="text-muted-foreground ml-1">▾</span>
                </div>
              </div>
              <button
                className={`w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-semibold rounded-xl px-4 py-2.5 text-center cursor-default transition-all duration-300 ${
                  debateSim.activeField === 'startBtn' ? 'ring-2 ring-violet-500 ring-offset-2 dark:ring-offset-slate-900 scale-102 shadow-lg shadow-violet-500/30' : ''
                } ${
                  debateSim.isStartClicked ? 'scale-95 brightness-90 shadow-none' : ''
                }`}
              >
                Start Debate Arena
              </button>
            </div>
            {/* Transcript */}
            <div className={`p-5 flex flex-col h-[480px] transition-opacity duration-500 ${debateSim.isFadingOut ? 'opacity-0' : 'opacity-100'}`}>
              {debateSim.stage === 'config' ? (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/45 border-2 border-dashed border-border/60 rounded-2xl p-6 bg-muted/5">
                  <span className="text-3xl mb-3">⚔</span>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1">Debate Arena Offline</p>
                  <p className="text-[11px] text-center max-w-[200px] leading-relaxed">Configure the parameters in the sidebar and press start to begin the simulation.</p>
                </div>
              ) : (
                <>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 shrink-0 flex items-center justify-between">
                    <span>Round {Math.min(5, Math.floor(debateSim.visibleCount / 3) + 1)} of 5</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-indicator-pulse inline-block" />
                  </div>
                  <div ref={transcriptScrollRef} className="flex-1 overflow-y-auto no-scrollbar pr-1 space-y-3 scroll-smooth">
                    {debateMsgs.map((m, i) => i < debateSim.visibleCount ? (
                      <div key={i} className={`rounded-xl border px-4 py-3 text-xs leading-relaxed animate-fade-up ${
                        m.role === 'infavor' ? 'border-emerald-500/30 bg-emerald-500/5' :
                        m.role === 'against' ? 'border-rose-500/30 bg-rose-500/5' :
                        'border-amber-500/30 bg-amber-500/5'
                      }`}>
                        <div className={`text-[10px] font-semibold mb-1 ${
                          m.role === 'infavor' ? 'text-emerald-500' :
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
          <div className="text-center mb-8">
            <Pill label="FAQ" color="violet" />
            <SectionHeading>Frequently Asked Questions</SectionHeading>
          </div>

          {/* FAQ Category Tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-10 max-w-xl mx-auto animate-fade-up">
            {(['general', 'api', 'security'] as const).map(cat => {
              const isActive = activeCategory === cat;
              const labels = {
                general: 'General Info',
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
                      className="w-full text-left p-5 flex items-center justify-between gap-4 font-bold text-foreground cursor-pointer select-none"
                    >
                      <span className="flex items-center gap-3 text-sm sm:text-base">
                        <span className={`text-xs transition-all duration-350 transform ${isOpen ? 'text-violet-500 rotate-90 scale-125' : 'text-slate-400 rotate-0 scale-100 group-hover:text-violet-400 group-hover:rotate-45'}`}>✦</span>
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
                        <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                          <p className="pt-3 border-t border-border/40">
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
          <div className="text-center mb-6">
            <Pill label="Contact" color="violet" />
            <SectionHeading>Contact Developer</SectionHeading>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
              Submit a request to developers or report an issue in the workspace.
            </p>
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

      {/* ── FOOTER: Persistent Frosted Glass Footer ── */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 h-10 bg-background/20 backdrop-blur-[24px] border-t-[1.5px] border-cyan-400/70 rounded-t-2xl shadow-[0_-8px_32px_rgba(6,182,212,0.6),_0_-2px_10px_rgba(6,182,212,0.3)] flex items-center px-6 animate-footer-pulse">
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
