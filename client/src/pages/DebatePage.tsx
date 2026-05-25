import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

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

interface DebateMessage {
  id: string
  role: 'infavor' | 'against' | 'judge'
  model: string
  modelDisplayName: string
  content: string
  round: number
  latency?: number
  keyUsed?: string
}

export default function DebatePage() {
  const [topic, setTopic] = useState('Should remote work remain a permanent standard for global knowledge industries?')
  const [infavorModel, setInfavorModel] = useState('auto')
  const [againstModel, setAgainstModel] = useState('auto')
  const [judgeModel, setJudgeModel] = useState('auto')
  const [rounds, setRounds] = useState(3)
  const [opens, setOpens] = useState<'infavor' | 'against'>('infavor')
  const [judgingInterval, setJudgingInterval] = useState<'every_round' | 'at_end'>('at_end')

  // Run state
  const [messages, setMessages] = useState<DebateMessage[]>([])
  const [isDebating, setIsDebating] = useState(false)
  const [currentStage, setCurrentStage] = useState<'idle' | 'infavor_thinking' | 'against_thinking' | 'judge_thinking' | 'finished'>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [currentRound, setCurrentRound] = useState(1)

  const abortRef = useRef(false)
  const feedEndRef = useRef<HTMLDivElement>(null)

  const { data: keyData } = useQuery<{ apiKey: string; geminiApiKey: string }>({
    queryKey: ['unified-key'],
    queryFn: () => apiFetch('/api/settings/api-key'),
  })

  const { data: fallbackEntries = [] } = useQuery<FallbackEntry[]>({
    queryKey: ['fallback'],
    queryFn: () => apiFetch('/api/fallback'),
  })

  const availableModels = fallbackEntries.filter(e => e.keyCount > 0 && e.enabled)

  // Scroll to bottom whenever messages or stage changes
  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentStage])

  // Cleanup debate on unmount
  useEffect(() => {
    return () => {
      abortRef.current = true
    }
  }, [])

  const getModelDisplayName = (modelId: string) => {
    if (modelId === 'auto') return 'Auto (Smart Routing)'
    return availableModels.find(m => m.modelId === modelId)?.displayName ?? modelId
  }

  const handleStartDebate = async () => {
    if (isDebating) return
    setIsDebating(true)
    setMessages([])
    abortRef.current = false
    
    const base = (import.meta.env.VITE_API_URL || import.meta.env.BASE_URL).replace(/\/$/, '')
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (keyData?.apiKey) headers['Authorization'] = `Bearer ${keyData.apiKey}`

    // Orchestrator loop helper for generating completion
    const generateTurn = async (
      modelId: string,
      role: 'infavor' | 'against' | 'judge',
      apiMessages: { role: string; content: string }[],
      roundNum: number
    ): Promise<DebateMessage | null> => {
      const start = Date.now()

      // Sanitize messages to enforce alternating roles and end with a 'user' role
      const systemMsg = apiMessages.find(m => m.role === 'system')
      const chatMsgs = apiMessages.filter(m => m.role !== 'system' && !m.content.startsWith('Error:'))
      
      const sanitized: { role: string; content: string }[] = []
      if (systemMsg) sanitized.push(systemMsg)
      
      for (const msg of chatMsgs) {
        const last = sanitized[sanitized.length - 1]
        // Merge consecutive identical roles
        if (last && last.role !== 'system' && last.role === msg.role) {
          last.content += `\n\n${msg.content}`
        } else {
          sanitized.push({ role: msg.role, content: msg.content })
        }
      }

      // Ensure there is at least one 'user' message
      if (sanitized.filter(m => m.role === 'user').length === 0) {
        sanitized.push({ role: 'user', content: 'Begin the debate.' })
      }

      // Ensure final message role is 'user'
      const finalMsg = sanitized[sanitized.length - 1]
      if (finalMsg && finalMsg.role === 'assistant') {
        sanitized.push({ role: 'user', content: 'Formulate your next response.' })
      }

      const body: any = {
        messages: sanitized,
      }
      if (modelId !== 'auto') body.model = modelId

      try {
        const res = await fetch(`${base}/v1/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        })

        const latency = Date.now() - start
        const keyUsed = res.headers.get('X-Key-Used') || undefined

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }))
          throw new Error(err.error?.message ?? `HTTP ${res.status}`)
        }

        const data = await res.json()
        const content = data.choices?.[0]?.message?.content ?? ''

        return {
          id: Math.random().toString(36).substring(7),
          role,
          model: modelId,
          modelDisplayName: getModelDisplayName(modelId),
          content,
          round: roundNum,
          latency,
          keyUsed,
        }
      } catch (err: any) {
        console.error(`[Debate API Error]`, err)
        return {
          id: Math.random().toString(36).substring(7),
          role,
          model: modelId,
          modelDisplayName: getModelDisplayName(modelId),
          content: `Error: Failed to generate response (${err.message}).`,
          round: roundNum,
          latency: 0,
        }
      }
    }

    try {
      // Run rounds
      for (let r = 1; r <= rounds; r++) {
        if (abortRef.current) break
        setCurrentRound(r)

        const firstPlayer = opens
        const secondPlayer = opens === 'infavor' ? 'against' : 'infavor'

        // --- PLAYER 1 TURN ---
        if (abortRef.current) break
        setCurrentStage(`${firstPlayer}_thinking` as any)
        setStatusMessage(`Round ${r} of ${rounds}: ${getModelDisplayName(firstPlayer === 'infavor' ? infavorModel : againstModel)} is preparing arguments...`)

        // Construct context for first player
        const systemPrompt1 = `You are a professional debater participating in a structured debate.
Topic: "${topic}"
Your Position: ${firstPlayer === 'infavor' ? 'IN FAVOR / PRO' : 'AGAINST / CON'}.

Guidelines:
1. Maintain your stance consistently. Do NOT agree with the opponent.
2. Direct your arguments logically and refute the opponent's previous points using evidence or reasoning.
3. Keep your response concise, sharp, and limited to a single turn of around 100-180 words.
4. Speak directly to the topic and the opponent's arguments. Do not prefix your output with "Turn:" or your name.`

        const history1 = [
          { role: 'system', content: systemPrompt1 },
          ...messages.map(m => ({
            role: m.role === firstPlayer ? 'assistant' : 'user',
            content: m.role === 'judge' ? `Judge Critique: ${m.content}` : `Opponent: ${m.content}`
          }))
        ]

        const turn1 = await generateTurn(
          firstPlayer === 'infavor' ? infavorModel : againstModel,
          firstPlayer,
          history1,
          r
        )
        if (turn1) {
          setMessages(prev => [...prev, turn1])
        }

        // --- PLAYER 2 TURN ---
        if (abortRef.current) break
        setCurrentStage(`${secondPlayer}_thinking` as any)
        setStatusMessage(`Round ${r} of ${rounds}: ${getModelDisplayName(secondPlayer === 'infavor' ? infavorModel : againstModel)} is writing counter-arguments...`)

        const systemPrompt2 = `You are a professional debater participating in a structured debate.
Topic: "${topic}"
Your Position: ${secondPlayer === 'infavor' ? 'IN FAVOR / PRO' : 'AGAINST / CON'}.

Guidelines:
1. Maintain your stance consistently. Do NOT agree with the opponent.
2. Direct your arguments logically and refute the opponent's previous points using evidence or reasoning.
3. Keep your response concise, sharp, and limited to a single turn of around 100-180 words.
4. Speak directly to the topic and the opponent's arguments. Do not prefix your output with "Turn:" or your name.`

        // Build history including Player 1's just-added turn
        const updatedMessagesFor2 = turn1 ? [...messages, turn1] : messages
        const history2 = [
          { role: 'system', content: systemPrompt2 },
          ...updatedMessagesFor2.map(m => ({
            role: m.role === secondPlayer ? 'assistant' : 'user',
            content: m.role === 'judge' ? `Judge Critique: ${m.content}` : `Opponent: ${m.content}`
          }))
        ]

        const turn2 = await generateTurn(
          secondPlayer === 'infavor' ? infavorModel : againstModel,
          secondPlayer,
          history2,
          r
        )
        if (turn2) {
          setMessages(prev => [...prev, turn2])
        }

        // --- ROUND JUDGING (Optional) ---
        if (judgingInterval === 'every_round') {
          if (abortRef.current) break
          setCurrentStage('judge_thinking')
          setStatusMessage(`Round ${r} of ${rounds}: Judge (${getModelDisplayName(judgeModel)}) is evaluating this round's arguments...`)

          const judgeSystemPrompt = `You are an impartial, analytical debate judge and moderator.
Topic: "${topic}"
In Favor Player Model: "${getModelDisplayName(infavorModel)}"
Against Player Model: "${getModelDisplayName(againstModel)}"

Guidelines:
Review the debate history provided below. Provide a brief (under 80 words) assessment of this round's arguments, scoring each player's performance in this round out of 10.`

          const updatedMessagesForJ = turn2 ? [...updatedMessagesFor2, turn2] : updatedMessagesFor2
          const historyJ = [
            { role: 'system', content: judgeSystemPrompt },
            ...updatedMessagesForJ.map(m => ({
              role: 'user',
              content: `${m.role === 'infavor' ? 'In Favor Model' : m.role === 'against' ? 'Against Model' : 'Previous Judge Verdict'}: ${m.content}`
            }))
          ]

          const judgeTurn = await generateTurn(
            judgeModel,
            'judge',
            historyJ,
            r
          )
          if (judgeTurn) {
            setMessages(prev => [...prev, judgeTurn])
          }
        }
      }

      // --- FINAL JUDGING (Optional) ---
      if (judgingInterval === 'at_end' && !abortRef.current) {
        setCurrentStage('judge_thinking')
        setStatusMessage(`Debate complete. Judge (${getModelDisplayName(judgeModel)}) is delivering the final verdict...`)

        const finalJudgeSystemPrompt = `You are an impartial, analytical debate judge.
Topic: "${topic}"
In Favor Player Model: "${getModelDisplayName(infavorModel)}"
Against Player Model: "${getModelDisplayName(againstModel)}"

Read the entire debate history. Provide a detailed critique, declare a final winner, and summarize why they won.`

        const historyFinal = [
          { role: 'system', content: finalJudgeSystemPrompt },
          ...messages.map(m => ({
            role: 'user',
            content: `${m.role === 'infavor' ? 'In Favor Model' : m.role === 'against' ? 'Against Model' : 'Judge Critique'}: ${m.content}`
          }))
        ]

        const finalJudgeTurn = await generateTurn(
          judgeModel,
          'judge',
          historyFinal,
          rounds
        )
        if (finalJudgeTurn) {
          setMessages(prev => [...prev, finalJudgeTurn])
        }
      }
    } catch (e: any) {
      console.error(e)
    } finally {
      setIsDebating(false)
      setCurrentStage('finished')
      setStatusMessage('Debate finished.')
    }
  }

  const handleCancelDebate = () => {
    abortRef.current = true
    setIsDebating(false)
    setCurrentStage('idle')
    setStatusMessage('Debate cancelled.')
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-0">
      <PageHeader
        title="AI Debate Arena"
        description="Select a topic, configure two player models to debate opposite stances, and watch a judge model evaluate their logical structure."
      />

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings column */}
        <div className="lg:col-span-1 flex flex-col gap-4 overflow-y-auto pr-1">
          <div className="rounded-2xl border bg-card/60 backdrop-blur p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground/80 mb-3">Debate Config</h3>
              
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="topic" className="text-xs font-semibold">Debate Topic</Label>
                  <Textarea
                    id="topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Enter debate topic..."
                    disabled={isDebating}
                    rows={3}
                    className="text-xs resize-none rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Rounds ({rounds})</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={rounds}
                      onChange={(e) => setRounds(Math.max(1, parseInt(e.target.value) || 1))}
                      disabled={isDebating}
                      className="h-8 text-xs rounded-xl"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Opening Player</Label>
                    <Select
                      value={opens}
                      onValueChange={(v) => { if (v === 'infavor' || v === 'against') setOpens(v) }}
                      disabled={isDebating}
                    >
                      <SelectTrigger className="h-8 text-xs rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="infavor">In Favor</SelectItem>
                        <SelectItem value="against">Against</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Judging Mode</Label>
                  <Select
                    value={judgingInterval}
                    onValueChange={(v) => { if (v === 'every_round' || v === 'at_end') setJudgingInterval(v) }}
                    disabled={isDebating}
                  >
                    <SelectTrigger className="h-8 text-xs rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="every_round">Judge Every Round</SelectItem>
                      <SelectItem value="at_end">Judge Only at the End</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="border-t border-muted/50 pt-4 space-y-3">
              <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground/80 mb-1">Participants</h3>
              
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Argues: In Favor
                  </Label>
                  <Select value={infavorModel} onValueChange={(v) => { if (v) setInfavorModel(v) }} disabled={isDebating}>
                    <SelectTrigger className="h-8 text-xs rounded-xl">
                      <SelectValue placeholder="Select In Favor Model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (Smart Routing)</SelectItem>
                      {availableModels.map(m => (
                        <SelectItem key={m.modelDbId} value={m.modelId}>{m.displayName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                    Argues: Against
                  </Label>
                  <Select value={againstModel} onValueChange={(v) => { if (v) setAgainstModel(v) }} disabled={isDebating}>
                    <SelectTrigger className="h-8 text-xs rounded-xl">
                      <SelectValue placeholder="Select Against Model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (Smart Routing)</SelectItem>
                      {availableModels.map(m => (
                        <SelectItem key={m.modelDbId} value={m.modelId}>{m.displayName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Moderator: Judge Model
                  </Label>
                  <Select value={judgeModel} onValueChange={(v) => { if (v) setJudgeModel(v) }} disabled={isDebating}>
                    <SelectTrigger className="h-8 text-xs rounded-xl">
                      <SelectValue placeholder="Select Judge Model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (Smart Routing)</SelectItem>
                      {availableModels.map(m => (
                        <SelectItem key={m.modelDbId} value={m.modelId}>{m.displayName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="pt-2">
              {!isDebating ? (
                <Button
                  onClick={handleStartDebate}
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 font-semibold rounded-xl py-5"
                >
                  Start Debate Arena
                </Button>
              ) : (
                <Button
                  onClick={handleCancelDebate}
                  variant="destructive"
                  className="w-full font-semibold rounded-xl py-5"
                >
                  Cancel Debate
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Live Arena feed column */}
        <div className="lg:col-span-2 flex flex-col border rounded-2xl bg-card/40 backdrop-blur overflow-hidden h-full shadow-sm relative">
          
          {/* Floor Header status */}
          <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isDebating ? 'bg-violet-400' : 'bg-slate-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isDebating ? 'bg-violet-500' : 'bg-slate-500'}`}></span>
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Arena Floor</span>
            </div>

            {isDebating && (
              <Badge variant="outline" className="text-[10px] border-violet-500/30 text-violet-600 dark:text-violet-400 animate-pulse font-semibold">
                Round {currentRound} / {rounds}
              </Badge>
            )}
          </div>

          {/* Arena Chat Flow */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.length === 0 && currentStage === 'idle' && (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">
                <div className="p-4 bg-muted/50 rounded-2xl border border-dashed text-muted-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mx-auto mb-2 opacity-60">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                  </svg>
                  <p className="text-sm font-semibold mb-1">Debate Arena is Idle</p>
                  <p className="text-xs text-muted-foreground/80">Configure the parameters in the left panel and click "Start Debate Arena" to begin the AI debate.</p>
                </div>
              </div>
            )}

            {messages.map((msg) => {
              const isInFavor = msg.role === 'infavor'
              const isAgainst = msg.role === 'against'
              const isJudge = msg.role === 'judge'

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col max-w-[85%] rounded-2xl p-4 shadow-sm border animate-fade-in ${
                    isInFavor
                      ? 'bg-emerald-500/10 dark:bg-emerald-500/5 border-emerald-500/20 mr-auto'
                      : isAgainst
                      ? 'bg-rose-500/10 dark:bg-rose-500/5 border-rose-500/20 ml-auto'
                      : 'bg-amber-500/10 dark:bg-amber-500/5 border-amber-500/20 mx-auto w-full max-w-[95%]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {isInFavor && (
                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-[10px]">
                          ✓
                        </div>
                      )}
                      {isAgainst && (
                        <div className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-[10px]">
                          ✗
                        </div>
                      )}
                      {isJudge && (
                        <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-[10px]">
                          ⚖
                        </div>
                      )}
                      <span className={`text-xs font-bold ${
                        isInFavor ? 'text-emerald-600 dark:text-emerald-400' :
                        isAgainst ? 'text-rose-600 dark:text-rose-400' :
                        'text-amber-600 dark:text-amber-400'
                      }`}>
                        {isInFavor ? 'In Favor' : isAgainst ? 'Against' : 'Judge'} (Round {msg.round})
                      </span>
                    </div>

                    {msg.latency !== undefined && (
                      <span className="text-[10px] text-muted-foreground font-semibold tabular-nums">
                        {msg.latency} ms
                      </span>
                    )}
                  </div>

                  <div className="text-xs leading-relaxed whitespace-pre-wrap mb-3 font-medium">
                    {msg.content}
                  </div>

                  <div className="flex items-center gap-2 border-t border-muted/50 pt-2 text-[9px] text-muted-foreground font-semibold">
                    <span className="uppercase">{msg.modelDisplayName}</span>
                    {msg.keyUsed && (
                      <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-blue-500/10 text-blue-600 border-none font-bold">
                        Key: {msg.keyUsed}
                      </Badge>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Thinking pulse indicator */}
            {isDebating && currentStage !== 'idle' && currentStage !== 'finished' && (
              <div
                className={`flex flex-col max-w-[85%] rounded-2xl p-4 shadow-sm border animate-pulse ${
                  currentStage === 'infavor_thinking'
                    ? 'bg-emerald-500/10 dark:bg-emerald-500/5 border-emerald-500/20 mr-auto'
                    : currentStage === 'against_thinking'
                    ? 'bg-rose-500/10 dark:bg-rose-500/5 border-rose-500/20 ml-auto'
                    : 'bg-amber-500/10 dark:bg-amber-500/5 border-amber-500/20 mx-auto w-full max-w-[95%]'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                  </span>
                  <span className="text-xs font-bold text-muted-foreground">
                    {currentStage === 'infavor_thinking' ? 'In Favor Model is thinking...' :
                     currentStage === 'against_thinking' ? 'Against Model is thinking...' :
                     'Judge Model is thinking...'}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-5/6"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
              </div>
            )}

            <div ref={feedEndRef} />
          </div>

          {/* Floor Footer status bar */}
          {statusMessage && (
            <div className="p-3 border-t bg-muted/30 text-xs font-semibold text-center text-muted-foreground flex items-center justify-center gap-2 select-none">
              {isDebating && (
                <svg className="animate-spin h-3.5 w-3.5 text-violet-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {statusMessage}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
