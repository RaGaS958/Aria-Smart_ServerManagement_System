import { vi } from 'vitest'

// ── Reusable fetch response helpers ──────────────────────────────────────────
export function mockFetchJSON(data, status = 200) {
  fetch.mockResolvedValueOnce({
    ok: status < 400,
    status,
    json: async () => data,
    body: null,
  })
}

export function mockFetchSSE(events) {
  /**
   * events = [{ type, data }]
   * Builds a ReadableStream that emits SSE lines then closes.
   */
  const lines = events.map(e => `event: ${e.type}\ndata: ${JSON.stringify(e.data)}\n\n`).join('')
  const encoder = new TextEncoder()
  let pos = 0
  const stream = new ReadableStream({
    pull(controller) {
      if (pos < lines.length) {
        controller.enqueue(encoder.encode(lines.slice(pos, pos + 50)))
        pos += 50
      } else {
        controller.close()
      }
    },
  })
  fetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    body: stream,
    headers: new Headers({ 'content-type': 'text/event-stream' }),
  })
}

export function mockFetchError(message = 'Network error') {
  fetch.mockRejectedValueOnce(new Error(message))
}

// ── Standard API response fixtures ───────────────────────────────────────────
export const FIXTURES = {
  health: { status: 'ok', service: 'ARIA Core API' },

  scenarios: [
    { id: 'cpu_spike',         description: 'Runaway process', duration_s: 120, mood: 'panicked',    alert: 'CPU critical on R2' },
    { id: 'thermal_runaway',   description: 'Cooling failure', duration_s: 90,  mood: 'furious',     alert: 'Temp exceeds 85°C' },
    { id: 'network_partition', description: 'BGP failure',     duration_s: 100, mood: 'shocked',     alert: 'Network partition' },
    { id: 'memory_leak',       description: 'OOM imminent',    duration_s: 110, mood: 'melancholy',  alert: 'RAM climbing' },
    { id: 'recovery',          description: 'Baseline restore',duration_s: 60,  mood: 'elated',      alert: 'Systems recovering' },
  ],

  triggerSuccess: (scenario = 'cpu_spike') => ({
    triggered: true, scenario, severity: 'medium', description: 'Test', mood: 'panicked', alert: 'CPU alert',
  }),

  snapshot: (scenarioName = null) => ({
    ts: Date.now() / 1000,
    nodes: {
      R1: { cpu: 18.5, ram: 32.1, temp: 41.2, net_in: 98, net_out: 82, disk_io: 28, healthy: true },
      R2: { cpu: 22.3, ram: 38.7, temp: 43.5, net_in: 95, net_out: 78, disk_io: 25, healthy: true },
      R3: { cpu: 20.1, ram: 35.4, temp: 42.0, net_in: 102, net_out: 85, disk_io: 31, healthy: true },
    },
    scenario: scenarioName ? {
      name: scenarioName, mood: 'panicked',
      alert: 'CPU critical on R2', elapsed: 10, duration: 120,
    } : null,
  }),

  wsMetrics: (nodeOverride = {}) => ({
    ts: Date.now() / 1000,
    nodes: {
      R1: { cpu: 18, ram: 32, temp: 41, net_in: 98,  net_out: 82, disk_io: 28, healthy: true, ...nodeOverride.R1 },
      R2: { cpu: 22, ram: 38, temp: 43, net_in: 95,  net_out: 78, disk_io: 25, healthy: true, ...nodeOverride.R2 },
      R3: { cpu: 20, ram: 35, temp: 42, net_in: 102, net_out: 85, disk_io: 31, healthy: true, ...nodeOverride.R3 },
    },
    scenario: null,
  }),

  sseChat: (text = 'All systems nominal.', mood = 'calm') => [
    { type: 'thought', data: { text: 'Analyzing...' } },
    { type: 'token',   data: { text: 'All ' } },
    { type: 'token',   data: { text: 'systems ' } },
    { type: 'token',   data: { text: 'nominal.' } },
    { type: 'mood',    data: { mood, reason: 'Calm response' } },
    { type: 'done',    data: { text, mood, session_id: 'test-session' } },
  ],
}
