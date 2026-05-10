import { motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkCircle02Icon,
  AiBrain03Icon,
  Folder01Icon,
  Tag01Icon,
  ReceiptDollarIcon,
  Invoice03Icon,
  ChartHistogramIcon,
} from "@hugeicons/core-free-icons";
import { Loader2 } from "lucide-react";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { useThemeAccent } from "@/components/layout/theme-accent";
import { formatNumber } from "@/lib/format";
import type { StageProgress } from "@/hooks/useActualExpenseRollup";
import type { RollupStage } from "@/lib/dataverse/actualExpenseRollup";

interface PLCostProgressProps {
  /** Per-stage progress entries from the hook. */
  stages: StageProgress[];
  /** Total active project count to render in the engine subtitle. */
  totalProjects: number;
}

/** Localised label + descriptive sub-line for each rollup stage.
 *  Wording is end-user friendly — no F&O entity names, no system
 *  jargon like "inventdimid". Each stage gets its own glyph so the
 *  user sees the chain visually progress. */
const STAGE_META: Record<
  RollupStage,
  {
    title: string;
    /** Pre-completion sub-line — what the engine is doing right now. */
    runningSubtitle: string;
    /** Post-completion count formatter — what just landed. */
    countLabel: (n: number) => string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon: any;
  }
> = {
  inventdimb: {
    title: "Proje Tanım Kayıtları",
    runningSubtitle: "Aktif projelere ait kayıt anahtarları toplanıyor",
    countLabel: (n) => `${formatNumber(n, 0)} proje kaydı çözümlendi`,
    icon: Folder01Icon,
  },
  refmap: {
    title: "Masraf Sınıflandırma",
    runningSubtitle:
      "Tahmini gider sınıflarının metinsel etiketleri eşleniyor",
    countLabel: (n) => `${formatNumber(n, 0)} masraf kategorisi haritalandı`,
    icon: Tag01Icon,
  },
  dist: {
    title: "Masraf Tahsisat Bağlantıları",
    runningSubtitle:
      "Proje kayıtlarına bağlı masraf voucher numaraları taranıyor",
    countLabel: (n) => `${formatNumber(n, 0)} masraf vorucher'ı bağlandı`,
    icon: ReceiptDollarIcon,
  },
  "expense-line": {
    title: "Gerçekleşen Gider Satırları",
    runningSubtitle: "Authoritative masraf satırları indiriliyor",
    countLabel: (n) => `${formatNumber(n, 0)} fatura satırı analiz edildi`,
    icon: Invoice03Icon,
  },
  aggregate: {
    title: "Toplama & Optimizasyon",
    runningSubtitle:
      "Fiyat farkları düşülüyor, proje × kategori bazında konsolide ediliyor",
    countLabel: (n) =>
      `${formatNumber(n, 0)} özet satırı oluşturuldu — analiz hazır`,
    icon: ChartHistogramIcon,
  },
};

/**
 * Premium AI-engine-style progress UI — chain-of-thought reveal as
 * each stage of the realised-expense pipeline completes. Tyrowms
 * pattern: centred AI brain badge, three breathing dots, then a
 * stack of step rows that flip from pending → running (spinner) →
 * done (tick + record count). Sub-lines avoid F&O entity names so
 * non-technical executives understand the flow.
 */
