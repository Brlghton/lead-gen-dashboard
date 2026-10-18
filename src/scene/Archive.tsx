import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ARCHIVE_DIRECTORIES, archiveRoute, directoryFacing, directoryPosition, INTAKE_HUB } from '@/config/archive'
import { engine } from '@/sim/engine'
import { Box } from './primitives'

export function Plaque({ text, width = 2, height = .4, color = '#eee1c5', ink = '#354c4a' }: { text: string; width?: number; height?: number; color?: string; ink?: string }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024; canvas.height = Math.round(1024 * height / width)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = color; ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = '600 ' + Math.round(canvas.height * .49) + 'px sans-serif'
    ctx.fillText(text, canvas.width / 2, canvas.height * .52, canvas.width * .92)
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [text, width, height, color, ink])
  return <mesh><planeGeometry args={[width, height]} /><meshBasicMaterial map={texture} /></mesh>
}
function TubeSegment({ a, b, radius = .105, color = '#bd9661' }: { a: THREE.Vector3; b: THREE.Vector3; radius?: number; color?: string }) {
  const mid = a.clone().add(b).multiplyScalar(.5)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
  return <mesh position={mid} quaternion={q} castShadow><cylinderGeometry args={[radius, radius, a.distanceTo(b), 10]} /><meshStandardMaterial color={color} metalness={.5} roughness={.35} /></mesh>
}
function Cabinet({ index }: { index: number }) {
  const def = ARCHIVE_DIRECTORIES[index]
  const rear = index >= 4, width = rear ? 3.35 : 2.15
  const doors = rear ? [-.82, .82] : [0]
  const shell = rear && index % 2 ? '#3b5556' : '#284342'
  return <group position={directoryPosition(index)} rotation={[0, directoryFacing(index), 0]}>
    <Box args={[width + .1, .18, 1.65]} position={[0, .1, 0]} color="#243b3b" />
    <Box args={[width, 3.25, 1.4]} position={[0, 1.8, 0]} color={shell} />
    <Box args={[width + .12, .13, 1.52]} position={[0, 3.48, 0]} color="#b89662" />
    {doors.flatMap((x, column) => [0,1,2,3].map(row => {
      const open = (index + row + column) % 9 === 0 ? .3 : 0
      return <group key={column + '-' + row} position={[x, .63 + row * .68, .73 + open]}>
        <Box args={[rear ? 1.56 : width - .18, .59, .12]} color={row % 2 ? '#49605b' : '#3a514d'} />
        <Box args={[.5, .18, .035]} position={[0, .09, .09]} color="#b69860" />
        <Box args={[.36, .085, .012]} position={[0, .09, .112]} color="#e9deba" />
        <Box args={[.46, .055, .1]} position={[0, -.14, .13]} color="#d0ac73" />
        {open > 0 && <group>
          <Box args={[rear ? 1.5 : 1.9, .42, .48]} position={[0, .02, -.22]} color="#ae9977" />
          {[0,1,2,3].map(i => <Box key={i} args={[rear ? 1.35 : 1.65, .44, .025]} position={[0, .21, -.4 + i * .095]} color={i % 2 ? '#b69a68' : '#e0cc9f'} />)}
        </group>}
      </group>
    }))}
    <group position={[0, 3.15, .716]}><Plaque text={def.name.toUpperCase()} width={width - .25} height={.27} color="#d5bd86" /></group>
    <Box args={[.22, .13, .1]} position={[width / 2 - .2, 3.15, .73]} color="#79a98e" />
  </group>
}
function DocumentPulse({ points, offset, sourceId }: { points: THREE.Vector3[]; offset: number; sourceId?: string }) {
  const ref = useRef<THREE.Group>(null)
  const lengths = useMemo(() => points.slice(1).map((p, i) => p.distanceTo(points[i])), [points])
  const total = lengths.reduce((sum, d) => sum + d, 0)
  useFrame(() => {
    if (!ref.current) return
    ref.current.visible = !sourceId || engine.scrapers.some(s => s.dir.def.id === sourceId)
    let distance = ((engine.time * .15 + offset) % 1) * total
    for (let i = 0; i < lengths.length; i++) {
      if (distance <= lengths[i] || i === lengths.length - 1) {
        ref.current.position.lerpVectors(points[i], points[i + 1], Math.min(distance / lengths[i], 1))
        ref.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), points[i + 1].clone().sub(points[i]).normalize())
        break
      }
      distance -= lengths[i]
    }
  })
  return <group ref={ref}><Box args={[.22, .18, .5]} color="#f0d59a" emissive="#e8bd6d" emissiveIntensity={.45} /><Box args={[.24, .2, .07]} color="#587d6b" /></group>
}
export function DirectoryArchive() {
  const routes = useMemo(() => ARCHIVE_DIRECTORIES.map((_, i) => archiveRoute(i).map(p => new THREE.Vector3(...p))), [])
  const feeds = useMemo(() => [3.75, 1.25, -1.25, -3.75].map(z => [
    new THREE.Vector3(...INTAKE_HUB), new THREE.Vector3(-12.7, 1, z - .85), new THREE.Vector3(-10.1, 1, z - .85), new THREE.Vector3(-10.1, .7, z),
  ]), [])
  // Shared header segments are drawn once even where source routes overlap.
  const segments = useMemo(() => {
    const list: [THREE.Vector3, THREE.Vector3][] = []
    routes.forEach(route => route.slice(1).forEach((p, i) => {
      // Horizontal branches connect to the rear header, which is one continuous tube.
      if (i === 2 && route.length === 5) return
      list.push([route[i], p])
    }))
    list.push([new THREE.Vector3(-12.7, 4.5, -8.9), new THREE.Vector3(8.2, 4.5, -8.9)])
    list.push([new THREE.Vector3(-16, 4.5, -7.2), new THREE.Vector3(-12.7, 4.5, -7.2)])
    return list
  }, [routes])
  return <group>
    {ARCHIVE_DIRECTORIES.map((_, i) => <Cabinet key={i} index={i} />)}
    {segments.map(([a,b], i) => <TubeSegment key={i} a={a} b={b} />)}
    {[-11.8,-3.8,4.2].map(x => <group key={x}>
      <Box args={[.12, 4.5, .12]} position={[x, 2.25, -8.9]} color="#465750" />
      <Box args={[.38, .06, .38]} position={[x, .05, -8.9]} color="#9a8460" />
    </group>)}
    {routes.map((points, i) => <DocumentPulse key={i} points={points} offset={i * .17} sourceId={ARCHIVE_DIRECTORIES[i].id} />)}
    <group position={INTAKE_HUB}>
      <Box args={[1.6, 1.65, 1.3]} position={[0, -.05, 0]} color="#ae653e" />
      <Box args={[1.7, .12, 1.4]} position={[0, .85, 0]} color="#dfbc7d" />
      <group position={[0, .5, .66]}><Plaque text="INTAKE" width={1.25} height={.3} /></group>
      {[0,1,2,3].map(i => <Box key={i} args={[.13, .13, .04]} position={[-.45 + i * .3, .04, .68]} color="#cce0b6" emissive="#9cce96" emissiveIntensity={.3} />)}
    </group>
    {feeds.map((points,i) => <group key={i}>
      {points.slice(1).map((p,j) => <TubeSegment key={j} a={points[j]} b={p} radius={.14} color="#657f79" />)}
      <DocumentPulse points={points} offset={i * .23} />
    </group>)}
  </group>
}


