/**
 * Genel Bakış (Overview) selectors — pure, read-only derivations over the
 * composed `Project[]` for the vessel-group overview page.
 *
 * Grouping rule (user-confirmed):
 *   segment starts with "Organik" or "Sunrise" → Organik
 *   segment starts with "Tahıl" or "Danem"     → Anadolu
 *   everything else (incl. empty segment)      → International
 *
 * Matching is Turkish-locale case-insensitive ("TAHIL" → "tahıl" via
 * toLocaleLowerCase("tr-TR"); the plain-ASCII "tahil" spelling is also
 * accepted so a dotless-I data entry can't slip through).
 */

import type { Project } from "@/lib/dataverse/entities";

/* ─────────── Groups ─────────── */

export type VesselGroup = "Anadolu" | "Organik" | "International";

export const GROUP_ORDER: VesselGroup[] = [
  "Anadolu",
  "Organik",
  "International",
];

/** Fixed semantic palette per group (theme-independent, mirrors the
 *  reference BI report: Anadolu blue · Organik green · International
 *  violet). Hex only — these also feed SVG strokes where OKLCH is not
 *  an option. */
export const GROUP_META: Record<
  VesselGroup,
  {
    label: string;
    solid: string;
    gradient: string;
    ring: string;
    tint: string;
  }
> = {
  Anadolu: {
    label: "Anadolu Grubu",
    solid: "#0284c7",
    gradient: "linear-gradient(135deg, #38bdf8 0%, #0284c7 55%, #075985 100%)",
    ring: "rgba(2, 132, 199, 0.45)",
    tint: "rgba(2, 132, 199, 0.08)",
  },
  Organik: {
    label: "Organik Grup",
    solid: "#059669",
    gradient: "linear-gradient(135deg, #34d399 0%, #059669 55%, #065f46 100%)",
    ring: "rgba(5, 150, 105, 0.45)",
    tint: "rgba(5, 150, 105, 0.08)",
  },
  International: {
    label: "International Grup",
    solid: "#7c3aed",
    gradient: "linear-gradient(135deg, #c084fc 0%, #8b5cf6 55%, #6d28d9 100%)",
    ring: "rgba(124, 58, 237, 0.45)",
    tint: "rgba(124, 58, 237, 0.08)",
  },
};

/** Segment → group classification (the page's core rule).
 *
 *  tr-TR I-dotting trap: ASCII capital I lowercases to dotless ı under
 *  tr-TR ("ORGANIK" → "organık", "TAHIL" → "tahıl"), so EVERY prefix is
 *  checked in both its dotted and dotless spelling — otherwise all-caps
 *  data entries silently fall through to International. */
export function classifySegmentGroup(
  segment: string | null | undefined
): VesselGroup {
  const s = (segment ?? "").trim().toLocaleLowerCase("tr-TR");
  // "Sunrise*" segments belong to the Organik group on this tenant
  // (user-confirmed — the Organik book trades under the Sunrise name).
  // "SUNRISE" → "sunrıse" under tr-TR I-dotting, hence the second check.
  if (
    s.startsWith("organik") ||
    s.startsWith("organık") ||
    s.startsWith("sunrise") ||
    s.startsWith("sunrıse")
  )
    return "Organik";
  if (s.startsWith("tahıl") || s.startsWith("tahil") || s.startsWith("danem"))
    return "Anadolu";
  return "International";
}

/** Distinct raw segment values (as they appear in the data) belonging
 *  to a group — the payload for "open Sefer Takibi filtered to this
 *  group" deep links, since the unified filter speaks segments, not
 *  groups. */
export function segmentsForGroup(
  projects: Project[],
  group: VesselGroup
): string[] {
  const out = new Set<string>();
  for (const p of projects) {
    const seg = (p.segment ?? "").trim();
    if (!seg) continue;
    if (classifySegmentGroup(seg) === group) out.add(seg);
  }
  return [...out];
}

