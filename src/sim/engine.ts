import * as THREE from 'three'
import { AGENTS, BUSINESS_TYPES, CLIENT, DISCOVERABLE_DIRECTORIES, FIRST_NAMES, LAST_NAMES, NAME_PREFIX, START_DIRECTORIES, TITLES, type AgentDef, type DirectoryDef } from '@/config/floor'
import { setClockShift, useFloor, type Lead } from '@/store'
import { beltPath, yawFromTangent, BELT_Y, END_X } from './path'
import { directoryPosition } from '@/config/archive'

export const CARD_POOL = 90
export const ENVELOPE_POOL = 24
export const BELT_SPEED = 1.35
const SPACING = 1.05
const LAUNCH_DUR = 1.0
export const WORK_DURATION = .72
export const WORK_IMPACT = WORK_DURATION / 2
const PREWARM_SECS = 150
export const SHREDDER_POS = new THREE.Vector3(4.8, 0, -8)
export const BIN_POS = new THREE.Vector3(9.3, 0, 4.8)
export const OUTBOX_POS = new THREE.Vector3(-3.9, 0, 6.5)
/** Leo's throw: release point, launch velocity and gravity. The arc leaves the floor past the screen's left edge. */
export const THROW_FROM = new THREE.Vector3(OUTBOX_POS.x, 1.55, 5.8)
export const THROW_VELOCITY = new THREE.Vector3(-16, 15, 12)
const THROW_GRAVITY = -7
/** Leo winds up before the envelope leaves his hand (matches the loader arm swing). */
const THROW_WINDUP = .3
const THROW_DUR = 2.4
export const cabinetSlot = (i: number) => new THREE.Vector3(...directoryPosition(i))
export const STATION_D = {
  quinn: beltPath.project(-2.6, -6.5), remy: beltPath.project(2.6, -6.5),
  iris: beltPath.project(8, -1.6), vera: beltPath.project(8, 3),
  shred: beltPath.project(4.8, -6.5), bounce: beltPath.project(8, 4.4),
}
type FlightKind = 'shred' | 'bin' | 'outbox'
interface Flight { from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; h: number; kind: FlightKind; yaw: number }
interface Work { key: 'quinn' | 'remy' | 'iris' | 'vera'; t: number; applied: boolean }
export interface Card {
  id: number; slot: number; lead: Lead; d: number; mode: 'launch' | 'belt' | 'flight'
  launchFrom: THREE.Vector3; launchT: number; flight: Flight | null; qualifier: 'quinn' | 'remy'
  stamp: 0 | 1 | 2; face: number; check: 0 | 1 | 2
  offloadAt: number | null; offloadTo: FlightKind | null; work: Work | null
  done: Set<string>
}
interface Envelope { slot: number; t: number; dur: number; lead: Lead }
export interface Directory { def: DirectoryDef; slot: number; pos: THREE.Vector3; appearAt: number; landed: boolean }
interface Scraper { agent: AgentDef; dropD: number; dir: Directory; nextAt: number; found: number }
const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)]
const tmpA = new THREE.Vector3()
const tmpT = new THREE.Vector3()
let leadId = 0
function makeLead(source: string, now: number): Lead {
  const type = pick(BUSINESS_TYPES)
  const prefix = pick(NAME_PREFIX)
  const company = prefix + ' ' + type.label
  const domain = (prefix + type.label.split(' ')[0]).toLowerCase().replace(/[^a-z]/g, '') + '.com'
  const first = pick(FIRST_NAMES), last = pick(LAST_NAMES)
  return { id: ++leadId, company, domain, source, fit: type.fit, why: type.why, contact: first + ' ' + last,
    title: pick(TITLES), email: first.toLowerCase() + '.' + last.toLowerCase() + '@' + domain,
    emailOk: Math.random() > .09, stage: 'scraped', scrapedAt: now, campaign: CLIENT.campaign }
}
class Engine {
  time = 0
  cards: Card[] = []
  envelopes: Envelope[] = []
  directories: Directory[] = []
  scrapers: Scraper[] = []
  fx: Record<string, number> = {}
  finderTarget = 0
  lastResult: Record<string, boolean> = {}
  private freeCards = Array.from({ length: CARD_POOL }, (_, i) => i)
  private freeEnvelopes = Array.from({ length: ENVELOPE_POOL }, (_, i) => i)
  private nextDiscovery = PREWARM_SECS + 14
  private discovered = 0
  private nextAtlasTick = 0
  private atlasTicks = 0
  constructor() {
    this.directories = START_DIRECTORIES.map((def, slot) => ({ def, slot, pos: cabinetSlot(slot), appearAt: -1, landed: true }))
    this.scrapers = AGENTS.filter(a => a.role === 'scraper').map((agent, i) => ({
      agent, dropD: beltPath.project(-8, agent.pos[1]), dir: this.directories[i], nextAt: .3 + i * .8, found: 0,
    }))
  }
  age(key: string) { return this.fx[key] === undefined ? Infinity : this.time - this.fx[key] }
  activeCard(key: string) { return this.cards.find(c => c.work?.key === key) }
  private mark(key: string) { this.fx[key] = this.time }
  step(dt: number) {
    this.time += dt
    const store = useFloor.getState()
    for (const s of this.scrapers) {
      if (this.time >= s.nextAt && this.tryLaunch(s)) s.nextAt = this.time + 4.4 + Math.random() * .8
    }
    // Every record advances at belt speed. Intake reserves a clear merge slot.
    this.cards.sort((a, b) => b.d - a.d)
    const remove: Card[] = []
    for (const c of this.cards) {
      if (c.mode === 'flight') {
        c.flight!.t += dt
        if (c.flight!.t >= c.flight!.dur && this.landFlight(c)) remove.push(c)
        continue
      }
      const prev = c.d
      c.d += BELT_SPEED * dt
      if (c.mode === 'launch') {
        c.launchT += dt
        if (c.launchT >= LAUNCH_DUR) c.mode = 'belt'
      } else {
        const stations = [c.qualifier, 'iris', 'vera'] as const
        for (const key of stations) {
          const approach = STATION_D[key] - BELT_SPEED * WORK_IMPACT
          if (!c.done.has(key) && prev <= approach && c.d >= approach) {
            c.done.add(key)
            c.work = { key, t: (c.d - approach) / BELT_SPEED, applied: false }
            this.fx[key] = this.time - c.work.t
            break
          }
        }
        if (c.work) {
          c.work.t = (c.d - (STATION_D[c.work.key] - BELT_SPEED * WORK_IMPACT)) / BELT_SPEED
          if (!c.work.applied && c.d >= STATION_D[c.work.key]) {
            this.applyStation(c, c.work.key)
            c.work.applied = true
          }
          if (c.work.t >= WORK_DURATION) c.work = null
        }
        if (!c.work) {
          if (c.offloadAt !== null && c.d >= c.offloadAt) this.startFlight(c, c.offloadTo!)
          else if (c.d >= beltPath.length) this.startFlight(c, 'outbox')
        }
      }
    }
    for (const c of remove) { this.freeCards.push(c.slot); this.cards.splice(this.cards.indexOf(c), 1) }
    for (let i = this.envelopes.length - 1; i >= 0; i--) {
      const e = this.envelopes[i]
      e.t += dt
      if (e.t >= e.dur) {
        if (store.completeImport(e.lead)) this.mark('imported')
        this.freeEnvelopes.push(e.slot)
        this.envelopes.splice(i, 1)
      }
    }
    if (this.time >= this.nextDiscovery && this.discovered < DISCOVERABLE_DIRECTORIES.length) this.discover()
    if (this.time >= this.nextAtlasTick) {
      this.nextAtlasTick = this.time + 4
      this.mark('atlas')
      store.setStatus('atlas', this.cards.length + ' records on the line')
      if (++this.atlasTicks % 2 === 0) this.atlasNote()
    }
  }
  /** Atlas narrates what he sees on the floor, from the live counts. */
  private atlasNote() {
    const store = useFloor.getState(), k = store.kpis
    const onBelt = this.cards.filter(c => c.mode === 'belt')
    const waiting = { qualify: 0, find: 0, verify: 0 }
    for (const c of onBelt) {
      if (!c.done.has(c.qualifier)) waiting.qualify++
      else if (c.stamp === 1 && !c.done.has('iris')) waiting.find++
      else if (c.face >= 0 && !c.done.has('vera')) waiting.verify++
    }
    const busiest = (Object.entries(waiting) as [keyof typeof waiting, number][]).sort((a, b) => b[1] - a[1])[0]
    const fitRate = Math.round(k.fit / Math.max(1, k.fit + k.rejected) * 100)
    const validRate = Math.round(k.verified / Math.max(1, k.verified + k.invalid) * 100)
    const quinn = store.agents.quinn.count, remy = store.agents.remy.count
    const notes = [
      'Line check: ' + onBelt.length + ' records moving, most are waiting on ' + busiest[0] + ' (' + busiest[1] + ')',
      'Qualifier balance: Quinn ' + quinn + ' / Remy ' + remy + ', alternating cards to keep them even',
      'Fit rate holding at ' + fitRate + '% and verification at ' + validRate + '%',
      k.loaded + ' contacts in ' + CLIENT.campaignTool + ' so far, the line is clear to Leo',
    ]
    store.pushEvent('atlas', notes[this.atlasTicks / 2 % notes.length])
  }
  private tryLaunch(s: Scraper) {
    const start = s.dropD - BELT_SPEED * LAUNCH_DUR
    if (this.cards.some(c => c.mode !== 'flight' && Math.abs(c.d - start) < SPACING + .3)) return false
    const slot = this.freeCards.pop()
    if (slot === undefined) return false
    const lead = makeLead(s.dir.def.name, this.time)
    this.cards.push({
      id: lead.id, slot, lead, d: start, mode: 'launch', launchFrom: new THREE.Vector3(-10.1, BELT_Y + .04, s.agent.pos[1]),
      launchT: 0, flight: null, qualifier: lead.id % 2 ? 'quinn' : 'remy', stamp: 0, face: -1, check: 0,
      offloadAt: null, offloadTo: null, work: null, done: new Set(),
    })
    s.found++
    this.mark(s.agent.id)
    const store = useFloor.getState()
    store.setStatus(s.agent.id, s.found + ' companies extracted', 1)
    store.bump('scraped')
    store.pushEvent(s.agent.id, 'Pulled ' + lead.company + ' from ' + s.dir.def.name, 'info', lead.domain)
    const source = store.sources.find(r => r.id === s.dir.def.id)
    if (source) store.updateSource(source.id, { found: source.found + 1 })
    return true
  }
  private applyStation(c: Card, key: Work['key']) {
    const store = useFloor.getState(), lead = c.lead
    if (key === 'quinn' || key === 'remy') {
      this.lastResult[key] = lead.fit
      c.stamp = lead.fit ? 1 : 2
      lead.stage = lead.fit ? 'fit' : 'rejected'
      store.bump(lead.fit ? 'fit' : 'rejected')
      store.setStatus(key, (lead.fit ? 'Qualified · ' : 'Not a fit · ') + lead.company, 1)
      store.pushEvent(key, (lead.fit ? 'Qualified ' : 'Rejected ') + lead.company, lead.fit ? 'good' : 'bad', lead.why)
      if (!lead.fit) { c.offloadAt = STATION_D.shred; c.offloadTo = 'shred' }
    } else if (key === 'iris') {
      this.finderTarget = lead.id % 3
      c.face = lead.id % 6
      lead.stage = 'contact'
      store.bump('contacts')
      store.setStatus(key, lead.contact + ' · ' + lead.title, 1)
      store.pushEvent(key, 'Matched ' + lead.contact + ' at ' + lead.company, 'good', lead.title)
    } else {
      this.lastResult[key] = lead.emailOk
      c.check = lead.emailOk ? 1 : 2
      lead.stage = lead.emailOk ? 'verified' : 'invalid'
      store.bump(lead.emailOk ? 'verified' : 'invalid')
      store.setStatus(key, (lead.emailOk ? 'Verified ' : 'Invalid ') + lead.email, 1)
      store.pushEvent(key, (lead.emailOk ? 'Verified ' : 'Invalid address: ') + lead.email, lead.emailOk ? 'good' : 'bad', lead.company)
      if (!lead.emailOk) { c.offloadAt = STATION_D.bounce; c.offloadTo = 'bin' }
    }
  }
  cardPose(c: Card, out: THREE.Vector3) {
    if (c.mode === 'flight') {
      const f = c.flight!, t = Math.min(f.t / f.dur, 1)
      out.lerpVectors(f.from, f.to, t)
      out.y += Math.sin(Math.PI * t) * f.h
      return f.yaw
    }
    beltPath.at(Math.max(c.d, 0), out, tmpT)
    out.y = BELT_Y + .04
    const yaw = yawFromTangent(tmpT)
    if (c.mode === 'launch') {
      const t = Math.min(c.launchT / LAUNCH_DUR, 1)
      tmpA.copy(out); out.lerpVectors(c.launchFrom, tmpA, t)
    }
    return yaw
  }
  private startFlight(c: Card, kind: FlightKind) {
    const from = new THREE.Vector3(), yaw = this.cardPose(c, from)
    const to = kind === 'shred' ? SHREDDER_POS.clone().setY(.7) : kind === 'bin' ? BIN_POS.clone().setY(.5) : OUTBOX_POS.clone().setY(1.1)
    c.mode = 'flight'
    c.flight = { from, to, t: 0, dur: .5, h: .35, kind, yaw }
  }
  private landFlight(c: Card) {
    const kind = c.flight!.kind
    if (kind !== 'outbox') { this.mark(kind); return true }
    const slot = this.freeEnvelopes.pop()
    if (slot === undefined) return false
    this.mark('leo'); this.mark('outbox')
    this.envelopes.push({ slot, t: 0, dur: THROW_WINDUP + THROW_DUR, lead: c.lead })
    return true
  }
  private discover() {
    const def = DISCOVERABLE_DIRECTORIES[this.discovered]
    const s = this.scrapers[this.discovered % this.scrapers.length]
    this.discovered++
    this.nextDiscovery = this.time + 26
    const dir = { def, slot: this.directories.length, pos: cabinetSlot(this.directories.length), appearAt: this.time, landed: true }
    this.directories.push(dir)
    const store = useFloor.getState()
    store.updateSource(s.dir.def.id, { scraperId: null })
    s.dir = dir
    store.addSource({ ...def, scraperId: s.agent.id, found: 0, discoveredAt: Date.now() })
    store.pushEvent(s.agent.id, 'Connected source: ' + def.name)
    store.pushEvent('atlas', 'Connected ' + def.name + ' and handed it to ' + s.agent.name, 'good')
  }
  /** Seconds since release (0 during the wind-up). The envelope rides a ballistic arc off the floor. */
  envelopePose(e: Envelope, out: THREE.Vector3) {
    const t = Math.max(0, e.t - THROW_WINDUP)
    out.copy(THROW_FROM).addScaledVector(THROW_VELOCITY, t)
    out.y += .5 * THROW_GRAVITY * t * t
    return t
  }
}
export const engine = new Engine()
// Every opening count is produced by the same pipeline, not independent baselines.
for (let t = 0; t < PREWARM_SECS; t += 1 / 30) {
  setClockShift((PREWARM_SECS - t) * 1000)
  engine.step(1 / 30)
}
setClockShift(0)
export const BELT_END = new THREE.Vector3(END_X, BELT_Y, 6.5)


