import { AGENTS, CLIENT, ROLE_LABEL, type AgentDef } from '@/config/floor'
import { EMPTY_TALLY, type FeedEvent, type FloorState } from '@/store'

/**
 * Local, data-grounded replies for the agent chat. Each agent answers only from
 * its own activity log and counters (Atlas can also speak for the whole floor).
 * Swap `replyTo` for an LLM call later; the snapshot below is the context to send it.
 */
export type ChatSnapshot = Pick<FloorState, 'agents' | 'logs' | 'tally' | 'kpis' | 'sources' | 'leads'>

const ago = (at: number, now: number) => {
  const s = Math.max(0, Math.round((now - at) / 1000))
  return s < 3 ? 'just now' : s < 60 ? s + 's ago' : s < 3600 ? Math.floor(s / 60) + 'm ago' : Math.floor(s / 3600) + 'h ago'
}
const pct = (a: number, b: number) => Math.round(a / Math.max(1, a + b) * 100)
const n = (v: number) => v.toLocaleString()

function sourceOf(agent: AgentDef, s: ChatSnapshot) { return s.sources.find(r => r.scraperId === agent.id) }
function perMinute(logs: FeedEvent[], now: number) { return logs.filter(e => now - e.at < 60_000).length }

function numbers(agent: AgentDef, s: ChatSnapshot) {
  const t = s.tally[agent.id] ?? EMPTY_TALLY, k = s.kpis
  switch (agent.role) {
    case 'scraper': {
      const src = sourceOf(agent, s)
      return 'I\'ve pulled ' + n(s.agents[agent.id].count) + ' companies this session' + (src ? ', ' + n(src.found) + ' of them from ' + src.name : '') + '.'
    }
    case 'qualifier': return n(t.good) + ' qualified and ' + n(t.bad) + ' rejected so far, a ' + pct(t.good, t.bad) + '% fit rate.'
    case 'finder': return 'I\'ve matched ' + n(t.good) + ' decision-makers so far, one for every qualified company that reached me.'
    case 'verifier': return n(t.good) + ' emails verified and ' + n(t.bad) + ' invalid, a ' + pct(t.good, t.bad) + '% pass rate.'
    case 'loader': return n(k.loaded) + ' contacts loaded into "' + CLIENT.campaign + '" in ' + CLIENT.campaignTool + '.'
    default: return 'Floor-wide: ' + n(k.scraped) + ' scraped, ' + n(k.fit) + ' qualified, ' + n(k.contacts) + ' contacts found, ' + n(k.verified) + ' verified, ' + n(k.loaded) + ' in ' + CLIENT.campaignTool + '.'
  }
}

function doing(agent: AgentDef, s: ChatSnapshot, now: number) {
  const logs = s.logs[agent.id] ?? [], last = logs[0]
  const intro: Record<AgentDef['role'], string> = {
    scraper: 'I\'m working the ' + (sourceOf(agent, s)?.name ?? 'next') + ' directory, pulling company records and dropping each one on the belt.',
    qualifier: 'I\'m reading company websites and stamping each card fit or not a fit against the ICP.',
    finder: 'I\'m finding the decision-maker at every qualified company and pinning them to the card.',
    verifier: 'I\'m checking every email before it\'s allowed through to Leo.',
    loader: 'I\'m grabbing verified leads off the end of the line and launching them into ' + CLIENT.campaignTool + '.',
    janitor: 'I\'m keeping the floor clear.',
    hunter: 'I\'m scouting for new directories.',
    atlas: 'I\'m watching the whole floor and keeping work moving between stations. ' + s.agents.atlas.status + '.',
  }
  let out = intro[agent.role]
  if (last) out += ' Latest: ' + last.text + ' (' + ago(last.at, now) + ').'
  const rate = perMinute(logs, now)
  if (rate > 1 && agent.role !== 'atlas') out += ' That\'s ' + rate + ' in the last minute.'
  if (agent.role === 'atlas') out += ' ' + numbers(agent, s)
  return out
}

