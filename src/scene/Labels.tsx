import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { AGENTS, ROLE_LABEL, agentById, type AgentDef } from '@/config/floor'
import { useFloor } from '@/store'
type Anchor = { el: HTMLElement; pos: THREE.Vector3; show?: () => boolean }
const anchors = new Map<string, Anchor>()
const anchorRef = (key: string, pos: THREE.Vector3, show?: () => boolean) => (el: HTMLElement | null) => {
  if (el) anchors.set(key, { el, pos, show })
  else if (anchors.get(key)?.pos === pos) anchors.delete(key)
}
export function LabelProjector() {
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera, size }) => {
    for (const a of anchors.values()) {
      v.copy(a.pos).project(camera)
      const x = (v.x * .5 + .5) * size.width, y = (-v.y * .5 + .5) * size.height
      if (v.z > 1 || v.z < -1 || x < 0 || x > size.width || y < 0 || y > size.height || (a.show && !a.show())) { a.el.style.visibility = 'hidden'; continue }
      a.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) translate(-50%,-50%)'
      a.el.style.visibility = 'visible'
    }
  })
  return null
}
const BASE = 'absolute left-0 top-0 invisible will-change-transform'
function AgentTag({ agent }: { agent: AgentDef }) {
  const status = useFloor(s => s.agents[agent.id].status)
  const select = useFloor(s => s.select)
  // Atlas's tag sits above his dome and its permanent title.
  const pos = useMemo(() => new THREE.Vector3(agent.pos[0], agent.role === 'atlas' ? 4.4 : 2.8, agent.pos[1]), [agent])
  return <button ref={anchorRef('agent-' + agent.id, pos, () => { const s = useFloor.getState(); return s.selectedAgent === agent.id || s.hoveredAgent === agent.id })}
    onClick={() => select(agent.id)} className={BASE + ' agent-tag z-20'}>
    <div className="text-[11px] font-semibold">{agent.name} <span className="ml-1 font-normal text-muted-foreground">{ROLE_LABEL[agent.role]}</span></div>
    <div className="mt-1 truncate text-[10px] text-muted-foreground">{status}</div>
  </button>
}
const STAGES = [
  { id: 'scrape', number: '01', text: 'Scrape', pos: new THREE.Vector3(-10.6, 3.1, -6.1) },
  { id: 'qualify', number: '02', text: 'Qualify', pos: new THREE.Vector3(0, 2.65, -8.3) },
  { id: 'find', number: '03', text: 'Find contacts', pos: new THREE.Vector3(10, 2.7, -1.6) },
  { id: 'verify', number: '04', text: 'Verify', pos: new THREE.Vector3(10, 2.65, 3.15) },
  { id: 'load', number: '05', text: 'Load', pos: new THREE.Vector3(-3.9, 2.7, 5.2) },
]
const atlas = agentById('atlas')
const ATLAS_TITLE_POS = new THREE.Vector3(atlas.pos[0], 3.3, atlas.pos[1])
export function Labels() {
  const select = useFloor(s => s.select)
  return <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-label="Floor stations">
    {STAGES.map(s => <div key={s.id} ref={anchorRef(s.id, s.pos, () => !useFloor.getState().selectedAgent)} className={BASE + ' stage-tag'}><b>{s.number}</b>{s.text}</div>)}
    <button ref={anchorRef('atlas-title', ATLAS_TITLE_POS)} onClick={() => select(atlas.id)} className={BASE + ' atlas-title'}><span className="atlas-title-dot" />{ROLE_LABEL.atlas}</button>
    {AGENTS.map(a => <AgentTag key={a.id} agent={a} />)}
  </div>
}


