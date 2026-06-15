import {
  aggregateAvgTransitDays,
  aggregateByCorridor,
  aggregateBySegment,
  aggregateCargoValueUsd,
  aggregateCounterpartyMix,
  aggregateCurrencyExposure,
  aggregateEstimatedPL,
  aggregateInTransitKg,
  aggregateMarginDistribution,
  topByCargoValue,
  topByMargin,
  topBySalesActual,
} from "@/lib/selectors/aggregate";
import { selectCargoValueUsd, selectStage } from "@/lib/selectors/project";
import { selectProjectPL } from "@/lib/selectors/profitLoss";
import { getFinancialYear } from "@/lib/dashboard/financialPeriod";
import { formatCompactCurrency, formatTons } from "@/lib/format";
import type { Project } from "@/lib/dataverse/entities";

export type ContextLang = "tr" | "en";

/**
 * Structural labels for the DATA SUMMARY block, language-aware. Only the
 * scaffolding (section headers, units, fixed phrases) is translated — the
 * data values themselves (projectNo, vessel name, supplier, etc.) are never
 * translated. The English headers here intentionally mirror the section
 * names referenced in TYRO_AI_SYSTEM_PROMPT_EN so the model's reading guide
 * matches what it actually receives.
 */
function ctxLabels(lang: ContextLang) {
  const en = lang === "en";
  return {
    title: en
      ? "=== TYRO INTERNATIONAL TRADE — DATA SUMMARY ==="
      : "=== TYRO INTERNATIONAL TRADE — VERİ ÖZETİ ===",
    date: en ? "Date" : "Tarih",
    filterScope: en ? "Filter scope" : "Filtre kapsamı",
    projects: en ? "projects" : "proje",
    financialYear: en ? "Financial year" : "Finansal yıl",
    emptyFilterNote: en
      ? "NOTE: The current filter returned an empty set. Loosen the Filter selection at the top right and try again."
      : "NOT: Şu anki filtre boş bir set döndürdü. Sağ üstteki Filtre seçimini gevşet ve tekrar dene.",
    routeNone: en ? "No route" : "Rota yok",
    // Section headers
    portfolio: en ? "PORTFOLIO" : "PORTFÖY",
    totalProjects: en ? "Total projects" : "Toplam proje",
    totalCargoValue: en ? "Total cargo value" : "Toplam ürün değeri",
    inTransitTonnage: en ? "Tonnage on active voyage" : "Aktif yolculukta tonaj",
    plContribution: en
      ? "USD-equivalent P&L contribution (priced lines)"
      : "USD eşdeğeri P&L katkısı (priced lines)",
    fxConvertedSuffix: en ? "FX-converted" : "tanesi FX dönüşümlü",
    plHeading: en
      ? "P&L (USD-equivalent, static FX rates)"
      : "K&Z (USD eşdeğeri, statik FX kurları)",
    estSales: en ? "Estimated Sales" : "Tahmini Satış",
    estPurchase: en ? "Estimated Purchase" : "Tahmini Alım",
    estExpense: en ? "Estimated Expense" : "Tahmini Gider",
    netPL: en ? "Net P&L" : "Net K&Z",
    margin: en ? "Margin" : "Marj",
    marginDist: en ? "MARGIN DISTRIBUTION" : "MARJ DAĞILIMI",
    healthy: en ? "Healthy (>5%)" : "Sağlıklı (>%5)",
    marginal: en ? "Marginal (-5%..5%)" : "Marjinal (-%5..%5)",
    lossMaking: en ? "Loss-making (<-5%)" : "Zararlı (<-%5)",
    marginNotComputable: en
      ? "Margin not computable"
      : "Marj hesaplanamaz",
    pipeline: en
      ? (n: number) => `PIPELINE (voyage status — ${n} ship-planned projects total)`
      : (n: number) => `PIPELINE (voyage durumu — toplam ${n} gemi planlı proje)`,
    voyageStage: en
      ? "VOYAGE STAGE (operational stage)"
      : "VOYAGE STAGE (operasyonel evre)",
    stagePreLoading: en ? "Pre-loading" : "Pre-loading",
    stageAtLoading: en ? "At loading port" : "Yükleme limanında",
    stageLoading: en ? "Loading" : "Yükleme",
    stageInTransit: en ? "In transit" : "Yolda",
    stageAtDischarge: en ? "At discharge port" : "Tahliye limanında",
    stageDischarged: en ? "Discharged" : "Tahliye edildi",
    stageUnscheduled: en ? "No ship plan" : "Gemi planı yok",
    currencyExposure: en ? "CURRENCY EXPOSURE" : "PARA BİRİMİ MARUZİYETİ",
    dominant: en ? "Dominant" : "Dominant",
    hhiHealthy: en
      ? "<0.15 healthy, >0.25 concentrated"
      : "<0.15 sağlıklı, >0.25 yoğun",
    avgTransit: en ? "AVERAGE TRANSIT" : "ORTALAMA TRANSİT",
    avgTransitLine: en
      ? (avg: number, min: number, max: number, n: number) =>
          `─ Average: ${avg} days (min ${min}, max ${max}, ${n} voyages in sample)`
      : (avg: number, min: number, max: number, n: number) =>
          `─ Ortalama: ${avg} gün (min ${min}, max ${max}, ${n} sefer örneklemde)`,
    avgTransitNone: en
      ? "─ Not enough LP-(ED)/DP-ETA dates, average not computable"
      : "─ Yeterli LP-(ED)/DP-ETA tarihi yok, ortalama hesaplanamadı",
    top5Value: en
      ? "TOP 5 PROJECTS (by cargo value)"
      : "EN BÜYÜK 5 PROJE (ürün değerine göre)",
    noData: en ? "(no data)" : "(veri yok)",
    top3Sales: en
      ? "TOP 3 PROJECTS BY INVOICED SALES (actual sales USD)"
      : "EN ÇOK FATURALI 3 PROJE (gerçekleşen satış USD)",
    noSales: en
      ? "(no invoiced sales record)"
      : "(faturalı satış kaydı yok)",
    top3Lowest: en
      ? "LOWEST 3 MARGIN PROJECTS (at risk)"
      : "EN DÜŞÜK MARJLI 3 PROJE (riskli)",
    noMargin: en
      ? "(no project with a computable margin)"
      : "(marj hesaplanabilir proje yok)",
    top3Highest: en
      ? "HIGHEST 3 MARGIN PROJECTS"
      : "EN YÜKSEK MARJLI 3 PROJE",
    top5Corridors: en ? "TOP 5 CORRIDORS" : "EN AKTİF 5 KORİDOR",
    noRoute: en ? "(no route data)" : "(rota verisi yok)",
    corridorHhi: en ? "─ Corridor HHI" : "─ Koridor HHI",
    top3Suppliers: en
      ? "TOP 3 SUPPLIERS (project count)"
      : "EN BÜYÜK 3 TEDARİKÇİ (proje sayısı)",
    noSupplier: en ? "(no supplier data)" : "(tedarikçi verisi yok)",
    supplierHhi: en ? "─ Supplier HHI" : "─ Tedarikçi HHI",
    top3Buyers: en
      ? "TOP 3 BUYERS (project count)"
      : "EN BÜYÜK 3 ALICI (proje sayısı)",
    noBuyer: en ? "(no buyer data)" : "(alıcı verisi yok)",
    buyerHhi: en ? "─ Buyer HHI" : "─ Alıcı HHI",
    top3Segments: en ? "TOP 3 SEGMENTS (P&L)" : "EN BÜYÜK 3 SEGMENT (K&Z)",
    noSegment: en ? "(no segment data)" : "(segment verisi yok)",
    activeVoyagesHeading: en
      ? "═══ ACTIVE VOYAGES (Commenced — currently in transit/loading/discharging) ═══"
      : "═══ AKTİF SEFERLER (Commenced — şu an yolda/yüklemede/tahliyede) ═══",
    activeVoyagesNone: en
      ? "(no project currently in Commenced status)"
      : "(şu anda Commenced statüde proje yok)",
    upcomingHeading: en
      ? "═══ UPCOMING MILESTONES (next 14 days) ═══"
      : "═══ YAKLAŞAN MILESTONE'LAR (önümüzdeki 14 gün) ═══",
    upcomingNone: en
      ? "(no milestone planned in the next 14 days)"
      : "(önümüzdeki 14 gün içinde planlı milestone yok)",
    directoryHeading: en
      ? "═══ PROJECTS DIRECTORY (1 project per line — search by vessel/projectNo/segment) ═══"
      : "═══ PROJELER DİZİNİ (her satırda 1 proje — vessel/projectNo/segment ile arama yap) ═══",
    footerNote: en
      ? 'NOTE: All numbers above were computed over the subset of projects the user selected in the Filter at the top right. If "the whole portfolio" is asked, the filter may need to be loosened.'
      : 'NOT: Yukarıdaki tüm sayılar kullanıcının sağ üstteki Filtre\'de seçtiği projelerin alt kümesinde hesaplandı. "Tüm portföy" sorulursa filtreyi gevşetmesi gerekebilir.',
  } as const;
}