function recent(agent: AgentDef, s: ChatSnapshot, now: number, count = 5) {
  const logs = (s.logs[agent.id] ?? []).slice(0, count)
  if (!logs.length) return 'Nothing logged yet. I\'m waiting on my first record.'
  return 'Here\'s my last ' + logs.length + ':\n' + logs.map(e => '• ' + e.text + ' (' + ago(e.at, now) + ')').join('\n')
}

function problems(agent: AgentDef, s: ChatSnapshot, now: number) {
  const logs = s.logs[agent.id] ?? [], bad = logs.filter(e => e.tone === 'bad').slice(0, 3)
  const t = s.tally[agent.id] ?? EMPTY_TALLY
  switch (agent.role) {
    case 'qualifier':
      return bad.length ? 'I\'ve rejected ' + n(t.bad) + ' so far. The most recent:\n' + bad.map(e => '• ' + e.text.replace('Rejected ', '') + ': ' + e.detail).join('\n') + '\nRejects go straight to the shredder.' : 'Nothing rejected recently. Every card has been a fit.'
    case 'verifier':
      return bad.length ? n(t.bad) + ' addresses failed verification. The latest:\n' + bad.map(e => '• ' + e.text.replace('Invalid address: ', '') + ' (' + e.detail + ', ' + ago(e.at, now) + ')').join('\n') + '\nThey get bounced to the bin so Leo never sends to a dead inbox.' : 'No invalid addresses recently. Everything has passed.'
    case 'scraper': return 'No errors on my side. ' + (sourceOf(agent, s)?.name ?? 'My source') + ' is responding normally and I\'m feeding the belt at a steady pace.'
    case 'finder': return 'No misses so far. Every qualified company that reached me had a decision-maker I could match.'
    case 'loader': return 'No failed imports. I only accept fit, verified leads, and I skip anyone already in the campaign so nobody gets emailed twice.'
    default: {
      const k = s.kpis, check = (s.logs.atlas ?? []).find(e => e.text.startsWith('Line check'))
      return 'Nothing is stuck. ' + (check ? check.text + '. ' : '') + n(k.rejected) + ' companies were rejected as not a fit and ' + n(k.invalid) + ' emails failed verification. Both are filtered out before ' + CLIENT.campaignTool + '.'
    }
  }
}

/** Finds the log entry a question is about: a named company, person or email, or the latest reject. */
function findEntry(agent: AgentDef, s: ChatSnapshot, q: string) {
  const logs = s.logs[agent.id] ?? []
  const named = logs.find(e => {
    const words = e.text.split(' ').slice(1)
    const subject = (words[0]?.includes('@') ? words[0] : words.slice(0, 2).join(' ')).toLowerCase().replace(/[.,]$/, '')
    return subject.length > 3 && q.includes(subject)
  })
  if (named) return named
  if (/reject|fail|invalid|bad|bounce/.test(q)) return logs.find(e => e.tone === 'bad')
  if (/last|latest|recent|that one|just/.test(q)) return logs[0]
}

function explain(agent: AgentDef, e: FeedEvent, now: number) {
  const when = ' (' + ago(e.at, now) + ')'
  switch (agent.role) {
    case 'qualifier': return (e.tone === 'good' ? 'I qualified ' + e.text.replace('Qualified ', '') : 'I rejected ' + e.text.replace('Rejected ', '')) + when + '. My read: ' + e.detail + '.'
    case 'verifier': return e.tone === 'good' ? e.text.replace('Verified ', '') + ' passed verification' + when + ' for ' + e.detail + '.' : e.text.replace('Invalid address: ', '') + ' failed verification' + when + '. The mailbox doesn\'t accept mail, so ' + e.detail + ' left the line.'
    case 'finder': return e.text + when + '. Their title is ' + e.detail + ', which matches the buyer persona.'
    case 'scraper': return e.text + when + '. Their site is ' + e.detail + '.'
    case 'loader': return e.text + when + ', at ' + e.detail + '.'
    default: return e.text + when + '.'
  }
}

