import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useServerStore } from '../store/index.js'
import { useAuth } from '../context/AuthContext.jsx'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell, PieChart, Pie,
} from 'recharts'

const COLORS = { R1: '#38bdf8', R2: '#4ade80', R3: '#c084fc' }
const MOOD_COLORS = {
  neutral:'#0ea5e9', elated:'#84cc16', resolute:'#3b82f6', shocked:'#d946ef',
  puzzled:'#f59e0b', melancholy:'#60a5fa', furious:'#ef4444', panicked:'#f97316',
  adoring:'#ec4899', smile:'#cbd5e1', retro:'#d97706', dreamy:'#c084fc',
  sunny:'#fbbf24', calm:'#818cf8',
}

function StatCard({ label, value, sub, color = '#38bdf8', trend }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-5 rounded-2xl border border-white/8 bg-white/[0.02] relative overflow-hidden group"
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
        style={{ boxShadow: `inset 0 0 30px ${color}08` }} />
      <div className="text-[10px] font-mono text-white/35 uppercase tracking-widest mb-3">{label}</div>
      <div className="text-3xl font-black tabular-nums" style={{ color }}>{value}</div>
      {sub && <div className="text-[11px] text-white/30 mt-1 font-mono">{sub}</div>}
      {trend !== undefined && (
        <div className={`text-[10px] font-mono mt-2 ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}% vs last window
        </div>
      )}
    </motion.div>
  )
}

const CUSTOM_TOOLTIP = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#061016] border border-[#38bdf8]/30 rounded-xl p-3 text-[11px] font-mono shadow-xl">
      <div className="text-white/40 mb-2">{label}</div>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const nodes = useServerStore(s => s.nodes)
  const history = useServerStore(s => s.history)
  const scenario = useServerStore(s => s.scenario)
  const { user } = useAuth()

  const [moodLog, setMoodLog] = useState(() =>
    Array.from({ length: 20 }, (_, i) => ({
      t: new Date(Date.now() - (20 - i) * 5000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      mood: Object.keys(MOOD_COLORS)[Math.floor(Math.random() * 14)],
    }))
  )
  const [incidentLog, setIncidentLog] = useState([])
  const prevScenario = useRef(null)

  // Track scenario start/end
  useEffect(() => {
    if (scenario && !prevScenario.current) {
      setIncidentLog(prev => [{
        id: Date.now(),
        name: scenario.name,
        mood: scenario.mood,
        started: new Date().toLocaleTimeString(),
        duration: null,
        startedAt: Date.now(),
      }, ...prev].slice(0, 20))
    }
    if (!scenario && prevScenario.current) {
      setIncidentLog(prev => prev.map((inc, i) =>
        i === 0 && !inc.duration
          ? { ...inc, duration: `${((Date.now() - inc.startedAt) / 1000).toFixed(0)}s` }
          : inc
      ))
    }
    prevScenario.current = scenario
  }, [scenario])

  // Build chart data from history
  const buildTimeData = (metric) => {
    const r1 = history.R1?.[metric] || []
    const r2 = history.R2?.[metric] || []
    const r3 = history.R3?.[metric] || []
    const len = Math.max(r1.length, r2.length, r3.length)
    return Array.from({ length: Math.min(len, 30) }, (_, i) => {
      const idx = (r1.length - Math.min(len, 30) + i)
      return {
        t: i,
        R1: r1[Math.max(0, idx)]?.y ?? 0,
        R2: r2[Math.max(0, idx)]?.y ?? 0,
        R3: r3[Math.max(0, idx)]?.y ?? 0,
      }
    })
  }

  const cpuData = buildTimeData('cpu')
  const ramData = buildTimeData('ram')
  const tempData = buildTimeData('temp')

  const radarData = Object.entries(nodes).map(([id, m]) => ({
    node: id, CPU: m.cpu, RAM: m.ram, TEMP: Math.min(100, ((m.temp - 20) / 90) * 100),
    NET: Math.min(100, (m.net_in / 10)), DISK: m.disk_io,
  }))

  const healthPie = [
    { name: 'Healthy',  value: Object.values(nodes).filter(n => n.status === 'ok'       || (!n.status && n.healthy)).length,  color: '#4ade80' },
    { name: 'Warning',  value: Object.values(nodes).filter(n => n.status === 'warning'                                ).length,  color: '#f59e0b' },
    { name: 'Critical', value: Object.values(nodes).filter(n => n.status === 'critical'  || (!n.status && !n.healthy) ).length,  color: '#ef4444' },
  ].filter(e => e.value > 0 || e.name === 'Healthy')

  const avgCPU = (Object.values(nodes).reduce((a, n) => a + (n.cpu || 0), 0) / 3).toFixed(1)
  const avgRAM = (Object.values(nodes).reduce((a, n) => a + (n.ram || 0), 0) / 3).toFixed(1)
  const maxTemp = Math.max(...Object.values(nodes).map(n => n.temp || 0)).toFixed(1)
  const totalNet = Object.values(nodes).reduce((a, n) => a + (n.net_in || 0) + (n.net_out || 0), 0).toFixed(0)

  return (
    <div className="min-h-screen bg-[#020406] text-white pt-20 pb-16 px-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-[10px] font-mono text-[#38bdf8] uppercase tracking-[0.3em] mb-2">Real-time analytics</p>
              <h1 className="text-4xl font-black tracking-tight">Cluster Overview</h1>
              <p className="text-white/40 text-sm mt-1 font-mono">
                Logged in as <span className="text-[#38bdf8]/70">{user?.name}</span> ·
                <span className={`ml-1 ${user?.role === 'admin' ? 'text-[#38bdf8]' : 'text-white/50'}`}>{user?.role}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[11px] font-mono text-white/60 uppercase tracking-widest">Live · 500ms refresh</span>
            </div>
          </div>
        </motion.div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Avg CPU" value={`${avgCPU}%`} color="#38bdf8" sub="across R1 R2 R3" />
          <StatCard label="Avg RAM" value={`${avgRAM}%`} color="#c084fc" sub="across R1 R2 R3" />
          <StatCard label="Peak Temp" value={`${maxTemp}°C`} color={parseFloat(maxTemp) > 75 ? '#ef4444' : '#f59e0b'} sub="hottest node" />
          <StatCard label="Net Throughput" value={`${totalNet}`} color="#4ade80" sub="Mbps combined" />
        </div>

        {/* Active incident banner */}
        {scenario && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-6 p-4 rounded-2xl bg-red-500/8 border border-red-500/30 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              <span className="text-red-300 font-mono text-sm font-bold uppercase tracking-widest">Incident Active</span>
              <span className="text-red-400/70 font-mono text-xs">{scenario.alert}</span>
            </div>
            <div className="text-[11px] font-mono text-red-400/60">
              {scenario.elapsed}s / {scenario.duration}s
            </div>
          </motion.div>
        )}

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

          {/* CPU area chart */}
          <div className="lg:col-span-2 p-5 rounded-2xl border border-white/8 bg-white/[0.02]">
            <div className="text-[10px] font-mono text-white/35 uppercase tracking-widest mb-4">CPU Usage (%) — 30s window</div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={cpuData}>
                <defs>
                  {Object.entries(COLORS).map(([k, c]) => (
                    <linearGradient key={k} id={`grad${k}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={c} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={c} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="t" tick={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CUSTOM_TOOLTIP />} />
                {Object.entries(COLORS).map(([k, c]) => (
                  <Area key={k} type="monotone" dataKey={k} stroke={c} strokeWidth={1.5} fill={`url(#grad${k})`} dot={false} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Health pie */}
          <div className="p-5 rounded-2xl border border-white/8 bg-white/[0.02] flex flex-col">
            <div className="text-[10px] font-mono text-white/35 uppercase tracking-widest mb-4">Node Health Status</div>
            <div className="flex-1 flex items-center justify-center">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={healthPie} cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                    dataKey="value" stroke="none">
                    {healthPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<CUSTOM_TOOLTIP />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6">
              {healthPie.map(e => (
                <div key={e.name} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: e.color }} />
                  <span className="text-[10px] font-mono text-white/50">{e.name}: {e.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">

          {/* RAM bar */}
          <div className="p-5 rounded-2xl border border-white/8 bg-white/[0.02]">
            <div className="text-[10px] font-mono text-white/35 uppercase tracking-widest mb-4">RAM Usage (%) — 30s window</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={ramData.filter((_, i) => i % 3 === 0)}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="t" tick={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CUSTOM_TOOLTIP />} />
                {Object.entries(COLORS).map(([k, c]) => <Bar key={k} dataKey={k} fill={c} opacity={0.8} radius={[2,2,0,0]} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Radar */}
          <div className="p-5 rounded-2xl border border-white/8 bg-white/[0.02]">
            <div className="text-[10px] font-mono text-white/35 uppercase tracking-widest mb-4">Node Performance Radar</div>
            <ResponsiveContainer width="100%" height={160}>
              <RadarChart data={[
                { metric: 'CPU',  R1: nodes.R1?.cpu, R2: nodes.R2?.cpu, R3: nodes.R3?.cpu },
                { metric: 'RAM',  R1: nodes.R1?.ram, R2: nodes.R2?.ram, R3: nodes.R3?.ram },
                { metric: 'Temp', R1: Math.min(100,((nodes.R1?.temp-20)/90)*100), R2: Math.min(100,((nodes.R2?.temp-20)/90)*100), R3: Math.min(100,((nodes.R3?.temp-20)/90)*100) },
                { metric: 'Disk', R1: nodes.R1?.disk_io, R2: nodes.R2?.disk_io, R3: nodes.R3?.disk_io },
                { metric: 'Net',  R1: Math.min(100,(nodes.R1?.net_in||0)/10), R2: Math.min(100,(nodes.R2?.net_in||0)/10), R3: Math.min(100,(nodes.R3?.net_in||0)/10) },
              ]}>
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'monospace' }} />
                {Object.entries(COLORS).map(([k, c]) => (
                  <Radar key={k} name={k} dataKey={k} stroke={c} fill={c} fillOpacity={0.08} strokeWidth={1.5} />
                ))}
                <Tooltip content={<CUSTOM_TOOLTIP />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom row: node table + incident log */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Node metrics table */}
          <div className="p-5 rounded-2xl border border-white/8 bg-white/[0.02]">
            <div className="text-[10px] font-mono text-white/35 uppercase tracking-widest mb-4">Node Details</div>
            <table className="w-full text-[12px] font-mono">
              <thead>
                <tr className="text-white/25 text-[10px] uppercase tracking-widest">
                  <td className="pb-3">Node</td>
                  <td className="pb-3 text-right">CPU</td>
                  <td className="pb-3 text-right">RAM</td>
                  <td className="pb-3 text-right">Temp</td>
                  <td className="pb-3 text-right">Net↑↓</td>
                  <td className="pb-3 text-right">Status</td>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {Object.entries(nodes).map(([id, m]) => {
                  const c = COLORS[id]
                  return (
                    <tr key={id}>
                      <td className="py-3 font-bold" style={{ color: c }}>{id}</td>
                      <td className={`py-3 text-right ${m.cpu > 85 ? 'text-red-400' : m.cpu > 68 ? 'text-yellow-400' : 'text-white/70'}`}>{m.cpu?.toFixed(1)}%</td>
                      <td className={`py-3 text-right ${m.ram > 90 ? 'text-red-400' : m.ram > 72 ? 'text-yellow-400' : 'text-white/70'}`}>{m.ram?.toFixed(1)}%</td>
                      <td className={`py-3 text-right ${m.temp > 80 ? 'text-red-400' : m.temp > 62 ? 'text-yellow-400' : 'text-white/70'}`}>{m.temp?.toFixed(1)}°C</td>
                      <td className={`py-3 text-right text-[10px] ${m.net_in < 10 ? 'text-red-400' : m.net_in < 35 ? 'text-yellow-400' : 'text-white/50'}`}>{m.net_in?.toFixed(0)}↑ {m.net_out?.toFixed(0)}↓</td>
                      <td className="py-3 text-right">
                        {(() => {
                          const s = m.status || (m.healthy ? 'ok' : 'critical')
                          return (
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                              s === 'critical' ? 'bg-red-500/20 text-red-400' :
                              s === 'warning'  ? 'bg-yellow-500/20 text-yellow-400' :
                                                 'bg-green-500/15 text-green-400'
                            }`}>
                              {s === 'critical' ? 'CRIT' : s === 'warning' ? 'WARN' : 'OK'}
                            </span>
                          )
                        })()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Incident log */}
          <div className="p-5 rounded-2xl border border-white/8 bg-white/[0.02]">
            <div className="text-[10px] font-mono text-white/35 uppercase tracking-widest mb-4">Incident Log</div>
            {incidentLog.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-white/20">
                <span className="text-3xl mb-2">◉</span>
                <span className="text-[11px] font-mono uppercase tracking-widest">No incidents recorded</span>
                <span className="text-[10px] font-mono text-white/15 mt-1">Use ⚠ button in dashboard to simulate</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                {incidentLog.map(inc => (
                  <div key={inc.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03] border border-white/8 text-[11px] font-mono">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: MOOD_COLORS[inc.mood] || '#38bdf8' }} />
                      <span className="text-white/70 uppercase">{inc.name?.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex items-center gap-3 text-white/30">
                      <span>{inc.started}</span>
                      {inc.duration && <span className="text-green-400/60">{inc.duration}</span>}
                      {!inc.duration && <span className="text-red-400/60 animate-pulse">ACTIVE</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}