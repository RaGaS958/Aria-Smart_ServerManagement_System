import { create } from 'zustand'

// ── ARIA / mood store ─────────────────────────────────────────────────────────
export const useAriaStore = create((set, get) => ({
  mood: 'sunny',
  moodHistory: ['calm', 'neutral', 'elated', 'sunny'],
  moodReason: '',
  alert: null,               // { message, severity, scenario }
  isThinking: false,
  lastResponse: '',

  setMood: (mood, reason = '') => {
    set(s => ({
      mood,
      moodReason: reason,
      moodHistory: [mood, ...s.moodHistory].slice(0, 12),
    }))
  },
  setAlert: (alert) => set({ alert }),
  clearAlert: () => set({ alert: null }),
  setThinking: (v) => set({ isThinking: v }),
  setLastResponse: (v) => set({ lastResponse: v }),
}))


// ── Chat store ────────────────────────────────────────────────────────────────
export const useChatStore = create((set, get) => ({
  messages: [
    { id: 0, sender: 'aria', text: 'System online. ARIA v1.0 — Smart Server Room AI. How can I assist?', mood: 'sunny' },
  ],
  streamBuffer: '',           // accumulates token SSE chunks
  isStreaming: false,
  sessionId: crypto.randomUUID(),

  addUserMessage: (text) => {
    const id = Date.now()
    set(s => ({ messages: [...s.messages, { id, sender: 'user', text }] }))
    return id
  },

  startAriaStream: () => {
    const id = Date.now()
    set(s => ({
      isStreaming: true,
      streamBuffer: '',
      messages: [...s.messages, { id, sender: 'aria', text: '', mood: 'neutral', streaming: true }],
    }))
    return id
  },

  appendToken: (token) => {
    set(s => {
      const msgs = [...s.messages]
      const last = msgs[msgs.length - 1]
      if (last && last.streaming) {
        msgs[msgs.length - 1] = { ...last, text: last.text + token }
      }
      return { messages: msgs, streamBuffer: s.streamBuffer + token }
    })
  },

  finalizeAriaMessage: (fullText, mood) => {
    set(s => {
      const msgs = [...s.messages]
      const last = msgs[msgs.length - 1]
      if (last && last.streaming) {
        msgs[msgs.length - 1] = { ...last, text: fullText, mood, streaming: false }
      }
      return { messages: msgs, isStreaming: false, streamBuffer: '' }
    })
  },
}))


// ── Server metrics store ──────────────────────────────────────────────────────
export const useServerStore = create((set) => ({
  nodes: {
    R1: { cpu: 18, ram: 32, temp: 41, net_in: 100, net_out: 80, disk_io: 30, healthy: true },
    R2: { cpu: 22, ram: 38, temp: 43, net_in: 95,  net_out: 75, disk_io: 28, healthy: true },
    R3: { cpu: 20, ram: 35, temp: 42, net_in: 105, net_out: 85, disk_io: 32, healthy: true },
  },
  history: {
    R1: { cpu: [], ram: [], temp: [] },
    R2: { cpu: [], ram: [], temp: [] },
    R3: { cpu: [], ram: [], temp: [] },
  },
  scenario: null,
  wsConnected: false,

  updateMetrics: (data) => {
    set(s => {
      const newHistory = { ...s.history }
      const MAX_HISTORY = 60

      for (const [nid, metrics] of Object.entries(data.nodes || {})) {
        if (!newHistory[nid]) newHistory[nid] = { cpu: [], ram: [], temp: [] }
        const ts = data.ts * 1000
        newHistory[nid] = {
          cpu:  [...newHistory[nid].cpu,  { x: ts, y: metrics.cpu  }].slice(-MAX_HISTORY),
          ram:  [...newHistory[nid].ram,  { x: ts, y: metrics.ram  }].slice(-MAX_HISTORY),
          temp: [...newHistory[nid].temp, { x: ts, y: metrics.temp }].slice(-MAX_HISTORY),
        }
      }

      return {
        nodes: data.nodes || s.nodes,
        history: newHistory,
        scenario: data.scenario || null,
      }
    })
  },

  setWsConnected: (v) => set({ wsConnected: v }),
}))


// ── UI panel store ────────────────────────────────────────────────────────────
export const useUIStore = create((set) => ({
  showLeft: true,
  showRight: true,
  showTelemetry: false,
  showSettings: false,
  showSimPanel: false,

  toggle: (key) => set(s => ({ [key]: !s[key] })),
  set: (key, value) => set({ [key]: value }),
}))


// ── Location store ─────────────────────────────────────────────────────────────
const DATACENTERS = {
  R1: { city: 'Mumbai', lat: 19.08, lon: 72.88 },
  R2: { city: 'Delhi',  lat: 28.61, lon: 77.21 },
  R3: { city: 'Pune',   lat: 18.52, lon: 73.86 },
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180
  const dφ = (lat2 - lat1) * Math.PI / 180
  const dλ = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dφ/2)**2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ/2)**2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)))
}

export const useLocationStore = create((set) => ({
  status: 'idle',       // 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable'
  coords: null,         // { lat, lon } — what we send to the API
  distances: null,      // { R1: km, R2: km, R3: km }
  nearest: null,        // { id, city, km }

  requestLocation: () => {
    if (!navigator.geolocation) {
      set({ status: 'unavailable' })
      return
    }
    set({ status: 'requesting' })
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lon = pos.coords.longitude
        const dists = Object.fromEntries(
          Object.entries(DATACENTERS).map(([id, dc]) => [id, haversineKm(lat, lon, dc.lat, dc.lon)])
        )
        const nearestId = Object.entries(dists).sort((a, b) => a[1] - b[1])[0][0]
        set({
          status: 'granted',
          coords: { lat, lon },
          distances: dists,
          nearest: { id: nearestId, city: DATACENTERS[nearestId].city, km: dists[nearestId] },
        })
      },
      (err) => set({ status: err.code === 1 ? 'denied' : 'unavailable' }),
      { timeout: 10000, maximumAge: 300000 }
    )
  },

  clearLocation: () => set({ status: 'idle', coords: null, distances: null, nearest: null }),
}))