export function suggestions(agent: AgentDef) {
  if (agent.role === 'atlas') return ['How is the floor doing?', 'Where\'s the bottleneck?', 'How is Quinn doing?', 'Show your last 5']
  const issue = agent.role === 'qualifier' ? 'Why did you reject the last one?' : agent.role === 'verifier' ? 'Which emails failed?' : 'Anything go wrong?'
  return ['What are you up to?', 'Show your last 5', 'How are your numbers?', issue]
}

export function greeting(agent: AgentDef, s: ChatSnapshot, now: number) {
  return 'Hey, I\'m ' + agent.name + ', ' + ROLE_LABEL[agent.role].toLowerCase() + '. ' + doing(agent, s, now)
}

export function replyTo(agent: AgentDef, question: string, s: ChatSnapshot, now = Date.now()): string {
  const q = question.toLowerCase().trim()
  if (!q) return 'Ask me anything about my station.'
  if (/^(thanks|thank you|thx|ty|nice|great|good job|awesome|cool)\b/.test(q)) return 'Anytime. ' + numbers(agent, s)
  if (/^(hi|hey|hello|yo|sup|howdy)\b/.test(q) && q.split(' ').length <= 3) return 'Hey. ' + doing(agent, s, now)
  if (/who are you|what do you do|your (job|role)|what('s| is) your|tools|how do you work/.test(q)) return agent.blurb + ' I run on ' + agent.tools + '.'
  const other = AGENTS.find(a => a.id !== agent.id && new RegExp('\\b' + a.name.toLowerCase() + '\\b').test(q))
  if (other) {
    if (agent.role !== 'atlas') return 'That\'s ' + other.name + '\'s station. Click them on the floor to ask directly. I can only speak to my own work.'
    return other.name + ' (' + ROLE_LABEL[other.role].toLowerCase() + '): ' + s.agents[other.id].status + '. ' + numbers(other, s).replace(/\bI've\b/g, 'They\'ve').replace(/\bI\b/g, 'they').replace(/\bme\b/g, 'them')
  }
  if (/why|what happened|explain|tell me about/.test(q) || /@/.test(q)) {
    const e = findEntry(agent, s, q)
    if (e) return explain(agent, e, now)
  }
  if (/problem|issue|wrong|fail|reject|invalid|error|stuck|bounce|bottleneck|slow|behind|miss/.test(q)) return problems(agent, s, now)
  if (/fast|speed|pace|per minute|throughput|how quick/.test(q)) {
    const rate = perMinute(s.logs[agent.id] ?? [], now)
    return agent.role === 'atlas' ? s.agents.atlas.status + '. ' + numbers(agent, s) : 'I handled ' + rate + ' in the last minute. My pace is set by the belt, so I keep up with whatever reaches me.'
  }
  if (/how many|count|total|numbers|stats|so far|rate|percent|score/.test(q)) return numbers(agent, s)
  if (/last|latest|recent|history|log|show/.test(q)) {
    const m = q.match(/\b(\d{1,2})\b/)
    return recent(agent, s, now, m ? Math.min(Math.max(+m[1], 1), 15) : 5)
  }
  if (agent.role === 'scraper' && /source|directory|where|site/.test(q)) {
    const src = sourceOf(agent, s)
    return src ? 'I\'m on ' + src.name + '. ' + n(src.found) + ' companies extracted from it so far.' : 'I\'m between sources right now.'
  }
  if (/up to|doing|working|status|busy|going on|happening|update|floor|how('s| is| are)/.test(q)) return doing(agent, s, now)
  const e = findEntry(agent, s, q)
  if (e) return explain(agent, e, now)
  return 'I can only speak to my own station. Try asking what I\'m up to, my last few records, my numbers, or anything that went wrong.'
}
