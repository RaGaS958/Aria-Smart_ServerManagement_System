import '@testing-library/jest-dom'
import { vi } from 'vitest'

// ── Mock fetch globally ────────────────────────────────────────────────────────
global.fetch = vi.fn()

// ── Mock WebSocket globally ───────────────────────────────────────────────────
class MockWebSocket {
  constructor(url) {
    this.url = url
    this.readyState = 1 // OPEN
    this.onopen = null
    this.onmessage = null
    this.onclose = null
    this.onerror = null
    this.sent = []
    // Auto-call onopen after construction
    setTimeout(() => this.onopen?.(), 0)
  }
  send(data) { this.sent.push(data) }
  close() { this.readyState = 3; this.onclose?.() }
}
global.WebSocket = MockWebSocket

// ── Mock crypto.randomUUID (jsdom has crypto as getter-only) ──────────────────
let _uuidCounter = 0
try {
  Object.defineProperty(global, 'crypto', {
    writable: true,
    configurable: true,
    value: { randomUUID: () => `test-uuid-${++_uuidCounter}` },
  })
} catch {
  // If already defined, just patch randomUUID
  if (global.crypto) {
    try { global.crypto.randomUUID = () => `test-uuid-${++_uuidCounter}` } catch {}
  }
}

// ── Silence GSAP warnings in test env ─────────────────────────────────────────
vi.mock('gsap', () => ({
  default: {
    registerPlugin: vi.fn(),
    to: vi.fn(),
    fromTo: vi.fn(),
    timeline: vi.fn(() => ({ to: vi.fn(), fromTo: vi.fn() })),
  },
  gsap: {
    registerPlugin: vi.fn(),
    to: vi.fn(),
    fromTo: vi.fn(),
  },
}))

vi.mock('@gsap/react', () => ({
  useGSAP: (fn) => { try { fn() } catch {} },
}))

// ── Silence Three.js canvas warnings ──────────────────────────────────────────
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }) => children,
  useFrame: vi.fn(),
  useThree: () => ({ camera: { position: { x: 0, y: 0, z: 0 }, lookAt: vi.fn() } }),
}))

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
}))

// ── Silence chart.js streaming plugin ─────────────────────────────────────────
vi.mock('chartjs-plugin-streaming', () => ({ default: {} }))
vi.mock('chartjs-adapter-luxon', () => ({}))
vi.mock('chart.js', () => {
  const Chart = vi.fn(() => ({ destroy: vi.fn(), data: { datasets: [] } }))
  Chart.register = vi.fn()
  return {
    Chart,
    LineController: {},
    LineElement: {},
    PointElement: {},
    LinearScale: {},
    TimeScale: {},
    Filler: {},
    Tooltip: {},
    Legend: {},
  }
})

// ── Cleanup between tests ─────────────────────────────────────────────────────
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  fetch.mockReset?.()
})

beforeEach(() => {
  _uuidCounter = 0
})
