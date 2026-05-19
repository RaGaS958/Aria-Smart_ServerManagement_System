import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

const STACK = [
  { layer: 'Frontend',   items: ['React 18', 'Vite', 'Framer Motion', 'GSAP', 'Three.js', 'Chart.js', 'Zustand', 'React Query', 'Tailwind CSS'],  color: '#38bdf8' },
  { layer: 'Backend',    items: ['FastAPI', 'LangChain 1.x', 'Mistral AI', 'SSE Streaming', 'WebSocket', 'JWT Auth', 'SQLite + SQLModel', 'psutil'],          color: '#c084fc' },
  { layer: 'Agent Tools',items: ['OpenWeatherMap', 'Tavily Search', 'psutil Metrics', 'Simulation Engine', 'Datacenter Lookup', 'Tool Approval Gate'],          color: '#4ade80' },
  { layer: 'Deployment', items: ['Vercel (Frontend)', 'Render (Backend)', 'Docker + Compose', 'GitHub Actions CI/CD', 'SQLite persistent disk', 'ENV secrets'], color: '#fbbf24' },
]

const ROLES = [
  { role: 'Admin',    badge: '◈', color: '#38bdf8', perms: ['Full dashboard access', 'Trigger incidents', 'Approve tool calls', 'Manage users', 'View audit log', 'All API endpoints'] },
  { role: 'Operator', badge: '◎', color: '#4ade80', perms: ['Full dashboard access', 'Trigger incidents', 'Approve tool calls', 'View analytics', 'Chat with ARIA', 'Metrics WebSocket'] },
  { role: 'Viewer',   badge: '◇', color: '#f59e0b', perms: ['View dashboard (read-only)', 'View analytics', 'View chat history', 'Metrics WebSocket', '— No write access —', '— No tool approval —'] },
]

const ARCH_NODES = [
  { id: 'User',       x: 50,  y: 10,  color: '#38bdf8' },
  { id: 'React UI',  x: 50,  y: 30,  color: '#c084fc' },
  { id: 'FastAPI',   x: 50,  y: 55,  color: '#4ade80' },
  { id: 'LangChain', x: 20,  y: 75,  color: '#fbbf24' },
  { id: 'Tools',     x: 50,  y: 80,  color: '#f472b6' },
  { id: 'SQLite',    x: 80,  y: 75,  color: '#fb923c' },
]

