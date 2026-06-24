import * as React from "react";
import {
  ChartLineData01Icon,
  Clock01Icon,
  Coins02Icon,
  ContainerIcon,
  MoneyExchange01Icon,
  Route01Icon,
  UserGroupIcon,
  Wallet01Icon,
  BalanceScaleIcon,
} from "@hugeicons/core-free-icons";
import { useNavigate } from "react-router-dom";
import {
  KpiGroupHeader,
  KpiProjectRow,
  KpiEmptyState,
  SegmentChip,
} from "./KpiDetailDrawer";
import { cn } from "@/lib/utils";
import {
  selectCargoValueUsd,
  selectExecutionDate,
  selectTotalKg,
  selectTotalTons,
  selectStage,
  selectTransitDays,
  type RouteStage,
} from "@/lib/selectors/project";
import { selectProjectPL } from "@/lib/selectors/profitLoss";
import {
  aggregateAvgTransitDays,
  aggregateByCorridor,
} from "@/lib/selectors/aggregate";
import { toUsdAtDate } from "@/lib/finance/fxRates";
import { formatCompactCurrency, formatTons } from "@/lib/format";
import { useT } from "@/lib/i18n/LanguageProvider";
import type { Project } from "@/lib/dataverse/entities";

/**
 * Per-KPI breakdown components. Each one receives the active project
 * set and renders inside the KpiDetailDrawer body. Project rows are
 * always clickable via the shared `KpiProjectRow` so navigation
 * behaviour is consistent across the dashboard.
 *
 * Drawer-level toolbar wiring:
 *   • `query` — free-text filter (matches projectNo, projectName, vessel,
 *     supplier, buyer, segment)
 *   • `sortReversed` — flips the natural sort direction
 *
 * Both are optional so the components can render unfiltered when used
 * outside the drawer (e.g. embedded inspector views).
 */

export interface BreakdownProps {
  projects: Project[];
  onClose: () => void;
  now?: Date;
  /** Free-text filter from the drawer toolbar. */
  query?: string;
  /** Drawer toolbar sort flip — when true, breakdowns reverse their default order. */
  sortReversed?: boolean;
}

/* ─────────── Shared filter helper ─────────── */

/**
 * Match a project against a drawer toolbar search string. Cheap
 * lowercase substring tests across the fields a user is most likely
 * to recall: projectNo, projectName, vessel, counterparty, segment.
 */
export function filterProject(p: Project, query?: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  if (!q) return true;
  if (p.projectNo.toLowerCase().includes(q)) return true;
  if (p.projectName.toLowerCase().includes(q)) return true;
  const vn = p.vesselPlan?.vesselName?.toLowerCase();
  if (vn && vn.includes(q)) return true;
  const sup = p.vesselPlan?.supplier?.toLowerCase();
  if (sup && sup.includes(q)) return true;
  const buy = p.vesselPlan?.buyer?.toLowerCase();
  if (buy && buy.includes(q)) return true;
  const seg = (p.segment ?? "").toLowerCase();
  if (seg && seg.includes(q)) return true;
  return false;
}

/** Optionally reverse a list — mirrors the drawer toolbar sort flip. */
function maybeReverse<T>(rows: T[], reversed?: boolean): T[] {
  return reversed ? [...rows].reverse() : rows;
}

/* ─────────── Tahmini Gider ─────────── */

