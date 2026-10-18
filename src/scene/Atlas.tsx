import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { AgentDef } from '@/config/floor'
import { engine } from '@/sim/engine'
import { Robot } from './primitives'

/**
 * Atlas's command bubble: a glass dome on a raised dais. Inside, Atlas floats on a
 * hover pod behind a holographic console, ringed by screens and orbiting gold rings.
 */
export const ATLAS_DAIS_RADIUS = 2.55
export const ATLAS_DAIS_TOP = .2
const DOME_RADIUS = 2.4
const GOLD = '#e7c27a'
const HOLO = '#7fe0cf'

const holoMat = (opacity: number) => new THREE.MeshBasicMaterial({ color: HOLO, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false })

function Dais() {
  const glow = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(() => { if (glow.current) glow.current.opacity = .55 + Math.sin(engine.time * 2) * .2 })
  return <group>
    <mesh position={[0, .07, 0]} receiveShadow castShadow><cylinderGeometry args={[ATLAS_DAIS_RADIUS + .08, ATLAS_DAIS_RADIUS + .16, .14, 64]} /><meshStandardMaterial color="#23393a" roughness={.6} /></mesh>
    <mesh position={[0, .17, 0]} receiveShadow><cylinderGeometry args={[ATLAS_DAIS_RADIUS, ATLAS_DAIS_RADIUS + .05, .06, 64]} /><meshStandardMaterial color="#2d4847" roughness={.45} metalness={.2} /></mesh>
    <mesh position={[0, ATLAS_DAIS_TOP, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[DOME_RADIUS + .02, .045, 10, 72]} /><meshStandardMaterial color={GOLD} metalness={.7} roughness={.25} /></mesh>
    <mesh position={[0, ATLAS_DAIS_TOP + .006, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.95, 2.05, 72]} /><meshBasicMaterial ref={glow} color={GOLD} transparent opacity={.6} /></mesh>
    {[1.2, 1.55].map(r => <mesh key={r} position={[0, ATLAS_DAIS_TOP + .004, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[r, r + .025, 64]} /><meshBasicMaterial color="#5c8a7f" /></mesh>)}
  </group>
}

function Dome() {
  // A static glint sells the glass from the default camera angle.
  return <group position={[0, ATLAS_DAIS_TOP, 0]}>
    <mesh renderOrder={10}>
      <sphereGeometry args={[DOME_RADIUS, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshPhysicalMaterial color="#d6f3ee" transparent opacity={.16} roughness={.03} metalness={0} clearcoat={1} clearcoatRoughness={.05} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
    {[.75, 1.55].map(y => <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={11}>
      <torusGeometry args={[Math.sqrt(DOME_RADIUS ** 2 - y ** 2), .007, 6, 96]} /><meshBasicMaterial color="#ffffff" transparent opacity={.35} depthWrite={false} />
    </mesh>)}
    <group rotation={[0, -1.9, 0]}>
      {[[.88, .03, 1.0], [.98, .018, .45]].map(([phi, tube, arc], i) => <mesh key={i} position={[0, DOME_RADIUS * Math.cos(phi) - .03, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={12}>
        <torusGeometry args={[DOME_RADIUS * Math.sin(phi), tube, 6, 40, arc]} /><meshBasicMaterial color="#ffffff" transparent opacity={.75} depthWrite={false} />
      </mesh>)}
    </group>
  </group>
}

function HoloScreen({ angle, radar = false }: { angle: number; radar?: boolean }) {
  const bars = useRef<(THREE.Mesh | null)[]>([])
  const sweep = useRef<THREE.Group>(null)
  const mats = useMemo(() => ({
    panel: new THREE.MeshBasicMaterial({ color: '#163a3c', transparent: true, opacity: .72, side: THREE.DoubleSide, depthWrite: false }),
    line: holoMat(.95), bar: holoMat(.8),
  }), [])
  useFrame(() => {
    const t = engine.time
    bars.current.forEach((m, i) => { if (m) { const w = .25 + .65 * (.5 + .5 * Math.sin(t * (.9 + i * .37) + i * 1.7)); m.scale.x = w; m.position.x = -.38 + w * .38 } })
    if (sweep.current) sweep.current.rotation.z = -t * 1.8
  })
  // Each screen sits on the dome's inner ring and faces Atlas.
  return <group rotation={[0, angle, 0]}>
    <group position={[0, 1.7, -1.35]} rotation={[.18, 0, 0]}>
      <mesh material={mats.panel}><planeGeometry args={[1.0, .62]} /></mesh>
      {[[0, .31, 1.0, .012], [0, -.31, 1.0, .012], [-.5, 0, .012, .62], [.5, 0, .012, .62]].map(([x, y, w, h], i) => <mesh key={i} position={[x, y, .002]} material={mats.line}><planeGeometry args={[w, h]} /></mesh>)}
      {radar ? <group position={[0, 0, .004]}>
        {[.12, .22].map(r => <mesh key={r} material={mats.line}><ringGeometry args={[r, r + .012, 40]} /></mesh>)}
        <group ref={sweep}><mesh position={[.11, 0, .001]} material={mats.bar}><planeGeometry args={[.22, .012]} /></mesh></group>
        {[[.08, .1], [-.15, .05], [.03, -.17]].map(([x, y], i) => <mesh key={i} position={[x, y, .002]} material={mats.line}><circleGeometry args={[.018, 10]} /></mesh>)}
      </group> : [0, 1, 2, 3].map(i => <mesh key={i} ref={m => { bars.current[i] = m }} position={[0, .19 - i * .13, .004]} material={mats.bar}><planeGeometry args={[.76, .055]} /></mesh>)}
    </group>
  </group>
}

function Console() {
  const edge = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(() => { if (edge.current) edge.current.opacity = .7 + Math.sin(engine.time * 3) * .2 })
  // Flat horseshoe of light at hand height; ringGeometry angles run from +x toward -z once laid flat.
  const start = Math.PI / 2 - .85, length = 1.7
  return <group position={[0, .78, 0]} rotation={[-Math.PI / 2, 0, 0]}>
    <mesh renderOrder={5}><ringGeometry args={[.5, .98, 48, 1, start + Math.PI, length]} /><meshStandardMaterial color="#a9eadc" emissive={HOLO} emissiveIntensity={.5} transparent opacity={.5} side={THREE.DoubleSide} depthWrite={false} /></mesh>
    <mesh position={[0, 0, .004]}><ringGeometry args={[.95, .99, 48, 1, start + Math.PI, length]} /><meshBasicMaterial ref={edge} color={GOLD} transparent opacity={.8} side={THREE.DoubleSide} /></mesh>
    {[-.45, -.15, .15, .45].map(a => <mesh key={a} position={[Math.sin(a) * .74, -Math.cos(a) * .74, .006]} rotation={[0, 0, a]}><planeGeometry args={[.16, .1]} /><meshBasicMaterial color={HOLO} transparent opacity={.8} side={THREE.DoubleSide} /></mesh>)}
  </group>
}

function Orbits() {
  const spin = useRef<THREE.Group>(null), counter = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += dt * .7
    if (counter.current) counter.current.rotation.y -= dt * .45
  })
  // Radii and tilts keep both rings inside the glass.
  return <group position={[0, 1.35, 0]}>
    <group rotation={[.3, 0, .14]}><group ref={spin}>
      <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.55, .014, 6, 120]} /><meshBasicMaterial color={GOLD} transparent opacity={.85} /></mesh>
      {[0, 2.1, 4.2].map(a => <mesh key={a} position={[Math.cos(a) * 1.55, 0, Math.sin(a) * 1.55]}><sphereGeometry args={[.06, 12, 10]} /><meshStandardMaterial color="#fff1cf" emissive={GOLD} emissiveIntensity={2} /></mesh>)}
    </group></group>
    <group rotation={[-.26, 0, -.3]}><group ref={counter}>
      <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.4, .01, 6, 120]} /><meshBasicMaterial color={HOLO} transparent opacity={.7} /></mesh>
      {[1, 4].map(a => <mesh key={a} position={[Math.cos(a) * 1.4, 0, Math.sin(a) * 1.4]}><sphereGeometry args={[.045, 10, 8]} /><meshStandardMaterial color="#e5fff9" emissive={HOLO} emissiveIntensity={2} /></mesh>)}
    </group></group>
  </group>
}