export function PLCostProgress({
  stages,
  totalProjects,
}: PLCostProgressProps) {
  const accent = useThemeAccent();

  return (
    <div className="h-full flex items-center justify-center p-6 overflow-y-auto">
      <div className="w-full max-w-2xl space-y-6">
        {/* ─── Engine header ─── */}
        <div className="flex flex-col items-center gap-4 text-center">
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
            className="size-24 rounded-3xl grid place-items-center text-white shadow-xl relative"
            style={{
              background: accent.gradient,
              boxShadow: `0 24px 48px -16px ${accent.ring}, inset 0 1px 0 0 rgba(255,255,255,0.4)`,
            }}
          >
            {/* Halo glow ring */}
            <motion.span
              aria-hidden
              animate={{
                scale: [1, 1.18, 1],
                opacity: [0.45, 0, 0.45],
              }}
              transition={{
                duration: 2.4,
                repeat: Infinity,
                ease: "easeOut",
              }}
              className="absolute inset-0 rounded-3xl"
              style={{
                background: accent.gradient,
                filter: "blur(8px)",
              }}
            />
            <HugeiconsIcon
              icon={AiBrain03Icon}
              size={44}
              strokeWidth={1.5}
              className="relative z-10"
            />
          </motion.span>
          <div>
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11.5px] uppercase tracking-[0.22em] font-bold shadow-sm"
              style={{
                background: accent.tint,
                color: accent.solid,
                boxShadow: `inset 0 0 0 1px ${accent.ring}`,
              }}
            >
              <HugeiconsIcon
                icon={AiBrain03Icon}
                size={13}
                strokeWidth={2.25}
              />
              TYRO AI Motoru
            </div>
            <div
              className="text-[22px] font-bold tracking-tight mt-1 inline-flex items-center gap-2"
              style={{ color: accent.solid }}
            >
              Veriler Konsolide Ediliyor
              <span className="inline-flex gap-0.5 items-center">
                <Dot delay={0} color={accent.solid} />
                <Dot delay={0.2} color={accent.solid} />
                <Dot delay={0.4} color={accent.solid} />
              </span>
            </div>
            <div className="text-[13px] text-muted-foreground mt-1.5 max-w-md mx-auto leading-snug">
              <strong className="text-foreground">{totalProjects}</strong>{" "}
              projeye ait gerçekleşen gider verileri zincirleme analiz ile
              toplanıyor. Her adımın çıktısı bir sonraki adımın girdisi
              oluyor — yapay zekânın muhakeme süreci gibi.
            </div>
          </div>
        </div>

        {/* ─── Step list ─── */}
        <GlassPanel
          tone="strong"
          className="rounded-2xl shadow-[0_18px_40px_-12px_rgba(15,23,42,0.18)]"
        >
          <ol className="p-3 space-y-2">
            {stages.map((s, idx) => (
              <StepRow
                key={s.stage}
                stage={s}
                meta={STAGE_META[s.stage]}
                accentSolid={accent.solid}
                accentTint={accent.tint}
                accentRing={accent.ring}
                accentGradient={accent.gradient}
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
  accentRing,
  accentGradient,
  stepNumber,
}: {
  stage: StageProgress;
  meta: (typeof STAGE_META)[RollupStage];
  accentSolid: string;
  accentTint: string;
  accentRing: string;
  accentGradient: string;
  stepNumber: number;
}) {
  const isRunning = stage.status === "running";
  const isDone = stage.status === "done";
  const isPending = stage.status === "pending";

  // Running + done both follow the sidebar accent — only the
  // intensity differs (running pops with full solid border, done
  // settles into a softer tint). Pending stays neutral gray.
  const bgColor = isRunning
    ? accentTint
    : isDone
      ? accentTint
      : "rgba(255,255,255,0.5)";
  const borderColor = isRunning
    ? accentSolid
    : isDone
      ? accentRing
      : "rgba(100,116,139,0.16)";

  return (
    <motion.li
      layout
      animate={{
        backgroundColor: bgColor,
        borderColor: borderColor,
      }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex items-center gap-3 rounded-xl px-3.5 py-3 border"
    >
      {/* Stage icon — gradient pill while running, accent gradient
          pill while done (same family, slightly softer ring). Pulse
          glow on the running stage so the eye anchors there even
          with a quick scan. */}
      <span
        className="shrink-0 size-11 rounded-2xl grid place-items-center shadow-sm relative"
        style={{
          background: isRunning
            ? `linear-gradient(135deg, ${accentSolid}, ${accentSolid}dd)`
            : isDone
              ? accentGradient
              : "rgb(248 250 252)",
          color: isRunning || isDone ? "white" : "rgb(148 163 184)",
          boxShadow: isDone
            ? `0 4px 12px -4px ${accentRing}, inset 0 1px 0 0 rgba(255,255,255,0.25)`
            : undefined,
        }}
      >
        {isRunning && (
          <motion.span
            aria-hidden
            animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }}
            transition={{
              duration: 1.6,
              repeat: Infinity,
              ease: "easeOut",
            }}
            className="absolute inset-0 rounded-2xl"
            style={{ background: accentSolid }}
          />
        )}
        <HugeiconsIcon
          icon={meta.icon}
          size={20}
          strokeWidth={2}
          className="relative z-10"
        />
      </span>

      {/* Title + subtitle */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded ${
              isPending
                ? "text-muted-foreground/50 bg-foreground/[0.04]"
                : "text-white"
            }`}
            style={
              isRunning || isDone
                ? { backgroundColor: accentSolid }
                : undefined
            }
          >
            {stepNumber.toString().padStart(2, "0")}
          </span>
          <span
            className={`text-[14px] font-bold leading-tight truncate ${
              isPending ? "text-muted-foreground/70" : "text-foreground"
            }`}
          >
            {meta.title}
          </span>
        </div>
        <div
          className={`text-[12px] leading-snug truncate mt-1 ${
            isDone
              ? "font-semibold"
              : isRunning
                ? "font-medium"
                : "text-muted-foreground/80"
          }`}
          style={
            isDone || isRunning
              ? { color: accentSolid }
              : undefined
          }
        >
          {isDone && stage.count !== null
            ? meta.countLabel(stage.count)
            : meta.runningSubtitle}
        </div>
      </div>

      {/* Status indicator on the right — tick / spinner / blank */}
      <span className="shrink-0 size-6 grid place-items-center">
        {isDone ? (
          <HugeiconsIcon
            icon={CheckmarkCircle02Icon}
            size={22}
            strokeWidth={2}
            style={{ color: accentSolid }}
          />
        ) : isRunning ? (
          <Loader2
            className="size-5 animate-spin"
            style={{ color: accentSolid }}
          />
        ) : null}
      </span>
    </motion.li>
  );
}
