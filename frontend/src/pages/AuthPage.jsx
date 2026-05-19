import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext.jsx'

function HexBg() {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-[0.035] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="hex2" x="0" y="0" width="56" height="48" patternUnits="userSpaceOnUse">
          <polygon points="28,2 52,14 52,34 28,46 4,34 4,14" fill="none" stroke="#38bdf8" strokeWidth="0.8" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#hex2)" />
    </svg>
  )
}

export default function AuthPage({ mode = 'login' }) {
  const [isLogin, setIsLogin] = useState(mode === 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { login, register, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/dashboard'

  useEffect(() => { if (user) navigate(from, { replace: true }) }, [user])
  useEffect(() => { setIsLogin(mode === 'login'); setError('') }, [mode])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isLogin) {
        await login(email, password)
      } else {
        if (password.length < 6) throw new Error('Password must be at least 6 characters')
        await register(email, password, name)
      }
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#020406] flex items-center justify-center px-6 relative overflow-hidden">
      <HexBg />

      {/* Glow orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full blur-[120px] opacity-10" style={{ background: '#38bdf8' }} />
        <div className="absolute bottom-1/4 right-1/4 w-60 h-60 rounded-full blur-[100px] opacity-8" style={{ background: '#c084fc' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <Link to="/" className="flex items-center gap-2 mb-8 group">
            <svg viewBox="0 0 28 28" className="w-10 h-10">
              <polygon points="14,3 25,8 25,20 14,25 3,20 3,8" fill="none" stroke="#38bdf8" strokeWidth="1.5" />
              <polygon points="14,8 20,11 20,17 14,20 8,17 8,11" fill="#38bdf8" opacity="0.25" />
              <circle cx="14" cy="14" r="2.5" fill="#38bdf8" />
            </svg>
            <span className="text-white font-black text-2xl tracking-widest">ARIA</span>
          </Link>

          {/* Tab toggle */}
          <div className="flex p-1 rounded-xl bg-white/5 border border-white/10">
            {[['login','Sign In'], ['register','Get Access']].map(([m, label]) => (
              <Link key={m} to={`/${m}`}
                className={`px-6 py-2 rounded-lg text-[12px] font-mono uppercase tracking-widest transition-all ${
                  (m === 'login') === isLogin
                    ? 'bg-[#38bdf8] text-[#020406] font-bold shadow-[0_0_20px_rgba(56,189,248,0.3)]'
                    : 'text-white/40 hover:text-white/70'
                }`}>
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* Form card */}
        <div className="relative p-8 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
          {/* Scan line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#38bdf8]/60 to-transparent" />

          <AnimatePresence mode="wait">
            <motion.form
              key={isLogin ? 'login' : 'register'}
              initial={{ opacity: 0, x: isLogin ? -10 : 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleSubmit}
              className="flex flex-col gap-5"
            >
              <h2 className="text-white font-bold text-xl tracking-tight">
                {isLogin ? 'Welcome back' : 'Create your account'}
              </h2>
              <p className="text-white/40 text-sm leading-relaxed -mt-2">
                {isLogin
                  ? 'Sign in to access the ARIA dashboard and server controls.'
                  : 'Register to get full access. First user becomes admin.'}
              </p>

              {!isLogin && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Display name</label>
                  <input
                    type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="Your name"
                    className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/25 text-sm font-mono focus:outline-none focus:border-[#38bdf8]/50 focus:bg-[#38bdf8]/5 transition-all"
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Email address</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" required
                  className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/25 text-sm font-mono focus:outline-none focus:border-[#38bdf8]/50 focus:bg-[#38bdf8]/5 transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Password</label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder={isLogin ? '••••••••' : 'At least 6 characters'} required
                  className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/25 text-sm font-mono focus:outline-none focus:border-[#38bdf8]/50 focus:bg-[#38bdf8]/5 transition-all"
                />
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-mono"
                  >
                    ⚠ {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                type="submit"
                disabled={loading}
                whileTap={{ scale: 0.98 }}
                className="w-full py-4 rounded-xl bg-[#38bdf8] text-[#020406] font-black text-sm uppercase tracking-widest hover:bg-[#7dd3fc] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_0_30px_rgba(56,189,248,0.2)] hover:shadow-[0_0_40px_rgba(56,189,248,0.35)] mt-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    {isLogin ? 'Signing in...' : 'Creating account...'}
                  </span>
                ) : (
                  isLogin ? 'Sign in →' : 'Create account →'
                )}
              </motion.button>

              {/* Role note */}
              {!isLogin && (
                <p className="text-center text-[10px] font-mono text-white/25 leading-relaxed">
                  🔐 First registered user becomes <span className="text-[#38bdf8]/60">admin</span>.<br />
                  Subsequent users become <span className="text-white/40">operators</span>.
                </p>
              )}
            </motion.form>
          </AnimatePresence>
        </div>

        {/* Bottom link */}
        <p className="text-center text-[12px] font-mono text-white/30 mt-6">
          {isLogin ? "Don't have access? " : 'Already have access? '}
          <Link to={isLogin ? '/register' : '/login'} className="text-[#38bdf8]/70 hover:text-[#38bdf8] transition-colors">
            {isLogin ? 'Register →' : 'Sign in →'}
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
