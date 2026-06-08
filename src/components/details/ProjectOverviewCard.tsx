import {
  Ship,
  Truck,
  Building2,
  User,
  FileText,
  Globe2,
  Calendar,
  Leaf,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { AccentIconBadge, TONE_SEA, TONE_ROAD } from "./AccentIconBadge";
import { formatDate } from "@/lib/format";
import { isSea, type Project } from "@/lib/dataverse/entities";
import { selectHeroImage } from "@/lib/routing/heroImages";

interface Props {
  project: Project;
}

// Hero badge palette — distinct semantic color per voyage stage so a glance
// at the image tells the operator where the cargo is in its lifecycle.
const STATUS_HERO_STYLE: Record<string, string> = {
  // Pre-loading — warm pastel orange, matches left-rail dot
  "To Be Nominated":
    "bg-orange-400 text-white border border-orange-300/60 shadow-sm",
  // Vessel assigned — pale mint green, matches left-rail dot
  Nominated: "bg-emerald-300 text-emerald-900 border border-emerald-200/60 shadow-sm",
  // Active voyage — deep forest green, matches left-rail dot
  Commenced: "bg-emerald-800 text-white border border-emerald-600/60 shadow-sm",
  // Done
  Completed: "bg-teal-500 text-white border border-teal-300/60 shadow-sm",
  Closed: "bg-slate-500 text-white border border-slate-300/60 shadow-sm",
  Cancelled: "bg-rose-400 text-white border border-rose-300/60 shadow-sm",
  // Project-level fallbacks (when ship row has no status)
  Open: "bg-sky-500 text-white border border-sky-300/60 shadow-sm",
  Açık: "bg-sky-500 text-white border border-sky-300/60 shadow-sm",
  Kapalı: "bg-slate-500 text-white border border-slate-300/60 shadow-sm",
};

function heroStatusClass(status: string): string {
  return (
    STATUS_HERO_STYLE[status] ??
    "bg-slate-600 text-white border border-slate-300/60 shadow-sm"
  );
}

export function ProjectOverviewCard({ project }: Props) {
  const sea = isSea(project);
  const Icon = sea ? Ship : Truck;
  const vp = project.vesselPlan;
  // Hero image follows the voyage stage (Pending → Loading → In-transit
  // → Completed). See `selectHeroImage` for the mapping.
  const url = selectHeroImage(project);
  // Defensive guard: F&O `mserp_vessel` is a bare numeric RecID. If
  // an upstream change ever lets it leak through composer's
  // resolution chain (or the user is on a stale bundle), don't show
  // a 10-digit number as a vessel name — surface the em-dash so the
  // card remains semantically correct.
  const rawVesselName = vp?.vesselName ?? "";
  const vesselName = isMeaningfulName(rawVesselName) ? rawVesselName : "—";
  // Show vessel voyage status when it's set; otherwise fall back to the
  // project-level Open/Closed status — there's no "Pending" sentinel.
  const vesselStatus = vp?.vesselStatus ?? project.status;

  return (
    <GlassPanel tone="default" className="rounded-2xl overflow-hidden">
      <div className="relative h-36 shrink-0">
        <img
          src={url}
          alt={vesselName}
          className="absolute inset-0 size-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />

        {/* Top-right Sefer pill — frosted glass overlay so it reads as
            voyage metadata regardless of the underlying hero image. */}
        {vp && (
          <span
            className="absolute top-2.5 right-2.5 shrink-0 inline-flex items-center gap-1 h-6 px-2 rounded-full bg-black/35 backdrop-blur-md text-[10.5px] font-medium tracking-tight border border-white/25 text-white shadow-sm"
            title={`${vp.voyageType ? `${vp.voyageType} ` : ""}Sefer ${vp.voyage}`}
          >
            <span className="uppercase tracking-wider text-white/80">
              {vp.voyageType ? `${vp.voyageType} Sefer` : "Sefer"}
            </span>
            <span aria-hidden className="text-white/55">
              •
            </span>
            <span className="font-semibold tabular-nums text-white">
              {vp.voyage}
            </span>
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 p-3 flex items-end gap-2.5 text-white">
          {/* Hero vehicle icon — same gradient-pill shape as the page
              header, but with a content-semantic tone (sea = ocean blue,
              road = warm orange) so it tracks transport mode, not theme. */}
          <AccentIconBadge tone={sea ? TONE_SEA : TONE_ROAD}>
            <Icon className="size-4" strokeWidth={2} />
          </AccentIconBadge>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wider text-white/75">
              {sea ? "Vessel" : "Vehicle"}
            </div>
            <div className="text-base font-semibold leading-tight truncate">
              {vesselName}
            </div>
          </div>
          <span
            className={cn(
              "shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold tracking-tight",
              heroStatusClass(vesselStatus)
            )}
            style={{
              boxShadow:
                "inset 0 1px 0 0 rgba(255,255,255,0.3), 0 2px 6px -1px rgba(0,0,0,0.25)",
            }}
          >
            {vesselStatus}
          </span>
        </div>
      </div>

      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono font-semibold text-[12.5px] tracking-tight text-foreground/70">
                {project.projectNo}
              </span>
              {project.organic && (
                <span className="inline-flex items-center gap-0.5 text-[9px] uppercase tracking-wide text-emerald-700 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  <Leaf className="size-2.5" />
                  Organic
                </span>
              )}
            </div>
            <h3 className="text-[13px] font-semibold leading-snug mt-0.5">
              {project.projectName}
            </h3>
          </div>
        </div>

        {/* Project info — single 2-col grid covering operational +
            contractual fields. Grouped semantically: parties first,
            categorisation in the middle, contractual terms last. The
            divider between groups keeps the card scannable without
            adding vertical bulk. */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
          <Row icon={<User />} label="Trader" value={project.traderNo} />
          <Row
            icon={<Calendar />}
            label="Proje / Operasyon Tarihi"
            value={formatProjectDates(project)}
          />
          <Row
            icon={<Building2 />}
            label="Tedarikçi"
            value={vp?.supplier ?? "—"}
          />
          <Row
            icon={<Building2 />}
            label="Müşteri"
            value={vp?.buyer ?? "—"}
          />
          <Row icon={<FileText />} label="Grup" value={project.projectGroup} />
          <Row
            icon={<Globe2 />}
            label="Segment"
            value={project.segment ?? "—"}
          />
        </div>

        <ContractStrip
          companyId={vp?.companyId}
          deliveryTerm={vp?.deliveryTerm ?? project.incoterm}
          paymentTerm={vp?.paymentTerm}
          paymentSchedule={vp?.paymentSchedule}
        />

        {vp?.operationStatus && (
          <div className="mt-3 px-3 py-2 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
            <div className="text-[9px] uppercase tracking-wider text-emerald-700 mb-0.5">
              Operasyon Durumu
            </div>
            <div className="text-[12px] text-foreground font-medium leading-snug">
              {vp.operationStatus}
            </div>
          </div>
        )}

        {vp?.description && (
          <div className="mt-2 px-3 py-2 rounded-xl bg-sky-500/8 border border-sky-500/20">
            <div className="text-[9px] uppercase tracking-wider text-sky-700 mb-0.5">
              Önemli Not
            </div>
            <div className="text-[12px] text-foreground leading-snug whitespace-pre-wrap">
              {vp.description}
            </div>
          </div>
        )}

        {vp?.demurrage && <DemurrageNotes notes={vp.demurrage} />}

        {vp?.paymentStatus && (
          <div className="mt-2 px-3 py-2 rounded-xl bg-violet-500/8 border border-violet-500/20">
            <div className="text-[9px] uppercase tracking-wider text-violet-700 mb-0.5">
              Ödeme Durumu
            </div>
            <div className="text-[12px] text-foreground font-medium leading-snug">
              {vp.paymentStatus}
            </div>
          </div>
        )}
      </div>
    </GlassPanel>
  );
}

/** Single-line contractual metadata strip for company / Incoterm /
 *  payment term. Each pair is rendered inline (small-caps label + bold
 *  value) with a middle-dot separator between pairs. Empty fields are
 *  skipped, the divider drops with them. Total height ~22px — replaces
 *  the previous 3-row grid that ate ~60px for short values like
 *  "DTRK / FOB / CAD". */
function ContractStrip({
  companyId,
  deliveryTerm,
  paymentTerm,
  paymentSchedule,
}: {
  companyId?: string | null;
  deliveryTerm?: string | null;
  paymentTerm?: string | null;
  paymentSchedule?: string | null;
}) {
  const items: { label: string; value: string }[] = [];
  if (companyId) items.push({ label: "Şirket", value: companyId });
  if (deliveryTerm) items.push({ label: "Teslimat", value: deliveryTerm });
  // Payment combines term + schedule under one "Ödeme" label so the strip
  // doesn't repeat the word: "ÖDEME CAD – 30/60/90".
  const paymentParts = [paymentTerm, paymentSchedule].filter(
    (p): p is string => !!p && p.trim().length > 0
  );
  if (paymentParts.length > 0)
    items.push({ label: "Ödeme", value: paymentParts.join(" – ") });
  if (items.length === 0) return null;
  return (
    <div className="mt-2 pt-2 border-t border-border/40 flex items-baseline gap-x-2 flex-nowrap whitespace-nowrap overflow-hidden text-[10px]">
      {items.map((it, i) => (
        <span key={it.label} className="inline-flex items-baseline gap-1 min-w-0">
          {i > 0 && (
            <span aria-hidden className="text-foreground/30 mr-1 shrink-0">
              ·
            </span>
          )}
          <span className="uppercase tracking-wider text-muted-foreground text-[8.5px] font-medium shrink-0">
            {it.label}
          </span>
          <span className="font-semibold text-foreground tabular-nums truncate">
            {it.value}
          </span>
        </span>
      ))}
    </div>
  );
}

/** Bulleted list of demurrage reasons + descriptions for the loading and
 *  discharge ports. Only entries with a value render — operators frequently
 *  fill in just one side, so the block stays terse. Amber palette flags the
 *  cost / risk nature of the data. */
function DemurrageNotes({
  notes,
}: {
  notes: NonNullable<Project["vesselPlan"]>["demurrage"];
}) {
  if (!notes) return null;
  const items: { label: string; value: string }[] = [];
  if (notes.loadingDescription)
    items.push({
      label: "Yükleme limanı",
      value: notes.loadingDescription,
    });
  if (notes.dischargeDescription)
    items.push({
      label: "Tahliye limanı",
      value: notes.dischargeDescription,
    });
  if (items.length === 0) return null;

  return (
    <div className="mt-2 px-3 py-2 rounded-xl bg-amber-500/8 border border-amber-500/20">
      <div className="text-[9px] uppercase tracking-wider text-amber-700 mb-1">
        Demuraj Notları
      </div>
      <ul className="space-y-1 text-[12px] leading-snug">
        {items.map((item) => (
          <li key={item.label} className="flex gap-1.5">
            <span
              aria-hidden
              className="mt-1.5 size-1 rounded-full bg-amber-600/70 shrink-0"
            />
            <span className="min-w-0">
              <span className="font-medium text-foreground">{item.label}:</span>{" "}
              <span className="text-foreground/85 whitespace-pre-wrap">
                {item.value}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">
        <span className="[&>svg]:size-3">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="text-[11.5px] font-medium text-foreground/90 truncate mt-0.5">
        {value}
      </div>
    </div>
  );
}

/**
 * Reject pure-numeric strings as a vessel name display value.
 * F&O sometimes leaks a `mserp_vessel` RecID (e.g. "5637588578") when
 * the composer's resolution chain can't find a real string. Showing
 * a 10-digit number as a vessel name reads as nonsense — surface
 * the em-dash placeholder instead.
 */
function isMeaningfulName(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (t === "—") return false;
  if (/^\d[\d\s,.]*$/.test(t)) return false;
  return true;
}

/**
 * Render "<projectDate> / <operationPeriod>" with em-dash
 * placeholders for missing sides:
 *
 *   both set    → "21.04.2026 / 15.05.2026"
 *   only signing→ "21.04.2026 / —"
 *   only exec   → "— / 15.05.2026"
 *   neither     → "—"
 *
 * Compact enough to share the right-rail row with the icon + label,
 * scannable enough that operators see the operasyon periyodu next
 * to the signing date without expanding anything.
 */
function formatProjectDates(p: Project): string {
  const proje = p.projectDate ? formatDate(p.projectDate) : "—";
  const operasyon = p.operationPeriod ? formatDate(p.operationPeriod) : "—";
  if (proje === "—" && operasyon === "—") return "—";
  return `${proje} / ${operasyon}`;
}
