/**
 * LocationBanner.jsx
 * Shown once at the top of the dashboard.
 * Asks for browser geolocation, then shows nearest datacenter + distances.
 * Drop inside DashboardPage (or App) just below the Navbar.
 */
import { motion, AnimatePresence } from 'framer-motion'
import { useLocationStore } from '../../store/index.js'

export default function LocationBanner() {
  const { status, distances, nearest, requestLocation, clearLocation } = useLocationStore()

  // Already granted — show the compact info bar
  if (status === 'granted' && nearest) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="fixed top-[40px] left-0 right-0 z-40 flex items-center justify-between
                     px-6 py-1.5 bg-[#061016]/95 border-b border-[#38bdf8]/15
                     text-[10px] font-mono text-white/40 backdrop-blur-sm"
        >
          <div className="flex items-center gap-4">
            <span className="text-[#38bdf8]/60 uppercase tracking-widest">Operator location locked</span>
            {Object.entries(distances).map(([id, km]) => (
              <span key={id}
                className={id === nearest.id ? 'text-[#4ade80]' : ''}>
                {id} {km} km{id === nearest.id ? ' ← nearest' : ''}
              </span>
            ))}
          </div>
          <button
            onClick={clearLocation}
            className="text-white/20 hover:text-white/50 transition-colors text-[9px] uppercase tracking-widest"
          >
            revoke
          </button>
        </motion.div>
      </AnimatePresence>
    )
  }

  // Denied or unavailable — show a muted one-liner
  if (status === 'denied' || status === 'unavailable') {
    return (
      <div className="fixed top-[40px] left-0 right-0 z-40 px-6 py-1
                      bg-[#061016]/80 border-b border-white/5
                      text-[10px] font-mono text-white/20 text-center">
        Location {status} — ARIA will not include proximity data in responses.
      </div>
    )
  }

  // Idle — show the permission request card
  if (status === 'idle') {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          className="fixed top-[40px] left-0 right-0 z-40 flex items-center justify-between
                     px-6 py-2 bg-[#061218]/97 border-b border-[#38bdf8]/20
                     backdrop-blur-sm"
        >
          <div className="flex items-center gap-3">
            {/* Pulse dot */}
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#38bdf8] opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#38bdf8]" />
            </span>
            <span className="text-[11px] font-mono text-white/55">
              Allow location access so ARIA knows your proximity to each datacenter
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={requestLocation}
              className="px-3 py-1 rounded-lg bg-[#38bdf8]/15 border border-[#38bdf8]/30
                         text-[#38bdf8] text-[10px] font-mono uppercase tracking-widest
                         hover:bg-[#38bdf8]/25 transition-colors"
            >
              Allow
            </button>
            <button
              onClick={() => useLocationStore.setState({ status: 'denied' })}
              className="text-white/20 hover:text-white/40 transition-colors text-[10px]
                         font-mono uppercase tracking-widest"
            >
              Deny
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    )
  }

  // Requesting — spinner
  return (
    <div className="fixed top-[40px] left-0 right-0 z-40 px-6 py-1.5
                    bg-[#061016]/90 border-b border-[#38bdf8]/15
                    text-[10px] font-mono text-[#38bdf8]/60 text-center">
      <span className="animate-pulse">Acquiring GPS signal…</span>
    </div>
  )
}