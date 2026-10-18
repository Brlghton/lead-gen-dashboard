/**
 * Lead-processing workshop configuration.
 *
 * Everything that changes per client lives here: who's on the floor, which
 * directories get scraped, the ICP, and the campaign leads get loaded into.
 * Positions are floor coordinates (x = left/right, z = back/front, origin = Atlas).
 */

export type AgentRole = 'hunter' | 'scraper' | 'qualifier' | 'finder' | 'verifier' | 'loader' | 'janitor' | 'atlas'

export interface AgentDef {
  id: string
  name: string
  role: AgentRole
  title: string
  tools: string
  accent: string
  shirt: string
  hair: string
  /** hair down past the shoulders */
  longHair?: boolean
  /** defaults to the shared dark slacks */
  pants?: string
  skin: string
  /** floor position [x, z] */
  pos: [number, number]
  /** direction the agent faces, radians around Y (0 = toward camera) */
  facing: number
  standing?: boolean
  /** height of the platform the agent works on (source hunter's tower) */
  elevation?: number
  blurb: string
}

export interface DirectoryDef {
  id: string
  name: string
  color: string
}

export const CLIENT = {
  company: '',
  icp: 'Food, produce and CPG brands shipping 300+ orders a month without their own warehouse',
  campaign: 'Q4 Produce & CPG outbound',
  campaignTool: 'Instantly',
}

const ROLE_ACCENT: Record<AgentRole, string> = {
  hunter: '#60a5fa',
  scraper: '#a78bfa',
  qualifier: '#f5c451',
  finder: '#f472b6',
  verifier: '#4ade80',
  loader: '#4fd1b0',
  janitor: '#a3e635',
  atlas: '#e7c27a',
}

export const ROLE_LABEL: Record<AgentRole, string> = {
  hunter: 'Source hunter',
  scraper: 'Scraper',
  qualifier: 'Qualifier',
  finder: 'Contact finder',
  verifier: 'Email verifier',
  loader: 'Loader',
  janitor: 'Cleanup crew',
  atlas: 'Chief of staff',
}

const agent = (a: Omit<AgentDef, 'accent'>): AgentDef => ({ ...a, accent: ROLE_ACCENT[a.role] })

export const AGENTS: AgentDef[] = [
  agent({
    id: 'nora', name: 'Nora', role: 'scraper', title: 'Scraper', tools: 'Apify + Playwright',
    shirt: '#8b5cf6', hair: '#6b3e26', skin: '#f1c9a5', pos: [-11, 3.75], facing: Math.PI / 2,
    blurb: 'Pulls company records out of her assigned directory and drops each one on the belt as a lead card.',
  }),
  agent({
    id: 'theo', name: 'Theo', role: 'scraper', title: 'Scraper', tools: 'Apify + Playwright',
    shirt: '#7c3aed', hair: '#1f1a17', skin: '#c68e63', pos: [-11, 1.25], facing: Math.PI / 2,
    blurb: 'Pulls company records out of his assigned directory and drops each one on the belt as a lead card.',
  }),
  agent({
    id: 'mila', name: 'Mila', role: 'scraper', title: 'Scraper', tools: 'Google Maps API',
    shirt: '#a855f7', hair: '#d9a35b', skin: '#f3d0b5', pos: [-11, -1.25], facing: Math.PI / 2,
    blurb: 'Pulls company records out of her assigned directory and drops each one on the belt as a lead card.',
  }),
  agent({
    id: 'owen', name: 'Owen', role: 'scraper', title: 'Scraper', tools: 'Apify + Playwright',
    shirt: '#6d28d9', hair: '#4a3020', skin: '#8d5a3b', pos: [-11, -3.75], facing: Math.PI / 2,
    blurb: 'Pulls company records out of his assigned directory and drops each one on the belt as a lead card.',
  }),
  agent({
    id: 'quinn', name: 'Quinn', role: 'qualifier', title: 'Qualifier', tools: 'Firecrawl + Claude',
    shirt: '#d97706', hair: '#2b2118', skin: '#e8b98f', pos: [-2.6, -8.0], facing: 0, standing: true,
    blurb: 'Reads the company website, works out what they actually do, and stamps the card green (fit) or red (not a fit).',
  }),
  agent({
    id: 'remy', name: 'Remy', role: 'qualifier', title: 'Qualifier', tools: 'Firecrawl + Claude',
    shirt: '#b45309', hair: '#7a4a2a', skin: '#a8714c', pos: [2.6, -8.0], facing: 0, standing: true,
    blurb: 'Reads the company website, works out what they actually do, and stamps the card green (fit) or red (not a fit).',
  }),
  agent({
    id: 'iris', name: 'Iris', role: 'finder', title: 'Contact finder', tools: 'Icypeas + LinkedIn',
    shirt: '#db2777', hair: '#111111', skin: '#f0c7a0', pos: [9.5, -1.6], facing: -Math.PI / 2, standing: true,
    blurb: 'Uses the ICP buyer personas to find the decision maker at each qualified company and pins their face to the card.',
  }),
  agent({
    id: 'vera', name: 'Vera', role: 'verifier', title: 'Email verifier', tools: 'Icypeas verification',
    shirt: '#16a34a', hair: '#8a5a33', skin: '#e9bf9b', pos: [9.5, 3], facing: -Math.PI / 2, standing: true,
    blurb: 'Checks every email before it goes out. Valid addresses pass the check; invalid addresses leave the line.',
  }),
  agent({
    id: 'leo', name: 'Leo', role: 'loader', title: 'Loader', tools: 'Instantly API',
    shirt: '#0d9488', hair: '#2b2118', skin: '#c99872', pos: [-3.9, 4.9], facing: 0, standing: true,
    blurb: 'Stands at the outbox and fires verified leads into the Instantly campaign.',
  }),
  agent({
    id: 'atlas', name: 'Atlas', role: 'atlas', title: 'Chief of staff', tools: 'Workflow routing',
    shirt: '#a16207', hair: '#3a2a1e', skin: '#e2b58c', pos: [0, -0.2], facing: 0,
    blurb: 'Runs the floor from the command desk in the middle. Watches every station, routes work, and keeps the line moving.',
  }),
]

