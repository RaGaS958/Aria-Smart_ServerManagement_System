import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getScenarios, triggerScenario, cancelScenario } from '../../lib/api.js'
import { useServerStore } from '../../store/index.js'

const SEVERITY_COLORS = {
  low:      'text-blue-400 border-blue-400/30 bg-blue-400/10',
  medium:   'text-yellow-400 border-yellow-400/30 bg-yellow-400/10',
  high:     'text-orange-400 border-orange-400/30 bg-orange-400/10',
  critical: 'text-red-400 border-red-400/30 bg-red-400/10',
}

const SCENARIO_ICONS = {
  cpu_spike: '⚡',
  thermal_runaway: '🌡',
  network_partition: '📡',
  memory_leak: '💾',
  recovery: '✅',
}

export default function SimPanel({ onClose }) {
  const [scenarios, setScenarios] = useState([])
  const [selected, setSelected] = useState(null)
  const [severity, setSeverity] = useState('medium')
  const [triggering, setTriggering] = useState(false)
  const activeScenario = useServerStore(s => s.scenario)

  useEffect(() => {
    getScenarios().then(setScenarios).catch(() => {})
  }, [])

  async function handleTrigger() {
    if (!selected) return
    setTriggering(true)
    try {
      await triggerScenario(selected, severity)
    } finally {
      setTriggering(false)
    }
  }

  async function handleCancel() {
    await cancelScenario()
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: -8 }}
      className="absolute top-16 left-4 w-72 z-50 font-mono"
    >
      <div className="bg-[#061016]/95 border border-[#38bdf8]/40 rounded-xl p-4 shadow-[0_20px_40px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-3 border-b border-[#38bdf8]/20 pb-2">
          <span className="text-[#38bdf8] text-[9px] uppercase tracking-[0.2em]">Incident Simulator</span>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 text-xs">✕</button>
        </div>

        {/* Active scenario banner */}
        <AnimatePresence>
          {activeScenario && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg"
            >
              <div className="text-red-400 text-[8px] uppercase tracking-widest mb-1">Active</div>
              <div className="text-red-300 text-[10px] leading-tight">{activeScenario.alert}</div>
              <div className="flex items-center justify-between mt-2">
                <div className="text-[8px] text-red-400/70">
                  {activeScenario.elapsed}s / {activeScenario.duration}s
                </div>
                <button
                  onClick={handleCancel}
                  className="text-[9px] px-2 py-0.5 bg-red-500/20 border border-red-500/30 rounded text-red-300 hover:bg-red-500/30"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scenario list */}
        <div className="flex flex-col gap-1.5 mb-3">
          {scenarios.map(s => (
            <button
              key={s.id}
              onClick={() => setSelected(s.id)}
              className={`w-full text-left p-2 rounded-lg border transition-all text-[10px] ${
                selected === s.id
                  ? 'border-[#38bdf8] bg-[#38bdf8]/10 text-[#38bdf8]'
                  : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white/80'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>{SCENARIO_ICONS[s.id] || '🔧'}</span>
                <div>
                  <div className="font-medium text-[10px]">{s.id.replace(/_/g, ' ').toUpperCase()}</div>
                  <div className="text-[8px] opacity-70 mt-0.5 truncate">{s.description}</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Severity selector */}
        <div className="mb-3">
          <div className="text-[8px] text-white/40 uppercase tracking-widest mb-1.5">Severity</div>
          <div className="flex gap-1.5">
            {['low','medium','high','critical'].map(sv => (
              <button
                key={sv}
                onClick={() => setSeverity(sv)}
                className={`flex-1 text-[8px] py-1 rounded border transition-all ${
                  severity === sv
                    ? SEVERITY_COLORS[sv]
                    : 'border-white/10 text-white/40 hover:border-white/20'
                }`}
              >
                {sv}
              </button>
            ))}
          </div>
        </div>

        {/* Trigger button */}
        <button
          onClick={handleTrigger}
          disabled={!selected || triggering || !!activeScenario}
          className="w-full py-2 rounded-lg border border-[#38bdf8]/50 bg-[#38bdf8]/10 text-[#38bdf8] text-[10px] uppercase tracking-widest hover:bg-[#38bdf8]/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          {triggering ? 'Triggering...' : 'Trigger Incident'}
        </button>
      </div>
    </motion.div>
  )
}
