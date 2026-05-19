import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../context/AuthContext.jsx'

const NAV_LINKS = [
  { to: '/',          label: 'Home',      pub: true  },
  { to: '/dashboard', label: 'Dashboard', pub: false },
  { to: '/analytics', label: 'Analytics', pub: false },
  { to: '/about',     label: 'About',     pub: true  },
]

export default function Navbar() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const links = NAV_LINKS.filter(l => l.pub || user)

  return (
    <nav className="fixed top-0 left-0 right-0 z-[100] border-b border-white/5 bg-[#020406]/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="relative w-7 h-7">
            <div className="absolute inset-0 rounded-full bg-[#38bdf8]/20 group-hover:bg-[#38bdf8]/30 transition-colors" />
            <svg viewBox="0 0 28 28" className="w-full h-full">
              <polygon points="14,3 25,8 25,20 14,25 3,20 3,8" fill="none" stroke="#38bdf8" strokeWidth="1.5" />
              <polygon points="14,8 20,11 20,17 14,20 8,17 8,11" fill="#38bdf8" opacity="0.3" />
              <circle cx="14" cy="14" r="2.5" fill="#38bdf8" />
            </svg>
          </div>
          <span className="text-white font-bold tracking-[0.15em] text-sm uppercase">ARIA</span>
          <span className="text-[#38bdf8]/50 text-[10px] font-mono tracking-widest">v1.0</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {links.map(l => (
            <Link
              key={l.to}
              to={l.to}
              className={`px-4 py-1.5 rounded-lg text-[12px] font-mono uppercase tracking-widest transition-all ${
                pathname === l.to
                  ? 'bg-[#38bdf8]/15 text-[#38bdf8] border border-[#38bdf8]/30'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Auth */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[11px] font-mono text-white/70">{user.name || user.email}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase ${user.role === 'admin' ? 'bg-[#38bdf8]/20 text-[#38bdf8]' : 'bg-white/10 text-white/50'}`}>{user.role}</span>
              </div>
              <button
                onClick={() => { logout(); navigate('/') }}
                className="px-3 py-1.5 text-[11px] font-mono uppercase tracking-widest text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-lg border border-transparent hover:border-red-500/20 transition-all"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="px-4 py-1.5 text-[12px] font-mono uppercase tracking-widest text-white/60 hover:text-white transition-colors">
                Sign in
              </Link>
              <Link to="/register" className="px-4 py-1.5 text-[12px] font-mono uppercase tracking-widest bg-[#38bdf8]/10 border border-[#38bdf8]/40 text-[#38bdf8] rounded-lg hover:bg-[#38bdf8]/20 transition-all">
                Get access
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button onClick={() => setMobileOpen(v => !v)} className="md:hidden text-white/60 hover:text-white p-2">
          <div className="space-y-1">
            <div className={`w-5 h-0.5 bg-current transition-all ${mobileOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
            <div className={`w-5 h-0.5 bg-current transition-all ${mobileOpen ? 'opacity-0' : ''}`} />
            <div className={`w-5 h-0.5 bg-current transition-all ${mobileOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
          </div>
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden border-t border-white/5 bg-[#020406]/95 overflow-hidden"
          >
            <div className="px-6 py-4 flex flex-col gap-2">
              {links.map(l => (
                <Link key={l.to} to={l.to} onClick={() => setMobileOpen(false)}
                  className={`px-4 py-2.5 rounded-lg text-[12px] font-mono uppercase tracking-widest ${pathname === l.to ? 'bg-[#38bdf8]/15 text-[#38bdf8]' : 'text-white/60'}`}>
                  {l.label}
                </Link>
              ))}
              {user ? (
                <button onClick={() => { logout(); navigate('/'); setMobileOpen(false) }}
                  className="px-4 py-2.5 text-left text-[12px] font-mono uppercase tracking-widest text-red-400">
                  Logout
                </button>
              ) : (
                <>
                  <Link to="/login" onClick={() => setMobileOpen(false)} className="px-4 py-2.5 text-[12px] font-mono uppercase tracking-widest text-white/60">Sign in</Link>
                  <Link to="/register" onClick={() => setMobileOpen(false)} className="px-4 py-2.5 text-[12px] font-mono uppercase tracking-widest text-[#38bdf8]">Get access</Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
