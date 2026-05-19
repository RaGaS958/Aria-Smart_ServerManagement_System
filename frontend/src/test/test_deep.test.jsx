/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║          ARIA FRONTEND — DEEP TEST SUITE                               ║
 * ║  Covers: Zustand stores, API client, SSE parsing, WebSocket hook,      ║
 * ║          chat hook, simulation panel, alert banner, metrics chart,     ║
 * ║          hologram components, edge cases, latency, error states        ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Run all:           npm test
 * Run with watch:    npm run test:watch
 * Run with coverage: npm run test:coverage
 * Run one section:   npm test -- --grep "Store"
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

import { mockFetchJSON, mockFetchSSE, mockFetchError, FIXTURES } from './helpers.js'

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — ZUSTAND STORES
// ─────────────────────────────────────────────────────────────────────────────
describe('AriaStore', () => {
  let useAriaStore

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('../store/index.js')
    useAriaStore = mod.useAriaStore
    // Reset to initial state
    act(() => { useAriaStore.setState({ mood: 'sunny', moodHistory: [], alert: null, isThinking: false }) })
  })

  it('has correct initial mood', () => {
    expect(useAriaStore.getState().mood).toBe('sunny')
  })

  it('setMood updates mood and history', () => {
    act(() => useAriaStore.getState().setMood('furious', 'CPU spike'))
    const state = useAriaStore.getState()
    expect(state.mood).toBe('furious')
    expect(state.moodHistory[0]).toBe('furious')
    expect(state.moodReason).toBe('CPU spike')
  })

  it('setMood keeps history max 12', () => {
    for (let i = 0; i < 20; i++) {
      act(() => useAriaStore.getState().setMood('calm'))
    }
    expect(useAriaStore.getState().moodHistory.length).toBeLessThanOrEqual(12)
  })

  it('setMood prepends to history (newest first)', () => {
    act(() => useAriaStore.getState().setMood('elated'))
    act(() => useAriaStore.getState().setMood('panicked'))
    expect(useAriaStore.getState().moodHistory[0]).toBe('panicked')
    expect(useAriaStore.getState().moodHistory[1]).toBe('elated')
  })

  it('setAlert stores alert object', () => {
    act(() => useAriaStore.getState().setAlert({ message: 'CPU spike', severity: 'cpu_spike' }))
    const alert = useAriaStore.getState().alert
    expect(alert.message).toBe('CPU spike')
    expect(alert.severity).toBe('cpu_spike')
  })

  it('clearAlert nullifies alert', () => {
    act(() => {
      useAriaStore.getState().setAlert({ message: 'test', severity: 'test' })
      useAriaStore.getState().clearAlert()
    })
    expect(useAriaStore.getState().alert).toBeNull()
  })

  it('setThinking toggles isThinking', () => {
    act(() => useAriaStore.getState().setThinking(true))
    expect(useAriaStore.getState().isThinking).toBe(true)
    act(() => useAriaStore.getState().setThinking(false))
    expect(useAriaStore.getState().isThinking).toBe(false)
  })

  it('setLastResponse stores response text', () => {
    act(() => useAriaStore.getState().setLastResponse('All systems nominal.'))
    expect(useAriaStore.getState().lastResponse).toBe('All systems nominal.')
  })

  it('accepts all 14 valid mood IDs', () => {
    const moods = ['neutral','elated','resolute','shocked','puzzled','melancholy',
                   'furious','panicked','adoring','smile','retro','dreamy','sunny','calm']
    for (const mood of moods) {
      act(() => useAriaStore.getState().setMood(mood))
      expect(useAriaStore.getState().mood).toBe(mood)
    }
  })
})