/**
 * Serialize the active project set into a compact Turkish summary that
 * Gemini can use to answer questions about specific vessels, projects,
 * segments, statuses, and time windows.
 *
 * Sections:
 *   1. Headline portfolio + K&Z (rolled-up KPIs)
 *   2. Pipeline / voyage stage / currency / velocity
 *   3. Top-N rankings (value, sales actual, margin↑↓, corridors,
 *      counterparties, segments)
 *   4. PROJECTS DIRECTORY — one line per project with the searchable
 *      handles (projectNo, projectName, vessel, status, route, marj)
 *      so the model can resolve subject-matching queries
 *   5. ACTIVE VOYAGES — Commenced projects with their next milestone
 *   6. UPCOMING MILESTONES — projects with milestones due in the next
 *      14 days, useful for "bu hafta tahliye" / "yarın yükleme" queries
 *
 * Gemini 2.5 Flash supports a 1M-token window so we don't need to
 * trim aggressively, but keep redundancy out of the directory rows
 * so the user can scroll the prompt without slogging.
 */
export function buildDashboardContext(
  projects: Project[],
  now: Date = new Date(),
  lang: ContextLang = "tr"
): string {
  const L = ctxLabels(lang);
  const fy = getFinancialYear(now);
  const totalProjects = projects.length;

  if (totalProjects === 0) {
    return `${L.title}
${L.date}: ${formatDayMonth(now, lang)}
${L.filterScope}: 0 ${L.projects}
${L.emptyFilterNote}`;
  }

  // Totals
  const totalCargoUsd = aggregateCargoValueUsd(projects);
  const inTransit = aggregateInTransitKg(projects, now);
  const pl = aggregateEstimatedPL(projects);
  const marginDist = aggregateMarginDistribution(projects);
  const currency = aggregateCurrencyExposure(projects);
  const corridors = aggregateByCorridor(projects);
  const counterparty = aggregateCounterpartyMix(projects);
  const velocity = aggregateAvgTransitDays(projects);
  const segments = aggregateBySegment(projects);

  // Pipeline counts — group by raw vesselStatus key
  const pipelineCounts = new Map<string, number>();
  let pipelineTotal = 0;
  for (const p of projects) {
    const vs = p.vesselPlan?.vesselStatus;
    if (!vs) continue;
    pipelineCounts.set(vs, (pipelineCounts.get(vs) ?? 0) + 1);
    pipelineTotal++;
  }
  const pipelineLine = [
    "Commenced",
    "Completed",
    "Closed",
    "Nominated",
    "To Be Nominated",
    "Cancelled",
  ]
    .map((k) => `${k}: ${pipelineCounts.get(k) ?? 0}`)
    .join(" · ");

  // Top 5 projects by cargo value
  const top5Value = topByCargoValue(projects, 5)
    .map((p, i) => {
      const route =
        p.vesselPlan?.loadingPort?.name && p.vesselPlan?.dischargePort?.name
          ? `${p.vesselPlan.loadingPort.name} → ${p.vesselPlan.dischargePort.name}`
          : L.routeNone;
      return `${i + 1}. ${p.projectNo} — ${truncate(p.projectName, 60)} · ${formatCompactCurrency(p.cargoValueUsd, "USD")} · ${route}`;
    })
    .join("\n");

  // Top 3 lowest margin (risk)
  const top3LowestMargin = topByMargin(projects, 3, "asc")
    .map((p, i) => {
      const sign = p.marginPct >= 0 ? "+" : "";
      return `${i + 1}. ${p.projectNo} — ${truncate(p.projectName, 50)} · marj ${sign}${p.marginPct.toFixed(1)}% · K&Z ${formatCompactCurrency(p.pl, "USD")}`;
    })
    .join("\n");

  // Top 3 highest margin
  const top3HighestMargin = topByMargin(projects, 3, "desc")
    .map((p, i) => {
      const sign = p.marginPct >= 0 ? "+" : "";
      return `${i + 1}. ${p.projectNo} — ${truncate(p.projectName, 50)} · marj ${sign}${p.marginPct.toFixed(1)}%`;
    })
    .join("\n");

  // Top 3 sales actual
  const top3SalesActual = topBySalesActual(projects, 3)
    .map(
      (p, i) =>
        `${i + 1}. ${p.projectNo} — ${truncate(p.projectName, 50)} · ${formatCompactCurrency(p.salesActualUsd, "USD")}`
    )
    .join("\n");

  // Top 5 corridors
  const top5Corridors = corridors
    .slice(0, 5)
    .map(
      (c, i) =>
        `${i + 1}. ${c.loadingPort} → ${c.dischargePort} — ${c.count} proje · ${formatCompactCurrency(c.totalCargoValueUsd, "USD")}`
    )
    .join("\n");
  // Corridor HHI
  const corridorTotal = corridors.reduce((s, c) => s + c.count, 0);
  const corridorHhi =
    corridorTotal === 0
      ? 0
      : corridors.reduce(
          (s, c) => s + Math.pow(c.count / corridorTotal, 2),
          0
        );

  // Top 3 segments by P&L
  const top3SegmentsByPL = [...segments]
    .sort((a, b) => b.pl - a.pl)
    .slice(0, 3)
    .map((s, i) => {
      const sign = (s.marginPct ?? 0) >= 0 ? "+" : "";
      return `${i + 1}. ${s.segment} — ${s.projectCount} proje · K&Z ${formatCompactCurrency(s.pl, "USD")} · marj ${sign}${(s.marginPct ?? 0).toFixed(1)}%`;
    })
    .join("\n");

  // Suppliers / buyers top 3
  const top3Suppliers = counterparty.suppliers
    .slice(0, 3)
    .map(
      (r, i) =>
        `${i + 1}. ${truncate(r.name, 60)} — ${r.count} proje · ${formatCompactCurrency(r.totalCargoValueUsd, "USD")}`
    )
    .join("\n");
  const top3Buyers = counterparty.buyers
    .slice(0, 3)
    .map(
      (r, i) =>
        `${i + 1}. ${truncate(r.name, 60)} — ${r.count} proje · ${formatCompactCurrency(r.totalCargoValueUsd, "USD")}`
    )
    .join("\n");

  // Stage distribution
  const stageCounts = countByStage(projects, now);

  // Currency lines
  const currencyLines = (["USD", "EUR", "TRY", "OTHER"] as const)
    .map((c) => {
      const cnt = currency.byCurrency[c].count;
      if (cnt === 0) return null;
      const pct =
        currency.totalProjects > 0
          ? ((cnt / currency.totalProjects) * 100).toFixed(0)
          : "0";
      return `${c}: ${cnt} proje (%${pct})`;
    })
    .filter(Boolean)
    .join(" · ");

  // PROJECTS DIRECTORY — one line per project, used by Gemini to
  // resolve subject-matching queries (vessel name, projectNo, segment).
  const directory = buildProjectDirectory(projects, lang);

  // ACTIVE VOYAGES — Commenced ships only, with their next milestone
  const activeVoyages = buildActiveVoyages(projects, now, lang);

  // UPCOMING MILESTONES — anything due in the next 14 days
  const upcoming = buildUpcomingMilestones(projects, now, lang);

  return `${L.title}
${L.date}: ${formatDayMonth(now, lang)}
${L.filterScope}: ${totalProjects} ${L.projects} · ${L.financialYear}: ${fy.fullLabel}

${L.portfolio}
─ ${L.totalProjects}: ${totalProjects}
─ ${L.totalCargoValue}: ${formatCompactCurrency(totalCargoUsd, "USD")}
─ ${L.inTransitTonnage}: ${formatTons(inTransit.kg)} (${inTransit.projectCount} ${L.projects})
─ ${L.plContribution}: ${pl.contributingCount} ${L.projects}${
    pl.fxConvertedCount > 0
      ? ` (${pl.fxConvertedCount} ${L.fxConvertedSuffix})`
      : ""
  }

${L.plHeading}
─ ${L.estSales}: ${formatCompactCurrency(pl.salesTotalUsd, "USD")}
─ ${L.estPurchase}: ${formatCompactCurrency(pl.purchaseTotalUsd, "USD")}
─ ${L.estExpense}: ${formatCompactCurrency(pl.expenseTotalUsd, "USD")}
─ ${L.netPL}: ${pl.pl >= 0 ? "+" : ""}${formatCompactCurrency(pl.pl, "USD")}
─ ${L.margin}: ${pl.marginPct >= 0 ? "+" : ""}${pl.marginPct.toFixed(1)}%

${L.marginDist}
─ ${L.healthy}: ${marginDist.positive} ${L.projects}
─ ${L.marginal}: ${marginDist.marginal} ${L.projects}
─ ${L.lossMaking}: ${marginDist.negative} ${L.projects}
─ ${L.marginNotComputable}: ${marginDist.unknown} ${L.projects}

${L.pipeline(pipelineTotal)}
${pipelineLine}

${L.voyageStage}
─ ${L.stagePreLoading}: ${stageCounts["pre-loading"]}
─ ${L.stageAtLoading}: ${stageCounts["at-loading-port"]}
─ ${L.stageLoading}: ${stageCounts.loading}
─ ${L.stageInTransit}: ${stageCounts["in-transit"]}
─ ${L.stageAtDischarge}: ${stageCounts["at-discharge-port"]}
─ ${L.stageDischarged}: ${stageCounts.discharged}
─ ${L.stageUnscheduled}: ${stageCounts.unscheduled}

${L.currencyExposure}
${currencyLines}
─ ${L.dominant}: ${currency.dominant} · HHI: ${currency.hhi.toFixed(2)} (${L.hhiHealthy})

${L.avgTransit}
${
  velocity.sampleSize > 0
    ? L.avgTransitLine(
        Math.round(velocity.avgDays),
        Math.round(velocity.minDays),
        Math.round(velocity.maxDays),
        velocity.sampleSize
      )
    : L.avgTransitNone
}

${L.top5Value}
${top5Value || L.noData}

${L.top3Sales}
${top3SalesActual || L.noSales}

${L.top3Lowest}
${top3LowestMargin || L.noMargin}

${L.top3Highest}
${top3HighestMargin || L.noMargin}

${L.top5Corridors}
${top5Corridors || L.noRoute}
${L.corridorHhi}: ${corridorHhi.toFixed(2)}

${L.top3Suppliers}
${top3Suppliers || L.noSupplier}
${L.supplierHhi}: ${counterparty.supplierHHI.toFixed(2)}

${L.top3Buyers}
${top3Buyers || L.noBuyer}
${L.buyerHhi}: ${counterparty.buyerHHI.toFixed(2)}

${L.top3Segments}
${top3SegmentsByPL || L.noSegment}

${L.activeVoyagesHeading}
${activeVoyages || L.activeVoyagesNone}

${L.upcomingHeading}
${upcoming || L.upcomingNone}

${L.directoryHeading}
${directory}

${L.footerNote}`;
}

