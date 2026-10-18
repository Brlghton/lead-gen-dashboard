import { ArrowUpRight, FolderSearch, MailCheck, ScanFace, Send, Stamp } from 'lucide-react'
import { useFloor, type Tab } from '@/store'
import { cn } from '@/lib/utils'
export function KpiStrip() {
  const k = useFloor(s => s.kpis)
  const paused = useFloor(s => s.paused)
  const setTab = useFloor(s => s.setTab)
  const fitRate = Math.round(k.fit / Math.max(1, k.fit + k.rejected) * 100)
  const validRate = Math.round(k.verified / Math.max(1, k.verified + k.invalid) * 100)
  const cards: { label: string; value: number; sub: string; icon: typeof Send; tab?: Tab; highlight?: boolean }[] = [
    { label: 'Companies scraped', value: k.scraped, sub: paused ? '4 scrapers · paused' : '4 scrapers working', icon: FolderSearch, tab: 'sources' },
    { label: 'Companies qualified', value: k.fit, sub: fitRate + '% match the criteria', icon: Stamp },
    { label: 'Contacts found', value: k.contacts, sub: 'Decision-makers identified', icon: ScanFace },
    { label: 'Emails verified', value: k.verified, sub: validRate + '% verification pass rate', icon: MailCheck },
    { label: 'Added to Instantly', value: k.loaded, sub: 'View imported leads', icon: Send, tab: 'leads', highlight: true },
  ]
  return <section aria-label="Pipeline totals" className="kpi-strip">
    {cards.map(({ label, value, sub, icon: Icon, tab, highlight }) => {
      const content = <><div className="kpi-label"><span>{label}</span><Icon size={15} /></div><div className="kpi-value">{value.toLocaleString()}</div><div className="kpi-sub"><span>{sub}</span>{tab && <ArrowUpRight size={13} />}</div></>
      return tab ? <button key={label} onClick={() => setTab(tab)} className={cn('kpi-card', highlight && 'kpi-highlight')}>{content}</button> : <div key={label} className="kpi-card">{content}</div>
    })}
  </section>
}
