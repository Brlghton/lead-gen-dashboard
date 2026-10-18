import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CARD_POOL, ENVELOPE_POOL, THROW_VELOCITY, engine } from '@/sim/engine'
import { COLORS } from './primitives'

export const PORTRAIT_COLORS = ['#f0c7a0', '#c68e63', '#8d5a3b', '#e9bf9b', '#a8714c', '#f3d0b5']

const mats = {
  paper: new THREE.MeshStandardMaterial({ color: COLORS.paper, roughness: 0.8 }),
  ink: new THREE.MeshBasicMaterial({ color: '#9b9488' }),
  fit: new THREE.MeshStandardMaterial({ color: '#22c55e', emissive: '#22c55e', emissiveIntensity: 0.45 }),
  nofit: new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 0.45 }),
  ok: new THREE.MeshBasicMaterial({ color: '#16a34a' }),
  fail: new THREE.MeshBasicMaterial({ color: '#dc2626' }),
  envelope: new THREE.MeshStandardMaterial({ color: '#f6f1e6', roughness: 0.7 }),
  seal: new THREE.MeshStandardMaterial({ color: '#4fd1b0', emissive: '#4fd1b0', emissiveIntensity: 0.6 }),
}
const portraitMats = PORTRAIT_COLORS.map((c) => new THREE.MeshStandardMaterial({ color: c }))

const geo = {
  card: new THREE.BoxGeometry(0.72, 0.035, 0.5),
  line: new THREE.PlaneGeometry(0.26, 0.035),
  stamp: new THREE.CylinderGeometry(0.1, 0.1, 0.012, 20),
  chip: new THREE.BoxGeometry(0.15, 0.012, 0.19),
  tick: new THREE.PlaneGeometry(0.035, 0.12),
  envelope: new THREE.BoxGeometry(0.62, 0.04, 0.42),
  flap: new THREE.PlaneGeometry(0.44, 0.44),
  seal: new THREE.CylinderGeometry(0.05, 0.05, 0.012, 14),
}

/* ---------- lead cards ---------- */

interface CardRefs {
  root: THREE.Group
  stamp: THREE.Mesh
  chip: THREE.Mesh
  ok: THREE.Group
  fail: THREE.Group
}

function CardMesh({ register }: { register: (r: CardRefs) => void }) {
  const refs = useRef<Partial<CardRefs>>({})
  const done = useRef(false)
  const set = (k: keyof CardRefs) => (o: THREE.Object3D | null) => {
    if (!o) return
    ;(refs.current as Record<string, THREE.Object3D>)[k] = o
    if (!done.current && Object.keys(refs.current).length === 5) {
      done.current = true
      register(refs.current as CardRefs)
    }
  }
  return (
    <group ref={set('root')} visible={false}>
      <mesh geometry={geo.card} material={mats.paper} castShadow />
      <mesh geometry={geo.line} material={mats.ink} position={[0.0, 0.019, -0.08]} rotation={[-Math.PI / 2, 0, 0]} />
      <mesh geometry={geo.line} material={mats.ink} position={[-0.03, 0.019, 0.02]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.7, 1, 1]} />
      <mesh ref={set('stamp')} geometry={geo.stamp} material={mats.fit} position={[0.24, 0.024, 0.11]} visible={false} />
      <mesh ref={set('chip')} geometry={geo.chip} material={portraitMats[0]} position={[-0.23, 0.024, 0.0]} visible={false} />
      <group ref={set('ok')} position={[0.24, 0.03, -0.12]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <mesh geometry={geo.tick} material={mats.ok} position={[-0.04, -0.02, 0]} rotation={[0, 0, 0.8]} scale={[1, 0.55, 1]} />
        <mesh geometry={geo.tick} material={mats.ok} position={[0.025, 0.01, 0]} rotation={[0, 0, -0.6]} />
      </group>
      <group ref={set('fail')} position={[0.24, 0.03, -0.12]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <mesh geometry={geo.tick} material={mats.fail} rotation={[0, 0, 0.78]} />
        <mesh geometry={geo.tick} material={mats.fail} rotation={[0, 0, -0.78]} />
      </group>
    </group>
  )
}

export function Cards() {
  const pool = useRef<(CardRefs | undefined)[]>([])
  const pos = useMemo(() => new THREE.Vector3(), [])
  const seen = useMemo(() => new Uint8Array(CARD_POOL), [])

  useFrame(() => {
    seen.fill(0)
    for (const c of engine.cards) {
      const r = pool.current[c.slot]
      if (!r) continue
      seen[c.slot] = 1
      const yaw = engine.cardPose(c, pos)
      r.root.visible = true
      r.root.position.copy(pos)
      r.root.rotation.set(0, yaw, 0)
      r.stamp.visible = c.stamp !== 0
      r.stamp.material = c.stamp === 2 ? mats.nofit : mats.fit
      r.chip.visible = c.face >= 0
      if (c.face >= 0) r.chip.material = portraitMats[c.face % portraitMats.length]
      r.ok.visible = c.check === 1
      r.fail.visible = c.check === 2
    }
    for (let i = 0; i < CARD_POOL; i++) {
      const r = pool.current[i]
      if (r && !seen[i]) r.root.visible = false
    }
  })

  return (
    <group>
      {Array.from({ length: CARD_POOL }, (_, i) => (
        <CardMesh key={i} register={(r) => (pool.current[i] = r)} />
      ))}
    </group>
  )
}

/* ---------- envelopes Leo throws off the floor ---------- */

export function Envelopes() {
  const refs = useRef<(THREE.Group | null)[]>([])
  const pos = useMemo(() => new THREE.Vector3(), [])
  const dir = Math.atan2(-THROW_VELOCITY.z, THROW_VELOCITY.x)
  const seen = useMemo(() => new Uint8Array(ENVELOPE_POOL), [])

  useFrame(() => {
    seen.fill(0)
    for (const e of engine.envelopes) {
      const g = refs.current[e.slot]
      if (!g) continue
      seen[e.slot] = 1
      const t = engine.envelopePose(e, pos)
      g.visible = true
      g.position.copy(pos)
      // Spins end over end once it leaves Leo's hand.
      g.rotation.set(t * 11, dir + t * 4, Math.sin(t * 5) * 0.5)
      g.scale.setScalar(1 + Math.min(t, 1) * 0.5)
    }
    refs.current.forEach((g, i) => {
      if (g && !seen[i]) g.visible = false
    })
  })

  return (
    <group>
      {Array.from({ length: ENVELOPE_POOL }, (_, i) => (
        <group key={i} ref={(g) => void (refs.current[i] = g)} visible={false}>
          <mesh geometry={geo.envelope} material={mats.envelope} castShadow />
          <mesh geometry={geo.flap} material={mats.ink} position={[0, 0.021, -0.21]} rotation={[-Math.PI / 2, 0, Math.PI / 4]} scale={[0.5, 0.5, 1]} />
          <mesh geometry={geo.seal} material={mats.seal} position={[0, 0.026, 0]} />
        </group>
      ))}
    </group>
  )
}