/* ─────────── Projects directory ─────────── */

/**
 * One compact line per project. Format:
 *   [PRJ000002443] 55KMT BRZ SOYBEAN | Vessel: XIN HAI TONG 29 (Commenced) |
 *     Santarem→Umm Qasr | Seg: International | Sup: BTG · Buy: SAMA |
 *     Marj +8.4% · K&Z $1.2M
 *
 * The model uses these rows to resolve a query like "XIN HAI TONG 29 hangi
 * projede?" by matching the vessel name in this directory and reading the
 * corresponding projectNo + status. Same goes for projectName, supplier,
 * buyer, segment, route. Truncation is conservative (60 chars on the
 * project name) so most names survive intact.
 */
function buildProjectDirectory(projects: Project[], lang: ContextLang): string {
  const en = lang === "en";
  const vesselLbl = en ? "Vessel" : "Gemi";
  const routeNone = en ? "Route: —" : "Rota: —";
  const productLbl = en ? "Product" : "Ürün";
  const marginLbl = en ? "margin" : "marj";
  const lines: string[] = [];
  for (const p of projects) {
    const vp = p.vesselPlan;
    const vessel = vp?.vesselName?.trim()
      ? `${vp.vesselName}${vp.vesselStatus ? ` (${vp.vesselStatus})` : ""}`
      : "Vessel: —";
    const route =
      vp?.loadingPort?.name && vp?.dischargePort?.name
        ? `${vp.loadingPort.name}→${vp.dischargePort.name}`
        : routeNone;
    const supplier = vp?.supplier?.trim() || "—";
    const buyer = vp?.buyer?.trim() || "—";
    const seg = (p.segment ?? "").trim() || "—";
    const grp = (p.projectGroup ?? "").trim() || "—";
    const cargoProduct = vp?.cargoProduct?.trim() || "—";

    const pl = selectProjectPL(p);
    const margin =
      pl.marginPct === null
        ? `${marginLbl} —`
        : `${marginLbl} ${pl.marginPct >= 0 ? "+" : ""}${pl.marginPct.toFixed(1)}%`;
    const cargoValue = selectCargoValueUsd(p);

    lines.push(
      `[${p.projectNo}] ${truncate(p.projectName, 60)} | ${vesselLbl}: ${vessel} | ${route} | ${productLbl}: ${cargoProduct} | Seg: ${seg}/${grp} | Sup: ${truncate(supplier, 25)} · Buy: ${truncate(buyer, 25)} | ${margin} · ${formatCompactCurrency(cargoValue, "USD")} · Status: ${p.status}`
    );
  }
  return lines.join("\n");
}

