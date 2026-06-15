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
import { useT } from "@/lib/i18n/LanguageProvider";
import type { StageProgress } from "@/hooks/useActualExpenseRollup";
import type { RollupStage } from "@/lib/dataverse/actualExpenseRollup";

interface PLCostProgressProps {
  /** Per-stage progress entries from the hook. */
  stages: StageProgress[];
  /** Total active project count to render in the engine subtitle. */
  totalProjects: number;
}

/** Per-stage icon + translation-key base. The user-facing text
 *  (title / running sub-line / count label / AI phrase) is resolved at
 *  render time via `t()` keyed on this base — see `resolveStageMeta`.
 *  Wording is end-user friendly — no F&O entity names, no system
 *  jargon like "inventdimid". Each stage gets its own glyph so the
 *  user sees the chain visually progress. */
const STAGE_META: Record<
  RollupStage,
  {
    /** Translation key base, e.g. "tc.progress.inventdimb". */
    keyBase: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon: any;
  }
> = {
  inventdimb: { keyBase: "tc.progress.inventdimb", icon: Folder01Icon },
  refmap: { keyBase: "tc.progress.refmap", icon: Tag01Icon },
  dist: { keyBase: "tc.progress.dist", icon: ReceiptDollarIcon },
  "expense-line": {
    keyBase: "tc.progress.expenseLine",
    icon: Invoice03Icon,
  },
  aggregate: { keyBase: "tc.progress.aggregate", icon: ChartHistogramIcon },
};

/** Resolved, language-aware copy for one stage. Built per render from
 *  `STAGE_META` + the active `t()`. `countLabel` keeps the formatting
 *  numeric (locale-agnostic) and only translates the surrounding noun
 *  phrase — e.g. "1.234 project records resolved". */
interface ResolvedStageMeta {
  title: string;
  runningSubtitle: string;
  countLabel: (n: number) => string;
  aiPhrase: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
}
function resolveStageMeta(
  stage: RollupStage,
  t: (key: string) => string
): ResolvedStageMeta {
  const { keyBase, icon } = STAGE_META[stage];
  return {
    title: t(`${keyBase}.title`),
    runningSubtitle: t(`${keyBase}.sub`),
    countLabel: (n) => `${formatNumber(n, 0)} ${t(`${keyBase}.count`)}`,
    aiPhrase: t(`${keyBase}.phrase`),
    icon,
  };
}

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
  const t = useT();
  const accent = useThemeAccent();

  // The headline phrase follows the actively-running stage. We pick
  // the first stage in `running` status; if none are running yet
  // (early mount) or all done (which shouldn't render here anyway)
  // we fall back to the idle phrase. This makes the header read as
  // an AI narrating its current thought instead of a static label.
  const runningStage = stages.find((s) => s.status === "running");
  const aiPhrase = runningStage
    ? t(`${STAGE_META[runningStage.stage].keyBase}.phrase`)
    : t("tc.progress.idle");

  return (
    <div className="h-full flex items-center justify-center p-6 overflow-y-auto">
      <div className="w-full max-w-2xl space-y-7">
        {/* ─── Engine header ─── Stacked, breathable hierarchy:
              1) the haloed AI badge anchors the eye
              2) a "TYRO AI MOTORU" pill on its own line (no inline
                 icon — the badge above already plays that role)
              3) a thought-stream phrase that changes as the engine
                 moves through stages — with wave-bouncing dots that
                 read as "the AI is currently mid-thought"
              4) a one-line description for context */}
        <div className="flex flex-col items-center gap-5 text-center">
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

          {/* "TYRO AI Motoru" wordmark — pill chrome dropped, swapped
              for a large gradient wordmark that mirrors the logo's
              sky-navy sweep. Reads as a brand moment between the
              badge above and the thought-stream phrase below. */}
          <span
            className="text-brand-gradient text-[26px] font-bold uppercase tracking-[0.18em] leading-none"
          >
            {t("tc.progress.engine")}
          </span>

          {/* Dynamic phrase + bouncing wave dots. The phrase swaps
              with a soft fade as stages advance — Framer's
              `AnimatePresence` would be lovely but Motion's `key`
              + `initial/animate/exit` on a span needs a wrapper;
              we keep the math simple with `motion.span` keyed on
              the phrase string so the new wording mounts fresh
              each time. */}
          <div
            className="flex items-center gap-2.5 max-w-xl"
            style={{ color: accent.solid }}
          >
            <motion.span
              key={aiPhrase}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="text-[24px] font-bold tracking-tight leading-tight"
            >
              {aiPhrase}
            </motion.span>
            <WaveDots color={accent.solid} />
          </div>

          <p className="text-[13px] text-muted-foreground max-w-md leading-snug">
            <strong className="text-foreground">{totalProjects}</strong>{" "}
            {t("tc.progress.descA")}
          </p>
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
                meta={resolveStageMeta(s.stage, t)}
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

/**
 * Three dots bouncing in a tidy wave — classic "AI is thinking"
 * affordance, sized to read at the end of a 24 px headline. Each
 * dot translates ~4 px on Y at staggered intervals so the eye
 * catches a sine-wave shape moving left → right.
 */
function WaveDots({ color }: { color: string }) {
  return (
    <span className="inline-flex items-end gap-1 pb-1.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{
            y: [0, -5, 0],
            opacity: [0.45, 1, 0.45],
          }}
          transition={{
            duration: 1.05,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.16,
          }}
          className="size-[7px] rounded-full"
          style={{ backgroundColor: color }}
        />
      ))}
    </span>
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
  meta: ResolvedStageMeta;
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
