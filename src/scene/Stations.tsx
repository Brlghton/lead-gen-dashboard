import { useMemo, useRef, type ReactNode } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { AGENTS, type AgentDef } from '@/config/floor'
import { useFloor } from '@/store'
import { BIN_POS, OUTBOX_POS, SHREDDER_POS, engine } from '@/sim/engine'
import { Box, Robot, actionAmount } from './primitives'
import { AtlasPod, ATLAS_DAIS_RADIUS, ATLAS_DAIS_TOP } from './Atlas'

function Clickable({ agent, children }: { agent: AgentDef; children: ReactNode }) {
  const select = useFloor(s => s.select)
  const hover = useFloor(s => s.hover)
  const selected = useFloor(s => s.selectedAgent === agent.id)
  const hovered = useFloor(s => s.hoveredAgent === agent.id)
  // The canvas carries a grab cursor for orbiting, so the pointer cursor is set on it directly.
  const canvas = useThree(s => s.gl.domElement)
  const atlas = agent.role === 'atlas'
  const ring = atlas ? ATLAS_DAIS_RADIUS + .12 : .85
  return <group onClick={(e: ThreeEvent<MouseEvent>) => { if (e.delta > 6) return; e.stopPropagation(); select(agent.id) }}
    onPointerOver={e => { e.stopPropagation(); hover(agent.id); canvas.style.cursor = 'pointer' }}
    onPointerOut={() => { hover(null); canvas.style.cursor = '' }}>
    {(selected || hovered) && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, atlas ? ATLAS_DAIS_TOP + .01 : .045, 0]}><ringGeometry args={[ring, ring + .06, 64]} /><meshBasicMaterial color="#3a8b6e" transparent opacity={.65} /></mesh>}
    {/* Invisible hit volume so agents are easy to click when zoomed out. */}
    {!atlas && <mesh position={[0, 1.1, .1]}><cylinderGeometry args={[.8, .8, 2.3, 12]} /><meshBasicMaterial colorWrite={false} depthWrite={false} /></mesh>}
    {children}
  </group>
}
function Screen({ fxKey, candidates = false, small = false }: { fxKey: string; candidates?: boolean; small?: boolean }) {
  const rows = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  useFrame(() => rows.current.forEach((m, i) => {
    if (m) m.color.set(candidates && engine.age(fxKey) < 1.05 && i === engine.finderTarget ? '#73b599' : '#afc5b7')
  }))
  return <group scale={small ? .65 : 1}>
    <Box args={[1.25, .78, .1]} color="#45594d" />
    <Box args={[1.1, .64, .02]} position={[0, 0, -.06]} color="#e1e8d8" />
    {[0,1,2].map(i => <group key={i}>
      <mesh position={[candidates ? .13 : 0, .19 - i * .19, -.078]}><boxGeometry args={[candidates ? .65 : .85 - i * .13, .05, .014]} /><meshStandardMaterial ref={m => { rows.current[i] = m }} color="#afc5b7" /></mesh>
      {candidates && <mesh position={[-.37, .19 - i * .19, -.08]}><circleGeometry args={[.07, 14]} /><meshStandardMaterial color={i === 1 ? '#a89c79' : '#769383'} side={THREE.DoubleSide} /></mesh>}
    </group>)}
  </group>
}
function ResearchDesk({ agent }: { agent: AgentDef }) {
  return <group>
    <Box args={[1.55, .11, .95]} position={[0, .78, .72]} color="#b4bda8" />
    {[-.58,.58].map(x => <Box key={x} args={[.07, .75, .07]} position={[x, .375, .77]} color="#788776" />)}
    <Box args={[.52, .035, .23]} position={[0, .86, .47]} color="#697e6e" />
    <Box args={[.09, .3, .09]} position={[0, 1.0, 1.03]} color="#6d7c6c" />
    <group position={[0, 1.36, 1.05]}><Screen fxKey={agent.id} /></group>
  </group>
}
function Workstation({ agent }: { agent: AgentDef }) {
  return <group position={[agent.pos[0], 0, agent.pos[1]]} rotation={[0, agent.facing, 0]}>
    <Clickable agent={agent}>
      {agent.role === 'atlas' ? <AtlasPod agent={agent} /> : <Robot agent={agent} />}
      {agent.role === 'scraper' && <ResearchDesk agent={agent} />}
      {agent.role === 'qualifier' && <group position={[-.85, 0, .6]}><Box args={[.1, 1.2, .1]} position={[0, .6, 0]} color="#8d9584" /><group position={[0, 1.4, .02]}><Screen fxKey={agent.id} small /></group></group>}
      {agent.role === 'finder' && <group position={[-.85, 0, .5]}><Box args={[.12, 1.0, .12]} position={[0, .5, 0]} color="#859582" /><group position={[0, 1.35, 0]} rotation={[-.25, 0, 0]}><Screen fxKey={agent.id} candidates /></group></group>}
    </Clickable>
  </group>
}
function SourceDocks() {
  const slats = useMemo(() => Array.from({ length: 7 }, (_, i) => i), [])
  return <group>
    {engine.scrapers.map(s => <group key={s.agent.id} position={[-10.1, 0, s.agent.pos[1]]}>
      <Box args={[.65, .72, 1.2]} position={[0, .36, 0]} color="#b2764d" />
      <Box args={[.12, .18, .78]} position={[.36, .65, 0]} color="#243d3b" />
      <Box args={[2.1, .14, .75]} position={[1.05, .72, 0]} color="#3d5551" />
      {slats.map(i => <Box key={i} args={[.06, .03, .72]} position={[.16 + i * .3, .81, 0]} color="#a8afa0" />)}
      {[-1,1].map(side => <Box key={side} args={[2.15, .06, .045]} position={[1.05, .83, side * .4]} color="#b7955e" />)}
      <Box args={[.12, .7, .6]} position={[1.2, .35, 0]} color="#5e7267" />
    </group>)}
  </group>
}
function Tray({ position, wide = false }: { position: THREE.Vector3; wide?: boolean }) {
  const w = wide ? 1.4 : 1
  return <group position={position}>
    <Box args={[w, .1, 1]} position={[0, .42, 0]} color="#938e7b" />
    <Box args={[w, .35, .07]} position={[0, .62, -.48]} color="#b9ab8e" />
    {[-1,1].map(s => <Box key={s} args={[.06, .35, 1]} position={[s * (w / 2), .62, 0]} color="#b9ab8e" />)}
    <Box args={[.7, .4, .6]} position={[0, .2, 0]} color="#a2a28e" />
    {[0,1,2].map(i => <Box key={i} args={[.65, .035, .4]} position={[0, .5 + i * .04, 0]} rotation={[0, i * .18, 0]} color="#ede7d6" />)}
  </group>
}
function VerificationGate() {
  const lamp = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(() => {
    const active = engine.age('vera') < 1.05
    if (lamp.current) {
      lamp.current.color.set(active ? engine.lastResult.vera === false ? '#b56656' : '#53a17c' : '#a9b7a1')
      lamp.current.emissiveIntensity = active ? .6 : 0
    }
  })
  return <group position={[8, 0, 3]}>
    {[-.65,.65].map(x => <Box key={x} args={[.12, 1.45, .18]} position={[x, .725, 0]} color="#95aa95" />)}
    <Box args={[1.4, .16, .25]} position={[0, 1.45, 0]} color="#6c8976" />
    <mesh position={[0, 1.46, .15]}><boxGeometry args={[.45, .06, .035]} /><meshStandardMaterial ref={lamp} color="#a9b7a1" emissive="#73b990" /></mesh>
    <Box args={[.8, .03, .4]} position={[0, .87, 0]} color="#b9cab3" />
  </group>
}
function Dispatch() {
  const lamp = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(() => { if (lamp.current) lamp.current.emissiveIntensity = actionAmount('outbox', .6) * 1.2 })
  return <group position={OUTBOX_POS}>
    <Box args={[2, .85, 1.3]} position={[0, .425, 0]} color="#56816a" />
    <Box args={[2.1, .1, 1.4]} position={[0, .9, 0]} color="#a9c2a8" />
    <Box args={[1.4, .03, .7]} position={[0, .97, 0]} color="#dae4d0" />
    {[0,1,2].map(i => <Box key={i} args={[.65, .04, .45]} position={[-.45, 1 + i * .04, 0]} rotation={[0, i * .1, 0]} color="#fbf5e7" />)}
    <mesh position={[0, .55, .66]}><boxGeometry args={[1.3, .08, .02]} /><meshStandardMaterial ref={lamp} color="#a1dab6" emissive="#a1dab6" /></mesh>
  </group>
}
export function Stations() {
  return <group><SourceDocks />{AGENTS.map(a => <Workstation key={a.id} agent={a} />)}
    <Tray position={SHREDDER_POS} wide /><Tray position={BIN_POS} /><VerificationGate /><Dispatch />
  </group>
}