/** Project-level open/closed read. F&O formatted status is "Açık" /
 *  "Kapalı" (or English fallbacks); anything not closed counts open. */
export function isOpenStatus(status: string | null | undefined): boolean {
  const s = (status ?? "").toLocaleLowerCase("tr-TR");
  return !(s.includes("kapal") || s.includes("closed"));
}

/** True when a REAL vessel is attached to the plan — same guard
 *  ProjectCard / voyageDisplayLabel use: non-empty name that isn't the
 *  "—" placeholder or a numeric-only F&O RecID leak. This is the
 *  "gemi atanmış" signal the KPI cards report. */
export function hasAssignedVessel(p: Project): boolean {
  const raw = (p.vesselPlan?.vesselName ?? "").trim();
  return raw !== "" && raw !== "—" && !/^\d[\d\s,.]*$/.test(raw);
}

/* ─────────── Group counts (KPI row + donut) ─────────── */

export interface GroupCountRow {
  group: VesselGroup;
  count: number;
  /** Share of total, 0-100 with one decimal of meaning. */
  pct: number;
  /** Per-group executive stats — mirror of the hero card's mini-grid so
   *  the three group cards carry the same informational weight. */
  openCount: number;
  commencedCount: number;
  waitingCount: number;
  tonnageMt: number;
  /** Projects with a REAL vessel attached (hasAssignedVessel). */
  vesselAssignedCount: number;
}

export interface OverviewGroupAggregate {
  total: number;
  openCount: number;
  /** Voyages currently underway (vesselStatus === "Commenced"). */
  commencedCount: number;
  /** Voyages still waiting (To Be Nominated + Nominated). */
  waitingCount: number;
  /** Σ vesselPlan.voyageTotalTonnage (MT) across the filtered set. */
  totalTonnageMt: number;
  /** Projects with a REAL vessel attached (hasAssignedVessel). */
  vesselAssignedCount: number;
  rows: GroupCountRow[];
}

export function aggregateGroups(projects: Project[]): OverviewGroupAggregate {
  interface Acc {
    count: number;
    openCount: number;
    commencedCount: number;
    waitingCount: number;
    tonnageMt: number;
    vesselAssignedCount: number;
  }
  const mk = (): Acc => ({
    count: 0,
    openCount: 0,
    commencedCount: 0,
    waitingCount: 0,
    tonnageMt: 0,
    vesselAssignedCount: 0,
  });
  const perGroup: Record<VesselGroup, Acc> = {
    Anadolu: mk(),
    Organik: mk(),
    International: mk(),
  };
  const grand = mk();
  for (const p of projects) {
    const acc = perGroup[classifySegmentGroup(p.segment)];
    const open = isOpenStatus(p.status);
    const vs = p.vesselPlan?.vesselStatus;
    const commenced = vs === "Commenced";
    const waiting = vs === "To Be Nominated" || vs === "Nominated";
    const assigned = hasAssignedVessel(p);
    const tRaw = p.vesselPlan?.voyageTotalTonnage;
    const tons =
      typeof tRaw === "number" && Number.isFinite(tRaw) && tRaw > 0
        ? tRaw
        : 0;
    for (const a of [acc, grand]) {
      a.count += 1;
      if (open) a.openCount += 1;
      if (commenced) a.commencedCount += 1;
      if (waiting) a.waitingCount += 1;
      if (assigned) a.vesselAssignedCount += 1;
      a.tonnageMt += tons;
    }
  }
  const total = grand.count;
  return {
    total,
    openCount: grand.openCount,
    commencedCount: grand.commencedCount,
    waitingCount: grand.waitingCount,
    totalTonnageMt: grand.tonnageMt,
    vesselAssignedCount: grand.vesselAssignedCount,
    rows: GROUP_ORDER.map((group) => {
      const a = perGroup[group];
      return {
        group,
        count: a.count,
        pct: total > 0 ? (a.count / total) * 100 : 0,
        openCount: a.openCount,
        commencedCount: a.commencedCount,
        waitingCount: a.waitingCount,
        tonnageMt: a.tonnageMt,
        vesselAssignedCount: a.vesselAssignedCount,
      };
    }),
  };
}

