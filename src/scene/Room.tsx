import { Box } from './primitives'
import { DirectoryArchive, Plaque } from './Archive'
function Zone({ x, z, w, d, color }: { x: number; z: number; w: number; d: number; color: string }) {
  return <group><Box args={[w, .015, d]} position={[x, .014, z]} color={color} castShadow={false} />
    {[-1, 1].map(s => <Box key={s} args={[.045, .02, d]} position={[x + s * w / 2, .028, z]} color="#ae9062" castShadow={false} />)}
  </group>
}
export function Room() {
  return <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.65, 0]} receiveShadow><planeGeometry args={[200, 200]} /><meshStandardMaterial color="#e5e0d5" roughness={1} /></mesh>
    <Box args={[30.4, .5, 23]} position={[-1.7, -.31, -.5]} color="#374d49" />
    <Box args={[30.5, .055, 23.1]} position={[-1.7, -.075, -.5]} color="#b99862" />
    <Box args={[30.3, .09, 22.9]} position={[-1.7, -.01, -.5]} color="#c8ba9f" />
    {Array.from({length:15}, (_,i) => -15.7 + i * 2).map(x => <Box key={x} args={[.018, .006, 22.6]} position={[x, .04, -.5]} color="#b7aa92" castShadow={false} />)}
    {[-10,-8,-6,-4,-2,0,2,4,6,8,10].map(z => <Box key={z} args={[30, .006, .018]} position={[-1.7, .041, z]} color="#b7aa92" castShadow={false} />)}
    <Zone x={-11.1} z={.0} w={6.2} d={10.8} color="#9eafa2" />
    <Zone x={0} z={-7.8} w={11.6} d={2.8} color="#c9ae78" />
    <Zone x={9.6} z={-1.6} w={3.1} d={4.2} color="#a2b1ad" />
    <Zone x={9.6} z={3.2} w={3.1} d={4.1} color="#9bac95" />
    <Zone x={-3.9} z={7.4} w={6} d={3.8} color="#b7aa88" />
    <DirectoryArchive />
    {/* Pad under Atlas's dome */}
    <Box args={[6.2, .04, 6]} position={[0, .045, .1]} color="#adad96" castShadow={false} />
    <group position={[0, .075, 2.78]} rotation={[-Math.PI / 2, 0, 0]}><Plaque text="RECORDS EXCHANGE" width={4.9} height={.35} color="#adad96" ink="#526454" /></group>
    {[-1,1].map(s => <Box key={s} args={[.035, .018, 6]} position={[s * 3.1, .075, .1]} color="#d5c397" castShadow={false} />)}
    {/* Inlaid guide marks carry the intake route into the working floor. */}
    {[0,1,2,3,4,5,6].map(i => <Box key={i} args={[.55, .018, .08]} position={[-12 + i * .9, .06, 5.5]} color="#ede0bb" castShadow={false} />)}
    <group position={[-1.8, -.3, 11.06]}><Plaque text="SOURCE  /  QUALIFY  /  ENRICH  /  VERIFY  /  DISPATCH" width={12} height={.25} color="#374d49" ink="#cebb95" /></group>
  </group>
}

