import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, BarChart2, LogOut, User,
  ChevronDown, Shield, Eye, Zap, Home
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useLocationStore } from '../store/index.js'
import LocationBanner from '../components/ui/LocationBanner.jsx'
import App from '../App.jsx'

const ROLE_CONFIG = {
  admin:    { color: '#38bdf8', icon: Shield,  label: 'Admin'    },
  operator: { color: '#4ade80', icon: Zap,     label: 'Operator' },
  viewer:   { color: '#f59e0b', icon: Eye,     label: 'Viewer'   },
}

// Height constants — must match LocationBanner's py values
const NAV_H    = 40   // px  — the fixed top nav bar
const BANNER_H = 32   // px  — LocationBanner when visible (py-1.5 ≈ 12px top+btm + 10px text)

function DashNav({ user, logout }) {
  const navigate = useNavigate()
  const [dropOpen, setDropOpen] = useState(false)
  const cfg = ROLE_CONFIG[user?.role] || ROLE_CONFIG.operator
  const RoleIcon = cfg.icon

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] h-10 bg-[#020406]/95 backdrop-blur-xl border-b border-white/5 flex items-center px-4 gap-3">
      {/* Left: nav links */}
      <Link to="/" className="flex items-center gap-1.5 text-white/30 hover:text-white/60 transition-colors pr-3 border-r border-white/8">
        <Home className="w-3 h-3" />
        <span className="text-[10px] font-mono uppercase tracking-widest hidden sm:block">Home</span>
      </Link>

      <Link to="/dashboard" className="flex items-center gap-1.5 text-[#38bdf8] pr-3 border-r border-white/8">
        <LayoutDashboard className="w-3 h-3" />
        <span className="text-[10px] font-mono uppercase tracking-widest hidden sm:block">Dashboard</span>
      </Link>

      <Link to="/analytics" className="flex items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors pr-3 border-r border-white/8">
        <BarChart2 className="w-3 h-3" />
        <span className="text-[10px] font-mono uppercase tracking-widest hidden sm:block">Analytics</span>
      </Link>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right: user dropdown */}
      <div className="relative">
        <button
          onClick={() => setDropOpen(v => !v)}
          className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5 border border-white/8 hover:border-white/15 transition-all"
        >
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: cfg.color }} />
          <span className="text-[10px] font-mono text-white/60 hidden sm:block max-w-[120px] truncate">
            {user?.name || user?.email}
          </span>
          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{ background: cfg.color + '20', color: cfg.color }}>
            {cfg.label}
          </span>
          <ChevronDown className={`w-3 h-3 text-white/30 transition-transform ${dropOpen ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {dropOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-1 w-52 bg-[#061016]/98 border border-white/10 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl z-50"
            >
              {/* User info */}
              <div className="px-4 py-3 border-b border-white/8">
                <div className="text-[11px] font-mono text-white/70 truncate">{user?.email}</div>
                <div className="flex items-center gap-1.5 mt-1">
                  <RoleIcon className="w-3 h-3" style={{ color: cfg.color }} />
                  <span className="text-[10px] font-mono" style={{ color: cfg.color }}>{cfg.label}</span>
                </div>
              </div>

              {/* Menu items */}
              <div className="py-1">
                <Link to="/analytics" onClick={() => setDropOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-[11px] font-mono text-white/50 hover:text-white hover:bg-white/5 transition-all">
                  <BarChart2 className="w-3.5 h-3.5" /> Analytics
                </Link>
                <Link to="/about" onClick={() => setDropOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-[11px] font-mono text-white/50 hover:text-white hover:bg-white/5 transition-all">
                  <User className="w-3.5 h-3.5" /> About ARIA
                </Link>
                <div className="border-t border-white/5 mt-1 pt-1">
                  <button
                    onClick={() => { logout(); navigate('/') }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-[11px] font-mono text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign out
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { user, logout } = useAuth()

  // Banner adds height only when it's actually rendered (not while idle-dismissed)
  const locationStatus = useLocationStore(s => s.status)
  const bannerVisible  = locationStatus !== 'idle' || true  // always show on first load
  // Banner disappears only if user explicitly denies AND we don't show the denied notice
  // Safe rule: add banner height for every status except when user has dismissed entirely.
  // We always render LocationBanner; height is consistent regardless of state.
  const contentTop = NAV_H + BANNER_H  // 40 + 32 = 72px

  return (
    <div className="relative">
      {/* ① Fixed top nav — z-[200] */}
      <DashNav user={user} logout={logout} />

      {/* ② Fixed location banner — z-40, sits at top-[40px] (just below nav) */}
      <LocationBanner />

      {/* ③ Page content — pushed down by nav + banner */}
      <div style={{ paddingTop: contentTop }}>
        <App />
      </div>
    </div>
  )
}