/* ─────────── Voyage-status distribution (donut) ─────────── */

/** Canonical voyage-status order + fixed palette — same colour language
 *  the rest of the app uses for these statuses (ProjectCard dots, hero
 *  badges): TBN amber · Nominated sky · Commenced green · Completed
 *  teal · Closed slate · Cancelled rose. */
export const VOYAGE_STATUS_META: Array<{ status: string; color: string }> = [
  { status: "To Be Nominated", color: "#f59e0b" },
  { status: "Nominated", color: "#0ea5e9" },
  { status: "Commenced", color: "#22c55e" },
  { status: "Completed", color: "#14b8a6" },
  { status: "Closed", color: "#94a3b8" },
  { status: "Cancelled", color: "#fb7185" },
];

/** Catch-all bucket for ship plans whose status didn't normalise to a
 *  canonical value — informational only (no status filter exists for
 *  it, so the slice/legend isn't clickable). */
export const OTHER_STATUS_KEY = "Diğer";
const OTHER_STATUS_COLOR = "#64748b";

export interface VoyageStatusRow {
  status: string;
  color: string;
  count: number;
  pct: number;
  /** False for the catch-all bucket (no deep-link target). */
  clickable: boolean;
}

export interface VoyageStatusAggregate {
  total: number;
  /** Canonical statuses (count > 0) + optional "Diğer", in lifecycle
   *  order. */
  rows: VoyageStatusRow[];
}

export function aggregateVoyageStatuses(
  projects: Project[]
): VoyageStatusAggregate {
  const counts = new Map<string, number>();
  let other = 0;
  const canonical = new Set(VOYAGE_STATUS_META.map((m) => m.status));
  for (const p of projects) {
    const vs = (p.vesselPlan?.vesselStatus ?? "").trim();
    if (vs && canonical.has(vs)) counts.set(vs, (counts.get(vs) ?? 0) + 1);
    else other += 1;
  }
  const total = projects.length;
  const rows: VoyageStatusRow[] = [];
  for (const meta of VOYAGE_STATUS_META) {
    const count = counts.get(meta.status) ?? 0;
    if (count === 0) continue;
    rows.push({
      status: meta.status,
      color: meta.color,
      count,
      pct: total > 0 ? (count / total) * 100 : 0,
      clickable: true,
    });
  }
  if (other > 0) {
    rows.push({
      status: OTHER_STATUS_KEY,
      color: OTHER_STATUS_COLOR,
      count: other,
      pct: total > 0 ? (other / total) * 100 : 0,
      clickable: false,
    });
  }
  return { total, rows };
}

/* ─────────── Segment × Group matrix ─────────── */

export interface SegmentMatrixRow {
  segment: string;
  counts: Record<VesselGroup, number>;
  total: number;
}

export interface SegmentMatrix {
  /** Top-N segments by total (desc). */
  rows: SegmentMatrixRow[];
  /** Aggregate of everything below the top-N — null when nothing left. */
  other: SegmentMatrixRow | null;
  /** Column totals across ALL segments (not just visible rows). */
  columnTotals: Record<VesselGroup, number>;
  grandTotal: number;
}

