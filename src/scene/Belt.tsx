import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { beltPath, BELT_WIDTH, BELT_Y, yawFromTangent } from '@/sim/path'
import { BELT_SPEED, engine } from '@/sim/engine'

/** Strip of quads following the belt at a sideways offset, either flat or vertical. */
function stripGeometry(offset0: number, offset1: number, y0: number, y1: number) {
  const pts = beltPath.pts
  const pos: number[] = []
  const idx: number[] = []
  const t = new THREE.Vector3()
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(pts.length - 1, i + 1)]
    t.subVectors(b, a).normalize()
    // left-hand normal in the floor plane
    const nx = -t.z
    const nz = t.x
    const p = pts[i]
    pos.push(p.x + nx * offset0, y0, p.z + nz * offset0)
    pos.push(p.x + nx * offset1, y1, p.z + nz * offset1)
    if (i > 0) {
      const k = i * 2
      idx.push(k - 2, k - 1, k, k - 1, k + 1, k)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

const SLAT_GAP = 0.42

export function Belt() {
  const half = BELT_WIDTH / 2
  const geoms = useMemo(
    () => ({
      surface: stripGeometry(half, -half, BELT_Y, BELT_Y),
      skirtL: stripGeometry(half + 0.02, half + 0.02, BELT_Y - 0.28, BELT_Y + 0.02),
      skirtR: stripGeometry(-half - 0.02, -half - 0.02, BELT_Y - 0.28, BELT_Y + 0.02),
      railL: stripGeometry(half + 0.06, half + 0.06, BELT_Y - 0.02, BELT_Y + 0.12),
      railR: stripGeometry(-half - 0.06, -half - 0.06, BELT_Y - 0.02, BELT_Y + 0.12),
    }),
    [half],
  )

  // support legs every ~2.2 units
  const legs = useMemo(() => {
    const out: { x: number; z: number; yaw: number }[] = []
    const p = new THREE.Vector3()
    const t = new THREE.Vector3()
    for (let d = 0.6; d < beltPath.length - 0.3; d += 2.2) {
      beltPath.at(d, p, t)
      out.push({ x: p.x, z: p.z, yaw: yawFromTangent(t) })
    }
    return out
  }, [])

  // moving slats give the belt its motion
  const slats = useRef<THREE.InstancedMesh>(null)
  const slatCount = Math.floor(beltPath.length / SLAT_GAP)
  const obj = useMemo(() => new THREE.Object3D(), [])
  const p = useMemo(() => new THREE.Vector3(), [])
  const t = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    const mesh = slats.current
    if (!mesh) return
    const offset = (engine.time * BELT_SPEED) % SLAT_GAP
    for (let i = 0; i < slatCount; i++) {
      const d = i * SLAT_GAP + offset
      beltPath.at(d, p, t)
      obj.position.set(p.x, BELT_Y + 0.006, p.z)
      obj.rotation.set(0, yawFromTangent(t), 0)
      obj.updateMatrix()
      mesh.setMatrixAt(i, obj.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  const start = useMemo(() => {
    const a = new THREE.Vector3()
    const ta = new THREE.Vector3()
    beltPath.at(0, a, ta)
    const b = new THREE.Vector3()
    const tb = new THREE.Vector3()
    beltPath.at(beltPath.length, b, tb)
    return { a, ya: yawFromTangent(ta), b, yb: yawFromTangent(tb) }
  }, [])

  useLayoutEffect(() => {
    return () => Object.values(geoms).forEach((g) => g.dispose())
  }, [geoms])

  return (
    <group>
      <mesh geometry={geoms.surface} receiveShadow>
        <meshStandardMaterial color="#25282d" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geoms.skirtL} castShadow>
        <meshStandardMaterial color="#1c1f23" side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geoms.skirtR} castShadow>
        <meshStandardMaterial color="#1c1f23" side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geoms.railL}>
        <meshStandardMaterial color="#59606b" metalness={0.5} roughness={0.45} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geoms.railR}>
        <meshStandardMaterial color="#59606b" metalness={0.5} roughness={0.45} side={THREE.DoubleSide} />
      </mesh>

      <instancedMesh ref={slats} args={[undefined, undefined, slatCount]}>
        <boxGeometry args={[0.07, 0.012, BELT_WIDTH * 0.86]} />
        <meshStandardMaterial color="#3a3f47" />
      </instancedMesh>

      {legs.map((l, i) => (
        <group key={i} position={[l.x, 0, l.z]} rotation={[0, l.yaw, 0]}>
          {[-half + 0.08, half - 0.08].map((z) => (
            <mesh key={z} position={[0, (BELT_Y - 0.28) / 2, z]}>
              <boxGeometry args={[0.08, BELT_Y - 0.28, 0.08]} />
              <meshStandardMaterial color="#2a2d33" />
            </mesh>
          ))}
        </group>
      ))}

      {/* end rollers */}
      {[
        { p: start.a, yaw: start.ya },
        { p: start.b, yaw: start.yb },
      ].map(({ p: rp, yaw }, i) => (
        <group key={i} position={[rp.x, BELT_Y - 0.08, rp.z]} rotation={[0, yaw, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.12, BELT_WIDTH + 0.16, 16]} />
            <meshStandardMaterial color="#59606b" metalness={0.6} roughness={0.35} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
