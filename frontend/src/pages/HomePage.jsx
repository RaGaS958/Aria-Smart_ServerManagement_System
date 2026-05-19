import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useAuth } from '../context/AuthContext.jsx'

const FEATURES = [
  {
    icon: '⬡',
    title: 'Federated Intelligence',
    desc: 'Distributed AI agent orchestrates every node in real time — no single point of failure, no central bottleneck.',
    color: '#38bdf8',
  },
  {
    icon: '◈',
    title: 'Live Incident Simulation',
    desc: 'Trigger realistic incidents — CPU spikes, thermal runaway, network partitions — and watch ARIA respond autonomously.',
    color: '#c084fc',
  },
  {
    icon: '◎',
    title: 'SSE Streaming Responses',
    desc: 'Every ARIA thought, tool call, and answer streams live. Watch the agent reason step-by-step in real time.',
    color: '#4ade80',
  },
  {
    icon: '◇',
    title: 'Multi-tool Agent',
    desc: 'Weather APIs, news search, psutil metrics, datacenter lookup — ARIA selects and chains the right tools automatically.',
    color: '#fbbf24',
  },
  {
    icon: '⬟',
    title: 'Role-based Access',
    desc: 'Admin, Operator, and Viewer roles. JWT-protected routes ensure the right people see the right controls.',
    color: '#f472b6',
  },
  {
    icon: '◉',
    title: 'Affective State Engine',
    desc: '14 mood states — from ELATED to FURIOUS — computed from each response and reflected in the entire UI in real time.',
    color: '#fb923c',
  },
]

const STEPS = [
  { n: '01', title: 'Register',   desc: 'Create your account. The first user automatically becomes admin.' },
  { n: '02', title: 'Authenticate', desc: 'Log in to receive a JWT token. All protected API calls require it.' },
  { n: '03', title: 'Connect',    desc: 'WebSocket + SSE channels open. Live metrics stream from the server engine.' },
  { n: '04', title: 'Command',    desc: 'Send natural language commands. ARIA plans, uses tools, streams answers.' },
]

// Animated hex grid background
function HexGrid() {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="hex" x="0" y="0" width="56" height="48" patternUnits="userSpaceOnUse">
          <polygon points="28,2 52,14 52,34 28,46 4,34 4,14" fill="none" stroke="#38bdf8" strokeWidth="0.8" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#hex)" />
    </svg>
  )
}

