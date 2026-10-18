import { useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Search, X } from 'lucide-react'
import { AGENTS, CLIENT, ROLE_LABEL } from '@/config/floor'
import { useFloor } from '@/store'
import { AgentAvatar, ago, useNow } from './SidePanel'

function Shell({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  const setTab = useFloor(s => s.setTab)
  return <div className="absolute inset-0 z-30 flex flex-col overflow-hidden bg-card">
    <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
      <div><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-xs text-muted-foreground">{sub}</p></div>
      <button onClick={() => setTab('floor')} className="control-button"><X size={14} />Back to floor</button>
    </div>
    <div className="min-h-0 flex-1 overflow-auto">{children}</div>
  </div>
}
export function LeadsView() {
  const leads = useFloor(s => s.leads)
  const [query, setQuery] = useState('')
  const [campaign, setCampaign] = useState('all')
  const [period, setPeriod] = useState('all')
  const [page, setPage] = useState(0)
  const now = useNow(10000)
  const campaigns = useMemo(() => [...new Set(leads.map(l => l.campaign ?? CLIENT.campaign))], [leads])
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const start = new Date(now); start.setHours(0, 0, 0, 0)
    return leads.filter(l =>
      (!q || [l.company, l.contact, l.email, l.title, l.source].some(v => v.toLowerCase().includes(q))) &&
      (campaign === 'all' || l.campaign === campaign) &&
      (period === 'all' || (l.importedAt ?? 0) >= (period === 'hour' ? now - 3600000 : start.getTime())))
  }, [leads, query, campaign, period, now])
  const pageCount = Math.max(1, Math.ceil(matches.length / 40))
  const currentPage = Math.min(page, pageCount - 1)
  const shown = matches.slice(currentPage * 40, (currentPage + 1) * 40)
  return <Shell title="Imported leads" sub={leads.length.toLocaleString() + ' contacts added to Instantly · this session'}>
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-border bg-card p-4">
      <label className="flex min-w-40 flex-1 items-center gap-2 rounded-lg border border-border px-3 py-2">
        <Search size={15} className="text-muted-foreground" /><input aria-label="Search imported leads" value={query} onChange={e => { setQuery(e.target.value); setPage(0) }} placeholder="Search company, person or email" className="min-w-0 flex-1 bg-transparent text-xs outline-none" />
      </label>
      <select aria-label="Filter by campaign" className="rounded-lg border border-border bg-card p-2 text-xs" value={campaign} onChange={e => { setCampaign(e.target.value); setPage(0) }}>
        <option value="all">All campaigns</option>{campaigns.map(c => <option key={c}>{c}</option>)}
      </select>
      <select aria-label="Filter by import time" className="rounded-lg border border-border bg-card p-2 text-xs" value={period} onChange={e => { setPeriod(e.target.value); setPage(0) }}>
        <option value="all">All imports</option><option value="today">Today</option><option value="hour">Last hour</option>
      </select>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-xs">
        <thead className="border-b border-border bg-muted/50 text-[10px] text-muted-foreground">
          <tr>{['Company', 'Contact', 'Role', 'Email', 'Campaign', 'Imported'].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {!shown.length && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">{leads.length ? 'No imports match these filters.' : 'Successful Instantly imports will appear here.'}</td></tr>}
          {shown.map(l => <tr key={l.id} className="hover:bg-muted/40">
            <td className="px-4 py-3"><div className="font-medium">{l.company}</div><div className="mt-1 text-[10px] text-muted-foreground" title={'Source: ' + l.source}>{l.source}</div></td>
            <td className="px-4 py-3 whitespace-nowrap">{l.contact}</td>
            <td className="px-4 py-3 text-muted-foreground">{l.title}</td>
            <td className="px-4 py-3">{l.email}</td>
            <td className="px-4 py-3 text-muted-foreground">{l.campaign}</td>
            <td className="px-4 py-3 whitespace-nowrap tabular-nums text-muted-foreground">{new Date(l.importedAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
          </tr>)}
        </tbody>
      </table>
    </div>
    <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
      <span>{matches.length ? currentPage * 40 + 1 : 0}–{Math.min((currentPage + 1) * 40, matches.length)} of {matches.length.toLocaleString()}</span>
      <div className="flex items-center gap-2"><button className="control-button disabled:opacity-40" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} aria-label="Previous page"><ArrowLeft size={13} /></button>
      <span>{currentPage + 1} / {pageCount}</span><button className="control-button disabled:opacity-40" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)} aria-label="Next page"><ArrowRight size={13} /></button></div>
    </div>
  </Shell>
}
export function SourcesView() {
  const sources = useFloor(s => s.sources)
  const now = useNow()
  return <Shell title="Sources" sub="Connected directories. Four scraping stations turn source records into company cards.">
    <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
      {sources.map(s => {
        const scraper = AGENTS.find(a => a.id === s.scraperId)
        return <div key={s.id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2"><div className="font-medium">{s.name}</div>
            <span className="rounded bg-muted px-2 py-1 text-[10px] text-muted-foreground">{s.discoveredAt ? 'Connected ' + ago(s.discoveredAt, now) + ' ago' : 'Connected'}</span>
          </div>
          <div className="mt-4 text-2xl font-semibold tabular-nums">{s.found.toLocaleString()}</div>
          <div className="text-[11px] text-muted-foreground">companies extracted</div>
          <div className="mt-4 flex items-center gap-2 text-xs">{scraper ? <><AgentAvatar id={scraper.id} /><span>{scraper.name} is scraping this source</span></> :
            <span className="text-muted-foreground">{s.found ? 'Available for another pass' : 'Queued for a scraper'}</span>}</div>
        </div>
      })}
    </div>
  </Shell>
}
export function AgentsView() {
  const agents = useFloor(s => s.agents)
  const select = useFloor(s => s.select)
  return <Shell title="Agents" sub="Everyone on the floor. Select an agent to visit their station.">
    <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
      {AGENTS.map(a => <button key={a.id} onClick={() => select(a.id)} className="rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40">
        <div className="flex items-center gap-3"><AgentAvatar id={a.id} size="lg" /><div><div className="font-medium">{a.name}</div><div className="text-xs text-muted-foreground">{ROLE_LABEL[a.role]}</div></div></div>
        <div className="mt-3 truncate text-[13px]">{agents[a.id].status}</div><div className="mt-1 text-[11px] text-muted-foreground">{a.tools}</div>
      </button>)}
    </div>
  </Shell>
}
