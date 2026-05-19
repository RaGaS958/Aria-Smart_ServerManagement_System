import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext(null)

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ── Safe JSON parser — never throws on empty / non-JSON responses ─────────────
async function safeJson(response) {
  const text = await response.text()
  if (!text || !text.trim()) return {}
  try {
    return JSON.parse(text)
  } catch {
    // Backend sent plain text or HTML (e.g. a proxy error page)
    return { detail: text.trim().slice(0, 200) }
  }
}

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [token,   setToken]   = useState(() => localStorage.getItem('aria_token'))
  const [loading, setLoading] = useState(true)

  // Verify stored token on mount
  useEffect(() => {
    if (!token) { setLoading(false); return }
    fetch(`${BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async r => {
        if (!r.ok) throw new Error('Token invalid')
        return safeJson(r)
      })
      .then(u => { if (u?.id) setUser(u) })
      .catch(() => {
        localStorage.removeItem('aria_token')
        setToken(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email, password) => {
    const form = new URLSearchParams({ username: email, password })
    let r
    try {
      r = await fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form,
      })
    } catch (networkErr) {
      throw new Error(`Cannot reach backend at ${BASE} — is the server running?`)
    }
    const data = await safeJson(r)
    if (!r.ok) throw new Error(data.detail || `Login failed (${r.status})`)
    localStorage.setItem('aria_token', data.access_token)
    setToken(data.access_token)
    setUser(data.user)
    return data.user
  }, [])

  const register = useCallback(async (email, password, name) => {
    if (!password || password.length < 6)
      throw new Error('Password must be at least 6 characters')

    let r
    try {
      r = await fetch(`${BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      })
    } catch (networkErr) {
      throw new Error(`Cannot reach backend at ${BASE} — is the server running?`)
    }
    const data = await safeJson(r)
    if (!r.ok) throw new Error(data.detail || `Registration failed (${r.status})`)
    if (!data.access_token)
      throw new Error('Server returned an unexpected response. Check backend logs.')

    localStorage.setItem('aria_token', data.access_token)
    setToken(data.access_token)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('aria_token')
    setToken(null)
    setUser(null)
  }, [])

  const authFetch = useCallback((url, opts = {}) => {
    return fetch(url, {
      ...opts,
      headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}` },
    })
  }, [token])

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      login, register, logout, authFetch,
      isAdmin: user?.role === 'admin',
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}