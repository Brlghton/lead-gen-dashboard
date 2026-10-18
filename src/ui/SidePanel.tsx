import { useEffect, useState } from 'react'
import { Check, Pause, Play } from 'lucide-react'
import { agentById } from '@/config/floor'
import { useFloor, type Lead } from '@/store'
import { cn } from '@/lib/utils'
import { AgentPanel } from './AgentPanel'
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(id) }, [ms])
  return now
}
export const ago = (at: number, now: number) => {
  const s = Math.max(0, Math.round((now - at) / 1000))
  return s < 3 ? 'now' : s < 60 ? s + 's' : s < 3600 ? Math.floor(s / 60) + 'm' : Math.floor(s / 3600) + 'h'
}
export function AgentAvatar({ id, size = 'sm' }: { id: string; size?: 'sm' | 'lg' }) {
  const a = agentById(id)
  return <div className={cn('grid shrink-0 place-items-center rounded-lg font-semibold text-white', size === 'sm' ? 'size-6 text-[10px]' : 'size-10 text-base')} style={{ background: a.shirt }}>{a.name[0]}</div>
}
const STAGES = [
  { key: 'scraped', label: 'Scraped', unit: 'companies', color: '#8c9e9b' },
  { key: 'fit', label: 'Qualified', unit: 'companies', color: '#a6a075' },
  { key: 'contacts', label: 'Contacts', unit: 'people', color: '#8ca19c' },
  { key: 'verified', label: 'Verified', unit: 'emails', color: '#69a38e' },
  { key: 'loaded', label: 'Imported', unit: 'contacts', color: '#21765e' },
] as const
function LoadRow({ lead, now }: { lead: Lead; now: number }) {
  return <li className="feed-in flex items-center gap-2.5 py-3">
    <div className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Check size={12} /></div>
    <div className="min-w-0 flex-1 leading-snug"><div className="truncate text-xs font-medium">{lead.company}</div><div className="mt-0.5 truncate text-[10px] text-muted-foreground">{lead.contact} · {lead.title}</div></div>
    <span className="shrink-0 text-[9px] text-muted-foreground tabular-nums">{ago(lead.importedAt!, now)}</span>
  </li>
}
export function SidePanel() {
  const k = useFloor(s => s.kpis)
  const leads = useFloor(s => s.leads)
  const paused = useFloor(s => s.paused)
  const togglePause = useFloor(s => s.togglePause)
  const selected = useFloor(s => s.selectedAgent)
  const now = useNow()
  // A selected agent takes over the panel with its own activity and chat.
  if (selected) return <AgentPanel key={selected} id={selected} />
  return <aside className="sidebar" aria-label="Line progress and imported leads">
    <section className="border-b border-border p-4">
      <div className="flex items-center justify-between">
        <div><div className="mb-1 flex items-center gap-1.5 text-[10px] text-muted-foreground"><span className={cn('size-1.5 rounded-full bg-primary', !paused && 'live-dot')} />{paused ? 'Line paused' : 'Line running'}</div><h2 className="text-base font-semibold">Today's line</h2></div>
        <button onClick={togglePause} className="control-button !p-2" aria-label={paused ? 'Resume line animation' : 'Pause line animation'}>{paused ? <Play size={12} /> : <Pause size={12} />}</button>
      </div>
      <div className="mt-5 space-y-3">{STAGES.map(s => {
        const base = s.key === 'fit' ? k.scraped : s.key === 'verified' || s.key === 'loaded' ? k.contacts : k[s.key]
        const pct = Math.min(100, k[s.key] / Math.max(1, base) * 100)
        return <div key={s.key}><div className="mb-1 flex items-baseline justify-between text-[11px]"><span>{s.label} <span className="text-[9px] text-muted-foreground">{s.unit}</span></span><strong className="font-medium tabular-nums">{k[s.key].toLocaleString()}</strong></div>
          <div className="h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full transition-[width] duration-500" style={{ width: pct + '%', background: s.color }} /></div>
        </div>
      })}</div>
    </section>
    <div className="flex items-center justify-between px-4 pt-4 pb-1"><h3 className="text-xs font-semibold">Live activity</h3><span className="rounded bg-primary/8 px-1.5 py-1 text-[9px] text-primary">Added to Instantly</span></div>
    <ul className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto px-4">
      {!leads.length && <li className="py-8 text-center text-xs text-muted-foreground">Waiting for the first import…</li>}
      {leads.slice(0, 60).map(lead => <LoadRow key={lead.id} lead={lead} now={now} />)}
    </ul>
    <div className="border-t border-border px-4 py-3 text-[10px] text-muted-foreground"><span className="font-medium text-primary">{k.loaded.toLocaleString()}</span> contacts added this session</div>
  </aside>
}