export function buildSegmentMatrix(
  projects: Project[],
  maxRows: number = 6
): SegmentMatrix {
  const bySegment = new Map<string, SegmentMatrixRow>();
  const columnTotals: Record<VesselGroup, number> = {
    Anadolu: 0,
    Organik: 0,
    International: 0,
  };
  for (const p of projects) {
    const segment = (p.segment ?? "").trim() || "—";
    const group = classifySegmentGroup(p.segment);
    let row = bySegment.get(segment);
    if (!row) {
      row = {
        segment,
        counts: { Anadolu: 0, Organik: 0, International: 0 },
        total: 0,
      };
      bySegment.set(segment, row);
    }
    row.counts[group] += 1;
    row.total += 1;
    columnTotals[group] += 1;
  }
  const sorted = [...bySegment.values()].sort((a, b) => b.total - a.total);
  const rows = sorted.slice(0, maxRows);
  const rest = sorted.slice(maxRows);
  let other: SegmentMatrixRow | null = null;
  if (rest.length > 0) {
    other = {
      segment: `Diğer (${rest.length})`,
      counts: { Anadolu: 0, Organik: 0, International: 0 },
      total: 0,
    };
    for (const r of rest) {
      for (const g of GROUP_ORDER) other.counts[g] += r.counts[g];
      other.total += r.total;
    }
  }
  return { rows, other, columnTotals, grandTotal: projects.length };
}

/* ─────────── Per-group segment columns ─────────── */

export interface GroupSegmentColumn {
  group: VesselGroup;
  rows: Array<{ segment: string; count: number }>;
  /** Count folded into "Diğer" beyond maxPerGroup — 0 when all shown. */
  otherCount: number;
  total: number;
}

export function buildGroupSegmentColumns(
  projects: Project[],
  maxPerGroup: number = 5
): GroupSegmentColumn[] {
  const perGroup = new Map<VesselGroup, Map<string, number>>();
  for (const g of GROUP_ORDER) perGroup.set(g, new Map());
  for (const p of projects) {
    const segment = (p.segment ?? "").trim() || "—";
    const g = classifySegmentGroup(p.segment);
    const m = perGroup.get(g)!;
    m.set(segment, (m.get(segment) ?? 0) + 1);
  }
  return GROUP_ORDER.map((group) => {
    const entries = [...perGroup.get(group)!.entries()].sort(
      (a, b) => b[1] - a[1]
    );
    const shown = entries.slice(0, maxPerGroup);
    const rest = entries.slice(maxPerGroup);
    const otherCount = rest.reduce((s, [, c]) => s + c, 0);
    const total = entries.reduce((s, [, c]) => s + c, 0);
    return {
      group,
      rows: shown.map(([segment, count]) => ({ segment, count })),
      otherCount,
      total,
    };
  });
}

/* ─────────── Longest-waiting vessels ─────────── */

/** "En Uzun Bekleyen Gemi" kuralı (kullanıcı düzeltmesi): yalnızca GEMİ
 *  ATANMIŞ ama henüz yola çıkmamış seferler — yani "Nominated". "To Be
 *  Nominated" projelerde ortada bekleyen bir gemi YOK (atama bekleniyor),
 *  bu yüzden bu karta girmezler; onların sayısı KPI tooltip'lerindeki
 *  "atama bekleyen" satırında yaşar. Ek emniyet: gerçek bir gemi adı da
 *  aranır (hasAssignedVessel). */
const WAITING_STATUSES = new Set(["Nominated"]);

export interface WaitingVessel {
  project: Project;
  /** Whole days since `sinceIso` (≥ 0). */
  days: number;
  /** Anchor date the wait is measured from (project/contract date). */
  sinceIso: string;
  /** Human reason — the ship plan's free-text operation status when
   *  present, otherwise a Turkish label derived from the voyage status. */
  reason: string;
}

export function selectWaitingVessels(
  projects: Project[],
  now: Date
): WaitingVessel[] {
  const out: WaitingVessel[] = [];
  for (const p of projects) {
    const status = p.vesselPlan?.vesselStatus;
    if (!status || !WAITING_STATUSES.has(status)) continue;
    // Gemi atanmadan "bekleyen gemi" olmaz — RecID sızıntısı / boş ad
    // taşıyan Nominated satırları da dışarıda kalır.
    if (!hasAssignedVessel(p)) continue;
    const sinceIso = p.projectDate;
    if (!sinceIso) continue;
    const since = new Date(sinceIso).getTime();
    if (!Number.isFinite(since)) continue;
    const days = Math.max(
      0,
      Math.floor((now.getTime() - since) / 86_400_000)
    );
    const opStatus = (p.vesselPlan?.operationStatus ?? "").trim();
    const reason =
      opStatus && opStatus !== "—"
        ? opStatus
        : status === "To Be Nominated"
          ? "Gemi ataması bekleniyor"
          : "Yükleme başlangıcı bekleniyor";
    out.push({ project: p, days, sinceIso, reason });
  }
  out.sort((a, b) => b.days - a.days);
  return out;
}