export function AtlasPod({ agent }: { agent: AgentDef }) {
  const pod = useRef<THREE.Group>(null)
  const under = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(() => {
    const bob = Math.sin(engine.time * 1.6)
    if (pod.current) pod.current.position.y = ATLAS_DAIS_TOP + .32 + bob * .06
    if (under.current) under.current.opacity = .45 - bob * .15
  })
  return <group>
    <Dais />
    <mesh position={[0, ATLAS_DAIS_TOP + .008, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.75, 40]} /><meshBasicMaterial ref={under} color={GOLD} transparent opacity={.4} depthWrite={false} /></mesh>
    <group ref={pod}>
      <mesh position={[0, -.05, 0]} castShadow><cylinderGeometry args={[.62, .5, .14, 40]} /><meshStandardMaterial color="#1c2f30" metalness={.4} roughness={.35} /></mesh>
      <mesh position={[0, -.125, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.5, .03, 8, 48]} /><meshStandardMaterial color="#fff1cf" emissive={GOLD} emissiveIntensity={1.6} /></mesh>
      <Robot agent={agent} />
      <Console />
    </group>
    {[Math.PI, Math.PI * .62, -Math.PI * .62].map((a, i) => <HoloScreen key={a} angle={a + Math.PI} radar={i === 0} />)}
    <Orbits />
    <pointLight position={[0, 1.8, .4]} color="#ffd38a" intensity={5} distance={5} decay={2} />
    <Dome />
  </group>
}