export function ExpenseBreakdown({
  projects,
  onClose,
  query,
  sortReversed,
}: BreakdownProps) {
  const t = useT();
  const rows = React.useMemo(() => {
    const out: Array<{
      project: Project;
      total: number;
      freight: number;
      opex: number;
      other: number;
    }> = [];
    for (const p of projects) {
      if (!filterProject(p, query)) continue;
      const lines = p.costEstimateLines;
      if (!lines || lines.length === 0) continue;
      let freight = 0;
      let opex = 0;
      let other = 0;
      for (const l of lines) {
        if (!l.totalUsd) continue;
        const n = (l.name ?? "").toLowerCase();
        if (n.includes("freight") || n.includes("navlun"))
          freight += l.totalUsd;
        else if (n.includes("opex") || n.includes("operasyonel"))
          opex += l.totalUsd;
        else other += l.totalUsd;
      }
      const total = freight + opex + other;
      if (total <= 0) continue;
      out.push({ project: p, total, freight, opex, other });
    }
    out.sort((a, b) => b.total - a.total);
    return maybeReverse(out, sortReversed);
  }, [projects, query, sortReversed]);

  if (rows.length === 0) {
    return <KpiEmptyState message={t("dash.bk.expense.empty")} />;
  }

  return (
    <div className="flex flex-col">
      <KpiGroupHeader
        label={
          sortReversed
            ? t("dash.bk.expense.headerLow")
            : t("dash.bk.expense.headerHigh")
        }
        count={rows.length}
        icon={Wallet01Icon}
      />
      <div className="flex flex-col gap-0.5">
        {rows.map((r) => (
          <div key={r.project.projectNo} className="flex flex-col gap-1">
            <KpiProjectRow
              projectNo={r.project.projectNo}
              projectName={r.project.projectName}
              segment={r.project.segment ?? undefined}
              vesselName={r.project.vesselPlan?.vesselName}
              metric={formatCompactCurrency(r.total, "USD")}
              metricColor="rgb(244 63 94)"
              onClose={onClose}
            />
            <BucketStrip freight={r.freight} opex={r.opex} other={r.other} />
          </div>
        ))}
      </div>
    </div>
  );
}

