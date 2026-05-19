import { useRef } from 'react'
import { motion } from 'framer-motion'
import { MessageSquare } from 'lucide-react'
import { useServerStore } from '../../store/index.js'
import MetricsChart from '../ui/MetricsChart.jsx'

export default function LeftHologram({ messages, isThinking, messagesEndRef }) {
  const wsConnected = useServerStore(s => s.wsConnected)
  const nodes = useServerStore(s => s.nodes)

  const waveform = Array.from({ length: 45 }, (_, i) => {
    const nids = Object.values(nodes)
    const base = nids.length ? nids[i % nids.length].cpu / 100 : 0.3
    return Math.max(0.05, Math.min(1, base + (Math.random() - 0.5) * 0.1))
  })

  return (
    <div
      className="w-full h-full rounded-xl border border-[#38bdf8]/35 flex flex-col relative overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, rgba(6,18,26,0.97) 0%, rgba(4,8,12,0.97) 100%)',
        boxShadow: '0 0 30px rgba(56,189,248,0.12), inset 0 0 20px rgba(56,189,248,0.05)',
      }}
    >
      {/* Scan line */}
      <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-[#38bdf8]/70 to-transparent"
        style={{ animation: 'scan 3s linear infinite', boxShadow: '0 0 6px #38bdf8' }} />
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#38bdf8]/60 rounded-tl-xl" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#38bdf8]/60 rounded-br-xl" />

      {/* Padding wrapper */}
      <div className="flex flex-col h-full p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 border-b border-[#38bdf8]/20 pb-2">
          <div className="flex items-center gap-1.5 text-[#38bdf8]">
            <MessageSquare className="w-3 h-3" />
            <span className="text-[9px] font-mono tracking-[0.2em] uppercase font-semibold">ARIA Comm Link</span>
          </div>
          <div className={`flex items-center gap-1 text-[7px] font-mono font-bold uppercase tracking-widest ${wsConnected ? 'text-green-400' : 'text-red-400'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            {wsConnected ? 'LIVE' : 'OFFLINE'}
          </div>
        </div>

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1 mb-3 min-h-0"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(56,189,248,0.2) transparent' }}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col w-full ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <span className={`text-[9px] font-mono font-bold uppercase tracking-widest mb-0.5 ${msg.sender === 'user' ? 'text-green-400' : 'text-[#38bdf8]'}`}>
                {msg.sender === 'user' ? 'YOU' : 'ARIA'}
              </span>
              <div className={`text-[11px] font-mono leading-relaxed p-2 rounded-lg max-w-[92%] ${
                msg.sender === 'user'
                  ? 'bg-[#38bdf8]/15 text-[#e0f7ff] border border-[#38bdf8]/30 rounded-tr-none'
                  : 'bg-[#061018] text-[#38bdf8] border border-[#38bdf8]/20 rounded-tl-none'
              }`}
                style={{ textShadow: msg.sender === 'aria' ? '0 0 8px rgba(56,189,248,0.3)' : 'none' }}
              >
                {msg.text || (msg.streaming && (
                  <span className="inline-flex gap-0.5 items-center">
                    {[0, 0.2, 0.4].map((d, i) => (
                      <span key={i} className="w-1 h-1 rounded-full bg-[#38bdf8] inline-block"
                        style={{ animation: `thinking-dots 1.4s infinite ${d}s` }} />
                    ))}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
          {isThinking && !messages.some(m => m.streaming) && (
            <div className="flex items-start">
              <div className="bg-[#061018] border border-[#38bdf8]/20 rounded-lg rounded-tl-none p-2 flex gap-1">
                {[0, 0.2, 0.4].map((d, i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#38bdf8]"
                    style={{ animation: `thinking-dots 1.4s infinite ${d}s` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Waveform */}
        <div className="border border-[#38bdf8]/20 rounded-lg p-2 mb-2" style={{ background: 'rgba(6,16,24,0.8)' }}>
          <div className="text-[8px] text-[#38bdf8] font-mono font-semibold uppercase tracking-[0.15em] mb-1.5">Cluster CPU Load</div>
          <div className="h-10 w-full flex items-center justify-center gap-[2px] overflow-hidden">
            {waveform.map((val, i) => (
              <div key={i} className="w-[3px] rounded-full transition-all duration-150"
                style={{
                  height: `${val * 100}%`,
                  backgroundColor: '#38bdf8',
                  opacity: 0.4 + val * 0.6,
                  boxShadow: val > 0.7 ? '0 0 4px #38bdf8' : 'none',
                }} />
            ))}
          </div>
        </div>

        {/* CPU chart */}
        <div className="border border-[#38bdf8]/20 rounded-lg p-2" style={{ background: 'rgba(6,16,24,0.8)' }}>
          <div className="text-[8px] text-[#38bdf8] font-mono font-semibold uppercase tracking-[0.15em] mb-1">CPU % (30s)</div>
          <MetricsChart metric="cpu" height={55} />
        </div>
      </div>
    </div>
  )
}