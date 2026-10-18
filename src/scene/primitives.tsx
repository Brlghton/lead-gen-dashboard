import { useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import type { AgentDef } from '@/config/floor'
import { engine, WORK_DURATION } from '@/sim/engine'
export const COLORS = { paper: '#fff9e9', floor: '#d7d5ca' }
export const actionAmount = (key: string, window = .6) => { const age = engine.age(key); return age < window ? 1 - age / window : 0 }
export function Box({ args, position, color, rotation, emissive, emissiveIntensity, castShadow = true, children }: {
  args: [number, number, number]; position?: [number, number, number]; rotation?: [number, number, number]; color: string
  emissive?: string; emissiveIntensity?: number; castShadow?: boolean; children?: ReactNode
}) {
  return <mesh position={position} rotation={rotation} castShadow={castShadow} receiveShadow>
    <boxGeometry args={args} /><meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={emissiveIntensity} roughness={.75} />{children}
  </mesh>
}
function Arm({ agent, side }: { agent: AgentDef; side: -1 | 1 }) {
  const upper = useRef<THREE.Mesh>(null), lower = useRef<THREE.Mesh>(null), hand = useRef<THREE.Group>(null)
  const elbowMesh = useRef<THREE.Mesh>(null)
  const v = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), delta: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), world: new THREE.Vector3() }), [])
  useFrame(() => {
    const age = engine.age(agent.id)
    const duration = ['qualifier', 'finder', 'verifier'].includes(agent.role) ? WORK_DURATION : 1.05
    const active = age < duration
    const k = Math.min(age / duration, 1)
    const press = active ? Math.sin(Math.PI * k) : 0
    const seated = agent.role === 'scraper' || agent.role === 'atlas'
    const shoulderY = seated ? 1.05 : 1.35
    v.a.set(side * .41, shoulderY, 0)
    v.c.set(side * .49, seated ? .84 : .98, seated ? .58 : .2)
    if (side === 1 && active) {
      if (agent.role === 'qualifier') v.c.set(0, 1.81 - press * .59, 1.48 * Math.min(k * 5, 1))
      else if (agent.role === 'finder') v.c.set(.15 * (1 - press), 1.15, .5 + press * .95)
      else if (agent.role === 'verifier') v.c.set(0, 1.0, .4 + press * 1.1)
      else if (agent.role === 'loader') v.c.set(-press * .3, 1.25 + press * .7, k < .3 ? -.5 : 1.25 * (1 - k))
      else v.c.set(.34, .86, .65 + press * .2)
    }
    const record = engine.activeCard(agent.id)
    if (side === 1 && record && active) {
      engine.cardPose(record, v.world)
      const dx = v.world.x - agent.pos[0], dz = v.world.z - agent.pos[1]
      const reach = Math.min(1, k * 8, (1 - k) * 8)
      const localX = dx * Math.cos(agent.facing) - dz * Math.sin(agent.facing)
      const localZ = dx * Math.sin(agent.facing) + dz * Math.cos(agent.facing)
      v.c.x = THREE.MathUtils.lerp(side * .49, localX, reach)
      v.c.z = THREE.MathUtils.lerp(.25, localZ, reach)
    }
    if (side === -1 && active && seated) v.c.z += press * .1
    v.b.copy(v.a).lerp(v.c, .5); v.b.x += side * .23; v.b.y += .05
    const segment = (mesh: THREE.Mesh | null, from: THREE.Vector3, to: THREE.Vector3) => {
      if (!mesh) return
      mesh.position.copy(from).add(to).multiplyScalar(.5)
      v.delta.subVectors(to, from)
      mesh.scale.set(1, v.delta.length(), 1)
      mesh.quaternion.setFromUnitVectors(v.up, v.delta.normalize())
    }
    segment(upper.current, v.a, v.b); segment(lower.current, v.b, v.c)
    elbowMesh.current?.position.copy(v.b)
    if (hand.current) { hand.current.position.copy(v.c); hand.current.rotation.x = agent.role === 'loader' ? -press : 0 }
  })
  return <group>
    <mesh position={[side * .41, agent.role === 'scraper' || agent.role === 'atlas' ? 1.05 : 1.35, 0]} castShadow><sphereGeometry args={[.115, 12, 10]} /><meshStandardMaterial color="#53645c" /></mesh>
    {[upper, lower].map((ref, i) => <mesh key={i} ref={ref} castShadow><cylinderGeometry args={[.085, .085, 1, 10]} /><meshStandardMaterial color={i ? '#8e9a8b' : '#e5e8db'} metalness={.3} roughness={.55} /></mesh>)}
    <mesh ref={elbowMesh}><sphereGeometry args={[.11, 12, 10]} /><meshStandardMaterial color="#52635a" /></mesh>
    <group ref={hand}>
      <Box args={[.18, .15, .2]} color="#455d51" />
      {side === 1 && agent.role === 'qualifier' && <group>
        <Box args={[.08, .25, .08]} position={[0, -.15, 0]} color="#8a7650" />
        <Box args={[.42, .08, .34]} position={[0, -.3, 0]} color="#497c68" />
      </group>}
      {side === 1 && agent.role === 'finder' && <Box args={[.25, .03, .23]} position={[0, -.09, .08]} color="#f4eee0" />}
    </group>
  </group>
}

