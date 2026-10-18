import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import CameraControlsImpl from 'camera-controls'
import * as THREE from 'three'
import { agentById } from '@/config/floor'
import { useFloor } from '@/store'
import { engine } from '@/sim/engine'
import { Room } from './Room'
import { Belt } from './Belt'
import { Stations } from './Stations'
import { Cards, Envelopes } from './Movers'
import { LabelProjector } from './Labels'
import { cameraApi } from './cameraApi'
const { ACTION } = CameraControlsImpl
export const HOME = { pos: [23, 30, 38] as const, target: [-1.5, .9, .1] as const }

/*
 * Navigation model: the camera stays at a fixed distance and orthographic zoom does all the
 * magnifying, so nothing ever slips behind the near plane. Panning slides the target across
 * the floor and is fenced to it; rotation stays close to the home angle so labels stay readable.
 */
const HOME_OFFSET = new THREE.Vector3(...HOME.pos).sub(new THREE.Vector3(...HOME.target))
const DISTANCE = HOME_OFFSET.length()
const HOME_AZIMUTH = Math.atan2(HOME_OFFSET.x, HOME_OFFSET.z)
const HOME_POLAR = Math.acos(HOME_OFFSET.y / DISTANCE)
const PAN_BOUNDS = new THREE.Box3(new THREE.Vector3(-15.5, 0, -11), new THREE.Vector3(11.5, 2, 10))
/** How far past the full-floor view the zoom can go, in both directions. */
const ZOOM_OUT = .85, ZOOM_IN = 5.5, AGENT_ZOOM = 2.6

