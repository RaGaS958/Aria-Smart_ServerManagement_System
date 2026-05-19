import { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useServerStore } from '../../store/index.js'
import * as THREE from 'three'

const NODE_HEALTH_COLOR = {
  healthy: new THREE.Color('#4ade80'),
  warn:    new THREE.Color('#f59e0b'),
  crit:    new THREE.Color('#ef4444'),
}

function getNodeColor(metrics) {
  if (!metrics?.healthy || metrics.cpu > 90 || metrics.temp > 85) return NODE_HEALTH_COLOR.crit
  if (metrics.cpu > 70 || metrics.temp > 70 || metrics.ram > 85) return NODE_HEALTH_COLOR.warn
  return NODE_HEALTH_COLOR.healthy
}

// ── Individual server rack ────────────────────────────────────────────────────
function Rack({ position, nodeId, metrics }) {
  const meshRef = useRef()
  const ledRef  = useRef()
  const color = getNodeColor(metrics)

  useFrame((_, delta) => {
    if (ledRef.current) {
      ledRef.current.intensity = 0.5 + Math.sin(Date.now() * 0.003) * 0.3
    }
  })

  return (
    <group position={position}>
      {/* Rack body */}
      <mesh ref={meshRef} castShadow>
        <boxGeometry args={[0.6, 2.0, 0.4]} />
        <meshStandardMaterial color="#0a1520" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Rack frame edges */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(0.62, 2.02, 0.42)]} />
        <lineBasicMaterial color="#38bdf8" transparent opacity={0.3} />
      </lineSegments>
      {/* LED strips */}
      {[-0.7, -0.3, 0.1, 0.5, 0.9].map((y, i) => (
        <mesh key={i} position={[0.28, y, 0.21]}>
          <boxGeometry args={[0.05, 0.06, 0.02]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} />
        </mesh>
      ))}
      {/* Point light for glow */}
      <pointLight ref={ledRef} color={color} intensity={0.8} distance={2.5} position={[0.3, 0, 0.3]} />
      {/* Label */}
      <mesh position={[0, 1.2, 0.22]}>
        <planeGeometry args={[0.4, 0.12]} />
        <meshBasicMaterial color="#0b161e" transparent opacity={0.8} />
      </mesh>
    </group>
  )
}

// ── Server room floor grid ────────────────────────────────────────────────────
function FloorGrid() {
  const gridHelper = useMemo(() => {
    const g = new THREE.GridHelper(30, 30, '#38bdf8', '#1a2c3a')
    g.material.transparent = true
    g.material.opacity = 0.15
    return g
  }, [])

  return <primitive object={gridHelper} position={[0, -2, 0]} />
}

// ── Data flow particles ───────────────────────────────────────────────────────
function DataParticles({ color = '#38bdf8' }) {
  const count = 80
  const meshRef = useRef()

  const [positions, velocities] = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const vel = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 12
      pos[i * 3 + 1] = (Math.random() - 0.5) * 4
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6
      vel[i * 3]     = (Math.random() - 0.5) * 0.02
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.01
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.015
    }
    return [pos, vel]
  }, [])

  useFrame(() => {
    if (!meshRef.current) return
    const pos = meshRef.current.geometry.attributes.position.array
    for (let i = 0; i < count; i++) {
      pos[i * 3]     += velocities[i * 3]
      pos[i * 3 + 1] += velocities[i * 3 + 1]
      pos[i * 3 + 2] += velocities[i * 3 + 2]
      // wrap around
      if (Math.abs(pos[i * 3]) > 7) velocities[i * 3] *= -1
      if (Math.abs(pos[i * 3 + 1]) > 3) velocities[i * 3 + 1] *= -1
      if (Math.abs(pos[i * 3 + 2]) > 4) velocities[i * 3 + 2] *= -1
    }
    meshRef.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={count} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color={color} size={0.04} transparent opacity={0.6} sizeAttenuation />
    </points>
  )
}

// ── Camera drift on mouse ─────────────────────────────────────────────────────
function CameraRig() {
  const { camera } = useThree()
  const target = useRef({ x: 0, y: 0 })

  useFrame(() => {
    camera.position.x += (target.current.x * 0.8 - camera.position.x) * 0.03
    camera.position.y += (target.current.y * 0.3 - camera.position.y) * 0.03
    camera.lookAt(0, 0, 0)
  })

  return null
}

// ── Scene ─────────────────────────────────────────────────────────────────────
function Scene({ moodColor }) {
  const nodes = useServerStore(s => s.nodes)

  const rackPositions = [
    [-5, 0, -3], [-3.5, 0, -3], [-2, 0, -3],
    [2,  0, -3], [3.5, 0, -3], [5, 0, -3],
    [-5, 0, -6], [-3.5, 0, -6], [-2, 0, -6],
    [2,  0, -6], [3.5, 0, -6], [5, 0, -6],
  ]

  const nodeMap = ['R1','R2','R3','R1','R2','R3','R1','R2','R3','R1','R2','R3']

  return (
    <>
      <ambientLight intensity={0.15} color="#050a10" />
      <pointLight position={[0, 5, 0]} intensity={0.4} color="#38bdf8" />
      <pointLight position={[-8, 2, -4]} intensity={0.3} color={moodColor} />
      <pointLight position={[8,  2, -4]} intensity={0.3} color={moodColor} />

      <FloorGrid />
      <DataParticles color={moodColor} />
      <CameraRig />

      {rackPositions.map((pos, i) => (
        <Rack
          key={i}
          position={pos}
          nodeId={nodeMap[i]}
          metrics={nodes[nodeMap[i]]}
        />
      ))}
    </>
  )
}

// ── Exported component ────────────────────────────────────────────────────────
export default function ServerRoomCanvas({ moodColor = '#38bdf8' }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <Canvas
        camera={{ position: [0, 3, 8], fov: 55 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Scene moodColor={moodColor} />
      </Canvas>
    </div>
  )
}
