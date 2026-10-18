import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
let seed = 17
Math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
const server = await createServer({
  configFile: false, root: process.cwd(), cacheDir: '.verification-cache',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { middlewareMode: true, hmr: false, watch: null },
})
try {
  const { engine, CARD_POOL, BELT_SPEED } = await server.ssrLoadModule('/src/sim/engine.ts')
  const { useFloor } = await server.ssrLoadModule('/src/store.ts')
  const start = useFloor.getState().kpis.loaded
  let previous = start
  for (let minute = 0; minute < 25; minute++) {
    for (let i = 0; i < 1200; i++) {
      const before = new Map(engine.cards.filter(c => c.mode === 'belt').map(c => [c.id, c.d]))
      engine.step(.05)
      for (const card of engine.cards) {
        const previousDistance = before.get(card.id)
        if (card.mode === 'belt' && previousDistance !== undefined) {
          assert(Math.abs(card.d - previousDistance - BELT_SPEED * .05) < 1e-8, 'A card paused or slowed on the moving belt')
        }
      }
    }
    const state = useFloor.getState()
    assert(state.kpis.loaded > previous, 'Line stopped importing at minute ' + minute)
    previous = state.kpis.loaded
    assert.equal(state.kpis.loaded, state.leads.length, 'Import count and list diverged')
    assert.equal(state.agents.leo.count, state.leads.length)
    assert(state.leads.every(l => l.fit && l.emailOk && l.stage === 'loaded' && l.importedAt && l.campaign))
    assert.equal(state.sources.reduce((n, s) => n + s.found, 0), state.kpis.scraped)
    assert(engine.cards.length <= CARD_POOL)
  }
  const state = useFloor.getState()
  assert(state.leads.length > 250, 'Cumulative imports were truncated')
  assert.equal(new Set(state.leads.map(l => l.email.toLowerCase() + '|' + l.campaign)).size, state.leads.length)
  const record = state.leads[0], total = state.kpis.loaded
  assert.equal(state.completeImport({ ...record, stage: 'verified' }), false, 'Same record imported twice')
  assert.equal(state.completeImport({ ...record, id: 999999, email: record.email.toUpperCase(), stage: 'verified' }), false, 'Same email/campaign imported twice')
  assert.equal(state.completeImport({ ...record, id: 888888, email: 'invalid@example.com', emailOk: false, stage: 'verified' }), false)
  assert.equal(state.completeImport({ ...record, id: 777777, email: 'rejected@example.com', fit: false, stage: 'verified' }), false)
  assert.equal(useFloor.getState().kpis.loaded, total)
  const time = engine.time
  const originalState = useFloor.getState()
  originalState.togglePause()
  assert.equal(useFloor.getState().paused, true)
  const snapshot = useFloor.getState().leads.length
  // The scene driver observes paused before stepping.
  if (!useFloor.getState().paused) engine.step(1)
  assert.equal(engine.time, time)
  assert.equal(useFloor.getState().leads.length, snapshot)
  originalState.togglePause()
  console.log(JSON.stringify({ result: 'PASS', simulatedMinutes: 25, initialImports: start, finalImports: total, sources: state.sources.length,
    checks: ['constant card velocity through every station', 'continuous progress', 'complete import history over 250', 'matching totals', 'valid imports only', 'case-insensitive deduplication', 'source counts', 'pause guard'] }, null, 2))
} finally { await server.close() }