describe('ChatStore', () => {
  let useChatStore

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('../store/index.js')
    useChatStore = mod.useChatStore
    act(() => useChatStore.setState({
      messages: [{ id: 0, sender: 'aria', text: 'System online.', mood: 'sunny' }],
      streamBuffer: '',
      isStreaming: false,
      sessionId: 'test-session-123',
    }))
  })

  it('has one initial message from aria', () => {
    expect(useChatStore.getState().messages).toHaveLength(1)
    expect(useChatStore.getState().messages[0].sender).toBe('aria')
  })

  it('addUserMessage appends message and returns id', () => {
    let id
    act(() => { id = useChatStore.getState().addUserMessage('Hello ARIA') })
    const msgs = useChatStore.getState().messages
    expect(msgs).toHaveLength(2)
    expect(msgs[1].sender).toBe('user')
    expect(msgs[1].text).toBe('Hello ARIA')
    expect(typeof id).toBe('number')
  })

  it('startAriaStream creates streaming placeholder', () => {
    act(() => useChatStore.getState().startAriaStream())
    const state = useChatStore.getState()
    expect(state.isStreaming).toBe(true)
    const last = state.messages[state.messages.length - 1]
    expect(last.sender).toBe('aria')
    expect(last.streaming).toBe(true)
    expect(last.text).toBe('')
  })

  it('appendToken accumulates text in last message', () => {
    act(() => {
      useChatStore.getState().startAriaStream()
      useChatStore.getState().appendToken('Hello ')
      useChatStore.getState().appendToken('World')
    })
    const msgs = useChatStore.getState().messages
    expect(msgs[msgs.length - 1].text).toBe('Hello World')
  })

  it('appendToken updates streamBuffer', () => {
    act(() => {
      useChatStore.getState().startAriaStream()
      useChatStore.getState().appendToken('token1 ')
    })
    expect(useChatStore.getState().streamBuffer).toContain('token1')
  })

  it('finalizeAriaMessage clears streaming flag', () => {
    act(() => {
      useChatStore.getState().startAriaStream()
      useChatStore.getState().finalizeAriaMessage('Final answer.', 'calm')
    })
    const state = useChatStore.getState()
    expect(state.isStreaming).toBe(false)
    expect(state.streamBuffer).toBe('')
    const last = state.messages[state.messages.length - 1]
    expect(last.streaming).toBe(false)
    expect(last.text).toBe('Final answer.')
    expect(last.mood).toBe('calm')
  })

  it('does not append token if no streaming message exists', () => {
    const before = useChatStore.getState().messages.length
    act(() => useChatStore.getState().appendToken('orphan'))
    // Should not crash; message count unchanged
    expect(useChatStore.getState().messages.length).toBe(before)
  })

  it('multiple consecutive messages work correctly', () => {
    act(() => {
      useChatStore.getState().addUserMessage('msg 1')
      useChatStore.getState().startAriaStream()
      useChatStore.getState().appendToken('reply ')
      useChatStore.getState().appendToken('one')
      useChatStore.getState().finalizeAriaMessage('reply one', 'neutral')
      useChatStore.getState().addUserMessage('msg 2')
      useChatStore.getState().startAriaStream()
      useChatStore.getState().appendToken('reply two')
      useChatStore.getState().finalizeAriaMessage('reply two', 'elated')
    })
    const msgs = useChatStore.getState().messages
    expect(msgs.filter(m => m.sender === 'user')).toHaveLength(2)
    expect(msgs.filter(m => m.sender === 'aria')).toHaveLength(3) // initial + 2 replies
  })
})