// Mechanical archive clerks: wheeled housings, a single optical lens and brass fittings.
// The silhouettes and tools carry the role, rather than faces or humanoid helmets.
export function Robot({ agent }: { agent: AgentDef }) {
  const head = useRef<THREE.Group>(null)
  const seated = agent.role === 'scraper' || agent.role === 'atlas'
  const torso = seated ? .88 : 1.18
  // Atlas hovers on his pod: no wheels, a darker shell and a gold eye.
  const atlas = agent.role === 'atlas'
  const shell = agent.role === 'scraper' ? '#b46642' : agent.role === 'qualifier' ? '#c69b42' : agent.role === 'finder' ? '#507a91' : agent.role === 'verifier' ? '#41766b' : agent.role === 'loader' ? '#c2734e' : '#1f3346'
  useFrame(() => {
    if (head.current) head.current.rotation.x = -.08 + actionAmount(agent.id, WORK_DURATION) * .18
  })
  return <group>
    {!atlas && <RoundedBox args={[.8, .24, .7]} radius={.06} smoothness={2} position={[0, .26, 0]} castShadow><meshStandardMaterial color="#354846" /></RoundedBox>}
    {!atlas && [-1,1].flatMap(x => [-1,1].map(z => <group key={x + ':' + z} position={[x * .38, .17, z * .23]} rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow><cylinderGeometry args={[.17, .17, .14, 12]} /><meshStandardMaterial color="#263532" /></mesh>
      <mesh><cylinderGeometry args={[.085, .085, .16, 12]} /><meshStandardMaterial color="#bba071" metalness={.55} roughness={.4} /></mesh>
    </group>))}
    <mesh position={[0, (torso + .2) / 2, 0]}><cylinderGeometry args={[.14, .21, torso - .2, 8]} /><meshStandardMaterial color="#8c8b73" metalness={.6} roughness={.4} /></mesh>
    <mesh position={[0, torso, 0]} castShadow><cylinderGeometry args={[.4, .48, .65, 6]} /><meshStandardMaterial color={shell} flatShading roughness={.6} /></mesh>
    <Box args={[.48, .24, .08]} position={[0, torso, .4]} color="#344a47" />
    {[0,1,2].map(i => <Box key={i} args={[.25 - i * .04, .025, .02]} position={[0, torso + .07 - i * .07, .45]} color="#d1bb83" />)}
    <Box args={[.43, .44, .16]} position={[0, torso + .02, -.43]} color="#7b5e3e" />
    {[-.12,0,.12].map(x => <Box key={x} args={[.08, .49, .09]} position={[x, torso + .15, -.43]} color="#ddca9a" />)}
    <mesh position={[0, torso + .37, 0]}><cylinderGeometry args={[.16, .16, .15, 10]} /><meshStandardMaterial color="#a88b54" /></mesh>
    <group ref={head} position={[0, torso + .63, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[.34, .4, .55, 8]} /><meshStandardMaterial color={shell} flatShading /></mesh>
      <mesh position={[0, 0, .29]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.3, .3, .045, 24]} /><meshStandardMaterial color="#c5a36b" metalness={.65} roughness={.3} /></mesh>
      <mesh position={[0, 0, .32]}><circleGeometry args={[.25, 24]} /><meshStandardMaterial color="#213c3e" metalness={.3} roughness={.2} /></mesh>
      <mesh position={[.035, .015, .33]}><circleGeometry args={[.125, 24]} /><meshStandardMaterial color={atlas ? '#ffe2a3' : '#9bc4bf'} emissive={atlas ? '#e7b45a' : '#7ea7a7'} emissiveIntensity={atlas ? 1.4 : .35} /></mesh>
      <mesh position={[.035, .015, .34]}><circleGeometry args={[.058, 20]} /><meshBasicMaterial color={atlas ? '#8a5a12' : '#34565c'} /></mesh>
      <Box args={[.62, .08, .56]} position={[0, .31, -.025]} color={atlas ? '#c9a25c' : '#3b4c47'} />
      <Box args={[.06, .27, .06]} position={[-.28, .4, -.12]} color="#b79863" />
      <mesh position={[-.28, .55, -.12]}><sphereGeometry args={[.065, 10, 8]} /><meshStandardMaterial color={atlas ? '#fff1cf' : '#c0ce9c'} emissive={atlas ? '#e7c27a' : '#000000'} emissiveIntensity={atlas ? 1.5 : 0} /></mesh>
    </group>
    <Arm agent={agent} side={-1} /><Arm agent={agent} side={1} />
  </group>
}
