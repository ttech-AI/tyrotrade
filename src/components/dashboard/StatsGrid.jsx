import { StatCard } from "./StatCard"
import { stats } from "@/data/stats"

export function StatsGrid() {
  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {stats.map((s, i) => (
        <StatCard key={s.id} stat={s} index={i} />
      ))}
    </section>
  )
}