function BucketStrip({
  freight,
  opex,
  other,
}: {
  freight: number;
  opex: number;
  other: number;
}) {
  const total = freight + opex + other;
  if (total === 0) return null;
  const seg = (val: number, color: string) =>
    val > 0 ? (
      <span
        className="block h-full"
        style={{ width: `${(val / total) * 100}%`, background: color }}
      />
    ) : null;
  return (
    <div className="ml-3 mr-3 mb-2 flex items-center gap-2">
      <div className="flex-1 flex h-1 rounded-full overflow-hidden bg-foreground/[0.06]">
        {seg(freight, "#f97316")}
        {seg(opex, "#a855f7")}
        {seg(other, "#64748b")}
      </div>
      <div className="text-[9.5px] tabular-nums text-muted-foreground/85 flex gap-1.5">
        {freight > 0 && (
          <span style={{ color: "#c2410c" }}>
            F %{((freight / total) * 100).toFixed(0)}
          </span>
        )}
        {opex > 0 && (
          <span style={{ color: "#7e22ce" }}>
            O %{((opex / total) * 100).toFixed(0)}
          </span>
        )}
        {other > 0 && (
          <span style={{ color: "#475569" }}>
            D %{((other / total) * 100).toFixed(0)}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─────────── Aktif Pipeline ─────────── */

const STATUS_COLORS: Record<string, string> = {
  "To Be Nominated": "#f59e0b", // amber
  Nominated: "#0ea5e9", // sky-blue
  Commenced: "#22c55e", // green
  Completed: "#10b981",
  Closed: "#64748b",
  Cancelled: "#f43f5e",
};

export function PipelineBreakdown({
  projects,
  onClose,
  query,
}: BreakdownProps) {
  const t = useT();
  const grouped = React.useMemo(() => {
    const m = new Map<string, Project[]>();
    for (const p of projects) {
      if (!filterProject(p, query)) continue;
      const vs = p.vesselPlan?.vesselStatus;
      if (!vs) continue;
      const arr = m.get(vs) ?? [];
      arr.push(p);
      m.set(vs, arr);
    }
    // Workflow order is deliberate (To Be Nominated → … → Cancelled);
    // sort flip not exposed for this breakdown.
    const ordered: Array<{ status: string; projects: Project[] }> = [];
    for (const k of Object.keys(STATUS_COLORS)) {
      const arr = m.get(k);
      if (arr && arr.length > 0) ordered.push({ status: k, projects: arr });
    }
    return ordered;
  }, [projects, query]);

  if (grouped.length === 0) {
    return <KpiEmptyState message={t("dash.bk.pipeline.empty")} />;
  }

  return (
    <div className="flex flex-col">
      {grouped.map((g) => (
        <div key={g.status} className="flex flex-col">
          <KpiGroupHeader
            label={g.status}
            count={g.projects.length}
            toneColor={STATUS_COLORS[g.status]}
            icon={ContainerIcon}
          />
          <div className="flex flex-col gap-0.5">
            {g.projects.map((p) => (
              <KpiProjectRow
                key={p.projectNo}
                projectNo={p.projectNo}
                projectName={p.projectName}
                segment={p.segment ?? undefined}
                vesselName={p.vesselPlan?.vesselName}
                metric={formatCompactCurrency(selectCargoValueUsd(p), "USD")}
                onClose={onClose}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────── Para Birimi Maruziyeti ─────────── */

const CURRENCY_COLORS: Record<string, string> = {
  USD: "#10b981",
  EUR: "#3b82f6",
  TRY: "#f59e0b",
  OTHER: "#94a3b8",
};

export function CurrencyBreakdown({
  projects,
  onClose,
  query,
}: BreakdownProps) {
  const t = useT();
  const grouped = React.useMemo(() => {
    const m = new Map<string, Project[]>();
    for (const p of projects) {
      if (!filterProject(p, query)) continue;
      const c = (p.lines[0]?.currency ?? p.currency ?? "OTHER").toUpperCase();
      const key = ["USD", "EUR", "TRY"].includes(c) ? c : "OTHER";
      const arr = m.get(key) ?? [];
      arr.push(p);
      m.set(key, arr);
    }
    return ["USD", "EUR", "TRY", "OTHER"]
      .map((k) => ({ currency: k, projects: m.get(k) ?? [] }))
      .filter((g) => g.projects.length > 0);
  }, [projects, query]);

  if (grouped.length === 0) {
    return <KpiEmptyState message={t("dash.bk.currency.empty")} />;
  }

  return (
    <div className="flex flex-col">
      {grouped.map((g) => (
        <div key={g.currency} className="flex flex-col">
          <KpiGroupHeader
            label={g.currency}
            count={g.projects.length}
            toneColor={CURRENCY_COLORS[g.currency]}
            icon={MoneyExchange01Icon}
          />
          <div className="flex flex-col gap-0.5">
            {g.projects.map((p) => (
              <KpiProjectRow
                key={p.projectNo}
                projectNo={p.projectNo}
                projectName={p.projectName}
                segment={p.segment ?? undefined}
                vesselName={p.vesselPlan?.vesselName}
                metric={formatCompactCurrency(selectCargoValueUsd(p), "USD")}
                onClose={onClose}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────── Koridor Konsantrasyonu ─────────── */

export function CorridorBreakdown({
  projects,
  onClose,
  query,
  sortReversed,
}: BreakdownProps) {
  const t = useT();
  const filteredProjects = React.useMemo(
    () => projects.filter((p) => filterProject(p, query)),
    [projects, query]
  );
  const corridors = React.useMemo(
    () => aggregateByCorridor(filteredProjects),
    [filteredProjects]
  );
  const projectsByCorridor = React.useMemo(() => {
    const m = new Map<string, Project[]>();
    for (const p of filteredProjects) {
      const lp = p.vesselPlan?.loadingPort?.name;
      const dp = p.vesselPlan?.dischargePort?.name;
      if (!lp || !dp) continue;
      const key = `${lp}__${dp}`;
      const arr = m.get(key) ?? [];
      arr.push(p);
      m.set(key, arr);
    }
    return m;
  }, [filteredProjects]);

  if (corridors.length === 0) {
    return <KpiEmptyState message={t("dash.bk.corridor.empty")} />;
  }

  const ordered = maybeReverse(corridors.slice(0, 12), sortReversed);

  return (
    <div className="flex flex-col">
      {ordered.map((c) => {
        const key = `${c.loadingPort}__${c.dischargePort}`;
        const projs = projectsByCorridor.get(key) ?? [];
        return (
          <div key={key} className="flex flex-col">
            <KpiGroupHeader
              label={`${c.loadingPort} → ${c.dischargePort}`}
              count={c.count}
              icon={Route01Icon}
              valueChip={
                <span className="text-[10.5px] tabular-nums font-semibold text-foreground/85">
                  {formatCompactCurrency(c.totalCargoValueUsd, "USD")}
                </span>
              }
            />
            <div className="flex flex-col gap-0.5">
              {projs.map((p) => (
                <KpiProjectRow
                  key={p.projectNo}
                  projectNo={p.projectNo}
                  projectName={p.projectName}
                  segment={p.segment ?? undefined}
                  vesselName={p.vesselPlan?.vesselName}
                  metric={formatCompactCurrency(selectCargoValueUsd(p), "USD")}
                  onClose={onClose}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────── Ortalama Transit ─────────── */

export function VelocityBreakdown({
  projects,
  onClose,
  now,
  query,
  sortReversed,
}: BreakdownProps) {
  void now; // not needed — selectTransitDays is now-independent
  const t = useT();
  const filteredProjects = React.useMemo(
    () => projects.filter((p) => filterProject(p, query)),
    [projects, query]
  );

  const rows = React.useMemo(() => {
    const out: Array<{ project: Project; days: number }> = [];
    for (const p of filteredProjects) {
      const days = selectTransitDays(p);
      if (days == null) continue;
      out.push({ project: p, days });
    }
    out.sort((a, b) => b.days - a.days);
    return maybeReverse(out, sortReversed);
  }, [filteredProjects, sortReversed]);

  // Use the *aggregate* avg so the drawer's average matches the tile
  // exactly — single source of truth via `selectTransitDays`.
  const aggregateStats = React.useMemo(
    () => aggregateAvgTransitDays(filteredProjects),
    [filteredProjects]
  );
  const avg = aggregateStats.avgDays;

  if (rows.length === 0) {
    return <KpiEmptyState message={t("dash.bk.velocity.empty")} />;
  }

  return (
    <div className="flex flex-col">
      <KpiGroupHeader
        label={(sortReversed
          ? t("dash.bk.velocity.headerFast")
          : t("dash.bk.velocity.headerSlow")
        ).replace("{avg}", String(avg))}
        count={rows.length}
        icon={Clock01Icon}
        valueChip={
          <span className="text-[10.5px] tabular-nums font-semibold text-foreground/85">
            {t("dash.bk.velocity.minMax")
              .replace("{min}", String(aggregateStats.minDays))
              .replace("{max}", String(aggregateStats.maxDays))}
          </span>
        }
      />
      <div className="flex flex-col gap-0.5">
        {rows.map(({ project: p, days }) => (
          <KpiProjectRow
            key={p.projectNo}
            projectNo={p.projectNo}
            projectName={p.projectName}
            segment={p.segment ?? undefined}
            vesselName={p.vesselPlan?.vesselName}
            metric={`${days} ${t("dash.bk.daysUnit")}`}
            metricColor={
              avg > 0 && days > avg * 1.3
                ? "rgb(190 24 93)"
                : avg > 0 && days < avg * 0.7
                  ? "rgb(4 120 87)"
                  : undefined
            }
            onClose={onClose}
          />
        ))}
      </div>
    </div>
  );
}

/* ─────────── Karşı Taraf Dağılımı ─────────── */

export function CounterpartyBreakdown({
  projects,
  onClose,
  query,
  sortReversed,
}: BreakdownProps) {
  const t = useT();
  const [tab, setTab] = React.useState<"supplier" | "buyer">("supplier");

  const grouped = React.useMemo(() => {
    const m = new Map<string, Project[]>();
    for (const p of projects) {
      if (!filterProject(p, query)) continue;
      const name = (
        tab === "supplier" ? p.vesselPlan?.supplier : p.vesselPlan?.buyer
      )?.trim();
      if (!name) continue;
      const arr = m.get(name) ?? [];
      arr.push(p);
      m.set(name, arr);
    }
    const list = [...m.entries()]
      .map(([name, projs]) => ({ name, projects: projs }))
      .sort((a, b) => b.projects.length - a.projects.length);
    return maybeReverse(list, sortReversed);
  }, [projects, tab, query, sortReversed]);

  return (
    <div className="flex flex-col gap-2">
      <div className="px-3 flex gap-1.5">
        {(["supplier", "buyer"] as const).map((tk) => (
          <button
            key={tk}
            type="button"
            onClick={() => setTab(tk)}
            className="text-[11.5px] font-semibold px-3 py-1 rounded-full border transition-colors"
            style={
              tab === tk
                ? {
                    backgroundColor: "var(--filter-active-bg)",
                    color: "var(--filter-active-fg)",
                    borderColor: "var(--filter-active-border)",
                  }
                : { borderColor: "rgba(15,23,42,0.15)", color: "rgb(71 85 105)" }
            }
          >
            {tk === "supplier"
              ? t("dash.bk.counterparty.supplier")
              : t("dash.bk.counterparty.buyer")}
          </button>
        ))}
      </div>
      {grouped.length === 0 ? (
        <KpiEmptyState
          message={
            tab === "supplier"
              ? t("dash.bk.counterparty.supplierEmpty")
              : t("dash.bk.counterparty.buyerEmpty")
          }
        />
      ) : (
        grouped.map((g) => (
          <div key={g.name} className="flex flex-col">
            <KpiGroupHeader
              label={g.name}
              count={g.projects.length}
              icon={UserGroupIcon}
            />
            <div className="flex flex-col gap-0.5">
              {g.projects.map((p) => (
                <KpiProjectRow
                  key={p.projectNo}
                  projectNo={p.projectNo}
                  projectName={p.projectName}
                  segment={p.segment ?? undefined}
                  vesselName={p.vesselPlan?.vesselName}
                  metric={formatCompactCurrency(selectCargoValueUsd(p), "USD")}
                  onClose={onClose}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ─────────── Period Performance ─────────── */

interface PeriodBreakdownProps extends BreakdownProps {
  /** projectNo → Σ realized expense USD (from the expense rollup). */
  realizedExpenseByProject?: Map<string, number>;
  /** True when the rollup covers the filtered set — gates realized values. */
  hasRealizedCoverage?: boolean;
}

interface RealizedRow {
  p: Project;
  plUsd: number;
  salesUsd: number;
  purchaseUsd: number;
  expenseUsd: number;
  marginPct: number | null;
}

const EMPTY_EXPENSE_MAP = new Map<string, number>();

/** Realized-K/Z palette — emerald (kâr) / rose (zarar) / slate (nötr). */
function plColor(v: number): string {
  return v > 0 ? "rgb(4 120 87)" : v < 0 ? "rgb(190 24 93)" : "rgb(71 85 105)";
}
function plTint(v: number): string {
  return v > 0
    ? "rgba(16,185,129,0.12)"
    : v < 0
      ? "rgba(244,63,94,0.12)"
      : "rgba(100,116,139,0.12)";
}
function signedCompact(v: number): string {
  const sign = v >= 0 ? "+" : "−";
  return `${sign}${formatCompactCurrency(Math.abs(v), "USD")}`;
}

/**
 * Dönem Performansı drawer — per-project **realized** (gerçekleşen) K/Z.
 * Each row leads with the realized K/Z + margin (sign-coloured), shows
 * the full untruncated project name, and breaks the figure down into its
 * Satış / Alış / Gider components so the number is legible at a glance.
 * Realized values require the expense rollup; until it covers the set the
 * panel shows a "computing" hint (the page auto-runs the scoped sweep).
 */
export function PeriodPerformanceBreakdown({
  projects,
  onClose,
  query,
  sortReversed,
  realizedExpenseByProject,
  hasRealizedCoverage,
}: PeriodBreakdownProps) {
  const t = useT();
  const expMap = realizedExpenseByProject ?? EMPTY_EXPENSE_MAP;

  const rows = React.useMemo<RealizedRow[]>(() => {
    if (!hasRealizedCoverage) return [];
    const list = projects
      .filter((p) => filterProject(p, query))
      .map((p) => {
        // All three sides realized — matches BudgetSalesCard so the
        // panel reconciles with the project-detail K/Z.
        const salesUsd = p.salesActualUsd ?? 0;
        const purchaseUsd = p.purchaseActualUsd ?? 0;
        const expenseUsd = expMap.get(p.projectNo) ?? 0;
        const plUsd = salesUsd - purchaseUsd - expenseUsd;
        const marginPct = salesUsd > 0 ? (plUsd / salesUsd) * 100 : null;
        return { p, plUsd, salesUsd, purchaseUsd, expenseUsd, marginPct };
      })
      // Realized signal only (invoiced sales, a vendor invoice, or a
      // realized-expense row).
      .filter((r) => r.salesUsd !== 0 || r.purchaseUsd !== 0 || r.expenseUsd !== 0)
      .sort((a, b) => b.plUsd - a.plUsd);
    return maybeReverse(list, sortReversed);
  }, [projects, query, sortReversed, expMap, hasRealizedCoverage]);

  if (!hasRealizedCoverage)
    return <KpiEmptyState message={t("dash.bk.period.computing")} />;
  if (rows.length === 0)
    return <KpiEmptyState message={t("dash.bk.period.empty")} />;

  const totalPL = rows.reduce((s, r) => s + r.plUsd, 0);

  return (
    <div className="flex flex-col">
      <KpiGroupHeader
        label={
          sortReversed
            ? t("dash.bk.period.headerLow")
            : t("dash.bk.period.headerHigh")
        }
        count={rows.length}
        icon={ChartLineData01Icon}
        valueChip={
          <span
            className="text-[12px] font-bold tabular-nums"
            style={{ color: plColor(totalPL) }}
          >
            {signedCompact(totalPL)}
          </span>
        }
      />
      <div className="flex flex-col gap-1">
        {rows.map((r) => (
          <RealizedPLRow key={r.p.projectNo} row={r} onClose={onClose} t={t} />
        ))}
      </div>
    </div>
  );
}

function RealizedPLRow({
  row,
  onClose,
  t,
}: {
  row: RealizedRow;
  onClose: () => void;
  t: (k: string) => string;
}) {
  const navigate = useNavigate();
  const { p, plUsd, salesUsd, purchaseUsd, expenseUsd, marginPct } = row;
  const color = plColor(plUsd);
  return (
    <button
      type="button"
      onClick={() => {
        onClose();
        navigate(`/projects/${p.projectNo}`, {
          state: { focusProjectNo: p.projectNo },
        });
      }}
      className={cn(
        "w-full text-left rounded-xl px-3 py-2.5 group",
        "border border-transparent hover:border-border/60 hover:bg-foreground/[0.025]",
        "transition-colors"
      )}
    >
      {/* Top — projectNo + segment (left) · realized K/Z + margin (right) */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[10.5px] tabular-nums text-foreground/55">
              {p.projectNo}
            </span>
            {p.segment && <SegmentChip segment={p.segment} />}
          </div>
          {/* Full project name — wraps, never truncated */}
          <div className="text-[12.5px] font-semibold text-foreground leading-snug mt-1">
            {p.projectName}
          </div>
          {p.vesselPlan?.vesselName && (
            <div className="mt-0.5 text-[10.5px] text-muted-foreground">
              <span aria-hidden className="mr-0.5">
                ⚓
              </span>
              {p.vesselPlan.vesselName}
            </div>
          )}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <span
            className="text-[15px] font-bold tabular-nums leading-none"
            style={{ color }}
          >
            {signedCompact(plUsd)}
          </span>
          {marginPct != null && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums"
              style={{ color, backgroundColor: plTint(plUsd) }}
            >
              %{marginPct.toFixed(1)}
            </span>
          )}
        </div>
      </div>
      {/* Components — makes the K/Z derivation legible at a glance */}
      <div className="mt-2 flex items-center gap-x-3 gap-y-1 flex-wrap text-[10px]">
        <Component
          label={t("dash.bk.period.sales")}
          value={formatCompactCurrency(salesUsd, "USD")}
          dot="rgb(2 132 199)"
        />
        <Component
          label={t("dash.bk.period.purchase")}
          value={formatCompactCurrency(purchaseUsd, "USD")}
          dot="rgb(100 116 139)"
        />
        <Component
          label={t("dash.bk.period.expense")}
          value={formatCompactCurrency(expenseUsd, "USD")}
          dot="rgb(217 119 6)"
        />
      </div>
    </button>
  );
}

function Component({
  label,
  value,
  dot,
}: {
  label: string;
  value: string;
  dot: string;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        aria-hidden
        className="size-1.5 rounded-full"
        style={{ background: dot }}
      />
      <span className="text-foreground/55">{label}</span>
      <span className="font-semibold tabular-nums text-foreground/80">
        {value}
      </span>
    </span>
  );
}

/* ─────────── Estimated P&L ─────────── */

export function EstimatedPLBreakdown({
  projects,
  onClose,
  query,
  sortReversed,
}: BreakdownProps) {
  const t = useT();
  const rows = React.useMemo(() => {
    const list = projects
      .filter((p) => filterProject(p, query))
      .map((p) => {
        const pl = selectProjectPL(p);
        const cur = (pl.currency ?? "USD").toUpperCase();
        // Convert at the project's execution date (operasyon
        // periyodu) — falls back to signing date for legacy rows.
        // Matches the dashboard tile rollups so figures reconcile.
        const fxDate = selectExecutionDate(p);
        return {
          p,
          plUsd: pl.salesTotal > 0 ? toUsdAtDate(pl.pl, cur, fxDate) : 0,
          marginPct: pl.marginPct,
          salesUsd: toUsdAtDate(pl.salesTotal, cur, fxDate),
        };
      })
      .filter((r) => r.salesUsd > 0)
      .sort((a, b) => b.plUsd - a.plUsd);
    return maybeReverse(list, sortReversed);
  }, [projects, query, sortReversed]);

  if (rows.length === 0)
    return <KpiEmptyState message={t("dash.bk.pl.empty")} />;

  return (
    <div className="flex flex-col">
      <KpiGroupHeader
        label={
          sortReversed
            ? t("dash.bk.pl.headerLow")
            : t("dash.bk.pl.headerHigh")
        }
        count={rows.length}
        icon={Coins02Icon}
      />
      <div className="flex flex-col gap-0.5">
        {rows.map(({ p, plUsd, marginPct }) => {
          const sign = plUsd >= 0 ? "+" : "−";
          return (
            <KpiProjectRow
              key={p.projectNo}
              projectNo={p.projectNo}
              projectName={p.projectName}
              segment={p.segment ?? undefined}
              vesselName={p.vesselPlan?.vesselName}
              metric={`${sign}${formatCompactCurrency(Math.abs(plUsd), "USD")}${
                marginPct != null ? ` · %${marginPct.toFixed(1)}` : ""
              }`}
              metricColor={
                plUsd > 0
                  ? "rgb(4 120 87)"
                  : plUsd < 0
                    ? "rgb(190 24 93)"
                    : undefined
              }
              onClose={onClose}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ─────────── Tahmini Miktar ─────────── */

export function QuantityBreakdown({
  projects,
  onClose,
  query,
  sortReversed,
}: BreakdownProps) {
  const t = useT();
  const rows = React.useMemo(() => {
    const list = projects
      .filter((p) => filterProject(p, query))
      .map((p) => {
        const tons = selectTotalTons(p);
        const product =
          p.lines.find((l) => l.productName?.trim())?.productName ?? "";
        return { p, tons, product };
      })
      .filter((r) => r.tons > 0)
      .sort((a, b) => b.tons - a.tons);
    return maybeReverse(list, sortReversed);
  }, [projects, query, sortReversed]);

  if (rows.length === 0) return <KpiEmptyState message={t("dash.bk.quantity.empty")} />;

  return (
    <div className="flex flex-col">
      <KpiGroupHeader
        label={
          sortReversed
            ? t("dash.bk.quantity.headerLow")
            : t("dash.bk.quantity.headerHigh")
        }
        count={rows.length}
        icon={BalanceScaleIcon}
        valueChip={
          <span className="text-[10.5px] tabular-nums font-semibold text-amber-700">
            {formatTons(rows.reduce((s, r) => s + selectTotalKg(r.p), 0))}
          </span>
        }
      />
      <div className="flex flex-col gap-0.5">
        {rows.map(({ p, tons, product }) => (
          <KpiProjectRow
            key={p.projectNo}
            projectNo={p.projectNo}
            projectName={product || p.projectName}
            segment={p.segment ?? undefined}
            vesselName={p.vesselPlan?.vesselName}
            metric={
              tons >= 1000
                ? `${(tons / 1000).toFixed(1)} bin t`
                : `${tons.toFixed(0)} t`
            }
            metricColor="rgb(180 83 9)"
            onClose={onClose}
          />
        ))}
      </div>
    </div>
  );
}

/** Voyage stage helper kept here so the imports tree stays in one
 *  place; not currently used by a breakdown but available if a new
 *  KPI wants to group by stage. */
export function projectsByStage(
  projects: Project[],
  now: Date
): Map<RouteStage | "unscheduled", Project[]> {
  const m = new Map<RouteStage | "unscheduled", Project[]>();
  for (const p of projects) {
    const stage = selectStage(p, now) ?? "unscheduled";
    const arr = m.get(stage) ?? [];
    arr.push(p);
    m.set(stage, arr);
  }
  return m;
}