/* ─────────── Active voyages (Commenced) ─────────── */

/**
 * Commenced ships with their *next* milestone (whichever pending date is
 * closest to today). Useful for "şu an yolda olan gemiler" / "hangi
 * gemiler yüklemede" style queries.
 */
function buildActiveVoyages(
  projects: Project[],
  now: Date,
  lang: ContextLang
): string {
  const en = lang === "en";
  const vesselLbl = en ? "Vessel" : "Gemi";
  const nextLbl = en ? "Next" : "Sonraki";
  const labels = milestoneLabels(lang);
  const rows: string[] = [];
  for (const p of projects) {
    const vp = p.vesselPlan;
    if (!vp || vp.vesselStatus !== "Commenced") continue;
    const stage = selectStage(p, now);
    const nextMs = nextPendingMilestone(vp.milestones, now, labels);
    const route =
      vp.loadingPort?.name && vp.dischargePort?.name
        ? `${vp.loadingPort.name}→${vp.dischargePort.name}`
        : "—";
    rows.push(
      `[${p.projectNo}] ${truncate(p.projectName, 50)} | ${vesselLbl}: ${vp.vesselName} | ${route} | Stage: ${stage ?? "—"}${nextMs ? ` | ${nextLbl}: ${nextMs.label} ${formatDate(nextMs.date, lang)}` : ""}`
    );
  }
  return rows.join("\n");
}

