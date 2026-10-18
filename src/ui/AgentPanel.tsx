import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowUp, Check, Circle, X } from 'lucide-react'
import { CLIENT, ROLE_LABEL, agentById, type AgentDef } from '@/config/floor'
import { EMPTY_TALLY, useFloor, type ChatMsg, type FeedEvent } from '@/store'
import { greeting, replyTo, suggestions } from '@/chat/respond'
import { cn } from '@/lib/utils'
import { AgentAvatar, ago, useNow } from './SidePanel'

const NO_LOGS: FeedEvent[] = []
const NO_CHAT: ChatMsg[] = []

function Stats({ agent }: { agent: AgentDef }) {
  const t = useFloor(s => s.tally[agent.id]) ?? EMPTY_TALLY
  const count = useFloor(s => s.agents[agent.id].count)
  const k = useFloor(s => s.kpis)
  const source = useFloor(s => s.sources.find(r => r.scraperId === agent.id)?.name)
  const rows: [string, string][] = agent.role === 'scraper' ? [['Extracted', count.toLocaleString()], ['Source', source ?? '—']]
    : agent.role === 'qualifier' ? [['Qualified', t.good.toLocaleString()], ['Rejected', t.bad.toLocaleString()]]
    : agent.role === 'finder' ? [['Matched', t.good.toLocaleString()], ['Fit companies', k.fit.toLocaleString()]]
    : agent.role === 'verifier' ? [['Verified', t.good.toLocaleString()], ['Invalid', t.bad.toLocaleString()]]
    : agent.role === 'loader' ? [['In ' + CLIENT.campaignTool, k.loaded.toLocaleString()], ['Campaign', CLIENT.campaign]]
    : [['Scraped', k.scraped.toLocaleString()], ['In ' + CLIENT.campaignTool, k.loaded.toLocaleString()]]
  return <div className="mt-2 grid grid-cols-2 gap-2">
    {rows.map(([label, value]) => <div key={label} className="flex min-w-0 items-baseline justify-between gap-2 rounded-md bg-muted px-2.5 py-1.5">
      <span className="shrink-0 text-[9px] text-muted-foreground">{label}</span>
      <span className="truncate text-xs font-semibold tabular-nums" title={value}>{value}</span>
    </div>)}
  </div>
}

function ActivityList({ logs, now }: { logs: FeedEvent[]; now: number }) {
  if (!logs.length) return <p className="py-8 text-center text-xs text-muted-foreground">No activity yet.</p>
  return <ul className="divide-y divide-border/60">
    {logs.map(e => <li key={e.id} className="feed-in flex items-start gap-2.5 py-2.5">
      <div className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full', e.tone === 'good' ? 'bg-primary/10 text-primary' : e.tone === 'bad' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground')}>
        {e.tone === 'good' ? <Check size={11} /> : e.tone === 'bad' ? <X size={11} /> : <Circle size={6} fill="currentColor" />}
      </div>
      <div className="min-w-0 flex-1 leading-snug">
        <div className="text-xs">{e.text}</div>
        {e.detail && <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{e.detail}</div>}
      </div>
      <span className="shrink-0 pt-0.5 text-[9px] text-muted-foreground tabular-nums">{ago(e.at, now)}</span>
    </li>)}
  </ul>
}

export function AgentPanel({ id }: { id: string }) {
  const agent = agentById(id)
  const status = useFloor(s => s.agents[id].status)
  const logs = useFloor(s => s.logs[id]) ?? NO_LOGS
  const chat = useFloor(s => s.chats[id]) ?? NO_CHAT
  const select = useFloor(s => s.select)
  const pushChat = useFloor(s => s.pushChat)
  const [view, setView] = useState<'chat' | 'activity'>('chat')
  const [draft, setDraft] = useState('')
  const [typing, setTyping] = useState(false)
  const now = useNow()
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const s = useFloor.getState()
    if (!s.chats[id]?.length) s.pushChat(id, 'agent', greeting(agent, s, Date.now()))
  }, [id, agent])
  useEffect(() => {
    const el = scroller.current
    if (el && view === 'chat') el.scrollTop = el.scrollHeight
  }, [chat.length, typing, view])

  const send = (text: string) => {
    const q = text.trim()
    if (!q || typing) return
    pushChat(id, 'user', q)
    setDraft('')
    setTyping(true)
    // A short pause reads as the agent checking its station before answering.
    setTimeout(() => { pushChat(id, 'agent', replyTo(agent, q, useFloor.getState())); setTyping(false) }, 450 + Math.random() * 450)
  }
  const submit = (e: FormEvent) => { e.preventDefault(); send(draft) }

  return <aside className="sidebar" aria-label={'Chat with ' + agent.name}>
    <section className="border-b border-border px-4 pt-3 pb-3">
      <button onClick={() => select(null)} className="mb-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"><ArrowLeft size={12} />Back to overview</button>
      <div className="flex items-center gap-3">
        <AgentAvatar id={agent.id} size="lg" />
        <div className="min-w-0"><h2 className="text-sm font-semibold">{agent.name}</h2><p className="truncate text-[11px] text-muted-foreground">{ROLE_LABEL[agent.role]} · {agent.tools}</p></div>
      </div>
      <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-[11px]">
        <span className="live-dot size-1.5 shrink-0 rounded-full bg-primary" /><span className="truncate" title={status}>{status}</span>
      </div>
      <Stats agent={agent} />
    </section>
    <div className="px-4 pt-3" role="tablist" aria-label="Agent views">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-[11px] font-medium">
        {(['chat', 'activity'] as const).map(v => <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
          className={cn('rounded-md px-2 py-1.5 capitalize text-muted-foreground', view === v && 'bg-card text-foreground shadow-sm')}>
          {v === 'chat' ? 'Chat' : <>Activity <span className="ml-0.5 text-muted-foreground tabular-nums">{logs.length}</span></>}
        </button>)}
      </div>
    </div>
    <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
      {view === 'activity' ? <ActivityList logs={logs} now={now} /> : <div className="space-y-2.5">
        {chat.map(m => <div key={m.id} className={cn('feed-in flex gap-2', m.from === 'user' && 'justify-end')}>
          {m.from === 'agent' && <AgentAvatar id={agent.id} />}
          <div className={cn('chat-bubble', m.from === 'user' ? 'chat-user' : 'chat-agent')}>{m.text}</div>
        </div>)}
        {typing && <div className="flex gap-2"><AgentAvatar id={agent.id} /><div className="chat-bubble chat-agent"><span className="typing-dots"><i /><i /><i /></span></div></div>}
      </div>}
    </div>
    {view === 'chat' && <div className="border-t border-border p-3">
      <div className="chat-chips mb-2 flex gap-1.5 overflow-x-auto">
        {suggestions(agent).map(s => <button key={s} onClick={() => send(s)} disabled={typing} className="chat-chip">{s}</button>)}
      </div>
      <form onSubmit={submit} className="flex items-center gap-2 rounded-lg border border-border bg-background/60 py-1 pr-1 pl-3 focus-within:border-primary/50">
        <input value={draft} onChange={e => setDraft(e.target.value)} placeholder={'Ask ' + agent.name + ' anything…'}
          className="chat-input min-w-0 flex-1 bg-transparent py-1 text-xs placeholder:text-muted-foreground" aria-label={'Message ' + agent.name} />
        <button type="submit" disabled={!draft.trim() || typing} aria-label="Send" className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground disabled:opacity-40"><ArrowUp size={14} /></button>
      </form>
    </div>}
  </aside>
}
