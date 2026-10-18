import { create } from 'zustand'
import { AGENTS, CLIENT, START_DIRECTORIES, type DirectoryDef } from '@/config/floor'

export type Tone = 'info' | 'good' | 'bad'
export interface FeedEvent {
  id: number; at: number; agentId: string; text: string; tone: Tone
  meta?: { company: string; contact: string; title: string; leadId: number }
  /** Extra context the agent can explain when asked, e.g. why a company was rejected. */
  detail?: string
}
export interface ChatMsg { id: number; from: 'user' | 'agent'; text: string; at: number }
export interface Tally { good: number; bad: number; info: number }
export type LeadStage = 'scraped' | 'fit' | 'rejected' | 'contact' | 'verified' | 'invalid' | 'loaded'
export interface Lead {
  id: number; company: string; domain: string; source: string; fit: boolean; why: string
  contact: string; title: string; email: string; emailOk: boolean; stage: LeadStage; scrapedAt: number
  importedAt?: number; campaign?: string
}
export interface AgentStatus { status: string; count: number; busyAt: number }
export interface SourceRow extends DirectoryDef { scraperId: string | null; found: number; discoveredAt: number | null }
export type Tab = 'floor' | 'leads' | 'sources' | 'agents'
const EMPTY_COUNTS = { scraped: 0, fit: 0, rejected: 0, contacts: 0, verified: 0, invalid: 0, loaded: 0 }
export interface FloorState {
  tab: Tab; selectedAgent: string | null; hoveredAgent: string | null; paused: boolean
  events: FeedEvent[]; agents: Record<string, AgentStatus>; kpis: typeof EMPTY_COUNTS
  /** Complete successful-import history for this session; no rolling truncation. */
  leads: Lead[]; sources: SourceRow[]; viewResets: number
  /** Per-agent activity (newest first) and running totals, so each agent speaks only to its own work. */
  logs: Record<string, FeedEvent[]>; tally: Record<string, Tally>; chats: Record<string, ChatMsg[]>
  setTab: (t: Tab) => void; select: (id: string | null) => void; hover: (id: string | null) => void
  resetView: () => void; togglePause: () => void
  pushEvent: (agentId: string, text: string, tone?: Tone, detail?: string) => void
  pushChat: (agentId: string, from: ChatMsg['from'], text: string) => void
  setStatus: (agentId: string, status: string, countDelta?: number) => void
  bump: (key: Exclude<keyof typeof EMPTY_COUNTS, 'loaded'>, n?: number) => void
  completeImport: (lead: Lead) => boolean
  addSource: (row: SourceRow) => void; updateSource: (id: string, patch: Partial<SourceRow>) => void
}
let eventId = 0
let chatId = 0
let clockShift = 0
export const setClockShift = (ms: number) => { clockShift = ms }
const LOG_LIMIT = 40
export const EMPTY_TALLY: Tally = { good: 0, bad: 0, info: 0 }
function withLog(s: Pick<FloorState, 'events' | 'logs' | 'tally'>, e: FeedEvent) {
  const t = s.tally[e.agentId] ?? EMPTY_TALLY
  return {
    events: [e, ...s.events].slice(0, 150),
    logs: { ...s.logs, [e.agentId]: [e, ...(s.logs[e.agentId] ?? [])].slice(0, LOG_LIMIT) },
    tally: { ...s.tally, [e.agentId]: { ...t, [e.tone]: t[e.tone] + 1 } },
  }
}
const initialAgents = Object.fromEntries(AGENTS.map(a => [a.id, { status: 'Ready for the next record', count: 0, busyAt: -10 }]))
const scrapers = AGENTS.filter(a => a.role === 'scraper')
export const useFloor = create<FloorState>((set) => ({
  tab: 'floor', selectedAgent: null, hoveredAgent: null, paused: false,
  events: [], agents: initialAgents, kpis: { ...EMPTY_COUNTS }, leads: [], logs: {}, tally: {}, chats: {},
  sources: START_DIRECTORIES.map((d, i) => ({ ...d, scraperId: scrapers[i]?.id ?? null, found: 0, discoveredAt: null })),
  viewResets: 0,
  setTab: tab => set({ tab, selectedAgent: null, hoveredAgent: null }),
  select: selectedAgent => set({ selectedAgent, hoveredAgent: null, tab: 'floor' }),
  hover: hoveredAgent => set({ hoveredAgent }),
  resetView: () => set(s => ({ selectedAgent: null, hoveredAgent: null, tab: 'floor', viewResets: s.viewResets + 1 })),
  togglePause: () => set(s => ({ paused: !s.paused })),
  pushEvent: (agentId, text, tone = 'info', detail) => set(s =>
    withLog(s, { id: ++eventId, at: Date.now() - clockShift, agentId, text, tone, detail })),
  pushChat: (agentId, from, text) => set(s => ({
    chats: { ...s.chats, [agentId]: [...(s.chats[agentId] ?? []), { id: ++chatId, from, text, at: Date.now() }] },
  })),
  setStatus: (agentId, status, countDelta = 0) => set(s => ({
    agents: { ...s.agents, [agentId]: { status, count: (s.agents[agentId]?.count ?? 0) + countDelta, busyAt: performance.now() } },
  })),
  bump: (key, n = 1) => set(s => ({ kpis: { ...s.kpis, [key]: s.kpis[key] + n } })),
  completeImport: lead => {
    let imported = false
    set(s => {
      const campaign = lead.campaign ?? CLIENT.campaign
      if (!lead.fit || !lead.emailOk || lead.stage !== 'verified') return s
      if (s.leads.some(l => l.id === lead.id || (l.email.toLowerCase() === lead.email.toLowerCase() && l.campaign === campaign))) return s
      imported = true
      const at = Date.now() - clockShift
      const record: Lead = { ...lead, stage: 'loaded', importedAt: at, campaign }
      const total = s.leads.length + 1
      return {
        leads: [record, ...s.leads], kpis: { ...s.kpis, loaded: total },
        agents: { ...s.agents, leo: { status: total.toLocaleString() + ' added to Instantly', count: total, busyAt: performance.now() } },
        ...withLog(s, { id: ++eventId, at, agentId: 'leo', text: 'Added ' + lead.contact + ' at ' + lead.company + ' to Instantly', tone: 'good',
          meta: { company: lead.company, contact: lead.contact, title: lead.title, leadId: lead.id }, detail: lead.email }),
      }
    })
    return imported
  },
  addSource: row => set(s => s.sources.some(r => r.id === row.id) ? s : { sources: [...s.sources, row] }),
  updateSource: (id, patch) => set(s => ({ sources: s.sources.map(r => r.id === id ? { ...r, ...patch } : r) })),
}))