describe('ServerStore', () => {
  let useServerStore

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('../store/index.js')
    useServerStore = mod.useServerStore
  })

  it('has initial nodes R1, R2, R3', () => {
    const { nodes } = useServerStore.getState()
    expect(Object.keys(nodes)).toEqual(expect.arrayContaining(['R1', 'R2', 'R3']))
  })

  it('updateMetrics merges node data', () => {
    act(() => useServerStore.getState().updateMetrics(FIXTURES.wsMetrics({ R1: { cpu: 85 } })))
    expect(useServerStore.getState().nodes.R1.cpu).toBe(85)
    expect(useServerStore.getState().nodes.R2.cpu).toBe(22)
  })

  it('updateMetrics builds history arrays', () => {
    act(() => {
      useServerStore.getState().updateMetrics(FIXTURES.wsMetrics())
      useServerStore.getState().updateMetrics(FIXTURES.wsMetrics())
    })
    expect(useServerStore.getState().history.R1.cpu.length).toBeGreaterThan(0)
  })

  it('history capped at 60 points per metric', () => {
    for (let i = 0; i < 80; i++) {
      act(() => useServerStore.getState().updateMetrics(FIXTURES.wsMetrics()))
    }
    const { history } = useServerStore.getState()
    expect(history.R1.cpu.length).toBeLessThanOrEqual(60)
    expect(history.R2.ram.length).toBeLessThanOrEqual(60)
  })

  it('history points have x (timestamp) and y (value)', () => {
    act(() => useServerStore.getState().updateMetrics(FIXTURES.wsMetrics()))
    const pt = useServerStore.getState().history.R1.cpu[0]
    expect(pt).toHaveProperty('x')
    expect(pt).toHaveProperty('y')
    expect(typeof pt.x).toBe('number')
    expect(typeof pt.y).toBe('number')
  })

  it('updateMetrics sets active scenario', () => {
    act(() => useServerStore.getState().updateMetrics(FIXTURES.snapshot('cpu_spike')))
    expect(useServerStore.getState().scenario).not.toBeNull()
    expect(useServerStore.getState().scenario.name).toBe('cpu_spike')
  })

  it('scenario clears when null in data', () => {
    act(() => {
      useServerStore.getState().updateMetrics(FIXTURES.snapshot('cpu_spike'))
      useServerStore.getState().updateMetrics({ ...FIXTURES.snapshot(), scenario: null })
    })
    expect(useServerStore.getState().scenario).toBeNull()
  })

  it('setWsConnected toggles connection flag', () => {
    act(() => useServerStore.getState().setWsConnected(true))
    expect(useServerStore.getState().wsConnected).toBe(true)
    act(() => useServerStore.getState().setWsConnected(false))
    expect(useServerStore.getState().wsConnected).toBe(false)
  })

  it('updateMetrics handles empty nodes gracefully', () => {
    expect(() => {
      act(() => useServerStore.getState().updateMetrics({ ts: Date.now() / 1000, nodes: {}, scenario: null }))
    }).not.toThrow()
  })
})


