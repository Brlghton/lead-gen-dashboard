import { Bot, Database, LayoutDashboard, List, Pause, Play, RotateCcw } from 'lucide-react'
import { useFloor, type Tab } from '@/store'
import { cn } from '@/lib/utils'
const TABS: { id: Tab; label: string; icon: typeof Bot }[] = [
  { id: 'floor', label: 'Floor', icon: LayoutDashboard }, { id: 'leads', label: 'Leads', icon: List },
  { id: 'sources', label: 'Sources', icon: Database }, { id: 'agents', label: 'Agents', icon: Bot },
]
export function TopNav() {
  const tab = useFloor(s => s.tab)
  const setTab = useFloor(s => s.setTab)
  const paused = useFloor(s => s.paused)
  const togglePause = useFloor(s => s.togglePause)
  const resetView = useFloor(s => s.resetView)
  const leads = useFloor(s => s.kpis.loaded)
  return <header className="top-nav">
    <nav aria-label="Dashboard" className="flex items-center gap-1">
      {TABS.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined} className={cn('nav-tab', tab === id && 'active')}>
        <Icon size={17} /><span>{label}</span>{id === 'leads' && <span className="nav-count">{leads.toLocaleString()}</span>}
      </button>)}
    </nav>
    <div className="flex items-center gap-2">
      <button onClick={togglePause} className="control-button" aria-pressed={paused} title={paused ? 'Resume the line animation' : 'Pause the line animation'}>
        {paused ? <Play size={14} /> : <Pause size={14} />}{paused ? 'Resume' : 'Pause'}
      </button>
      <button onClick={resetView} className="control-button reset-top"><RotateCcw size={14} /><span>Reset View</span></button>
    </div>
  </header>
}