/* ─────────── Upcoming milestones (next 14 days) ─────────── */

type MilestoneLabelMap = Record<
  keyof import("@/lib/dataverse/entities").VesselMilestones,
  string
>;

const MILESTONE_LABELS_TR: MilestoneLabelMap = {
  lpEta: "LP-ETA (yükleme limanına varış)",
  lpNorAccepted: "LP-NOR Kabul",
  lpSd: "Yükleme başlangıcı",
  lpEd: "Yükleme bitişi",
  blDate: "BL düzenleme",
  dpEta: "DP-ETA (varış tahminleri)",
  dpNorAccepted: "DP-NOR Kabul",
  dpSd: "Tahliye başlangıcı",
  dpEd: "Tahliye bitişi",
};

const MILESTONE_LABELS_EN: MilestoneLabelMap = {
  lpEta: "LP-ETA (arrival at loading port)",
  lpNorAccepted: "LP-NOR Accepted",
  lpSd: "Loading start",
  lpEd: "Loading end",
  blDate: "BL issue",
  dpEta: "DP-ETA (arrival estimate)",
  dpNorAccepted: "DP-NOR Accepted",
  dpSd: "Discharge start",
  dpEd: "Discharge end",
};

function milestoneLabels(lang: ContextLang): MilestoneLabelMap {
  return lang === "en" ? MILESTONE_LABELS_EN : MILESTONE_LABELS_TR;
}