export default function HomePage() {
  const { user } = useAuth()
  const heroRef = useRef(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '30%'])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0])

  return (
    <div className="bg-[#020406] text-white min-h-screen overflow-x-hidden">
      <style>{`
        @keyframes pulse-slow { 0%,100%{opacity:.3;transform:scale(1)} 50%{opacity:.6;transform:scale(1.05)} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes scan-h { 0%{top:-2px}100%{top:100%} }
        .glow-text { text-shadow: 0 0 40px rgba(56,189,248,0.4), 0 0 80px rgba(56,189,248,0.2); }
        .card-hover { transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease; }
        .card-hover:hover { transform: translateY(-4px); }
      `}</style>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
        <HexGrid />

        {/* Radial gradient spotlight */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.08) 0%, transparent 65%)' }} />
        </div>

        {/* Animated orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[
            { w: 300, h: 300, t: '15%', l: '8%',  delay: 0,   color: '#38bdf8' },
            { w: 200, h: 200, t: '60%', r: '10%',  delay: 2,   color: '#c084fc' },
            { w: 150, h: 150, b: '20%', l: '20%', delay: 1,   color: '#4ade80' },
          ].map((orb, i) => (
            <div key={i} className="absolute rounded-full blur-[80px] opacity-10"
              style={{
                width: orb.w, height: orb.h,
                top: orb.t, left: orb.l, right: orb.r, bottom: orb.b,
                background: orb.color,
                animation: `pulse-slow ${4 + i}s ease-in-out infinite ${orb.delay}s`,
              }} />
          ))}
        </div>

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative z-10 text-center px-6 max-w-5xl">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#38bdf8]/30 bg-[#38bdf8]/5 mb-8"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-[#38bdf8] animate-pulse" />
            <span className="text-[11px] font-mono tracking-[0.2em] text-[#38bdf8] uppercase">AI-Powered Server Management</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-6xl md:text-8xl font-black tracking-tight mb-6 leading-none"
          >
            <span className="block text-white">Meet</span>
            <span className="block glow-text" style={{ color: '#38bdf8' }}>ARIA</span>
            <span className="block text-white/40 text-4xl md:text-5xl font-light tracking-[0.1em] mt-2">
              AFFECTIVE ROOM INTELLIGENCE AGENT
            </span>
          </motion.h1>

          {/* Subhead */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-12 leading-relaxed font-light"
          >
            A real-time AI agent that monitors, diagnoses, and responds to server room events —
            with live metrics, natural language control, and a holographic interface.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            {user ? (
              <Link to="/dashboard"
                className="px-8 py-4 rounded-xl bg-[#38bdf8] text-[#020406] font-bold text-sm uppercase tracking-widest hover:bg-[#7dd3fc] transition-all shadow-[0_0_40px_rgba(56,189,248,0.3)] hover:shadow-[0_0_60px_rgba(56,189,248,0.5)]">
                Open Dashboard →
              </Link>
            ) : (
              <>
                <Link to="/register"
                  className="px-8 py-4 rounded-xl bg-[#38bdf8] text-[#020406] font-bold text-sm uppercase tracking-widest hover:bg-[#7dd3fc] transition-all shadow-[0_0_40px_rgba(56,189,248,0.3)]">
                  Get Access Free
                </Link>
                <Link to="/login"
                  className="px-8 py-4 rounded-xl border border-white/15 text-white/70 font-mono text-sm uppercase tracking-widest hover:border-white/30 hover:text-white transition-all">
                  Sign In
                </Link>
              </>
            )}
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.6 }}
            className="flex justify-center gap-12 mt-16"
          >
            {[['14', 'Mood States'], ['7', 'AI Tools'], ['5', 'Scenarios'], ['<50ms', 'Latency']].map(([n, l]) => (
              <div key={l} className="text-center">
                <div className="text-2xl font-black text-[#38bdf8] tabular-nums">{n}</div>
                <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest mt-1">{l}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <span className="text-[9px] font-mono text-white/30 uppercase tracking-[0.3em]">Scroll</span>
          <div className="w-px h-12 bg-gradient-to-b from-white/30 to-transparent" />
        </motion.div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────── */}
      <section className="relative py-32 px-6">
        <HexGrid />
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <p className="text-[11px] font-mono text-[#38bdf8] uppercase tracking-[0.3em] mb-4">Capabilities</p>
            <h2 className="text-4xl md:text-5xl font-black text-white">
              Built for real-world<br />
              <span className="text-white/30">server operations</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="card-hover relative p-6 rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden group"
                style={{ '--accent': f.color }}
              >
                {/* Hover glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
                  style={{ boxShadow: `inset 0 0 30px ${f.color}10, 0 0 0 1px ${f.color}20` }} />

                <div className="text-3xl mb-4 transition-transform group-hover:scale-110 duration-300" style={{ color: f.color }}>{f.icon}</div>
                <h3 className="text-white font-bold text-lg mb-3 tracking-tight">{f.title}</h3>
                <p className="text-white/45 text-sm leading-relaxed">{f.desc}</p>

                {/* Bottom accent line */}
                <div className="absolute bottom-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ background: `linear-gradient(to right, transparent, ${f.color}60, transparent)` }} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section className="py-32 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <p className="text-[11px] font-mono text-[#38bdf8] uppercase tracking-[0.3em] mb-4">Access model</p>
            <h2 className="text-4xl md:text-5xl font-black">How auth works</h2>
          </motion.div>

          <div className="relative">
            {/* Connector line */}
            <div className="absolute left-8 top-12 bottom-12 w-px bg-gradient-to-b from-[#38bdf8]/30 via-[#38bdf8]/10 to-transparent hidden md:block" />

            <div className="flex flex-col gap-8">
              {STEPS.map((s, i) => (
                <motion.div
                  key={s.n}
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex gap-6 items-start"
                >
                  <div className="flex-shrink-0 w-16 h-16 rounded-2xl border border-[#38bdf8]/30 bg-[#38bdf8]/5 flex items-center justify-center relative">
                    <span className="text-[#38bdf8] font-black font-mono text-lg">{s.n}</span>
                    {i < STEPS.length - 1 && (
                      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-px h-8 bg-gradient-to-b from-[#38bdf8]/20 to-transparent hidden md:block" />
                    )}
                  </div>
                  <div className="pt-3">
                    <h3 className="text-white font-bold text-xl mb-2">{s.title}</h3>
                    <p className="text-white/45 leading-relaxed">{s.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Auth code example */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-16 p-6 rounded-2xl bg-white/[0.03] border border-white/10 font-mono text-sm"
          >
            <div className="text-[10px] text-white/30 uppercase tracking-widest mb-4">Authenticated API request</div>
            <pre className="text-[#38bdf8] text-xs leading-relaxed overflow-auto">{`# After login, include the token in every request:

curl -X POST https://your-api.onrender.com/chat/stream \\
  -H "Authorization: Bearer <your_token>" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "check server health"}'

# WebSocket (metrics stream) — token in query param:
ws://your-api.onrender.com/ws/metrics?token=<your_token>`}</pre>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="py-32 px-6 border-t border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.06) 0%, transparent 60%)' }} />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center relative z-10"
        >
          <h2 className="text-4xl md:text-5xl font-black mb-6">
            Ready to deploy<br /><span className="text-[#38bdf8]">ARIA?</span>
          </h2>
          <p className="text-white/45 mb-10 text-lg leading-relaxed">
            Register in seconds. No credit card. First user becomes admin automatically.
          </p>
          <Link to={user ? '/dashboard' : '/register'}
            className="inline-flex items-center gap-3 px-10 py-5 rounded-2xl bg-[#38bdf8] text-[#020406] font-black text-base uppercase tracking-widest hover:bg-[#7dd3fc] transition-all shadow-[0_0_60px_rgba(56,189,248,0.25)] hover:shadow-[0_0_80px_rgba(56,189,248,0.4)]">
            {user ? 'Open Dashboard' : 'Start for free'} →
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10 px-6 text-center">
        <div className="text-[11px] font-mono text-white/20 tracking-widest uppercase">
          ARIA Core System · Built with FastAPI + React · {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  )
}