/** Zoom at which the whole floor fits the viewport from the home angle. */
function fitZoom(width: number, height: number) {
  const target = new THREE.Vector3(...HOME.target)
  const forward = HOME_OFFSET.clone().negate().normalize()
  const right = forward.clone().cross(new THREE.Vector3(0, 1, 0)).normalize()
  const up = right.clone().cross(forward).normalize()
  const xs: number[] = [], ys: number[] = []
  for (const x of [-17, 13]) for (const y of [-.6, 5.6]) for (const z of [-12, 10.85]) {
    const p = new THREE.Vector3(x, y, z).sub(target)
    xs.push(p.dot(right)); ys.push(p.dot(up))
  }
  return Math.min(width / (Math.max(...xs) - Math.min(...xs)), height / (Math.max(...ys) - Math.min(...ys))) * .9
}
function SimDriver() {
  useFrame((_, dt) => { if (!useFloor.getState().paused) engine.step(Math.min(dt, .05)) })
  return null
}
function CameraRig() {
  const ref = useRef<CameraControlsImpl>(null)
  const selected = useFloor(s => s.selectedAgent)
  const resetKey = useFloor(s => s.viewResets)
  const { width, height } = useThree(s => s.size)
  const fit = useMemo(() => fitZoom(width, height), [width, height])
  const fence = useMemo(() => ({ box: new THREE.Box3(), home: new THREE.Vector3(...HOME.target), k: -1 }), [])
  useEffect(() => {
    const c = ref.current
    if (!c) return
    cameraApi.zoomBy = factor => { void c.zoomTo(c.camera.zoom * factor, true) }
    return () => { cameraApi.zoomBy = () => {} }
  }, [])
  // The pan fence grows with zoom: at the full-floor view it collapses to the centre, so
  // zooming out always settles back on the whole floor instead of a stranded corner.
  // It follows the zoom *destination* so gliding to an agent isn't clamped mid-flight.
  const updateFence = (c: CameraControlsImpl) => {
    const zoomEnd = (c as unknown as { _zoomEnd?: number })._zoomEnd ?? c.camera.zoom
    const k = THREE.MathUtils.clamp((1 - fit / zoomEnd) / (1 - 1 / AGENT_ZOOM), 0, 1)
    if (Math.abs(k - fence.k) < .005) return
    fence.k = k
    fence.box.min.lerpVectors(fence.home, PAN_BOUNDS.min, k)
    fence.box.max.lerpVectors(fence.home, PAN_BOUNDS.max, k)
    c.setBoundary(fence.box)
  }
  useFrame(() => { if (ref.current) updateFence(ref.current) })
  useEffect(() => {
    const c = ref.current
    if (!c) return
    if (selected) {
      // Glide to the agent from the current angle; never pull back if already closer.
      // Zoom first so the fence has opened before the move is clamped against it.
      const a = agentById(selected)
      void c.zoomTo(Math.max(c.camera.zoom, fit * AGENT_ZOOM), true)
      updateFence(c)
      void c.moveTo(a.pos[0], a.role === 'atlas' ? 1.3 : 1, a.pos[1], true)
    } else {
      void c.setLookAt(...HOME.pos, ...HOME.target, true)
      void c.zoomTo(fit, true)
    }
  }, [selected, resetKey, fit])
  return <CameraControls ref={ref} makeDefault smoothTime={.35} draggingSmoothTime={.08}
    minDistance={DISTANCE} maxDistance={DISTANCE} minZoom={fit * ZOOM_OUT} maxZoom={fit * ZOOM_IN}
    minAzimuthAngle={HOME_AZIMUTH - .8} maxAzimuthAngle={HOME_AZIMUTH + .8} minPolarAngle={HOME_POLAR - .35} maxPolarAngle={HOME_POLAR + .2}
    azimuthRotateSpeed={.4} polarRotateSpeed={.3} dollyToCursor dollySpeed={.7} verticalDragToForward
    mouseButtons={{ left: ACTION.TRUCK, middle: ACTION.ROTATE, right: ACTION.ROTATE, wheel: ACTION.ZOOM }}
    touches={{ one: ACTION.TOUCH_TRUCK, two: ACTION.TOUCH_ZOOM_TRUCK, three: ACTION.TOUCH_ROTATE }} />
}
export function FloorScene() {
  const down = useRef({ x: 0, y: 0 })
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { useFloor.getState().select(null); return }
      if ((e.target as HTMLElement)?.closest?.('input, textarea')) return
      if (e.key === '+' || e.key === '=') cameraApi.zoomBy(1.35)
      else if (e.key === '-' || e.key === '_') cameraApi.zoomBy(1 / 1.35)
    }
    window.addEventListener('keydown', keys); return () => window.removeEventListener('keydown', keys)
  }, [])
  // A click (not a drag) on empty floor steps back out to the overview.
  const missed = (e: MouseEvent) => {
    if (e.button !== 0 || Math.hypot(e.clientX - down.current.x, e.clientY - down.current.y) > 5) return
    if (useFloor.getState().selectedAgent) useFloor.getState().select(null)
  }
  return <div className="absolute inset-0" onContextMenu={e => e.preventDefault()} onPointerDown={e => { down.current = { x: e.clientX, y: e.clientY } }}>
    <Canvas orthographic shadows={{ type: THREE.PCFShadowMap }} dpr={[1, 1.75]} camera={{ position: [...HOME.pos], zoom: 20, near: .1, far: 250 }} gl={{ antialias: true, toneMappingExposure: 1.1 }}
      onPointerMissed={missed}>
      <color attach="background" args={['#e9e8e2']} /><fog attach="fog" args={['#e9e8e2', 100, 200]} />
      <hemisphereLight args={['#fff9e9', '#b9bdac', 2.0]} />
      <ambientLight intensity={.4} />
      <directionalLight position={[-8, 14, 12]} intensity={.4} />
      <directionalLight position={[-12, 24, 8]} intensity={2.1} castShadow shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-25} shadow-camera-right={25} shadow-camera-top={24} shadow-camera-bottom={-24} shadow-bias={-.0004} shadow-normalBias={.03} />
      <SimDriver /><Room /><Belt /><Stations /><Cards /><Envelopes /><LabelProjector /><CameraRig />
    </Canvas>
  </div>
}