/* ─────────── Payment-pending voyages ─────────── */

/** True when the ship plan's payment status reads as pending
 *  ("Beklemede", "Bekliyor", "Pending", "Waiting"…). Empty / completed
 *  statuses are NOT pending. */
export function isPaymentPending(status: string | null | undefined): boolean {
  const s = (status ?? "").toLocaleLowerCase("tr-TR");
  if (!s) return false;
  return /bekle|pending|waiting/.test(s);
}

export interface PendingPaymentRow {
  project: Project;
  /** `mserp_netfreightamount` — F&O label "Ürün Bedeli ($)", i.e. the
   *  voyage's CARGO VALUE in USD (not freight). 0 when not entered. */
  amountUsd: number;
  /** Days since the voyage's most recent populated milestone (falls
   *  back to the project date) — "how long has this been waiting". */
  days: number;
}

export interface PendingPayments {
  rows: PendingPaymentRow[];
  totalUsd: number;
  count: number;
}

/** Most recent populated milestone date on the plan, newest-first. */
function latestMilestoneIso(p: Project): string | null {
  const ms = p.vesselPlan?.milestones;
  if (!ms) return p.projectDate ?? null;
  let best: string | null = null;
  let bestT = -Infinity;
  for (const iso of [
    ms.dpEd,
    ms.dpSd,
    ms.dpNorAccepted,
    ms.dpEta,
    ms.blDate,
    ms.lpEd,
    ms.lpSd,
    ms.lpNorAccepted,
    ms.lpEta,
  ]) {
    if (!iso) continue;
    const t = new Date(iso).getTime();
    if (Number.isFinite(t) && t > bestT) {
      bestT = t;
      best = iso;
    }
  }
  return best ?? p.projectDate ?? null;
}

export function selectPendingPayments(
  projects: Project[],
  now: Date,
  maxRows: number = 7
): PendingPayments {
  const all: PendingPaymentRow[] = [];
  for (const p of projects) {
    if (!isPaymentPending(p.vesselPlan?.paymentStatus)) continue;
    const amountRaw = p.vesselPlan?.netFreightAmount;
    const amountUsd =
      typeof amountRaw === "number" && Number.isFinite(amountRaw)
        ? amountRaw
        : 0;
    const sinceIso = latestMilestoneIso(p);
    const sinceT = sinceIso ? new Date(sinceIso).getTime() : NaN;
    const days = Number.isFinite(sinceT)
      ? Math.max(0, Math.floor((now.getTime() - sinceT) / 86_400_000))
      : 0;
    all.push({ project: p, amountUsd, days });
  }
  all.sort((a, b) => b.amountUsd - a.amountUsd || b.days - a.days);
  return {
    rows: all.slice(0, maxRows),
    totalUsd: all.reduce((s, r) => s + r.amountUsd, 0),
    count: all.length,
  };
}

/* ─────────── Display label helper ─────────── */

/** Compact display label for a voyage row: vessel name when real,
 *  otherwise the project name. (F&O sometimes leaks numeric RecIDs into
 *  the vessel-name column — same guard ProjectCard uses.) */
export function voyageDisplayLabel(p: Project): string {
  const raw = (p.vesselPlan?.vesselName ?? "").trim();
  if (raw && raw !== "—" && !/^\d[\d\s,.]*$/.test(raw)) return raw;
  return p.projectName;
}
