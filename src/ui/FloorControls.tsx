import { Maximize2, Minus, Plus, X } from 'lucide-react'
import { ROLE_LABEL, agentById } from '@/config/floor'
import { useFloor } from '@/store'
import { cameraApi } from '@/scene/cameraApi'
import { AgentAvatar } from './SidePanel'

/** Map-style controls over the floor: zoom, back to overview, and a way out of an agent's view. */
export function FloorControls() {
  const selected = useFloor(s => s.selectedAgent)
  const select = useFloor(s => s.select)
  const resetView = useFloor(s => s.resetView)
  const agent = selected ? agentById(selected) : null
  return <>
    {agent && <div className="floor-focus">
      <AgentAvatar id={agent.id} />
      <span className="font-semibold">{agent.name}</span><span className="text-muted-foreground">{ROLE_LABEL[agent.role]}</span>
      <button onClick={() => select(null)} className="floor-focus-close" aria-label="Back to overview" title="Back to overview (Esc)"><X size={13} /></button>
    </div>}
    <div className="floor-hint">{agent ? 'Click empty floor or press Esc to step back' : 'Drag to move · Scroll to zoom · Right-drag to rotate · Click an agent to chat'}</div>
    <div className="floor-zoom" role="group" aria-label="Floor view controls">
      <button onClick={() => cameraApi.zoomBy(1.35)} aria-label="Zoom in" title="Zoom in (+)"><Plus size={15} /></button>
      <button onClick={() => cameraApi.zoomBy(1 / 1.35)} aria-label="Zoom out" title="Zoom out (−)"><Minus size={15} /></button>
      <button onClick={resetView} aria-label="Show the whole floor" title="Show the whole floor"><Maximize2 size={13} /></button>
    </div>
  </>
}
