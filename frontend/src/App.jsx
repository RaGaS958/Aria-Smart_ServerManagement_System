import { useState, useEffect, useRef, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import {
  Wifi, Mic, Activity, Grid,
  ChevronLeft, ChevronRight, Send, Settings,
  AlertTriangle, Zap, ShieldCheck
} from 'lucide-react'

import { useAriaStore, useChatStore, useServerStore, useUIStore } from './store/index.js'
import { useChat } from './hooks/useChat.js'
import { useMetricsWS } from './hooks/useMetricsWS.js'
import LeftHologram from './components/holograms/LeftHologram.jsx'
import RightHologram from './components/holograms/RightHologram.jsx'
import AriaDisplay, { spectrumStates } from './components/holograms/AriaDisplay.jsx'
import AlertBanner from './components/ui/AlertBanner.jsx'
import SimPanel from './components/ui/SimPanel.jsx'

gsap.registerPlugin(useGSAP)

export default function App() {
  const [time, setTime] = useState(new Date())
  const [input, setInput] = useState('')
  const [showSimPanel, setShowSimPanel] = useState(false)

  const mood = useAriaStore(s => s.mood)
  const isThinking = useAriaStore(s => s.isThinking)
  const wsConnected = useServerStore(s => s.wsConnected)
  const nodes = useServerStore(s => s.nodes)
  const activeScenario = useServerStore(s => s.scenario)

  const showLeft = useUIStore(s => s.showLeft)
  const showRight = useUIStore(s => s.showRight)
  const showTelemetry = useUIStore(s => s.showTelemetry)
  const showSettings = useUIStore(s => s.showSettings)
  const toggle = useUIStore(s => s.toggle)

  const { send, messages, isStreaming } = useChat()
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  useMetricsWS()

  const activeState = spectrumStates.find(s => s.id === mood) || spectrumStates[0]

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(() => {
    if (!input.trim() || isStreaming) return
    send(input.trim())
    setInput('')
    inputRef.current?.focus()
  }, [input, isStreaming, send])

  function nodeColor(m) {
    if (!m?.healthy || m.cpu > 90 || m.temp > 85) return '#ef4444'
    if (m.cpu > 70 || m.temp > 70 || m.ram > 85) return '#f59e0b'
    return '#4ade80'
  }

  const timeString = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="w-full overflow-hidden bg-[#020406] relative flex flex-col items-center justify-center cursor-default select-none font-sans py-2" style={{height:'calc(100vh - 72px)'}}>
      <style>{`
        @keyframes scan { 0%{top:0}100%{top:100%} }
        @keyframes blink-fast { 0%,100%{opacity:.1}50%{opacity:1} }
        @keyframes blink-slow { 0%,100%{opacity:.2}50%{opacity:.8} }
        @keyframes thinking-dots { 0%,80%,100%{transform:scale(0)}40%{transform:scale(1)} }
        @keyframes pulse-ring { 0%,100%{transform:scale(.85);opacity:.2}50%{transform:scale(1.15);opacity:.5} }
        @keyframes data-flow { from{stroke-dashoffset:20}to{stroke-dashoffset:0} }
      `}</style>

      {/* BG server room */}
      <div className="fixed inset-0 z-0 blur-[8px] opacity-60 pointer-events-none bg-[#010408]">
        <div className="absolute bottom-0 w-full h-[40%] bg-[linear-gradient(rgba(56,189,248,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.05)_1px,transparent_1px)] bg-[size:60px_30px]" style={{transform:'perspective(500px) rotateX(75deg)',transformOrigin:'top'}}/>
        {[5,25,65,85].map((left,i)=>{
          const nid=['R1','R2','R3','R1'][i]; const nc=nodeColor(nodes[nid])
          return(<div key={i} className="absolute top-[3%] bottom-[3%] w-[12%] bg-[#060d14] border-x border-[#1a2c3a]/40 flex flex-col gap-3 p-2" style={{left:`${left}%`}}>
            {Array.from({length:9}).map((_,j)=>(<div key={j} className="w-full flex-1 border border-white/5 rounded-sm flex items-center justify-end px-2 gap-1.5 bg-black/50">
              <div className="w-1.5 h-1.5 rounded-full" style={{backgroundColor:nc,boxShadow:`0 0 5px ${nc}`,animation:`blink-fast ${1.5+Math.random()}s infinite ${Math.random()*2}s`}}/>
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" style={{animation:`blink-slow ${2+Math.random()*2}s infinite ${Math.random()}s`}}/>
              {activeScenario&&<div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"/>}
            </div>))}
          </div>)
        })}
      </div>

      {/* Neon pillar */}
      <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[800px] z-10 shadow-[0_0_150px_rgba(0,0,0,1)]">
        <div className="absolute inset-0 flex z-0">
          <div className="w-[20%] h-full bg-gradient-to-r from-[#020305] to-[#0a0e14]"/>
          <div className="w-[60%] h-full bg-gradient-to-b from-[#111721] via-[#090d13] to-[#111721]"/>
          <div className="w-[20%] h-full bg-gradient-to-l from-[#020305] to-[#0a0e14]"/>
        </div>
        <motion.svg className="absolute inset-0 w-full h-full z-10" viewBox="0 0 800 1000" preserveAspectRatio="none" animate={{color:activeState.color}} transition={{duration:1}} style={{color:activeState.color}}>
          <defs><filter id="neon-glow"><feGaussianBlur stdDeviation="15" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
          <g opacity="0.3" stroke="currentColor" strokeWidth="26" fill="none" strokeLinejoin="round">
            <polyline points="-10,40 160,65 640,40 810,75"/><polyline points="-10,200 160,225 640,250 810,215"/>
            <polyline points="-10,380 160,340 640,365 810,325"/><polyline points="-10,530 160,555 640,530 810,565"/>
          </g>
          <g filter="url(#neon-glow)" stroke="currentColor" strokeWidth="18" fill="none" opacity="0.9" strokeLinejoin="round">
            <polyline points="-10,40 160,65 640,40 810,75"/><polyline points="-10,200 160,225 640,250 810,215"/>
            <polyline points="-10,380 160,340 640,365 810,325"/><polyline points="-10,530 160,555 640,530 810,565"/>
          </g>
          <g stroke="#ffffff" strokeWidth="6" fill="none" opacity="0.9" strokeLinejoin="round">
            <polyline points="-10,40 160,65 640,40 810,75"/><polyline points="-10,200 160,225 640,250 810,215"/>
            <polyline points="-10,380 160,340 640,365 810,325"/><polyline points="-10,530 160,555 640,530 810,565"/>
          </g>
        </motion.svg>
        <motion.div className="absolute inset-0 z-0 mix-blend-screen pointer-events-none" animate={{background:`radial-gradient(circle at 50% 50%, ${activeState.color}33 0%, transparent 60%)`}} transition={{duration:1}}/>
      </div>

      {/* Main assembly */}
      <div className="relative z-20 flex flex-col items-center mt-12 mb-64">

        {/* Left hologram */}
        <motion.div className="absolute top-1/2 left-[-295px] w-[280px] h-[520px] origin-right"
          animate={{opacity:showLeft?1:0, x:showLeft?0:80, rotateY:showLeft?10:45, pointerEvents:showLeft?'auto':'none'}}
          style={{y:'-50%',perspective:1500}} transition={{type:'spring',stiffness:180,damping:28}}>
          <LeftHologram messages={messages} isThinking={isThinking} messagesEndRef={messagesEndRef}/>
        </motion.div>

        {/* Right hologram */}
        <motion.div className="absolute top-1/2 right-[-295px] w-[280px] h-[520px] origin-left"
          animate={{opacity:showRight?1:0, x:showRight?0:-80, rotateY:showRight?-10:-45, pointerEvents:showRight?'auto':'none'}}
          style={{y:'-50%',perspective:1500}} transition={{type:'spring',stiffness:180,damping:28}}>
          <RightHologram/>
        </motion.div>

        {/* Center main display */}
        <div className="relative z-30 w-[740px] h-[520px] bg-[#1a1c1e] rounded-[1.5rem] p-3 shadow-[0_30px_60px_rgba(0,0,0,0.8),inset_0_2px_4px_rgba(255,255,255,0.1)] border border-[#2a2c2e]">
          <div className="w-full h-full rounded-[1rem] bg-gradient-to-b from-[#0b161e] via-[#060c12] to-[#04080c] overflow-hidden relative flex flex-col p-4 shadow-[inset_0_0_40px_rgba(0,0,0,1)] border border-[#1a2c3a]">
            <AlertBanner/>
            <div className="absolute top-[-50%] left-[-20%] w-[150%] h-[150%] bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none rotate-[15deg] z-10"/>

            {/* Toggle buttons */}
            <button onClick={()=>toggle('showLeft')} className={`absolute top-1/2 -translate-y-1/2 left-0 w-8 h-24 rounded-r-lg border border-l-0 border-[#38bdf8]/40 flex items-center justify-center z-50 cursor-pointer transition-all ${showLeft?'bg-[#38bdf8]/20 text-[#38bdf8]':'bg-[#0b161e]/80 text-[#38bdf8]/50 hover:bg-[#38bdf8]/30 hover:text-[#38bdf8]'}`}>
              <div className="flex flex-col items-center gap-1">{showLeft?<ChevronLeft className="w-5 h-5"/>:<ChevronRight className="w-5 h-5"/>}<div className="w-1 h-6 rounded-full bg-current shadow-[0_0_5px_currentColor]"/></div>
            </button>
            <button onClick={()=>toggle('showRight')} className={`absolute top-1/2 -translate-y-1/2 right-0 w-8 h-24 rounded-l-lg border border-r-0 border-[#38bdf8]/40 flex items-center justify-center z-50 cursor-pointer transition-all ${showRight?'bg-[#38bdf8]/20 text-[#38bdf8]':'bg-[#0b161e]/80 text-[#38bdf8]/50 hover:bg-[#38bdf8]/30 hover:text-[#38bdf8]'}`}>
              <div className="flex flex-col items-center gap-1">{showRight?<ChevronRight className="w-5 h-5"/>:<ChevronLeft className="w-5 h-5"/>}<div className="w-1 h-6 rounded-full bg-current shadow-[0_0_5px_currentColor]"/></div>
            </button>

            {/* Top nav */}
            <div className="absolute top-4 left-4 z-40 flex gap-2">
              <button onClick={()=>toggle('showSettings')} className={`p-2 rounded-lg border transition-all ${showSettings?'bg-[#38bdf8]/30 border-[#38bdf8] text-[#38bdf8]':'bg-[#091a24]/60 border-[#38bdf8]/30 text-[#38bdf8]/70 hover:bg-[#38bdf8]/20'}`}><Settings className="w-4 h-4"/></button>
              <button onClick={()=>setShowSimPanel(v=>!v)} className={`p-2 rounded-lg border transition-all ${showSimPanel?'bg-red-500/30 border-red-500/80 text-red-400':'bg-[#091a24]/60 border-[#38bdf8]/30 text-[#38bdf8]/70 hover:bg-red-500/20 hover:text-red-400'}`}><AlertTriangle className="w-4 h-4"/></button>
            </div>
            <div className="absolute top-4 right-4 z-40 flex gap-2 items-center">
              <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[8px] font-mono ${wsConnected?'border-green-500/30 text-green-400 bg-green-500/10':'border-red-500/30 text-red-400 bg-red-500/10'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${wsConnected?'bg-green-400 animate-pulse':'bg-red-400'}`}/>{wsConnected?'LIVE':'OFFLINE'}
              </div>
              <button onClick={()=>toggle('showTelemetry')} className={`p-2 rounded-lg border transition-all ${showTelemetry?'bg-[#38bdf8]/30 border-[#38bdf8] text-[#38bdf8]':'bg-[#091a24]/60 border-[#38bdf8]/30 text-[#38bdf8]/70 hover:bg-[#38bdf8]/20'}`}><Activity className="w-4 h-4"/></button>
            </div>

            <AnimatePresence>{showSimPanel&&<SimPanel onClose={()=>setShowSimPanel(false)}/>}</AnimatePresence>

            {/* Settings overlay */}
            <AnimatePresence>
              {showSettings&&(
                <motion.div initial={{opacity:0,scale:0.95,y:-4}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.95,y:-4}}
                  className="absolute top-16 left-4 w-52 bg-[#061016]/95 border border-[#38bdf8]/40 rounded-xl p-4 z-50 backdrop-blur-xl shadow-[0_20px_40px_rgba(0,0,0,0.8)]">
                  <div className="text-[#38bdf8] text-[9px] uppercase tracking-[0.2em] font-mono border-b border-[#38bdf8]/30 pb-2 mb-3">System Config</div>
                  {[['Audio','ON','text-green-400'],['Holo Opacity','85%','text-[#38bdf8]'],['Debug','OFF','text-white/40'],['Sim Mode',wsConnected?'ON':'OFF',wsConnected?'text-green-400':'text-red-400']].map(([l,v,c])=>(
                    <div key={l} className="flex justify-between items-center py-1.5 text-[10px] font-mono text-white/70 border-b border-white/5 last:border-0">
                      <span>{l}</span><span className={c}>{v}</span>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Telemetry overlay */}
            <AnimatePresence>
              {showTelemetry&&(
                <motion.div initial={{opacity:0,scale:0.95,y:-4}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.95,y:-4}}
                  className="absolute top-16 right-4 w-60 flex flex-col gap-2 z-50">
                  <div className="bg-[#061016]/95 border border-[#38bdf8]/30 rounded-xl p-3 backdrop-blur-xl">
                    <div className="text-[#38bdf8] text-[8px] uppercase tracking-widest mb-2 font-mono flex items-center gap-1"><Zap className="w-3 h-3"/>Node CPUs</div>
                    {Object.entries(nodes).map(([nid,m])=>(
                      <div key={nid} className="flex items-center gap-2 mb-1.5">
                        <span className="text-[7px] font-mono text-white/50 w-4">{nid}</span>
                        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <motion.div className="h-full rounded-full" style={{backgroundColor:nodeColor(m)}} animate={{width:`${m.cpu||0}%`}} transition={{duration:.5}}/>
                        </div>
                        <span className="text-[8px] font-mono text-white/70 w-8 text-right">{m.cpu?.toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-[#061016]/95 border border-[#38bdf8]/30 rounded-xl p-3 backdrop-blur-xl">
                    <div className="text-[#38bdf8] text-[8px] uppercase tracking-widest mb-2 font-mono flex items-center gap-1"><ShieldCheck className="w-3 h-3"/>Security</div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-green-400"/>
                      <div><div className="text-[8px] font-mono text-green-400">ACTIVE</div><div className="w-20 h-1 bg-[#38bdf8]/20 rounded mt-1 overflow-hidden"><div className="h-full bg-[#38bdf8] w-full animate-pulse"/></div></div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AriaDisplay mood={mood} isThinking={isThinking}/>

            {/* Footer */}
            <div className="w-full mt-auto pt-3 flex justify-between items-center px-4 border-t border-[#1a2c3a] z-20">
              <div className="flex items-center gap-4 text-[#38bdf8]/70">
                <div className="flex items-center gap-1.5"><Wifi className="w-4 h-4"/><Mic className="w-4 h-4"/><span className="font-mono text-[10px] tracking-widest uppercase ml-1">Mic</span><div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,1)] animate-pulse ml-1"/></div>
                <div className="w-[1px] h-4 bg-[#1a2c3a]"/>
                <Grid className="w-4 h-4 cursor-pointer hover:text-[#38bdf8] transition-colors"/>
              </div>
              <div className="text-[#38bdf8] font-mono text-[13px] tracking-widest opacity-90 drop-shadow-[0_0_2px_#38bdf8]">Time {timeString}</div>
            </div>
          </div>
        </div>

        {/* Command console */}
        <div className="absolute top-[calc(100%+20px)] w-[600px] h-[64px] rounded-xl bg-gradient-to-br from-[#0b161e]/90 to-[#04080c]/90 border border-[#38bdf8]/40 backdrop-blur-md flex items-center px-4 shadow-[0_25px_50px_rgba(0,0,0,0.8),inset_0_2px_15px_rgba(56,189,248,0.1)] z-40"
          style={{transform:'perspective(1000px) rotateX(30deg) translateZ(20px)'}}>
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#38bdf8]/80 to-transparent opacity-60"/>
          <input ref={inputRef} type="text" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSend()}
            placeholder="Ask ARIA: weather in Mumbai, server health, trigger incident..." disabled={isStreaming}
            className="flex-1 bg-transparent text-[#38bdf8] text-[12px] font-mono px-4 outline-none placeholder-[#38bdf8]/35 disabled:opacity-50"/>
          <motion.button onClick={handleSend} disabled={isStreaming||!input.trim()} whileTap={{scale:0.9}}
            className="w-10 h-10 mr-2 rounded-lg flex items-center justify-center hover:bg-[#38bdf8]/10 text-[#38bdf8]/60 hover:text-[#38bdf8] disabled:opacity-30 transition-colors cursor-pointer">
            <Send className="w-5 h-5"/>
          </motion.button>
          <button className="w-10 h-10 rounded-lg bg-[#38bdf8]/20 border border-[#38bdf8]/50 flex items-center justify-center hover:bg-[#38bdf8]/40 transition-all cursor-pointer relative overflow-hidden">
            <div className="absolute inset-0 bg-[#38bdf8] opacity-20 animate-pulse"/>
            <Mic className="w-5 h-5 text-[#38bdf8] relative z-10"/>
          </button>
        </div>

        {/* Shelf */}
        <div className="absolute bottom-[-175px] w-[640px] h-6 bg-gradient-to-b from-[#2a3038] to-[#12161a] rounded-sm shadow-[0_30px_50px_rgba(0,0,0,0.9),inset_0_1px_1px_rgba(255,255,255,0.15)] z-0 border-b-2 border-black"/>
        <div className="absolute bottom-[-190px] w-[630px] h-4 bg-[#0a0c0f] rounded-b-sm shadow-2xl z-0"/>
        <div className="absolute bottom-[-170px] z-10 w-[240px] flex flex-col items-center">
          <div className="w-full h-10 bg-[#151719] rounded-t-[40px] rounded-b-md border-b-4 border-[#0a0a0a] relative overflow-hidden flex justify-center" style={{clipPath:'polygon(0 100%, 15% 0, 85% 0, 100% 100%)'}}>
            <div className="absolute left-[-20%] top-0 w-[60%] h-full bg-gradient-to-br from-[#c084fc] via-[#f472b6] to-transparent opacity-80 mix-blend-screen blur-[2px]" style={{clipPath:'polygon(0 0, 100% 0, 70% 100%, 0 100%)'}}/>
            <div className="absolute right-[-20%] top-0 w-[60%] h-full bg-gradient-to-bl from-[#38bdf8] via-[#4ade80] to-transparent opacity-80 mix-blend-screen blur-[2px]" style={{clipPath:'polygon(0 0, 100% 0, 100% 100%, 30% 100%)'}}/>
            <div className="absolute top-0 w-8 h-full bg-[#0a0c0e] z-10 flex flex-col items-center pt-2 gap-0.5">
              <div className="w-1 h-1 rounded-full bg-[#38bdf8] shadow-[0_0_5px_#38bdf8]"/>
              <div className="w-0.5 h-0.5 rounded-full bg-white/30"/><div className="w-0.5 h-0.5 rounded-full bg-white/30"/>
            </div>
          </div>
          <div className="mt-1 text-[6px] font-mono text-white/50 tracking-[0.3em] uppercase">ARM CORE — S1.0 Master</div>
        </div>
      </div>
    </div>
  )
}