function ArchDiagram() {
  const edges = [
    ['User','React UI'], ['React UI','FastAPI'], ['FastAPI','LangChain'],
    ['FastAPI','SQLite'], ['LangChain','Tools'],
  ]
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" style={{ maxHeight: 320 }}>
      {edges.map(([a, b]) => {
        const from = ARCH_NODES.find(n => n.id === a)
        const to   = ARCH_NODES.find(n => n.id === b)
        return (
          <line key={`${a}-${b}`}
            x1={from.x} y1={from.y + 4} x2={to.x} y2={to.y - 4}
            stroke="rgba(56,189,248,0.2)" strokeWidth="0.5" strokeDasharray="2 1" />
        )
      })}
      {ARCH_NODES.map(n => (
        <g key={n.id}>
          <circle cx={n.x} cy={n.y} r="5" fill={n.color} opacity="0.15" />
          <circle cx={n.x} cy={n.y} r="2.5" fill={n.color} />
          <text x={n.x} y={n.y + 10} textAnchor="middle" fontSize="4" fill="rgba(255,255,255,0.5)" fontFamily="monospace">{n.id}</text>
        </g>
      ))}
    </svg>
  )
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#020406] text-white pt-20 pb-20 px-6">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-20">
          <p className="text-[11px] font-mono text-[#38bdf8] uppercase tracking-[0.3em] mb-4">System documentation</p>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-6">
            About <span className="text-[#38bdf8]">ARIA</span>
          </h1>
          <p className="text-white/40 text-lg max-w-2xl mx-auto leading-relaxed">
            ARIA is a full-stack AI agent system designed to demonstrate real-world intelligent server room management —
            combining a LangChain-powered agent, live metrics, natural language control, and an affective UI.
          </p>
        </motion.div>

        {/* Architecture diagram + description */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="p-6 rounded-2xl border border-white/8 bg-white/[0.02]"
          >
            <div className="text-[10px] font-mono text-white/35 uppercase tracking-widest mb-4">System architecture</div>
            <ArchDiagram />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex flex-col gap-5"
          >
            {[
              { t: 'How auth gates server access', b: 'When you register, the backend issues a JWT containing your user ID and role. Every API call (REST + WebSocket) validates this token. Unauthenticated requests are rejected with 401. The dashboard, analytics page, and all tool calls require a valid token.' },
              { t: 'How the agent works', b: 'ARIA uses LangChain\'s create_agent (compiled graph) with Mistral Small. You send a message → the agent plans → selects tools → executes them → extracts mood from the reply → streams everything via SSE. The mood tag drives the entire UI color and shape in real time.' },
              { t: 'How simulations work', b: 'The simulation engine uses an Ornstein-Uhlenbeck stochastic process to generate realistic metric drift — not random noise. Each scenario (CPU spike, thermal runaway, etc.) defines target values at timed phases, and the OU process moves metrics smoothly toward them.' },
            ].map(item => (
              <div key={item.t} className="p-5 rounded-2xl border border-white/8 bg-white/[0.02]">
                <h3 className="text-white font-bold mb-2 tracking-tight">{item.t}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{item.b}</p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Role-based access */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="text-center mb-10">
            <p className="text-[11px] font-mono text-[#38bdf8] uppercase tracking-[0.3em] mb-3">Access control</p>
            <h2 className="text-3xl font-black">Role-based permissions</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {ROLES.map((r, i) => (
              <motion.div
                key={r.role}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-6 rounded-2xl border bg-white/[0.02] relative overflow-hidden"
                style={{ borderColor: `${r.color}25` }}
              >
                <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(to right, transparent, ${r.color}50, transparent)` }} />
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-2xl" style={{ color: r.color }}>{r.badge}</span>
                  <span className="font-black text-xl text-white">{r.role}</span>
                </div>
                <ul className="flex flex-col gap-2">
                  {r.perms.map(p => (
                    <li key={p} className={`flex items-center gap-2 text-[12px] font-mono ${p.startsWith('—') ? 'text-white/20' : 'text-white/55'}`}>
                      <span style={{ color: p.startsWith('—') ? 'rgba(255,255,255,0.15)' : r.color }}>
                        {p.startsWith('—') ? '✕' : '✓'}
                      </span>
                      {p.replace('— ', '')}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
          <div className="mt-4 p-4 rounded-xl bg-[#38bdf8]/5 border border-[#38bdf8]/20 text-[12px] font-mono text-[#38bdf8]/70 text-center">
            💡 First registered user automatically becomes <strong>Admin</strong>. All others default to <strong>Operator</strong>.
          </div>
        </motion.div>

        {/* Tech stack */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="text-center mb-10">
            <p className="text-[11px] font-mono text-[#38bdf8] uppercase tracking-[0.3em] mb-3">Technology</p>
            <h2 className="text-3xl font-black">Tech stack</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {STACK.map((s, i) => (
              <motion.div
                key={s.layer}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="p-5 rounded-2xl border border-white/8 bg-white/[0.02]"
              >
                <div className="text-[10px] font-mono uppercase tracking-widest mb-4" style={{ color: s.color }}>{s.layer}</div>
                <div className="flex flex-wrap gap-2">
                  {s.items.map(item => (
                    <span key={item} className="px-2.5 py-1 rounded-lg border text-[11px] font-mono text-white/60 bg-white/[0.03]"
                      style={{ borderColor: `${s.color}20` }}>
                      {item}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Repo / links */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center p-10 rounded-2xl border border-white/8 bg-white/[0.02] relative overflow-hidden"
        >
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(56,189,248,0.05) 0%, transparent 65%)' }} />
          <div className="relative z-10">
            <h2 className="text-3xl font-black mb-4">Ready to get started?</h2>
            <p className="text-white/40 mb-8 max-w-md mx-auto">Deploy in minutes. Check the README for full setup instructions, API docs, and deployment guides.</p>
            <div className="flex justify-center gap-4 flex-wrap">
              <Link to="/register" className="px-8 py-4 rounded-xl bg-[#38bdf8] text-[#020406] font-black text-sm uppercase tracking-widest hover:bg-[#7dd3fc] transition-all shadow-[0_0_30px_rgba(56,189,248,0.2)]">
                Create account →
              </Link>
              <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer"
                className="px-8 py-4 rounded-xl border border-white/15 text-white/60 font-mono text-sm uppercase tracking-widest hover:border-white/30 hover:text-white transition-all">
                API Docs ↗
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
