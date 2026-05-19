import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Database } from 'lucide-react'
import { useServerStore } from '../../store/index.js'
import MetricsChart from '../ui/MetricsChart.jsx'

function nodeColor(m) {
  if (!m) return '#38bdf8'
  const s = m.status || (m.healthy ? 'ok' : 'critical')
  if (s === 'critical' || (!m.healthy)) return '#ef4444'
  if (s === 'warning'  || m.cpu > 68 || m.temp > 62 || m.ram > 72 || (m.net_in != null && m.net_in < 35)) return '#f59e0b'
  return '#4ade80'
}

function NodeCard({ id, m }) {
  const nc = nodeColor(m)
  return (
    <div
      className="rounded-lg border p-2 w-full"
      style={{ borderColor: `${nc}35`, background: 'rgba(6,16,24,0.85)' }}
    >
      {/* Node header */}
      <div className="flex items-center gap-1.5 mb-2">
        <motion.div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: nc, boxShadow: `0 0 5px ${nc}` }}
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <span className="text-[10px] font-mono font-bold" style={{ color: nc }}>{id}</span>
        <span className={`ml-auto text-[7px] px-1.5 py-0.5 rounded font-mono font-bold
          ${(() => {
              const s = m?.status || (m?.healthy ? 'ok' : 'critical')
              return s === 'critical' ? 'bg-red-500/20 text-red-400' :
                     s === 'warning'  ? 'bg-yellow-500/20 text-yellow-400' :
                                        'bg-green-500/15 text-green-400'
            })()}`}>
          {(() => {
            const s = m?.status || (m?.healthy ? 'ok' : 'critical')
            return s === 'critical' ? 'CRIT' : s === 'warning' ? 'WARN' : 'OK'
          })()}
        </span>
      </div>

      {/* Metrics rows */}
      {[
        ['CPU', m?.cpu,  '%'],
        ['RAM', m?.ram,  '%'],
        ['TMP', m?.temp, '°C'],
      ].map(([k, v, u]) => (
        <div key={k} className="flex items-center gap-1 mb-1 last:mb-0">
          <span className="text-[7px] font-mono text-white/35 w-5 flex-shrink-0">{k}</span>
          <div className="flex-1 h-1 bg-white/8 rounded-full overflow-hidden min-w-0">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: nc }}
              animate={{
                width: u === '°C'
                  ? `${Math.min(100, ((v - 20) / 80) * 100)}%`
                  : `${Math.min(100, v || 0)}%`
              }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <span className="text-[8px] font-mono text-white/80 w-8 text-right tabular-nums flex-shrink-0">
            {v?.toFixed(0)}{u}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function RightHologram() {
  const nodes    = useServerStore(s => s.nodes)
  const scenario = useServerStore(s => s.scenario)
  const [activeChart, setActiveChart] = useState('temp')

  return (
    <div
      className="w-full h-full rounded-xl border border-[#38bdf8]/35 flex flex-col relative overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, rgba(6,18,26,0.97) 0%, rgba(4,8,12,0.97) 100%)',
        boxShadow: '0 0 30px rgba(56,189,248,0.12), inset 0 0 20px rgba(56,189,248,0.05)',
      }}
    >
      {/* Scan line */}
      <div
        className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-[#38bdf8]/70 to-transparent pointer-events-none"
        style={{ animation: 'scan 4s linear infinite', boxShadow: '0 0 6px #38bdf8' }}
      />
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#38bdf8]/60 rounded-tl-xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#38bdf8]/60 rounded-br-xl pointer-events-none" />

      {/* Scrollable content */}
      <div
        className="flex flex-col gap-2.5 p-3 overflow-y-auto flex-1"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(56,189,248,0.15) transparent' }}
      >
        {/* Header */}
        <div className="flex items-center gap-1.5 border-b border-[#38bdf8]/20 pb-2 flex-shrink-0">
          <Database className="w-3 h-3 text-[#38bdf8] flex-shrink-0" />
          <span className="text-[9px] font-mono font-semibold tracking-[0.18em] uppercase text-[#38bdf8]">
            Cluster Topology
          </span>
        </div>

        {/* Active incident banner */}
        <AnimatePresence>
          {scenario && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-lg border border-red-500/40 p-2 flex-shrink-0"
              style={{ background: 'rgba(239,68,68,0.08)' }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse flex-shrink-0" />
                <span className="text-[8px] font-mono font-bold text-red-400 uppercase tracking-widest">
                  Incident Active
                </span>
                <span className="ml-auto text-[7px] font-mono text-red-400/60 tabular-nums flex-shrink-0">
                  {scenario.elapsed}s/{scenario.duration}s
                </span>
              </div>
              <p className="text-[9px] font-mono text-red-300 leading-snug">{scenario.alert}</p>
              <div className="mt-1.5 h-0.5 bg-red-900/40 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-red-400 rounded-full"
                  animate={{ width: `${Math.min(100, (scenario.elapsed / scenario.duration) * 100)}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Node cards — stacked vertically so nothing gets clipped */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          {Object.entries(nodes).map(([id, m]) => (
            <NodeCard key={id} id={id} m={m} />
          ))}
        </div>

        {/* Network graph */}
        <div
          className="rounded-lg border border-[#38bdf8]/20 p-2 flex-shrink-0"
          style={{ background: 'rgba(6,16,24,0.8)' }}
        >
          <div className="text-[8px] font-mono font-semibold text-[#38bdf8] uppercase tracking-[0.15em] mb-1.5">
            Network Graph
          </div>
          <svg viewBox="0 0 220 48" className="w-full" style={{ height: 48 }}>
            <defs>
              <marker id="arr" markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto">
                <path d="M0,0 L4,2 L0,4 Z" fill="#38bdf8" opacity="0.5" />
              </marker>
            </defs>
            {/* Connections */}
            {[
              [[38,24],[110,10],'#38bdf8'],
              [[110,10],[182,24],'#4ade80'],
              [[38,24],[182,24],'#c084fc'],
            ].map(([from,to,c],i)=>(
              <line key={i}
                x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]}
                stroke={c} strokeWidth="1" strokeDasharray="4 3" opacity="0.4"
                style={{ animation: `data-flow 1.5s linear infinite ${i*0.4}s` }}
                markerEnd="url(#arr)"
              />
            ))}
            {/* Nodes */}
            {[['R1',38,24,'#38bdf8'],['R2',110,10,'#4ade80'],['R3',182,24,'#c084fc']].map(([id,x,y,c])=>(
              <g key={id}>
                <circle cx={x} cy={y} r="9" fill="rgba(6,16,24,0.95)" stroke={c} strokeWidth="1.5"/>
                <circle cx={x} cy={y} r="14" fill="none" stroke={c} strokeWidth="0.5" opacity="0.2"
                  style={{ transformOrigin:`${x}px ${y}px`, animation:'pulse-ring 2.5s ease-in-out infinite' }}/>
                <text x={x} y={y+3} textAnchor="middle" fill={c} fontSize="5.5"
                  fontFamily="monospace" fontWeight="bold">{id}</text>
              </g>
            ))}
          </svg>
        </div>

        {/* Chart type selector */}
        <div className="flex gap-1.5 flex-shrink-0">
          {[['temp','Temp °C'],['ram','RAM %'],['cpu','CPU %']].map(([k,label])=>(
            <button
              key={k}
              onClick={()=>setActiveChart(k)}
              className={`flex-1 text-[8px] font-mono font-semibold py-1.5 rounded-lg border transition-all ${
                activeChart===k
                  ? 'bg-[#38bdf8]/15 border-[#38bdf8]/50 text-[#38bdf8]'
                  : 'border-white/10 text-white/35 hover:border-white/25 hover:text-white/60'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Live chart */}
        <div
          className="rounded-lg border border-[#38bdf8]/20 p-2 flex-shrink-0"
          style={{ background: 'rgba(6,16,24,0.8)' }}
        >
          <div className="text-[8px] font-mono font-semibold text-[#38bdf8] uppercase tracking-[0.15em] mb-1">
            {activeChart==='temp' ? 'Temperature (°C)' : activeChart==='ram' ? 'RAM (%)' : 'CPU (%)'}
          </div>
          <MetricsChart metric={activeChart} height={70} />
        </div>
      </div>
    </div>
  )
}