interface UpcomingRow {
  projectNo: string;
  projectName: string;
  vessel: string;
  label: string;
  date: Date;
  daysFromNow: number;
}

function buildUpcomingMilestones(
  projects: Project[],
  now: Date,
  lang: ContextLang
): string {
  const en = lang === "en";
  const vesselLbl = en ? "Vessel" : "Gemi";
  const dayUnit = en ? "d" : "g";
  const labels = milestoneLabels(lang);
  const horizon = now.getTime() + 14 * 24 * 60 * 60 * 1000;
  const rows: UpcomingRow[] = [];
  for (const p of projects) {
    const vp = p.vesselPlan;
    if (!vp) continue;
    const ms = vp.milestones;
    for (const key of Object.keys(labels) as Array<keyof MilestoneLabelMap>) {
      const iso = ms[key];
      if (!iso) continue;
      const t = new Date(iso);
      if (Number.isNaN(t.getTime())) continue;
      if (t.getTime() < now.getTime() || t.getTime() > horizon) continue;
      const daysFromNow = Math.round(
        (t.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      rows.push({
        projectNo: p.projectNo,
        projectName: truncate(p.projectName, 45),
        vessel: vp.vesselName ?? "—",
        label: labels[key],
        date: t,
        daysFromNow,
      });
    }
  }
  rows.sort((a, b) => a.date.getTime() - b.date.getTime());
  return rows
    .slice(0, 30) // cap so the bundle stays compact
    .map(
      (r) =>
        `${formatDate(r.date, lang)} (+${r.daysFromNow}${dayUnit}) — [${r.projectNo}] ${r.projectName} | ${vesselLbl}: ${r.vessel} | ${r.label}`
    )
    .join("\n");
}

/* ─────────── helpers ─────────── */

function nextPendingMilestone(
  ms: import("@/lib/dataverse/entities").VesselMilestones,
  now: Date,
  labels: MilestoneLabelMap
): { label: string; date: Date } | null {
  let best: { label: string; date: Date } | null = null;
  for (const key of Object.keys(labels) as Array<keyof MilestoneLabelMap>) {
    const iso = ms[key];
    if (!iso) continue;
    const t = new Date(iso);
    if (Number.isNaN(t.getTime())) continue;
    if (t.getTime() < now.getTime()) continue;
    if (!best || t.getTime() < best.date.getTime()) {
      best = { label: labels[key], date: t };
    }
  }
  return best;
}

function truncate(s: string, max: number): string {
  const t = (s ?? "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

function formatDayMonth(d: Date, lang: ContextLang): string {
  return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function formatDate(d: Date, lang: ContextLang): string {
  return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function countByStage(
  projects: Project[],
  now: Date
): Record<
  | "pre-loading"
  | "at-loading-port"
  | "loading"
  | "in-transit"
  | "at-discharge-port"
  | "discharged"
  | "unscheduled",
  number
> {
  const out = {
    "pre-loading": 0,
    "at-loading-port": 0,
    loading: 0,
    "in-transit": 0,
    "at-discharge-port": 0,
    discharged: 0,
    unscheduled: 0,
  };
  for (const p of projects) {
    const stage = selectStage(p, now);
    if (stage === null) out.unscheduled++;
    else out[stage]++;
  }
  return out;
}

// Re-export so callers don't need to chase down two helpers
export { selectCargoValueUsd, selectProjectPL };
