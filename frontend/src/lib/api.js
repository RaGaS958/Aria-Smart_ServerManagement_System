const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const WS_BASE = import.meta.env.VITE_WS_URL || (
  typeof window !== 'undefined'
    ? `ws://${window.location.hostname}:8000`
    : 'ws://localhost:8000'
)

// ── Safe JSON parser ──────────────────────────────────────────────────────────
async function safeJson(r) {
  const text = await r.text()
  if (!text?.trim()) return {}
  try { return JSON.parse(text) } catch { return { detail: text.slice(0, 200) } }
}

// ── REST ──────────────────────────────────────────────────────────────────────
export async function getScenarios() {
  const r = await fetch(`${BASE}/sim/scenarios`)
  return safeJson(r)
}

export async function triggerScenario(scenario, severity = 'medium') {
  const r = await fetch(`${BASE}/sim/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario, severity }),
  })
  return safeJson(r)
}

export async function cancelScenario() {
  const r = await fetch(`${BASE}/sim/cancel`, { method: 'POST' })
  return safeJson(r)
}

export async function getSnapshot() {
  const r = await fetch(`${BASE}/metrics/snapshot`)
  return safeJson(r)
}

export async function approveToolCall(call_id, approved) {
  const r = await fetch(`${BASE}/chat/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ call_id, approved }),
  })
  return safeJson(r)
}

// ── SSE streaming chat ────────────────────────────────────────────────────────
export function streamChat({ message, sessionId, token, userLocation, onThought, onToken, onMood, onDone, onError }) {
  const ctrl = new AbortController()

  ;(async () => {
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const resp = await fetch(`${BASE}/chat/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message, session_id: sessionId, user_location: userLocation || null }),
        signal: ctrl.signal,
      })

      if (!resp.ok) {
        const text = await resp.text().catch(() => '')
        onError?.(`HTTP ${resp.status}${text ? ': ' + text.slice(0, 100) : ''}`)
        return
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const parts = buf.split('\n\n')
        buf = parts.pop() ?? ''

        for (const part of parts) {
          const lines = part.split('\n')
          let eventType = 'message'
          let data = ''
          for (const line of lines) {
            if (line.startsWith('event:')) eventType = line.slice(6).trim()
            if (line.startsWith('data:'))  data      = line.slice(5).trim()
          }
          if (!data) continue
          try {
            const payload = JSON.parse(data)
            if (eventType === 'thought')     onThought?.(payload)
            else if (eventType === 'token')  onToken?.(payload.text)
            else if (eventType === 'mood')   onMood?.(payload)
            else if (eventType === 'done')   onDone?.(payload)
            else if (eventType === 'error')  onError?.(payload.text)
          } catch { /* ignore malformed SSE frames */ }
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') onError?.(e.message)
    }
  })()

  return () => ctrl.abort()
}

export { WS_BASE }