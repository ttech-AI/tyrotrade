import { motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkCircle02Icon,
  Circle as CircleIcon,
  DashboardSpeed01Icon,
} from "@hugeicons/core-free-icons";
import { Loader2 } from "lucide-react";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { useThemeAccent } from "@/components/layout/theme-accent";
import {
  formatNumber,
} from "@/lib/format";
import type { StageProgress } from "@/hooks/useActualExpenseRollup";
import type { RollupStage } from "@/lib/dataverse/actualExpenseRollup";

interface PLCostProgressProps {
  /** Per-stage progress entries from the hook. */
  stages: StageProgress[];
  /** Total active project count to render in the engine subtitle. */
  totalProjects: number;
}

/** Localised label + descriptive sub-line for each rollup stage. */
const STAGE_META: Record<
  RollupStage,
  { title: string; subtitle: string; countLabel: (n: number) => string }
> = {
  inventdimb: {
    title: "Envanter Boyutları",
    subtitle: "Projelere ait inventdimid kayıtları toplanıyor",
    countLabel: (n) => `${formatNumber(n, 0)} envanter ID bulundu`,
  },
  refmap: {
    title: "Masraf Sınıfı Eşlemesi",
    subtitle: "Tahmini gider sınıflarının metinsel etiketleri çekiliyor",
    countLabel: (n) => `${formatNumber(n, 0)} eşleme satırı yüklendi`,
  },
  dist: {
    title: "Dağıtım Satırları",
    subtitle: "Envanter ID'lerine bağlı masraf voucher numaraları çekiliyor",
    countLabel: (n) => `${formatNumber(n, 0)} masraf no toplandı`,
  },
  "expense-line": {
    title: "Gerçekleşen Gider Satırları",
    subtitle: "Authoritative masraf satırları getiriliyor",
    countLabel: (n) => `${formatNumber(n, 0)} ham satır indirildi`,
  },
  aggregate: {
    title: "Aggregate + Cache",
    subtitle: "710041 fiyat farkı düşülüyor, proje × kategori toplanıyor",
    countLabel: (n) => `${formatNumber(n, 0)} rollup satırı oluşturuldu`,
  },
};

/**
 * Adım-adım veri çekme progress UI'ı (tyrowms tarzı).
 *
 * Merkezde gradient pill icon (pulse animasyon), altında "TYRO Hesap
 * Motoru" başlığı + proje sayısı. Liste şeklinde adımlar — her birinin
 * solunda tick (done) / spinner (running) / muted circle (pending),
 * sağında gerçek sayı ("465 envanter ID bulundu").
 */
export function PLCostProgress({
  stages,
  totalProjects,
}: PLCostProgressProps) {
  const accent = useThemeAccent();

  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="w-full max-w-xl space-y-6">
        {/* ─── Engine header ─── */}
        <div className="flex flex-col items-center gap-3 text-center">
          <motion.span
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{
              scale: [1, 1.04, 1],
              opacity: 1,
            }}
            transition={{
              scale: {
                duration: 2.4,
                repeat: Infinity,
                ease: "easeInOut",
              },
              opacity: { duration: 0.4 },
            }}
            className="size-20 rounded-3xl grid place-items-center text-white shadow-xl"
            style={{
              background: accent.gradient,
              boxShadow: `0 18px 40px -12px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.32)`,
            }}
          >
            <HugeiconsIcon
              icon={DashboardSpeed01Icon}
              size={36}
              strokeWidth={1.75}
            />
          </motion.span>
          <div>
            <div
              className="text-[18px] font-bold tracking-tight"
              style={{ color: accent.solid }}
            >
              TYRO Hesap Motoru
              <span className="inline-flex gap-0.5 ml-1.5 items-center">
                <Dot delay={0} color={accent.solid} />
                <Dot delay={0.2} color={accent.solid} />
                <Dot delay={0.4} color={accent.solid} />
              </span>
            </div>
            <div className="text-[12.5px] text-muted-foreground mt-0.5">
              <strong>{totalProjects}</strong> proje için gerçekleşen gider
              hesaplanıyor
            </div>
          </div>
        </div>

        {/* ─── Step list ─── */}
        <GlassPanel tone="subtle" className="rounded-2xl">
          <ol className="p-2 space-y-1.5">
            {stages.map((s, idx) => (
              <StepRow
                key={s.stage}
                stage={s}
                meta={STAGE_META[s.stage]}
                accentSolid={accent.solid}
                accentTint={accent.tint}
                stepNumber={idx + 1}
              />
            ))}
          </ol>
        </GlassPanel>
      </div>
    </div>
  );
}

function Dot({ delay, color }: { delay: number; color: string }) {
  return (
    <motion.span
      animate={{ opacity: [0.3, 1, 0.3] }}
      transition={{ duration: 1.4, repeat: Infinity, delay, ease: "easeInOut" }}
      className="size-1.5 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

function StepRow({
  stage,
  meta,
  accentSolid,
  accentTint,
  stepNumber,
}: {
  stage: StageProgress;
  meta: (typeof STAGE_META)[RollupStage];
  accentSolid: string;
  accentTint: string;
  stepNumber: number;
}) {
  const isRunning = stage.status === "running";
  const isDone = stage.status === "done";
  const isPending = stage.status === "pending";

  const bgColor = isRunning
    ? accentTint
    : isDone
      ? "rgba(16,185,129,0.10)"
      : "transparent";
  const borderColor = isRunning
    ? accentSolid
    : isDone
      ? "rgba(16,185,129,0.30)"
      : "rgba(100,116,139,0.20)";

  return (
    <li
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all"
      style={{
        backgroundColor: bgColor,
        border: `1px solid ${borderColor}`,
      }}
    >
      {/* Status icon */}
      <span className="shrink-0 size-9 rounded-xl grid place-items-center bg-white shadow-sm">
        {isDone ? (
          <HugeiconsIcon
            icon={CheckmarkCircle02Icon}
            size={20}
            strokeWidth={2}
            style={{ color: "rgb(4 120 87)" }}
          />
        ) : isRunning ? (
          <Loader2
            className="size-5 animate-spin"
            style={{ color: accentSolid }}
          />
        ) : (
          <HugeiconsIcon
            icon={CircleIcon}
            size={20}
            strokeWidth={1.5}
            style={{ color: "rgb(148 163 184)" }}
          />
        )}
      </span>
      {/* Title + subtitle */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={`text-[10px] font-bold tabular-nums ${
              isPending
                ? "text-muted-foreground/50"
                : "text-muted-foreground/80"
            }`}
          >
            {stepNumber.toString().padStart(2, "0")}
          </span>
          <span
            className={`text-[13px] font-semibold leading-tight truncate ${
              isPending ? "text-muted-foreground/65" : "text-foreground"
            }`}
          >
            {meta.title}
          </span>
        </div>
        <div
          className={`text-[11.5px] leading-snug truncate mt-0.5 ${
            isDone && stage.count !== null
              ? "font-medium"
              : "text-muted-foreground/80"
          }`}
          style={
            isDone && stage.count !== null ? { color: accentSolid } : undefined
          }
        >
          {isDone && stage.count !== null
            ? meta.countLabel(stage.count)
            : meta.subtitle}
        </div>
      </div>
    </li>
  );
}
