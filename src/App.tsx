import { lazy, Suspense } from 'react'
import { useFloor } from '@/store'
import { FloorControls } from '@/ui/FloorControls'
import { TopNav } from '@/ui/TopNav'
import { KpiStrip } from '@/ui/KpiStrip'
import { SidePanel } from '@/ui/SidePanel'
import { AgentsView, LeadsView, SourcesView } from '@/ui/Views'
const FloorScene = lazy(() => import('@/scene/FloorScene').then(m => ({ default: m.FloorScene })))
const Labels = lazy(() => import('@/scene/Labels').then(m => ({ default: m.Labels })))
export default function App() {
  const tab = useFloor(s => s.tab)
  return <div className="app-shell">
    <TopNav />
    <div className="dashboard-body">
      <main className="workspace">
        <KpiStrip />
        <div className="floor-window" onContextMenu={e => e.preventDefault()}>
          <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Opening the workshop…</div>}>
            <FloorScene />
            {tab === 'floor' && <Labels />}
          </Suspense>
          {tab === 'leads' && <LeadsView />}
          {tab === 'sources' && <SourcesView />}
          {tab === 'agents' && <AgentsView />}
          {tab === 'floor' && <FloorControls />}
        </div>
      </main>
      <SidePanel />
    </div>
    <footer className="app-footer">Built by Baycrest Systems</footer>
  </div>
}
