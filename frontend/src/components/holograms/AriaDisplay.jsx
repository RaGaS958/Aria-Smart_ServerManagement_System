import { useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'

const spectrumStates = [
  { id: 'neutral',    label: 'NEUTRAL v1',  color: '#0ea5e9' },
  { id: 'elated',     label: 'ELATED',      color: '#84cc16' },
  { id: 'resolute',   label: 'RESOLUTE',    color: '#3b82f6' },
  { id: 'shocked',    label: 'SHOCKED',     color: '#d946ef' },
  { id: 'puzzled',    label: 'PUZZLED',     color: '#f59e0b' },
  { id: 'melancholy', label: 'MELANCHOLY',  color: '#60a5fa' },
  { id: 'furious',    label: 'FURIOUS',     color: '#ef4444' },
  { id: 'panicked',   label: 'PANICKED',    color: '#f97316' },
  { id: 'adoring',    label: 'ADORING',     color: '#ec4899' },
  { id: 'smile',      label: 'SMILE',       color: '#cbd5e1' },
  { id: 'retro',      label: 'RETRO',       color: '#d97706' },
  { id: 'dreamy',     label: 'DREAMY',      color: '#c084fc' },
  { id: 'sunny',      label: 'SUNNY',       color: '#fbbf24' },
  { id: 'calm',       label: 'CALM',        color: '#818cf8' },
]

// ── Pixel face matrices ───────────────────────────────────────────────────────
const FACES = {
  neutral:   ['                ','                ','   ###     ###  ','   ###     ###  ','   ###     ###  ','                ','                ','   ##########   ','   ##########   ','                '],
  elated:    ['                ','  #   #   #   # ','   # #     # #  ','    #       #   ','                ','  #           # ','   ##       ##  ','    #########   ','                ','                '],
  resolute:  [' #             #','  ###       ### ','   ###     ###  ','    #       #   ','                ','   ##########   ','  ##        ##  ','                ','                ','                '],
  shocked:   ['   ####   ####  ','  ###### ###### ','  ##  ## ##  ## ','  ###### ###### ','   ####   ####  ','                ','      ####      ','     ######     ','      ####      ','                '],
  puzzled:   ['  ###      ###  ',' #   #    #   # ','    #        #  ','   #        #   ','   #        #   ','                ','   ##  ##  ##   ',' ##  ##  ##  ## ','                ','                '],
  melancholy:['    #       #   ','   ###     ###  ','  ###       ### ',' #             #','                ','      ####      ','    ##    ##    ','   #        #   ','                ','                '],
  furious:   [' ##          ## ','  ####    ####  ','   ###    ###   ','                ','   #        #   ','  ###      ###  ','  ############  ','   ##########   ','                ','                '],
  panicked:  ['  ####    ####  ','   ##      ##   ','  ####    ####  ','                ','   ##########   ','  # ## ## ## ## ','   ##########   ','                ','                ','                '],
  adoring:   ['  # #      # #  ',' #####    ##### ',' #####    ##### ','  ###      ###  ','   #        #   ','                ','  #          #  ','   ##########   ','    ########    ','                '],
  smile:     ['                ','   ##      ##   ','   ##      ##   ','                ','                ','  #          #  ','   ##      ##   ','     ######     ','                ','                '],
  retro:     ['                ','                ','   ####  ####   ','   ####  ####   ','   ####  ####   ','                ','                ','     ######     ','                ','                '],
  dreamy:    ['                ','  ####    ####  ',' ##  ##  ##  ## ','                ','                ','      ####      ','                ','                ','                ','                '],
  sunny:     ['  #  #    #  #  ','   ##      ##   ','                ','  #          #  ','  ##        ##  ','   ##########   ','    ########    ','     ######     ','                ','                '],
  calm:      ['                ','                ','     ####       ','    ##          ','    ##          ','                ','       ####     ','                ','                ','                '],
}

function PixelFace({ mood, color }) {
  const matrix = FACES[mood] || FACES.neutral
  return (
    <svg viewBox="0 0 16 10" className="w-full h-full">
      {matrix.map((row, y) =>
        row.split('').map((ch, x) =>
          ch === '#' ? (
            <rect key={`${x}-${y}`} x={x} y={y} width={0.85} height={0.85} rx={0.1} fill={color} />
          ) : null
        )
      )}
    </svg>
  )
}

// ── Shape renderer ────────────────────────────────────────────────────────────
function MoodShape({ id, color }) {
  const fill = color
  const pat = "url(#scanlines)"
  const Base = ({ children }) => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <defs>
        <pattern id="scanlines" width="4" height="4" patternUnits="userSpaceOnUse">
          <line x1="0" y1="2" x2="4" y2="2" stroke="#000" strokeWidth="1.5" opacity="0.4" />
        </pattern>
      </defs>
      {children}
    </svg>
  )
  const shapes = {
    neutral:    <Base><rect x="20" y="20" width="60" height="60" rx="16" fill={fill}/><rect x="20" y="20" width="60" height="60" rx="16" fill={pat}/></Base>,
    elated:     <Base><path d="M50,15 C60,15 85,60 85,80 C85,95 15,95 15,80 C15,60 40,15 50,15 Z" fill={fill}/><path d="M50,15 C60,15 85,60 85,80 C85,95 15,95 15,80 C15,60 40,15 50,15 Z" fill={pat}/></Base>,
    resolute:   <Base><polygon points="50,15 80,35 80,75 50,95 20,75 20,35" fill={fill} stroke={fill} strokeWidth="4" strokeLinejoin="round"/><polygon points="50,15 80,35 80,75 50,95 20,75 20,35" fill={pat}/></Base>,
    shocked:    <Base><rect x="28" y="10" width="44" height="80" rx="22" fill={fill}/><rect x="28" y="10" width="44" height="80" rx="22" fill={pat}/></Base>,
    puzzled:    <Base><path d="M50,20 C70,10 90,30 80,50 C90,70 70,90 50,80 C30,90 10,70 20,50 C10,30 30,10 50,20 Z" fill={fill}/><path d="M50,20 C70,10 90,30 80,50 C90,70 70,90 50,80 C30,90 10,70 20,50 C10,30 30,10 50,20 Z" fill={pat}/></Base>,
    melancholy: <Base><path d="M50,15 C50,15 82,45 82,65 A32,32,0,0,1,18,65 C18,45 50,15 50,15 Z" fill={fill} stroke={fill} strokeWidth="2" strokeLinejoin="round"/><path d="M50,15 C50,15 82,45 82,65 A32,32,0,0,1,18,65 C18,45 50,15 50,15 Z" fill={pat}/></Base>,
    furious:    <Base><path d="M50,5 L60,20 L75,12 L80,30 L95,40 L82,55 L95,70 L75,75 L80,90 L60,85 L50,100 L40,85 L20,90 L25,75 L5,70 L18,55 L5,40 L20,30 L15,12 L40,20 Z" fill={fill} stroke={fill} strokeWidth="2"/><path d="M50,5 L60,20 L75,12 L80,30 L95,40 L82,55 L95,70 L75,75 L80,90 L60,85 L50,100 L40,85 L20,90 L25,75 L5,70 L18,55 L5,40 L20,30 L15,12 L40,20 Z" fill={pat}/></Base>,
    panicked:   <Base><path d="M50,10 C65,5 80,20 75,35 C95,40 95,60 80,75 C85,95 60,95 50,85 C40,95 15,95 20,75 C5,60 5,40 25,35 C20,20 35,5 50,10 Z" fill={fill}/><path d="M50,10 C65,5 80,20 75,35 C95,40 95,60 80,75 C85,95 60,95 50,85 C40,95 15,95 20,75 C5,60 5,40 25,35 C20,20 35,5 50,10 Z" fill={pat}/></Base>,
    adoring:    <Base><path d="M50,30 C50,30 40,10 20,15 C0,20 0,50 20,65 L50,90 L80,65 C100,50 100,20 80,15 C60,10 50,30 50,30 Z" fill={fill} stroke={fill} strokeWidth="2"/><path d="M50,30 C50,30 40,10 20,15 C0,20 0,50 20,65 L50,90 L80,65 C100,50 100,20 80,15 C60,10 50,30 50,30 Z" fill={pat}/></Base>,
    smile:      <Base><circle cx="50" cy="50" r="38" fill={fill}/><circle cx="50" cy="50" r="38" fill={pat}/></Base>,
    retro:      <Base><rect x="15" y="25" width="70" height="50" rx="8" fill={fill}/><rect x="15" y="25" width="70" height="50" rx="8" fill={pat}/></Base>,
    dreamy:     <Base><path d="M25,65 A15,15,0,0,1,25,35 A20,20,0,0,1,60,25 A20,20,0,0,1,85,45 A15,15,0,0,1,75,75 Z" fill={fill}/><path d="M25,65 A15,15,0,0,1,25,35 A20,20,0,0,1,60,25 A20,20,0,0,1,85,45 A15,15,0,0,1,75,75 Z" fill={pat}/></Base>,
    sunny:      <Base><path d="M50,5 L56,22 L75,12 L67,28 L88,32 L73,44 L95,50 L73,56 L88,68 L67,72 L75,88 L56,78 L50,95 L44,78 L25,88 L33,72 L12,68 L27,56 L5,50 L27,44 L12,32 L33,28 L25,12 L44,22 Z" fill={fill} strokeLinejoin="round"/><circle cx="50" cy="50" r="22" fill={fill}/></Base>,
    calm:       <Base><path d="M60,15 A40,40,0,1,0,80,85 A35,35,0,0,1,60,15 Z" fill={fill}/><path d="M60,15 A40,40,0,1,0,80,85 A35,35,0,0,1,60,15 Z" fill={pat}/></Base>,
  }
  return shapes[id] || shapes.neutral
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AriaDisplay({ mood, isThinking }) {
  const glowRef = useRef()
  const labelRef = useRef()
  const activeState = spectrumStates.find(s => s.id === mood) || spectrumStates[0]

  useGSAP(() => {
    if (glowRef.current) {
      gsap.to(glowRef.current, {
        backgroundColor: activeState.color + '33',
        duration: 1,
        ease: 'power2.inOut',
      })
    }
    if (labelRef.current) {
      gsap.fromTo(labelRef.current,
        { opacity: 0, y: 6, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'power2.out' }
      )
    }
  }, [mood])

  return (
    <div className="flex-1 flex flex-col items-center justify-center z-20 relative">
      <div className="relative w-[300px] h-[300px] flex items-center justify-center">

        {/* Background glow */}
        <div ref={glowRef} className="absolute inset-8 rounded-full" style={{ filter: 'blur(40px)', backgroundColor: activeState.color + '33' }} />

        {/* Outer rings */}
        <motion.svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100">
          <motion.circle cx="50" cy="50" r="46" fill="none" strokeWidth="1"
            animate={{ stroke: activeState.color + '40' }} transition={{ duration: 1 }} />
          <motion.circle cx="50" cy="50" r="48" fill="none" strokeWidth="3"
            animate={{ stroke: activeState.color + '20' }} transition={{ duration: 1 }} />
        </motion.svg>

        {/* Thinking spinner */}
        <AnimatePresence>
          {isThinking && (
            <motion.svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 100 100"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, rotate: 360 }}
              exit={{ opacity: 0 }}
              transition={{ rotate: { duration: 1.5, repeat: Infinity, ease: 'linear' }, opacity: { duration: 0.3 } }}
              style={{ originX: '50%', originY: '50%' }}
            >
              <circle cx="50" cy="50" r="46" fill="none" strokeWidth="2"
                stroke={activeState.color} strokeDasharray="25 72" strokeLinecap="round" />
            </motion.svg>
          )}
        </AnimatePresence>

        {/* Mood shape + pixel face */}
        <div className="relative w-52 h-52 z-20 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={mood}
              className="absolute inset-0 flex items-center justify-center"
              style={{ color: activeState.color }}
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.06 }}
              transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
            >
              {/* Shape */}
              <div className="absolute inset-0 drop-shadow-[0_0_18px_currentColor]">
                <MoodShape id={mood} color={activeState.color} />
              </div>
              {/* Pixel face overlay */}
              <div className="relative z-10 w-[42%] h-[34%]">
                <PixelFace mood={mood} color="#050a0f" />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Mood label */}
      <div ref={labelRef} className="mt-6 flex flex-col items-center gap-1">
        <motion.div
          className="text-[18px] font-bold tracking-[0.3em] uppercase"
          animate={{ color: activeState.color, textShadow: `0 0 12px ${activeState.color}` }}
          transition={{ duration: 1 }}
        >
          {activeState.label}
        </motion.div>
        <AnimatePresence>
          {isThinking && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-[9px] font-mono tracking-widest animate-pulse"
              style={{ color: activeState.color + 'aa' }}
            >
              PROCESSING...
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export { spectrumStates }