export const agentById = (id: string) => AGENTS.find((a) => a.id === id)!

/** Directories on the floor at load, one per scraper (same order as the scrapers above). */
export const START_DIRECTORIES: DirectoryDef[] = [
  { id: 'paca', name: 'PACA', color: '#8fb3ff' },
  { id: 'fulfill', name: 'Fulfill.com', color: '#c4a1ff' },
  { id: 'gmaps', name: 'Google Maps', color: '#7ee0a1' },
  { id: 'assoc', name: 'Trade associations', color: '#f5b971' },
]

/** Additional directory modules connected during the demonstration. */
export const DISCOVERABLE_DIRECTORIES: DirectoryDef[] = [
  { id: 'bluebook', name: 'Blue Book Services', color: '#7dd3fc' },
  { id: 'thomasnet', name: 'ThomasNet', color: '#fda4af' },
  { id: 'importyeti', name: 'ImportYeti', color: '#fcd34d' },
  { id: 'sfa', name: 'Specialty Food Assoc.', color: '#86efac' },
  { id: 'ifda', name: 'IFDA members', color: '#c4b5fd' },
  { id: 'shopify', name: 'Shopify App Store', color: '#5eead4' },
]

/* ---------- sample lead data (demo only) ---------- */

export const NAME_PREFIX = [
  'Harvest Lane', 'Blue Ridge', 'Golden Valley', 'Coastal', 'Pioneer', 'Summit', 'Riverbend', 'Sunrise',
  'Evergreen', 'Northstar', 'Cedar Point', 'Red Barn', 'Mesa Verde', 'Prairie', 'Bayside', 'Orchard Hill',
  'Silver Creek', 'Ironwood', 'Westfield', 'Lakeshore', 'Copper Pot', 'Wild Fern', 'Tidewater', 'Maple & Oak',
]

/** Business types per source. `fit` = matches the ICP. */
export const BUSINESS_TYPES: { label: string; fit: boolean; why: string }[] = [
  { label: 'Produce Co.', fit: true, why: 'Regional produce shipper, no cold-chain 3PL listed' },
  { label: 'Fresh Foods', fit: true, why: 'DTC food brand, ~600 orders/mo from a shared kitchen' },
  { label: 'Snack Co.', fit: true, why: 'CPG snack brand selling on Shopify + Amazon' },
  { label: 'Coffee Roasters', fit: true, why: 'Subscription coffee, outgrowing in-house packing' },
  { label: 'Pantry Goods', fit: true, why: 'Specialty pantry brand, 40+ SKUs, wholesale + DTC' },
  { label: 'Growers', fit: true, why: 'Grower-shipper, seasonal volume spikes' },
  { label: 'Bakery', fit: false, why: 'Single-location retail bakery, no shipping' },
  { label: 'Florist', fit: false, why: 'Local florist, delivery radius only' },
  { label: 'Logistics', fit: false, why: 'Runs its own warehouse network (competitor)' },
  { label: 'Grill & Bar', fit: false, why: 'Restaurant, not a product brand' },
]

export const FIRST_NAMES = ['Dana', 'Marcus', 'Priya', 'Jordan', 'Elena', 'Sam', 'Kenji', 'Rachel', 'Luis', 'Tess', 'Andre', 'Hannah', 'Omar', 'Grace', 'Wes', 'Nina']
export const LAST_NAMES = ['Ruiz', 'Patel', 'Okafor', 'Chen', 'Walsh', 'Moreno', 'Kim', 'Brooks', 'Novak', 'Haddad', 'Larsen', 'Ito', 'Fischer', 'Reyes']
export const TITLES = ['Head of Operations', 'VP Supply Chain', 'Founder & CEO', 'Director of Logistics', 'COO', 'Ops Manager']

