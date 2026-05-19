import { useCallback, useRef } from 'react'
import { useChatStore, useLocationStore } from '../store/index.js'
import { useAriaStore } from '../store/index.js'
import { useAuth } from '../context/AuthContext.jsx'
import { streamChat } from '../lib/api.js'

export function useChat() {
  const sessionId = useChatStore(s => s.sessionId)
  const addUserMessage = useChatStore(s => s.addUserMessage)
  const startAriaStream = useChatStore(s => s.startAriaStream)
  const appendToken = useChatStore(s => s.appendToken)
  const finalizeAriaMessage = useChatStore(s => s.finalizeAriaMessage)
  const isStreaming = useChatStore(s => s.isStreaming)
  const messages = useChatStore(s => s.messages)

  const setMood = useAriaStore(s => s.setMood)
  const setThinking = useAriaStore(s => s.setThinking)

  const userLocation = useLocationStore(s => s.coords)  // null if not granted yet

  // Auth token — safe to call even outside AuthProvider (returns null)
  let token = null
  try { token = useAuth().token } catch {}

  const cancelRef = useRef(null)
  const fullTextRef = useRef('')

  const send = useCallback((text) => {
    if (!text.trim() || isStreaming) return
    addUserMessage(text)
    startAriaStream()
    setThinking(true)
    fullTextRef.current = ''

    cancelRef.current = streamChat({
      message: text,
      sessionId,
      token,
      userLocation,
      onThought: () => {},
      onToken: (t) => {
        fullTextRef.current += t
        appendToken(t)
        setThinking(false)
      },
      onMood: (data) => { setMood(data.mood, data.reason) },
      onDone: (data) => {
        finalizeAriaMessage(data.text || fullTextRef.current, data.mood || 'neutral')
        setThinking(false)
      },
      onError: (err) => {
        finalizeAriaMessage(`⚠ ${err}`, 'shocked')
        setThinking(false)
      },
    })
  }, [sessionId, isStreaming, token])

  const cancel = useCallback(() => {
    cancelRef.current?.()
    finalizeAriaMessage(fullTextRef.current || '(cancelled)', 'neutral')
    setThinking(false)
  }, [])

  return { send, cancel, messages, isStreaming }
}