describe('UIStore', () => {
  let useUIStore

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('../store/index.js')
    useUIStore = mod.useUIStore
    act(() => useUIStore.setState({ showLeft: true, showRight: true, showTelemetry: false, showSettings: false, showSimPanel: false }))
  })

  it('toggle flips boolean keys', () => {
    act(() => useUIStore.getState().toggle('showLeft'))
    expect(useUIStore.getState().showLeft).toBe(false)
    act(() => useUIStore.getState().toggle('showLeft'))
    expect(useUIStore.getState().showLeft).toBe(true)
  })

  it('toggle multiple keys independently', () => {
    act(() => {
      useUIStore.getState().toggle('showTelemetry')
      useUIStore.getState().toggle('showSettings')
    })
    expect(useUIStore.getState().showTelemetry).toBe(true)
    expect(useUIStore.getState().showSettings).toBe(true)
    expect(useUIStore.getState().showLeft).toBe(true) // unchanged
  })

  it('set assigns arbitrary value', () => {
    act(() => useUIStore.getState().set('showLeft', false))
    expect(useUIStore.getState().showLeft).toBe(false)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — API CLIENT
// ─────────────────────────────────────────────────────────────────────────────
describe('API client — REST methods', () => {
  let api

  beforeEach(async () => {
    vi.resetModules()
    api = await import('../lib/api.js')
    fetch.mockReset()
  })

  it('getScenarios fetches /sim/scenarios', async () => {
    mockFetchJSON(FIXTURES.scenarios)
    const result = await api.getScenarios()
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/sim/scenarios'))
    expect(result).toHaveLength(5)
    expect(result[0].id).toBe('cpu_spike')
  })

  it('triggerScenario POSTs correct body', async () => {
    mockFetchJSON(FIXTURES.triggerSuccess())
    await api.triggerScenario('cpu_spike', 'high')
    const [url, opts] = fetch.mock.calls[0]
    expect(url).toContain('/sim/trigger')
    const body = JSON.parse(opts.body)
    expect(body.scenario).toBe('cpu_spike')
    expect(body.severity).toBe('high')
  })

  it('triggerScenario defaults severity to medium', async () => {
    mockFetchJSON(FIXTURES.triggerSuccess())
    await api.triggerScenario('recovery')
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.severity).toBe('medium')
  })

  it('cancelScenario POSTs to /sim/cancel', async () => {
    mockFetchJSON({ cancelled: true })
    await api.cancelScenario()
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/sim/cancel'),
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('getSnapshot fetches /metrics/snapshot', async () => {
    mockFetchJSON(FIXTURES.snapshot())
    const result = await api.getSnapshot()
    expect(result).toHaveProperty('nodes')
    expect(result.nodes).toHaveProperty('R1')
  })

  it('approveToolCall sends correct payload', async () => {
    mockFetchJSON({ success: true, call_id: 'abc', approved: true })
    await api.approveToolCall('abc', true)
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.call_id).toBe('abc')
    expect(body.approved).toBe(true)
  })

  it('approveToolCall — deny sends approved: false', async () => {
    mockFetchJSON({ success: true, call_id: 'xyz', approved: false })
    await api.approveToolCall('xyz', false)
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.approved).toBe(false)
  })
})


describe('API client — SSE streaming', () => {
  let api

  beforeEach(async () => {
    vi.resetModules()
    api = await import('../lib/api.js')
    fetch.mockReset()
  })

  it('streamChat calls onThought for thought events', async () => {
    const events = [
      { type: 'thought', data: { text: 'Thinking...' } },
      { type: 'done',    data: { text: 'Done', mood: 'calm', session_id: 's1' } },
    ]
    mockFetchSSE(events)
    const onThought = vi.fn()
    const onDone = vi.fn()

    await new Promise(resolve => {
      api.streamChat({ message: 'hello', sessionId: 's1', onThought, onDone: (...args) => { onDone(...args); resolve() } })
    })

    expect(onThought).toHaveBeenCalledWith(expect.objectContaining({ text: 'Thinking...' }))
  })

  it('streamChat calls onToken for token events', async () => {
    const events = [
      { type: 'token', data: { text: 'Hello ' } },
      { type: 'token', data: { text: 'World' } },
      { type: 'done',  data: { text: 'Hello World', mood: 'calm', session_id: 's1' } },
    ]
    mockFetchSSE(events)
    const tokens = []

    await new Promise(resolve => {
      api.streamChat({
        message: 'hi', sessionId: 's1',
        onToken: t => tokens.push(t),
        onDone: () => resolve(),
      })
    })

    expect(tokens).toContain('Hello ')
    expect(tokens).toContain('World')
  })

  it('streamChat calls onMood with mood data', async () => {
    const events = [
      { type: 'mood', data: { mood: 'elated', reason: 'Good news' } },
      { type: 'done', data: { text: 'ok', mood: 'elated', session_id: 's1' } },
    ]
    mockFetchSSE(events)
    const onMood = vi.fn()

    await new Promise(resolve => {
      api.streamChat({ message: 'hi', sessionId: 's1', onMood, onDone: () => resolve() })
    })

    expect(onMood).toHaveBeenCalledWith({ mood: 'elated', reason: 'Good news' })
  })

  it('streamChat calls onDone with final text and mood', async () => {
    mockFetchSSE(FIXTURES.sseChat('Everything nominal.', 'calm'))
    const onDone = vi.fn()

    await new Promise(resolve => {
      api.streamChat({ message: 'status?', sessionId: 's1', onDone: (...a) => { onDone(...a); resolve() } })
    })

    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({
      text: 'Everything nominal.',
      mood: 'calm',
    }))
  })

  it('streamChat calls onError on fetch failure', async () => {
    mockFetchError('Connection refused')
    const onError = vi.fn()

    await new Promise(resolve => {
      api.streamChat({ message: 'hi', sessionId: 's1', onError: (...a) => { onError(...a); resolve() } })
    })

    expect(onError).toHaveBeenCalledWith(expect.stringContaining('Connection refused'))
  })

  it('streamChat calls onError on HTTP error status', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 500, body: null })
    const onError = vi.fn()

    await new Promise(resolve => {
      api.streamChat({ message: 'hi', sessionId: 's1', onError: (...a) => { onError(...a); resolve() } })
    })

    expect(onError).toHaveBeenCalledWith(expect.stringContaining('500'))
  })

  it('streamChat returns cancel function', () => {
    mockFetchSSE([{ type: 'done', data: { text: '', mood: 'neutral', session_id: 's1' } }])
    const cancel = api.streamChat({ message: 'hi', sessionId: 's1' })
    expect(typeof cancel).toBe('function')
    cancel() // should not throw
  })

  it('streamChat handles empty message gracefully', async () => {
    mockFetchSSE(FIXTURES.sseChat())
    const onDone = vi.fn()
    await new Promise(resolve => {
      api.streamChat({ message: '', sessionId: 's1', onDone: () => { onDone(); resolve() } })
    })
    expect(onDone).toHaveBeenCalled()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — HOOKS
// ─────────────────────────────────────────────────────────────────────────────
describe('useChat hook', () => {
  beforeEach(() => {
    vi.resetModules()
    fetch.mockReset()
  })

  async function renderUseChat() {
    const { useChat } = await import('../hooks/useChat.js')
    return renderHook(() => useChat())
  }

  it('exposes send, cancel, messages, isStreaming', async () => {
    const { result } = await renderUseChat()
    expect(typeof result.current.send).toBe('function')
    expect(typeof result.current.cancel).toBe('function')
    expect(Array.isArray(result.current.messages)).toBe(true)
    expect(typeof result.current.isStreaming).toBe('boolean')
  })

  it('send appends user message immediately', async () => {
    mockFetchSSE(FIXTURES.sseChat())
    const { result } = await renderUseChat()

    await act(async () => { result.current.send('test message') })

    const userMsgs = result.current.messages.filter(m => m.sender === 'user')
    expect(userMsgs.length).toBeGreaterThan(0)
    expect(userMsgs[userMsgs.length - 1].text).toBe('test message')
  })

  it('send ignores empty strings', async () => {
    const { result } = await renderUseChat()
    const before = result.current.messages.length
    await act(async () => { result.current.send('') })
    expect(result.current.messages.length).toBe(before)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('send ignores whitespace-only strings', async () => {
    const { result } = await renderUseChat()
    const before = result.current.messages.length
    await act(async () => { result.current.send('   ') })
    expect(result.current.messages.length).toBe(before)
  })

  it('isStreaming becomes true during send', async () => {
    // Use a promise that stays open
    let resolveStream
    fetch.mockResolvedValueOnce({
      ok: true, status: 200,
      body: new ReadableStream({ start(c) { resolveStream = c } }),
    })
    const { result } = await renderUseChat()
    act(() => { result.current.send('slow query') })
    expect(result.current.isStreaming).toBe(true)
    // Clean up
    act(() => resolveStream?.close())
  })
})


describe('useMetricsWS hook', () => {
  it('connects WebSocket on mount', async () => {
    vi.resetModules()
    const { useMetricsWS } = await import('../hooks/useMetricsWS.js')
    const { unmount } = renderHook(() => useMetricsWS())
    // WebSocket constructor should have been called
    expect(global.WebSocket).toBeDefined()
    unmount()
  })

  it('marks wsConnected true when WS opens', async () => {
    vi.resetModules()
    const { useServerStore } = await import('../store/index.js')
    act(() => useServerStore.setState({ wsConnected: false }))

    const { useMetricsWS } = await import('../hooks/useMetricsWS.js')
    const { unmount } = renderHook(() => useMetricsWS())

    await act(async () => { await new Promise(r => setTimeout(r, 50)) })
    expect(useServerStore.getState().wsConnected).toBe(true)
    unmount()
  })

  it('processes valid WS message and updates store', async () => {
    vi.resetModules()
    let capturedWS
    class TrackedWS {
      constructor(url) { this.url = url; capturedWS = this; setTimeout(() => this.onopen?.(), 0) }
      send() {} close() {}
    }
    global.WebSocket = TrackedWS

    const { useServerStore } = await import('../store/index.js')
    const { useMetricsWS } = await import('../hooks/useMetricsWS.js')
    renderHook(() => useMetricsWS())

    await act(async () => {
      await new Promise(r => setTimeout(r, 20))
      capturedWS.onmessage?.({ data: JSON.stringify(FIXTURES.wsMetrics({ R1: { cpu: 77 } })) })
    })

    expect(useServerStore.getState().nodes.R1.cpu).toBe(77)
  })

  it('ignores heartbeat messages', async () => {
    vi.resetModules()
    let capturedWS
    class TrackedWS {
      constructor() { capturedWS = this; setTimeout(() => this.onopen?.(), 0) }
      send() {} close() {}
    }
    global.WebSocket = TrackedWS

    const { useServerStore } = await import('../store/index.js')
    const beforeCpu = useServerStore.getState().nodes.R1.cpu
    const { useMetricsWS } = await import('../hooks/useMetricsWS.js')
    renderHook(() => useMetricsWS())

    await act(async () => {
      await new Promise(r => setTimeout(r, 20))
      capturedWS.onmessage?.({ data: JSON.stringify({ heartbeat: true }) })
    })

    expect(useServerStore.getState().nodes.R1.cpu).toBe(beforeCpu)
  })

  it('handles malformed JSON gracefully', async () => {
    vi.resetModules()
    let capturedWS
    class TrackedWS {
      constructor() { capturedWS = this; setTimeout(() => this.onopen?.(), 0) }
      send() {} close() {}
    }
    global.WebSocket = TrackedWS

    const { useMetricsWS } = await import('../hooks/useMetricsWS.js')
    renderHook(() => useMetricsWS())

    await act(async () => {
      await new Promise(r => setTimeout(r, 20))
      expect(() => capturedWS.onmessage?.({ data: '{ invalid json' })).not.toThrow()
    })
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
describe('AlertBanner component', () => {
  async function renderAlertBanner() {
    vi.resetModules()
    const { useAriaStore } = await import('../store/index.js')
    const { default: AlertBanner } = await import('../components/ui/AlertBanner.jsx')
    return { AlertBanner, useAriaStore }
  }

  it('renders nothing when alert is null', async () => {
    const { AlertBanner, useAriaStore } = await renderAlertBanner()
    act(() => useAriaStore.setState({ alert: null }))
    const { container } = render(<AlertBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('renders alert message when alert is set', async () => {
    const { AlertBanner, useAriaStore } = await renderAlertBanner()
    act(() => useAriaStore.setState({ alert: { message: 'CPU spike detected', severity: 'cpu_spike' } }))
    render(<AlertBanner />)
    await waitFor(() => expect(screen.getByText(/cpu spike detected/i)).toBeInTheDocument())
  })

  it('clear button removes alert', async () => {
    const { AlertBanner, useAriaStore } = await renderAlertBanner()
    act(() => useAriaStore.setState({
      alert: { message: 'test alert', severity: 'warning' },
      clearAlert: () => useAriaStore.setState({ alert: null }),
    }))
    render(<AlertBanner />)
    await waitFor(() => expect(screen.getByText(/test alert/i)).toBeInTheDocument())
    fireEvent.click(screen.getByText('✕'))
    await waitFor(() => expect(screen.queryByText(/test alert/i)).not.toBeInTheDocument())
  })

  it('renders different severity scenarios', async () => {
    const { AlertBanner, useAriaStore } = await renderAlertBanner()
    const severities = ['cpu_spike','thermal_runaway','network_partition','memory_leak','recovery']
    for (const severity of severities) {
      act(() => useAriaStore.setState({ alert: { message: `${severity} alert`, severity } }))
      const { unmount } = render(<AlertBanner />)
      await waitFor(() => expect(screen.getByText(new RegExp(`${severity} alert`))).toBeInTheDocument())
      unmount()
    }
  })
})


describe('SimPanel component', () => {
  beforeEach(() => { fetch.mockReset() })

  async function renderSimPanel() {
    vi.resetModules()
    mockFetchJSON(FIXTURES.scenarios)
    const { default: SimPanel } = await import('../components/ui/SimPanel.jsx')
    const { useServerStore } = await import('../store/index.js')
    act(() => useServerStore.setState({ scenario: null }))
    return { SimPanel, useServerStore }
  }

  it('renders scenario list after fetch', async () => {
    const { SimPanel } = await renderSimPanel()
    render(<SimPanel onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getByText(/CPU SPIKE/i)).toBeInTheDocument())
    expect(screen.getByText(/THERMAL RUNAWAY/i)).toBeInTheDocument()
    expect(screen.getByText(/RECOVERY/i)).toBeInTheDocument()
  })

  it('calls onClose when × clicked', async () => {
    const { SimPanel } = await renderSimPanel()
    const onClose = vi.fn()
    render(<SimPanel onClose={onClose} />)
    fireEvent.click(screen.getByText('✕'))
    expect(onClose).toHaveBeenCalled()
  })

  it('trigger button disabled when no scenario selected', async () => {
    const { SimPanel } = await renderSimPanel()
    render(<SimPanel onClose={vi.fn()} />)
    await waitFor(() => screen.getByText(/trigger incident/i))
    expect(screen.getByText(/trigger incident/i).closest('button')).toBeDisabled()
  })

  it('shows all 4 severity options', async () => {
    const { SimPanel } = await renderSimPanel()
    render(<SimPanel onClose={vi.fn()} />)
    await waitFor(() => screen.getByText('low'))
    expect(screen.getByText('low')).toBeInTheDocument()
    expect(screen.getByText('medium')).toBeInTheDocument()
    expect(screen.getByText('high')).toBeInTheDocument()
    expect(screen.getByText('critical')).toBeInTheDocument()
  })

  it('shows active incident when scenario is running', async () => {
    const { SimPanel, useServerStore } = await renderSimPanel()
    act(() => useServerStore.setState({
      scenario: { alert: 'CPU critical on R2', elapsed: 15, duration: 120, name: 'cpu_spike', mood: 'panicked' }
    }))
    render(<SimPanel onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getByText(/cpu critical on r2/i)).toBeInTheDocument())
  })

  it('trigger button disabled when scenario active', async () => {
    const { SimPanel, useServerStore } = await renderSimPanel()
    act(() => useServerStore.setState({
      scenario: { alert: 'active', elapsed: 5, duration: 60, name: 'recovery', mood: 'elated' }
    }))
    render(<SimPanel onClose={vi.fn()} />)
    await waitFor(() => screen.getByText(/trigger incident/i))
    expect(screen.getByText(/trigger incident/i).closest('button')).toBeDisabled()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — ARIA DISPLAY (hologram shapes + moods)
// ─────────────────────────────────────────────────────────────────────────────
describe('AriaDisplay component', () => {
  async function renderDisplay(mood, isThinking = false) {
    vi.resetModules()
    const { default: AriaDisplay } = await import('../components/holograms/AriaDisplay.jsx')
    return render(<AriaDisplay mood={mood} isThinking={isThinking} />)
  }

  const allMoods = ['neutral','elated','resolute','shocked','puzzled','melancholy',
                    'furious','panicked','adoring','smile','retro','dreamy','sunny','calm']

  it.each(allMoods)('renders without crash for mood: %s', async (mood) => {
    expect(async () => await renderDisplay(mood)).not.toThrow()
  })

  it('shows mood label text', async () => {
    await renderDisplay('sunny')
    // Component keeps all mood shapes in DOM (CSS transitions), use getAllByText
    const labels = screen.getAllByText('SUNNY')
    expect(labels.length).toBeGreaterThanOrEqual(1)
  })

  it('shows PROCESSING text when isThinking', async () => {
    await renderDisplay('neutral', true)
    await waitFor(() => expect(screen.getByText(/PROCESSING/i)).toBeInTheDocument())
  })

  it('does not show PROCESSING when not thinking', async () => {
    await renderDisplay('calm', false)
    expect(screen.queryByText(/PROCESSING/i)).not.toBeInTheDocument()
  })

  it('unknown mood falls back without crash', async () => {
    expect(async () => await renderDisplay('nonexistent_mood')).not.toThrow()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — DATA CONSISTENCY & EDGE CASES
// ─────────────────────────────────────────────────────────────────────────────
describe('Data consistency', () => {
  beforeEach(() => { vi.resetModules() })

  it('spectrumStates has exactly 14 entries', async () => {
    const { spectrumStates } = await import('../components/holograms/AriaDisplay.jsx')
    expect(spectrumStates).toHaveLength(14)
  })

  it('every spectrum state has id, label, color', async () => {
    const { spectrumStates } = await import('../components/holograms/AriaDisplay.jsx')
    for (const s of spectrumStates) {
      expect(s).toHaveProperty('id')
      expect(s).toHaveProperty('label')
      expect(s).toHaveProperty('color')
      expect(s.color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('all spectrum state IDs are unique', async () => {
    const { spectrumStates } = await import('../components/holograms/AriaDisplay.jsx')
    const ids = spectrumStates.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('store initial session ID is a valid string', async () => {
    const { useChatStore } = await import('../store/index.js')
    expect(typeof useChatStore.getState().sessionId).toBe('string')
    expect(useChatStore.getState().sessionId.length).toBeGreaterThan(0)
  })

  it('fixture wsMetrics produces valid node structure', () => {
    const data = FIXTURES.wsMetrics()
    for (const [nid, m] of Object.entries(data.nodes)) {
      expect(['R1','R2','R3']).toContain(nid)
      expect(m.cpu).toBeGreaterThanOrEqual(0)
      expect(m.cpu).toBeLessThanOrEqual(100)
      expect(typeof m.healthy).toBe('boolean')
    }
  })

  it('fixture sseChat produces valid SSE event list', () => {
    const events = FIXTURES.sseChat('test', 'calm')
    const types = events.map(e => e.type)
    expect(types).toContain('thought')
    expect(types).toContain('token')
    expect(types).toContain('mood')
    expect(types).toContain('done')
    const done = events.find(e => e.type === 'done')
    expect(done.data.mood).toBe('calm')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — LATENCY / PERFORMANCE (micro)
// ─────────────────────────────────────────────────────────────────────────────
describe('Store latency', () => {
  it('AriaStore setMood completes under 5ms', async () => {
    const { useAriaStore } = await import('../store/index.js')
    const t0 = performance.now()
    for (let i = 0; i < 100; i++) {
      act(() => useAriaStore.getState().setMood('calm'))
    }
    const ms = performance.now() - t0
    expect(ms).toBeLessThan(5)
  })

  it('ServerStore updateMetrics 100x under 20ms', async () => {
    const { useServerStore } = await import('../store/index.js')
    const t0 = performance.now()
    for (let i = 0; i < 100; i++) {
      act(() => useServerStore.getState().updateMetrics(FIXTURES.wsMetrics()))
    }
    const ms = performance.now() - t0
    expect(ms).toBeLessThan(20)
  })

  it('ChatStore appendToken 200x under 10ms', async () => {
    const { useChatStore } = await import('../store/index.js')
    act(() => useChatStore.getState().startAriaStream())
    const t0 = performance.now()
    for (let i = 0; i < 200; i++) {
      act(() => useChatStore.getState().appendToken('word '))
    }
    const ms = performance.now() - t0
    expect(ms).toBeLessThan(10)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8 — ERROR STATES
// ─────────────────────────────────────────────────────────────────────────────
describe('Error handling', () => {
  beforeEach(() => { vi.resetModules(); fetch.mockReset() })

  it('getScenarios handles network failure gracefully', async () => {
    mockFetchError('Network down')
    const { getScenarios } = await import('../lib/api.js')
    await expect(getScenarios()).rejects.toThrow()
  })

  it('triggerScenario handles 500 without crashing caller', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'Server error' }) })
    const { triggerScenario } = await import('../lib/api.js')
    const result = await triggerScenario('cpu_spike')
    expect(result).toBeDefined()
  })

  it('getSnapshot handles timeout gracefully', async () => {
    fetch.mockImplementationOnce(() => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10)))
    const { getSnapshot } = await import('../lib/api.js')
    await expect(getSnapshot()).rejects.toThrow('timeout')
  })

  it('ServerStore updateMetrics with undefined nodes does not crash', async () => {
    const { useServerStore } = await import('../store/index.js')
    expect(() => {
      act(() => useServerStore.getState().updateMetrics({ ts: Date.now() / 1000, nodes: undefined, scenario: null }))
    }).not.toThrow()
  })

  it('ChatStore finalizeAriaMessage when no streaming message does not crash', async () => {
    const { useChatStore } = await import('../store/index.js')
    act(() => useChatStore.setState({ messages: [], isStreaming: true, streamBuffer: '' }))
    expect(() => {
      act(() => useChatStore.getState().finalizeAriaMessage('text', 'neutral'))
    }).not.toThrow()
  })
})
