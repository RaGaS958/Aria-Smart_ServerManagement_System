import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAriaStore } from '../../store/index.js'

const SEVERITY_STYLES = {
  cpu_spike:         { border: '#f97316', bg: 'rgba(249,115,22,0.08)',  text: '#fed7aa' },
  thermal_runaway:   { border: '#ef4444', bg: 'rgba(239,68,68,0.08)',   text: '#fca5a5' },
  network_partition: { border: '#eab308', bg: 'rgba(234,179,8,0.08)',   text: '#fef08a' },
  memory_leak:       { border: '#a855f7', bg: 'rgba(168,85,247,0.08)',  text: '#d8b4fe' },
  recovery:          { border: '#22c55e', bg: 'rgba(34,197,94,0.08)',   text: '#86efac' },
  default:           { border: '#38bdf8', bg: 'rgba(56,189,248,0.08)',  text: '#7dd3fc' },
}

export default function AlertBanner() {
  const alert      = useAriaStore(s => s.alert)
  const clearAlert = useAriaStore(s => s.clearAlert)

  useEffect(() => {
    if (alert?.severity === 'recovery') {
      const t = setTimeout(clearAlert, 5000)
      return () => clearTimeout(t)
    }
  }, [alert])

  const style = SEVERITY_STYLES[alert?.severity] || SEVERITY_STYLES.default

  return (
    <AnimatePresence>
      {alert && (
        <motion.div
          initial={{ opacity: 0, y: -20, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -20, height: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="absolute top-0 left-0 right-0 z-50 mx-4 mt-2 px-3 py-2 rounded-lg flex items-center justify-between gap-2"
          style={{ border: `1px solid ${style.border}50`, background: style.bg }}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0"
              style={{ backgroundColor: style.border, boxShadow: `0 0 6px ${style.border}` }} />
            <span className="text-[10px] font-mono truncate" style={{ color: style.text }}>
              {alert.message}
            </span>
          </div>
          <button onClick={clearAlert}
            className="text-[10px] font-mono opacity-50 hover:opacity-100 flex-shrink-0 transition-opacity"
            style={{ color: style.text }}>
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}