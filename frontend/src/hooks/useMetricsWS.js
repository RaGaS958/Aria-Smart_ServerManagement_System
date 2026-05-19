import { useEffect, useRef } from 'react'
import { useServerStore, useAriaStore, useChatStore } from '../store/index.js'
import { WS_BASE } from '../lib/api.js'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Module-level — persists across React remounts (page navigation).
// Prevents re-triggering auto-analysis when the user switches pages
// while a scenario is still active.
let _prevScenario = null
let _isAnalyzing  = false

export function useMetricsWS() {
  const updateMetrics  = useServerStore(s => s.updateMetrics)
  const setWsConnected = useServerStore(s => s.setWsConnected)
  const setAlert       = useAriaStore(s => s.setAlert)
  const setMood        = useAriaStore(s => s.setMood)
  const setThinking    = useAriaStore(s => s.setThinking)

  const addUserMessage     = useChatStore(s => s.addUserMessage)
  const startAriaStream    = useChatStore(s => s.startAriaStream)
  const appendToken        = useChatStore(s => s.appendToken)
  const finalizeAriaMessage = useChatStore(s => s.finalizeAriaMessage)
  const sessionId          = useChatStore(s => s.sessionId)

  const wsRef          = useRef(null)
  const reconnectRef   = useRef(null)

  // Auto-analyze via SSE when a simulation starts
  async function triggerAutoAnalysis(scenario) {
    if (_isAnalyzing) return
    _isAnalyzing = true

    const prompt = `⚠ INCIDENT: ${scenario.name.replace(/_/g,' ').toUpperCase()} — ${scenario.alert} Analyze now.`
    addUserMessage(prompt)
    startAriaStream()
    setThinking(true)

    let token = null
    try { token = localStorage.getItem('aria_token') } catch {}

    const headers = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    try {
      const resp = await fetch(`${BASE}/sim/analyze`, { method: 'POST', headers })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)

      const reader  = resp.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let fullText = ''
      let finalMood = scenario.mood || 'panicked'

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const parts = buf.split('\n\n')
        buf = parts.pop() ?? ''

        for (const part of parts) {
          const lines = part.split('\n')
          let evType = 'message', data = ''
          for (const line of lines) {
            if (line.startsWith('event:')) evType = line.slice(6).trim()
            if (line.startsWith('data:'))  data   = line.slice(5).trim()
          }
          if (!data) continue
          try {
            const payload = JSON.parse(data)
            if (evType === 'token') {
              fullText += payload.text
              appendToken(payload.text)
              setThinking(false)
            } else if (evType === 'mood') {
              finalMood = payload.mood || finalMood
            } else if (evType === 'done') {
              fullText  = payload.text || fullText
              finalMood = payload.mood || finalMood
            }
          } catch {}
        }
      }
      finalizeAriaMessage(fullText || 'Situation analyzed.', finalMood)
    } catch (err) {
      finalizeAriaMessage(`⚠ Auto-analysis failed: ${err.message}`, 'shocked')
    } finally {
      setThinking(false)
      _isAnalyzing = false
    }
  }

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(`${WS_BASE}/ws/metrics`)
      wsRef.current = ws

      ws.onopen  = () => { setWsConnected(true); clearTimeout(reconnectRef.current) }

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          if (data.heartbeat) return

          updateMetrics(data)

          const newScenario  = data.scenario
          const prevScenario = _prevScenario

          // Scenario just STARTED
          if (newScenario && !prevScenario) {
            setMood(newScenario.mood, `Incident: ${newScenario.name}`)
            setAlert({ message: newScenario.alert, severity: newScenario.name, scenario: newScenario })
            setTimeout(() => triggerAutoAnalysis(newScenario), 800)
          }

          // Scenario ongoing — keep mood synced
          if (newScenario) {
            if (!prevScenario || prevScenario.name !== newScenario.name) {
              setMood(newScenario.mood, `Incident: ${newScenario.name}`)
            }
          }

          // Scenario just ENDED
          if (!newScenario && prevScenario) {
            _isAnalyzing = false   // reset so next scenario can fire
            setMood('elated', 'Systems recovered')
            setAlert({ message: '✓ All systems returning to nominal baseline.', severity: 'recovery' })
          }

          _prevScenario = newScenario
        } catch {}
      }

      ws.onclose = () => {
        setWsConnected(false)
        reconnectRef.current = setTimeout(connect, 3000)
      }

      ws.onerror = () => ws.close()
    }

    connect()
    return () => { clearTimeout(reconnectRef.current); wsRef.current?.close() }
  }, [])
}