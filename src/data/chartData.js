function buildSeries() {
  const out = []
  const start = new Date()
  start.setDate(start.getDate() - 89)
  let seedA = 42
  let seedB = 71
  for (let i = 0; i < 90; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    seedA = (seedA * 9301 + 49297) % 233280
    seedB = (seedB * 9301 + 49297) % 233280
    const dow = d.getDay()
    const weekendDip = dow === 0 || dow === 6 ? 0.45 : 1
    const ramp = 1 + i / 180
    const approvals = Math.round((40 + (seedA / 233280) * 90) * weekendDip * ramp)
    const updates = Math.round((25 + (seedB / 233280) * 70) * weekendDip * ramp)
    out.push({ date: d.toISOString().slice(0, 10), approvals, updates })
  }
  return out
}

export const chartData = buildSeries()
